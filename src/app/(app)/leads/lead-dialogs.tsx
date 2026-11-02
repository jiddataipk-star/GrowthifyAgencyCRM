"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { leadSchema, type LeadInput } from "@/lib/validation";
import { PAKISTAN_CITIES, currencyOptions, leadStageOptions, serviceTypeOptions, sourceOptions } from "@/lib/constants";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Checkbox, Field, FormGrid, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { applyFieldErrors } from "@/components/app/form-utils";
import type { Tables } from "@/types/db";
import { convertLeadAction, createLeadAction, updateLeadAction } from "./actions";

export type Lead = Tables<"leads">;

function defaults(lead?: Lead | null): LeadInput {
  return {
    name: lead?.name ?? "",
    business: lead?.business ?? "",
    phone: lead?.phone ?? "",
    email: lead?.email ?? "",
    city: lead?.city ?? "",
    source: lead?.source ?? "meta_ad",
    service_interest: lead?.service_interest ?? "",
    est_value: lead ? lead.est_value / 100 : 0,
    currency: lead?.currency ?? "PKR",
    stage: lead?.stage ?? "new",
    next_follow_up: lead?.next_follow_up ?? "",
    notes: lead?.notes ?? "",
    lost_reason: lead?.lost_reason ?? "",
  };
}

export function LeadFormDialog({ open, onOpenChange, lead }: { open: boolean; onOpenChange: (open: boolean) => void; lead?: Lead | null }) {
  const { register, handleSubmit, formState, setError, reset, watch } = useForm<LeadInput>({
    resolver: zodResolver(leadSchema) as never,
    defaultValues: defaults(lead),
  });
  React.useEffect(() => {
    if (open) reset(defaults(lead));
  }, [open, lead, reset]);
  const errors = formState.errors;
  const stage = watch("stage");

  const onSubmit = handleSubmit(async (values) => {
    const result = lead ? await updateLeadAction({ ...values, id: lead.id }) : await createLeadAction(values);
    if (!result.ok) {
      applyFieldErrors(result.fieldErrors, setError);
      toast.error(result.error);
      return;
    }
    toast.success(lead ? "Lead updated" : "Lead added");
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={lead ? "Edit lead" : "Add lead"} size="lg">
        <form onSubmit={onSubmit} noValidate>
          <FormGrid>
            <Field label="Name" htmlFor="lead-name" error={errors.name?.message} required>
              <Input autoFocus placeholder="Person you're talking to" {...register("name")} />
            </Field>
            <Field label="Business" htmlFor="lead-business" error={errors.business?.message}>
              <Input placeholder="Business name" {...register("business")} />
            </Field>
            <Field label="Phone / WhatsApp" htmlFor="lead-phone" error={errors.phone?.message}>
              <Input inputMode="tel" placeholder="03XX-XXXXXXX" {...register("phone")} />
            </Field>
            <Field label="Email" htmlFor="lead-email" error={errors.email?.message}>
              <Input type="email" {...register("email")} />
            </Field>
            <Field label="City" htmlFor="lead-city">
              <Input list="lead-cities" {...register("city")} />
            </Field>
            <Field label="Source" htmlFor="lead-source">
              <Select options={sourceOptions} {...register("source")} />
            </Field>
            <Field label="Service interested in" htmlFor="lead-service">
              <Select placeholder="Not sure yet" options={serviceTypeOptions} {...register("service_interest")} />
            </Field>
            <div className="grid grid-cols-[1fr_110px] gap-3">
              <Field label="Estimated value" htmlFor="lead-value" error={errors.est_value?.message}>
                <Input type="number" inputMode="decimal" min="0" step="0.01" {...register("est_value")} />
              </Field>
              <Field label="Currency" htmlFor="lead-currency">
                <Select options={currencyOptions.map((o) => ({ value: o.value, label: o.value }))} {...register("currency")} />
              </Field>
            </div>
            <Field label="Stage" htmlFor="lead-stage">
              <Select options={leadStageOptions} {...register("stage")} />
            </Field>
            <Field label="Next follow-up" htmlFor="lead-follow" error={errors.next_follow_up?.message} hint="Shows on the Overview and in notifications when due.">
              <Input type="date" {...register("next_follow_up")} />
            </Field>
            {stage === "lost" ? (
              <Field label="Why was it lost?" htmlFor="lead-lost" className="sm:col-span-2">
                <Input placeholder="e.g. Budget, went with another agency" {...register("lost_reason")} />
              </Field>
            ) : null}
            <Field label="Notes" htmlFor="lead-notes" className="sm:col-span-2">
              <Textarea placeholder="Requirements, objections, what was promised…" {...register("notes")} />
            </Field>
          </FormGrid>
          <datalist id="lead-cities">
            {PAKISTAN_CITIES.map((city) => <option key={city} value={city} />)}
          </datalist>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="lg" loading={formState.isSubmitting}>{lead ? "Save changes" : "Add lead"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type ConvertValues = { create_project: boolean; title: string; service_type: string; value: string; currency: "PKR" | "USD"; deadline: string };

export function ConvertLeadDialog({ lead, onOpenChange }: { lead: Lead | null; onOpenChange: (open: boolean) => void }) {
  const [clientId, setClientId] = React.useState<string | null>(null);
  const { register, handleSubmit, watch, reset, formState } = useForm<ConvertValues>();
  React.useEffect(() => {
    if (lead) {
      setClientId(null);
      reset({
        create_project: true,
        title: lead.service_interest ? `${lead.business ?? lead.name} — project` : "",
        service_type: lead.service_interest ?? "",
        value: String(lead.est_value / 100),
        currency: lead.currency,
        deadline: "",
      });
    }
  }, [lead, reset]);
  const createProject = watch("create_project");

  const submit = handleSubmit(async (values) => {
    if (!lead) return;
    const result = await convertLeadAction({
      lead_id: lead.id,
      create_project: values.create_project && Boolean(values.title.trim()),
      title: values.title,
      service_type: values.service_type as never,
      value: values.value === "" ? undefined : Number(values.value),
      currency: values.currency,
      deadline: values.deadline,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${lead.business ?? lead.name} is now a client`);
    setClientId(result.data.clientId);
  });

  return (
    <Dialog open={lead !== null} onOpenChange={onOpenChange}>
      <DialogContent title="Convert to client" description={lead ? `${lead.business ?? lead.name} moves to Won and becomes a client.` : undefined}>
        {clientId ? (
          <div className="py-4 text-center">
            <p className="text-card font-bold">Client created 🎉</p>
            <p className="mt-1 text-sm text-fg-2">Add their logo, subscriptions and invoices from the client page.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="secondary" onClick={() => onOpenChange(false)}>Back to pipeline</Button>
              <Button asChild><Link href={`/clients/${clientId}`}>Open client</Link></Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label className="flex cursor-pointer items-center gap-3 rounded-control border border-line p-4">
              <Checkbox {...register("create_project")} />
              <span>
                <span className="block font-semibold">Also create the first project</span>
                <span className="text-sm text-muted">Starts in Planning with today as the start date.</span>
              </span>
            </label>
            {createProject ? (
              <FormGrid className="mt-5">
                <Field label="Project title" htmlFor="cv-title" className="sm:col-span-2">
                  <Input {...register("title")} placeholder="e.g. WhatsApp API setup" />
                </Field>
                <Field label="Service type" htmlFor="cv-service">
                  <Select placeholder="Same as lead" options={serviceTypeOptions} {...register("service_type")} />
                </Field>
                <Field label="Deadline" htmlFor="cv-deadline">
                  <Input type="date" {...register("deadline")} />
                </Field>
                <div className="grid grid-cols-[1fr_110px] gap-3 sm:col-span-2">
                  <Field label="Contract value" htmlFor="cv-value">
                    <Input type="number" inputMode="decimal" min="0" step="0.01" {...register("value")} />
                  </Field>
                  <Field label="Currency" htmlFor="cv-currency">
                    <Select options={currencyOptions.map((o) => ({ value: o.value, label: o.value }))} {...register("currency")} />
                  </Field>
                </div>
              </FormGrid>
            ) : null}
            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" size="lg" loading={formState.isSubmitting}>Convert to client</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
