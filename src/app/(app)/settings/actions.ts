"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { action, must } from "@/lib/action";
import { serverEnv } from "@/lib/env";
import { companySchema, inviteSchema, paymentDetailsSchema, preferencesSchema, profileSchema, serviceSchema } from "@/lib/validation";
import { toMinor } from "@/lib/money";
import { emptyToNull } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

const nullable = <T extends Record<string, unknown>>(values: T) =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [k, emptyToNull(v)])) as { [K in keyof T]: T[K] | null };

export const saveCompanyAction = action("finance", companySchema, async (input, { supabase }) => {
  const { company_name, country, ...rest } = input;
  must(await supabase.from("settings").update({ company_name, country, ...nullable(rest) }).eq("singleton", true));
});

/** Bank / wallet details clients pay into — owner only (also enforced by a DB trigger). */
export const savePaymentDetailsAction = action("owner", paymentDetailsSchema, async (input, { supabase }) => {
  must(await supabase.from("settings").update(nullable(input)).eq("singleton", true));
});

export const savePreferencesAction = action("finance", preferencesSchema, async (input, { supabase }) => {
  must(await supabase.from("settings").update(input).eq("singleton", true));
});

/** Anyone can edit their own name and photo. */
export const saveProfileAction = action("member", profileSchema, async (input, { supabase, member }) => {
  must(await supabase.from("team_members").update({ name: input.name, avatar_url: emptyToNull(input.avatar_url ?? "") }).eq("id", member.id));
});

/* ── Team & roles (owner) ─────────────────────────────────────────────── */
export const inviteMemberAction = action("owner", inviteSchema, async (input, { supabase }) => {
  must(await supabase.from("team_members").insert({ email: input.email, name: emptyToNull(input.name ?? ""), role: input.role }));
});

export const updateMemberAction = action(
  "owner",
  z.object({ id: z.guid(), role: z.enum(["owner", "manager", "staff"]), active: z.boolean() }),
  async ({ id, ...values }, { supabase }) => {
    must(await supabase.from("team_members").update(values).eq("id", id));
  },
);

export const removeMemberAction = action("owner", z.object({ id: z.guid() }), async ({ id }, { supabase, member }) => {
  if (id === member.id) return { ok: false, error: "You can't remove yourself. Ask another owner." } as const;
  must(await supabase.from("team_members").delete().eq("id", id));
});

/* ── Security ─────────────────────────────────────────────────────────── */
export const revokeSessionAction = action("member", z.object({ id: z.guid() }), async ({ id }, { supabase }) => {
  must(await supabase.rpc("revoke_my_session", { p_session_id: id }));
});

export async function signOutEverywhereAction() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}

/* ── Services catalog ─────────────────────────────────────────────────── */
export const saveServiceAction = action("finance", serviceSchema.extend({ id: z.guid().optional() }), async ({ id, ...input }, { supabase }) => {
  const row = {
    ...input,
    description: emptyToNull(input.description ?? ""),
    default_price: input.default_price !== undefined && input.default_price !== 0 ? toMinor(input.default_price) : null,
  };
  if (id) must(await supabase.from("services").update(row).eq("id", id));
  else must(await supabase.from("services").insert(row));
});

export const deleteServiceAction = action("owner", z.object({ id: z.guid() }), async ({ id }, { supabase }) => {
  must(await supabase.from("services").delete().eq("id", id));
});

/* ── Demo data (only when ALLOW_DEMO_DATA=true) ───────────────────────── */
export const loadDemoDataAction = action("owner", z.object({}), async (_input, { supabase }) => {
  if (!serverEnv.demoDataAllowed()) return { ok: false, error: "Demo data is disabled on this deployment." } as const;
  const count = must(await supabase.rpc("load_demo_data"));
  return { count: count as number };
});

export const clearDemoDataAction = action("owner", z.object({}), async (_input, { supabase }) => {
  const count = must(await supabase.rpc("clear_demo_data"));
  return { count: count as number };
});
