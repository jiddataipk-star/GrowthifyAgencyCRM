import type { Enums } from "@/types/db";

export type Platform = Enums<"social_platform">;

export type DailyMetric = {
  date: string; // YYYY-MM-DD (Pakistan)
  followers?: number | null;
  reach?: number | null;
  views?: number | null;
  engagement?: number | null;
  extra?: Record<string, number | string | null>;
};

export type PostMetric = {
  external_id: string;
  title: string | null;
  url: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  engagement: number | null;
};

export type Tokens = { access: string; refresh?: string | null; expiresAt?: string | null };

export type SyncResult = {
  profile: { external_id: string; name: string | null; handle: string | null; avatar_url: string | null; profile_url: string | null };
  daily: DailyMetric[];
  posts: PostMetric[];
  /** Present when the adapter refreshed the access token. */
  tokens?: Tokens;
  warnings: string[];
};

export type AdapterInput = {
  externalId: string | null;
  meta: Record<string, unknown>;
  tokens: Tokens;
  /** First sync: adapters may backfill recent history. */
  backfill: boolean;
};

/**
 * One adapter per platform. LinkedIn and TikTok use manual daily entries for now;
 * when their APIs are approved, implement this interface and register it in sync.ts.
 */
export interface SocialAdapter {
  platform: Platform;
  sync(input: AdapterInput): Promise<SyncResult>;
}
