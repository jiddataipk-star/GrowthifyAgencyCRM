"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { employeeSchema, type EmployeeInput } from "@/lib/validation";
import { currencyOptions, employeeStatusOptions, methodOptions } from "@/lib/constants";
import { formatMonthYear, todayPK } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, FormGrid, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { RowMenu, RowMenuItem, RowMenuSeparator } from "@/components/ui/misc";
import { Confirm } from "@/components/ui/confirm";
import { applyFieldErrors } from "@/components/app/form-utils";
import type { Option } from "@/lib/data/lookups";
import type { Tables } from "@/types/db";
import { createEmployeeAction, deleteEmployeeAction, paySalaryAction, updateEmployeeAction } from "./actions";

function defaults(employee?: Tables<"employees">): EmployeeInput {
  return {
    name: employee?.name ?? "",
    role: employee?.role ?? "",
    email: employee?.email ?? "",
    phone: employee?.phone ?? "",
    joined_on: employee?.joined_on ?? todayPK(),
    salary: employee ? employee.salary / 100 : 0,
    currency: employee?.currency ?? "PKR",
    status: employee?.status ?? "active",
    team_member_id: employee?.team_member_id ?? "",
    notes: employee?.notes ?? "",
  };
}

export function EmployeeFormDialog({ employee, logins, trigger }: { employee?: Tables<"employees">; logins: Option[]; trigger: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const { register, handleSubmit, formState, setError, reset } = useForm<EmployeeInput>({
    resolver: zodResolver(employeeSchema) as never,
    defaultValues: defaults(employee),
  });
  const errors = formState.errors;
  const submit = handleSubmit(async (values) => {
    const result = employee ? await updateEmployeeAction({ ...values, id: employee.id }) : await createEmployeeAction(values);
    if (!result.ok) {
      applyFieldErrors(result.fieldErrors, setError);
      toast.error(result.error);
      return;
    }
    toast.success(employee ? "Employee updated" : "Employee added");
    setOpen(false);
  });
  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) reset(defaults(employee)); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={employee ? "Edit employee" : "Add employee"} size="lg">
        <form onSubmit={submit} noValidate>
          <FormGrid>
            <Field label="Full name" htmlFor="emp-name" error={errors.name?.message} required>
              <Input autoFocus {...register("name")} />
            </Field>
            <Field label="Role / designation" htmlFor="emp-role">
              <Input placeholder="e.g. Full-stack Developer" {...register("role")} />
            </Field>
            <Field label="Email" htmlFor="emp-email" error={errors.email?.message}>
              <Input type="email" {...register("email")} />
            </Field>
            <Field label="Phone" htmlFor="emp-phone" error={errors.phone?.message}>
              <Input inputMode="tel" placeholder="03XX-XXXXXXX" {...register("phone")} />
            </Field>
            <Field label="Joining date" htmlFor="emp-joined">
              <Input type="date" {...register("joined_on")} />
            </Field>
            <div className="grid grid-cols-[1fr_110px] gap-3">
              <Field label="Monthly salary" htmlFor="emp-salary" error={errors.salary?.message}>
                <Input type="number" inputMode="decimal" min="0" step="0.01" {...register("salary")} />
              </Field>
              <Field label="Currency" htmlFor="emp-currency">
                <Select options={currencyOptions.map((o) => ({ value: o.value, label: o.value }))} {...register("currency")} />
              </Field>
            </div>
            <Field label="Status" htmlFor="emp-status">
              <Select options={employeeStatusOptions} {...register("status")} />
            </Field>
            <Field label="App login (Staff access)" htmlFor="emp-login" hint="Link to a team login so they see their projects and tasks.">
              <Select placeholder="No login" options={logins.map((l) => ({ value: l.id, label: l.name }))} {...register("team_member_id")} />
            </Field>
            <Field label="Notes" htmlFor="emp-notes" className="sm:col-span-2">
              <Textarea rows={2} placeholder="Bank account for salary, emergency contact…" {...register("notes")} />
            </Field>
          </FormGrid>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" size="lg" loading={formState.isSubmitting}>{employee ? "Save changes" : "Add employee"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type SalaryValues = { month: string; amount: string; paid_on: string; method: string; reference: string; notes: string };

export function PaySalaryDialog({ employee, paidMonths, trigger }: { employee: Tables<"employees">; paidMonths: string[]; trigger: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const today = todayPK();
  const firstUnpaid = [0, -1, -2].map((offset) => {
    const d = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 + offset, 1));
    return d.toISOString().slice(0, 7);
  }).reverse().find((m) => !paidMonths.includes(m)) ?? today.slice(0, 7);
  const defaults: SalaryValues = { month: firstUnpaid, amount: String(employee.salary / 100), paid_on: today, method: "bank_transfer", reference: "", notes: "" };
  const { register, handleSubmit, formState, reset, watch, setError } = useForm<SalaryValues>({ defaultValues: defaults });
  const month = watch("month");
  const alreadyPaid = paidMonths.includes(month);

  const submit = handleSubmit(async (values) => {
    const result = await paySalaryAction({ employee_id: employee.id, ...values, method: values.method as never });
    if (!result.ok) {
      for (const [name, message] of Object.entries(result.fieldErrors ?? {})) setError(name as keyof SalaryValues, { message });
      toast.error(result.error);
      return;
    }
    toast.success(`Salary for ${formatMonthYear(`${values.month}-01`)} recorded`);
    setOpen(false);
  });

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) reset(defaults); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={`Pay salary · ${employee.name}`} description={`Monthly salary ${formatMoney(employee.salary, employee.currency)}. Creates a salary expense.`}>
        <form onSubmit={submit} noValidate>
          <FormGrid>
            <Field label="For month" htmlFor="sal-month" error={alreadyPaid ? "Already paid for this month" : formState.errors.month?.message}>
              <Input type="month" {...register("month", { required: true })} />
            </Field>
            <Field label={`Amount (${employee.currency})`} htmlFor="sal-amount" error={formState.errors.amount?.message} hint="Adjust for bonus, deductions or advance.">
              <Input type="number" inputMode="decimal" min="0" step="0.01" {...register("amount")} />
            </Field>
            <Field label="Paid on" htmlFor="sal-date">
              <Input type="date" {...register("paid_on")} />
            </Field>
            <Field label="Method" htmlFor="sal-method">
              <Select options={methodOptions} {...register("method")} />
            </Field>
            <Field label="Reference / TID" htmlFor="sal-ref" className="sm:col-span-2">
              <Input placeholder="Optional" {...register("reference")} />
            </Field>
            <Field label="Notes" htmlFor="sal-notes" className="sm:col-span-2">
              <Textarea rows={2} {...register("notes")} />
            </Field>
          </FormGrid>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" size="lg" disabled={alreadyPaid} loading={formState.isSubmitting}>Pay salary</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EmployeeMenu({ employee, logins, canDelete }: { employee: Tables<"employees">; logins: Option[]; canDelete: boolean }) {
  const editTrigger = React.useRef<HTMLButtonElement>(null);
  const [confirm, setConfirm] = React.useState(false);
  return (
    <>
      <RowMenu label={`Actions for ${employee.name}`}>
        <RowMenuItem icon={<Pencil />} onSelect={() => editTrigger.current?.click()}>Edit</RowMenuItem>
        {canDelete ? (
          <>
            <RowMenuSeparator />
            <RowMenuItem icon={<Trash2 />} danger onSelect={() => setConfirm(true)}>Delete</RowMenuItem>
          </>
        ) : null}
      </RowMenu>
      <EmployeeFormDialog employee={employee} logins={logins} trigger={<button ref={editTrigger} type="button" className="hidden" tabIndex={-1} aria-hidden />} />
      <Confirm
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${employee.name}?`}
        description="Salary payments stay in Payments without the employee link. Prefer status “Left” to keep history."
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          const result = await deleteEmployeeAction({ id: employee.id });
          if (result.ok) toast.success("Employee deleted");
          else toast.error(result.error);
        }}
      />
    </>
  );
}
