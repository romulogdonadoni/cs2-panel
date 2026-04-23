import { cookies } from "next/headers";
import { parseSession } from "./session-crypto";

const COOKIE = "cs2pat";

export async function getSession() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return null;
  }
  const c = await cookies();
  const raw = c.get(COOKIE)?.value;
  if (!raw) {
    return null;
  }
  return parseSession(raw, secret);
}

export { COOKIE };
