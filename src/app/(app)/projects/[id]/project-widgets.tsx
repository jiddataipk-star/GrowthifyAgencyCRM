"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Flag, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, FormGrid, Input, Select } from "@/components/ui/form";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Confirm } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/feedback";
import { Pill } from "@/components/ui/pill";
import { PaymentDialog } from "@/components/app/payment-dialog";
import { projectStatusOptions } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { dueLabel, formatDayMonth } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Enums, Tables } from "@/types/db";
import {
  addTaskAction,
  deleteMilestoneAction,
  deleteProjectAction,
  deleteTaskAction,
  markMilestonePaidAction,
  saveMilestoneAction,
  toggleTaskAction,
  updateProjectProgressAction,
} from "../actions";

/* ── Status + progress (staff can use this on their projects) ──────────── */
export function ProgressControl({ id, status, progress }: { id: string; status: Enums<"project_status">; progress: number }) {
  const [value, setValue] = React.useState(progress);
  const [state, setState] = React.useState(status);
  const [pending, startTransition] = React.useTransition();
  const dirty = value !== progress || state !== status;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-card font-bold">Where it stands</p>
        <span className="tabular text-2xl font-extrabold text-accent-fg">{value}%</span>
      </div>
      <label htmlFor="progress-range" className="sr-only">Progress</label>
      <input
        id="progress-range"
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(event) => setValue(Number(event.target.value))}
        className="w-full cursor-pointer accent-[var(--accent)]"
      />
      <div className="mt-4 flex gap-3">
        <Select aria-label="Status" options={projectStatusOptions} value={state} onChange={(event) => setState(event.target.value as Enums<"project_status">)} className="h-11" />
        <Button
          size="md"
          disabled={!dirty}
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await updateProjectProgressAction({ id, status: state, progress: state === "delivered" ? 100 : value });
              if (result.ok) toast.success("Project updated");
              else toast.error(result.error);
            })
          }
        >
          Save
        </Button>
      </div>
    </Card>
  );
}

/* ── Tasks checklist ──────────────────────────────────────────────────── */
type TaskRow = { id: string; title: string; done: boolean; due_date: string | null; assignee_id: string | null };

export function TasksCard({ projectId, tasks, team, today }: { projectId: string; tasks: TaskRow[]; team: { id: string; name: string }[]; today: string }) {
  const [optimistic, setOptimistic] = React.useOptimistic(tasks, (state, update: { id: string; done: boolean }) =>
    state.map((task) => (task.id === update.id ? { ...task, done: update.done } : task)),
  );
  const [, startTransition] = React.useTransition();
  const { register, handleSubmit, reset, formState } = useForm({ defaultValues: { title: "", assignee_id: "", due_date: "" } });
  const names = Object.fromEntries(team.map((m) => [m.id, m.name]));
  const done = optimistic.filter((t) => t.done).length;

  const add = handleSubmit(async (values) => {
    if (!values.title.trim()) return;
    const result = await addTaskAction({ project_id: projectId, ...values });
    if (result.ok) reset();
    else toast.error(result.error);
  });

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-card font-bold">Tasks</p>
        <span className="text-sm font-semibold text-muted">{optimistic.length ? `${done} of ${optimistic.length} done` : "No tasks"}</span>
      </div>
      <form onSubmit={add} className="mb-4 space-y-2.5">
        <Input aria-label="New task" placeholder="Add a task…" className="h-11" {...register("title")} />
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2.5">
          <Select aria-label="Assignee" placeholder="Unassigned" options={team.map((m) => ({ value: m.id, label: m.name }))} className="h-11" {...register("assignee_id")} />
          <Input aria-label="Due date" type="date" className="h-11" {...register("due_date")} />
          <Button type="submit" size="md" loading={formState.isSubmitting} aria-label="Add task">
            <Plus /> <span className="hidden sm:inline">Add</span>
          </Button>
        </div>
      </form>
      {optimistic.length === 0 ? (
        <EmptyState compact icon={<CheckCircle2 />} title="No tasks yet" description="Break the work into a simple checklist." />
      ) : (
        <ul className="divide-y divide-line">
          {optimistic.map((task) => (
            <li key={task.id} className="group flex items-center gap-3 py-2.5">
              <button
                type="button"
                aria-pressed={task.done}
                aria-label={task.done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
                onClick={() =>
                  startTransition(async () => {
                    setOptimistic({ id: task.id, done: !task.done });
                    const result = await toggleTaskAction({ id: task.id, done: !task.done });
                    if (!result.ok) toast.error(result.error);
                  })
                }
                className="shrink-0 text-muted hover:text-accent-fg"
              >
                {task.done ? <CheckCircle2 className="size-5 text-success" /> : <Circle className="size-5" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm font-semibold", task.done && "text-muted line-through")}>{task.title}</p>
                <p className="text-xs text-muted">
                  {task.assignee_id ? names[task.assignee_id] ?? "Former member" : "Unassigned"}
                  {task.due_date ? (
                    <span className={!task.done && task.due_date < today ? "font-semibold text-danger" : undefined}> · {task.done ? formatDayMonth(task.due_date) : dueLabel(task.due_date, today)}</span>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const result = await deleteTaskAction({ id: task.id });
                  if (!result.ok) toast.error(result.error);
                }}
                className="rounded-full p-1.5 text-muted opacity-0 group-hover:opacity-100 hover:text-danger focus-visible:opacity-100"
                aria-label={`Delete task ${task.title}`}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ── Milestones (finance only) ────────────────────────────────────────── */
export function MilestonesCard({
  projectId,
  currency,
  contractValue,
  milestones,
  today,
  canDeletePaid,
}: {
  projectId: string;
  currency: Enums<"currency_code">;
  contractValue: number;
  milestones: Tables<"milestones">[];
  today: string;
  canDeletePaid: boolean;
}) {
  const scheduled = milestones.reduce((sum, m) => sum + m.amount, 0);
  const paid = milestones.filter((m) => m.paid).reduce((sum, m) => sum + m.amount, 0);
  const [remove, setRemove] = React.useState<Tables<"milestones"> | null>(null);

  return (
    <Card>
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="text-card font-bold">Milestones</p>
        <MilestoneDialog projectId={projectId} currency={currency} trigger={<Button size="sm" variant="secondary"><Plus /> Add</Button>} />
      </div>
      <p className="mb-4 text-sm text-muted">
        <span className="font-semibold text-success">{formatMoney(paid, currency)} received</span> of {formatMoney(scheduled, currency)} scheduled
        {contractValue && scheduled !== contractValue ? ` · contract ${formatMoney(contractValue, currency)}` : ""}
      </p>
      {milestones.length === 0 ? (
        <EmptyState compact icon={<Flag />} title="No milestones" description="Split the contract into payments, e.g. 50% advance and 50% on delivery." />
      ) : (
        <ul className="divide-y divide-line">
          {milestones.map((m) => {
            const overdue = !m.paid && m.due_date && m.due_date < today;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{m.name}</p>
                  <p className={cn("text-xs", overdue ? "font-semibold text-danger" : "text-muted")}>
                    {m.due_date ? (m.paid ? `Due ${formatDayMonth(m.due_date)}` : dueLabel(m.due_date, today)) : "No due date"}
                  </p>
                </div>
                <span className="tabular text-sm font-bold">{formatMoney(m.amount, currency)}</span>
                {m.paid ? (
                  <Pill tone="success">Paid</Pill>
                ) : (
                  <PaymentDialog
                    title={`Mark "${m.name}" paid`}
                    description={`Records ${formatMoney(m.amount, currency)} as project income.`}
                    currency={currency}
                    amount={m.amount}
                    submitLabel="Mark paid"
                    trigger={<Button variant="outline" size="pill" disabled={m.amount <= 0}>Mark paid</Button>}
                    onSubmit={(values) =>
                      markMilestonePaidAction({
                        id: m.id,
                        paid_on: values.paid_on,
                        method: values.method as never,
                        reference: values.reference,
                        receipt_url: values.receipt_url,
                        notes: values.notes,
                      })
                    }
                  />
                )}
                {!m.paid ? (
                  <MilestoneDialog
                    projectId={projectId}
                    currency={currency}
                    milestone={m}
                    trigger={
                      <button type="button" className="rounded-full p-1.5 text-muted hover:text-fg" aria-label={`Edit ${m.name}`}>
                        <Pencil className="size-4" />
                      </button>
                    }
                  />
                ) : null}
                {!m.paid || canDeletePaid ? (
                  <button type="button" onClick={() => setRemove(m)} className="rounded-full p-1.5 text-muted hover:text-danger" aria-label={`Delete ${m.name}`}>
                    <Trash2 className="size-4" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <Confirm
        open={remove !== null}
        onOpenChange={(open) => !open && setRemove(null)}
        title={`Delete milestone "${remove?.name}"?`}
        description={remove?.paid ? "Its income transaction stays in Payments. Delete that separately if it was recorded by mistake." : undefined}
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (!remove) return;
          const result = await deleteMilestoneAction({ id: remove.id });
          if (!result.ok) toast.error(result.error);
        }}
      />
    </Card>
  );
}

function MilestoneDialog({
  projectId,
  currency,
  milestone,
  trigger,
}: {
  projectId: string;
  currency: string;
  milestone?: Tables<"milestones">;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const defaults = { name: milestone?.name ?? "", amount: milestone ? String(milestone.amount / 100) : "", due_date: milestone?.due_date ?? "" };
  const { register, handleSubmit, reset, formState, setError } = useForm({ defaultValues: defaults });
  const submit = handleSubmit(async (values) => {
    const result = await saveMilestoneAction({ id: milestone?.id, project_id: projectId, ...values });
    if (!result.ok) {
      for (const [name, message] of Object.entries(result.fieldErrors ?? {})) setError(name as "name", { message });
      toast.error(result.error);
      return;
    }
    toast.success(milestone ? "Milestone updated" : "Milestone added");
    setOpen(false);
  });
  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) reset(defaults); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={milestone ? "Edit milestone" : "Add milestone"} size="sm">
        <form onSubmit={submit} noValidate>
          <FormGrid className="sm:grid-cols-1">
            <Field label="Name" htmlFor="ms-name" error={formState.errors.name?.message}>
              <Input placeholder="e.g. Advance 50%" {...register("name")} />
            </Field>
            <Field label={`Amount (${currency})`} htmlFor="ms-amount" error={formState.errors.amount?.message}>
              <Input type="number" inputMode="decimal" min="0" step="0.01" {...register("amount")} />
            </Field>
            <Field label="Due date" htmlFor="ms-due" error={formState.errors.due_date?.message}>
              <Input type="date" {...register("due_date")} />
            </Field>
          </FormGrid>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" size="lg" loading={formState.isSubmitting}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectDangerZone({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="danger-outline" size="sm" onClick={() => setOpen(true)}>
        <Trash2 /> Delete
      </Button>
      <Confirm
        open={open}
        onOpenChange={setOpen}
        title={`Delete "${title}"?`}
        description="Tasks, milestones and team assignments are removed. Recorded payments stay in Payments without the project link. This cannot be undone."
        confirmLabel="Delete project"
        danger
        onConfirm={async () => {
          const result = await deleteProjectAction({ id });
          if (result.ok) {
            toast.success("Project deleted");
            router.push("/projects");
          } else toast.error(result.error);
        }}
      />
    </>
  );
}

