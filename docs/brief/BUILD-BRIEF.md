# Growthify OS: Agency Admin Panel & CRM
### Build brief for Claude Code

> **For Ahmad:** start a Claude Code session on a new GitHub repo. Upload this whole folder into the repo as `/docs/brief/`, then tell Claude Code: *"Read docs/brief/BUILD-BRIEF.md and build it phase by phase."*

---

## 0. How to work with me (Ahmad, the owner)

**Communication:**
- Reply in English, even when I write in Roman Urdu or Hindi.
- Start every message with "Ahmad bhai" and a 1–2 line status: what we're doing, where we stand, what's next.
- Keep messages short. When there's a decision, give me one clear recommendation.

**How we build:**
- Work **phase by phase** (Section 9).
- Inside a phase, work on your own: build, test, fix, deploy a preview.
- At the end of each phase, show me the preview link and a short checklist, then wait for my OK before starting the next phase.

**Accounts and secrets:**
- You run in the cloud and **cannot log into my accounts** (Google, Meta, Supabase, Vercel).
- Whenever an account, key or setting is needed, give me numbered click-by-click steps. I'll do it and paste the values back.
- Never hard-code secrets. Everything goes in environment variables.

**Honesty:**
- Never invent data in the real app. Demo data is allowed only behind a "Load demo data" switch that is off in production.

---

## 1. What we're building

Growthify Agency is a Pakistani technology agency. It builds custom software, AI solutions and automation, and sells the Official WhatsApp Business API and Meta ads management (some services are monthly subscriptions).

**Growthify OS** is our private, internal portal for running the agency:
- clients and leads
- projects and delivery
- monthly subscriptions (recurring revenue)
- payments, transactions, invoices and expenses
- the team (employees, salaries)
- our social media growth (Facebook, Instagram, YouTube, Threads, later LinkedIn), pulled in automatically through official APIs
- settings, users and permissions

v1 is internal only. A client-facing portal may come later, so keep the data model ready for it.

---

## 2. Design direction (most important part)

**Layout and style:** copy the structure of the **BankDash** dashboard UI kit (Figma community file). Screenshots are in `reference-bankdash/`:

| File | Use it as the pattern for |
|---|---|
| `01-overview-dashboard.jpg` | **Overview** page: cards row, bar chart, pie/donut, list, area chart |
| `02-transactions.jpg` | **Payments & Transactions**: tabs (All / Income / Expense), table, outline pill "Download" buttons, pagination |
| `03-accounts.jpg` | **KPI stat cards** (round tinted icon + label + value) and "last transactions" rows |
| `04-investments.jpg` | **Social** page: KPI cards, line charts, list with icons, ranked table |
| `05-credit-cards-forms.jpg` | **Forms in cards** (2-column inputs, primary button) and the settings list with icons |
| `06-loans-table.jpg` | **Subscriptions** table with a red **Total** row and outline action buttons |
| `07-services-list.jpg` | **Projects / Services** list: one row-card per item with icon, columns, "View Details" |
| `08/09/10-settings-*.jpg` | **Settings** with tabs (Edit Profile / Preferences / Security), toggles, Save button |
| `11-mobile-dashboard.jpg` | **Mobile** behaviour: hamburger, stacked cards, search under the header |

**Colours and brand: Growthify, not BankDash blue.** The target look is `reference-target/growthify-os-styleframe-overview.png`. Match it.

### 2.1 Measurements (desktop 1440 px, from BankDash)

**Shell:**
- **Sidebar:** 250 px wide.
  - Logo area at the top.
  - Nav items 56 px tall, icon 22 px plus label, 38 px left padding.
  - Active item: 6 px rounded accent bar on the left edge, plus accent-coloured icon and text.
- **Top bar:** 100 px tall. Contains:
  - page title (28 px, weight 700)
  - pill search (≈300×50, fully rounded)
  - two 50 px round icon buttons (settings, notifications)
  - 56 px round avatar
- **Content:** 40 px side padding, 26–30 px gap between cards. Section headings 21–22 px, weight 700, sitting *above* each card (BankDash style).

**Cards and controls:**
- **Cards:** radius **20 px**, 22–24 px padding, 1 px subtle border.
- **KPI card:** round icon (58 px, accent tint at 13% opacity), then label (13.5 px), value (22 px, weight 800, tabular numbers) and a delta line (12 px, success colour).
- **Tables:**
  - Header row in secondary text colour, rows 52 px tall, 1 px row dividers.
  - Amounts coloured: + in success, − in danger.
  - Status as small pills.
  - Row actions as **outline pill buttons**.
- **Inputs:** 50 px tall, radius 12–15 px, 1 px border. Label above in 15 px. Primary buttons are solid, radius 12–15 px, 50 px tall.
- **Toggles:** BankDash style; the "on" state uses the accent colour.

**Charts (Recharts):**
- Bars: rounded caps, 2 series max.
- Area/line: 3 px line with a gradient fill fading to 0.
- Donut: centre label.
- Gridlines dashed, very low contrast.

### 2.2 Colour tokens

Dark is the default theme, matching our brand. Add a light theme toggle in Settings → Preferences.

```css
:root[data-theme="dark"] {
  --bg: #0A1C14;        /* page background */
  --sidebar: #06140E;   /* sidebar + top bar (matches logo background) */
  --surface: #0F2B20;   /* cards */
  --surface-2: #133526; /* hover, inputs */
  --border: #1C3D2E;
  --text: #FFFFFF;
  --text-2: #A9BDB2;    /* secondary text */
  --muted: #6E8A7C;     /* inactive nav, axis labels */
  --accent: #C8FF40;    /* Growth Lime: active nav, primary button, highlights */
  --accent-ink: #07150F;/* text on lime */
  --success: #3DDC97;
  --danger: #EE5B3E;
  --warning: #F5B841;
}
:root[data-theme="light"] {
  --bg: #F4F7F5; --sidebar: #FFFFFF; --surface: #FFFFFF; --surface-2: #EEF3F0;
  --border: #E3ECE7; --text: #07150F; --text-2: #5B6E64; --muted: #8FA39A;
  --accent: #C8FF40; --accent-ink: #07150F;  /* lime only as a fill with dark text, never as text on white */
  --primary-solid: #0F2B20;                  /* buttons/active text on light */
  --success: #12A877; --danger: #E5482A; --warning: #D99A16;
}
```

**Chart palette:** accent lime, then `#3DDC97`, `#FFFFFF` (or `#0F2B20` on light), then `#4E7A64`. Use the danger colour only for negative values or alerts.

### 2.3 Typography

- **Montserrat** everywhere, loaded locally (e.g. `@fontsource/montserrat` or `next/font`).
  - Weights: 500 for body, 600 for labels/nav, 700 for headings, 800 for KPI values.
  - Use `font-variant-numeric: tabular-nums` for all money and number columns.
- Type scale, adapted from BankDash's Inter scale:

| Use | Size |
|---|---|
| Page title | 28 px |
| Section heading | 22 px |
| Card title | 18 px |
| Body | 15–16 px |
| Small | 13 px |
| Buttons | 15 px |

- Optional: **Anton** for the login-screen headline only.

### 2.4 Brand assets (in `brand/`)

- `growthify-logo-on-dark.png` for the sidebar (dark theme).
- `growthify-logo-on-light.png` for the light theme.
- `growthify-icon.png` for the favicon, app icon and default avatar.
- `growthify-symbol.svg` as a scalable icon.
- Always use these **final bright-lime** files. Never recolour, redraw or use a faded or pale version.

### 2.5 Quality bar

- It must look like a premium SaaS product: clean, consistent spacing, no default shadcn look, no AI-looking gradients or glows.
- Fully responsive:
  - Desktop 1440.
  - Tablet 1024: sidebar collapses to icons.
  - Mobile 375: hamburger drawer, cards stacked, tables become row-cards.
- Every list has empty states, loading skeletons and error states.
- Keyboard accessible, with visible focus rings in the accent colour. Text contrast at least WCAG AA.

---

## 3. Tech stack (decided; don't change without asking)

| Area | Choice |
|---|---|
| App | **Next.js (App Router, latest stable) + TypeScript** |
| UI | **Tailwind CSS** + **shadcn/ui (Radix)** restyled to the tokens above, **lucide-react** icons, **Recharts**, **TanStack Table**, **React Hook Form + Zod** |
| Backend | **Supabase**: Postgres, Auth (Google), Storage (receipts, files, logos), **Row Level Security on every table** |
| Hosting | **Vercel**. **Vercel Cron** for daily social-stats sync and renewal checks |
| PDF invoices | `@react-pdf/renderer` (branded) |
| Secrets | Vercel / Supabase environment variables only. OAuth tokens **encrypted at rest** (AES-256-GCM with `TOKEN_ENCRYPTION_KEY`), decrypted server-side only, never sent to the browser |

---

## 4. Login and access

- **Sign in with Google only** (Supabase Auth Google provider).
- **Allowlist:**
  - Only emails in the `team_members` table can enter. Anyone else sees "Access not granted".
  - The first owner comes from env `OWNER_EMAILS` (start with `bymegrowthify@gmail.com`).
- **Roles:**

| Role | Access |
|---|---|
| **Owner** | everything |
| **Manager** | everything except billing settings, deleting financial records and managing users |
| **Staff** | only their assigned projects and tasks, and their own profile. **No** finance pages |

- Enforce roles in **RLS policies**, not only in the UI.
- **Activity log:** record who created, edited or deleted what, and when, for clients, projects, money and settings.

---

## 5. Modules (sidebar order) and what each must do

### 5.1 Overview (pattern: `01-overview-dashboard`; target: the style frame)

**KPI row:**
- **MRR:** sum of active monthly subscriptions, in PKR.
- **Revenue this month:** income transactions.
- **Outstanding:** unpaid invoices plus overdue renewals, with a count.
- **Active clients.**
- Each KPI shows its change vs last month.

**Charts:**
- Revenue vs Expenses: last 12 months, bars.
- Revenue by Service: donut, this month.
- Cash Balance: running income minus expense, area chart.

**Lists:**
- Recent transactions (5).
- **Upcoming renewals** (next 7 days, plus overdue in red).
- Active projects with progress.
- **Social Growth:** followers per platform, plus change in the last 7 days.

### 5.2 Clients (pattern: `03-accounts` for KPIs, `07-services-list` for rows)

**Fields:**
- business name, contact person, phone/WhatsApp, email, city, country
- niche/industry (real estate, travel & visa, clinic, academy, e-commerce, other)
- source (Meta ad, organic, referral, LinkedIn, other)
- status (active / paused / former), notes, logo, tags

**Client detail page tabs:** Overview, Projects, Subscriptions, Invoices & Payments, Files, Activity.

**Actions:**
- Add, edit, archive.
- **"Open WhatsApp chat"** button using a `https://wa.me/<number>` link. It opens WhatsApp only; the app never sends automatically.

### 5.3 Leads (pipeline)

- Kanban board: **New → Contacted → Proposal sent → Negotiation → Won / Lost**. Drag and drop between stages.
- Fields: name, business, phone, source, service interested, estimated value (PKR), next follow-up date, notes.
- "Convert to client" (creates the client and optionally a project).
- Follow-ups due today appear on the Overview.

### 5.4 Projects (pattern: `07-services-list`)

**Fields:**
- client, title
- service type: Custom Software / AI & Automation / Web & App / WhatsApp API Setup / Ads Management / Other
- contract value + currency (PKR default, USD allowed), start date, deadline
- status: Planning → In progress → Review → Delivered → On hold
- progress %, assigned team members, links (repo, staging, live), files

**Milestones:** name, amount, due date, paid / unpaid. Marking a milestone paid creates an income transaction.

**Tasks:** a simple per-project checklist with assignee and due date.

### 5.5 Subscriptions (pattern: `06-loans-table`, including the red Total row)

- **Plans catalog:** e.g. "WhatsApp API: Monthly", "Meta Ads Management: Monthly". Each plan has a name, amount and currency.
- **Subscription fields:** client, plan, amount (overridable), billing day, start date, **next due date**, status (active / paused / cancelled), notes.
- **"Mark paid"** (one click):
  - records the income transaction (method, reference, receipt upload)
  - moves the next due date forward one month
- Overdue rows are highlighted in danger colour.
- The Total row shows the MRR.

### 5.6 Payments & Transactions (pattern: `02-transactions`)

- Tabs: **All / Income / Expense**. Filters for date range, client, project, category and method. Export to CSV.
- **Transaction fields:**
  - type (income / expense), amount, currency, date
  - category:
    - income: project, subscription, other
    - expense: salary, hosting/servers, software & API, ads spend, office, other
  - method: bank transfer, JazzCash, Easypaisa, cash, card, Payoneer, Wise, other
  - reference/TID, linked client / project / subscription / employee, receipt file, notes
- **"Download receipt"** outline pill on rows that have a receipt.

### 5.7 Invoices

- Invoice number `GA-YYYY-0001`. Client, line items, discount, tax (optional), total, currency, issue date, due date.
- Status: Draft / Sent / Paid / Overdue.
- **Branded PDF** with Growthify logo and colours, bank/payment details from Settings, and notes.
- Actions:
  - "Mark paid" (creates the transaction)
  - "Share on WhatsApp" (a wa.me link with a short pre-filled message and the PDF link)

### 5.8 Team

- **Employee fields:** name, role, email, phone, joining date, monthly salary (PKR), status, assigned projects.
- Salary payments: "Pay salary" creates an expense transaction.
- An employee with a `team_members` login can see only their own tasks and projects (role Staff).

### 5.9 Social (pattern: `04-investments`). Details in Section 6.

- **KPI cards:** total followers across platforms, followers gained in 30 days, reach / views in 30 days.
- **Per-platform card:** avatar, name/handle, followers, change, last sync time, status (Connected / Needs reconnect).
- **Charts:** followers over time (line) per platform, and reach / views per day.
- **Table:** latest posts/videos with views and engagement, if the API provides them.
- **Buttons:** "Connect", "Reconnect", "Sync now".

### 5.10 Settings (pattern: `08/09/10-settings`)

| Tab | Contents |
|---|---|
| **Company profile** | name, logo, email, phone, city, address, payment/bank details for invoices |
| **Preferences** | currency (PKR default), timezone (Asia/Karachi), theme (dark/light), notification toggles |
| **Security** | active sessions, sign out everywhere |
| **Team & roles** | invite by Google email, change role, remove |
| **Integrations** | social connections (Section 6), token health |
| **Services & plans catalog** | the service and plan lists used elsewhere |

---

## 6. Social integrations (official APIs only, read-only)

General rules:
- **Connecting** a social account is separate from **logging into** the app.
- Each "Connect" button opens the platform's own login and account chooser in a popup or redirect. Ahmad picks the account there.
- The server exchanges the code, then stores the tokens encrypted in `social_accounts`.
- A **daily cron (03:00 Asia/Karachi)** pulls metrics into `social_metrics_daily`. A "Sync now" button does the same on demand.
- If a token fails, mark the account **Needs reconnect** and show it on the Overview.
- **Before coding each integration, read the current official docs and confirm the endpoints, metric names and permissions.** Meta in particular renamed and deprecated several metrics in 2025 (for example, Instagram "impressions" was replaced by "views"). Use only metrics that exist now.

### 6.1 YouTube

- **Google Cloud project:**
  - Enable **YouTube Data API v3** and **YouTube Analytics API**.
  - OAuth consent screen, user type External.
  - Scopes: `youtube.readonly`, `yt-analytics.readonly`.
- **Connect flow:**
  - Use `access_type=offline` and `prompt=select_account consent`, so the Google account chooser always shows and we get a refresh token.
  - Use a separate redirect URI from app login.
- **Important:** set the OAuth app's publishing status to **"In production"**.
  - In "Testing" status, refresh tokens expire after 7 days and the connection keeps breaking.
  - An "unverified app" warning is acceptable for our own internal use.
- **Data:**
  - `channels.list` (part=snippet,statistics, mine=true): subscribers, views, video count.
  - YouTube Analytics, daily: views, estimated minutes watched, subscribers gained/lost.
  - Latest videos with view counts.

### 6.2 Facebook Page and Instagram (Meta Graph API)

**Two ways to connect.** Build both and recommend option A:

- **A. System User token (recommended).** No personal Facebook login needed in the Growthify browser.
  - In Meta Business Settings → **System users**, Ahmad creates a system user and assigns it the Growthify Page and Instagram account.
  - He generates a token with: `pages_show_list`, `pages_read_engagement`, `read_insights`, `instagram_basic`, `instagram_manage_insights`, `business_management`.
  - He pastes the token into Settings → Integrations. The app validates it and lists the Page and IG account it can see.
- **B. "Connect with Facebook" (OAuth)**, with the same permissions.
  - The Meta app can stay in **Development mode**: app admins/testers can grant these permissions without App Review because only we use it.
  - Exchange for a long-lived token, then fetch Page tokens and the linked `instagram_business_account`.

**Data:**
- Page: followers / fan count, plus available Page insights (reach / views, engagement).
- Instagram: followers_count, media_count, account insights (reach / views, profile views), recent media with metrics.

### 6.3 Threads

- Use the Meta app with the **Threads API** use case.
- OAuth via Threads authorization with `threads_basic` and `threads_manage_insights`.
- While the app is in development, add the Threads account as a tester.
- Data: user insights (followers_count, views), recent threads with metrics.

### 6.4 LinkedIn and TikTok (later)

- LinkedIn company page statistics need LinkedIn's Community Management API, which requires LinkedIn approval.
- **v1:** a manual "Add today's follower count" entry for LinkedIn (and TikTok), stored as daily snapshots so they still appear in charts.
- Leave a clean adapter interface so real APIs can be plugged in later.

### 6.5 Our accounts (seed into Settings → Integrations as "not connected")

| Platform | Account |
|---|---|
| Facebook Page | https://www.facebook.com/GrowthifyAgencypk |
| Instagram | @growthifyagencypk |
| YouTube | @growthifyagencypk |
| Threads | @growthifyagencypk |
| LinkedIn | company page not created yet (manual entry for now) |

---

## 7. Data model (Postgres / Supabase; all tables have `id uuid`, `created_at`, `updated_at`, `created_by`)

| Table | Columns |
|---|---|
| `team_members` | user_id, email, name, role (owner / manager / staff), avatar_url, active |
| `clients` | business_name, contact_name, phone, whatsapp, email, city, country, niche, source, status, tags[], notes, logo_url |
| `leads` | name, business, phone, source, service_interest, est_value, currency, stage, next_follow_up, notes, converted_client_id |
| `services` | catalog: name, type, default_price, currency, is_recurring |
| `projects` | client_id, title, service_type, value, currency, start_date, deadline, status, progress, links jsonb, notes |
| `project_members` | project_id, team_member_id |
| `milestones` | project_id, name, amount, due_date, paid, paid_tx_id |
| `tasks` | project_id, title, assignee_id, due_date, done |
| `plans` | name, amount, currency, interval ('month') |
| `subscriptions` | client_id, plan_id, amount, currency, billing_day, start_date, next_due_date, status, notes |
| `invoices` | number, client_id, project_id?, issue_date, due_date, status, currency, subtotal, discount, tax, total, notes, pdf_url |
| `invoice_items` | invoice_id, description, qty, unit_price, amount |
| `transactions` | type, amount, currency, date, category, method, reference, client_id?, project_id?, subscription_id?, invoice_id?, employee_id?, receipt_url, notes |
| `employees` | name, role, email, phone, joined_on, salary, currency, status, team_member_id? |
| `social_accounts` | platform, external_id, name, handle, avatar_url, token_encrypted, refresh_token_encrypted, token_expires_at, scopes[], status, last_synced_at, connected_by |
| `social_metrics_daily` | social_account_id, date, followers, reach, views, engagement, extra jsonb; unique (account, date) |
| `activity_log` | actor_id, entity, entity_id, action, diff jsonb |
| `settings` | single row: company profile, invoice/payment details, preferences |
| `files` | entity, entity_id, path, name, size |

**Money rules:**
- Store amounts as integer minor units (paisa / cents) plus a currency code.
- Dashboards report in **PKR**. Show USD separately; don't silently convert.

---

## 8. Business facts to seed

- **Company:** Growthify Agency, Faisalabad, Pakistan. Timezone Asia/Karachi. Currency PKR.
- **Positioning line:** "We build the systems your business runs on."
- **Services catalog:**
  - Custom Software Development
  - AI Solutions & Automation
  - Web & App Development
  - WhatsApp Business API (monthly)
  - Meta Ads Management (monthly)
  - TikTok Ads (monthly)
- **Contact email:** bymegrowthify@gmail.com. WhatsApp API number +92 321 6312898 (internal setting; not printed on public documents unless I add it).
- **Rule:** our WhatsApp API software vendor's name must **never** appear anywhere in the UI, PDFs or exports. Always say "Growthify WhatsApp API".
- Don't put real client or financial data in seed files. Real data is entered through the app.

---

## 9. Phases (show me a preview and wait for my OK after each)

**Phase 0: Foundation**
- Repo, Next.js app, Tailwind tokens (dark + light), Montserrat, brand assets.
- App shell matching the style frame: sidebar, top bar, responsive drawer.
- Supabase project, Google login with allowlist, roles, RLS base, activity log. Deploy to Vercel.
- **Done when:** I can sign in with Google on the Vercel URL, an unlisted email is blocked, and the shell looks like the style frame on desktop and mobile.

**Phase 1: Clients, Leads, Projects**
- Full CRUD with milestones and tasks, the pipeline board, and client detail tabs.
- **Done when:** I can add a lead, convert it to a client, create a project with milestones, and see it all on the client page.

**Phase 2: Money**
- Plans, subscriptions with "Mark paid", transactions, invoices with branded PDF, receipts upload, CSV export.
- Overview KPIs and charts on real data.
- **Done when:** MRR, revenue, outstanding and the charts on the Overview match the records I entered.

**Phase 3: Team and Settings**
- Employees, salary payments, team invites and roles, company profile, preferences, theme toggle.

**Phase 4: Social**
- YouTube OAuth, Meta (system user token + OAuth), Threads, LinkedIn/TikTok manual entry.
- Daily cron, Social page, token-health warnings.
- **Done when:** after I connect, follower counts match the real profiles and a daily snapshot is stored.

**Phase 5: Polish**
- Global search (clients, projects, invoices).
- Notifications (renewals due, follow-ups due, overdue invoices).
- Empty, loading and error states everywhere. Mobile QA. Performance (Lighthouse at least 90 on desktop).

---

## 10. Setup steps I'll do myself (you give me exact click-by-click guides when we reach them)

1. GitHub repo (connected to this Claude Code session).
2. **Supabase** project. Send me where to find the URL, anon key and service role key.
3. **Vercel** project linked to the repo, plus environment variables.
4. **Google Cloud:**
   - OAuth client for app login (Supabase redirect URL).
   - YouTube APIs enabled with their own OAuth redirect.
   - Consent screen set to In production.
5. **Meta:**
   - System user token from the Growthify business portfolio (option A).
   - Meta developer app for OAuth (option B) and the Threads API.
6. A custom domain later (e.g. `os.<our-domain>`).

**Environment variables to document in `.env.example`:**
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `OWNER_EMAILS`
- `TOKEN_ENCRYPTION_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI`
- `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`
- `THREADS_APP_ID`, `THREADS_APP_SECRET`, `THREADS_REDIRECT_URI`
- `CRON_SECRET`

---

## 11. Files in this folder

| Path | What it is |
|---|---|
| `BUILD-BRIEF.md` | this brief |
| `reference-target/growthify-os-styleframe-overview.png` | **the target look** (Growthify colours on BankDash layout, sample data) |
| `reference-bankdash/01…11-*.jpg` | BankDash pages to copy layout and components from |
| `brand/` | final logos and icon |
| `styleframe.html` | the style frame source (HTML/CSS), for exact spacing and colours |
