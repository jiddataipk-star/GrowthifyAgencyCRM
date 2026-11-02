"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { action, must } from "@/lib/action";
import { invoicePaymentSchema, invoiceSchema } from "@/lib/validation";
import { toMinor } from "@/lib/money";

/** Create or update an invoice and its line items in one database transaction. */
export const saveInvoiceAction = action("finance", invoiceSchema.safeExtend({ id: z.guid().optional() }), async ({ id, items, ...input }, { supabase }) => {
  const invoiceId = must(
    await supabase.rpc("save_invoice", {
      // NULL creates a new invoice.
      p_invoice_id: id ?? (null as unknown as string),
      p_data: {
        client_id: input.client_id,
        project_id: input.project_id || "",
        issue_date: input.issue_date,
        due_date: input.due_date,
        currency: input.currency,
        discount: toMinor(input.discount ?? 0),
        tax_rate: input.tax_rate,
        notes: input.notes ?? "",
        status: input.status,
      },
      p_items: items.map((item) => ({ description: item.description, qty: item.qty, unit_price: toMinor(item.unit_price) })),
    }),
  );
  return { id: invoiceId as string };
});

export const markInvoiceSentAction = action("finance", z.object({ id: z.guid() }), async ({ id }, { supabase }) => {
  must(await supabase.from("invoices").update({ status: "sent" }).eq("id", id).eq("status", "draft"));
});

export const voidInvoiceAction = action("finance", z.object({ id: z.guid() }), async ({ id }, { supabase }) => {
  const invoice = must(await supabase.from("invoices").select("amount_paid").eq("id", id).single());
  if (invoice.amount_paid > 0) {
    return { ok: false, error: "This invoice has payments. Delete or move the payments first, then void it." } as const;
  }
  must(await supabase.from("invoices").update({ status: "void" }).eq("id", id));
});

export const deleteInvoiceAction = action("finance", z.object({ id: z.guid() }), async ({ id }, { supabase }) => {
  const { count } = must(await supabase.from("invoices").delete({ count: "exact" }).eq("id", id));
  if (!count) return { ok: false, error: "Only draft invoices (or any invoice, for the owner) can be deleted." } as const;
});

export const recordInvoicePaymentAction = action("finance", invoicePaymentSchema, async (input, { supabase }) => {
  must(
    await supabase.rpc("record_invoice_payment", {
      p_invoice_id: input.id,
      p_amount: toMinor(input.amount),
      p_tax_withheld: toMinor(input.tax_withheld ?? 0),
      p_paid_on: input.paid_on,
      p_method: input.method,
      p_reference: input.reference || undefined,
      p_receipt_url: input.receipt_url || undefined,
      p_notes: input.notes || undefined,
    }),
  );
});

/** Revoke the old public link by issuing a new share token. */
export const regenerateShareLinkAction = action("finance", z.object({ id: z.guid() }), async ({ id }, { supabase }) => {
  must(await supabase.from("invoices").update({ share_token: randomUUID() }).eq("id", id));
});
