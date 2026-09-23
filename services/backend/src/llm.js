// The only module that talks to the LLM provider (AGENTS.md §7): timeout,
// bounded retries with backoff, JSON mode, zod validation with one re-ask, a
// concurrency limit, and a typed error the API maps to 503 llm_unavailable.
//
// Pipeline modules receive an `llm` object ({ completeJson, embed, stats }) so
// tests can pass a stub and never need a key.
import OpenAI from "openai";

import { HttpError } from "./httpError.js";
import { prompt } from "./prompts.js";

const PROVIDER = (process.env.LLM_PROVIDER || "openai").toLowerCase();
const MODEL = process.env.LLM_MODEL || "";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "";
const API_KEY = PROVIDER === "nvidia" ? process.env.NVIDIA_API_KEY || "" : process.env.OPENAI_API_KEY || "";
const BASE_URL = process.env.LLM_BASE_URL || (PROVIDER === "nvidia" ? "https://integrate.api.nvidia.com/v1" : "");

const TIMEOUT_MS = 90_000;
const RETRIES = 2; // network failures, 429 and 5xx only
const CONCURRENCY = 6;
const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);
const EMBED_BATCH = 100;

export class LlmUnavailableError extends HttpError {
  constructor(message) {
    super(503, "llm_unavailable", message);
  }
}

export function llmConfigured() {
  return Boolean(API_KEY && MODEL);
}

export function assertLlmConfigured() {
  if (!llmConfigured()) {
    throw new LlmUnavailableError("Модель не настроена: задайте OPENAI_API_KEY и LLM_MODEL в .env (см. README, «Доступ для жюри»).");
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Minimal semaphore: at most `n` provider calls in flight per llm instance.
function createLimiter(n) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= n || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve, reject).finally(() => {
      active--;
      next();
    });
  };
  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
}

function isRetryable(err) {
  if (err instanceof OpenAI.APIConnectionError) return true;
  return RETRYABLE_STATUS.has(err?.status);
}

function toClientError(err) {
  if (err instanceof HttpError) return err;
  if (err?.status === 401 || err?.status === 403) return new LlmUnavailableError("Провайдер LLM отклонил ключ (401/403). Проверьте OPENAI_API_KEY.");
  if (err?.status === 404) return new LlmUnavailableError(`Модель «${MODEL}» не найдена у провайдера. Проверьте LLM_MODEL.`);
  if (err instanceof OpenAI.APIConnectionError || err?.status === 429 || (err?.status >= 500 && err?.status < 600)) {
    return new LlmUnavailableError("Сервис LLM недоступен или перегружен. Повторите попытку позже.");
  }
  return err;
}

function parseJson(raw) {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    // Some providers wrap JSON in a code fence even in JSON mode.
    const match = String(raw).match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return { ok: true, value: JSON.parse(match[0]) };
      } catch {
        /* fall through */
      }
    }
    return { ok: false };
  }
}

function formatIssues(error) {
  return error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join(".") || "$"}: ${issue.message}`)
    .join("; ");
}

/**
 * @returns {{ completeJson: Function, embed: Function, stats: object, model: string }}
 */
export function createLlm() {
  assertLlmConfigured();
  const client = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL || undefined, timeout: TIMEOUT_MS, maxRetries: 0 });
  const limit = createLimiter(CONCURRENCY);
  const stats = {
    model: MODEL,
    calls: 0,
    retries: 0,
    reasks: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    embedding_calls: 0,
    embeddings: EMBEDDING_MODEL ? "ok" : "unavailable",
  };
  const system = prompt("system");

  async function chat(name, messages, maxTokens) {
    const started = Date.now();
    const response = await client.chat.completions.create({
      model: MODEL,
      messages,
      response_format: { type: "json_object" },
      max_completion_tokens: maxTokens,
    });
    stats.calls++;
    stats.prompt_tokens += response.usage?.prompt_tokens ?? 0;
    stats.completion_tokens += response.usage?.completion_tokens ?? 0;
    const choice = response.choices?.[0];
    console.log(`[llm] ${name}: ${Date.now() - started} ms, in=${response.usage?.prompt_tokens ?? "?"} out=${response.usage?.completion_tokens ?? "?"}`);
    if (choice?.finish_reason === "length") {
      throw new HttpError(502, "llm_truncated", `Ответ модели на шаге «${name}» обрезан по длине.`);
    }
    return choice?.message?.content ?? "";
  }

  /**
   * One JSON answer validated against a zod schema. On a validation failure the
   * model is asked once to fix its answer; network/5xx errors are retried.
   */
  async function completeJson({ name = "llm", prompt: userPrompt, schema, maxTokens = 12_000 }) {
    const messages = [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ];
    for (let attempt = 0; ; attempt++) {
      try {
        const raw = await limit(() => chat(name, messages, maxTokens));
        const parsed = parseJson(raw);
        const checked = parsed.ok ? schema.safeParse(parsed.value) : null;
        if (checked?.success) return checked.data;
        stats.reasks++;
        const issue = parsed.ok ? formatIssues(checked.error) : "ответ не является валидным JSON";
        const retryMessages = [
          ...messages,
          { role: "assistant", content: raw },
          { role: "user", content: `Ответ не прошёл проверку схемы: ${issue}. Верни только исправленный JSON по той же схеме, без пояснений.` },
        ];
        const raw2 = await limit(() => chat(`${name}:fix`, retryMessages, maxTokens));
        const parsed2 = parseJson(raw2);
        const checked2 = parsed2.ok ? schema.safeParse(parsed2.value) : null;
        if (checked2?.success) return checked2.data;
        throw new HttpError(502, "llm_bad_response", `Модель вернула невалидный ответ на шаге «${name}».`);
      } catch (err) {
        if (isRetryable(err) && attempt < RETRIES) {
          stats.retries++;
          console.warn(`[llm] ${name}: ${err.status ?? err.name}, retry ${attempt + 1}/${RETRIES}`);
          await sleep(1000 * 2 ** attempt);
          continue;
        }
        throw toClientError(err);
      }
    }
  }

  /** Float vectors for `texts`, or null when embeddings are not configured or fail. */
  async function embed(texts) {
    if (!EMBEDDING_MODEL || texts.length === 0) {
      stats.embeddings = "unavailable";
      return null;
    }
    const vectors = new Array(texts.length);
    try {
      const batches = [];
      for (let i = 0; i < texts.length; i += EMBED_BATCH) batches.push([i, texts.slice(i, i + EMBED_BATCH)]);
      await Promise.all(
        batches.map(([offset, batch]) =>
          limit(async () => {
            const response = await client.embeddings.create({ model: EMBEDDING_MODEL, input: batch });
            stats.embedding_calls++;
            for (const item of response.data) vectors[offset + item.index] = item.embedding;
          }),
        ),
      );
      stats.embeddings = "ok";
      return vectors;
    } catch (err) {
      console.warn(`[llm] embeddings unavailable (${err.status ?? err.message}); lexical candidates only`);
      stats.embeddings = "unavailable";
      return null;
    }
  }

  return { completeJson, embed, stats, model: MODEL };
}
