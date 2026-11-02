import { Suspense } from "react";
import Link from "next/link";
import { CalendarClock, FileText, PhoneCall, Repeat, Users, Wallet } from "lucide-react";
import { requireFinance } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadOverview } from "@/lib/data/overview";
import { formatMoney, compactNumber, formatNumber } from "@/lib/money";
import { dueLabel, formatDayMonth, formatMonthShort } from "@/lib/dates";
import { percentChange, plural } from "@/lib/utils";
import { CATEGORY_LABELS, PLATFORM_LABELS, SERVICE_TYPE_SHORT } from "@/lib/constants";
import { Card, KpiCard, Section } from "@/components/ui/card";
import { EmptyState, PageSkeleton } from "@/components/ui/feedback";
import { Progress } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { CHART_COLORS, DonutChart, DualBarChart, GradientAreaChart, Legend } from "@/components/charts/charts";
import { Amount, PlatformMark, RowList, TxIcon, WhatsAppLink, paymentReminder } from "@/components/app/domain";

export default function OverviewPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Overview />
    </Suspense>
  );
}

function changeText(current: number, previous: number, suffix = "vs last month") {
  const change = percentChange(current, previous);
  if (change === null) return null;
  const rounded = Math.round(change);
  return `${rounded >= 0 ? "+" : "−"}${Math.abs(rounded)}% ${suffix}`;
}

async function Overview() {
  await requireFinance();
  const supabase = await createClient();
  const data = await loadOverview(supabase);
  const { kpis, today } = data;

  const mrrChange = changeText(kpis.mrr_pkr, kpis.mrr_prev_pkr);
  const revenueChange = changeText(kpis.revenue_pkr, kpis.revenue_prev_pkr, "vs same days last month");
  const cashflow = data.cashflow.map((row) => ({
    label: formatMonthShort(row.month),
    income: row.income / 100,
    expense: row.expense / 100,
    balance: row.balance / 100,
  }));
  const serviceTotal = data.byService.reduce((sum, row) => sum + row.amount, 0);
  const donut = data.byService.slice(0, 4).map((row, i) => ({
    label: SERVICE_TYPE_SHORT[row.service_type],
    value: row.amount / 100,
    color: CHART_COLORS[i],
  }));
  if (data.byService.length > 4) {
    donut[3] = { label: "Other services", value: data.byService.slice(3).reduce((s, r) => s + r.amount, 0) / 100, color: CHART_COLORS[3] };
  }

  return (
    <div className="flex flex-col gap-7">
      {/* KPI row */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 wide:grid-cols-4 wide:gap-7">
        <KpiCard
          icon={<Repeat />}
          tone="accent"
          label="Monthly Recurring"
          value={formatMoney(kpis.mrr_pkr, "PKR")}
          sub={
            [mrrChange ?? plural(kpis.active_subscriptions, "active subscription"), kpis.mrr_usd ? `+ ${formatMoney(kpis.mrr_usd, "USD")}` : null]
              .filter(Boolean)
              .join(" · ")
          }
          subTone={mrrChange?.startsWith("−") ? "danger" : "success"}
        />
        <KpiCard
          icon={<Wallet />}
          tone="success"
          label="Revenue This Month"
          value={formatMoney(kpis.revenue_pkr, "PKR")}
          sub={[revenueChange ?? "First payments of the month", kpis.revenue_usd ? `+ ${formatMoney(kpis.revenue_usd, "USD")}` : null]
            .filter(Boolean)
            .join(" · ")}
          subTone={revenueChange?.startsWith("−") ? "danger" : revenueChange ? "success" : "muted"}
        />
        <KpiCard
          icon={<FileText />}
          tone="danger"
          label="Outstanding"
          value={formatMoney(kpis.outstanding_pkr, "PKR")}
          sub={
            kpis.overdue_count
              ? `${plural(kpis.overdue_count, "item")} overdue`
              : kpis.outstanding_count
                ? `${plural(kpis.outstanding_count, "open item")}, none overdue`
                : "Nothing outstanding"
          }
          subTone={kpis.overdue_count ? "danger" : "success"}
        />
        <KpiCard
          icon={<Users />}
          tone="neutral"
          label="Active Clients"
          value={formatNumber(kpis.active_clients)}
          sub={`${kpis.new_clients} new this month`}
          subTone="success"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-7 wide:grid-cols-[2fr_1fr]">
        <Section title="Revenue vs Expenses" actions={<Legend items={[{ label: "Revenue", color: "var(--chart-1)" }, { label: "Expenses", color: "var(--chart-2)" }]} />}>
          <Card className="pt-6 pb-4">
            <DualBarChart
              data={cashflow}
              series={[
                { key: "income", label: "Revenue", color: "var(--chart-1)" },
                { key: "expense", label: "Expenses", color: "var(--chart-2)" },
              ]}
              unit="PKR"
            />
          </Card>
        </Section>
        <Section title="Revenue by Service">
          <Card className="flex min-h-[302px] items-center">
            {donut.length ? (
              <DonutChart data={donut} centerValue={compactNumber(serviceTotal / 100)} centerLabel="PKR this month" />
            ) : (
              <EmptyState compact icon={<Wallet />} title="No income yet this month" description="Payments you record will be split by service here." className="w-full" />
            )}
          </Card>
        </Section>
      </div>

      {/* Lists row */}
      <div className="grid grid-cols-1 gap-7 lg:grid-cols-2 wide:grid-cols-[1.35fr_1.1fr_0.9fr]">
        <Section title="Recent Transactions" actions={<Button asChild variant="ghost" size="sm"><Link href="/payments">See all</Link></Button>}>
          <Card className="px-5 py-2 sm:px-6">
            {data.recent.length ? (
              <RowList>
                {data.recent.map((tx) => (
                  <li key={tx.id} className="flex items-center gap-3.5 py-3">
                    <TxIcon type={tx.type} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] font-semibold">{tx.clients?.business_name ?? tx.description ?? CATEGORY_LABELS[tx.category]}</p>
                      <p className="truncate text-xs text-muted">
                        {tx.projects?.title ?? tx.subscriptions?.name ?? (tx.type === "expense" ? CATEGORY_LABELS[tx.category] : "Income")} · {formatDayMonth(tx.date)}
                      </p>
                    </div>
                    <Amount minor={tx.amount} currency={tx.currency} type={tx.type} className="text-[15px]" />
                  </li>
                ))}
              </RowList>
            ) : (
              <EmptyState compact title="No transactions yet" description="Record income and expenses under Payments." action={<Button asChild size="sm"><Link href="/payments">Add transaction</Link></Button>} />
            )}
          </Card>
        </Section>

        <Section title="Cash Balance">
          <Card className="pt-6 pb-4">
            {cashflow.some((row) => row.income || row.expense) ? (
              <GradientAreaChart data={cashflow} dataKey="balance" label="Balance" unit="PKR" height={216} />
            ) : (
              <EmptyState compact title="No cash history yet" description="Running income minus expenses (PKR) will chart here." />
            )}
          </Card>
        </Section>

        <Section title="Social Growth" className="lg:col-span-2 wide:col-span-1" actions={<Button asChild variant="ghost" size="sm"><Link href="/social">Details</Link></Button>}>
          <Card className="px-5 py-2 sm:px-6">
            <RowList>
              {data.social.map((account) => (
                <li key={account.id} className="flex items-center gap-3.5 py-3">
                  <PlatformMark platform={account.platform} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-semibold">{PLATFORM_LABELS[account.platform]}</p>
                    <p className={account.status === "needs_reconnect" ? "text-xs font-semibold text-danger" : "text-xs text-muted"}>
                      {account.status === "needs_reconnect" ? "Needs reconnect" : "Followers"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular text-[15px] font-bold">{account.followers === null ? "—" : formatNumber(account.followers)}</p>
                    <p className="text-xs text-success">
                      {account.change7d === null ? (account.followers === null ? "Not connected" : "New") : `${account.change7d >= 0 ? "+" : "−"}${formatNumber(Math.abs(account.change7d))} this week`}
                    </p>
                  </div>
                </li>
              ))}
            </RowList>
          </Card>
        </Section>
      </div>

      {/* Operations row */}
      <div className="grid grid-cols-1 gap-7 lg:grid-cols-2 wide:grid-cols-3">
        <Section title="Upcoming Renewals" actions={<Button asChild variant="ghost" size="sm"><Link href="/subscriptions">All</Link></Button>}>
          <Card className="px-5 py-2 sm:px-6">
            {data.renewals.length ? (
              <RowList>
                {data.renewals.map((sub) => {
                  const overdue = sub.next_due_date < today;
                  return (
                    <li key={sub.id} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14.5px] font-semibold">{sub.clients?.business_name}</p>
                        <p className={overdue ? "text-xs font-semibold text-danger" : "text-xs text-muted"}>
                          {sub.name} · {dueLabel(sub.next_due_date, today)}
                        </p>
                      </div>
                      <span className={`tabular text-sm font-bold ${overdue ? "text-danger" : ""}`}>{formatMoney(sub.amount, sub.currency)}</span>
                      <WhatsAppLink
                        variant="icon"
                        label="Send reminder"
                        phone={sub.clients?.whatsapp ?? sub.clients?.phone}
                        message={paymentReminder({ item: sub.name, amount: sub.amount, currency: sub.currency, due: formatDayMonth(sub.next_due_date) })}
                      />
                    </li>
                  );
                })}
              </RowList>
            ) : (
              <EmptyState compact icon={<CalendarClock />} title="No renewals in the next 7 days" />
            )}
          </Card>
        </Section>

        <Section title="Active Projects" actions={<Button asChild variant="ghost" size="sm"><Link href="/projects">All</Link></Button>}>
          <Card className="px-5 py-2 sm:px-6">
            {data.projects.length ? (
              <RowList>
                {data.projects.map((project) => (
                  <li key={project.id} className="py-3.5">
                    <Link href={`/projects/${project.id}`} className="group block">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate text-[14.5px] font-semibold group-hover:text-accent-fg">{project.title}</p>
                        <span className="tabular text-sm font-bold">{project.progress}%</span>
                      </div>
                      <p className="mb-2 truncate text-xs text-muted">
                        {project.clients?.business_name}
                        {project.deadline ? ` · ${dueLabel(project.deadline, today).replace("Due", "Deadline")}` : ""}
                      </p>
                      <Progress value={project.progress} label={`${project.title} progress`} />
                    </Link>
                  </li>
                ))}
              </RowList>
            ) : (
              <EmptyState compact title="No active projects" action={<Button asChild size="sm"><Link href="/projects">New project</Link></Button>} />
            )}
          </Card>
        </Section>

        <Section title="Follow-ups Due" className="lg:col-span-2 wide:col-span-1" actions={<Button asChild variant="ghost" size="sm"><Link href="/leads">Pipeline</Link></Button>}>
          <Card className="px-5 py-2 sm:px-6">
            {data.followUps.length ? (
              <RowList>
                {data.followUps.map((lead) => (
                  <li key={lead.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/leads?lead=${lead.id}`} className="block truncate text-[14.5px] font-semibold hover:text-accent-fg">
                        {lead.name}
                        {lead.business ? <span className="font-medium text-muted"> · {lead.business}</span> : null}
                      </Link>
                      <p className={lead.next_follow_up && lead.next_follow_up < today ? "text-xs font-semibold text-danger" : "text-xs text-muted"}>
                        {lead.next_follow_up === today ? "Due today" : `Overdue since ${formatDayMonth(lead.next_follow_up)}`}
                      </p>
                    </div>
                    <WhatsAppLink variant="icon" phone={lead.phone} label="Open chat" />
                  </li>
                ))}
              </RowList>
            ) : (
              <EmptyState compact icon={<PhoneCall />} title="No follow-ups due today" />
            )}
          </Card>
        </Section>
      </div>
    </div>
  );
}
