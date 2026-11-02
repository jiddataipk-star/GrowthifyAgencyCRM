import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireFinance } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadFormOptions } from "@/lib/data/lookups";
import { addDays, todayPK } from "@/lib/dates";
import { isUuid, param } from "@/lib/utils";
import { PageSkeleton } from "@/components/ui/feedback";
import { InvoiceEditor } from "../invoice-editor";

export const metadata: Metadata = { title: "New invoice" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function NewInvoicePage(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton kpis={0} />}>
      <NewInvoice {...props} />
    </Suspense>
  );
}

async function NewInvoice({ searchParams }: Props) {
  await requireFinance();
  const params = await searchParams;
  const supabase = await createClient();
  const [options, settings] = await Promise.all([
    loadFormOptions(supabase),
    supabase.from("settings").select("default_tax_rate, default_due_days, default_currency").maybeSingle(),
  ]);
  const today = todayPK();
  const dueDays = settings.data?.default_due_days ?? 7;
  const client = param(params.client);
  const project = param(params.project);
  const projectRow = isUuid(project) ? options.projects.find((p) => p.id === project) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/invoices" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> All invoices
      </Link>
      <InvoiceEditor
        clients={options.clients}
        projects={options.projects}
        defaultDueDays={dueDays}
        initial={{
          client_id: projectRow?.client_id ?? (isUuid(client) ? client : ""),
          project_id: projectRow?.id ?? "",
          issue_date: today,
          due_date: addDays(today, dueDays),
          currency: (projectRow?.currency as "PKR" | "USD" | undefined) ?? settings.data?.default_currency ?? "PKR",
          discount: 0,
          tax_rate: Number(settings.data?.default_tax_rate ?? 0),
          notes: "",
          items: [{ description: "", qty: 1, unit_price: 0 }],
          status: "draft",
        }}
      />
    </div>
  );
}
