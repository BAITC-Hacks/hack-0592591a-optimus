// Conclusion export: the Markdown from the backend becomes a DOCX (built in the
// browser with the docx library) or a PDF (a print-styled window; the browser's
// «Save as PDF» keeps Cyrillic text and fonts intact). Markdown itself stays
// available for tooling.
import { marked } from "marked";
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

const FONT = "Times New Roman";

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Inline Markdown (**bold**, *italic*, `code`) → docx TextRuns. */
function runs(text, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), font: FONT, ...base }));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(new TextRun({ text: tok.slice(2, -2), bold: true, font: FONT, ...base }));
    else if (tok.startsWith("`")) out.push(new TextRun({ text: tok.slice(1, -1), font: "Courier New", ...base }));
    else out.push(new TextRun({ text: tok.slice(1, -1), italics: true, font: FONT, ...base }));
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), font: FONT, ...base }));
  return out;
}

/** Block-level Markdown (headings, lists, quotes, paragraphs) → docx Paragraphs. */
function paragraphs(markdown) {
  const out = [];
  let para = [];
  const flush = () => {
    if (para.length) out.push(new Paragraph({ children: runs(para.join(" ")), spacing: { after: 160 } }));
    para = [];
  };
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { flush(); continue; }
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      flush();
      const level = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][m[1].length - 1];
      out.push(new Paragraph({ heading: level, children: runs(m[2], { bold: true }), spacing: { before: 280, after: 160 } }));
    } else if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) {
      flush();
      out.push(new Paragraph({ children: runs(m[1]), bullet: { level: 0 }, spacing: { after: 80 } }));
    } else if ((m = line.match(/^\s*(\d+)[.)]\s+(.*)$/))) {
      flush();
      out.push(new Paragraph({ children: runs(`${m[1]}. ${m[2]}`), indent: { left: 540, hanging: 360 }, spacing: { after: 80 } }));
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      flush();
      out.push(new Paragraph({ children: runs(m[1], { italics: true }), indent: { left: 720 }, spacing: { after: 120 } }));
    } else if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      flush();
    } else {
      para.push(line.trim());
    }
  }
  flush();
  return out;
}

/** @param {{markdown: string, analysisId: string, title?: string, subtitle?: string}} opts */
export async function downloadDocx({ markdown, analysisId, title = "Аналитическое заключение", subtitle = "" }) {
  const doc = new Document({
    creator: "OrgScope",
    title,
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: [
      {
        children: [
          new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 36, font: FONT })], alignment: AlignmentType.CENTER, spacing: { after: 120 } }),
          ...(subtitle ? [new Paragraph({ children: [new TextRun({ text: subtitle, size: 20, color: "666666", font: FONT })], alignment: AlignmentType.CENTER, spacing: { after: 320 } })] : []),
          ...paragraphs(markdown),
        ],
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  saveBlob(blob, `zaklyuchenie-${analysisId}.docx`);
}

const PRINT_CSS = `
  @page { size: A4; margin: 20mm 18mm; }
  body { font: 12pt/1.5 "Times New Roman", Georgia, serif; color: #1f1e1d; max-width: 170mm; margin: 0 auto; padding: 24px; }
  h1 { font-size: 20pt; line-height: 1.25; margin: 0 0 6px; }
  .sub { color: #666; font-size: 10pt; margin: 0 0 24px; }
  h2 { font-size: 14pt; margin: 22px 0 8px; page-break-after: avoid; }
  h3 { font-size: 12.5pt; margin: 16px 0 6px; }
  p, li { margin: 0 0 8px; }
  blockquote { margin: 0 0 10px; padding-left: 12px; border-left: 3px solid #ccc; color: #444; font-style: italic; }
  hr { border: 0; border-top: 1px solid #ccc; margin: 18px 0; }
  code { font-family: "Courier New", monospace; font-size: 11pt; }
  .hint { position: fixed; top: 8px; right: 8px; font: 11px sans-serif; color: #666; background: #f5f4ef; padding: 6px 10px; border-radius: 6px; }
  @media print { .hint { display: none; } }
`;

/** Opens a print-ready copy of the conclusion and triggers the browser's print (Save as PDF). */
export function downloadPdf({ markdown, title = "Аналитическое заключение", subtitle = "" }) {
  const body = marked.parse(markdown.replace(/</g, "&lt;"), { async: false, gfm: true, breaks: false });
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PRINT_CSS}</style></head><body><div class="hint">В диалоге печати выберите «Сохранить как PDF»</div><h1>${esc(title)}</h1>${subtitle ? `<p class="sub">${esc(subtitle)}</p>` : ""}${body}</body></html>`;
  const win = window.open("", "_blank");
  if (!win) return false; // popup blocked: the caller tells the user
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
  return true;
}
