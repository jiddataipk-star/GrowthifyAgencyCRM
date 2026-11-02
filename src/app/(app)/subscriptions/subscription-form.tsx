"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { subscriptionSchema, type SubscriptionInput } from "@/lib/validation";
import { currencyOptions, intervalOptions, serviceTypeOptions, subscriptionStatusOptions } from "@/lib/constants";
import { addBillingMonths, todayPK } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, FormGrid, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { applyFieldErrors } from "@/components/app/form-utils";
import type { Option, PlanOption } from "@/lib/data/lookups";
import type { Tables } from "@/types/db";
import { createSubscriptionAction, updateSubscriptionAction } from "./actions";

function defaults(sub?: Tables<"subscriptions">, clientId?: string): SubscriptionInput {
  const today = todayPK();
  return {
    client_id: sub?.client_id ?? clientId ?? "",
    plan_id: sub?.plan_id ?? "",
    name: sub?.name ?? "",
    service_type: sub?.service_type ?? "whatsapp_api",
    amount: sub ? sub.amount / 100 : 0,
    currency: sub?.currency ?? "PKR",
    interval_months: sub?.interval_months ?? 1,
    billing_day: sub?.billing_day ?? Number(today.slice(8, 10)),
    start_date: sub?.start_date ?? today,
    next_due_date: sub?.next_due_date ?? today,
    status: sub?.status ?? "active",
    notes: sub?.notes ?? "",
  };
}

export function SubscriptionFormDialog({
  subscription,
  clients,
  plans,
  defaultClientId,
  trigger,
}: {
  subscription?: Tables<"subscriptions">;
  clients: Option[];
  plans: PlanOption[];
  defaultClientId?: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const { register, handleSubmit, formState, setError, reset, setValue, watch, getValues } = useForm<SubscriptionInput>({
    resolver: zodResolver(subscriptionSchema) as never,
    defaultValues: defaults(subscription, defaultClientId),
  });
  const errors = formState.errors;
  const startDate = watch("start_date");

  function applyPlan(planId: string) {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;
    setValue("name", plan.name);
    setValue("service_type", plan.service_type as SubscriptionInput["service_type"]);
    setValue("currency", plan.currency);
    setValue("interval_months", plan.interval_months);
    if (plan.amount > 0) setValue("amount", plan.amount / 100);
  }

  const onSubmit = handleSubmit(async (values) => {
    const result = subscription ? await updateSubscriptionAction({ ...values, id: subscription.id }) : await createSubscriptionAction(values);
    if (!result.ok) {
      applyFieldErrors(result.fieldErrors, setError);
      toast.error(result.error);
      return;
    }
    toast.success(subscription ? "Subscription updated" : "Subscription added");
    setOpen(false);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset(defaults(subscription, defaultClientId));
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={subscription ? "Edit subscription" : "Add subscription"} description="Recurring services billed every cycle, e.g. Growthify WhatsApp API." size="lg">
        {clients.length === 0 ? (
          <p className="text-fg-2">Add a client first.</p>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <FormGrid>
              <Field label="Client" htmlFor="sub-client" error={errors.client_id?.message} required>
                <Select placeholder="Choose a client" options={clients.map((c) => ({ value: c.id, label: c.name }))} {...register("client_id")} />
              </Field>
              <Field label="Plan" htmlFor="sub-plan" error={errors.plan_id?.message} hint="Fills name, amount and cycle; you can still override.">
                <Select
                  placeholder="Custom (no plan)"
                  options={plans.map((p) => ({ value: p.id, label: `${p.name}${p.amount ? ` · ${formatMoney(p.amount, p.currency)}` : ""}` }))}
                  {...register("plan_id", { onChange: (event) => applyPlan(event.target.value) })}
                />
              </Field>
              <Field label="Name on records" htmlFor="sub-name" error={errors.name?.message} required>
                <Input placeholder="Growthify WhatsApp API — Monthly" {...register("name")} />
              </Field>
              <Field label="Service" htmlFor="sub-service" error={errors.service_type?.message}>
                <Select options={serviceTypeOptions} {...register("service_type")} />
              </Field>
              <div className="grid grid-cols-[1fr_110px] gap-3">
                <Field label="Amount per cycle" htmlFor="sub-amount" error={errors.amount?.message}>
                  <Input type="number" inputMode="decimal" min="0" step="0.01" {...register("amount")} />
                </Field>
                <Field label="Currency" htmlFor="sub-currency">
                  <Select options={currencyOptions.map((o) => ({ value: o.value, label: o.value }))} {...register("currency")} />
                </Field>
              </div>
              <Field label="Billing cycle" htmlFor="sub-interval" error={errors.interval_months?.message}>
                <Select options={intervalOptions} {...register("interval_months")} />
              </Field>
              <Field label="Start date" htmlFor="sub-start" error={errors.start_date?.message}>
                <Input
                  type="date"
                  {...register("start_date", {
                    onChange: (event) => {
                      if (!subscription && event.target.value) {
                        setValue("next_due_date", event.target.value);
                        setValue("billing_day", Number(event.target.value.slice(8, 10)));
                      }
                    },
                  })}
                />
              </Field>
              <Field label="Billing day (1–31)" htmlFor="sub-day" error={errors.billing_day?.message} hint="Months without this day use their last day.">
                <Input type="number" min="1" max="31" {...register("billing_day")} />
              </Field>
              <Field
                label="Next due date"
                htmlFor="sub-next"
                error={errors.next_due_date?.message}
                hint={
                  !subscription && startDate ? (
                    <button
                      type="button"
                      className="font-semibold text-accent-fg"
                      onClick={() => setValue("next_due_date", addBillingMonths(startDate, Number(getValues("interval_months")) || 1, Number(getValues("billing_day")) || 1))}
                    >
                      Already paid the first cycle? Set to next cycle
                    </button>
                  ) : undefined
                }
              >
                <Input type="date" {...register("next_due_date")} />
              </Field>
              <Field label="Status" htmlFor="sub-status" error={errors.status?.message}>
                <Select options={subscriptionStatusOptions} {...register("status")} />
              </Field>
              <Field label="Notes" htmlFor="sub-notes" className="sm:col-span-2">
                <Textarea rows={2} {...register("notes")} />
              </Field>
            </FormGrid>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" size="lg" loading={formState.isSubmitting}>{subscription ? "Save changes" : "Add subscription"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
