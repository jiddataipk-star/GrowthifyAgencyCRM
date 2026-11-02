"use server";

import { z } from "zod";
import { action, must } from "@/lib/action";
import { convertLeadSchema, leadSchema, leadStage } from "@/lib/validation";
import { toMinor } from "@/lib/money";
import { emptyToNull } from "@/lib/utils";

function toRow(input: z.output<typeof leadSchema>) {
  return {
    name: input.name,
    business: emptyToNull(input.business ?? ""),
    phone: emptyToNull(input.phone ?? ""),
    email: emptyToNull(input.email ?? ""),
    city: emptyToNull(input.city ?? ""),
    source: input.source,
    service_interest: input.service_interest ? input.service_interest : null,
    est_value: toMinor(input.est_value),
    currency: input.currency,
    stage: input.stage,
    next_follow_up: emptyToNull(input.next_follow_up ?? ""),
    notes: emptyToNull(input.notes ?? ""),
    lost_reason: emptyToNull(input.lost_reason ?? ""),
  };
}

export const createLeadAction = action("finance", leadSchema, async (input, { supabase }) => {
  must(await supabase.from("leads").insert({ ...toRow(input), position: Date.now() / 1000 }));
});

export const updateLeadAction = action("finance", leadSchema.extend({ id: z.guid() }), async ({ id, ...input }, { supabase }) => {
  must(await supabase.from("leads").update(toRow(input)).eq("id", id));
});

/** Drag & drop between pipeline stages. */
export const moveLeadAction = action("finance", z.object({ id: z.guid(), stage: leadStage }), async ({ id, stage }, { supabase }) => {
  must(await supabase.from("leads").update({ stage, position: Date.now() / 1000 }).eq("id", id));
});

export const deleteLeadAction = action("finance", z.object({ id: z.guid() }), async ({ id }, { supabase }) => {
  must(await supabase.from("leads").delete().eq("id", id));
});

/** Creates the client (and optionally a first project) and marks the lead as won. */
export const convertLeadAction = action("finance", convertLeadSchema, async (input, { supabase }) => {
  const project = input.create_project && input.title
    ? {
        title: input.title,
        service_type: input.service_type || "",
        value: input.value !== undefined ? toMinor(input.value) : null,
        currency: input.currency ?? "PKR",
        deadline: input.deadline || "",
      }
    : undefined;
  const clientId = must(await supabase.rpc("convert_lead", { p_lead_id: input.lead_id, p_project: project }));
  return { clientId: clientId as string };
});
