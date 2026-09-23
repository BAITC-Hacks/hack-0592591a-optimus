import express from "express";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.get(["/health", "/api/health"], (_req, res) => {
  res.json({ status: "ok" });
});

app.use((_req, res) => {
  res.status(404).json({ error: { code: "not_found", message: "Route not found" } });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status && err.status < 500 ? err.status : 500;
  res.status(status).json({
    error: { code: status === 500 ? "internal_error" : "bad_request", message: status === 500 ? "Internal error" : err.message },
  });
});

const port = Number(process.env.PORT) || 8000;
app.listen(port, () => console.log(`backend listening on :${port}`));
