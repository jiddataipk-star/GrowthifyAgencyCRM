"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { dueSchema, type DueInput } from "@/lib/validation";
import { currencyOptions } from "@/lib/constants";
import { addDays, todayPK } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, FormGrid, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { RowMenu, RowMenuItem, RowMenuSeparator } from "@/components/ui/misc";
import { Confirm } from "@/components/ui/confirm";
import { PaymentDialog } from "@/components/app/payment-dialog";
import { applyFieldErrors } from "@/components/app/form-utils";
import type { Option } from "@/lib/data/lookups";
import type { Tables } from "@/types/db";
import { cancelDueAction, createDueAction, deleteDueAction, recordDuePaymentAction, reopenDueAction, updateDueAction } from "./actions";

type ProjectOption = Option & { client_id: string; currency: string };

function defaults(due?: Tables<"dues">, preset?: { clientId?: string; projectId?: string }): DueInput {
  return {
    client_id: due?.client_id ?? preset?.clientId ?? "",
    payer_name: due?.payer_name ?? "",
    payer_phone: due?.payer_phone ?? "",
    title: due?.title ?? "",
    amount: due ? due.amount / 100 : ("" as unknown as number),
    currency: due?.currency ?? "PKR",
    due_date: due?.due_date ?? addDays(todayPK(), 3),
    project_id: due?.project_id ?? preset?.projectId ?? "",
    notes: due?.notes ?? "",
  };
}

/** Add / edit a payment to collect. "Someone else" = no client record needed. */
export function DueFormDialog({
  due,
  clients,
  projects,
  preset,
  trigger,
}: {
  due?: Tables<"dues">;
  clients: Option[];
  projects: ProjectOption[];
  preset?: { clientId?: string; projectId?: string };
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"client" | "person">(due && !due.client_id ? "person" : "client");
  const { register, handleSubmit, formState, setError, reset, watch, setValue } = useForm<DueInput>({
    resolver: zodResolver(dueSchema) as never,
    defaultValues: defaults(due, preset),
  });
  const errors = formState.errors;
  const clientId = watch("client_id");
  const clientProjects = projects.filter((p) => p.client_id === clientId);

  const submit = handleSubmit(async (values) => {
    const payload = mode === "client" ? { ...values, payer_name: "", payer_phone: "" } : { ...values, client_id: "", project_id: "" };
    const result = due ? await updateDueAction({ ...payload, id: due.id }) : await createDueAction(payload);
    if (!result.ok) {
      applyFieldErrors(result.fieldErrors, setError);
      toast.error(result.error);
      return;
    }
    toast.success(due ? "Updated" : "Added to Collections");
    setOpen(false);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          reset(defaults(due, preset));
          setMode(due && !due.client_id ? "person" : "client");
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={due ? "Edit payment to collect" : "Add payment to collect"} description="Who has to pay, how much, for what and by when. It stays in Collections until it's paid or cancelled.">
        <form onSubmit={submit} noValidate>
          {!preset?.projectId ? (
            <div role="radiogroup" aria-label="Who pays" className="mb-5 grid grid-cols-2 gap-1 rounded-control bg-surface-2 p-1">
              {(["client", "person"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={mode === value}
                  onClick={() => setMode(value)}
                  className={cn("h-9 rounded-[9px] text-[13.5px] font-semibold transition-colors", mode === value ? "bg-white text-fg shadow-card" : "text-muted hover:text-fg")}
                >
                  {value === "client" ? "A client" : "Someone else"}
                </button>
              ))}
            </div>
          ) : null}
          <FormGrid>
            {preset?.projectId ? (
              <p className="rounded-control bg-canvas px-3.5 py-2.5 text-sm text-fg-2 sm:col-span-2">
                For project <b className="text-fg">{projects.find((p) => p.id === preset.projectId)?.name ?? "this project"}</b> ·{" "}
                {clients.find((c) => c.id === preset.clientId)?.name}
              </p>
            ) : mode === "client" ? (
              <>
                <Field label="Client" htmlFor="due-client" error={errors.client_id?.message ?? errors.payer_name?.message} required>
                  <Select placeholder="Choose a client" options={clients.map((c) => ({ value: c.id, label: c.name }))} {...register("client_id", { onChange: () => setValue("project_id", "") })} />
                </Field>
                <Field label="Project (optional)" htmlFor="due-project">
                  <Select placeholder="Not for a project" options={clientProjects.map((p) => ({ value: p.id, label: p.name }))} {...register("project_id")} />
                </Field>
              </>
            ) : (
              <>
                <Field label="Name" htmlFor="due-payer" error={errors.payer_name?.message} required>
                  <Input placeholder="Who will pay" {...register("payer_name")} />
                </Field>
                <Field label="WhatsApp / phone" htmlFor="due-phone" error={errors.payer_phone?.message}>
                  <Input inputMode="tel" placeholder="03XX-XXXXXXX" {...register("payer_phone")} />
                </Field>
              </>
            )}
            <Field label="For what" htmlFor="due-title" error={errors.title?.message} required className="sm:col-span-2">
              <Input placeholder="e.g. Advance 50% for website, Logo design, Ads setup fee" {...register("title")} />
            </Field>
            <div className="grid grid-cols-[1fr_96px] gap-3">
              <Field label="Amount" htmlFor="due-amount" error={errors.amount?.message} required>
                <Input type="number" inputMode="decimal" min="0" step="0.01" {...register("amount")} />
              </Field>
              <Field label="Currency" htmlFor="due-currency">
                <Select options={currencyOptions.map((o) => ({ value: o.value, label: o.value }))} {...register("currency")} />
              </Field>
            </div>
            <Field label="Collect by" htmlFor="due-date" error={errors.due_date?.message}>
              <Input type="date" {...register("due_date")} />
            </Field>
            <Field label="Notes" htmlFor="due-notes" className="sm:col-span-2">
              <Textarea rows={2} placeholder="What was promised, how they'll pay…" {...register("notes")} />
            </Field>
          </FormGrid>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" size="lg" loading={formState.isSubmitting}>{due ? "Save" : "Add"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Mark paid button for a due (records the transaction). */
export function DuePayButton({ due, payer, size = "pill" }: { due: Tables<"dues">; payer: string | null; size?: "pill" | "sm" }) {
  const left = Math.max(due.amount - due.amount_paid, 0);
  return (
    <PaymentDialog
      title="Mark paid"
      description={
        <>
          <b className="text-fg">{due.title}</b> · {payer ?? "—"} · {formatMoney(left, due.currency)} {due.amount_paid ? `left of ${formatMoney(due.amount, due.currency)}` : "due"}
        </>
      }
      currency={due.currency}
      amount={left}
      partyName={payer}
      allowSettle
      trigger={<Button variant={size === "pill" ? "outline" : "primary"} size={size}>Mark paid</Button>}
      onSubmit={(values) =>
        recordDuePaymentAction({
          id: due.id,
          amount: values.amount,
          settle: values.settle,
          paid_on: values.paid_on,
          time: values.time,
          method: values.method as never,
          party_name: values.party_name,
          reference: values.reference,
          receipt_url: values.receipt_url,
          notes: values.notes,
        })
      }
    />
  );
}

/** Edit / cancel / reopen / delete menu for a due. */
export function DueMenu({ due, clients, projects }: { due: Tables<"dues">; clients: Option[]; projects: ProjectOption[] }) {
  const editTrigger = React.useRef<HTMLButtonElement>(null);
  const [confirm, setConfirm] = React.useState<null | "cancel" | "delete">(null);
  const [reason, setReason] = React.useState("");
  return (
    <>
      <RowMenu label={`Actions for ${due.title}`}>
        {due.status === "pending" ? <RowMenuItem icon={<Pencil />} onSelect={() => editTrigger.current?.click()}>Edit</RowMenuItem> : null}
        {due.status === "pending" ? <RowMenuItem icon={<Ban />} danger onSelect={() => setConfirm("cancel")}>Cancel payment</RowMenuItem> : null}
        {due.status !== "pending" ? (
          <RowMenuItem
            icon={<RotateCcw />}
            onSelect={async () => {
              const result = await reopenDueAction({ id: due.id });
              if (result.ok) toast.success("Moved back to To collect");
              else toast.error(result.error);
            }}
          >
            Reopen
          </RowMenuItem>
        ) : null}
        <RowMenuSeparator />
        <RowMenuItem icon={<Trash2 />} danger onSelect={() => setConfirm("delete")}>Delete</RowMenuItem>
      </RowMenu>
      <DueFormDialog due={due} clients={clients} projects={projects} trigger={<button ref={editTrigger} type="button" className="hidden" tabIndex={-1} aria-hidden />} />
      <Confirm
        open={confirm === "cancel"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Cancel "${due.title}"?`}
        description={
          <span className="block space-y-3">
            <span className="block">It leaves the To-collect list{due.amount_paid ? "; the part already received stays in Transactions" : ""}. You can reopen it later.</span>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason (optional), e.g. client backed out"
              className="h-10 w-full rounded-control border border-line px-3 text-sm text-fg"
              aria-label="Cancellation reason"
            />
          </span>
        }
        confirmLabel="Cancel payment"
        danger
        onConfirm={async () => {
          const result = await cancelDueAction({ id: due.id, reason });
          if (result.ok) toast.success("Payment cancelled");
          else toast.error(result.error);
        }}
      />
      <Confirm
        open={confirm === "delete"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Delete "${due.title}"?`}
        description="Use this for mistakes. To keep a record, cancel it instead."
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          const result = await deleteDueAction({ id: due.id });
          if (result.ok) toast.success("Deleted");
          else toast.error(result.error);
        }}
      />
    </>
  );
}
