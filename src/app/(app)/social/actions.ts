"use server";

import { z } from "zod";
import { action, must } from "@/lib/action";
import { manualMetricSchema, metaTokenSchema } from "@/lib/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { storeConnection, syncAccount, syncAll } from "@/lib/social/sync";
import { listMetaPages, pickPage, META_SCOPES } from "@/lib/social/meta";
import { ApiError, ReconnectError } from "@/lib/social/http";

/** "Sync now" — same job as the daily cron, for one account or all. */
export const syncNowAction = action("finance", z.object({ id: z.guid().optional() }), async ({ id }) => {
  const admin = createAdminClient();
  const outcomes = id ? [await syncAccount(admin, id)] : await syncAll(admin);
  const failed = outcomes.filter((o) => !o.ok);
  if (outcomes.length === 0) return { ok: false, error: "No connected accounts to sync yet." } as const;
  if (failed.length === outcomes.length) return { ok: false, error: failed.map((f) => `${f.platform}: ${f.message}`).join(" · ") } as const;
  return { synced: outcomes.length - failed.length, failed: failed.length };
});

/**
 * Option A (recommended): paste a Meta Business system-user token. We validate it,
 * find the Growthify Page and its Instagram account, and store the Page token encrypted.
 */
export const connectMetaTokenAction = action("finance", metaTokenSchema, async ({ token }, { member }) => {
  const admin = createAdminClient();
  let pages;
  try {
    pages = await listMetaPages(token);
  } catch (error) {
    const message = error instanceof ReconnectError || error instanceof ApiError ? error.message : "Couldn't reach Meta";
    return { ok: false, error: `Meta rejected the token: ${message}` } as const;
  }
  const { data: seeded } = await admin.from("social_accounts").select("handle").eq("platform", "facebook").limit(1).maybeSingle();
  const page = pickPage(pages, seeded?.handle ?? null);
  if (!page) return { ok: false, error: "The token works, but no Page is assigned to this system user. Assign the Growthify Page in Business Settings." } as const;

  const fbId = await storeConnection(admin, {
    platform: "facebook", connection: "system_user", externalId: page.id, name: page.name, handle: page.username ?? null,
    avatarUrl: page.picture?.data?.url ?? null, profileUrl: page.link ?? null, access: page.access_token, scopes: META_SCOPES,
    meta: { page_id: page.id }, userId: member.userId,
  });
  if (fbId) await syncAccount(admin, fbId);
  const ig = page.instagram_business_account;
  if (ig) {
    const igId = await storeConnection(admin, {
      platform: "instagram", connection: "system_user", externalId: ig.id, name: ig.name ?? ig.username ?? null, handle: ig.username ?? null,
      avatarUrl: ig.profile_picture_url ?? null, profileUrl: ig.username ? `https://www.instagram.com/${ig.username}` : null,
      access: page.access_token, scopes: META_SCOPES, meta: { page_id: page.id }, userId: member.userId,
    });
    if (igId) await syncAccount(admin, igId);
  }
  return { page: page.name, instagram: ig?.username ?? null, pagesSeen: pages.map((p) => p.name) };
});

/** Remove stored tokens; history stays. */
export const disconnectAction = action("finance", z.object({ id: z.guid() }), async ({ id }) => {
  const admin = createAdminClient();
  must(
    await admin
      .from("social_accounts")
      .update({ token_encrypted: null, refresh_token_encrypted: null, token_expires_at: null, status: "not_connected", last_error: null })
      .eq("id", id),
  );
});

/** LinkedIn / TikTok (v1): add today's follower count by hand; stored as a daily snapshot. */
export const addManualMetricAction = action("finance", manualMetricSchema, async (input, { supabase }) => {
  must(
    await supabase.from("social_metrics_daily").upsert(
      { social_account_id: input.social_account_id, date: input.date, followers: input.followers, views: input.views ?? null, extra: { manual: true } },
      { onConflict: "social_account_id,date" },
    ),
  );
  must(await supabase.from("social_accounts").update({ status: "connected" }).eq("id", input.social_account_id));
});

export const addManualAccountAction = action(
  "finance",
  z.object({
    platform: z.enum(["linkedin", "tiktok"]),
    name: z.string().trim().min(1, "Name is required").max(120),
    handle: z.string().trim().max(120).optional(),
    profile_url: z.url("Enter a full link").optional().or(z.literal("")),
  }),
  async (input, { supabase }) => {
    must(
      await supabase.from("social_accounts").insert({
        platform: input.platform,
        connection: "manual",
        name: input.name,
        handle: input.handle || null,
        profile_url: input.profile_url || null,
        status: "not_connected",
      }),
    );
  },
);
