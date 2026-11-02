import { NextResponse, type NextRequest } from "next/server";
import { getMember, canSeeFinance } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyOAuthState } from "@/lib/social/oauth";
import { exchangeYoutubeCode } from "@/lib/social/youtube";
import { exchangeMetaCode, listMetaPages, pickPage } from "@/lib/social/meta";
import { exchangeThreadsCode } from "@/lib/social/threads";
import { storeConnection, syncAccount } from "@/lib/social/sync";
import { META_SCOPES } from "@/lib/social/meta";
import { THREADS_SCOPES } from "@/lib/social/threads";

/** Provider redirect: verify state + role, exchange the code, encrypt and store tokens, then sync once. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const url = request.nextUrl;
  const done = (query: string) => NextResponse.redirect(new URL(`/settings?tab=integrations&${query}`, url.origin));
  const fail = (message: string) => done(`error=${encodeURIComponent(message)}`);

  const member = await getMember();
  if (!member || !canSeeFinance(member.role)) return fail("Only the owner or a manager can connect accounts.");
  if (!(await verifyOAuthState(platform, url.searchParams.get("state")))) return fail("The connection request expired. Please try again.");
  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (providerError) return fail(providerError);
  const code = url.searchParams.get("code");
  if (!code) return fail("No authorization code returned.");

  const admin = createAdminClient();
  try {
    const synced: string[] = [];
    if (platform === "youtube") {
      const tokens = await exchangeYoutubeCode(code);
      if (!tokens.refresh) return fail("Google didn't return a refresh token. Remove the app's access in your Google account and connect again.");
      const id = await storeConnection(admin, { platform: "youtube", connection: "oauth", externalId: "pending", access: tokens.access, refresh: tokens.refresh, expiresAt: tokens.expiresAt, scopes: tokens.scopes, userId: member.userId });
      if (id) synced.push((await syncAccount(admin, id)).message);
    } else if (platform === "meta") {
      const userToken = await exchangeMetaCode(code);
      const pages = await listMetaPages(userToken);
      const { data: seeded } = await admin.from("social_accounts").select("handle").eq("platform", "facebook").limit(1).maybeSingle();
      const page = pickPage(pages, seeded?.handle ?? null);
      if (!page) return fail("No Facebook Page found. Make sure you selected the Growthify Page in the Meta dialog.");
      const fbId = await storeConnection(admin, {
        platform: "facebook", connection: "oauth", externalId: page.id, name: page.name, handle: page.username ?? null,
        avatarUrl: page.picture?.data?.url ?? null, profileUrl: page.link ?? null, access: page.access_token, scopes: META_SCOPES,
        meta: { page_id: page.id }, userId: member.userId,
      });
      if (fbId) synced.push((await syncAccount(admin, fbId)).message);
      const ig = page.instagram_business_account;
      if (ig) {
        const igId = await storeConnection(admin, {
          platform: "instagram", connection: "oauth", externalId: ig.id, name: ig.name ?? ig.username ?? null, handle: ig.username ?? null,
          avatarUrl: ig.profile_picture_url ?? null, profileUrl: ig.username ? `https://www.instagram.com/${ig.username}` : null,
          access: page.access_token, scopes: META_SCOPES, meta: { page_id: page.id }, userId: member.userId,
        });
        if (igId) synced.push((await syncAccount(admin, igId)).message);
      }
    } else if (platform === "threads") {
      const tokens = await exchangeThreadsCode(code);
      const id = await storeConnection(admin, { platform: "threads", connection: "oauth", externalId: tokens.userId, access: tokens.access, expiresAt: tokens.expiresAt, scopes: THREADS_SCOPES, userId: member.userId });
      if (id) synced.push((await syncAccount(admin, id)).message);
    } else {
      return fail("Unknown platform.");
    }
    return done(`connected=${encodeURIComponent(platform)}`);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Connection failed.");
  }
}
