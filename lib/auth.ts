import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import type { JWTPayload } from "@/types";

const JWT_SECRET = process.env.JWT_SECRET!;
const COOKIE_NAME = "shipstream_token";
// 7-day expiry — long enough to avoid constant re-auth, short enough to limit
// the blast radius if a token leaks
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not set");
}

// ─── Password ─────────────────────────────────────────────────────────────────

// saltRounds=12 is the current bcrypt recommendation — high enough to be slow
// for attackers, fast enough to not frustrate users (~300ms on modern hardware)
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(
  plain: string,
  hashed: string
): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

// ─── JWT ──────────────────────────────────────────────────────────────────────

export function signToken(payload: Omit<JWTPayload, "iat" | "exp">): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL_SECONDS });
}

export function verifyToken(token: string): JWTPayload {
  // Throws JsonWebTokenError or TokenExpiredError on invalid/expired tokens
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

// ─── Cookie helpers (Server Components / Route Handlers) ──────────────────────

export function setAuthCookie(token: string): void {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,    // JS cannot read — blocks XSS token theft
    secure: process.env.NODE_ENV === "production", // HTTPS only in prod
    sameSite: "lax",   // Protects against CSRF while allowing top-level nav
    maxAge: TOKEN_TTL_SECONDS,
    path: "/",
  });
}

export function clearAuthCookie(): void {
  cookies().delete(COOKIE_NAME);
}

export function getTokenFromCookie(): string | undefined {
  return cookies().get(COOKIE_NAME)?.value;
}

// ─── Session retrieval ────────────────────────────────────────────────────────

export function getSession(): JWTPayload | null {
  const token = getTokenFromCookie();
  if (!token) return null;
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}
