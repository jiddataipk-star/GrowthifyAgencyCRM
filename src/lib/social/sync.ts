import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { ReconnectError } from "./http";
import { youtubeAdapter } from "./youtube";
import { facebookAdapter, instagramAdapter } from "./meta";
import { threadsAdapter } from "./threads";
import type { Platform, SocialAdapter, SyncResult } from "./types";

type Admin = SupabaseClient<Database>;

/** Platforms with an automatic API adapter. LinkedIn / TikTok use manual entries. */
export const ADAPTERS: Partial<Record<Platform, SocialAdapter>> = {
  youtube: youtubeAdapter,
  facebook: facebookAdapter,
  instagram: instagramAdapter,
  threads: threadsAdapter,
};

const ACCOUNT_COLUMNS =
  "id, platform, connection, external_id, handle, meta, status, token_encrypted, refresh_token_encrypted, token_expires_at, last_synced_at" as const;

export type SyncOutcome = { id: string; platform: Platform; ok: boolean; message: string };

/** Sync one account with the service-role client. Never throws: failures are recorded on the account. */
export async function syncAccount(admin: Admin, accountId: string): Promise<SyncOutcome> {
  const { data: account } = await admin.from("social_accounts").select(ACCOUNT_COLUMNS).eq("id", accountId).single();
  if (!account) return { id: accountId, platform: "facebook", ok: false, message: "Account not found" };
  const adapter = ADAPTERS[account.platform];
  if (!adapter || account.connection === "manual") {
    return { id: account.id, platform: account.platform, ok: false, message: "Manual platform — add follower counts by hand." };
  }
  if (!account.token_encrypted) {
    return { id: account.id, platform: account.platform, ok: false, message: "Not connected" };
  }

  let result: SyncResult;
  try {
    result = await adapter.sync({
      externalId: account.external_id,
      meta: (account.meta ?? {}) as Record<string, unknown>,
      tokens: {
        access: decryptSecret(account.token_encrypted),
        refresh: account.refresh_token_encrypted ? decryptSecret(account.refresh_token_encrypted) : null,
        expiresAt: account.token_expires_at,
      },
      backfill: !account.last_synced_at,
    });
  } catch (error) {
    const reconnect = error instanceof ReconnectError;
    const message = error instanceof Error ? error.message : "Sync failed";
    await admin
      .from("social_accounts")
      .update({ status: reconnect ? "needs_reconnect" : account.status, last_error: message.slice(0, 500) })
      .eq("id", account.id);
    return { id: account.id, platform: account.platform, ok: false, message };
  }

  await saveResult(admin, account.id, result);
  return {
    id: account.id,
    platform: account.platform,
    ok: true,
    message: result.warnings.length ? `Synced with ${result.warnings.length} skipped metric(s)` : "Synced",
  };
}

async function saveResult(admin: Admin, accountId: string, result: SyncResult) {
  // Merge with existing rows so a partial day never wipes earlier values.
  const dates = result.daily.map((d) => d.date);
  const { data: existing } = dates.length
    ? await admin.from("social_metrics_daily").select("date, followers, reach, views, engagement, extra").eq("social_account_id", accountId).in("date", dates)
    : { data: [] };
  const previous = new Map((existing ?? []).map((row) => [row.date, row]));
  const rows = result.daily.map((d) => {
    const old = previous.get(d.date);
    const { demo: _demo, ...oldExtra } = (old?.extra ?? {}) as Record<string, unknown>;
    void _demo;
    return {
      social_account_id: accountId,
      date: d.date,
      followers: d.followers ?? old?.followers ?? null,
      reach: d.reach ?? old?.reach ?? null,
      views: d.views ?? old?.views ?? null,
      engagement: d.engagement ?? old?.engagement ?? null,
      extra: { ...oldExtra, ...(d.extra ?? {}) } as NonNullable<Json>,
    };
  });
  if (rows.length) await admin.from("social_metrics_daily").upsert(rows, { onConflict: "social_account_id,date" });

  if (result.posts.length) {
    await admin.from("social_posts").upsert(
      result.posts.map((p) => ({ ...p, social_account_id: accountId })),
      { onConflict: "social_account_id,external_id" },
    );
  }

  await admin
    .from("social_accounts")
    .update({
      external_id: result.profile.external_id,
      name: result.profile.name,
      handle: result.profile.handle,
      avatar_url: result.profile.avatar_url,
      profile_url: result.profile.profile_url,
      status: "connected",
      last_synced_at: new Date().toISOString(),
      last_error: result.warnings.length ? result.warnings.join(" · ").slice(0, 500) : null,
      ...(result.tokens
        ? {
            token_encrypted: encryptSecret(result.tokens.access),
            ...(result.tokens.refresh ? { refresh_token_encrypted: encryptSecret(result.tokens.refresh) } : {}),
            token_expires_at: result.tokens.expiresAt ?? null,
          }
        : {}),
    })
    .eq("id", accountId);
}

/** Daily cron: sync every connected account. */
export async function syncAll(admin: Admin): Promise<SyncOutcome[]> {
  const { data } = await admin.from("social_accounts").select("id").neq("connection", "manual").not("token_encrypted", "is", null);
  const outcomes: SyncOutcome[] = [];
  for (const account of data ?? []) outcomes.push(await syncAccount(admin, account.id));
  return outcomes;
}

/**
 * Store a fresh connection on the platform's account row (seeded as "not connected"),
 * creating the row if needed. Tokens are encrypted before they touch the database.
 */
export async function storeConnection(
  admin: Admin,
  input: {
    platform: Platform;
    connection: "oauth" | "system_user";
    externalId: string;
    name?: string | null;
    handle?: string | null;
    avatarUrl?: string | null;
    profileUrl?: string | null;
    access: string;
    refresh?: string | null;
    expiresAt?: string | null;
    scopes?: string[];
    meta?: Record<string, unknown>;
    userId: string;
  },
) {
  const { data: rows } = await admin.from("social_accounts").select("id, external_id").eq("platform", input.platform).order("created_at");
  const target = rows?.find((r) => r.external_id === input.externalId) ?? rows?.find((r) => !r.external_id) ?? rows?.[0];
  const values = {
    platform: input.platform,
    connection: input.connection,
    external_id: input.externalId,
    name: input.name ?? null,
    handle: input.handle ?? null,
    avatar_url: input.avatarUrl ?? null,
    profile_url: input.profileUrl ?? null,
    token_encrypted: encryptSecret(input.access),
    refresh_token_encrypted: input.refresh ? encryptSecret(input.refresh) : null,
    token_expires_at: input.expiresAt ?? null,
    scopes: input.scopes ?? [],
    meta: (input.meta ?? {}) as NonNullable<Json>,
    status: "connected" as const,
    last_error: null,
    connected_by: input.userId,
    last_synced_at: null,
  };
  if (target) {
    await admin.from("social_accounts").update(values).eq("id", target.id);
    return target.id;
  }
  const { data } = await admin.from("social_accounts").insert(values).select("id").single();
  return data?.id ?? null;
}
