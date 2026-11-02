import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, Plus, Repeat, Wallet } from "lucide-react";
import { requireFinance, isOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ilikeTerm, type SearchParams } from "@/lib/data/query";
import { loadFormOptions } from "@/lib/data/lookups";
import { INTERVAL_LABELS, RENEWAL_STATE_LABELS, SERVICE_TYPE_SHORT } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { formatDayMonth, todayPK } from "@/lib/dates";
import { renewalLabel, renewalState } from "@/lib/collections";
import { cn, param } from "@/lib/utils";
import { Card, KpiCard, Section } from "@/components/ui/card";
import { EmptyState, PageSkeleton } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { LinkTabs } from "@/components/ui/misc";
import { StatusPill } from "@/components/ui/pill";
import { ListToolbar } from "@/components/app/toolbar";
import { WhatsAppLink, paymentReminder } from "@/components/app/domain";
import { StartSubscriptionDialog } from "./start-dialog";
import { MarkPaidButton, SubscriptionMenu } from "./row-actions";

export const metadata: Metadata = { title: "Subscriptions" };

export default function SubscriptionsPage(props: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Subscriptions searchParams={props.searchParams} />
    </Suspense>
  );
}

const VIEWS = ["active", "soon", "due", "inactive", "all"] as const;

async function Subscriptions({ searchParams }: { searchParams: SearchParams }) {
  const member = await requireFinance();
  const params = await searchParams;
  const supabase = await createClient();
  const today = todayPK();
  const view = (VIEWS as readonly string[]).includes(param(params.view) ?? "") ? (param(params.view) as (typeof VIEWS)[number]) : "active";
  const term = ilikeTerm(param(params.q))?.slice(1, -1).toLowerCase();

  const [allRes, options, settings] = await Promise.all([
    supabase.from("subscriptions").select("*, clients(id, business_name, contact_name, phone, whatsapp)").order("next_due_date"),
    loadFormOptions(supabase),
    supabase.from("settings").select("company_name, bank_name, account_title, account_number, iban, jazzcash_number, easypaisa_number, raast_id, payment_notes").maybeSingle(),
  ]);
  if (allRes.error) throw allRes.error;
  const all = (allRes.data ?? []).map((s) => ({ ...s, state: renewalState(s, today) }));
  const active = all.filter((s) => s.status === "active");
  const soon = active.filter((s) => s.state === "expiring");
  const due = active.filter((s) => s.state === "expired");
  const mrrPkr = active.filter((s) => s.currency === "PKR").reduce((sum, s) => sum + Math.round(s.amount / s.interval_months), 0);
  const mrrUsd = active.filter((s) => s.currency === "USD").reduce((sum, s) => sum + Math.round(s.amount / s.interval_months), 0);

  let rows = all.filter((s) =>
    view === "active" ? s.status === "active" : view === "soon" ? s.state === "expiring" : view === "due" ? s.state === "expired" : view === "inactive" ? s.status !== "active" : true,
  );
  if (term) rows = rows.filter((s) => `${s.name} ${s.clients?.business_name} ${s.service_ref ?? ""}`.toLowerCase().includes(term));
  const totalPkr = rows.filter((s) => s.currency === "PKR" && s.status === "active").reduce((sum, s) => sum + Math.round(s.amount / s.interval_months), 0);
  const canDelete = isOwner(member.role);
  const details = settings.data ?? null;

  const addButton = <StartSubscriptionDialog clients={options.clients} plans={options.plans} trigger={<Button><Plus /> Add subscription</Button>} />;

  return (
    <div className="flex flex-col gap-7">
      <div className="grid grid-cols-2 gap-3 sm:gap-5 wide:grid-cols-4">
        <KpiCard icon={<Repeat />} tone="accent" label="Monthly recurring (MRR)" value={formatMoney(mrrPkr, "PKR")} sub={mrrUsd ? `+ ${formatMoney(mrrUsd, "USD")} MRR` : "3-month & yearly plans spread per month"} />
        <KpiCard icon={<Wallet />} tone="success" label="Active subscriptions" value={active.length} sub={`${all.filter((s) => s.status === "paused").length} paused`} />
        <KpiCard icon={<CalendarClock />} tone="warning" label="Renewing in 7 days" value={soon.length} sub={formatMoney(soon.filter((s) => s.currency === "PKR").reduce((t, s) => t + s.amount, 0), "PKR")} />
        <KpiCard icon={<AlertTriangle />} tone="danger" label="Payment due" value={formatMoney(due.filter((s) => s.currency === "PKR").reduce((t, s) => t + s.amount, 0), "PKR")} sub={due.length ? `${due.length} lapsed — follow up` : "All renewals paid"} subTone={due.length ? "danger" : "success"} />
      </div>

      <Section title="Subscriptions" description="All prepaid recurring services. WhatsApp API clients also have their own page." actions={<><Button asChild variant="secondary"><Link href="/whatsapp">WhatsApp API</Link></Button>{addButton}</>}>
        <LinkTabs
          param="view"
          className="mb-4"
          keep={["q"]}
          tabs={[
            { value: "active", label: "Active", count: active.length },
            { value: "soon", label: "Renewing soon", count: soon.length },
            { value: "due", label: "Payment due", count: due.length },
            { value: "inactive", label: "Paused / cancelled" },
            { value: "all", label: "All" },
          ]}
        />
        <ListToolbar className="mb-4" searchPlaceholder="Search client, plan or number…" />

        {rows.length === 0 ? (
          <Card>
            <EmptyState icon={<Repeat />} title={all.length ? "Nothing in this view" : "No subscriptions yet"} description={all.length ? "Try another tab." : "Add WhatsApp API, ads management or any monthly service."} action={all.length ? undefined : addButton} />
          </Card>
        ) : (
          <Card className="overflow-hidden p-0 sm:p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-canvas">
                  <tr className="text-left text-[12.5px] font-semibold text-muted [&>th]:h-11 [&>th]:px-4 [&>th]:first:pl-5">
                    <th>Client</th>
                    <th>Plan</th>
                    <th className="text-right">Price</th>
                    <th>Renewal</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((sub) => {
                    const late = sub.status === "active" && sub.state === "expired";
                    const stateKey = sub.status === "active" ? sub.state : (sub.status as "paused" | "cancelled");
                    return (
                      <tr key={sub.id} className={cn("border-t border-line [&>td]:h-[62px] [&>td]:px-4 [&>td]:first:pl-5", late && "bg-danger-tint/50")}>
                        <td className="max-w-[220px]">
                          <Link href={`/clients/${sub.client_id}`} className="block truncate font-semibold hover:text-primary">{sub.clients?.business_name}</Link>
                          <p className="truncate text-xs text-muted">{SERVICE_TYPE_SHORT[sub.service_type]}{sub.service_ref ? ` · ${sub.service_ref}` : ""}</p>
                        </td>
                        <td className="max-w-[240px]">
                          <p className="truncate font-medium">{sub.name}</p>
                          <p className="text-xs text-muted">{INTERVAL_LABELS[sub.interval_months]} · prepaid</p>
                        </td>
                        <td className="tabular text-right font-semibold whitespace-nowrap">{formatMoney(sub.amount, sub.currency)}</td>
                        <td className={cn("whitespace-nowrap", late ? "font-semibold text-danger" : "text-fg-2")}>
                          {formatDayMonth(sub.next_due_date)}
                          {sub.status === "active" ? <span className="block text-xs">{renewalLabel(sub.next_due_date, today)}</span> : null}
                        </td>
                        <td><StatusPill status={stateKey} label={RENEWAL_STATE_LABELS[stateKey]} /></td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            {sub.status === "active" && sub.state !== "active" ? (
                              <WhatsAppLink
                                variant="icon"
                                label="Send renewal reminder"
                                phone={sub.clients?.whatsapp ?? sub.clients?.phone}
                                message={paymentReminder({ contact: sub.clients?.contact_name, item: `${sub.name} renewal`, amount: sub.amount, currency: sub.currency, due: formatDayMonth(sub.next_due_date), details })}
                              />
                            ) : null}
                            {sub.status !== "cancelled" ? <MarkPaidButton sub={sub} clientName={sub.clients?.business_name} /> : null}
                            <SubscriptionMenu sub={sub} clients={options.clients} plans={options.plans} canDelete={canDelete} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-line-strong bg-canvas font-semibold [&>td]:h-12 [&>td]:px-4 [&>td]:first:pl-5">
                    <td colSpan={2}>Total monthly recurring {view !== "active" && view !== "all" ? "(this view)" : ""}</td>
                    <td className="font-display tabular text-right text-[15px] font-bold whitespace-nowrap text-primary">{formatMoney(totalPkr, "PKR")}</td>
                    <td colSpan={3} className="text-xs font-medium text-muted">per month, active only</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </Section>
    </div>
  );
}
