import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Download, FilePen, FileText, Plus } from "lucide-react";
import { requireFinance } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ilikeTerm, pageCount, pageFrom, type SearchParams } from "@/lib/data/query";
import { INVOICE_STATUS_LABELS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { dueLabel, formatDate, monthStart, todayPK } from "@/lib/dates";
import { invoiceDisplayStatus } from "@/lib/invoices";
import { cn, param } from "@/lib/utils";
import { Card, KpiCard, Section } from "@/components/ui/card";
import { EmptyState, PageSkeleton } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { LinkTabs, Pagination } from "@/components/ui/misc";
import { StatusPill } from "@/components/ui/pill";
import { ListToolbar } from "@/components/app/toolbar";

export const metadata: Metadata = { title: "Invoices" };

export default function InvoicesPage(props: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Invoices searchParams={props.searchParams} />
    </Suspense>
  );
}

const VIEWS = ["all", "draft", "unpaid", "overdue", "paid", "void"] as const;

async function Invoices({ searchParams }: { searchParams: SearchParams }) {
  await requireFinance();
  const params = await searchParams;
  const supabase = await createClient();
  const today = todayPK();
  const { page, from, to } = pageFrom(params);
  const view = (VIEWS as readonly string[]).includes(param(params.view) ?? "") ? (param(params.view) as (typeof VIEWS)[number]) : "all";
  const term = ilikeTerm(param(params.q));

  let query = supabase
    .from("invoices")
    .select("id, number, status, issue_date, due_date, total, amount_paid, currency, clients!inner(business_name)", { count: "exact" })
    .order("issue_date", { ascending: false })
    .order("number", { ascending: false })
    .range(from, to);
  if (view === "draft") query = query.eq("status", "draft");
  if (view === "unpaid") query = query.in("status", ["sent", "partial"]);
  if (view === "overdue") query = query.in("status", ["sent", "partial"]).lt("due_date", today);
  if (view === "paid") query = query.eq("status", "paid");
  if (view === "void") query = query.eq("status", "void");
  if (term) {
    // Match the invoice number or the client's name.
    const { data: matches } = await supabase.from("clients").select("id").ilike("business_name", term).limit(50);
    const ids = (matches ?? []).map((c) => c.id);
    query = query.or(ids.length ? `number.ilike.${term},client_id.in.(${ids.join(",")})` : `number.ilike.${term}`);
  }

  const [list, open, paidMonth, drafts] = await Promise.all([
    query,
    supabase.from("invoices").select("total, amount_paid, currency, due_date").in("status", ["sent", "partial"]),
    supabase.from("transactions").select("amount, currency").not("invoice_id", "is", null).gte("date", monthStart(today)),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "draft"),
  ]);
  if (list.error) throw list.error;
  const invoices = list.data ?? [];
  const openRows = open.data ?? [];
  const outstanding = openRows.filter((i) => i.currency === "PKR").reduce((s, i) => s + i.total - i.amount_paid, 0);
  const overdueRows = openRows.filter((i) => i.due_date < today);
  const overdue = overdueRows.filter((i) => i.currency === "PKR").reduce((s, i) => s + i.total - i.amount_paid, 0);
  const received = (paidMonth.data ?? []).filter((t) => t.currency === "PKR").reduce((s, t) => s + t.amount, 0);

  const newButton = (
    <Button asChild>
      <Link href="/invoices/new"><Plus /> New invoice</Link>
    </Button>
  );

  return (
    <div className="flex flex-col gap-7">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 wide:grid-cols-4">
        <KpiCard icon={<FileText />} tone="warning" label="Outstanding" value={formatMoney(outstanding, "PKR")} sub={`${openRows.length} unpaid invoice${openRows.length === 1 ? "" : "s"}`} subTone="muted" />
        <KpiCard icon={<AlertTriangle />} tone="danger" label="Overdue" value={formatMoney(overdue, "PKR")} sub={`${overdueRows.length} past due date`} subTone={overdueRows.length ? "danger" : "success"} />
        <KpiCard icon={<CheckCircle2 />} tone="success" label="Collected this month" value={formatMoney(received, "PKR")} sub="Against invoices" subTone="muted" />
        <KpiCard icon={<FilePen />} tone="neutral" label="Drafts" value={drafts.count ?? 0} sub="Not sent yet" subTone="muted" />
      </div>

      <Section title="Invoices" actions={newButton}>
        <LinkTabs
          param="view"
          className="mb-5"
          tabs={[
            { value: "all", label: "All" },
            { value: "draft", label: "Drafts" },
            { value: "unpaid", label: "Unpaid" },
            { value: "overdue", label: "Overdue" },
            { value: "paid", label: "Paid" },
            { value: "void", label: "Void" },
          ]}
        />
        <ListToolbar className="mb-5" searchPlaceholder="Invoice no. or client…" />
        {invoices.length === 0 ? (
          <Card>
            <EmptyState icon={<FileText />} title={term || view !== "all" ? "No invoices here" : "No invoices yet"} description="Create branded PDF invoices numbered GA-YYYY-0001 and share them on WhatsApp." action={newButton} />
          </Card>
        ) : (
          <>
            <Card className="hidden px-6 py-2 md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-fg-2 [&>th]:h-[52px] [&>th]:font-medium">
                    <th>Invoice</th>
                    <th>Client</th>
                    <th>Issued</th>
                    <th>Due</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Balance</th>
                    <th className="pl-6">Status</th>
                    <th className="text-right">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const status = invoiceDisplayStatus(inv, today);
                    const balance = inv.status === "void" ? 0 : inv.total - inv.amount_paid;
                    return (
                      <tr key={inv.id} className="border-t border-line [&>td]:h-[60px]">
                        <td><Link href={`/invoices/${inv.id}`} className="font-bold hover:text-accent-fg">{inv.number}</Link></td>
                        <td className="max-w-[220px] truncate">{inv.clients.business_name}</td>
                        <td className="whitespace-nowrap text-fg-2">{formatDate(inv.issue_date)}</td>
                        <td className={cn("whitespace-nowrap", status === "overdue" ? "font-semibold text-danger" : "text-fg-2")}>
                          {formatDate(inv.due_date)}
                          {status === "overdue" ? <span className="block text-xs">{dueLabel(inv.due_date, today)}</span> : null}
                        </td>
                        <td className="tabular text-right font-semibold whitespace-nowrap">{formatMoney(inv.total, inv.currency)}</td>
                        <td className={cn("tabular text-right whitespace-nowrap", balance > 0 ? "font-semibold" : "text-muted")}>{formatMoney(balance, inv.currency)}</td>
                        <td className="pl-6"><StatusPill status={status} label={INVOICE_STATUS_LABELS[status]} /></td>
                        <td className="text-right">
                          <Button asChild variant="outline" size="pill">
                            <a href={`/api/invoices/${inv.id}/pdf?download=1`}><Download className="!size-3.5" /> Download</a>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
            <ul className="space-y-3 md:hidden">
              {invoices.map((inv) => {
                const status = invoiceDisplayStatus(inv, today);
                return (
                  <li key={inv.id}>
                    <Link href={`/invoices/${inv.id}`} className="block rounded-card border border-line bg-surface p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold">{inv.number}</p>
                          <p className="truncate text-sm text-muted">{inv.clients.business_name}</p>
                        </div>
                        <StatusPill status={status} label={INVOICE_STATUS_LABELS[status]} />
                      </div>
                      <div className="mt-3 flex items-end justify-between">
                        <p className="tabular text-lg font-extrabold">{formatMoney(inv.total, inv.currency)}</p>
                        <p className={cn("text-xs", status === "overdue" ? "font-semibold text-danger" : "text-muted")}>Due {formatDate(inv.due_date)}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <Pagination page={page} pageCount={pageCount(list.count)} />
      </Section>
    </div>
  );
}
