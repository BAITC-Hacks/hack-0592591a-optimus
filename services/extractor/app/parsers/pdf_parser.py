"""PDF with a text layer: lines per page, merged into clause-sized paragraphs.

Scanned PDFs (no text layer) are reported as a warning; OCR is not performed.
"""

import io
import re

import pdfplumber

from ..model import ExtractionError, Fragment, ParseResult, clause_from_text, clause_ref, clean_text, marker_from_text

MAX_PAGES = 300
_BULLET = re.compile(r"^\s*[-–—•·▪]\s+")
_SENTENCE_END = (".", ";", ":", "!", "?")


def _is_heading(line: str) -> bool:
    letters = [ch for ch in line if ch.isalpha()]
    return 3 <= len(letters) and len(line) <= 120 and all(ch.isupper() for ch in letters)


def _starts_block(line: str) -> bool:
    return bool(clause_from_text(line) or _BULLET.match(line) or _is_heading(line))


def _join(previous: str, line: str) -> str:
    # Re-join words hyphenated at a line break: "подразде-" + "ления".
    if previous.endswith("-") and line[:1].islower():
        return previous[:-1] + line
    return f"{previous} {line}"


def parse_pdf(data: bytes) -> ParseResult:
    result = ParseResult()
    try:
        pdf = pdfplumber.open(io.BytesIO(data))
    except Exception as exc:  # pdfminer raises its own hierarchy, including for passwords
        raise ExtractionError(422, "unreadable_document", "Не удалось прочитать PDF (файл повреждён или защищён паролем).") from exc

    with pdf:
        pages = pdf.pages
        if len(pages) > MAX_PAGES:
            raise ExtractionError(413, "document_too_large", f"PDF содержит больше {MAX_PAGES} страниц.")
        empty_pages = []
        section: str | None = None
        for page_no, page in enumerate(pages, start=1):
            try:
                raw = page.extract_text() or ""
            except Exception as exc:
                raise ExtractionError(422, "unreadable_document", f"Не удалось прочитать страницу {page_no} PDF.") from exc
            lines = [clean_text(line) for line in raw.split("\n")]
            if not any(lines):
                empty_pages.append(page_no)
                continue

            block: list[str] = []
            first_line = 0

            def flush(last_line: int) -> None:
                nonlocal section
                if not block:
                    return
                text = block[0]
                for line in block[1:]:
                    text = _join(text, line)
                clause = clause_from_text(text)
                marker = None if clause else marker_from_text(text)
                heading = len(block) == 1 and _is_heading(text)
                span = f"строка {first_line}" if first_line == last_line else f"строки {first_line}–{last_line}"
                result.fragments.append(Fragment(
                    kind="heading" if heading else ("list_item" if _BULLET.match(text) else "paragraph"),
                    text=text,
                    clause=clause,
                    marker=marker,
                    section=section,
                    location={"page": page_no, "line_start": first_line, "line_end": last_line},
                    ref=clause_ref(clause, f"стр. {page_no}, {span}"),
                ))
                if heading:
                    section = text
                    if result.title is None:
                        result.title = text
                block.clear()

            for line_no, line in enumerate(lines, start=1):
                if not line:
                    flush(line_no - 1)
                    continue
                if block and (_starts_block(line) or block[-1].endswith(_SENTENCE_END) or _is_heading(block[-1])):
                    flush(line_no - 1)
                if not block:
                    first_line = line_no
                block.append(line)
            flush(len(lines))

        result.meta = {"pages": len(pages)}
        if empty_pages:
            listed = ", ".join(map(str, empty_pages[:20])) + ("…" if len(empty_pages) > 20 else "")
            result.warnings.append(
                f"Нет текстового слоя на страницах: {listed}. Вероятно, это скан; распознавание (OCR) не выполняется."
            )
    return result
