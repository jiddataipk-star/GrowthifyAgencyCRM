"use server";

import { z } from "zod";
import { action, must } from "@/lib/action";

const fileSchema = z.object({
  entity: z.enum(["client", "project", "invoice", "transaction", "employee"]),
  entity_id: z.guid(),
  path: z.string().min(3).max(500),
  name: z.string().min(1).max(200),
  size: z.number().int().min(0),
  mime_type: z.string().max(120).optional(),
});

/** Record an uploaded file (the object itself was uploaded by the browser under RLS). */
export const addFile = action("member", fileSchema, async (input, { supabase }) => {
  if (!input.path.startsWith(`${input.entity}/${input.entity_id}/`)) {
    throw new Error("File path doesn't match its record.");
  }
  must(await supabase.from("files").insert({ ...input, bucket: "files" }));
});

export const deleteFile = action("member", z.object({ id: z.guid() }), async ({ id }, { supabase }) => {
  const file = must(await supabase.from("files").select("id, path, bucket").eq("id", id).single());
  must(await supabase.from("files").delete().eq("id", id));
  await supabase.storage.from(file.bucket).remove([file.path]);
});
