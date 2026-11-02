# Growthify OS

Private operating system for **Growthify Agency** (Faisalabad, Pakistan): clients and leads, projects and delivery, WhatsApp API clients, subscriptions, money to collect, every rupee in and out, team salaries and social-media growth — in one place, built for how a Pakistani agency actually works.

> Setup on your own accounts (Supabase, Google, Vercel, Meta): **[docs/SETUP.md](docs/SETUP.md)** — numbered, click-by-click.
> Original brief and design references: [docs/brief/](docs/brief/BUILD-BRIEF.md).

---

## What's inside

| Module | Highlights |
|---|---|
| **Overview** | **This month** band: collected, spent, **profit** (and margin), to collect — vs the same days last month, plus last month's totals. Money in vs money out with profit line (12 months), where the money went (by category), **to collect next** (overdue in red, one-tap WhatsApp reminder, Mark paid), **top paying clients** (12 months), latest transactions, WhatsApp API summary, active projects, follow-ups, social growth. |
| **Collections** | Everyone who owes us money in one list: manual entries ("Rehan — logo — PKR 15,000 by 5 Nov"), project instalments and subscription renewals. **Mark paid** (full or part; short payments can be **settled with a discount**), **Cancel payment** (with reason, can be reopened), WhatsApp reminder with our bank/wallet details. Collected and Cancelled history tabs. |
| **Transactions** | Every payment in and out with **who paid (name on the SMS), date and time, method, TID/reference, what it was for, optional screenshot**. Filters (dates, client, project, category, method, currency), CSV export. Deleting a payment reopens what it paid. |
| **WhatsApp API** | Growthify WhatsApp API clients on **1 month / 3 months / 1 year** prepaid plans: add client + first payment in one step, renewal status, lapsed clients in red, Mark paid renews for the same period, paid-so-far per client, recent payments. |
| **Subscriptions** | All prepaid plans (WhatsApp API, ads management, hosting…). Mark paid moves the renewal by one period (month-end safe). A lapsed plan counts as **one** renewal to collect, not every missed month. |
| **Clients** | Row-card list with filters, KPIs, archive/restore. Detail tabs: Overview (paid to us, to collect, MRR), Projects, Subscriptions, Payments, Files, Activity. **Open WhatsApp chat** (`wa.me`, never sends automatically). |
| **Leads** | Kanban New → Contacted → Proposal sent → Negotiation → Won / Lost with drag & drop (mouse, touch, keyboard). Convert to client (+ optional first project). |
| **Projects** | Status, progress, links, team, **payment schedule** (e.g. 50% advance / 50% on delivery — each part appears in Collections), task checklist, files. Staff see only their projects. |
| **Team** | Employees, salary status for the last 6 months, **Pay salary** (refuses to pay the same month twice). |
| **Social** | YouTube, Facebook Page, Instagram, Threads via official APIs (read-only); LinkedIn/TikTok manual snapshots. Daily sync at 03:00 PKT, Sync now, "Needs reconnect" alerts, follower and views charts, latest posts table. |
| **Settings** | Company profile, **payment details** (owner only: bank, account title, IBAN, JazzCash/Easypaisa/Raast — added to every reminder, with a live preview), preferences, active sessions / sign out everywhere, team & roles, integrations + token health, services & plans, activity log. |
| **Everywhere** | Global search (Ctrl/⌘ K), live notifications, empty/loading/error states, responsive 1440 → 1024 → 375 (drawer, phone card lists), keyboard focus rings, WCAG AA text contrast. |

### Design

White canvas, black type, deep Growthify green (`#0b3d2c`) for brand, actions and key numbers, a dark green frame (sidebar, This-month band); **red only for alerts and anything wrong** (overdue, lapsed, negative profit, errors). Fonts: **Plus Jakarta Sans** for headings and numbers, **Inter** for text (self-hosted, tabular figures for money). Tokens live in `src/app/globals.css`.

### Built for Pakistan

- **No formal invoices**: clients here pay by bank transfer, Raast or JazzCash/Easypaisa after a WhatsApp message, not through an invoice portal. So the system tracks *who has to pay what by when* (Collections) and records the actual payment with its proof.
- **PKR first**, USD tracked separately and never silently converted. Money stored as integer paisa/cents.
- **Asia/Karachi everywhere**: "today", due dates and renewals use Pakistan time even though servers run in UTC.
- **Local payment methods**: bank transfer (IBFT), Raast, JazzCash, Easypaisa, cash, cheque, card, Payoneer, Wise — each payment keeps the payer's name, time, TID and optional screenshot.
- **Short payments are normal**: settle with a discount (kept visible as an adjustment) or keep the rest open.
- **WhatsApp-native**: phone numbers in any local format (`0321-…`, `+92 …`, `0092…`) become correct `wa.me` links; reminders are pre-written ("Assalam o Alaikum … JazakAllah") and include our account details.
- **Real expense categories**: salaries, freelancers, office rent, bills (electricity, internet, mobile), software & AI tools, ads spend, petrol & travel, office & refreshments, tax (FBR/PRA).
- **No foreign payment gateways** (Stripe/PayPal aren't available to Pakistani businesses): payments are recorded manually with proof, which matches how clients actually pay.
- Fiscal-year helper (July–June), Pakistani city suggestions.
- Our WhatsApp API vendor's name never appears anywhere — always **Growthify WhatsApp API**.

---

## Stack

Next.js 16 (App Router, Cache Components, Server Actions) · TypeScript · Tailwind CSS v4 with Radix primitives restyled to the Growthify tokens · lucide-react · Recharts · TanStack Table · React Hook Form + Zod · dnd-kit · Supabase (Postgres, Auth with Google, Storage, Row Level Security) · Vercel + Vercel Cron.

## Security model

- **Google sign-in only**, plus an allowlist (`team_members`). The first owner comes from `OWNER_EMAILS`. Only Google identities can claim an allowlisted email (checked in the database).
- **Roles enforced in Postgres RLS**, not just the UI: Owner (everything) · Manager (everything except payment-details settings, deleting financial records, managing users) · Staff (only assigned projects/tasks + own profile, no finance).
- Column guards in triggers: only owners change roles and payment details; staff can't change a project's commercial fields; the last owner can't be removed.
- **Activity log** written by database triggers for clients, leads, projects, payments to collect, subscriptions, plans, transactions, employees, settings, team and integrations.
- **OAuth tokens encrypted at rest** (AES-256-GCM, `TOKEN_ENCRYPTION_KEY`), decrypted only on the server; the token columns aren't even readable through the API role.
- Money operations (mark paid, settle, start subscription, salary, lead conversion) are single database transactions. What is still owed and the paid/partial/overdue status are computed by triggers from the linked payments, so they can't drift.
- Private storage buckets with RLS; payment screenshots and files download through 60-second signed URLs.
- CSV export neutralises spreadsheet formulas; security headers; the app is `noindex`.

Known trade-off: staff assigned to a project can read that project's contract value through the API (the UI hides it). Collections, transactions, subscriptions and salaries are fully hidden from staff.

---

## Run it locally

Requirements: Node 20.9+, Docker (for the local Supabase stack).

```bash
npm install
```

```bash
npm run db:start
```

Copy `.env.example` to `.env.local` and fill the values printed by `db:start` (`API URL`, `anon key`, `service_role key`), then generate the secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

```bash
npm run dev
```

Open http://localhost:3000. For local sign-in either enable Google in `supabase/config.toml` (see comments there) or run the end-to-end tests, which create test sessions without any backdoor in the app. Set `ALLOW_DEMO_DATA=true` locally to get **Settings → Team & roles → Load demo data**.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` · `npm run typecheck` | ESLint · route types + `tsc` |
| `npm test` | Unit tests (money, dates, phones, crypto, CSV, collections/renewal logic) |
| `npm run db:start` · `db:reset` | Local Supabase; reset re-applies all migrations |
| `npm run db:test` | pgTAP tests: allowlist, RLS per role, money functions |
| `npm run db:types` | Regenerate `src/types/database.ts` from the schema |
| `npm run test:e2e` | Browser flows against a running dev server + local Supabase |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, build and the database tests on every push and pull request.

---

## Project structure

```
src/
  app/
    (app)/            authenticated app: one folder per module (page + actions + client widgets)
    api/              CSV export, receipts and files (signed URLs), search, OAuth connect/callback, cron
    auth/, login/     Google sign-in, callback (allowlist + owner bootstrap), access denied
  components/
    ui/               design-system primitives (button, form, card, dialog, pills, feedback…)
    shell/            sidebar, mobile drawer, top bar, search, notifications
    charts/           Recharts wrappers (money in/out + profit, bars, lines) + SVG donut
    app/              shared domain pieces (payment dialog, uploads, files, activity, toolbar)
  lib/
    supabase/         server / browser / admin clients
    social/           platform adapters (YouTube, Meta, Threads), sync, OAuth state
    data/             query helpers and loaders
    action.ts         Server Action wrapper (auth, role, Zod, friendly DB errors)
    collections.ts    due / renewal state rules
    money.ts, dates.ts, phone.ts, crypto.ts, validation.ts, constants.ts
  proxy.ts            session refresh + sign-in redirect (Next 16 "proxy")
supabase/
  migrations/         schema + RLS, business functions, storage, business seed, demo loader
  tests/              pgTAP tests
tests/                unit (Vitest) and end-to-end (Playwright) tests
docs/                 SETUP.md and the original brief
```

## Adding a social platform later

Implement `SocialAdapter` in `src/lib/social/` (see `types.ts`), register it in `ADAPTERS` in `sync.ts`, and add connect/callback handling in `src/app/api/integrations/[platform]/`. LinkedIn and TikTok currently use manual daily snapshots and appear in all charts.
