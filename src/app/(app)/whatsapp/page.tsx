import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, MessageCircleMore, Plus, Repeat } from "lucide-react";
import { requireFinance, isOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ilikeTerm, type SearchParams } from "@/lib/data/query";
import { loadFormOptions } from "@/lib/data/lookups";
import { INTERVAL_LABELS, METHOD_LABELS, RENEWAL_STATE_LABELS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDayMonth, todayPK } from "@/lib/dates";
import { renewalLabel, renewalState, type RenewalState } from "@/lib/collections";
import { formatPhone } from "@/lib/phone";
import { cn, param } from "@/lib/utils";
import { Card, KpiCard, Section } from "@/components/ui/card";
import { EmptyState, PageSkeleton } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { LinkTabs } from "@/components/ui/misc";
import { StatusPill } from "@/components/ui/pill";
import { Avatar } from "@/components/ui/avatar";
import { ListToolbar } from "@/components/app/toolbar";
import { WhatsAppLink, paymentReminder } from "@/components/app/domain";
import { StartSubscriptionDialog } from "../subscriptions/start-dialog";
import { MarkPaidButton, SubscriptionMenu } from "../subscriptions/row-actions";

export const metadata: Metadata = { title: "WhatsApp API" };

export default function WhatsAppPage(props: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WhatsApp searchParams={props.searchParams} />
    </Suspense>
  );
}

const VIEWS = ["active", "soon", "due", "cancelled", "all"] as const;

async function WhatsApp({ searchParams }: { searchParams: SearchParams }) {
  const member = await requireFinance();
  const params = await searchParams;
  const supabase = await createClient();
  const today = todayPK();
  const view = (VIEWS as readonly string[]).includes(param(params.view) ?? "") ? (param(params.view) as (typeof VIEWS)[number]) : "active";
  const term = ilikeTerm(param(params.q))?.slice(1, -1).toLowerCase();

  const [subsRes, options, settings] = await Promise.all([
    supabase.from("subscriptions").select("*, clients(id, business_name, contact_name, phone, whatsapp, logo_url)").eq("service_type", "whatsapp_api").order("next_due_date"),
    loadFormOptions(supabase),
    supabase.from("settings").select("company_name, bank_name, account_title, account_number, iban, jazzcash_number, easypaisa_number, raast_id, payment_notes").maybeSingle(),
  ]);
  if (subsRes.error) throw subsRes.error;
  const all = subsRes.data ?? [];
  const ids = all.map((s) => s.id);
  const { data: payments } = ids.length
    ? await supabase.from("transactions").select("id, subscription_id, amount, currency, date, time, method, party_name, reference").in("subscription_id", ids).order("date", { ascending: false })
    : { data: [] };
  const paidBySub = new Map<string, number>();
  for (const tx of payments ?? []) if (tx.subscription_id && tx.currency === "PKR") paidBySub.set(tx.subscription_id, (paidBySub.get(tx.subscription_id) ?? 0) + tx.amount);

  const withState = all.map((s) => ({ ...s, state: renewalState(s, today) as RenewalState }));
  const active = withState.filter((s) => s.status === "active");
  const soon = active.filter((s) => s.state === "expiring");
  const due = active.filter((s) => s.state === "expired");
  const mrr = active.filter((s) => s.currency === "PKR").reduce((sum, s) => sum + Math.round(s.amount / s.interval_months), 0);
  const dueAmount = due.filter((s) => s.currency === "PKR").reduce((sum, s) => sum + s.amount, 0);
  const mix = [1, 3, 12].map((m) => ({ months: m, count: active.filter((s) => s.interval_months === m).length }));

  let rows = withState.filter((s) =>
    view === "active" ? s.status === "active" : view === "soon" ? s.state === "expiring" : view === "due" ? s.state === "expired" : view === "cancelled" ? s.status !== "active" : true,
  );
  if (term) rows = rows.filter((s) => `${s.clients?.business_name} ${s.service_ref} ${s.clients?.contact_name}`.toLowerCase().includes(term));

  const addButton = <StartSubscriptionDialog whatsapp clients={options.clients} plans={options.plans} trigger={<Button><Plus /> Add WhatsApp client</Button>} />;
  const company = settings.data ?? null;
  const canDelete = isOwner(member.role);

  return (
    <div className="flex flex-col gap-7">
      <div className="grid grid-cols-2 gap-3 sm:gap-5 wide:grid-cols-4">
        <KpiCard icon={<MessageCircleMore />} tone="accent" label="Active WhatsApp clients" value={active.length} sub={mix.map((m) => `${m.count} × ${INTERVAL_LABELS[m.months]}`).join(" · ")} />
        <KpiCard icon={<Repeat />} tone="success" label="Monthly value (MRR)" value={formatMoney(mrr, "PKR")} sub="Longer plans counted per month" />
        <KpiCard icon={<CalendarClock />} tone="warning" label="Renewing in 7 days" value={soon.length} sub={formatMoney(soon.reduce((s, x) => s + x.amount, 0), "PKR")} />
        <KpiCard icon={<AlertTriangle />} tone="danger" label="Payment due / lapsed" value={formatMoney(dueAmount, "PKR")} sub={due.length ? `${due.length} client${due.length === 1 ? "" : "s"} to follow up` : "Everyone is paid up"} subTone={due.length ? "danger" : "success"} />
      </div>

      <Section title="WhatsApp API clients" description="Prepaid plans: 1 month, 3 months or 1 year. Mark paid renews the plan for the same period." actions={addButton}>
        <LinkTabs
          param="view"
          className="mb-4"
          keep={["q"]}
          tabs={[
            { value: "active", label: "Active", count: active.length },
            { value: "soon", label: "Renewing soon", count: soon.length },
            { value: "due", label: "Payment due", count: due.length },
            { value: "cancelled", label: "Paused / cancelled" },
            { value: "all", label: "All" },
          ]}
        />
        <ListToolbar className="mb-4" searchPlaceholder="Search business or API number…" />

        {rows.length === 0 ? (
          <Card>
            <EmptyState
              icon={<MessageCircleMore />}
              title={all.length ? "Nobody in this view" : "No WhatsApp API clients yet"}
              description={all.length ? "Try another tab." : "Add a client, choose 1 month / 3 months / 1 year and record their advance payment."}
              action={all.length ? undefined : addButton}
            />
          </Card>
        ) : (
          <Card className="overflow-hidden p-0 sm:p-0">
            {/* Phones: one compact card per client */}
            <ul className="divide-y divide-line md:hidden">
              {rows.map((sub) => {
                const phone = sub.clients?.whatsapp ?? sub.clients?.phone;
                const lapsed = sub.state === "expired" && sub.status === "active";
                return (
                  <li key={sub.id} className={cn("px-4 py-3.5", lapsed && "bg-danger-tint/50")}>
                    <div className="flex items-start gap-3">
                      <Avatar src={sub.clients?.logo_url} name={sub.clients?.business_name} size={34} square />
                      <div className="min-w-0 flex-1">
                        <Link href={`/clients/${sub.client_id}`} className="block truncate font-semibold">{sub.clients?.business_name}</Link>
                        <p className="truncate text-xs text-muted">
                          {INTERVAL_LABELS[sub.interval_months]} · {formatMoney(sub.amount, sub.currency)}
                          {sub.service_ref ? ` · ${formatPhone(sub.service_ref)}` : ""}
                        </p>
                        <p className={cn("mt-0.5 text-xs", lapsed ? "font-semibold text-danger" : "text-muted")}>
                          {sub.status === "active" ? `${renewalLabel(sub.next_due_date, today)} · ${formatDayMonth(sub.next_due_date)}` : RENEWAL_STATE_LABELS[sub.status as "paused" | "cancelled"]}
                        </p>
                      </div>
                      <SubscriptionMenu sub={sub} clients={options.clients} plans={options.plans} canDelete={canDelete} />
                    </div>
                    <div className="mt-2.5 flex items-center justify-end gap-1.5 pl-[46px]">
                      <span className="mr-auto text-xs text-muted">Paid so far {formatMoney(paidBySub.get(sub.id) ?? 0, "PKR")}</span>
                      {sub.status === "active" && sub.state !== "active" ? (
                        <WhatsAppLink
                          variant="icon"
                          label="Send renewal reminder"
                          phone={phone}
                          message={paymentReminder({ contact: sub.clients?.contact_name, item: `${sub.name} renewal`, amount: sub.amount, currency: sub.currency, due: formatDayMonth(sub.next_due_date), details: company })}
                        />
                      ) : null}
                      <MarkPaidButton sub={sub} clientName={sub.clients?.business_name} />
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-canvas">
                  <tr className="text-left text-[12.5px] font-semibold text-muted [&>th]:h-11 [&>th]:px-4 [&>th]:first:pl-5">
                    <th>Business</th>
                    <th>API number</th>
                    <th>Plan</th>
                    <th className="text-right">Price</th>
                    <th>Renewal</th>
                    <th className="text-right">Paid so far</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((sub) => {
                    const phone = sub.clients?.whatsapp ?? sub.clients?.phone;
                    return (
                      <tr key={sub.id} className={cn("border-t border-line [&>td]:h-[64px] [&>td]:px-4 [&>td]:first:pl-5", sub.state === "expired" && sub.status === "active" && "bg-danger-tint/50")}>
                        <td className="max-w-[240px]">
                          <div className="flex items-center gap-3">
                            <Avatar src={sub.clients?.logo_url} name={sub.clients?.business_name} size={34} square />
                            <div className="min-w-0">
                              <Link href={`/clients/${sub.client_id}`} className="block truncate font-semibold hover:text-primary">{sub.clients?.business_name}</Link>
                              <p className="truncate text-xs text-muted">{sub.clients?.contact_name ?? formatPhone(phone)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="tabular whitespace-nowrap text-fg-2">{sub.service_ref ? formatPhone(sub.service_ref) : "—"}</td>
                        <td className="whitespace-nowrap">{INTERVAL_LABELS[sub.interval_months]}</td>
                        <td className="tabular text-right font-semibold whitespace-nowrap">{formatMoney(sub.amount, sub.currency)}</td>
                        <td className="whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <StatusPill status={sub.status === "active" ? sub.state : sub.status} label={RENEWAL_STATE_LABELS[sub.status === "active" ? sub.state : (sub.status as "paused" | "cancelled")]} />
                          </div>
                          <p className={cn("mt-1 text-xs", sub.state === "expired" && sub.status === "active" ? "font-semibold text-danger" : "text-muted")}>
                            {sub.status === "active" ? `${renewalLabel(sub.next_due_date, today)} · ${formatDayMonth(sub.next_due_date)}` : `Since ${formatDate(sub.cancelled_at?.slice(0, 10) ?? sub.updated_at.slice(0, 10))}`}
                          </p>
                        </td>
                        <td className="tabular text-right whitespace-nowrap text-fg-2">{formatMoney(paidBySub.get(sub.id) ?? 0, "PKR")}</td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            {sub.status === "active" && sub.state !== "active" ? (
                              <WhatsAppLink
                                variant="icon"
                                label="Send renewal reminder"
                                phone={phone}
                                message={paymentReminder({ contact: sub.clients?.contact_name, item: `${sub.name} renewal`, amount: sub.amount, currency: sub.currency, due: formatDayMonth(sub.next_due_date), details: company })}
                              />
                            ) : null}
                            <MarkPaidButton sub={sub} clientName={sub.clients?.business_name} />
                            <SubscriptionMenu sub={sub} clients={options.clients} plans={options.plans} canDelete={canDelete} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </Section>

      <Section title="Recent WhatsApp API payments">
        <Card className="overflow-hidden p-0 sm:p-0">
          {payments?.length ? (
            <ul className="divide-y divide-line">
              {payments.slice(0, 8).map((tx) => {
                const sub = all.find((s) => s.id === tx.subscription_id);
                return (
                  <li key={tx.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{sub?.clients?.business_name}</p>
                      <p className="truncate text-xs text-muted">
                        {formatDayMonth(tx.date)}
                        {tx.time ? ` · ${tx.time.slice(0, 5)}` : ""} · {METHOD_LABELS[tx.method]}
                        {tx.party_name ? ` · from ${tx.party_name}` : ""}
                        {tx.reference ? ` · ${tx.reference}` : ""}
                      </p>
                    </div>
                    <span className="tabular text-sm font-bold text-success">+{formatMoney(tx.amount, tx.currency)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState compact title="No payments yet" description="Payments you record here also appear in Transactions." />
          )}
        </Card>
      </Section>
    </div>
  );
}
