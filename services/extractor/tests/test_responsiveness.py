"""The health endpoint must respond before slow synchronous extraction finishes."""

import asyncio
import io
from threading import Event

import docx
import httpx
import pytest

from app import main


@pytest.mark.parametrize("operation", ["detect_format", "parse"])
def test_health_responds_while_extraction_is_busy(monkeypatch, operation):
    entered = Event()
    release = Event()
    original = getattr(main, operation)

    def paused_operation(*args):
        entered.set()
        # A guard prevents a broken implementation from hanging the test suite.
        if not release.wait(timeout=5):
            raise RuntimeError("Health request could not run while extraction was busy")
        return original(*args)

    monkeypatch.setattr(main, operation, paused_operation)
    document = docx.Document()
    document.add_paragraph("1. Проверять закупки.")
    buffer = io.BytesIO()
    document.save(buffer)

    async def scenario():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=main.app), base_url="http://extractor"
        ) as client:
            upload = asyncio.create_task(client.post(
                "/extract", files={"file": ("busy.docx", buffer.getvalue())}
            ))
            try:
                assert await asyncio.to_thread(entered.wait, 2), "Extraction did not start"
                health = await asyncio.wait_for(client.get("/health"), timeout=2)
                assert health.status_code == 200
                assert health.json() == {"status": "ok"}
                assert not upload.done(), "Health must respond before extraction completes"
            finally:
                release.set()
                result = await upload
            assert result.status_code == 200
            assert result.json()["fragments"][0]["ref"] == "п. 1, абзац 1"

    asyncio.run(scenario())
