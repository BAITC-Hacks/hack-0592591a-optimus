import express from "express";
import { connectDb, pingDb, closeDb } from "./db.js";
import { ensureDemoUser } from "./seed.js";

import { HttpError } from "./httpError.js";
import { llmConfigured } from "./llm.js";
import { analyses } from "./routes/analyses.js";
import { auth } from "./routes/auth.js";
import { documents } from "./routes/documents.js";

const app = express();
app.disable("x-powered-by");
// Only Caddy reaches this port; trust its X-Forwarded-Proto so cookies get
// the Secure flag behind HTTPS.
app.set("trust proxy", true);
app.use(express.json({ limit: "1mb" }));

// Used by the compose healthcheck and the frontend start page. Reports 503
// while Mongo is unreachable so the container is not considered healthy.
app.get(["/health", "/api/health"], async (_req, res) => {
  const dbOk = await pingDb();
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? "ok" : "degraded",
    db: dbOk ? "ok" : "unavailable",
    llm: llmConfigured() ? "configured" : "missing",
  });
});

app.use("/api/auth", auth);
app.use("/api/documents", documents);
app.use("/api/analyses", analyses);

app.use((_req, res) => {
  res.status(404).json({ error: { code: "not_found", message: "Route not found" } });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  const status = err.status && err.status < 500 ? err.status : 500;
  if (status === 500) console.error(err);
  res.status(status).json({
    error: { code: status === 500 ? "internal_error" : "bad_request", message: status === 500 ? "Internal error" : err.message },
  });
});

const port = Number(process.env.PORT) || 8000;

// Mongo is started first by compose (depends_on: service_healthy). If the
// connection still fails, exit non-zero and let the restart policy retry.
try {
  const db = await connectDb();
  console.log(`connected to MongoDB, database "${db.databaseName}"`);
  await ensureDemoUser();
} catch (err) {
  console.error(`startup failed: ${err.message}`);
  process.exit(1);
}

const server = app.listen(port, () => console.log(`backend listening on :${port}`));

async function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await closeDb().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
