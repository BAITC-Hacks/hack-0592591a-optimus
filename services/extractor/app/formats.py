"""Detect the real file format from its bytes, not from the file name."""

import io
import zipfile

from .model import ExtractionError

# A small .docx/.xlsx can expand to gigabytes (zip bomb). Refuse archives whose
# declared uncompressed size is unreasonable before any parser touches them.
MAX_UNZIPPED_BYTES = 200 * 1024 * 1024

SUPPORTED = "docx, pdf, xlsx, xlsm, xls"


def detect_format(data: bytes, filename: str) -> str:
    if data.startswith(b"%PDF-"):
        return "pdf"
    if data.startswith(b"PK\x03\x04"):
        return _detect_ooxml(data)
    if data.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
        # Legacy OLE container: .xls is supported, legacy .doc is not.
        if filename.lower().endswith(".doc"):
            raise ExtractionError(
                415, "unsupported_format", "Формат .doc не поддерживается. Сохраните документ как .docx."
            )
        return "xls"
    raise ExtractionError(415, "unsupported_format", f"Неподдерживаемый формат файла. Поддерживаются: {SUPPORTED}.")


def _detect_ooxml(data: bytes) -> str:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            infos = archive.infolist()
    except zipfile.BadZipFile as exc:
        raise ExtractionError(422, "unreadable_document", "Файл повреждён: не удалось открыть архив.") from exc
    if sum(info.file_size for info in infos) > MAX_UNZIPPED_BYTES:
        raise ExtractionError(413, "document_too_large", "Распакованное содержимое документа слишком велико.")
    names = {info.filename for info in infos}
    if "word/document.xml" in names:
        return "docx"
    if "xl/workbook.xml" in names:
        return "xlsx"
    raise ExtractionError(415, "unsupported_format", f"Неподдерживаемый формат файла. Поддерживаются: {SUPPORTED}.")
