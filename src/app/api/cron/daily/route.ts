import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncAll } from "@/lib/social/sync";

export const maxDuration = 300;

function authorised(request: NextRequest) {
  const secret = serverEnv.cronSecret();
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/**
 * Vercel Cron, 22:00 UTC = 03:00 Asia/Karachi (see vercel.json).
 * Pulls yesterday's social metrics into social_metrics_daily and flags broken tokens.
 * Renewals, follow-ups and overdue invoices need no job: they're computed live.
 */
export async function GET(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const startedAt = new Date().toISOString();
  const social = await syncAll(createAdminClient());
  return NextResponse.json({ startedAt, finishedAt: new Date().toISOString(), social });
}
