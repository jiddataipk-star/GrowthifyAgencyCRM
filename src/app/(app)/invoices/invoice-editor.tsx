"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { invoiceSchema, type InvoiceInput } from "@/lib/validation";
import { currencyOptions } from "@/lib/constants";
import { formatMoney, toMinor } from "@/lib/money";
import { invoiceTotals } from "@/lib/invoices";
import { addDays } from "@/lib/dates";
import { Card } from "@/components/ui/card";
import { Field, FormGrid, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { applyFieldErrors } from "@/components/app/form-utils";
import type { Option } from "@/lib/data/lookups";
import { saveInvoiceAction } from "./actions";

type ProjectOption = Option & { client_id: string; currency: string };

export function InvoiceEditor({
  invoiceId,
  initial,
  clients,
  projects,
  defaultDueDays,
}: {
  invoiceId?: string;
  initial: InvoiceInput;
  clients: Option[];
  projects: ProjectOption[];
  defaultDueDays: number;
}) {
  const router = useRouter();
  const { register, handleSubmit, control, formState, setError, setValue, getValues } = useForm<InvoiceInput>({
    resolver: zodResolver(invoiceSchema) as never,
    defaultValues: initial,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const [items, discount, taxRate, currency, clientId] = useWatch({ control, name: ["items", "discount", "tax_rate", "currency", "client_id"] });
  const totals = invoiceTotals(
    (items ?? []).map((item) => ({ qty: Number(item?.qty) || 0, unit_price: toMinor(Number(item?.unit_price) || 0) })),
    toMinor(Number(discount) || 0),
    Number(taxRate) || 0,
  );
  const errors = formState.errors;
  const clientProjects = projects.filter((p) => p.client_id === clientId);

  const save = (status: "draft" | "sent") =>
    handleSubmit(async (values) => {
      const result = await saveInvoiceAction({ ...values, status, id: invoiceId });
      if (!result.ok) {
        applyFieldErrors(result.fieldErrors, setError);
        toast.error(result.error);
        return;
      }
      toast.success(invoiceId ? "Invoice saved" : status === "sent" ? "Invoice created and marked sent" : "Draft saved");
      router.push(`/invoices/${result.data.id}`);
    });

  return (
    <form onSubmit={save("draft")} noValidate className="grid grid-cols-1 gap-7 xl:grid-cols-[1fr_340px]">
      <div className="flex min-w-0 flex-col gap-7">
        <Card>
          <p className="mb-5 text-card font-bold">Invoice details</p>
          <FormGrid>
            <Field label="Client" htmlFor="inv-client" error={errors.client_id?.message} required>
              <Select placeholder="Choose a client" options={clients.map((c) => ({ value: c.id, label: c.name }))} {...register("client_id", { onChange: () => setValue("project_id", "") })} />
            </Field>
            <Field label="Project (optional)" htmlFor="inv-project">
              <Select
                placeholder={clientId ? "No project" : "Choose a client first"}
                options={clientProjects.map((p) => ({ value: p.id, label: p.name }))}
                {...register("project_id", {
                  onChange: (event) => {
                    const project = projects.find((p) => p.id === event.target.value);
                    if (project) setValue("currency", project.currency as "PKR" | "USD");
                  },
                })}
              />
            </Field>
            <Field label="Issue date" htmlFor="inv-issue" error={errors.issue_date?.message}>
              <Input type="date" {...register("issue_date", { onChange: (event) => event.target.value && setValue("due_date", addDays(event.target.value, defaultDueDays)) })} />
            </Field>
            <Field label="Due date" htmlFor="inv-due" error={errors.due_date?.message}>
              <Input type="date" {...register("due_date")} />
            </Field>
            <Field label="Currency" htmlFor="inv-currency">
              <Select options={currencyOptions} {...register("currency")} />
            </Field>
            <Field label="Sales tax (%)" htmlFor="inv-tax" error={errors.tax_rate?.message} hint="e.g. 16 for PRA/SRB services tax. 0 if not registered.">
              <Input type="number" inputMode="decimal" min="0" max="100" step="0.01" {...register("tax_rate")} />
            </Field>
          </FormGrid>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-card font-bold">Line items</p>
            <Button size="sm" variant="secondary" onClick={() => append({ description: "", qty: 1, unit_price: 0 })}>
              <Plus /> Add line
            </Button>
          </div>
          <div className="hidden grid-cols-[1fr_90px_150px_130px_40px] gap-3 pb-2 text-sm font-medium text-fg-2 md:grid">
            <span>Description</span>
            <span>Qty</span>
            <span>Unit price</span>
            <span className="text-right">Amount</span>
            <span />
          </div>
          <ul className="space-y-3">
            {fields.map((field, index) => {
              const line = items?.[index];
              const amount = Math.round((Number(line?.qty) || 0) * toMinor(Number(line?.unit_price) || 0));
              return (
                <li key={field.id} className="grid grid-cols-[1fr_1fr_40px] gap-3 rounded-2xl border border-line p-3 md:grid-cols-[1fr_90px_150px_130px_40px] md:items-center md:border-0 md:p-0">
                  <div className="col-span-3 md:col-span-1">
                    <label htmlFor={`item-${index}-desc`} className="sr-only">Description</label>
                    <Input id={`item-${index}-desc`} placeholder="e.g. Growthify WhatsApp API setup" aria-invalid={Boolean(errors.items?.[index]?.description)} {...register(`items.${index}.description`)} />
                    {errors.items?.[index]?.description ? <p className="mt-1 text-[13px] text-danger">{errors.items[index]?.description?.message}</p> : null}
                  </div>
                  <div>
                    <label htmlFor={`item-${index}-qty`} className="mb-1 block text-xs text-muted md:sr-only">Qty</label>
                    <Input id={`item-${index}-qty`} type="number" inputMode="decimal" min="0" step="0.01" {...register(`items.${index}.qty`)} />
                  </div>
                  <div>
                    <label htmlFor={`item-${index}-price`} className="mb-1 block text-xs text-muted md:sr-only">Unit price</label>
                    <Input id={`item-${index}-price`} type="number" inputMode="decimal" min="0" step="0.01" {...register(`items.${index}.unit_price`)} />
                  </div>
                  <p className="tabular col-span-2 text-sm font-bold md:col-span-1 md:text-right">{formatMoney(amount, currency)}</p>
                  <button
                    type="button"
                    onClick={() => fields.length > 1 && remove(index)}
                    disabled={fields.length <= 1}
                    className="justify-self-end rounded-full p-2 text-muted hover:text-danger disabled:opacity-30"
                    aria-label={`Remove line ${index + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          {typeof errors.items?.message === "string" ? <p className="mt-2 text-sm text-danger">{errors.items.message}</p> : null}
        </Card>

        <Card>
          <Field label="Notes on the invoice" htmlFor="inv-notes" hint="Shown on the PDF, e.g. scope, terms or thanks.">
            <Textarea {...register("notes")} />
          </Field>
        </Card>
      </div>

      <div>
        <Card className="sticky top-[124px]">
          <p className="mb-5 text-card font-bold">Summary</p>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-fg-2">Subtotal</dt><dd className="tabular font-semibold">{formatMoney(totals.subtotal, currency)}</dd></div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-fg-2"><label htmlFor="inv-discount">Discount ({currency})</label></dt>
              <dd><Input id="inv-discount" type="number" inputMode="decimal" min="0" step="0.01" className="h-10 w-32 text-right" {...register("discount")} /></dd>
            </div>
            <div className="flex justify-between"><dt className="text-fg-2">Sales tax ({Number(taxRate) || 0}%)</dt><dd className="tabular font-semibold">{formatMoney(totals.tax, currency)}</dd></div>
            <div className="flex justify-between border-t border-line pt-4 text-base"><dt className="font-bold">Total</dt><dd className="tabular text-xl font-extrabold text-accent-fg">{formatMoney(totals.total, currency)}</dd></div>
          </dl>
          <div className="mt-6 flex flex-col gap-3">
            <Button size="lg" loading={formState.isSubmitting} onClick={save("sent")}>
              {invoiceId && getValues("status") === "sent" ? "Save" : "Save & mark sent"}
            </Button>
            <Button type="submit" size="lg" variant="secondary" disabled={formState.isSubmitting}>
              Save as draft
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted">The invoice number (e.g. GA-2026-0001) is assigned automatically and never reused.</p>
        </Card>
      </div>
    </form>
  );
}
