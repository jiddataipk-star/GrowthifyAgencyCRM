"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { clientSchema, type ClientInput } from "@/lib/validation";
import { clientStatusOptions, nicheOptions, PAKISTAN_CITIES, sourceOptions } from "@/lib/constants";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, FormGrid, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { LogoInput } from "@/components/app/upload";
import { applyFieldErrors } from "@/components/app/form-utils";
import { createClientAction, updateClientAction } from "./actions";
import type { Tables } from "@/types/db";

const EMPTY: ClientInput = {
  business_name: "",
  contact_name: "",
  phone: "",
  whatsapp: "",
  email: "",
  city: "",
  country: "Pakistan",
  address: "",
  ntn: "",
  niche: "other",
  source: "other",
  status: "active",
  tags: "",
  notes: "",
  logo_url: "",
};

function fromClient(client: Tables<"clients">): ClientInput {
  return {
    business_name: client.business_name,
    contact_name: client.contact_name ?? "",
    phone: client.phone ?? "",
    whatsapp: client.whatsapp ?? "",
    email: client.email ?? "",
    city: client.city ?? "",
    country: client.country,
    address: client.address ?? "",
    ntn: client.ntn ?? "",
    niche: client.niche,
    source: client.source,
    status: client.status,
    tags: client.tags.join(", "),
    notes: client.notes ?? "",
    logo_url: client.logo_url ?? "",
  };
}

export function ClientFormDialog({ client, trigger }: { client?: Tables<"clients">; trigger: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const form = useForm<ClientInput>({ resolver: zodResolver(clientSchema) as never, defaultValues: client ? fromClient(client) : EMPTY });
  const { register, handleSubmit, formState, control, setError, reset } = form;
  const errors = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    const result = client ? await updateClientAction({ ...values, id: client.id }) : await createClientAction(values);
    if (!result.ok) {
      applyFieldErrors(result.fieldErrors, setError);
      toast.error(result.error);
      return;
    }
    toast.success(client ? "Client updated" : "Client added");
    setOpen(false);
    if (!client && result.data && typeof result.data === "object" && "id" in result.data) {
      router.push(`/clients/${(result.data as { id: string }).id}`);
    }
    if (!client) reset(EMPTY);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={client ? "Edit client" : "Add client"} description="Business details used across projects, collections and WhatsApp." size="lg">
        <form onSubmit={onSubmit} noValidate>
          <Controller
            control={control}
            name="logo_url"
            render={({ field }) => <LogoInput value={field.value ?? ""} onChange={field.onChange} folder="clients" name="Client logo" />}
          />
          <FormGrid className="mt-6">
            <Field label="Business name" htmlFor="business_name" error={errors.business_name?.message} required>
              <Input autoFocus placeholder="e.g. Nova Clinic" {...register("business_name")} />
            </Field>
            <Field label="Contact person" htmlFor="contact_name" error={errors.contact_name?.message}>
              <Input placeholder="e.g. Dr. Ayesha Malik" {...register("contact_name")} />
            </Field>
            <Field label="Phone" htmlFor="phone" error={errors.phone?.message} hint="0300-1234567 or +92 300 1234567">
              <Input inputMode="tel" placeholder="03XX-XXXXXXX" {...register("phone")} />
            </Field>
            <Field label="WhatsApp" htmlFor="whatsapp" error={errors.whatsapp?.message} hint="Leave empty to use the phone number">
              <Input inputMode="tel" placeholder="03XX-XXXXXXX" {...register("whatsapp")} />
            </Field>
            <Field label="Email" htmlFor="email" error={errors.email?.message}>
              <Input type="email" placeholder="name@business.pk" {...register("email")} />
            </Field>
            <Field label="City" htmlFor="city" error={errors.city?.message}>
              <Input list="pk-cities" placeholder="Faisalabad" {...register("city")} />
            </Field>
            <Field label="Niche / industry" htmlFor="niche" error={errors.niche?.message}>
              <Select options={nicheOptions} {...register("niche")} />
            </Field>
            <Field label="Source" htmlFor="source" error={errors.source?.message}>
              <Select options={sourceOptions} {...register("source")} />
            </Field>
            <Field label="Status" htmlFor="status" error={errors.status?.message}>
              <Select options={clientStatusOptions} {...register("status")} />
            </Field>
            <Field label="Country" htmlFor="country" error={errors.country?.message}>
              <Input {...register("country")} />
            </Field>
            <Field label="NTN (optional)" htmlFor="ntn" error={errors.ntn?.message}>
              <Input placeholder="Optional" {...register("ntn")} />
            </Field>
            <Field label="Tags" htmlFor="tags" error={errors.tags?.message} hint="Comma-separated, e.g. priority, dha">
              <Input {...register("tags")} />
            </Field>
            <Field label="Address" htmlFor="address" error={errors.address?.message} className="sm:col-span-2">
              <Input {...register("address")} />
            </Field>
            <Field label="Notes" htmlFor="notes" error={errors.notes?.message} className="sm:col-span-2">
              <Textarea placeholder="Preferences, decision makers, anything useful…" {...register("notes")} />
            </Field>
          </FormGrid>
          <datalist id="pk-cities">
            {PAKISTAN_CITIES.map((city) => (
              <option key={city} value={city} />
            ))}
          </datalist>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="lg" loading={formState.isSubmitting}>
              {client ? "Save changes" : "Add client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
