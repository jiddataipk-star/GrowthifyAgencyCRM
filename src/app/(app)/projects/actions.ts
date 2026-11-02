"use server";

import { z } from "zod";
import { action, must } from "@/lib/action";
import { projectSchema, taskSchema } from "@/lib/validation";
import { toMinor } from "@/lib/money";
import { emptyToNull } from "@/lib/utils";

type ProjectValues = z.output<typeof projectSchema>;

function toRow(input: ProjectValues) {
  const links = Object.fromEntries(
    (["repo", "staging", "live"] as const).filter((key) => input[key]).map((key) => [key, input[key] as string]),
  );
  return {
    client_id: input.client_id,
    title: input.title,
    service_type: input.service_type,
    value: toMinor(input.value),
    currency: input.currency,
    start_date: emptyToNull(input.start_date ?? ""),
    deadline: emptyToNull(input.deadline ?? ""),
    status: input.status,
    progress: input.progress,
    links,
    notes: emptyToNull(input.notes ?? ""),
  };
}

export const createProjectAction = action("finance", projectSchema, async (input, { supabase }) => {
  const project = must(await supabase.from("projects").insert(toRow(input)).select("id").single());
  if (input.member_ids.length) {
    must(await supabase.from("project_members").insert(input.member_ids.map((team_member_id) => ({ project_id: project.id, team_member_id }))));
  }
  return { id: project.id };
});

export const updateProjectAction = action("finance", projectSchema.safeExtend({ id: z.guid() }), async ({ id, ...input }, { supabase }) => {
  must(await supabase.from("projects").update(toRow(input)).eq("id", id));
  const current = must(await supabase.from("project_members").select("team_member_id").eq("project_id", id));
  const existing = new Set(current.map((row) => row.team_member_id));
  const wanted = new Set(input.member_ids);
  const toAdd = [...wanted].filter((m) => !existing.has(m));
  const toRemove = [...existing].filter((m) => !wanted.has(m));
  if (toAdd.length) must(await supabase.from("project_members").insert(toAdd.map((team_member_id) => ({ project_id: id, team_member_id }))));
  if (toRemove.length) must(await supabase.from("project_members").delete().eq("project_id", id).in("team_member_id", toRemove));
});

/** Delivery fields — staff assigned to the project may update these. */
export const updateProjectProgressAction = action(
  "member",
  z.object({
    id: z.guid(),
    status: z.enum(["planning", "in_progress", "review", "delivered", "on_hold"]),
    progress: z.coerce.number().int().min(0).max(100),
  }),
  async ({ id, ...values }, { supabase }) => {
    must(await supabase.from("projects").update(values).eq("id", id));
  },
);

export const deleteProjectAction = action("owner", z.object({ id: z.guid() }), async ({ id }, { supabase }) => {
  must(await supabase.from("projects").delete().eq("id", id));
});

/* ── Tasks ────────────────────────────────────────────────────────────── */
export const addTaskAction = action("member", taskSchema, async (input, { supabase }) => {
  const { count } = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("project_id", input.project_id);
  must(
    await supabase.from("tasks").insert({
      project_id: input.project_id,
      title: input.title,
      assignee_id: emptyToNull(input.assignee_id ?? ""),
      due_date: emptyToNull(input.due_date ?? ""),
      position: count ?? 0,
    }),
  );
});

export const toggleTaskAction = action("member", z.object({ id: z.guid(), done: z.boolean() }), async ({ id, done }, { supabase }) => {
  must(await supabase.from("tasks").update({ done }).eq("id", id));
});

export const deleteTaskAction = action("member", z.object({ id: z.guid() }), async ({ id }, { supabase }) => {
  must(await supabase.from("tasks").delete().eq("id", id));
});
