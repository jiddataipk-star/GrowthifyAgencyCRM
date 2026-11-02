# Growthify OS

Private operating system for **Growthify Agency** (Faisalabad, Pakistan): clients and leads, projects and delivery, monthly subscriptions, payments, invoices, expenses, team salaries and social-media growth — in one place, built for how a Pakistani agency actually works.

> Setup on your own accounts (Supabase, Google, Vercel, Meta): **[docs/SETUP.md](docs/SETUP.md)** — numbered, click-by-click.
> Original brief and design references: [docs/brief/](docs/brief/BUILD-BRIEF.md).

---

## What's inside

| Module | Highlights |
|---|---|
| **Overview** | MRR, revenue this month, outstanding (unpaid invoices + overdue renewals), active clients — each vs last month. Revenue vs expenses (12 months), revenue by service (donut), cash balance (area), recent transactions, upcoming renewals (overdue in red, one-tap WhatsApp reminder), active projects with progress, social growth, follow-ups due today. |
| **Clients** | Row-card list with filters, KPIs, archive/restore. Detail tabs: Overview, Projects, Subscriptions, Invoices & Payments, Files, Activity. **Open WhatsApp chat** (`wa.me`, never sends automatically). |
| **Leads** | Kanban New → Contacted → Proposal sent → Negotiation → Won / Lost with drag & drop (mouse, touch, keyboard). Convert to client (+ optional first project). |
| **Projects** | Status, progress, links, team. **Milestones** (marking one paid records the income), task checklist, files. Staff see only their projects. |
| **Subscriptions** | Plans catalog, one-click **Mark paid** (records income with method/TID/receipt and moves the next due date by one cycle, month-end safe). Overdue rows in red, red **Total MRR** row, WhatsApp payment reminders. |
| **Payments** | All / Income / Expense tabs, filters (dates, client, project, category, method, currency), CSV export, receipt download. |
| **Invoices** | `GA-YYYY-0001` numbering (never reused), line items, discount, sales tax, **branded PDF**, partial payments, **tax withheld at source (WHT)**, void, public share link, **Share on WhatsApp**. |
| **Team** | Employees, salary status for the last 6 months, **Pay salary** (refuses to pay the same month twice). |
| **Social** | YouTube, Facebook Page, Instagram, Threads via official APIs (read-only); LinkedIn/TikTok manual snapshots. Daily sync at 03:00 PKT, Sync now, "Needs reconnect" alerts, follower and views charts, latest posts table. |
| **Settings** | Company profile, owner-only billing (bank, IBAN, JazzCash/Easypaisa/Raast, NTN/STRN), preferences + theme, active sessions / sign out everywhere, team & roles, integrations + token health, services & plans, activity log. |
| **Everywhere** | Global search (Ctrl/⌘ K), live notifications, empty/loading/error states, dark (default) + light theme, responsive 1440 → 1024 (icon rail) → 375 (drawer, row-cards), keyboard focus rings, WCAG AA text contrast. |

### Built for Pakistan

- **PKR first**, USD tracked separately and never silently converted. Money stored as integer paisa/cents.
- **Asia/Karachi everywhere**: "today", due dates and renewals use Pakistan time even though servers run in UTC.
- **Local payment methods**: bank transfer (IBFT), Raast, JazzCash, Easypaisa, cheque, cash, card, Payoneer, Wise — each payment keeps its TID/reference and receipt.
- **Withholding tax**: corporate clients often deduct income tax at source; invoices settle with *cash received + tax withheld*, so books show the real cash.
- **WhatsApp-native**: phone numbers in any local format (`0321-…`, `+92 …`, `0092…`) become correct `wa.me` links; reminders and invoices are pre-written ("Assalam o Alaikum …").
- **No foreign payment gateways** (Stripe/PayPal aren't available to Pakistani businesses): payments are recorded manually with proof, which matches how clients actually pay.
- Fiscal-year helper (July–June), NTN/STRN on invoices, Pakistani city suggestions.
- Our WhatsApp API vendor's name never appears anywhere — always **Growthify WhatsApp API**.

---

## Stack

Next.js 16 (App Router, Cache Components, Server Actions) · TypeScript · Tailwind CSS v4 with Radix primitives restyled to the Growthify tokens · lucide-react · Recharts · TanStack Table · React Hook Form + Zod · dnd-kit · Supabase (Postgres, Auth with Google, Storage, Row Level Security) · `@react-pdf/renderer` · Vercel + Vercel Cron.

## Security model

- **Google sign-in only**, plus an allowlist (`team_members`). The first owner comes from `OWNER_EMAILS`. Only Google identities can claim an allowlisted email (checked in the database).
- **Roles enforced in Postgres RLS**, not just the UI: Owner (everything) · Manager (everything except billing settings, deleting financial records, managing users) · Staff (only assigned projects/tasks + own profile, no finance).
- Column guards in triggers: only owners change roles/billing; staff can't change a project's commercial fields; the last owner can't be removed.
- **Activity log** written by database triggers for clients, leads, projects, milestones, subscriptions, plans, invoices, transactions, employees, settings, team and integrations.
- **OAuth tokens encrypted at rest** (AES-256-GCM, `TOKEN_ENCRYPTION_KEY`), decrypted only on the server; the token columns aren't even readable through the API role.
- Money operations (mark paid, salary, lead conversion, invoice save/payments) are single database transactions. Invoice totals, numbering and paid status are computed by triggers, so they can't drift.
- Private storage buckets with RLS; downloads use 60-second signed URLs. Public invoice links use an unguessable, revocable token and never expose drafts.
- CSV export neutralises spreadsheet formulas; security headers; the app is `noindex`.

Known trade-off: staff assigned to a project can read that project's contract value through the API (the UI hides it). Milestones, payments, invoices and salaries are fully hidden from staff.

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
| `npm test` | Unit tests (money, dates, phones, crypto, CSV, invoice math) |
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
    api/              PDF, CSV export, signed downloads, search, OAuth connect/callback, cron
    auth/, login/     Google sign-in, callback (allowlist + owner bootstrap), access denied
    i/[token]/        public invoice PDF (share link)
  components/
    ui/               design-system primitives (button, form, card, dialog, pills, feedback…)
    shell/            sidebar, mobile drawer, top bar, search, notifications, theme
    charts/           Recharts wrappers (bars, area, lines) + SVG donut
    app/              shared domain pieces (payment dialog, uploads, files, activity, toolbar)
  lib/
    supabase/         server / browser / admin clients
    social/           platform adapters (YouTube, Meta, Threads), sync, OAuth state
    pdf/              branded invoice document
    data/             query helpers and loaders
    action.ts         Server Action wrapper (auth, role, Zod, friendly DB errors)
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
