import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireFinance } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadFormOptions } from "@/lib/data/lookups";
import { isUuid } from "@/lib/utils";
import { PageSkeleton } from "@/components/ui/feedback";
import { InvoiceEditor } from "../../invoice-editor";

export const metadata: Metadata = { title: "Edit invoice" };

type Props = { params: Promise<{ id: string }> };

export default function EditInvoicePage(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton kpis={0} />}>
      <EditInvoice {...props} />
    </Suspense>
  );
}

async function EditInvoice({ params }: Props) {
  await requireFinance();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const [{ data: invoice }, options, settings] = await Promise.all([
    supabase.from("invoices").select("*, invoice_items(description, qty, unit_price, position)").eq("id", id).maybeSingle(),
    loadFormOptions(supabase),
    supabase.from("settings").select("default_due_days").maybeSingle(),
  ]);
  if (!invoice) notFound();
  // Paid, partly paid and void invoices are locked (also enforced in the database).
  if (!["draft", "sent"].includes(invoice.status) || invoice.amount_paid > 0) redirect(`/invoices/${id}`);

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/invoices/${id}`} className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Back to {invoice.number}
      </Link>
      <InvoiceEditor
        invoiceId={invoice.id}
        clients={options.clients}
        projects={options.projects}
        defaultDueDays={settings.data?.default_due_days ?? 7}
        initial={{
          client_id: invoice.client_id,
          project_id: invoice.project_id ?? "",
          issue_date: invoice.issue_date,
          due_date: invoice.due_date,
          currency: invoice.currency,
          discount: invoice.discount / 100,
          tax_rate: Number(invoice.tax_rate),
          notes: invoice.notes ?? "",
          items: [...invoice.invoice_items].sort((a, b) => a.position - b.position).map((item) => ({ description: item.description, qty: Number(item.qty), unit_price: item.unit_price / 100 })),
          status: invoice.status === "sent" ? "sent" : "draft",
        }}
      />
    </div>
  );
}
