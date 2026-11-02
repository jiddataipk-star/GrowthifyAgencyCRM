"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { methodOptions } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { todayPK } from "@/lib/dates";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox, Field, FormGrid, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { ReceiptInput } from "@/components/app/upload";

export type PaymentValues = {
  amount: string;
  paid_on: string;
  time: string;
  method: string;
  party_name: string;
  reference: string;
  receipt_url: string;
  notes: string;
  settle: boolean;
};

type Result = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function nowTimePK() {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}

/**
 * "Mark paid" for anything: amount, date + time it arrived, method (bank / Raast /
 * JazzCash / Easypaisa / cash / cheque …), the name it came from (account title in
 * the SMS), TID and an optional screenshot. Everything lands in Transactions.
 */
export function PaymentDialog({
  trigger,
  title,
  description,
  currency,
  amount,
  amountEditable = true,
  partyName,
  allowSettle = false,
  submitLabel = "Mark paid",
  onSubmit,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  currency: string;
  /** Default amount in minor units. */
  amount: number;
  amountEditable?: boolean;
  /** Pre-filled "received from" name. */
  partyName?: string | null;
  /** Show "close it even if less was received" (discount). */
  allowSettle?: boolean;
  submitLabel?: string;
  onSubmit: (values: PaymentValues) => Promise<Result>;
}) {
  const [open, setOpen] = React.useState(false);
  const defaults = (): PaymentValues => ({
    amount: String(amount / 100),
    paid_on: todayPK(),
    time: nowTimePK(),
    method: "bank_transfer",
    party_name: partyName ?? "",
    reference: "",
    receipt_url: "",
    notes: "",
    settle: false,
  });
  const { register, handleSubmit, control, formState, reset, setError, watch } = useForm<PaymentValues>({ defaultValues: defaults() });
  const method = watch("method");
  const received = Math.round(Number(watch("amount") || 0) * 100);
  const short = allowSettle && received > 0 && received < amount;

  const submit = handleSubmit(async (values) => {
    const result = await onSubmit(values);
    if (!result.ok) {
      for (const [name, message] of Object.entries(result.fieldErrors ?? {})) {
        setError(name as keyof PaymentValues, { message });
      }
      toast.error(result.error);
      return;
    }
    toast.success("Payment recorded in Transactions");
    setOpen(false);
  });

  const referenceHint =
    method === "jazzcash" || method === "easypaisa"
      ? "TID from the wallet SMS"
      : method === "cheque"
        ? "Cheque number + bank"
        : method === "cash"
          ? "Optional — who handed it over"
          : "Bank / Raast transaction ID";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset(defaults());
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={title} description={description ?? `Due: ${formatMoney(amount, currency)}`}>
        <form onSubmit={submit} noValidate>
          <FormGrid>
            <Field label={`Amount received (${currency})`} htmlFor="pay-amount" error={formState.errors.amount?.message}>
              <Input type="number" inputMode="decimal" step="0.01" min="0" readOnly={!amountEditable} autoFocus {...register("amount", { required: "Enter an amount" })} />
            </Field>
            <Field label="Method" htmlFor="pay-method" error={formState.errors.method?.message}>
              <Select options={methodOptions} {...register("method")} />
            </Field>
            <Field label="Date received" htmlFor="pay-date" error={formState.errors.paid_on?.message}>
              <Input type="date" {...register("paid_on", { required: "Pick a date" })} />
            </Field>
            <Field label="Time" htmlFor="pay-time" error={formState.errors.time?.message} hint="From the SMS / screenshot">
              <Input type="time" {...register("time")} />
            </Field>
            <Field label="Received from (name)" htmlFor="pay-party" error={formState.errors.party_name?.message} hint="Account title shown in the SMS">
              <Input placeholder="e.g. NOVA HEALTH CARE PVT" {...register("party_name")} />
            </Field>
            <Field label="Reference / TID" htmlFor="pay-ref" error={formState.errors.reference?.message} hint={referenceHint}>
              <Input placeholder="Optional" {...register("reference")} />
            </Field>
            <div className="sm:col-span-2">
              <Controller control={control} name="receipt_url" render={({ field }) => <ReceiptInput value={field.value} onChange={field.onChange} />} />
            </div>
            {short ? (
              <label className="flex cursor-pointer items-start gap-3 rounded-control border border-line bg-canvas p-3.5 sm:col-span-2">
                <Checkbox className="mt-0.5" {...register("settle")} />
                <span className="text-sm">
                  <span className="block font-semibold">Close it — no more payment expected</span>
                  <span className="text-muted">
                    {formatMoney(amount - received, currency)} is kept as a discount. Leave unticked to keep the rest pending.
                  </span>
                </span>
              </label>
            ) : null}
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
