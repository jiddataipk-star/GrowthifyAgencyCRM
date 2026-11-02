import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * CSRF protection for "Connect" flows: a random state value is kept in an
 * httpOnly cookie and must come back unchanged from the provider.
 */
const COOKIE = "gos_oauth_state";

export async function createOAuthState(platform: string): Promise<string> {
  const state = `${platform}.${randomBytes(24).toString("base64url")}`;
  (await cookies()).set(COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/integrations",
    maxAge: 600,
  });
  return state;
}

export async function verifyOAuthState(platform: string, received: string | null): Promise<boolean> {
  const store = await cookies();
  const expected = store.get(COOKIE)?.value;
  store.delete({ name: COOKIE, path: "/api/integrations" });
  if (!expected || !received || !expected.startsWith(`${platform}.`)) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}
