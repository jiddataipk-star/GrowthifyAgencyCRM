import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, HandCoins, MessageCircleMore, PhoneCall, Trophy, Wallet } from "lucide-react";
import { requireFinance } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadOverview } from "@/lib/data/overview";
import { formatMoney, compactNumber, formatNumber } from "@/lib/money";
import { addDays, dueLabel, formatDayMonth, formatMonthShort, formatMonthYear, monthStart } from "@/lib/dates";
import { remaining, renewalLabel } from "@/lib/collections";
import { cn, percentChange } from "@/lib/utils";
import { CATEGORY_LABELS, CATEGORY_SHORT, INTERVAL_LABELS, METHOD_LABELS, PLATFORM_LABELS } from "@/lib/constants";
import { Card, Section } from "@/components/ui/card";
import { EmptyState, PageSkeleton } from "@/components/ui/feedback";
import { Progress } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { CHART_COLORS, DonutChart, Legend, MoneyChart } from "@/components/charts/charts";
import { Amount, PlatformMark, RowList, TxIcon, WhatsAppLink, paymentReminder } from "@/components/app/domain";
import { DuePayButton } from "./collections/due-dialogs";
import { MarkPaidButton } from "./subscriptions/row-actions";

export default function OverviewPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Overview />
    </Suspense>
  );
}

type Delta = { text: string; up: boolean | null };

/** % change vs the same days last month. */
function change(current: number, previous: number): Delta | null {
  const pct = percentChange(current, previous);
  if (pct === null) return null;
  const rounded = Math.round(pct);
  if (rounded === 0) return { text: "same as last month", up: null };
  return { text: `${rounded > 0 ? "▲" : "▼"} ${Math.abs(rounded)}%`, up: rounded > 0 };
}

/** Profit can be negative, so a % change misleads; show the rupee difference instead. */
function changeAmount(current: number, previous: number): Delta | null {
  const diff = current - previous;
  if (!current && !previous) return null;
  if (diff === 0) return { text: "same as last month", up: null };
  return { text: `${diff > 0 ? "▲" : "▼"} ${formatMoney(Math.abs(diff), "PKR", { compact: true })}`, up: diff > 0 };
}

async function Overview() {
  await requireFinance();
  const supabase = await createClient();
  const data = await loadOverview(supabase);
  const { kpis, today } = data;
  const lastMonthStart = monthStart(addDays(monthStart(today), -1));

  const cashflow = data.cashflow.map((row) => ({
    label: formatMonthShort(row.month),
    income: row.income / 100,
    expense: row.expense / 100,
    profit: (row.income - row.expense) / 100,
  }));
  const year = data.cashflow.reduce((acc, r) => ({ income: acc.income + r.income, expense: acc.expense + r.expense }), { income: 0, expense: 0 });
  const expenseTotal = data.expenses.reduce((s, e) => s + e.amount, 0);
  const expenseSlices = data.expenses.slice(0, 5).map((e, i) => ({ label: CATEGORY_SHORT[e.category], value: e.amount / 100, color: CHART_COLORS[i] }));
  if (data.expenses.length > 5) expenseSlices.push({ label: "Everything else", value: data.expenses.slice(5).reduce((s, e) => s + e.amount, 0) / 100, color: CHART_COLORS[5] });
  const waMrr = data.whatsapp.filter((s) => s.currency === "PKR").reduce((s, x) => s + Math.round(x.amount / x.interval_months), 0);
  const waDue = data.whatsapp.filter((s) => s.next_due_date <= today).length;

  const collect = [
    ...data.dues.map((d) => ({ kind: "due" as const, date: d.due_date, d })),
    ...data.renewals.map((s) => ({ kind: "renewal" as const, date: s.next_due_date, s })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  const profit = kpis.profit_pkr;
  const margin = kpis.collected_pkr ? Math.round((profit / kpis.collected_pkr) * 100) : null;
  const lastProfit = kpis.collected_last_pkr - kpis.spent_last_pkr;

  const summary = [
    {
      label: "Collected",
      value: kpis.collected_pkr,
      delta: change(kpis.collected_pkr, kpis.collected_prev_pkr),
      note: `${kpis.payments_count} payment${kpis.payments_count === 1 ? "" : "s"}${kpis.collected_usd ? ` · + ${formatMoney(kpis.collected_usd, "USD")}` : ""}`,
      href: "/transactions?tab=income",
    },
    { label: "Spent", value: kpis.spent_pkr, delta: change(kpis.spent_pkr, kpis.spent_prev_pkr), note: "Salaries, rent, bills, tools…", href: "/transactions?tab=expense", invert: true },
    {
      label: "Profit",
      value: profit,
      delta: changeAmount(profit, kpis.profit_prev_pkr),
      note: margin === null ? "No income yet" : profit < 0 ? "Spent more than collected so far" : `${margin}% margin`,
      href: "/transactions",
      negative: profit < 0,
    },
    {
      label: "To collect",
      value: kpis.to_collect_pkr,
      delta: null,
      note: kpis.overdue_count ? `${kpis.overdue_count} overdue — follow up` : `${kpis.to_collect_count} open, none overdue`,
      href: "/collections",
      alert: kpis.overdue_count > 0,
    },
  ];

  return (
    <div className="flex flex-col gap-7">
      {/* This month — dark summary band */}
      <section aria-label="This month" className="overflow-hidden rounded-card bg-frame text-white shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5 pb-1 sm:px-7">
          <div>
            <p className="text-[11.5px] font-semibold tracking-[0.14em] text-accent uppercase">This month</p>
            <h2 className="mt-0.5 text-xl font-bold">
              {formatMonthYear(today)} <span className="text-[13px] font-medium text-frame-muted">· up to {formatDayMonth(today)}</span>
            </h2>
          </div>
          <p className="text-[12.5px] text-frame-muted">
            {formatMonthYear(lastMonthStart).split(" ")[0]}: in {formatMoney(kpis.collected_last_pkr, "PKR", { compact: true })} · out {formatMoney(kpis.spent_last_pkr, "PKR", { compact: true })} ·{" "}
            <span className={lastProfit >= 0 ? "font-semibold text-white" : "font-semibold text-[#ff9b92]"}>profit {formatMoney(lastProfit, "PKR", { compact: true })}</span>
          </p>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-px border-t border-frame-border bg-frame-border lg:grid-cols-4">
          {summary.map((item) => (
            <Link key={item.label} href={item.href} className="group min-w-0 bg-frame px-5 py-5 transition-colors hover:bg-frame-2 sm:px-7">
              <dt className="flex items-center justify-between text-[13px] font-medium text-frame-text">
                {item.label}
                <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
              </dt>
              <dd className={cn("font-display tabular mt-1.5 text-[19px] leading-none font-bold tracking-[-0.02em] whitespace-nowrap min-[400px]:text-[22px] sm:text-[28px]", item.negative && "text-[#ff9b92]")}>
                {formatMoney(item.value, "PKR")}
              </dd>
              <dd className="mt-2 flex flex-wrap items-center gap-x-2 text-[12px]">
                {item.delta ? (
                  <span
                    className={cn("font-semibold", item.delta.up === null ? "text-frame-muted" : (item.invert ? !item.delta.up : item.delta.up) ? "text-accent" : "text-[#ff9b92]")}
                    title="vs the same days last month"
                  >
                    {item.delta.text}
                  </span>
                ) : null}
                <span className={item.alert ? "font-semibold text-[#ff9b92]" : "text-frame-muted"}>{item.note}</span>
              </dd>
            </Link>
          ))}
        </dl>
      </section>

      {/* Trend + where the money goes */}
      <div className="grid grid-cols-1 gap-7 wide:grid-cols-[1.75fr_1fr]">
        <Section
          title="Money in vs money out"
          description={`Last 12 months · profit ${formatMoney(year.income - year.expense, "PKR")} on ${formatMoney(year.income, "PKR")} collected`}
          actions={<Legend items={[{ label: "Money in", color: "var(--chart-1)" }, { label: "Money out", color: "var(--chart-2)" }, { label: "Profit", color: "var(--chart-3)", line: true }]} />}
        >
          <Card className="pt-5 pb-3">
            {cashflow.some((r) => r.income || r.expense) ? <MoneyChart data={cashflow} unit="PKR" /> : <EmptyState compact icon={<Wallet />} title="No transactions yet" description="Record income and expenses to see the trend." />}
          </Card>
        </Section>
        <Section title="Where the money went" description="Last month + this month, PKR">
          <Card className="flex min-h-[312px] items-center">
            {expenseSlices.length ? (
              <DonutChart data={expenseSlices} centerValue={compactNumber(expenseTotal / 100)} centerLabel="PKR spent" />
            ) : (
              <EmptyState compact title="No spending recorded" description="Expenses by category appear here." className="w-full" />
            )}
          </Card>
        </Section>
      </div>

      {/* Collect + top clients */}
      <div className="grid grid-cols-1 gap-7 wide:grid-cols-2">
        <Section title="To collect next" description="Overdue and due in the next 7 days" actions={<Button asChild variant="ghost" size="sm"><Link href="/collections">All collections <ArrowRight /></Link></Button>}>
          <Card className="px-5 py-1.5">
            {collect.length ? (
              <RowList>
                {collect.map((row) => {
                  const late = row.date < today;
                  if (row.kind === "renewal") {
                    const s = row.s;
                    return (
                      <li key={`s-${s.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                          <p className="truncate text-sm font-semibold">{s.clients?.business_name}</p>
                          <p className={cn("truncate text-xs", late ? "font-semibold text-danger" : "text-muted")}>
                            {s.name} · {renewalLabel(s.next_due_date, today)}
                          </p>
                        </div>
                        <span className={cn("tabular mr-auto text-sm font-bold sm:mr-0", late && "text-danger")}>{formatMoney(s.amount, s.currency)}</span>
                        <WhatsAppLink
                          variant="icon"
                          label="Send reminder"
                          phone={s.clients?.whatsapp ?? s.clients?.phone}
                          message={paymentReminder({ contact: s.clients?.contact_name, item: `${s.name} renewal`, amount: s.amount, currency: s.currency, due: formatDayMonth(s.next_due_date), details: data.details })}
                        />
                        <MarkPaidButton sub={s} clientName={s.clients?.business_name} />
                      </li>
                    );
                  }
                  const d = row.d;
                  const payer = d.clients?.business_name ?? d.payer_name;
                  return (
                    <li key={`d-${d.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                      <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                        <p className="truncate text-sm font-semibold">{payer}</p>
                        <p className={cn("truncate text-xs", late ? "font-semibold text-danger" : "text-muted")}>
                          {d.title} · {dueLabel(d.due_date, today)}
                        </p>
                      </div>
                      <span className={cn("tabular mr-auto text-sm font-bold sm:mr-0", late && "text-danger")}>{formatMoney(remaining(d), d.currency)}</span>
                      <WhatsAppLink
                        variant="icon"
                        label="Send reminder"
                        phone={d.clients?.whatsapp ?? d.clients?.phone ?? d.payer_phone}
                        message={paymentReminder({ contact: d.clients?.contact_name ?? d.payer_name, item: d.title, amount: remaining(d), currency: d.currency, due: formatDayMonth(d.due_date), details: data.details })}
                      />
                      <DuePayButton due={d} payer={payer} />
                    </li>
                  );
                })}
              </RowList>
            ) : (
              <EmptyState compact icon={<HandCoins />} title="Nothing due this week" action={<Button asChild size="sm" variant="secondary"><Link href="/collections">Add payment to collect</Link></Button>} />
            )}
          </Card>
        </Section>

        <Section title="Top paying clients" description="Last 12 months, PKR received" actions={<Button asChild variant="ghost" size="sm"><Link href="/clients">Clients <ArrowRight /></Link></Button>}>
          <Card className="px-5 py-1.5">
            {data.topClients.length ? (
              <ol className="divide-y divide-line">
                {data.topClients.map((c, index) => {
                  const share = year.income ? Math.round((c.total / year.income) * 100) : 0;
                  return (
                    <li key={c.client_id} className="flex items-center gap-3 py-3">
                      <span className={cn("font-display tabular w-5 text-center text-sm font-bold", index === 0 ? "text-primary" : "text-muted")}>{index + 1}</span>
                      <Avatar src={c.logo_url} name={c.business_name} size={34} square />
                      <div className="min-w-0 flex-1">
                        <Link href={`/clients/${c.client_id}`} className="block truncate text-sm font-semibold hover:text-primary">{c.business_name}</Link>
                        <div className="mt-1 flex items-center gap-2">
                          <Progress value={share} className="h-1 max-w-[120px]" label={`${share}% of income`} />
                          <span className="truncate text-[11.5px] text-muted">
                            {share}% · {c.payments} payment{c.payments === 1 ? "" : "s"}
                            {c.mrr ? ` · ${formatMoney(c.mrr, "PKR", { compact: true })}/mo` : ""}
                          </span>
                        </div>
                      </div>
                      <span className="font-display tabular text-sm font-bold">{formatMoney(c.total, "PKR")}</span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <EmptyState compact icon={<Trophy />} title="No client payments yet" />
            )}
          </Card>
        </Section>
      </div>

      {/* Recent money + WhatsApp + projects */}
      <div className="grid grid-cols-1 gap-7 lg:grid-cols-2 wide:grid-cols-[1.2fr_1fr_1fr]">
        <Section title="Latest transactions" actions={<Button asChild variant="ghost" size="sm"><Link href="/transactions">All <ArrowRight /></Link></Button>}>
          <Card className="px-5 py-1.5">
            {data.recent.length ? (
              <RowList>
                {data.recent.map((tx) => (
                  <li key={tx.id} className="flex items-center gap-3 py-3">
                    <TxIcon type={tx.type} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{tx.party_name ?? tx.clients?.business_name ?? tx.employees?.name ?? tx.description ?? CATEGORY_LABELS[tx.category]}</p>
                      <p className="truncate text-xs text-muted">
                        {tx.description ?? CATEGORY_LABELS[tx.category]} · {formatDayMonth(tx.date)}
                        {tx.time ? ` ${tx.time.slice(0, 5)}` : ""} · {METHOD_LABELS[tx.method]}
                      </p>
                    </div>
                    <Amount minor={tx.amount} currency={tx.currency} type={tx.type} className="text-sm" />
                  </li>
                ))}
              </RowList>
            ) : (
              <EmptyState compact title="No transactions yet" />
            )}
          </Card>
        </Section>

        <Section title="WhatsApp API" actions={<Button asChild variant="ghost" size="sm"><Link href="/whatsapp">Manage <ArrowRight /></Link></Button>}>
          <Card>
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-primary-tint text-primary">
                <MessageCircleMore className="size-5" />
              </span>
              <div>
                <p className="font-display tabular text-2xl font-bold">{data.whatsapp.length}</p>
                <p className="text-[13px] text-muted">active clients</p>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
              <div>
                <dt className="text-[12.5px] text-muted">Monthly value</dt>
                <dd className="font-display tabular mt-0.5 font-bold">{formatMoney(waMrr, "PKR")}</dd>
              </div>
              <div>
                <dt className="text-[12.5px] text-muted">Payment due</dt>
                <dd className={cn("font-display tabular mt-0.5 font-bold", waDue > 0 && "text-danger")}>
                  {waDue} client{waDue === 1 ? "" : "s"}
                </dd>
              </div>
            </dl>
            <ul className="mt-4 space-y-2 border-t border-line pt-4">
              {[1, 3, 12].map((m) => (
                <li key={m} className="flex items-center justify-between text-[13px]">
                  <span className="text-fg-2">{INTERVAL_LABELS[m]} plan</span>
                  <span className="tabular font-semibold">{data.whatsapp.filter((s) => s.interval_months === m).length}</span>
                </li>
              ))}
            </ul>
          </Card>
        </Section>

        <Section title="Active projects" className="lg:col-span-2 wide:col-span-1" actions={<Button asChild variant="ghost" size="sm"><Link href="/projects">All <ArrowRight /></Link></Button>}>
          <Card className="px-5 py-1.5">
            {data.projects.length ? (
              <RowList>
                {data.projects.map((project) => (
                  <li key={project.id} className="py-3">
                    <Link href={`/projects/${project.id}`} className="group block">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate text-sm font-semibold group-hover:text-primary">{project.title}</p>
                        <span className="tabular text-xs font-semibold">{project.progress}%</span>
                      </div>
                      <p className={cn("mb-1.5 truncate text-xs", project.deadline && project.deadline < today ? "font-semibold text-danger" : "text-muted")}>
                        {project.clients?.business_name}
                        {project.deadline ? ` · ${dueLabel(project.deadline, today).replace("Due", "Deadline").replace("overdue", "late")}` : ""}
                      </p>
                      <Progress value={project.progress} label={`${project.title} progress`} />
                    </Link>
                  </li>
                ))}
              </RowList>
            ) : (
              <EmptyState compact title="No active projects" />
            )}
          </Card>
        </Section>
      </div>

      {/* Follow-ups + social */}
      <div className="grid grid-cols-1 gap-7 lg:grid-cols-2">
        <Section title="Follow-ups due" actions={<Button asChild variant="ghost" size="sm"><Link href="/leads">Pipeline <ArrowRight /></Link></Button>}>
          <Card className="px-5 py-1.5">
            {data.followUps.length ? (
              <RowList>
                {data.followUps.map((lead) => (
                  <li key={lead.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/leads?lead=${lead.id}`} className="block truncate text-sm font-semibold hover:text-primary">
                        {lead.name}
                        {lead.business ? <span className="font-normal text-muted"> · {lead.business}</span> : null}
                      </Link>
                      <p className={cn("text-xs", lead.next_follow_up && lead.next_follow_up < today ? "font-semibold text-danger" : "text-muted")}>
                        {lead.next_follow_up === today ? "Due today" : `Overdue since ${formatDayMonth(lead.next_follow_up)}`}
                      </p>
                    </div>
                    <WhatsAppLink variant="icon" phone={lead.phone} label="Open chat" />
                  </li>
                ))}
              </RowList>
            ) : (
              <EmptyState compact icon={<PhoneCall />} title="No follow-ups due" />
            )}
          </Card>
        </Section>

        <Section title="Social growth" actions={<Button asChild variant="ghost" size="sm"><Link href="/social">Details <ArrowRight /></Link></Button>}>
          <Card className="px-5 py-1.5">
            <RowList>
              {data.social.map((account) => (
                <li key={account.id} className="flex items-center gap-3 py-3">
                  <PlatformMark platform={account.platform} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{PLATFORM_LABELS[account.platform]}</p>
                    <p className={account.status === "needs_reconnect" ? "text-xs font-semibold text-danger" : "text-xs text-muted"}>
                      {account.status === "needs_reconnect" ? "Needs reconnect" : account.status === "connected" ? "Connected" : "Not connected"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display tabular text-sm font-bold">{account.followers === null ? "—" : formatNumber(account.followers)}</p>
                    <p className="text-[11.5px] text-success">{account.change7d === null ? "" : `${account.change7d >= 0 ? "+" : "−"}${formatNumber(Math.abs(account.change7d))} this week`}</p>
                  </div>
                </li>
              ))}
            </RowList>
          </Card>
        </Section>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <CalendarClock className="size-3.5" /> Figures in PKR and Pakistan time. USD is shown separately and never converted.
      </p>
    </div>
  );
}
