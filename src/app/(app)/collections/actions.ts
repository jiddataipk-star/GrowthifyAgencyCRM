"use server";

import { z } from "zod";
import { action, must } from "@/lib/action";
import { duePaymentSchema, dueSchema } from "@/lib/validation";
import { toMinor } from "@/lib/money";
import { emptyToNull } from "@/lib/utils";

function toRow(input: z.output<typeof dueSchema>) {
  return {
    client_id: emptyToNull(input.client_id ?? ""),
    payer_name: input.client_id ? null : emptyToNull(input.payer_name ?? ""),
    payer_phone: input.client_id ? null : emptyToNull(input.payer_phone ?? ""),
    title: input.title,
    amount: toMinor(input.amount),
    currency: input.currency,
    due_date: input.due_date,
    project_id: emptyToNull(input.project_id ?? ""),
    notes: emptyToNull(input.notes ?? ""),
  };
}

/** Add "who owes us what, for what, by when". */
export const createDueAction = action("finance", dueSchema, async (input, { supabase }) => {
  const row = toRow(input);
  let position = 0;
  if (row.project_id) {
    const { count } = await supabase.from("dues").select("id", { count: "exact", head: true }).eq("project_id", row.project_id);
    position = count ?? 0;
  }
  must(await supabase.from("dues").insert({ ...row, position }));
});

export const updateDueAction = action("finance", dueSchema.safeExtend({ id: z.guid() }), async ({ id, ...input }, { supabase }) => {
  must(await supabase.from("dues").update(toRow(input)).eq("id", id));
});

/** Money received (full or part). Recorded as an income transaction with name, time, TID and screenshot. */
export const recordDuePaymentAction = action("finance", duePaymentSchema, async (input, { supabase }) => {
  must(
    await supabase.rpc("record_due_payment", {
      p_due_id: input.id,
      p_amount: toMinor(input.amount),
      p_paid_on: input.paid_on,
      p_method: input.method,
      p_reference: input.reference || undefined,
      p_receipt_url: input.receipt_url || undefined,
      p_notes: input.notes || undefined,
      p_time: input.time || undefined,
      p_party_name: input.party_name || undefined,
      p_settle: input.settle,
    }),
  );
});

/** Client won't pay / no longer needed. Payments already received stay recorded. */
export const cancelDueAction = action(
  "finance",
  z.object({ id: z.guid(), reason: z.string().trim().max(300).optional() }),
  async ({ id, reason }, { supabase }) => {
    must(await supabase.from("dues").update({ status: "cancelled", cancel_reason: reason || null }).eq("id", id));
  },
);

export const reopenDueAction = action("finance", z.object({ id: z.guid() }), async ({ id }, { supabase }) => {
  must(await supabase.from("dues").update({ status: "pending", adjustment: 0 }).eq("id", id));
});

/** Delete a request that has no payments (owners can delete any; payments then lose the link). */
export const deleteDueAction = action("finance", z.object({ id: z.guid() }), async ({ id }, { supabase }) => {
  const { count } = must(await supabase.from("dues").delete({ count: "exact" }).eq("id", id));
  if (!count) return { ok: false, error: "This request has payments recorded. Cancel it instead, or ask the owner." } as const;
});
