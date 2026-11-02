import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, HandCoins, Plus } from "lucide-react";
import { requireFinance } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ilikeTerm, type SearchParams } from "@/lib/data/query";
import { loadFormOptions } from "@/lib/data/lookups";
import { DUE_STATE_LABELS, INTERVAL_LABELS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { addDays, dueLabel, formatDate, formatDayMonth, formatDateTime, monthStart, todayPK } from "@/lib/dates";
import { dueState, remaining, renewalLabel } from "@/lib/collections";
import { cn, param } from "@/lib/utils";
import { Card, KpiCard, Section } from "@/components/ui/card";
import { EmptyState, PageSkeleton } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { LinkTabs } from "@/components/ui/misc";
import { Pill, StatusPill } from "@/components/ui/pill";
import { ListToolbar } from "@/components/app/toolbar";
import { WhatsAppLink, paymentReminder } from "@/components/app/domain";
import { DueFormDialog, DueMenu, DuePayButton } from "./due-dialogs";
import { MarkPaidButton } from "../subscriptions/row-actions";
import type { Tables } from "@/types/db";

/** "Growthify WhatsApp API — 1 Month" already says the period; don't repeat it. */
function planName(name: string, months: number) {
  const period = INTERVAL_LABELS[months];
  return !period || name.toLowerCase().includes(period) ? name : `${name} · ${period}`;
}

export const metadata: Metadata = { title: "Collections" };

export default function CollectionsPage(props: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Collections searchParams={props.searchParams} />
    </Suspense>
  );
}

type Party = { business_name: string; contact_name: string | null; phone: string | null; whatsapp: string | null } | null;

type Row =
  | { kind: "due"; key: string; date: string; due: Tables<"dues"> & { clients: Party; projects: { title: string } | null } }
  | { kind: "renewal"; key: string; date: string; sub: Tables<"subscriptions"> & { clients: Party } };

async function Collections({ searchParams }: { searchParams: SearchParams }) {
  await requireFinance();
  const params = await searchParams;
  const supabase = await createClient();
  const today = todayPK();
  const view = ["collect", "collected", "cancelled"].includes(param(params.view) ?? "") ? param(params.view)! : "collect";
  const term = ilikeTerm(param(params.q))?.slice(1, -1).toLowerCase();
  const focus = param(params.due);
  const clientSelect = "business_name, contact_name, phone, whatsapp";

  const [pendingRes, renewalsRes, doneRes, collectedMonth, options, settings] = await Promise.all([
    supabase.from("dues").select(`*, clients(${clientSelect}), projects(title)`).eq("status", "pending").order("due_date"),
    supabase.from("subscriptions").select(`*, clients(${clientSelect})`).eq("status", "active").lte("next_due_date", addDays(today, 7)).order("next_due_date"),
    view === "collect"
      ? Promise.resolve({ data: [] as (Tables<"dues"> & { clients: Party; projects: { title: string } | null })[] })
      : supabase.from("dues").select(`*, clients(${clientSelect}), projects(title)`).eq("status", view === "collected" ? "paid" : "cancelled").order("updated_at", { ascending: false }).limit(100),
    supabase.from("transactions").select("amount, currency").eq("type", "income").gte("date", monthStart(today)),
    loadFormOptions(supabase),
    supabase.from("settings").select("company_name, bank_name, account_title, account_number, iban, jazzcash_number, easypaisa_number, raast_id, payment_notes").maybeSingle(),
  ]);
  if (pendingRes.error) throw pendingRes.error;
  const pending = pendingRes.data ?? [];
  const renewals = renewalsRes.data ?? [];

  const rows: Row[] = [
    ...pending.map((due) => ({ kind: "due" as const, key: `d-${due.id}`, date: due.due_date, due })),
    ...renewals.map((sub) => ({ kind: "renewal" as const, key: `s-${sub.id}`, date: sub.next_due_date, sub })),
  ]
    .filter((row) => {
      if (!term) return true;
      const text = row.kind === "due" ? `${row.due.title} ${row.due.clients?.business_name ?? row.due.payer_name} ${row.due.projects?.title ?? ""}` : `${row.sub.name} ${row.sub.clients?.business_name}`;
      return text.toLowerCase().includes(term);
    })
    .sort((a, b) => (a.key === `d-${focus}` ? -1 : b.key === `d-${focus}` ? 1 : a.date.localeCompare(b.date)));

  const amountOf = (row: Row) => (row.kind === "due" ? remaining(row.due) : row.sub.amount);
  const currencyOf = (row: Row) => (row.kind === "due" ? row.due.currency : row.sub.currency);
  const pkr = (list: Row[]) => list.filter((r) => currencyOf(r) === "PKR").reduce((s, r) => s + amountOf(r), 0);
  const overdue = rows.filter((r) => r.date < today);
  const thisWeek = rows.filter((r) => r.date >= today && r.date <= addDays(today, 7));
  const collected = (collectedMonth.data ?? []).filter((t) => t.currency === "PKR").reduce((s, t) => s + t.amount, 0);
  const details = settings.data ?? null;

  const addButton = <DueFormDialog clients={options.clients} projects={options.projects} trigger={<Button><Plus /> Add payment to collect</Button>} />;

  return (
    <div className="flex flex-col gap-7">
      <div className="grid grid-cols-2 gap-3 sm:gap-5 wide:grid-cols-4">
        <KpiCard icon={<HandCoins />} tone="accent" label="Total to collect" value={formatMoney(pkr(rows), "PKR")} sub={`${rows.length} open item${rows.length === 1 ? "" : "s"}`} />
        <KpiCard icon={<AlertTriangle />} tone="danger" label="Overdue" value={formatMoney(pkr(overdue), "PKR")} sub={overdue.length ? `${overdue.length} late — send a reminder` : "Nothing late"} subTone={overdue.length ? "danger" : "success"} />
        <KpiCard icon={<CalendarClock />} tone="warning" label="Due in next 7 days" value={formatMoney(pkr(thisWeek), "PKR")} sub={`${thisWeek.length} item${thisWeek.length === 1 ? "" : "s"}`} />
        <KpiCard icon={<CheckCircle2 />} tone="success" label="Collected this month" value={formatMoney(collected, "PKR")} sub="All income received" />
      </div>

      <Section title="Collections" description="Everyone who owes us money: manual payments, project instalments and subscription renewals." actions={addButton}>
        <LinkTabs
          param="view"
          className="mb-4"
          tabs={[
            { value: "collect", label: "To collect", count: rows.length },
            { value: "collected", label: "Collected" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
        {view === "collect" ? (
          <>
            <ListToolbar className="mb-4" searchPlaceholder="Search name or what it's for…" />
            {rows.length === 0 ? (
              <Card>
                <EmptyState icon={<HandCoins />} title={term ? "No matches" : "Nothing to collect"} description="Add who owes you what — it stays here until it's marked paid or cancelled." action={addButton} />
              </Card>
            ) : (
              <Card className="overflow-hidden p-0 sm:p-0">
                <ul className="divide-y divide-line">
                  {rows.map((row) => {
                    const isLate = row.date < today;
                    if (row.kind === "renewal") {
                      const sub = row.sub;
                      const phone = sub.clients?.whatsapp ?? sub.clients?.phone;
                      return (
                        <li key={row.key} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4", isLate && "bg-danger-tint/40")}>
                          <DateBadge date={row.date} today={today} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{sub.clients?.business_name}</p>
                            <p className="truncate text-[13px] text-muted">
                              <Pill tone="info" className="mr-1.5 align-middle">Renewal</Pill>
                              {planName(sub.name, sub.interval_months)}
                            </p>
                          </div>
                          <div className="w-full text-left sm:w-auto sm:text-right">
                            <p className={cn("tabular font-bold", isLate && "text-danger")}>{formatMoney(sub.amount, sub.currency)}</p>
                            <p className={cn("text-xs", isLate ? "font-semibold text-danger" : "text-muted")}>{renewalLabel(sub.next_due_date, today)}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <WhatsAppLink
                              variant="icon"
                              label="Send reminder on WhatsApp"
                              phone={phone}
                              message={paymentReminder({ contact: sub.clients?.contact_name, item: `${sub.name} renewal`, amount: sub.amount, currency: sub.currency, due: formatDayMonth(sub.next_due_date), details })}
                            />
                            <MarkPaidButton sub={sub} clientName={sub.clients?.business_name} />
                            <Link
                              href={sub.service_type === "whatsapp_api" ? "/whatsapp" : "/subscriptions"}
                              aria-label={`Manage ${sub.name}`}
                              title="Pause, cancel or edit the plan"
                              className="inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                            >
                              <ChevronRight className="size-5" />
                            </Link>
                          </div>
                        </li>
                      );
                    }
                    const due = row.due;
                    const state = dueState(due, today);
                    const payer = due.clients?.business_name ?? due.payer_name;
                    const phone = due.clients?.whatsapp ?? due.clients?.phone ?? due.payer_phone;
                    return (
                      <li key={row.key} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4", isLate && "bg-danger-tint/40", focus === due.id && "ring-2 ring-primary ring-inset")}>
                        <DateBadge date={row.date} today={today} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">
                            {due.client_id ? <Link href={`/clients/${due.client_id}`} className="hover:text-primary">{payer}</Link> : payer}
                          </p>
                          <p className="truncate text-[13px] text-muted">
                            {due.title}
                            {due.projects ? ` · ${due.projects.title}` : ""}
                            {due.amount_paid ? ` · ${formatMoney(due.amount_paid, due.currency)} received` : ""}
                          </p>
                        </div>
                        <div className="w-full text-left sm:w-auto sm:text-right">
                          <p className={cn("tabular font-bold", isLate && "text-danger")}>{formatMoney(remaining(due), due.currency)}</p>
                          <p className={cn("text-xs", isLate ? "font-semibold text-danger" : "text-muted")}>{state === "partial" ? "Part paid · " : ""}{dueLabel(due.due_date, today)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <WhatsAppLink
                            variant="icon"
                            label="Send reminder on WhatsApp"
                            phone={phone}
                            message={paymentReminder({ contact: due.clients?.contact_name ?? due.payer_name, item: due.title, amount: remaining(due), currency: due.currency, due: formatDayMonth(due.due_date), details })}
                          />
                          <DuePayButton due={due} payer={payer} />
                          <DueMenu due={due} clients={options.clients} projects={options.projects} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
          </>
        ) : (
          <HistoryList rows={doneRes.data ?? []} view={view as "collected" | "cancelled"} options={options} />
        )}
      </Section>
    </div>
  );
}

function DateBadge({ date, today }: { date: string; today: string }) {
  const late = date < today;
  const isToday = date === today;
  return (
    <div
      className={cn(
        "flex w-14 shrink-0 flex-col items-center rounded-xl border py-1.5 leading-none",
        late ? "border-danger/30 bg-white text-danger" : isToday ? "border-primary bg-primary text-white" : "border-line bg-white text-fg",
      )}
      aria-label={formatDate(date)}
    >
      <span className="text-[10.5px] font-semibold uppercase">{formatDayMonth(date).split(" ")[1]}</span>
      <span className="font-display tabular mt-0.5 text-lg font-bold">{formatDayMonth(date).split(" ")[0]}</span>
    </div>
  );
}

function HistoryList({
  rows,
  view,
  options,
}: {
  rows: (Tables<"dues"> & { clients: Party; projects: { title: string } | null })[];
  view: "collected" | "cancelled";
  options: Awaited<ReturnType<typeof loadFormOptions>>;
}) {
  if (!rows.length) {
    return (
      <Card>
        <EmptyState compact title={view === "collected" ? "Nothing collected yet" : "No cancelled payments"} description={view === "collected" ? "Fully paid requests appear here. Every payment is also in Transactions." : undefined} />
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden p-0 sm:p-0">
      <ul className="divide-y divide-line">
        {rows.map((due) => (
          <li key={due.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{due.clients?.business_name ?? due.payer_name}</p>
              <p className="truncate text-[13px] text-muted">
                {due.title}
                {due.projects ? ` · ${due.projects.title}` : ""}
                {view === "cancelled" && due.cancel_reason ? ` · “${due.cancel_reason}”` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="tabular font-bold">{formatMoney(view === "collected" ? due.amount_paid : due.amount, due.currency)}</p>
              <p className="text-xs text-muted">
                {view === "collected" ? `Paid ${formatDateTime(due.paid_at)}` : `Cancelled ${formatDateTime(due.cancelled_at)}`}
                {due.adjustment ? ` · ${formatMoney(due.adjustment, due.currency)} discount` : ""}
              </p>
            </div>
            <StatusPill status={view === "collected" ? "paid" : "cancelled"} label={DUE_STATE_LABELS[view === "collected" ? "paid" : "cancelled"]} />
            <DueMenu due={due} clients={options.clients} projects={options.projects} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
