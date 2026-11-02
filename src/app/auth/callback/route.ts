import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

/**
 * Google OAuth callback for app sign-in.
 *  1. Exchange the code for a session.
 *  2. Bootstrap: emails in OWNER_EMAILS become Owner on their first Google sign-in.
 *  3. Claim the allowlist row. Anyone not on the allowlist is signed out → "Access not granted".
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, url.origin));

  if (!code) return redirectTo("/login?error=missing_code");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return redirectTo("/login?error=auth");

  const email = (data.user.email ?? "").toLowerCase();
  const isGoogle = data.user.app_metadata?.provider === "google";

  if (isGoogle && email && serverEnv.ownerEmails().includes(email)) {
    // Insert only if missing: never overrides a later decision by another owner.
    await createAdminClient()
      .from("team_members")
      .upsert(
        {
          email,
          role: "owner",
          name: (data.user.user_metadata?.full_name as string | undefined) ?? null,
        },
        { onConflict: "email", ignoreDuplicates: true },
      );
  }

  const { data: role } = await supabase.rpc("claim_membership");
  if (!role) {
    await supabase.auth.signOut();
    return redirectTo(`/auth/denied?email=${encodeURIComponent(email)}`);
  }

  return redirectTo(next);
}
