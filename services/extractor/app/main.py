"""Internal document extraction service.

POST /extract (multipart field "file") -> traceable fragments of a Word, PDF
or Excel document. Only the backend calls it; Caddy does not expose it.
"""

import hashlib
import logging
import os
import re

from fastapi import FastAPI, File, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException as StarletteHTTPException

from .formats import detect_format
from .model import ExtractionError
from .parsers import parse

MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_MB", "20")) * 1024 * 1024
MAX_FRAGMENTS = 20_000

log = logging.getLogger("extractor")
app = FastAPI(title="OrgScope extractor", docs_url=None, redoc_url=None, openapi_url=None)


def _error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


@app.exception_handler(ExtractionError)
async def _extraction_error(_: Request, exc: ExtractionError):
    return _error(exc.status, exc.code, exc.message)


@app.exception_handler(RequestValidationError)
async def _validation_error(_: Request, __: RequestValidationError):
    return _error(400, "bad_request", "Ожидается multipart/form-data с полем file.")


@app.exception_handler(StarletteHTTPException)
async def _http_error(_: Request, exc: StarletteHTTPException):
    return _error(exc.status_code, "not_found" if exc.status_code == 404 else "bad_request", str(exc.detail))


@app.exception_handler(Exception)
async def _unexpected(_: Request, exc: Exception):
    log.exception("extraction failed", exc_info=exc)
    return _error(500, "internal_error", "Внутренняя ошибка при разборе документа.")


def _safe_filename(name: str | None) -> str:
    base = re.split(r"[\\/]", name or "")[-1]
    base = "".join(ch for ch in base if ch.isprintable()).strip()
    return base[:255] or "document"


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/extract")
async def extract(file: UploadFile = File(...)):
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise ExtractionError(413, "file_too_large", f"Файл больше {MAX_UPLOAD_BYTES // (1024 * 1024)} МБ.")
    if not data:
        raise ExtractionError(400, "empty_file", "Файл пустой.")

    filename = _safe_filename(file.filename)
    # Parsing is CPU-bound and synchronous: run it off the event loop so /health and
    # other uploads are not blocked while a large document is being parsed.
    fmt = await run_in_threadpool(detect_format, data, filename)
    result = await run_in_threadpool(parse, data, fmt)

    fragments = result.fragments
    if len(fragments) > MAX_FRAGMENTS:
        fragments = fragments[:MAX_FRAGMENTS]
        result.warnings.append(f"Документ обрезан до первых {MAX_FRAGMENTS} фрагментов.")
    if not fragments:
        result.warnings.append("В документе не найден текст.")

    items = [fragment.to_dict(i) for i, fragment in enumerate(fragments, start=1)]
    return {
        "document": {
            "filename": filename,
            "format": fmt,
            "size_bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
            "title": result.title,
            **result.meta,
        },
        "fragments": items,
        "text": "\n".join(item["text"] for item in items),
        "stats": {"fragments": len(items), "characters": sum(len(item["text"]) for item in items)},
        "warnings": result.warnings,
    }
