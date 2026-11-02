"use server";

import { z } from "zod";
import { action, must } from "@/lib/action";
import { clientSchema } from "@/lib/validation";
import { emptyToNull } from "@/lib/utils";

function toRow(input: z.output<typeof clientSchema>) {
  return {
    business_name: input.business_name,
    contact_name: emptyToNull(input.contact_name ?? ""),
    phone: emptyToNull(input.phone ?? ""),
    whatsapp: emptyToNull(input.whatsapp ?? "") ?? emptyToNull(input.phone ?? ""),
    email: emptyToNull(input.email ?? ""),
    city: emptyToNull(input.city ?? ""),
    country: input.country || "Pakistan",
    address: emptyToNull(input.address ?? ""),
    ntn: emptyToNull(input.ntn ?? ""),
    niche: input.niche,
    source: input.source,
    status: input.status,
    tags: (input.tags ?? "")
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 12),
    notes: emptyToNull(input.notes ?? ""),
    logo_url: emptyToNull(input.logo_url ?? ""),
  };
}

export const createClientAction = action("finance", clientSchema, async (input, { supabase }) => {
  const row = must(await supabase.from("clients").insert(toRow(input)).select("id").single());
  return { id: row.id };
});

export const updateClientAction = action("finance", clientSchema.extend({ id: z.guid() }), async ({ id, ...input }, { supabase }) => {
  must(await supabase.from("clients").update(toRow(input)).eq("id", id));
});

export const archiveClientAction = action("finance", z.object({ id: z.guid(), archived: z.boolean() }), async ({ id, archived }, { supabase }) => {
  must(
    await supabase
      .from("clients")
      .update({ archived_at: archived ? new Date().toISOString() : null, ...(archived ? { status: "former" as const } : {}) })
      .eq("id", id),
  );
});

export const deleteClientAction = action("owner", z.object({ id: z.guid() }), async ({ id }, { supabase }) => {
  must(await supabase.from("clients").delete().eq("id", id));
});
