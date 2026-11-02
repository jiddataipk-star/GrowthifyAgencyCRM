"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { transactionSchema, type TransactionInput } from "@/lib/validation";
import { CATEGORY_LABELS, EXPENSE_CATEGORIES, INCOME_CATEGORIES, currencyOptions, methodOptions } from "@/lib/constants";
import { todayPK } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, FormGrid, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { ReceiptInput } from "@/components/app/upload";
import { applyFieldErrors } from "@/components/app/form-utils";
import type { FormOptions } from "@/lib/data/lookups";
import { createTransactionAction, updateTransactionAction } from "./actions";

export type EditableTx = {
  id: string;
  type: "income" | "expense";
  amount: number;
  currency: "PKR" | "USD";
  date: string;
  time: string | null;
  party_name: string | null;
  category: TransactionInput["category"];
  method: TransactionInput["method"];
  reference: string | null;
  description: string | null;
  client_id: string | null;
  project_id: string | null;
  subscription_id: string | null;
  employee_id: string | null;
  receipt_url: string | null;
  notes: string | null;
};

function nowTimePK() {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}

function defaults(tx?: EditableTx, type: "income" | "expense" = "income"): TransactionInput {
  return {
    type: tx?.type ?? type,
    amount: tx ? tx.amount / 100 : ("" as unknown as number),
    currency: tx?.currency ?? "PKR",
    date: tx?.date ?? todayPK(),
    time: tx?.time?.slice(0, 5) ?? (tx ? "" : nowTimePK()),
    party_name: tx?.party_name ?? "",
    category: tx?.category ?? (type === "income" ? "project" : "software"),
    method: tx?.method ?? "bank_transfer",
    reference: tx?.reference ?? "",
    description: tx?.description ?? "",
    client_id: tx?.client_id ?? "",
    project_id: tx?.project_id ?? "",
    subscription_id: tx?.subscription_id ?? "",
    employee_id: tx?.employee_id ?? "",
    receipt_url: tx?.receipt_url ?? "",
    notes: tx?.notes ?? "",
  };
}

/** Record money in or out: what for, from/to whom, when (date + time), how, TID, screenshot. */
export function TransactionFormDialog({
  tx,
  options,
  defaultType = "income",
  trigger,
}: {
  tx?: EditableTx;
  options: Pick<FormOptions, "clients" | "projects" | "employees">;
  defaultType?: "income" | "expense";
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const { register, handleSubmit, formState, setError, reset, watch, setValue, control } = useForm<TransactionInput>({
    resolver: zodResolver(transactionSchema) as never,
    defaultValues: defaults(tx, defaultType),
  });
  const errors = formState.errors;
  const type = watch("type");
  const clientId = watch("client_id");
  const category = watch("category");
  const categories = (type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((value) => ({ value, label: CATEGORY_LABELS[value] }));
  const projects = options.projects.filter((p) => !clientId || p.client_id === clientId);

  const onSubmit = handleSubmit(async (values) => {
    const result = tx ? await updateTransactionAction({ ...values, id: tx.id }) : await createTransactionAction(values);
    if (!result.ok) {
      applyFieldErrors(result.fieldErrors, setError);
      toast.error(result.error);
      return;
    }
    toast.success(tx ? "Transaction updated" : values.type === "income" ? "Money in recorded" : "Expense recorded");
    setOpen(false);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset(defaults(tx, defaultType));
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={tx ? "Edit transaction" : "Add transaction"} description="For payments against a request or renewal, use Mark paid in Collections — it links them automatically." size="lg">
        <form onSubmit={onSubmit} noValidate>
          <div role="radiogroup" aria-label="Type" className="mb-5 grid grid-cols-2 gap-1 rounded-control bg-surface-2 p-1">
            {(["income", "expense"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={type === value}
                onClick={() => {
                  setValue("type", value);
                  setValue("category", value === "income" ? "project" : "software");
                }}
                className={cn(
                  "h-9 rounded-[9px] text-[13.5px] font-semibold transition-colors",
                  type === value ? (value === "income" ? "bg-primary text-white" : "bg-fg text-white") : "text-muted hover:text-fg",
                )}
              >
                {value === "income" ? "Money in" : "Money out (expense)"}
              </button>
            ))}
          </div>
          <FormGrid>
            <div className="grid grid-cols-[1fr_96px] gap-3">
              <Field label="Amount" htmlFor="tx-amount" error={errors.amount?.message} required>
                <Input type="number" inputMode="decimal" min="0" step="0.01" autoFocus {...register("amount")} />
              </Field>
              <Field label="Currency" htmlFor="tx-currency">
                <Select options={currencyOptions.map((o) => ({ value: o.value, label: o.value }))} {...register("currency")} />
              </Field>
            </div>
            <Field label="For what" htmlFor="tx-desc" error={errors.description?.message}>
              <Input placeholder={type === "income" ? "e.g. Website advance" : "e.g. FESCO bill October"} {...register("description")} />
            </Field>
            <Field label={type === "income" ? "Received from (name)" : "Paid to"} htmlFor="tx-party" error={errors.party_name?.message} hint={type === "income" ? "Account title in the SMS" : undefined}>
              <Input placeholder={type === "income" ? "e.g. NOVA HEALTH CARE PVT" : "e.g. Nayatel"} {...register("party_name")} />
            </Field>
            <Field label="Category" htmlFor="tx-category" error={errors.category?.message}>
              <Select options={categories} {...register("category")} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" htmlFor="tx-date" error={errors.date?.message} required>
                <Input type="date" {...register("date")} />
              </Field>
              <Field label="Time" htmlFor="tx-time" error={errors.time?.message}>
                <Input type="time" {...register("time")} />
              </Field>
            </div>
            <Field label="Method" htmlFor="tx-method" error={errors.method?.message}>
              <Select options={methodOptions} {...register("method")} />
            </Field>
            <Field label="Reference / TID" htmlFor="tx-ref" error={errors.reference?.message}>
              <Input placeholder="Bank ref, wallet TID, cheque no." {...register("reference")} />
            </Field>
            <Field label="Client" htmlFor="tx-client">
              <Select placeholder="None" options={options.clients.map((c) => ({ value: c.id, label: c.name }))} {...register("client_id", { onChange: () => setValue("project_id", "") })} />
            </Field>
            <Field label="Project" htmlFor="tx-project">
              <Select placeholder="None" options={projects.map((p) => ({ value: p.id, label: p.name }))} {...register("project_id")} />
            </Field>
            {type === "expense" && (category === "salary" || category === "freelancer") ? (
              <Field label="Team member" htmlFor="tx-employee" hint="For salaries, Team → Pay salary prevents paying a month twice.">
                <Select placeholder="None" options={options.employees.map((e) => ({ value: e.id, label: e.name }))} {...register("employee_id")} />
              </Field>
            ) : null}
            <div className="sm:col-span-2">
              <Controller control={control} name="receipt_url" render={({ field }) => <ReceiptInput value={field.value ?? ""} onChange={field.onChange} />} />
            </div>
            <Field label="Notes" htmlFor="tx-notes" className="sm:col-span-2">
              <Textarea rows={2} {...register("notes")} />
            </Field>
          </FormGrid>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" size="lg" loading={formState.isSubmitting}>{tx ? "Save changes" : "Save transaction"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
