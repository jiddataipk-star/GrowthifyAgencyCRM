"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { methodOptions } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { todayPK } from "@/lib/dates";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, FormGrid, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { ReceiptInput } from "@/components/app/upload";

export type PaymentValues = {
  amount: string;
  tax_withheld: string;
  paid_on: string;
  method: string;
  reference: string;
  receipt_url: string;
  notes: string;
};

type Result = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Shared "record a payment" dialog: method (bank, Raast, JazzCash, Easypaisa, cheque…),
 * TID / reference, date, receipt upload, and optionally amount + tax withheld at source.
 */
export function PaymentDialog({
  trigger,
  title,
  description,
  currency,
  amount,
  amountEditable = false,
  withholding = false,
  submitLabel = "Record payment",
  onSubmit,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  currency: string;
  /** Default amount in minor units. */
  amount: number;
  amountEditable?: boolean;
  withholding?: boolean;
  submitLabel?: string;
  onSubmit: (values: PaymentValues) => Promise<Result>;
}) {
  const [open, setOpen] = React.useState(false);
  const defaults: PaymentValues = {
    amount: String(amount / 100),
    tax_withheld: "0",
    paid_on: todayPK(),
    method: "bank_transfer",
    reference: "",
    receipt_url: "",
    notes: "",
  };
  const { register, handleSubmit, control, formState, reset, setError, watch } = useForm<PaymentValues>({ defaultValues: defaults });
  const method = watch("method");

  const submit = handleSubmit(async (values) => {
    const result = await onSubmit(values);
    if (!result.ok) {
      for (const [name, message] of Object.entries(result.fieldErrors ?? {})) {
        setError(name as keyof PaymentValues, { message });
      }
      toast.error(result.error);
      return;
    }
    toast.success("Payment recorded");
    setOpen(false);
    reset(defaults);
  });

  const referenceHint =
    method === "jazzcash" || method === "easypaisa" ? "Wallet TID from the SMS" : method === "cheque" ? "Cheque number" : method === "raast" ? "Raast transaction ID" : "Bank reference / TID";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset(defaults);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={title} description={description ?? (!amountEditable ? `Amount: ${formatMoney(amount, currency)}` : undefined)}>
        <form onSubmit={submit} noValidate>
          <FormGrid>
            {amountEditable ? (
              <Field label={`Amount received (${currency})`} htmlFor="pay-amount" error={formState.errors.amount?.message}>
                <Input type="number" inputMode="decimal" step="0.01" min="0" {...register("amount", { required: "Enter an amount" })} />
              </Field>
            ) : null}
            {withholding ? (
              <Field label={`Tax withheld by client (${currency})`} htmlFor="pay-wht" error={formState.errors.tax_withheld?.message} hint="Income tax deducted at source (WHT). Counts towards settling the invoice.">
                <Input type="number" inputMode="decimal" step="0.01" min="0" {...register("tax_withheld")} />
              </Field>
            ) : null}
            <Field label="Payment date" htmlFor="pay-date" error={formState.errors.paid_on?.message}>
              <Input type="date" {...register("paid_on", { required: "Pick a date" })} />
            </Field>
            <Field label="Method" htmlFor="pay-method" error={formState.errors.method?.message}>
              <Select options={methodOptions} {...register("method")} />
            </Field>
            <Field label="Reference / TID" htmlFor="pay-ref" error={formState.errors.reference?.message} hint={referenceHint} className="sm:col-span-2">
              <Input placeholder="Optional" {...register("reference")} />
            </Field>
            <div className="sm:col-span-2">
              <Controller control={control} name="receipt_url" render={({ field }) => <ReceiptInput value={field.value} onChange={field.onChange} />} />
            </div>
            <Field label="Notes" htmlFor="pay-notes" className="sm:col-span-2">
              <Textarea rows={2} placeholder="Optional" {...register("notes")} />
            </Field>
          </FormGrid>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="lg" loading={formState.isSubmitting}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
