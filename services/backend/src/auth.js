// Session and password primitives shared by the auth routes and by any route
// that needs a signed-in user (requireAuth). Sessions are JWTs in an httpOnly
// cookie; passwords are hashed with scrypt from node:crypto (no native deps).
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";

import { getDb } from "./db.js";
import { HttpError } from "./httpError.js";

const scrypt = promisify(scryptCallback);

const SECRET = process.env.AUTH_SECRET;
if (!SECRET) {
  throw new Error("AUTH_SECRET is not set (see .env.example)");
}
if (SECRET === "dev-only-secret-change-me") {
  console.warn("AUTH_SECRET is the development default; set a real value in .env / app.env");
}

export const SESSION_COOKIE = "hackalem_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  const [algorithm, saltHex, hashHex] = String(stored ?? "").split("$");
  if (algorithm !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), KEY_LENGTH);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function signSession(user) {
  return jwt.sign({ sub: String(user._id) }, SECRET, { algorithm: "HS256", expiresIn: SESSION_TTL_SECONDS });
}

function cookieOptions(req) {
  // req.secure is true behind Caddy's HTTPS thanks to app.set("trust proxy").
  return { httpOnly: true, sameSite: "lax", secure: req.secure, path: "/" };
}

export function setSessionCookie(req, res, token) {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(req), maxAge: SESSION_TTL_SECONDS * 1000 });
}

export function clearSessionCookie(req, res) {
  res.clearCookie(SESSION_COOKIE, cookieOptions(req));
}

function readSessionCookie(req) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === SESSION_COOKIE) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

// What the API returns about a user. Never the password hash.
export function publicUser(user) {
  return { id: String(user._id), email: user.email, name: user.name, createdAt: user.createdAt };
}

// Express middleware: loads req.user from the session cookie or answers 401.
export async function requireAuth(req, _res, next) {
  const token = readSessionCookie(req);
  if (!token) return next(new HttpError(401, "unauthorized", "Требуется вход."));
  let payload;
  try {
    payload = jwt.verify(token, SECRET, { algorithms: ["HS256"] });
  } catch {
    return next(new HttpError(401, "unauthorized", "Сессия недействительна или истекла."));
  }
  if (!ObjectId.isValid(payload.sub)) {
    return next(new HttpError(401, "unauthorized", "Сессия недействительна."));
  }
  try {
    const user = await getDb().collection("users").findOne({ _id: new ObjectId(payload.sub) });
    if (!user) return next(new HttpError(401, "unauthorized", "Пользователь не найден."));
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

// Like requireAuth, but a missing or stale cookie just leaves req.user unset:
// for routes that are public yet attach the signed-in user when there is one.
export function optionalAuth(req, res, next) {
  if (!readSessionCookie(req)) return next();
  requireAuth(req, res, (err) => next(err instanceof HttpError && err.status === 401 ? undefined : err));
}
