import "server-only";
import { serverEnv } from "@/lib/env";
import { addDays, todayPK } from "@/lib/dates";
import { getJson, optional } from "./http";
import type { DailyMetric, PostMetric, SocialAdapter, Tokens } from "./types";

/**
 * Facebook Page + Instagram (professional account) through the Meta Graph API.
 * Metric names follow the 2025–2026 deprecations: page_fans → followers_count /
 * page_follows, page_impressions → page_media_view, IG impressions → views.
 * Every insight is requested separately and skipped if Meta rejects it, so a
 * future deprecation degrades the dashboard instead of breaking the sync.
 */
export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "read_insights",
  "instagram_basic",
  "instagram_manage_insights",
  "business_management",
];

function graph(path: string, params: Record<string, string>) {
  const { graphVersion } = serverEnv.meta();
  return `https://graph.facebook.com/${graphVersion}/${path}?${new URLSearchParams(params)}`;
}

export function metaAuthUrl(state: string) {
  const { appId, redirectUri, graphVersion } = serverEnv.meta();
  if (!appId) throw new Error("META_APP_ID is not set");
  const params = new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, state, scope: META_SCOPES.join(","), response_type: "code", auth_type: "rerequest" });
  return `https://www.facebook.com/${graphVersion}/dialog/oauth?${params}`;
}

/** Code → short-lived user token → long-lived (~60 day) user token. */
export async function exchangeMetaCode(code: string): Promise<string> {
  const { appId, appSecret, redirectUri } = serverEnv.meta();
  const short = await getJson<{ access_token: string }>(graph("oauth/access_token", { client_id: appId ?? "", client_secret: appSecret ?? "", redirect_uri: redirectUri, code }));
  const long = await getJson<{ access_token: string }>(
    graph("oauth/access_token", { grant_type: "fb_exchange_token", client_id: appId ?? "", client_secret: appSecret ?? "", fb_exchange_token: short.access_token }),
  );
  return long.access_token;
}

export type MetaPage = {
  id: string;
  name: string;
  username?: string;
  access_token: string;
  link?: string;
  picture?: { data?: { url?: string } };
  instagram_business_account?: { id: string; username?: string; name?: string; profile_picture_url?: string };
};

/**
 * Pages visible to a user or system-user token, each with its Page token
 * (Page tokens derived from a long-lived/system user token do not expire).
 */
export async function listMetaPages(userToken: string): Promise<MetaPage[]> {
  const data = await getJson<{ data?: MetaPage[] }>(
    graph("me/accounts", {
      access_token: userToken,
      fields: "id,name,username,link,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}",
      limit: "50",
    }),
  );
  return data.data ?? [];
}

/** Choose the Growthify page: match the expected handle, else the first page. */
export function pickPage(pages: MetaPage[], handle: string | null) {
  const wanted = handle?.toLowerCase();
  return pages.find((p) => p.username?.toLowerCase() === wanted || p.link?.toLowerCase().includes(`/${wanted}`)) ?? pages[0] ?? null;
}

type InsightValue = { value: number | Record<string, number>; end_time?: string };
type Insight = { name: string; period: string; values?: InsightValue[]; total_value?: { value: number } };

function sinceUntil(days: number) {
  const today = todayPK();
  // Unix seconds; Meta interprets day boundaries in the Page's time zone.
  const since = Math.floor(new Date(`${addDays(today, -days)}T00:00:00+05:00`).getTime() / 1000);
  const until = Math.floor(new Date(`${today}T00:00:00+05:00`).getTime() / 1000);
  return { since: String(since), until: String(until) };
}

function dayOf(endTime: string | undefined) {
  // end_time marks the end of the day; the value belongs to the previous day.
  if (!endTime) return todayPK();
  return addDays(todayPK(new Date(endTime)), -1);
}

function mergeDaily(map: Map<string, DailyMetric>, date: string, patch: Partial<DailyMetric>) {
  const row = map.get(date) ?? { date };
  map.set(date, { ...row, ...patch, extra: { ...(row.extra ?? {}), ...(patch.extra ?? {}) } });
}

export const facebookAdapter: SocialAdapter = {
  platform: "facebook",
  async sync({ externalId, tokens, backfill }) {
    const warnings: string[] = [];
    const pageId = externalId;
    if (!pageId) throw new Error("Page not linked yet. Connect Meta in Settings → Integrations.");
    const token = tokens.access;
    const today = todayPK();

    const page = await getJson<{ id: string; name: string; username?: string; link?: string; followers_count?: number; fan_count?: number; picture?: { data?: { url?: string } } }>(
      graph(pageId, { access_token: token, fields: "id,name,username,link,followers_count,fan_count,picture{url}" }),
    );

    const daily = new Map<string, DailyMetric>();
    mergeDaily(daily, today, { followers: page.followers_count ?? page.fan_count ?? null });

    const range = sinceUntil(backfill ? 28 : 3);
    const metrics: [string, keyof DailyMetric | "follows"][] = [
      ["page_media_view", "views"],
      ["page_total_media_view_unique", "reach"],
      ["page_post_engagements", "engagement"],
      ["page_follows", "follows"],
    ];
    for (const [metric, field] of metrics) {
      const result = await optional(
        () => getJson<{ data?: Insight[] }>(graph(`${pageId}/insights`, { access_token: token, metric, period: "day", ...range })),
        warnings,
        metric,
      );
      for (const value of result?.data?.[0]?.values ?? []) {
        if (typeof value.value !== "number") continue;
        const date = dayOf(value.end_time);
        if (field === "follows") mergeDaily(daily, date, { extra: { page_follows: value.value } });
        else mergeDaily(daily, date, { [field]: value.value });
      }
    }

    const posts: PostMetric[] = [];
    const feed = await optional(
      () =>
        getJson<{ data?: { id: string; message?: string; permalink_url?: string; created_time?: string; full_picture?: string; shares?: { count: number }; reactions?: { summary?: { total_count: number } }; comments?: { summary?: { total_count: number } } }[] }>(
          graph(`${pageId}/posts`, {
            access_token: token,
            fields: "id,message,permalink_url,created_time,full_picture,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)",
            limit: "10",
          }),
        ),
      warnings,
      "Page posts",
    );
    for (const post of feed?.data ?? []) {
      const likes = post.reactions?.summary?.total_count ?? 0;
      const comments = post.comments?.summary?.total_count ?? 0;
      const shares = post.shares?.count ?? 0;
      posts.push({
        external_id: post.id,
        title: post.message?.slice(0, 140) ?? null,
        url: post.permalink_url ?? null,
        thumbnail_url: post.full_picture ?? null,
        published_at: post.created_time ?? null,
        views: null,
        likes,
        comments,
        shares,
        engagement: likes + comments + shares,
      });
    }

    return {
      profile: {
        external_id: page.id,
        name: page.name,
        handle: page.username ?? null,
        avatar_url: page.picture?.data?.url ?? null,
        profile_url: page.link ?? (page.username ? `https://www.facebook.com/${page.username}` : null),
      },
      daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
      posts,
      warnings,
    };
  },
};

export const instagramAdapter: SocialAdapter = {
  platform: "instagram",
  async sync({ externalId, tokens, backfill }) {
    const warnings: string[] = [];
    const igId = externalId;
    if (!igId) throw new Error("Instagram account not linked yet. Connect Meta in Settings → Integrations.");
    const token = tokens.access;
    const today = todayPK();

    const profile = await getJson<{ id: string; username: string; name?: string; followers_count?: number; media_count?: number; profile_picture_url?: string }>(
      graph(igId, { access_token: token, fields: "id,username,name,followers_count,media_count,profile_picture_url" }),
    );

    const daily = new Map<string, DailyMetric>();
    mergeDaily(daily, today, { followers: profile.followers_count ?? null, extra: { media_count: profile.media_count ?? null } });

    // reach supports a daily time series.
    const range = sinceUntil(backfill ? 28 : 3);
    const reach = await optional(
      () => getJson<{ data?: Insight[] }>(graph(`${igId}/insights`, { access_token: token, metric: "reach", period: "day", ...range })),
      warnings,
      "reach",
    );
    for (const value of reach?.data?.[0]?.values ?? []) {
      if (typeof value.value === "number") mergeDaily(daily, dayOf(value.end_time), { reach: value.value });
    }

    // views / interactions / profile views are total_value metrics: ask for yesterday only.
    const yesterday = addDays(today, -1);
    const yRange = {
      since: String(Math.floor(new Date(`${yesterday}T00:00:00+05:00`).getTime() / 1000)),
      until: String(Math.floor(new Date(`${today}T00:00:00+05:00`).getTime() / 1000)),
    };
    for (const [metric, field] of [
      ["views", "views"],
      ["total_interactions", "engagement"],
      ["profile_views", "profile_views"],
    ] as const) {
      const total = await optional(
        () => getJson<{ data?: Insight[] }>(graph(`${igId}/insights`, { access_token: token, metric, period: "day", metric_type: "total_value", ...yRange })),
        warnings,
        metric,
      );
      const value = total?.data?.[0]?.total_value?.value;
      if (typeof value !== "number") continue;
      if (field === "profile_views") mergeDaily(daily, yesterday, { extra: { profile_views: value } });
      else mergeDaily(daily, yesterday, { [field]: value });
    }

    const posts: PostMetric[] = [];
    const media = await optional(
      () =>
        getJson<{ data?: { id: string; caption?: string; permalink?: string; timestamp?: string; media_type?: string; media_url?: string; thumbnail_url?: string; like_count?: number; comments_count?: number }[] }>(
          graph(`${igId}/media`, { access_token: token, fields: "id,caption,permalink,timestamp,media_type,media_url,thumbnail_url,like_count,comments_count", limit: "10" }),
        ),
      warnings,
      "Instagram media",
    );
    for (const item of media?.data ?? []) {
      const viewsInsight = await optional(
        () => getJson<{ data?: Insight[] }>(graph(`${item.id}/insights`, { access_token: token, metric: "views" })),
        [],
        "media views",
      );
      const views = viewsInsight?.data?.[0]?.values?.[0]?.value ?? viewsInsight?.data?.[0]?.total_value?.value;
      const likes = item.like_count ?? 0;
      const comments = item.comments_count ?? 0;
      posts.push({
        external_id: item.id,
        title: item.caption?.slice(0, 140) ?? null,
        url: item.permalink ?? null,
        thumbnail_url: item.thumbnail_url ?? (item.media_type === "VIDEO" ? null : item.media_url ?? null),
        published_at: item.timestamp ?? null,
        views: typeof views === "number" ? views : null,
        likes,
        comments,
        shares: null,
        engagement: likes + comments,
      });
    }

    return {
      profile: {
        external_id: profile.id,
        name: profile.name ?? profile.username,
        handle: profile.username,
        avatar_url: profile.profile_picture_url ?? null,
        profile_url: `https://www.instagram.com/${profile.username}`,
      },
      daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
      posts,
      warnings,
    };
  },
};

export type { Tokens };
