"""Format dispatch: bytes in, ParseResult out."""

from ..model import ParseResult
from .docx_parser import parse_docx
from .excel_parser import parse_excel
from .pdf_parser import parse_pdf


def parse(data: bytes, fmt: str) -> ParseResult:
    if fmt == "docx":
        return parse_docx(data)
    if fmt == "pdf":
        return parse_pdf(data)
    return parse_excel(data, fmt)
