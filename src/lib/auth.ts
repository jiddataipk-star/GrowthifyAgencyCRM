import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/types/db";

export type Member = {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl: string | null;
};

/**
 * The signed-in team member for this request, or null.
 * Deduplicated per request with React cache().
 */
export const getMember = cache(async (): Promise<Member | null> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const select = "id, user_id, email, name, role, avatar_url" as const;
  let { data: row } = await supabase.from("team_members").select(select).eq("user_id", userId).eq("active", true).maybeSingle();

  if (!row) {
    // First visit after an invite: link the Google identity to the allowlist row.
    const { data: role } = await supabase.rpc("claim_membership");
    if (!role) return null;
    ({ data: row } = await supabase.from("team_members").select(select).eq("user_id", userId).maybeSingle());
    if (!row) return null;
  }

  return {
    id: row.id,
    userId,
    email: row.email,
    name: row.name || row.email.split("@")[0],
    role: row.role,
    avatarUrl: row.avatar_url,
  };
});

/** Require a signed-in, allowlisted member. Redirects otherwise. */
export async function requireMember(): Promise<Member> {
  // Everything behind sign-in is per-request and time-dependent ("today" in Karachi,
  // due dates, balances), so opt out of prerendering explicitly.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  const member = await getMember();
  if (!member) redirect("/auth/denied");
  return member;
}

export const canSeeFinance = (role: Role) => role === "owner" || role === "manager";
export const isOwner = (role: Role) => role === "owner";

/** Owner or manager (finance, clients, leads, settings). Staff are sent to Projects. */
export async function requireFinance(): Promise<Member> {
  const member = await requireMember();
  if (!canSeeFinance(member.role)) redirect("/projects");
  return member;
}

export async function requireOwner(): Promise<Member> {
  const member = await requireMember();
  if (!isOwner(member.role)) redirect("/");
  return member;
}
