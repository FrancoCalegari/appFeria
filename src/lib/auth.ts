import crypto from "node:crypto";
import { cookies } from "next/headers";

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: "ADMIN" | "VENDOR";
}

const COOKIE_NAME = "feria_session";
const SECRET = process.env.AUTH_SECRET || "feria-de-las-heras-secret-key-2026";

export function hashPassword(password: string): string {
  return crypto.createHmac("sha256", SECRET).update(password).digest("hex");
}

function signPayload(payloadB64: string): string {
  return crypto.createHmac("sha256", SECRET).update(payloadB64).digest("base64url");
}

export function encodeSession(user: SessionUser): string {
  const payloadB64 = Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
  const sig = signPayload(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function decodeSession(token: string | undefined): SessionUser | null {
  if (!token || !token.includes(".")) return null;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;
  const expectedSig = signPayload(payloadB64);
  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as SessionUser;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return decodeSession(token);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;

