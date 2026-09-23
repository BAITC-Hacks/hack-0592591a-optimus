// The only place the backend talks to the extractor service. The analysis
// pipeline calls extractDocument() directly; the HTTP route is a thin wrapper.
import { HttpError } from "./httpError.js";

const EXTRACTOR_URL = process.env.EXTRACTOR_URL || "http://extractor:8001";
const TIMEOUT_MS = 60_000;
const RETRIES = 2; // only for connection failures, e.g. the extractor restarting

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {{buffer: Buffer, filename: string, mimetype?: string}} file
 * @returns {Promise<{document: object, fragments: object[], text: string, stats: object, warnings: string[]}>}
 */
export async function extractDocument({ buffer, filename, mimetype }) {
  for (let attempt = 0; ; attempt++) {
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: mimetype || "application/octet-stream" }), filename);
    let response;
    try {
      response = await fetch(`${EXTRACTOR_URL}/extract`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      if (err.name === "TimeoutError") {
        throw new HttpError(504, "extractor_timeout", "Разбор документа занял слишком много времени.");
      }
      if (attempt < RETRIES) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      throw new HttpError(503, "extractor_unavailable", "Сервис разбора документов недоступен. Повторите попытку.");
    }

    const body = await response.json().catch(() => null);
    if (response.ok && body && Array.isArray(body.fragments)) return body;
    // 4xx from the extractor describes the user's file: pass it through as is.
    if (response.status >= 400 && response.status < 500 && body?.error?.code) {
      throw new HttpError(response.status, body.error.code, body.error.message);
    }
    throw new HttpError(502, "extractor_failed", "Сервис разбора документов вернул ошибку.");
  }
}
