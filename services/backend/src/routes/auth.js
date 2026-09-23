import { Router } from "express";
import { z } from "zod";

import {
  clearSessionCookie,
  hashPassword,
  publicUser,
  requireAuth,
  setSessionCookie,
  signSession,
  verifyPassword,
} from "../auth.js";
import { getDb } from "../db.js";
import { HttpError } from "../httpError.js";

// User document: { _id, email (lowercase, unique), name, passwordHash, createdAt }.
const emailField = z.email("Некорректный email.").trim().toLowerCase().max(254, "Email слишком длинный.");
const signupSchema = z.strictObject({
  name: z.string().trim().min(1, "Укажите имя.").max(100, "Имя слишком длинное."),
  email: emailField,
  password: z.string().min(8, "Пароль не короче 8 символов.").max(128, "Пароль слишком длинный."),
});
const loginSchema = z.strictObject({
  email: emailField,
  password: z.string().min(1, "Укажите пароль.").max(128, "Пароль слишком длинный."),
});

// Only whitelisted, typed fields reach the database (no request JSON in filters).
function parse(schema, body) {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue.path.join(".");
    throw new HttpError(422, "validation_error", field ? `${field}: ${issue.message}` : issue.message);
  }
  return result.data;
}

const users = () => getDb().collection("users");

export const auth = Router();

// POST /api/auth/signup {name, email, password} -> 201 {user} + session cookie
auth.post("/signup", async (req, res, next) => {
  try {
    const { name, email, password } = parse(signupSchema, req.body);
    if (await users().findOne({ email }, { projection: { _id: 1 } })) {
      throw new HttpError(409, "email_taken", "Пользователь с таким email уже зарегистрирован.");
    }
    const user = { email, name, passwordHash: await hashPassword(password), createdAt: new Date() };
    try {
      const { insertedId } = await users().insertOne(user);
      user._id = insertedId;
    } catch (err) {
      if (err.code === 11000) {
        throw new HttpError(409, "email_taken", "Пользователь с таким email уже зарегистрирован.");
      }
      throw err;
    }
    setSessionCookie(req, res, signSession(user));
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login {email, password} -> 200 {user} + session cookie
auth.post("/login", async (req, res, next) => {
  try {
    const { email, password } = parse(loginSchema, req.body);
    const user = await users().findOne({ email });
    const ok = user ? await verifyPassword(password, user.passwordHash) : false;
    if (!ok) throw new HttpError(401, "invalid_credentials", "Неверный email или пароль.");
    setSessionCookie(req, res, signSession(user));
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout -> 204, cookie cleared
auth.post("/logout", (req, res) => {
  clearSessionCookie(req, res);
  res.status(204).end();
});

// GET /api/auth/me -> 200 {user} or 401
auth.get("/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});
