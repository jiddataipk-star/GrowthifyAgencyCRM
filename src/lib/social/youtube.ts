import "server-only";
import { serverEnv } from "@/lib/env";
import { addDays, todayPK } from "@/lib/dates";
import { ReconnectError, getJson, optional, postForm } from "./http";
import type { DailyMetric, PostMetric, SocialAdapter, Tokens } from "./types";

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

/** Google consent URL: offline access + account chooser so we always get a refresh token. */
export function youtubeAuthUrl(state: string) {
  const { clientId, redirectUri } = serverEnv.google();
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not set");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: YOUTUBE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "select_account consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number; scope?: string };

export async function exchangeYoutubeCode(code: string): Promise<Tokens & { scopes: string[] }> {
  const { clientId, clientSecret, redirectUri } = serverEnv.google();
  const data = await postForm<TokenResponse>("https://oauth2.googleapis.com/token", {
    code,
    client_id: clientId ?? "",
    client_secret: clientSecret ?? "",
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  return {
    access: data.access_token,
    refresh: data.refresh_token ?? null,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    scopes: (data.scope ?? "").split(" ").filter(Boolean),
  };
}

async function refresh(tokens: Tokens): Promise<Tokens> {
  if (!tokens.refresh) throw new ReconnectError("No refresh token stored. Reconnect YouTube.");
  const { clientId, clientSecret } = serverEnv.google();
  const data = await postForm<TokenResponse>("https://oauth2.googleapis.com/token", {
    client_id: clientId ?? "",
    client_secret: clientSecret ?? "",
    refresh_token: tokens.refresh,
    grant_type: "refresh_token",
  });
  return { access: data.access_token, refresh: tokens.refresh, expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString() };
}

type Channel = {
  id: string;
  snippet: { title: string; customUrl?: string; thumbnails?: { default?: { url: string } } };
  statistics: { subscriberCount?: string; viewCount?: string; videoCount?: string; hiddenSubscriberCount?: boolean };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
};

export const youtubeAdapter: SocialAdapter = {
  platform: "youtube",
  async sync({ tokens: stored, backfill }) {
    const warnings: string[] = [];
    const expired = !stored.expiresAt || new Date(stored.expiresAt).getTime() < Date.now() + 60_000;
    const tokens = expired ? await refresh(stored) : stored;
    const auth = { headers: { Authorization: `Bearer ${tokens.access}` } };
    const today = todayPK();

    const channels = await getJson<{ items?: Channel[] }>(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true",
      auth,
    );
    const channel = channels.items?.[0];
    if (!channel) throw new ReconnectError("This Google account has no YouTube channel. Reconnect and pick the Growthify channel.");
    const subscribers = Number(channel.statistics.subscriberCount ?? 0);

    // Daily analytics (YouTube Analytics data lags ~2 days).
    const days = backfill ? 30 : 4;
    const report = await optional(
      () =>
        getJson<{ rows?: [string, number, number, number, number][] }>(
          `https://youtubeanalytics.googleapis.com/v2/reports?${new URLSearchParams({
            ids: "channel==MINE",
            startDate: addDays(today, -days),
            endDate: today,
            metrics: "views,estimatedMinutesWatched,subscribersGained,subscribersLost",
            dimensions: "day",
            sort: "day",
          })}`,
          auth,
        ),
      warnings,
      "YouTube Analytics",
    );

    const daily: DailyMetric[] = [];
    const rows = report?.rows ?? [];
    // Reconstruct past subscriber counts from net daily change, newest first.
    let running = subscribers;
    const byDate = new Map<string, DailyMetric>();
    for (const [date, views, minutes, gained, lost] of [...rows].reverse()) {
      byDate.set(date, { date, followers: date === today ? subscribers : Math.max(running, 0), views, extra: { minutes_watched: minutes, subscribers_gained: gained, subscribers_lost: lost } });
      running -= gained - lost;
    }
    daily.push(...[...byDate.values()].reverse());
    const todayRow = byDate.get(today);
    if (todayRow) todayRow.followers = subscribers;
    else daily.push({ date: today, followers: subscribers, extra: { total_views: Number(channel.statistics.viewCount ?? 0), videos: Number(channel.statistics.videoCount ?? 0) } });

    // Latest videos with view counts.
    const posts: PostMetric[] = [];
    const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
    if (uploads) {
      const items = await optional(
        () => getJson<{ items?: { contentDetails: { videoId: string } }[] }>(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=10&playlistId=${uploads}`, auth),
        warnings,
        "YouTube uploads",
      );
      const ids = (items?.items ?? []).map((i) => i.contentDetails.videoId);
      if (ids.length) {
        const videos = await optional(
          () =>
            getJson<{ items?: { id: string; snippet: { title: string; publishedAt: string; thumbnails?: { medium?: { url: string } } }; statistics: { viewCount?: string; likeCount?: string; commentCount?: string } }[] }>(
              `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${ids.join(",")}`,
              auth,
            ),
          warnings,
          "YouTube videos",
        );
        for (const v of videos?.items ?? []) {
          const likes = Number(v.statistics.likeCount ?? 0);
          const comments = Number(v.statistics.commentCount ?? 0);
          posts.push({
            external_id: v.id,
            title: v.snippet.title,
            url: `https://www.youtube.com/watch?v=${v.id}`,
            thumbnail_url: v.snippet.thumbnails?.medium?.url ?? null,
            published_at: v.snippet.publishedAt,
            views: Number(v.statistics.viewCount ?? 0),
            likes,
            comments,
            shares: null,
            engagement: likes + comments,
          });
        }
      }
    }

    return {
      profile: {
        external_id: channel.id,
        name: channel.snippet.title,
        handle: channel.snippet.customUrl ?? null,
        avatar_url: channel.snippet.thumbnails?.default?.url ?? null,
        profile_url: channel.snippet.customUrl ? `https://www.youtube.com/${channel.snippet.customUrl}` : `https://www.youtube.com/channel/${channel.id}`,
      },
      daily,
      posts,
      tokens: expired ? tokens : undefined,
      warnings,
    };
  },
};
