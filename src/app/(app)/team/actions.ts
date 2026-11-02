"use server";

import { z } from "zod";
import { action, must } from "@/lib/action";
import { employeeSchema, salarySchema } from "@/lib/validation";
import { toMinor } from "@/lib/money";
import { emptyToNull } from "@/lib/utils";

function toRow(input: z.output<typeof employeeSchema>) {
  return {
    name: input.name,
    role: emptyToNull(input.role ?? ""),
    email: emptyToNull(input.email ?? ""),
    phone: emptyToNull(input.phone ?? ""),
    joined_on: emptyToNull(input.joined_on ?? ""),
    salary: toMinor(input.salary),
    currency: input.currency,
    status: input.status,
    team_member_id: emptyToNull(input.team_member_id ?? ""),
    notes: emptyToNull(input.notes ?? ""),
  };
}

export const createEmployeeAction = action("finance", employeeSchema, async (input, { supabase }) => {
  must(await supabase.from("employees").insert(toRow(input)));
});

export const updateEmployeeAction = action("finance", employeeSchema.extend({ id: z.guid() }), async ({ id, ...input }, { supabase }) => {
  must(await supabase.from("employees").update(toRow(input)).eq("id", id));
});

export const deleteEmployeeAction = action("owner", z.object({ id: z.guid() }), async ({ id }, { supabase }) => {
  must(await supabase.from("employees").delete().eq("id", id));
});

/** Creates the salary expense; the database refuses a second payment for the same month. */
export const paySalaryAction = action("finance", salarySchema, async (input, { supabase }) => {
  must(
    await supabase.rpc("pay_salary", {
      p_employee_id: input.employee_id,
      p_month: `${input.month}-01`,
      p_amount: toMinor(input.amount),
      p_paid_on: input.paid_on,
      p_method: input.method,
      p_reference: input.reference || undefined,
      p_notes: input.notes || undefined,
    }),
  );
});
