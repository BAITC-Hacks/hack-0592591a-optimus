// The only place the UI talks to the backend (docs/TASK.md §7).
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(url, options = {}) {
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error("Сервер недоступен. Проверьте подключение и повторите попытку.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Сервер ответил ошибкой ${res.status}.`);
    err.code = data?.error?.code || "http_error";
    err.status = res.status;
    throw err;
  }
  return data;
}

/** @param {{before: File[], after: File[]}} files */
export function startAnalysis(files) {
  const body = new FormData();
  for (const file of files.before) body.append("before", file, file.name);
  for (const file of files.after) body.append("after", file, file.name);
  return request("/api/analyses", { method: "POST", body });
}

export const startDemo = () => request("/api/analyses/demo", { method: "POST" });

export const getAnalysis = (id) => request(`/api/analyses/${encodeURIComponent(id)}`);

/** Polls every 2 s until the analysis is done or failed; `onUpdate` gets every snapshot. */
export async function pollAnalysis(id, onUpdate, { intervalMs = 2000, signal } = {}) {
  for (;;) {
    const doc = await getAnalysis(id);
    onUpdate(doc);
    if (doc.status === "done" || doc.status === "failed" || signal?.aborted) return doc;
    await sleep(intervalMs);
  }
}
