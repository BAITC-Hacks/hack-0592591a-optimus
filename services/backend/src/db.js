import { MongoClient } from "mongodb";

// One client for the whole process. The database name comes from the URL path
// (mongodb://mongo:27017/hackalem -> "hackalem"). The driver pools and
// reconnects on its own; we only connect once at startup and ping on /health.
const url = process.env.MONGO_URL;
if (!url) {
  throw new Error("MONGO_URL is not set (see .env.example)");
}

const client = new MongoClient(url, {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
});

let db = null;

export async function connectDb() {
  await client.connect();
  db = client.db();
  await db.command({ ping: 1 });
  await ensureIndexes(db);
  return db;
}

export function getDb() {
  if (!db) throw new Error("Database is not connected yet");
  return db;
}

// True when Mongo answers a ping within `timeoutMs`. Never throws.
export async function pingDb(timeoutMs = 2000) {
  if (!db) return false;
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  try {
    return await Promise.race([db.command({ ping: 1 }).then((r) => r.ok === 1), timeout]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function closeDb() {
  await client.close();
  db = null;
}

// Idempotent: createIndex is a no-op when the index already exists.
async function ensureIndexes(db) {
  await db.collection("users").createIndex({ email: 1 }, { unique: true, name: "email_unique" });
}
