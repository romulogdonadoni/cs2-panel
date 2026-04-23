import { createHmac, timingSafeEqual } from "node:crypto";

function b64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, "utf8");
  return b
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer | null {
  const pad = 4 - (s.length % 4);
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + (pad < 4 ? "=".repeat(pad) : "");
  try {
    return Buffer.from(b64, "base64");
  } catch {
    return null;
  }
}

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type SessionPayload = { steamid64: string; exp: number };

export function signSession(payload: SessionPayload, secret: string): string {
  const p = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", secret).update(p).digest());
  return `${p}.${sig}`;
}

export function parseSession(token: string, secret: string): SessionPayload | null {
  const i = token.lastIndexOf(".");
  if (i === -1) {
    return null;
  }
  const p = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = b64url(createHmac("sha256", secret).update(p).digest());
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }
  const raw = b64urlDecode(p);
  if (!raw) {
    return null;
  }
  try {
    const obj = JSON.parse(raw.toString("utf8")) as SessionPayload;
    if (typeof obj.steamid64 !== "string" || typeof obj.exp !== "number") {
      return null;
    }
    if (Date.now() > obj.exp) {
      return null;
    }
    return obj;
  } catch {
    return null;
  }
}

export function newSession(steamid64: string, secret: string): string {
  return signSession({ steamid64, exp: Date.now() + MAX_AGE_MS }, secret);
}
