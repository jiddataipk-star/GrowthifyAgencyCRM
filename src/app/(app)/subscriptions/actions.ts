"use server";

import { z } from "zod";
import { action, must } from "@/lib/action";
import { markPaidSchema, planSchema, subscriptionSchema } from "@/lib/validation";
import { toMinor } from "@/lib/money";
import { emptyToNull } from "@/lib/utils";

function toRow(input: z.output<typeof subscriptionSchema>) {
  return {
    client_id: input.client_id,
    plan_id: emptyToNull(input.plan_id ?? ""),
    name: input.name,
    service_type: input.service_type,
    amount: toMinor(input.amount),
    currency: input.currency,
    interval_months: input.interval_months,
    billing_day: input.billing_day,
    start_date: input.start_date,
    next_due_date: input.next_due_date,
    status: input.status,
    notes: emptyToNull(input.notes ?? ""),
  };
}

export const createSubscriptionAction = action("finance", subscriptionSchema, async (input, { supabase }) => {
  must(await supabase.from("subscriptions").insert(toRow(input)));
});

export const updateSubscriptionAction = action("finance", subscriptionSchema.extend({ id: z.guid() }), async ({ id, ...input }, { supabase }) => {
  must(await supabase.from("subscriptions").update(toRow(input)).eq("id", id));
});

export const setSubscriptionStatusAction = action(
  "finance",
  z.object({ id: z.guid(), status: z.enum(["active", "paused", "cancelled"]) }),
  async ({ id, status }, { supabase }) => {
    must(await supabase.from("subscriptions").update({ status }).eq("id", id));
  },
);

export const deleteSubscriptionAction = action("owner", z.object({ id: z.guid() }), async ({ id }, { supabase }) => {
  must(await supabase.from("subscriptions").delete().eq("id", id));
});

/** One click: records the income and moves the next due date forward one cycle. */
export const markSubscriptionPaidAction = action("finance", markPaidSchema, async (input, { supabase }) => {
  must(
    await supabase.rpc("mark_subscription_paid", {
      p_subscription_id: input.id,
      p_paid_on: input.paid_on,
      p_method: input.method,
      p_reference: input.reference || undefined,
      p_receipt_url: input.receipt_url || undefined,
      p_amount: input.amount !== undefined ? toMinor(input.amount) : undefined,
      p_notes: input.notes || undefined,
    }),
  );
});

/* ── Plans catalog ─────────────────────────────────────────────────────── */
export const savePlanAction = action("finance", planSchema.extend({ id: z.guid().optional() }), async ({ id, ...input }, { supabase }) => {
  const row = { ...input, amount: toMinor(input.amount), interval: "month" };
  if (id) must(await supabase.from("plans").update(row).eq("id", id));
  else must(await supabase.from("plans").insert(row));
});

export const deletePlanAction = action("owner", z.object({ id: z.guid() }), async ({ id }, { supabase }) => {
  must(await supabase.from("plans").delete().eq("id", id));
});
