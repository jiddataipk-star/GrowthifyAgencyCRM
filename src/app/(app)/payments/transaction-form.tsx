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
  tax_withheld: number;
  currency: "PKR" | "USD";
  date: string;
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

function defaults(tx?: EditableTx, type: "income" | "expense" = "income"): TransactionInput {
  return {
    type: tx?.type ?? type,
    amount: tx ? tx.amount / 100 : ("" as unknown as number),
    tax_withheld: tx ? tx.tax_withheld / 100 : 0,
    currency: tx?.currency ?? "PKR",
    date: tx?.date ?? todayPK(),
    category: tx?.category ?? (type === "income" ? "project" : "hosting"),
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
    toast.success(tx ? "Transaction updated" : values.type === "income" ? "Income recorded" : "Expense recorded");
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
      <DialogContent title={tx ? "Edit transaction" : "Add transaction"} description="Linked invoices, milestones and subscriptions update automatically." size="lg">
        <form onSubmit={onSubmit} noValidate>
          <div role="radiogroup" aria-label="Type" className="mb-6 grid grid-cols-2 gap-2 rounded-control bg-surface-2 p-1.5">
            {(["income", "expense"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={type === value}
                onClick={() => {
                  setValue("type", value);
                  setValue("category", value === "income" ? "project" : "hosting");
                  if (value === "expense") setValue("tax_withheld", 0);
                }}
                className={cn(
                  "h-11 rounded-[11px] text-[15px] font-bold transition-colors",
                  type === value ? (value === "income" ? "bg-success text-white light:text-white" : "bg-danger text-white") : "text-fg-2 hover:text-fg",
                )}
              >
                {value === "income" ? "Income" : "Expense"}
              </button>
            ))}
          </div>
          <FormGrid>
            <div className="grid grid-cols-[1fr_110px] gap-3">
              <Field label="Amount" htmlFor="tx-amount" error={errors.amount?.message} required>
                <Input type="number" inputMode="decimal" min="0" step="0.01" autoFocus {...register("amount")} />
              </Field>
              <Field label="Currency" htmlFor="tx-currency">
                <Select options={currencyOptions.map((o) => ({ value: o.value, label: o.value }))} {...register("currency")} />
              </Field>
            </div>
            <Field label="Date" htmlFor="tx-date" error={errors.date?.message} required>
              <Input type="date" {...register("date")} />
            </Field>
            <Field label="Category" htmlFor="tx-category" error={errors.category?.message}>
              <Select options={categories} {...register("category")} />
            </Field>
            <Field label="Method" htmlFor="tx-method" error={errors.method?.message}>
              <Select options={methodOptions} {...register("method")} />
            </Field>
            <Field label={type === "income" ? "Received from / description" : "Paid to / description"} htmlFor="tx-desc" error={errors.description?.message}>
              <Input placeholder={type === "income" ? "e.g. Advance for website" : "e.g. Hosting & API"} {...register("description")} />
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
            {type === "expense" && (category === "salary" || category === "contractor") ? (
              <Field label="Employee" htmlFor="tx-employee" hint="Tip: use Team → Pay salary to prevent double payments.">
                <Select placeholder="None" options={options.employees.map((e) => ({ value: e.id, label: e.name }))} {...register("employee_id")} />
              </Field>
            ) : null}
            {type === "income" ? (
              <Field label="Tax withheld by client (WHT)" htmlFor="tx-wht" error={errors.tax_withheld?.message} hint="Optional. Deducted at source; not part of cash received.">
                <Input type="number" inputMode="decimal" min="0" step="0.01" {...register("tax_withheld")} />
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
