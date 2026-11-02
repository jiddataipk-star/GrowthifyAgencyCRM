import "server-only";
import { serverEnv } from "@/lib/env";
import { addDays, todayPK } from "@/lib/dates";
import { getJson, optional, postForm } from "./http";
import type { DailyMetric, PostMetric, SocialAdapter, Tokens } from "./types";

/** Threads API (graph.threads.net). Scopes: threads_basic + threads_manage_insights. */
export const THREADS_SCOPES = ["threads_basic", "threads_manage_insights"];
const API = "https://graph.threads.net/v1.0";

export function threadsAuthUrl(state: string) {
  const { appId, redirectUri } = serverEnv.threads();
  if (!appId) throw new Error("THREADS_APP_ID is not set");
  const params = new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, scope: THREADS_SCOPES.join(","), response_type: "code", state });
  return `https://threads.net/oauth/authorize?${params}`;
}

/** Code → short-lived token → long-lived token (~60 days, refreshable). */
export async function exchangeThreadsCode(code: string): Promise<Tokens & { userId: string }> {
  const { appId, appSecret, redirectUri } = serverEnv.threads();
  const short = await postForm<{ access_token: string; user_id: string | number }>("https://graph.threads.net/oauth/access_token", {
    client_id: appId ?? "",
    client_secret: appSecret ?? "",
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });
  const long = await getJson<{ access_token: string; expires_in: number }>(
    `https://graph.threads.net/access_token?${new URLSearchParams({ grant_type: "th_exchange_token", client_secret: appSecret ?? "", access_token: short.access_token })}`,
  );
  return { access: long.access_token, expiresAt: new Date(Date.now() + long.expires_in * 1000).toISOString(), userId: String(short.user_id) };
}

async function refreshIfNeeded(tokens: Tokens): Promise<Tokens | null> {
  // Long-lived tokens can be refreshed once they are 24 h old and still valid; refresh when < 10 days remain.
  if (!tokens.expiresAt || new Date(tokens.expiresAt).getTime() - Date.now() > 10 * 86_400_000) return null;
  const data = await getJson<{ access_token: string; expires_in: number }>(
    `https://graph.threads.net/refresh_access_token?${new URLSearchParams({ grant_type: "th_refresh_token", access_token: tokens.access })}`,
  );
  return { access: data.access_token, expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString() };
}

type Insight = { name: string; values?: { value: number; end_time?: string }[]; total_value?: { value: number } };

export const threadsAdapter: SocialAdapter = {
  platform: "threads",
  async sync({ tokens: stored, backfill }) {
    const warnings: string[] = [];
    const refreshed = await optional(() => refreshIfNeeded(stored), warnings, "token refresh");
    const token = (refreshed ?? stored).access;
    const today = todayPK();

    const me = await getJson<{ id: string; username: string; name?: string; threads_profile_picture_url?: string }>(
      `${API}/me?${new URLSearchParams({ fields: "id,username,name,threads_profile_picture_url", access_token: token })}`,
    );

    const daily = new Map<string, DailyMetric>();
    const followers = await optional(
      () => getJson<{ data?: Insight[] }>(`${API}/me/threads_insights?${new URLSearchParams({ metric: "followers_count", access_token: token })}`),
      warnings,
      "followers_count",
    );
    daily.set(today, { date: today, followers: followers?.data?.[0]?.total_value?.value ?? null });

    const since = Math.floor(new Date(`${addDays(today, backfill ? -28 : -3)}T00:00:00+05:00`).getTime() / 1000);
    const until = Math.floor(new Date(`${today}T00:00:00+05:00`).getTime() / 1000);
    const views = await optional(
      () => getJson<{ data?: Insight[] }>(`${API}/me/threads_insights?${new URLSearchParams({ metric: "views", since: String(since), until: String(until), access_token: token })}`),
      warnings,
      "views",
    );
    for (const value of views?.data?.[0]?.values ?? []) {
      const date = value.end_time ? addDays(todayPK(new Date(value.end_time)), -1) : today;
      const row = daily.get(date) ?? { date };
      daily.set(date, { ...row, views: value.value });
    }

    const engagement = await optional(
      () =>
        getJson<{ data?: Insight[] }>(
          `${API}/me/threads_insights?${new URLSearchParams({ metric: "likes,replies,reposts,quotes", since: String(until - 86_400), until: String(until), access_token: token })}`,
        ),
      warnings,
      "engagement",
    );
    const totalEngagement = (engagement?.data ?? []).reduce((sum, metric) => sum + (metric.total_value?.value ?? 0), 0);
    if (engagement?.data?.length) {
      const date = addDays(today, -1);
      daily.set(date, { ...(daily.get(date) ?? { date }), engagement: totalEngagement });
    }

    const posts: PostMetric[] = [];
    const threads = await optional(
      () => getJson<{ data?: { id: string; text?: string; permalink?: string; timestamp?: string }[] }>(`${API}/me/threads?${new URLSearchParams({ fields: "id,text,permalink,timestamp", limit: "10", access_token: token })}`),
      warnings,
      "threads",
    );
    for (const thread of threads?.data ?? []) {
      const insights = await optional(
        () => getJson<{ data?: Insight[] }>(`${API}/${thread.id}/insights?${new URLSearchParams({ metric: "views,likes,replies,reposts,quotes", access_token: token })}`),
        [],
        "thread insights",
      );
      const value = (name: string) => insights?.data?.find((m) => m.name === name)?.values?.[0]?.value ?? null;
      const likes = value("likes");
      const replies = value("replies");
      const reposts = value("reposts");
      posts.push({
        external_id: thread.id,
        title: thread.text?.slice(0, 140) ?? null,
        url: thread.permalink ?? null,
        thumbnail_url: null,
        published_at: thread.timestamp ?? null,
        views: value("views"),
        likes,
        comments: replies,
        shares: reposts,
        engagement: (likes ?? 0) + (replies ?? 0) + (reposts ?? 0) + (value("quotes") ?? 0),
      });
    }

    return {
      profile: {
        external_id: me.id,
        name: me.name ?? me.username,
        handle: me.username,
        avatar_url: me.threads_profile_picture_url ?? null,
        profile_url: `https://www.threads.com/@${me.username}`,
      },
      daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
      posts,
      tokens: refreshed ?? undefined,
      warnings,
    };
  },
};
