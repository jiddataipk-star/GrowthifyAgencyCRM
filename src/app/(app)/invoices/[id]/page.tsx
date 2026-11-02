import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Wallet } from "lucide-react";
import { requireFinance, isOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { INVOICE_STATUS_LABELS, METHOD_LABELS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { dueLabel, formatDate, todayPK } from "@/lib/dates";
import { invoiceDisplayStatus } from "@/lib/invoices";
import { isUuid } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { EmptyState, PageSkeleton } from "@/components/ui/feedback";
import { StatusPill } from "@/components/ui/pill";
import { Amount, RowList, TxIcon } from "@/components/app/domain";
import { InvoiceActions } from "./invoice-actions";

export const metadata: Metadata = { title: "Invoice" };

type Props = { params: Promise<{ id: string }> };

export default function InvoicePage(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton kpis={0} />}>
      <InvoiceDetail {...props} />
    </Suspense>
  );
}

async function InvoiceDetail({ params }: Props) {
  const member = await requireFinance();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const today = todayPK();

  const [{ data: invoice }, { data: payments }, { data: settings }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, invoice_items(id, description, qty, unit_price, amount, position), clients(id, business_name, contact_name, phone, whatsapp, email, city, ntn), projects(id, title)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("transactions").select("id, type, amount, tax_withheld, currency, date, method, reference").eq("invoice_id", id).order("date"),
    supabase.from("settings").select("company_name").maybeSingle(),
  ]);
  if (!invoice || !invoice.clients) notFound();

  const status = invoiceDisplayStatus(invoice, today);
  const balance = invoice.status === "void" ? 0 : Math.max(invoice.total - invoice.amount_paid, 0);
  const items = [...invoice.invoice_items].sort((a, b) => a.position - b.position);
  const shareUrl = `${publicEnv.siteUrl()}/i/${invoice.share_token}`;
  const money = (minor: number) => formatMoney(minor, invoice.currency);

  return (
    <div className="flex flex-col gap-7">
      <Link href="/invoices" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> All invoices
      </Link>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold tracking-[-0.01em]">{invoice.number}</h2>
            <StatusPill status={status} label={INVOICE_STATUS_LABELS[status]} />
          </div>
          <p className="mt-1 text-fg-2">
            <Link href={`/clients/${invoice.clients.id}`} className="font-semibold hover:text-accent-fg">{invoice.clients.business_name}</Link>
            {invoice.projects ? <> · <Link href={`/projects/${invoice.projects.id}`} className="hover:text-accent-fg">{invoice.projects.title}</Link></> : null}
            {" · "}
            <span className={status === "overdue" ? "font-semibold text-danger" : undefined}>
              {invoice.status === "paid" ? `Paid ${invoice.paid_at ? formatDate(invoice.paid_at.slice(0, 10)) : ""}` : invoice.status === "void" ? "Void" : dueLabel(invoice.due_date, today)}
            </span>
          </p>
        </div>
        <InvoiceActions
          id={invoice.id}
          number={invoice.number}
          status={invoice.status}
          currency={invoice.currency}
          balance={balance}
          total={invoice.total}
          dueDate={invoice.due_date}
          shareUrl={shareUrl}
          clientPhone={invoice.clients.whatsapp ?? invoice.clients.phone}
          contactName={invoice.clients.contact_name}
          company={settings?.company_name ?? "Growthify Agency"}
          editable={["draft", "sent"].includes(invoice.status) && invoice.amount_paid === 0}
          canDelete={invoice.status === "draft" || isOwner(member.role)}
        />
      </div>

      <div className="grid grid-cols-1 gap-7 xl:grid-cols-[1.6fr_1fr]">
        {/* On-screen preview (the PDF uses the same structure) */}
        <Card className="overflow-hidden p-0 sm:p-0">
          <div className="flex items-start justify-between gap-4 bg-sidebar px-6 py-6 sm:px-8 light:bg-[#06140e]">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-[#c8ff40] uppercase">Invoice</p>
              <p className="mt-1 text-2xl font-extrabold text-white">{invoice.number}</p>
            </div>
            <div className="text-right text-sm text-[#a9bdb2]">
              <p>Issued <span className="font-semibold text-white">{formatDate(invoice.issue_date)}</span></p>
              <p>Due <span className="font-semibold text-white">{formatDate(invoice.due_date)}</span></p>
            </div>
          </div>
          <div className="px-6 py-6 sm:px-8">
            <p className="text-xs font-bold tracking-wide text-muted uppercase">Bill to</p>
            <p className="mt-1 font-bold">{invoice.clients.business_name}</p>
            <p className="text-sm text-fg-2">{[invoice.clients.contact_name, invoice.clients.city, invoice.clients.email].filter(Boolean).join(" · ")}</p>
            {invoice.clients.ntn ? <p className="text-sm text-fg-2">NTN {invoice.clients.ntn}</p> : null}

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-line-strong text-left text-xs font-bold tracking-wide text-muted uppercase [&>th]:pb-2">
                    <th>Description</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Unit price</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-line [&>td]:py-3">
                      <td className="pr-4">{item.description}</td>
                      <td className="tabular text-right">{Number(item.qty)}</td>
                      <td className="tabular text-right">{money(item.unit_price)}</td>
                      <td className="tabular text-right font-semibold">{money(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="mt-5 ml-auto w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-fg-2">Subtotal</dt><dd className="tabular">{money(invoice.subtotal)}</dd></div>
              {invoice.discount ? <div className="flex justify-between"><dt className="text-fg-2">Discount</dt><dd className="tabular">−{money(invoice.discount)}</dd></div> : null}
              {invoice.tax ? <div className="flex justify-between"><dt className="text-fg-2">Sales tax ({Number(invoice.tax_rate)}%)</dt><dd className="tabular">{money(invoice.tax)}</dd></div> : null}
              <div className="flex justify-between rounded-xl bg-[#0f2b20] px-3 py-2.5 font-extrabold text-white"><dt>Total</dt><dd className="tabular text-[#c8ff40]">{money(invoice.total)}</dd></div>
              {invoice.amount_paid ? <div className="flex justify-between"><dt className="text-fg-2">Paid (incl. WHT)</dt><dd className="tabular text-success">−{money(invoice.amount_paid)}</dd></div> : null}
              {invoice.status !== "void" ? <div className="flex justify-between font-bold"><dt>Balance due</dt><dd className="tabular">{money(balance)}</dd></div> : null}
            </dl>
            {invoice.notes ? <p className="mt-6 rounded-2xl bg-surface-2 p-4 text-sm whitespace-pre-line text-fg-2">{invoice.notes}</p> : null}
          </div>
        </Card>

        <div className="flex flex-col gap-7">
          <Card className="py-3">
            <p className="pt-2 pb-2 text-card font-bold">Payments</p>
            {payments?.length ? (
              <RowList>
                {payments.map((tx) => (
                  <li key={tx.id} className="flex items-center gap-3 py-3">
                    <TxIcon type={tx.type} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{formatDate(tx.date)} · {METHOD_LABELS[tx.method]}</p>
                      <p className="truncate text-xs text-muted">
                        {tx.reference ?? "No reference"}
                        {tx.tax_withheld ? ` · WHT ${money(tx.tax_withheld)}` : ""}
                      </p>
                    </div>
                    <Amount minor={tx.amount} currency={tx.currency} type={tx.type} className="text-sm" />
                  </li>
                ))}
              </RowList>
            ) : (
              <EmptyState compact icon={<Wallet />} title="No payments yet" description="Use “Mark paid” to record full or partial payments." />
            )}
          </Card>
          {invoice.status !== "draft" ? (
            <Card>
              <p className="text-card font-bold">Share link</p>
              <p className="mt-1 text-sm text-fg-2">Anyone with this link can view the PDF. It never shows drafts.</p>
              <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2.5 font-mono text-xs break-all text-fg-2">{shareUrl}</p>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
