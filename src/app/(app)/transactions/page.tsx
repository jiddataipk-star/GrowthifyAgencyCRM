import type { Metadata } from "next";
import { Suspense } from "react";
import { ArrowDownLeft, ArrowUpRight, Download, Plus, Scale, Wallet } from "lucide-react";
import { requireFinance, isOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { pageCount, pageFrom, type SearchParams } from "@/lib/data/query";
import { parseTxFilters, transactionsQuery } from "@/lib/data/transactions";
import { loadFormOptions } from "@/lib/data/lookups";
import { CATEGORY_LABELS, methodOptions } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { monthStart, todayPK } from "@/lib/dates";
import { Card, KpiCard, Section } from "@/components/ui/card";
import { EmptyState, PageSkeleton } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { LinkTabs, Pagination } from "@/components/ui/misc";
import { ListToolbar } from "@/components/app/toolbar";
import { TransactionFormDialog } from "./transaction-form";
import { TransactionsTable, type TxRow } from "./transactions-table";

export const metadata: Metadata = { title: "Transactions" };

export default function TransactionsPage(props: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Transactions searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Transactions({ searchParams }: { searchParams: SearchParams }) {
  const member = await requireFinance();
  const params = await searchParams;
  const supabase = await createClient();
  const filters = parseTxFilters(params);
  const { page, from, to } = pageFrom(params);
  const today = todayPK();
  const periodFrom = filters.from ?? monthStart(today);
  const periodTo = filters.to ?? today;

  const [list, period, options] = await Promise.all([
    transactionsQuery(supabase, filters, { count: true }).range(from, to),
    supabase.from("transactions").select("type, amount, currency").gte("date", periodFrom).lte("date", periodTo),
    loadFormOptions(supabase),
  ]);
  if (list.error) throw list.error;
  const rows = (list.data ?? []) as unknown as TxRow[];
  const totals = (period.data ?? []).reduce(
    (acc, tx) => {
      const key = `${tx.type}_${tx.currency}` as const;
      acc[key] = (acc[key] ?? 0) + tx.amount;
      return acc;
    },
    {} as Record<string, number>,
  );
  const income = totals.income_PKR ?? 0;
  const expense = totals.expense_PKR ?? 0;
  const label = filters.from || filters.to ? "Selected period" : "This month";

  const exportQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && key !== "page") exportQuery.set(key, value);
  }
  const categoryOptions = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));
  const addButton = (
    <TransactionFormDialog
      options={options}
      defaultType={filters.type === "expense" ? "expense" : "income"}
      trigger={<Button><Plus /> Add transaction</Button>}
    />
  );

  return (
    <div className="flex flex-col gap-7">
      <div className="grid grid-cols-2 gap-3 sm:gap-5 wide:grid-cols-4">
        <KpiCard icon={<ArrowDownLeft />} tone="success" label={`Money in · ${label}`} value={formatMoney(income, "PKR")} sub={totals.income_USD ? `+ ${formatMoney(totals.income_USD, "USD")}` : "Collected"} />
        <KpiCard icon={<ArrowUpRight />} tone="neutral" label={`Money out · ${label}`} value={formatMoney(expense, "PKR")} sub={totals.expense_USD ? `+ ${formatMoney(totals.expense_USD, "USD")}` : "Spent"} />
        <KpiCard icon={<Scale />} tone={income - expense >= 0 ? "accent" : "danger"} label={`Profit · ${label}`} value={formatMoney(income - expense, "PKR", { sign: "auto" })} sub={!income ? "No income yet" : income - expense < 0 ? "Spent more than collected" : `${Math.round(((income - expense) / income) * 100)}% margin`} subTone={income - expense >= 0 ? "success" : "danger"} />
        <KpiCard icon={<Wallet />} tone="neutral" label="Transactions found" value={list.count ?? 0} sub="With current filters" />
      </div>

      <Section
        title="Transactions"
        description="Every rupee in and out — with who, what for, when, how and the screenshot."
        actions={
          <>
            <Button asChild variant="outline" size="pill">
              <a href={`/api/transactions/export${exportQuery.size ? `?${exportQuery}` : ""}`}>
                <Download className="!size-4" /> Export CSV
              </a>
            </Button>
            {addButton}
          </>
        }
      >
        <LinkTabs
          className="mb-5"
          keep={["from", "to", "client", "project", "category", "method", "currency", "q"]}
          tabs={[
            { value: "all", label: "All" },
            { value: "income", label: "Money in" },
            { value: "expense", label: "Money out" },
          ]}
        />
        <ListToolbar
          className="mb-5"
          searchPlaceholder="Search name, TID, what for…"
          dates
          filters={[
            { param: "client", placeholder: "All clients", options: options.clients.map((c) => ({ value: c.id, label: c.name })) },
            { param: "project", placeholder: "All projects", options: options.projects.map((p) => ({ value: p.id, label: p.name })) },
            { param: "category", placeholder: "All categories", options: categoryOptions },
            { param: "method", placeholder: "All methods", options: methodOptions },
            { param: "currency", placeholder: "PKR + USD", options: [{ value: "PKR", label: "PKR only" }, { value: "USD", label: "USD only" }] },
          ]}
        />
        {rows.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Wallet />}
              title={list.count === 0 && !Object.values(filters).some(Boolean) ? "No transactions yet" : "No transactions match"}
              description="Payments marked paid in Collections and renewals appear here automatically. Record expenses and other income manually."
              action={addButton}
            />
          </Card>
        ) : (
          <TransactionsTable rows={rows} options={options} canDelete={isOwner(member.role)} />
        )}
        <Pagination page={page} pageCount={pageCount(list.count)} />
      </Section>
    </div>
  );
}
