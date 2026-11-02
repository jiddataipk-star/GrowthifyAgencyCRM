import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, Plus, Repeat, Wallet } from "lucide-react";
import { requireFinance, isOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ilikeTerm, type SearchParams } from "@/lib/data/query";
import { loadFormOptions } from "@/lib/data/lookups";
import { INTERVAL_LABELS, SUBSCRIPTION_STATUS_LABELS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { addDays, dueLabel, formatDate, formatDayMonth, todayPK } from "@/lib/dates";
import { cn, param } from "@/lib/utils";
import { Card, KpiCard, Section } from "@/components/ui/card";
import { EmptyState, PageSkeleton } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { LinkTabs } from "@/components/ui/misc";
import { StatusPill } from "@/components/ui/pill";
import { ListToolbar } from "@/components/app/toolbar";
import { WhatsAppLink, paymentReminder } from "@/components/app/domain";
import { SubscriptionFormDialog } from "./subscription-form";
import { MarkPaidButton, SubscriptionMenu } from "./row-actions";

export const metadata: Metadata = { title: "Subscriptions" };

export default function SubscriptionsPage(props: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Subscriptions searchParams={props.searchParams} />
    </Suspense>
  );
}

const VIEWS = ["active", "due", "overdue", "paused", "cancelled", "all"] as const;

async function Subscriptions({ searchParams }: { searchParams: SearchParams }) {
  const member = await requireFinance();
  const params = await searchParams;
  const supabase = await createClient();
  const today = todayPK();
  const view = (VIEWS as readonly string[]).includes(param(params.view) ?? "") ? (param(params.view) as (typeof VIEWS)[number]) : "active";
  const term = ilikeTerm(param(params.q));

  const [allRes, options, settings] = await Promise.all([
    supabase.from("subscriptions").select("*, clients(id, business_name, contact_name, phone, whatsapp)").order("next_due_date"),
    loadFormOptions(supabase),
    supabase.from("settings").select("company_name").maybeSingle(),
  ]);
  if (allRes.error) throw allRes.error;
  const all = allRes.data ?? [];
  const active = all.filter((s) => s.status === "active");
  const overdue = active.filter((s) => s.next_due_date < today);
  const dueSoon = active.filter((s) => s.next_due_date >= today && s.next_due_date <= addDays(today, 7));
  const mrrPkr = active.filter((s) => s.currency === "PKR").reduce((sum, s) => sum + Math.round(s.amount / s.interval_months), 0);
  const mrrUsd = active.filter((s) => s.currency === "USD").reduce((sum, s) => sum + Math.round(s.amount / s.interval_months), 0);
  const overduePkr = overdue.filter((s) => s.currency === "PKR").reduce((sum, s) => sum + s.amount, 0);

  let rows = all.filter((s) => {
    if (view === "active") return s.status === "active";
    if (view === "due") return s.status === "active" && s.next_due_date <= addDays(today, 7);
    if (view === "overdue") return s.status === "active" && s.next_due_date < today;
    if (view === "paused") return s.status === "paused";
    if (view === "cancelled") return s.status === "cancelled";
    return true;
  });
  if (term) {
    const needle = term.slice(1, -1).toLowerCase();
    rows = rows.filter((s) => s.name.toLowerCase().includes(needle) || (s.clients?.business_name ?? "").toLowerCase().includes(needle));
  }
  const totalPkr = rows.filter((s) => s.currency === "PKR" && s.status === "active").reduce((sum, s) => sum + Math.round(s.amount / s.interval_months), 0);
  const totalUsd = rows.filter((s) => s.currency === "USD" && s.status === "active").reduce((sum, s) => sum + Math.round(s.amount / s.interval_months), 0);
  const company = settings.data?.company_name ?? "Growthify Agency";
  const canDelete = isOwner(member.role);

  const addButton = <SubscriptionFormDialog clients={options.clients} plans={options.plans} trigger={<Button><Plus /> Add subscription</Button>} />;

  return (
    <div className="flex flex-col gap-7">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 wide:grid-cols-4">
        <KpiCard icon={<Repeat />} tone="accent" label="Monthly recurring (MRR)" value={formatMoney(mrrPkr, "PKR")} sub={mrrUsd ? `+ ${formatMoney(mrrUsd, "USD")} MRR` : `${active.length} active`} subTone="muted" />
        <KpiCard icon={<Wallet />} tone="success" label="Active subscriptions" value={active.length} sub={`${all.filter((s) => s.status === "paused").length} paused`} subTone="muted" />
        <KpiCard icon={<CalendarClock />} tone="warning" label="Due in 7 days" value={dueSoon.length} sub={formatMoney(dueSoon.filter((s) => s.currency === "PKR").reduce((t, s) => t + s.amount, 0), "PKR")} subTone="warning" />
        <KpiCard icon={<AlertTriangle />} tone="danger" label="Overdue" value={formatMoney(overduePkr, "PKR")} sub={`${overdue.length} subscription${overdue.length === 1 ? "" : "s"}`} subTone={overdue.length ? "danger" : "success"} />
      </div>

      <Section title="Subscriptions" actions={addButton}>
        <LinkTabs
          param="view"
          className="mb-5"
          tabs={[
            { value: "active", label: "Active", count: active.length },
            { value: "due", label: "Due soon", count: dueSoon.length + overdue.length },
            { value: "overdue", label: "Overdue", count: overdue.length },
            { value: "paused", label: "Paused" },
            { value: "cancelled", label: "Cancelled" },
            { value: "all", label: "All" },
          ]}
        />
        <ListToolbar className="mb-5" searchPlaceholder="Search client or plan…" />

        {rows.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Repeat />}
              title={all.length ? "Nothing in this view" : "No subscriptions yet"}
              description={all.length ? "Try another tab." : "Add monthly services like Growthify WhatsApp API or Meta Ads management."}
              action={all.length ? undefined : addButton}
            />
          </Card>
        ) : (
          <>
            {/* Desktop table (BankDash loans pattern with a red Total row) */}
            <Card className="hidden px-6 py-2 md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-fg-2 [&>th]:h-[52px] [&>th]:font-medium">
                    <th className="w-12">#</th>
                    <th>Client</th>
                    <th>Plan</th>
                    <th className="text-right">Amount</th>
                    <th className="pl-6">Next due</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((sub, index) => {
                    const late = sub.status === "active" && sub.next_due_date < today;
                    return (
                      <tr key={sub.id} className={cn("border-t border-line [&>td]:h-[60px]", late && "bg-[color-mix(in_srgb,var(--danger)_7%,transparent)]")}>
                        <td className="tabular text-muted">{String(index + 1).padStart(2, "0")}.</td>
                        <td className="max-w-[220px]">
                          <Link href={`/clients/${sub.client_id}`} className="block truncate font-semibold hover:text-accent-fg">{sub.clients?.business_name}</Link>
                        </td>
                        <td className="max-w-[240px]">
                          <p className="truncate font-medium">{sub.name}</p>
                          <p className="text-xs text-muted">{INTERVAL_LABELS[sub.interval_months]} · day {sub.billing_day}</p>
                        </td>
                        <td className="tabular text-right font-semibold whitespace-nowrap">{formatMoney(sub.amount, sub.currency)}</td>
                        <td className={cn("pl-6 whitespace-nowrap", late ? "font-semibold text-danger" : "text-fg-2")}>
                          {formatDate(sub.next_due_date)}
                          {sub.status === "active" ? <span className="block text-xs">{dueLabel(sub.next_due_date, today)}</span> : null}
                        </td>
                        <td><StatusPill status={late ? "overdue" : sub.status} label={late ? "Overdue" : SUBSCRIPTION_STATUS_LABELS[sub.status]} /></td>
                        <td>
                          <div className="flex items-center justify-end gap-1.5">
                            {sub.status === "active" ? (
                              <WhatsAppLink
                                variant="icon"
                                label="Send payment reminder on WhatsApp"
                                phone={sub.clients?.whatsapp ?? sub.clients?.phone}
                                message={paymentReminder({ contact: sub.clients?.contact_name, item: sub.name, amount: sub.amount, currency: sub.currency, due: formatDayMonth(sub.next_due_date), company })}
                              />
                            ) : null}
                            <MarkPaidButton sub={sub} />
                            <SubscriptionMenu sub={sub} clients={options.clients} plans={options.plans} canDelete={canDelete} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-line font-bold text-danger [&>td]:h-[56px]">
                    <td colSpan={3}>Total MRR {view !== "active" && view !== "all" ? "(this view)" : ""}</td>
                    <td className="tabular text-right whitespace-nowrap">
                      {formatMoney(totalPkr, "PKR")}
                      {totalUsd ? <span className="block text-xs">+ {formatMoney(totalUsd, "USD")}</span> : null}
                    </td>
                    <td colSpan={3} className="pl-6 text-xs font-semibold">per month, active only</td>
                  </tr>
                </tbody>
              </table>
            </Card>

            {/* Mobile row-cards */}
            <ul className="space-y-3 md:hidden">
              {rows.map((sub) => {
                const late = sub.status === "active" && sub.next_due_date < today;
                return (
                  <li key={sub.id}>
                    <Card className={cn("p-4", late && "border-danger/50")}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-bold">{sub.clients?.business_name}</p>
                          <p className="truncate text-sm text-muted">{sub.name}</p>
                        </div>
                        <SubscriptionMenu sub={sub} clients={options.clients} plans={options.plans} canDelete={canDelete} />
                      </div>
                      <div className="mt-3 flex items-end justify-between gap-3">
                        <div>
                          <p className="tabular text-lg font-extrabold">{formatMoney(sub.amount, sub.currency)}</p>
                          <p className={cn("text-xs", late ? "font-semibold text-danger" : "text-muted")}>{sub.status === "active" ? dueLabel(sub.next_due_date, today) : SUBSCRIPTION_STATUS_LABELS[sub.status]}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {sub.status === "active" ? (
                            <WhatsAppLink
                              variant="icon"
                              label="Send payment reminder"
                              phone={sub.clients?.whatsapp ?? sub.clients?.phone}
                              message={paymentReminder({ contact: sub.clients?.contact_name, item: sub.name, amount: sub.amount, currency: sub.currency, due: formatDayMonth(sub.next_due_date), company })}
                            />
                          ) : null}
                          <MarkPaidButton sub={sub} />
                        </div>
                      </div>
                    </Card>
                  </li>
                );
              })}
              <li className="flex items-center justify-between rounded-card border border-danger/40 px-4 py-3 font-bold text-danger">
                <span>Total MRR</span>
                <span className="tabular">{formatMoney(totalPkr, "PKR")}{totalUsd ? ` + ${formatMoney(totalUsd, "USD")}` : ""}</span>
              </li>
            </ul>
          </>
        )}
      </Section>
    </div>
  );
}
