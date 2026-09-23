"""Word (.docx): paragraphs and tables in document order.

Clause numbers in regulations are usually Word auto-numbering, which is not
part of the paragraph text. We rebuild it from numbering.xml so a citation can
say "п. 3.2" exactly as the reader sees it in Word.
"""

import io
import re

import docx
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph

from ..model import ExtractionError, Fragment, ParseResult, clause_from_text, clause_ref, clean_text, marker_from_text

_HEADING_STYLE = re.compile(r"^(heading|заголовок)\s*(\d)$", re.IGNORECASE)
_RU_LOWER = "абвгдежзиклмнопрстуфхцчшщэюя"


def _roman(n: int) -> str:
    out = ""
    for value, numeral in ((1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"), (90, "XC"),
                           (50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")):
        while n >= value:
            out, n = out + numeral, n - value
    return out


def _format_counter(n: int, fmt: str) -> str:
    if fmt in ("lowerLetter", "upperLetter"):
        letter = chr(ord("a") + (n - 1) % 26)
        return letter.upper() if fmt == "upperLetter" else letter
    if fmt in ("russianLower", "russianUpper"):
        letter = _RU_LOWER[(n - 1) % len(_RU_LOWER)]
        return letter.upper() if fmt == "russianUpper" else letter
    if fmt in ("lowerRoman", "upperRoman"):
        roman = _roman(n)
        return roman.lower() if fmt == "lowerRoman" else roman
    return str(n)


class _Numbering:
    """Minimal model of Word list numbering: per-list counters with level reset."""

    def __init__(self, document):
        self.levels: dict[str, dict[int, tuple[str, str, int]]] = {}  # numId -> ilvl -> (fmt, text, start)
        self.counters: dict[str, dict[int, int]] = {}
        try:
            root = document.part.numbering_part.element
        except (KeyError, NotImplementedError):
            return
        abstract = {}
        for node in root.findall(qn("w:abstractNum")):
            lvls = {}
            for lvl in node.findall(qn("w:lvl")):
                fmt = lvl.find(qn("w:numFmt"))
                text = lvl.find(qn("w:lvlText"))
                start = lvl.find(qn("w:start"))
                lvls[int(lvl.get(qn("w:ilvl"), "0"))] = (
                    fmt.get(qn("w:val")) if fmt is not None else "decimal",
                    text.get(qn("w:val")) if text is not None else "",
                    int(start.get(qn("w:val"))) if start is not None else 1,
                )
            abstract[node.get(qn("w:abstractNumId"))] = lvls
        for num in root.findall(qn("w:num")):
            ref = num.find(qn("w:abstractNumId"))
            if ref is not None:
                self.levels[num.get(qn("w:numId"))] = abstract.get(ref.get(qn("w:val")), {})

    def next_label(self, paragraph: Paragraph) -> tuple[str | None, bool]:
        """Returns (label as Word renders it, e.g. "3.2." or "а)", is_list). None for bullets."""
        num_pr = self._num_pr(paragraph)
        if num_pr is None:
            return None, False
        num_id, ilvl = num_pr
        levels = self.levels.get(num_id)
        if not levels or ilvl not in levels or num_id == "0":
            return None, False
        counters = self.counters.setdefault(num_id, {})
        counters[ilvl] = counters.get(ilvl, levels[ilvl][2] - 1) + 1
        for deeper in [lvl for lvl in counters if lvl > ilvl]:
            del counters[deeper]
        fmt, template, _ = levels[ilvl]
        if fmt in ("bullet", "none") or not template:
            return None, True

        def substitute(match: re.Match) -> str:
            lvl = int(match.group(1)) - 1
            value = counters.get(lvl, levels.get(lvl, ("decimal", "", 1))[2])
            return _format_counter(value, levels.get(lvl, ("decimal",))[0])

        label = re.sub(r"%(\d)", substitute, template).strip()
        return (label or None), True

    @staticmethod
    def _num_pr(paragraph: Paragraph) -> tuple[str, int] | None:
        # Direct numbering first, then numbering inherited from the paragraph style.
        candidates = [paragraph._p.pPr]
        style = paragraph.style
        while style is not None:
            candidates.append(style.element.pPr)
            style = style.base_style
        for ppr in candidates:
            if ppr is None or ppr.numPr is None:
                continue
            num_id = ppr.numPr.numId
            ilvl = ppr.numPr.ilvl
            if num_id is not None:
                return str(num_id.val), int(ilvl.val) if ilvl is not None else 0
        return None


def parse_docx(data: bytes) -> ParseResult:
    try:
        document = docx.Document(io.BytesIO(data))
    except Exception as exc:  # python-docx raises many unrelated types on bad input
        raise ExtractionError(422, "unreadable_document", "Не удалось прочитать документ Word.") from exc

    result = ParseResult()
    numbering = _Numbering(document)
    headings: list[tuple[int, str]] = []  # heading stack: (level, text)
    paragraph_no = 0
    table_no = 0

    def section() -> str | None:
        return " › ".join(text for _, text in headings) or None

    for block in document.iter_inner_content():
        if isinstance(block, Paragraph):
            paragraph_no += 1
            text = clean_text(block.text)
            label, is_list = numbering.next_label(block)
            if not text:
                continue
            style_name = block.style.name if block.style is not None else ""
            heading = _HEADING_STYLE.match(style_name)
            is_title = style_name.lower() in ("title", "название")
            if label and not any(ch.isdigit() for ch in label):  # "а)" is a sub-item, not a clause
                clause, marker = None, label.rstrip(".)")
            else:
                clause = label.rstrip(".)") if label else clause_from_text(text)
                marker = None if clause else marker_from_text(text)
            where = f"абзац {paragraph_no}"
            fragment = Fragment(
                kind="heading" if heading or is_title else ("list_item" if is_list else "paragraph"),
                text=f"{label} {text}" if label else text,
                clause=clause,
                marker=marker,
                section=section(),
                location={"paragraph": paragraph_no},
                ref=clause_ref(clause, where),
            )
            result.fragments.append(fragment)
            if is_title and result.title is None:
                result.title = text
            if heading:
                level = int(heading.group(2))
                headings = [h for h in headings if h[0] < level] + [(level, fragment.text)]
                if result.title is None:
                    result.title = text
        elif isinstance(block, Table):
            table_no += 1
            for row_no, row in enumerate(block.rows, start=1):
                seen, cells = set(), []
                for cell in row.cells:  # merged cells repeat the same element
                    if id(cell._tc) in seen:
                        continue
                    seen.add(id(cell._tc))
                    cells.append(clean_text(cell.text).replace("\n", " "))
                if not any(cells):
                    continue
                text = " | ".join(cells)
                clause = clause_from_text(cells[0]) if cells[0] else None
                result.fragments.append(Fragment(
                    kind="table_row",
                    text=text,
                    clause=clause,
                    section=section(),
                    location={"table": table_no, "row": row_no, "cells": cells},
                    ref=clause_ref(clause, f"таблица {table_no}, строка {row_no}"),
                ))

    result.meta = {"paragraphs": paragraph_no, "tables": table_no}
    return result
