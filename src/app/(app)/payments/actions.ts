"use server";

import { z } from "zod";
import { action, must } from "@/lib/action";
import { transactionSchema } from "@/lib/validation";
import { toMinor } from "@/lib/money";
import { emptyToNull } from "@/lib/utils";

function toRow(input: z.output<typeof transactionSchema>) {
  return {
    type: input.type,
    amount: toMinor(input.amount),
    tax_withheld: input.type === "income" ? toMinor(input.tax_withheld ?? 0) : 0,
    currency: input.currency,
    date: input.date,
    category: input.category,
    method: input.method,
    reference: emptyToNull(input.reference ?? ""),
    description: emptyToNull(input.description ?? ""),
    client_id: emptyToNull(input.client_id ?? ""),
    project_id: emptyToNull(input.project_id ?? ""),
    subscription_id: emptyToNull(input.subscription_id ?? ""),
    employee_id: emptyToNull(input.employee_id ?? ""),
    receipt_url: emptyToNull(input.receipt_url ?? ""),
    notes: emptyToNull(input.notes ?? ""),
  };
}

export const createTransactionAction = action("finance", transactionSchema, async (input, { supabase }) => {
  must(await supabase.from("transactions").insert(toRow(input)));
});

export const updateTransactionAction = action("finance", transactionSchema.safeExtend({ id: z.guid() }), async ({ id, ...input }, { supabase }) => {
  must(await supabase.from("transactions").update(toRow(input)).eq("id", id));
});

/** Owner only — managers cannot delete financial records (also enforced by RLS). */
export const deleteTransactionAction = action("owner", z.object({ id: z.guid() }), async ({ id }, { supabase }) => {
  const tx = must(await supabase.from("transactions").select("receipt_url").eq("id", id).single());
  must(await supabase.from("transactions").delete().eq("id", id));
  if (tx.receipt_url) await supabase.storage.from("receipts").remove([tx.receipt_url]);
});
