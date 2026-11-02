"use server";

import { z } from "zod";
import { action, must } from "@/lib/action";
import { markPaidSchema, planSchema, startSubscriptionSchema, subscriptionSchema } from "@/lib/validation";
import { toMinor } from "@/lib/money";
import { emptyToNull } from "@/lib/utils";

function toRow(input: z.output<typeof subscriptionSchema>) {
  return {
    client_id: input.client_id,
    plan_id: emptyToNull(input.plan_id ?? ""),
    name: input.name,
    service_type: input.service_type,
    service_ref: emptyToNull(input.service_ref ?? ""),
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

/** One step: (new) client + subscription + optional first payment — all or nothing. */
export const startSubscriptionAction = action("finance", startSubscriptionSchema, async (input, { supabase }) => {
  const id = must(
    await supabase.rpc("start_subscription", {
      p_data: {
        client_id: input.client_id || "",
        new_client: input.client_id
          ? null
          : { business_name: input.new_business_name ?? "", contact_name: input.new_contact_name ?? "", phone: input.new_phone ?? "", city: input.new_city ?? "" },
        plan_id: input.plan_id || "",
        name: input.name,
        service_type: input.service_type,
        amount: toMinor(input.amount),
        currency: input.currency,
        interval_months: input.interval_months,
        start_date: input.start_date,
        service_ref: input.service_ref ?? "",
        notes: input.notes ?? "",
        paid_now: input.paid_now,
        payment: {
          method: input.method,
          reference: input.reference ?? "",
          party_name: input.party_name ?? "",
          paid_on: input.paid_on || input.start_date,
          time: input.time ?? "",
          receipt_url: input.receipt_url ?? "",
        },
      },
    }),
  );
  return { id: id as string };
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
      p_time: input.time || undefined,
      p_party_name: input.party_name || undefined,
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
