/**
 * Test-only helper: creates (or reuses) a local Supabase user that looks like a
 * Google sign-in, adds it to team_members with a role, signs in with a password and
 * returns the @supabase/ssr auth cookies for a browser context.
 * Works only with the service-role key of a LOCAL Supabase stack — never production.
 */
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function sessionCookies({ email, role = "owner", name = "Test User", password = "Test-password-123!" }) {
  if (!URL.includes("127.0.0.1") && !URL.includes("localhost")) throw new Error("Refusing to run against a non-local Supabase");
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let user = list.users.find((u) => u.email === email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { provider: "google", providers: ["google"] },
      user_metadata: { full_name: name },
    });
    if (error) throw error;
    user = data.user;
  }
  await admin.from("team_members").upsert({ email, role, name, active: true }, { onConflict: "email" });

  const jar = [];
  const supabase = createServerClient(URL, ANON, {
    cookies: { getAll: () => jar, setAll: (cookies) => jar.splice(0, jar.length, ...cookies) },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return jar.map(({ name: cookieName, value }) => ({ name: cookieName, value, domain: "localhost", path: "/", sameSite: "Lax" }));
}
