"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { startSubscriptionSchema, type StartSubscriptionInput } from "@/lib/validation";
import { INTERVAL_LABELS, PAKISTAN_CITIES, currencyOptions, methodOptions, serviceTypeOptions } from "@/lib/constants";
import { addBillingMonths, formatDate, todayPK } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, FormGrid, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/misc";
import { ReceiptInput } from "@/components/app/upload";
import { applyFieldErrors } from "@/components/app/form-utils";
import type { Option, PlanOption } from "@/lib/data/lookups";
import { startSubscriptionAction } from "./actions";

const DURATIONS = [1, 3, 12] as const;

/**
 * Add a subscription in one go — built for WhatsApp API clients:
 * pick or create the client, choose 1 month / 3 months / 1 year, and record the
 * advance payment straight away (Pakistani subscriptions are prepaid).
 */
export function StartSubscriptionDialog({
  clients,
  plans,
  whatsapp = false,
  trigger,
}: {
  clients: Option[];
  plans: PlanOption[];
  whatsapp?: boolean;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [newClient, setNewClient] = React.useState(clients.length === 0);
  const today = todayPK();
  const relevant = plans.filter((p) => (whatsapp ? p.service_type === "whatsapp_api" : true));
  const firstPlan = relevant.find((p) => p.interval_months === 1) ?? relevant[0];

  const defaults = (): StartSubscriptionInput => ({
    client_id: "",
    new_business_name: "",
    new_contact_name: "",
    new_phone: "",
    new_city: "",
    plan_id: firstPlan?.id ?? "",
    name: firstPlan?.name ?? (whatsapp ? "Growthify WhatsApp API — 1 Month" : ""),
    service_type: whatsapp ? "whatsapp_api" : ((firstPlan?.service_type as StartSubscriptionInput["service_type"]) ?? "other"),
    amount: firstPlan?.amount ? firstPlan.amount / 100 : ("" as unknown as number),
    currency: firstPlan?.currency ?? "PKR",
    interval_months: firstPlan?.interval_months ?? 1,
    start_date: today,
    service_ref: "",
    notes: "",
    paid_now: true,
    method: "bank_transfer",
    party_name: "",
    reference: "",
    paid_on: today,
    time: "",
    receipt_url: "",
  });

  const { register, handleSubmit, formState, setError, reset, setValue, watch, control } = useForm<StartSubscriptionInput>({
    resolver: zodResolver(startSubscriptionSchema) as never,
    defaultValues: defaults(),
  });
  const errors = formState.errors;
  const [months, start, amount, currency, paidNow, planId] = watch(["interval_months", "start_date", "amount", "currency", "paid_now", "plan_id"]);
  const renewsOn = start ? addBillingMonths(String(start), Number(months) || 1, Number(String(start).slice(8, 10)) || 1) : null;

  function pickDuration(m: number) {
    setValue("interval_months", m);
    const plan = relevant.find((p) => p.interval_months === m);
    if (plan) applyPlan(plan.id);
  }

  function applyPlan(id: string) {
    const plan = plans.find((p) => p.id === id);
    setValue("plan_id", id);
    if (!plan) return;
    setValue("name", plan.name);
    setValue("service_type", plan.service_type as StartSubscriptionInput["service_type"]);
    setValue("currency", plan.currency);
    setValue("interval_months", plan.interval_months);
    if (plan.amount > 0) setValue("amount", plan.amount / 100);
  }

  const submit = handleSubmit(async (values) => {
    const result = await startSubscriptionAction({ ...values, client_id: newClient ? "" : values.client_id, paid_on: values.paid_on || values.start_date });
    if (!result.ok) {
      applyFieldErrors(result.fieldErrors, setError);
      toast.error(result.error);
      return;
    }
    toast.success(values.paid_now ? "Added and payment recorded" : "Added — payment due on the start date");
    setOpen(false);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          reset(defaults());
          setNewClient(clients.length === 0);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={whatsapp ? "Add WhatsApp API client" : "Add subscription"} description="Prepaid: the client pays upfront for the chosen period." size="lg">
        <form onSubmit={submit} noValidate className="space-y-6">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold">Client</h3>
              <button type="button" className="text-[13px] font-semibold text-primary hover:underline" onClick={() => setNewClient((v) => !v)}>
                {newClient ? "Pick an existing client" : "+ New client"}
              </button>
            </div>
            {newClient ? (
              <FormGrid>
                <Field label="Business name" htmlFor="ss-business" error={errors.new_business_name?.message} required>
                  <Input placeholder="e.g. Bhatti Electronics" {...register("new_business_name")} />
                </Field>
                <Field label="Contact person" htmlFor="ss-contact">
                  <Input {...register("new_contact_name")} />
                </Field>
                <Field label="WhatsApp / phone" htmlFor="ss-phone" error={errors.new_phone?.message}>
                  <Input inputMode="tel" placeholder="03XX-XXXXXXX" {...register("new_phone")} />
                </Field>
                <Field label="City" htmlFor="ss-city">
                  <Input list="ss-cities" {...register("new_city")} />
                </Field>
                <datalist id="ss-cities">{PAKISTAN_CITIES.map((c) => <option key={c} value={c} />)}</datalist>
              </FormGrid>
            ) : (
              <Field label="Client" htmlFor="ss-client" error={errors.client_id?.message ?? errors.new_business_name?.message} required>
                <Select placeholder="Choose a client" options={clients.map((c) => ({ value: c.id, label: c.name }))} {...register("client_id")} />
              </Field>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-sm font-bold">Plan</h3>
            {whatsapp ? (
              <div role="radiogroup" aria-label="Duration" className="mb-4 grid grid-cols-3 gap-2">
                {DURATIONS.map((m) => {
                  const plan = relevant.find((p) => p.interval_months === m);
                  const active = Number(months) === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => pickDuration(m)}
                      className={cn(
                        "rounded-control border px-3 py-3 text-left transition-colors",
                        active ? "border-primary bg-primary-tint ring-1 ring-primary" : "border-line hover:border-line-strong",
                      )}
                    >
                      <span className="block text-sm font-bold">{INTERVAL_LABELS[m]}</span>
                      <span className="tabular block text-xs text-muted">{plan?.amount ? formatMoney(plan.amount, plan.currency) : "Set price"}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <Field label="Plan" htmlFor="ss-plan" className="mb-4" hint="Fills the name, price and duration.">
                <Select placeholder="Custom" options={plans.map((p) => ({ value: p.id, label: p.name }))} value={planId ?? ""} onChange={(e) => applyPlan(e.target.value)} />
              </Field>
            )}
            <FormGrid>
              <Field label="Name on records" htmlFor="ss-name" error={errors.name?.message}>
                <Input {...register("name")} />
              </Field>
              {!whatsapp ? (
                <Field label="Service" htmlFor="ss-service">
                  <Select options={serviceTypeOptions} {...register("service_type")} />
                </Field>
              ) : (
                <Field label="API WhatsApp number" htmlFor="ss-ref" hint="The number connected to the API">
                  <Input inputMode="tel" placeholder="+92 3XX XXXXXXX" {...register("service_ref")} />
                </Field>
              )}
              <div className="grid grid-cols-[1fr_96px] gap-3">
                <Field label={`Price for ${INTERVAL_LABELS[Number(months)] ?? "the period"}`} htmlFor="ss-amount" error={errors.amount?.message}>
                  <Input type="number" inputMode="decimal" min="0" step="0.01" {...register("amount")} />
                </Field>
                <Field label="Currency" htmlFor="ss-currency">
                  <Select options={currencyOptions.map((o) => ({ value: o.value, label: o.value }))} {...register("currency")} />
                </Field>
              </div>
              <Field label="Start date" htmlFor="ss-start" error={errors.start_date?.message} hint={renewsOn ? `Next renewal: ${formatDate(renewsOn)}` : undefined}>
                <Input type="date" {...register("start_date")} />
              </Field>
              {!whatsapp ? (
                <Field label="Account / reference" htmlFor="ss-ref2" hint="e.g. ad account ID (optional)">
                  <Input {...register("service_ref")} />
                </Field>
              ) : null}
            </FormGrid>
          </section>

          <section className="rounded-control border border-line bg-canvas p-4">
            <Controller
              control={control}
              name="paid_now"
              render={({ field }) => (
                <label className="flex items-center justify-between gap-4">
                  <span>
                    <span className="block text-sm font-bold">Payment received now</span>
                    <span className="text-[13px] text-muted">
                      {field.value ? `Records ${formatMoney(Math.round(Number(amount || 0) * 100), String(currency))} in Transactions.` : "The payment shows in Collections from the start date."}
                    </span>
                  </span>
                  <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} aria-label="Payment received now" />
                </label>
              )}
            />
            {paidNow ? (
              <FormGrid className="mt-4">
                <Field label="Method" htmlFor="ss-method">
                  <Select options={methodOptions} {...register("method")} />
                </Field>
                <Field label="Reference / TID" htmlFor="ss-tid">
                  <Input placeholder="From the SMS" {...register("reference")} />
                </Field>
                <Field label="Received from (name)" htmlFor="ss-party">
                  <Input placeholder="Account title" {...register("party_name")} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date" htmlFor="ss-paid-on">
                    <Input type="date" {...register("paid_on")} />
                  </Field>
                  <Field label="Time" htmlFor="ss-time">
                    <Input type="time" {...register("time")} />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Controller control={control} name="receipt_url" render={({ field }) => <ReceiptInput value={field.value ?? ""} onChange={field.onChange} />} />
                </div>
              </FormGrid>
            ) : null}
          </section>

          <Field label="Notes" htmlFor="ss-notes">
            <Textarea rows={2} placeholder="Template names, Meta verification status, anything useful…" {...register("notes")} />
          </Field>

          <DialogFooter className="mt-0">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" size="lg" loading={formState.isSubmitting}>{whatsapp ? "Add WhatsApp client" : "Add subscription"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
