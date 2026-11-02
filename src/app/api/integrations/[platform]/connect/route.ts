import { NextResponse, type NextRequest } from "next/server";
import { getMember, canSeeFinance } from "@/lib/auth";
import { createOAuthState } from "@/lib/social/oauth";
import { youtubeAuthUrl } from "@/lib/social/youtube";
import { metaAuthUrl } from "@/lib/social/meta";
import { threadsAuthUrl } from "@/lib/social/threads";

const BUILDERS: Record<string, (state: string) => string> = {
  youtube: youtubeAuthUrl,
  meta: metaAuthUrl,
  threads: threadsAuthUrl,
};

/**
 * "Connect" button: sends the owner/manager to the platform's own login and
 * account chooser. Separate from signing in to Growthify OS.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const back = (message: string) =>
    NextResponse.redirect(new URL(`/settings?tab=integrations&error=${encodeURIComponent(message)}`, request.nextUrl.origin));

  const member = await getMember();
  if (!member || !canSeeFinance(member.role)) return back("Only the owner or a manager can connect accounts.");
  const build = BUILDERS[platform];
  if (!build) return back("Unknown platform.");
  try {
    return NextResponse.redirect(build(await createOAuthState(platform)));
  } catch (error) {
    return back(error instanceof Error ? `${error.message}. See docs/SETUP.md.` : "Integration is not configured.");
  }
}
