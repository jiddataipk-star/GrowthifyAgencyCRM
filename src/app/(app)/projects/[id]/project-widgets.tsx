"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Flag, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Confirm } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/feedback";
import { Pill } from "@/components/ui/pill";
import { DueFormDialog, DueMenu, DuePayButton } from "../../collections/due-dialogs";
import { dueState } from "@/lib/collections";
import type { Option } from "@/lib/data/lookups";
import { projectStatusOptions } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { dueLabel, formatDayMonth } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Enums, Tables } from "@/types/db";
import { addTaskAction, deleteProjectAction, deleteTaskAction, toggleTaskAction, updateProjectProgressAction } from "../actions";

/* ── Status + progress (staff can use this on their projects) ──────────── */
export function ProgressControl({ id, status, progress }: { id: string; status: Enums<"project_status">; progress: number }) {
  const [value, setValue] = React.useState(progress);
  const [state, setState] = React.useState(status);
  const [pending, startTransition] = React.useTransition();
  const dirty = value !== progress || state !== status;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <p className="font-display text-card font-bold">Where it stands</p>
        <span className="font-display tabular text-2xl font-bold text-primary">{value}%</span>
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
        className="w-full cursor-pointer accent-[var(--primary)]"
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
        <p className="font-display text-card font-bold">Tasks</p>
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
                className="shrink-0 text-muted hover:text-primary"
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

/* ── Payment schedule (finance only) ─────────────────────────────────── */
type ScheduleDue = Tables<"dues">;

export function PaymentScheduleCard({
  projectId,
  clientId,
  clientName,
  currency,
  contractValue,
  dues,
  today,
  options,
}: {
  projectId: string;
  clientId: string;
  clientName: string;
  currency: Enums<"currency_code">;
  contractValue: number;
  dues: ScheduleDue[];
  today: string;
  options: { clients: Option[]; projects: (Option & { client_id: string; currency: string })[] };
}) {
  const live = dues.filter((d) => d.status !== "cancelled");
  const scheduled = live.reduce((sum, d) => sum + d.amount, 0);
  const received = live.reduce((sum, d) => sum + d.amount_paid, 0);
  const left = contractValue - scheduled;

  return (
    <Card>
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="font-display text-card font-bold">Payment schedule</p>
        <DueFormDialog clients={options.clients} projects={options.projects} preset={{ clientId, projectId }} trigger={<Button size="sm" variant="secondary"><Plus /> Add payment</Button>} />
      </div>
      <p className="mb-4 text-[13px] text-muted">
        <span className="font-semibold text-success">{formatMoney(received, currency)} received</span> of {formatMoney(scheduled, currency)} scheduled
        {contractValue && left > 0 ? <span> · {formatMoney(left, currency)} of the contract not scheduled yet</span> : null}
      </p>
      {dues.length === 0 ? (
        <EmptyState compact icon={<Flag />} title="No payments scheduled" description="Split the contract, e.g. 50% advance and 50% on delivery. Each one shows in Collections." />
      ) : (
        <ul className="divide-y divide-line">
          {dues.map((d) => {
            const state = dueState(d, today);
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm font-semibold", d.status === "cancelled" && "text-muted line-through")}>{d.title}</p>
                  <p className={cn("text-xs", state === "overdue" ? "font-semibold text-danger" : "text-muted")}>
                    {d.status === "paid" ? `Paid ${d.paid_at ? formatDayMonth(d.paid_at.slice(0, 10)) : ""}` : d.status === "cancelled" ? "Cancelled" : dueLabel(d.due_date, today)}
                    {d.status === "pending" && d.amount_paid ? ` · ${formatMoney(d.amount_paid, d.currency)} received` : ""}
                  </p>
                </div>
                <span className="tabular text-sm font-bold">{formatMoney(d.amount, d.currency)}</span>
                {d.status === "paid" ? <Pill tone="success">Paid</Pill> : d.status === "pending" ? <DuePayButton due={d} payer={clientName} /> : <Pill>Cancelled</Pill>}
                <DueMenu due={d} clients={options.clients} projects={options.projects} />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
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
        description="Tasks and team assignments are removed. Payment requests and recorded payments stay, without the project link. This cannot be undone."
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

