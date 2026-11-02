/**
 * Typed access to environment variables. Public values are inlined by Next.js
 * at build time; server values are read lazily so a missing optional
 * integration key never breaks unrelated pages.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable ${name}. See .env.example and docs/SETUP.md.`);
  }
  return value;
}

export const publicEnv = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  siteUrl: () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
};

export const serverEnv = {
  serviceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
  ownerEmails: () =>
    (process.env.OWNER_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  cronSecret: () => process.env.CRON_SECRET,
  demoDataAllowed: () => process.env.ALLOW_DEMO_DATA === "true",
  google: () => ({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.YOUTUBE_REDIRECT_URI ?? `${publicEnv.siteUrl()}/api/integrations/youtube/callback`,
  }),
  meta: () => ({
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
    redirectUri: process.env.META_REDIRECT_URI ?? `${publicEnv.siteUrl()}/api/integrations/meta/callback`,
    graphVersion: process.env.META_GRAPH_VERSION || "v24.0",
  }),
  threads: () => ({
    appId: process.env.THREADS_APP_ID,
    appSecret: process.env.THREADS_APP_SECRET,
    redirectUri: process.env.THREADS_REDIRECT_URI ?? `${publicEnv.siteUrl()}/api/integrations/threads/callback`,
  }),
};
