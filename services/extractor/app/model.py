"""Shared output model and helpers for every parser.

Each document is turned into an ordered list of fragments. A fragment is the
smallest unit a later finding can cite: it keeps its text, the clause number
(if any), the section it belongs to and an exact location in the source file.
"""

import re
from dataclasses import dataclass, field
from typing import Any

# "3.2.1", "3.2.1.", "3.", "3)" at the start of a line. A bare number without a
# dot or bracket ("15 сотрудников") is deliberately not treated as a clause.
_NUMERIC_CLAUSE = re.compile(r"^\s*((?:\d{1,3}\.)+\d{1,3}\.?|\d{1,3}[.)])\s+(?=\S)")
# "Глава 2", "Раздел IV", "Статья 5".
_NAMED_CLAUSE = re.compile(
    r"^\s*((?:Глава|Раздел|Статья|Часть|Приложение)\s+(?:\d{1,3}|[IVXLC]{1,6}))\b", re.IGNORECASE
)
# Sub-item markers "а)", "б.", "a)". They are not clauses: the backend attaches the
# sub-item to the open clause and builds ids like "5.3.2.а" from this marker.
_MARKER = re.compile(r"^\s*([а-яёa-z])[.)]\s+(?=\S)")
_SPACES = re.compile(r"[ \t   ]+")


class ExtractionError(Exception):
    """A client-facing failure with a stable error code and HTTP status."""

    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def clean_text(value: Any) -> str:
    text = "" if value is None else str(value)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    return _SPACES.sub(" ", text).strip()


def marker_from_text(text: str) -> str | None:
    match = _MARKER.match(text)
    return match.group(1) if match else None


def clause_from_text(text: str) -> str | None:
    """Clause number written literally at the start of the text, if any."""
    match = _NUMERIC_CLAUSE.match(text) or _NAMED_CLAUSE.match(text)
    if not match:
        return None
    return match.group(1).rstrip(".)")


@dataclass
class Fragment:
    kind: str  # heading | paragraph | list_item | table_row | sheet_row
    text: str
    location: dict[str, Any]
    ref: str  # human-readable citation, e.g. "п. 3.2, абзац 14"
    clause: str | None = None
    marker: str | None = None  # sub-item letter ("а"); clause stays None for sub-items
    section: str | None = None

    def to_dict(self, index: int) -> dict[str, Any]:
        return {
            "id": f"f{index:05d}",
            "kind": self.kind,
            "text": self.text,
            "clause": self.clause,
            "marker": self.marker,
            "section": self.section,
            "location": self.location,
            "ref": self.ref,
        }


@dataclass
class ParseResult:
    fragments: list[Fragment] = field(default_factory=list)
    title: str | None = None
    meta: dict[str, Any] = field(default_factory=dict)  # format-specific: pages, sheets
    warnings: list[str] = field(default_factory=list)


def clause_ref(clause: str | None, where: str) -> str:
    if not clause:
        return where
    prefix = "" if " " in clause else "п. "  # "Глава 2" already names itself
    return f"{prefix}{clause}, {where}"
