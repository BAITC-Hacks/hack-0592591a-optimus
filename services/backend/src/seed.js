// Demo data that ships with the repo (AGENTS.md §6): a synthetic account the
// jury can sign in with. Idempotent: created once, never overwritten, so a
// changed password in the UI survives restarts. Empty DEMO_USER_PASSWORD
// disables it.
import { hashPassword } from "./auth.js";
import { getDb } from "./db.js";
import { loadRegulatoryNorms } from "./regulatoryNorms.js";

// O1 norms from data/regulatory (AGENTS.md §7a). Optional: a failure is logged
// and the backend still starts; the analysis then reports regulatory "no_norms".
export async function ensureRegulatoryNorms() {
  try {
    const { pieces, acts } = await loadRegulatoryNorms();
    console.log(pieces ? `regulatory norms: ${pieces} pieces from ${acts} acts` : "regulatory norms: none shipped");
  } catch (err) {
    console.warn(`regulatory norms not loaded: ${err.message}`);
  }
}

const email = (process.env.DEMO_USER_EMAIL || "").trim().toLowerCase();
const password = process.env.DEMO_USER_PASSWORD || "";
const name = (process.env.DEMO_USER_NAME || "Демо").trim();

export async function ensureDemoUser() {
  if (!email || !password) {
    console.log("demo account disabled (DEMO_USER_EMAIL / DEMO_USER_PASSWORD empty)");
    return;
  }
  if (password.length < 8) {
    console.warn("demo account skipped: DEMO_USER_PASSWORD must be at least 8 characters");
    return;
  }
  const users = getDb().collection("users");
  if (await users.findOne({ email }, { projection: { _id: 1 } })) {
    console.log(`demo account ${email} already exists`);
    return;
  }
  try {
    await users.insertOne({ email, name, passwordHash: await hashPassword(password), createdAt: new Date() });
    console.log(`demo account ${email} created`);
  } catch (err) {
    if (err.code !== 11000) throw err; // created concurrently by another instance
  }
}
