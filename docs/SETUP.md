# Growthify OS — setup guide

Do these in order. Each step says exactly where to click and which value to copy. Keep a private note (password manager) open to paste values into. **Never put these values in GitHub, WhatsApp groups or screenshots.**

You'll end up with these environment variables (full list with comments in [`.env.example`](../.env.example)):

| Variable | From step |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | 1 |
| `OWNER_EMAILS` | `bymegrowthify@gmail.com` |
| `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET` | 4 |
| `NEXT_PUBLIC_SITE_URL` | 5 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI` | 3 |
| `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `META_GRAPH_VERSION` | 7 |
| `THREADS_APP_ID`, `THREADS_APP_SECRET`, `THREADS_REDIRECT_URI` | 8 |
| `ALLOW_DEMO_DATA` | `false` in production |

`<your-domain>` below means your Vercel address (e.g. `growthify-os.vercel.app`) or later your custom domain (e.g. `os.growthify.pk`).

---

## 1. Supabase project (database, login, files)

1. Go to **supabase.com** → **Sign in with GitHub** → **New project**.
2. Name: `growthify-os`. Database password: click **Generate a password** and save it. Region: **South Asia (Mumbai)** (closest to Pakistan). Click **Create new project** and wait ~2 minutes.
3. Left sidebar → **Project Settings** (gear) → **Data API**: copy the **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`.
4. **Project Settings → API Keys**: copy the **anon / public** key (or the new **publishable** key) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`; copy the **service_role** key (or the new **secret** key) → `SUPABASE_SERVICE_ROLE_KEY`. The service key bypasses all security — only ever put it in Vercel.
5. Create the tables. **Option A (no terminal):** left sidebar → **SQL Editor** → **New query**. Open each file in `supabase/migrations/` on GitHub **in name order** (`…000001` → `…000005`), copy all of it, paste, click **Run**, wait for "Success". **Option B (terminal):**

   ```bash
   npx supabase login
   ```

   ```bash
   npx supabase link --project-ref <the-id-in-your-project-url>
   ```

   ```bash
   npx supabase db push
   ```

6. Check: **Table Editor** shows `clients`, `projects`, `invoices`, … and `settings` has one row "Growthify Agency".
7. **Authentication → Sign In / Providers → Email**: turn **off** "Allow new users to sign up" (sign-in is Google-only).
8. Google provider is set up in step 3 (needs the Google keys first).

## 2. GitHub

The repository is already connected to Claude Code. Nothing to do unless you want to invite collaborators (GitHub → repo → **Settings → Collaborators**).

## 3. Google Cloud (app login + YouTube)

### 3a. Project and consent screen

1. **console.cloud.google.com** → top bar project picker → **New project** → name `Growthify OS` → **Create** → select it.
2. Search bar: **Google Auth Platform** → **Get started**. App name `Growthify OS`, support email `bymegrowthify@gmail.com` → Audience **External** → contact email → agree → **Create**.
3. **Branding** → Authorized domains → add `supabase.co` and your domain (`vercel.app` domains can't be added; that's fine until you have a custom domain) → **Save**.
4. **Audience** → **Publish app** → confirm. Status must say **In production** (in "Testing", YouTube refresh tokens expire after 7 days). An "unverified app" warning during sign-in is expected for an internal tool — click **Advanced → Go to Growthify OS**.

### 3b. Login client (used by Supabase)

1. **Clients** → **Create client** → type **Web application** → name `Growthify OS – Login`.
2. **Authorized redirect URIs** → **Add URI** → `https://<your-project-id>.supabase.co/auth/v1/callback` → **Create**.
3. Copy **Client ID** and **Client secret**.
4. In **Supabase → Authentication → Sign In / Providers → Google**: enable, paste Client ID and secret → **Save**.
5. **Supabase → Authentication → URL Configuration**: Site URL `https://<your-domain>`; **Redirect URLs** → add `https://<your-domain>/auth/callback` and `http://localhost:3000/auth/callback` → **Save**.

### 3c. YouTube connection (separate from login)

1. Search bar: **YouTube Data API v3** → **Enable**. Search: **YouTube Analytics API** → **Enable**.
2. **Google Auth Platform → Data Access → Add or remove scopes** → tick `…/auth/youtube.readonly` and `…/auth/yt-analytics.readonly` (paste them in "Manually add scopes" if not listed) → **Update** → **Save**.
3. **Clients → Create client** → Web application → `Growthify OS – YouTube` → redirect URI `https://<your-domain>/api/integrations/youtube/callback` (and `http://localhost:3000/api/integrations/youtube/callback` for local) → **Create**.
4. Copy → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Set `YOUTUBE_REDIRECT_URI=https://<your-domain>/api/integrations/youtube/callback`.

## 4. Generate the two secrets

Run once each (any computer with Node.js), copy the output:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

→ `TOKEN_ENCRYPTION_KEY` (keep it forever: changing it means reconnecting all social accounts).

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

→ `CRON_SECRET`.

## 5. Vercel (hosting + daily job)

1. **vercel.com** → **Continue with GitHub** → **Add New… → Project** → import `GrowthifyAgencyCRM` → **Import**.
2. Framework preset: **Next.js** (auto). Open **Environment Variables** and add every variable from the table above (Production + Preview). For the first deploy use `NEXT_PUBLIC_SITE_URL=https://growthify-os.vercel.app` (adjust after step 4) and `OWNER_EMAILS=bymegrowthify@gmail.com`, `ALLOW_DEMO_DATA=false`, `META_GRAPH_VERSION=v26.0`.
3. **Deploy**. When done, copy the domain from **Domains**.
4. If the domain differs from what you entered: **Settings → Environment Variables** → fix `NEXT_PUBLIC_SITE_URL` and the three `*_REDIRECT_URI` values → **Deployments → ⋯ → Redeploy**. Also update the Supabase URL configuration (3b-5) and the Google redirect URIs (3b-2, 3c-3).
5. Cron: `vercel.json` already schedules `/api/cron/daily` at 22:00 UTC (= 03:00 Pakistan). Vercel sends `CRON_SECRET` automatically. Check it under **Settings → Cron Jobs**.

### First sign-in (Phase 0 check)

1. Open `https://<your-domain>` → **Continue with Google** → pick `bymegrowthify@gmail.com` → you land on Overview as **Owner**.
2. Open a private window, sign in with any other Google account → you must see **Access not granted**.
3. Invite people: **Settings → Team & roles → Invite by Google email**, choose Manager or Staff. They sign in with the same button.

## 6. Company and billing details

**Settings → Company profile**: logo, phone, address. **Billing & invoice details** (owner only): bank name, account title, IBAN, JazzCash/Easypaisa/Raast, NTN/STRN, default sales tax and payment terms. These print on invoice PDFs. **Settings → Services & plans**: set the monthly prices for the three seeded plans (they start at 0).

## 7. Meta — Facebook Page + Instagram

Instagram must be a **Professional (Business or Creator)** account linked to the Growthify Facebook Page (Instagram app → Settings → Account type; Page → Settings → Linked accounts).

### 7a. Create the Meta app (needed for both options)

1. **developers.facebook.com** → **My Apps → Create app** → name `Growthify OS` → use case **Other** → type **Business** → connect it to the **Growthify business portfolio** → **Create**.
2. **App settings → Basic**: copy **App ID** → `META_APP_ID`, **App secret** (Show) → `META_APP_SECRET`. Add a Privacy Policy URL (any page on your website) → **Save**.

### 7b. Option A — system-user token (recommended)

1. **business.facebook.com** → **Settings** → **Users → System users** → **Add** → name `Growthify OS`, role **Employee** → **Create**.
2. **Assign assets**: **Pages** → Growthify Page → allow **Insights / view performance** (content read). **Instagram accounts** → @growthifyagencypk → **view insights**. Save.
3. **Accounts → Apps**: make sure `Growthify OS` is listed (add it by App ID if not). On the system user click **Generate token** → app `Growthify OS` → expiry **Never** → tick `pages_show_list`, `pages_read_engagement`, `read_insights`, `instagram_basic`, `instagram_manage_insights`, `business_management` → **Generate** → copy.
4. **Growthify OS → Settings → Integrations** → paste into **System-user access token** → **Validate & connect**. Facebook and Instagram turn **Connected** and the first numbers appear on **Social**.

### 7c. Option B — Connect with Facebook

1. In the Meta app: **Use cases → Customize** "Facebook Login for Business" (or add product **Facebook Login**) → **Settings → Valid OAuth Redirect URIs** → `https://<your-domain>/api/integrations/meta/callback` → **Save**. Set `META_REDIRECT_URI` to the same.
2. The app can stay in **Development mode**: you (an app admin) can grant all permissions without App Review.
3. **Settings → Integrations → Connect with Facebook** → choose the Growthify Page and Instagram account in Meta's dialog.

## 8. Threads

1. Same Meta app → **Use cases → Add use case → Access the Threads API**.
2. **Permissions**: add `threads_basic` and `threads_manage_insights`.
3. **Settings** (of the Threads use case): Redirect callback URL `https://<your-domain>/api/integrations/threads/callback`; uninstall and delete callback URLs: the same URL. Copy the **Threads app ID** → `THREADS_APP_ID` and **Threads app secret** → `THREADS_APP_SECRET`; set `THREADS_REDIRECT_URI`.
4. **App roles → Roles → Add people → Threads testers** → `growthifyagencypk`. Accept it in the Threads app: **Settings → Account → Website permissions → Invites → Accept**.
5. **Settings → Integrations → Threads → Connect**. Note: Meta only returns `followers_count` for profiles with 100+ followers; until then the count stays empty but views and posts still sync.

## 9. YouTube

**Settings → Integrations → YouTube → Connect** → pick the Google account that owns the Growthify channel → **Allow**. The first sync back-fills ~30 days of subscribers and views.

## 10. LinkedIn and TikTok (manual for now)

**Social → Platforms → LinkedIn → Add today's count** (TikTok: **+ Manual platform** first). Each entry is a daily snapshot that appears in the charts. LinkedIn company stats need LinkedIn's Community Management API approval; the code has an adapter slot ready.

## 11. Custom domain (later)

Vercel → **Settings → Domains → Add** `os.<your-domain>` → follow the DNS record shown (CNAME at your registrar). Then repeat step 5-4 with the new domain (env vars, Supabase redirect URLs, Google and Meta redirect URIs) and redeploy.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Access not granted" for the owner | `OWNER_EMAILS` must contain the exact Google email; redeploy after changing env vars. |
| Google login returns to /login?error=auth | Supabase **URL Configuration** must list `https://<your-domain>/auth/callback`. |
| YouTube says "no refresh token" | Remove the app at **myaccount.google.com → Security → Third-party access**, then Connect again. |
| An account shows **Needs reconnect** | Token expired or permission removed → **Settings → Integrations → Reconnect**. |
| A metric is missing after a Meta update | The sync skips metrics Meta has retired and lists them under the account; numbers that still exist keep syncing. |
| Cron didn't run | Vercel **Settings → Cron Jobs** shows runs; `CRON_SECRET` must be set. |

## Local development

See the README "Run it locally" section. Never point local tools at the production database: `tests/e2e/session.mjs` refuses non-local Supabase URLs.
