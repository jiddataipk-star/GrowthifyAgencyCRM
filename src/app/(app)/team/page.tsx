import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { BadgeCheck, CalendarCheck, Plus, UserRound, Wallet } from "lucide-react";
import { requireFinance, isOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EMPLOYEE_STATUS_LABELS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { formatDate, formatMonthShort, monthStart, todayPK } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Card, KpiCard, Section } from "@/components/ui/card";
import { EmptyState, PageSkeleton } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/pill";
import { Avatar } from "@/components/ui/avatar";
import { formatPhone } from "@/lib/phone";
import { EmployeeFormDialog, EmployeeMenu, PaySalaryDialog } from "./team-dialogs";

export const metadata: Metadata = { title: "Team" };

export default function TeamPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Team />
    </Suspense>
  );
}

function lastMonths(today: string, count: number) {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(year, month - (count - 1 - i), 1)).toISOString().slice(0, 7));
}

async function Team() {
  const member = await requireFinance();
  const supabase = await createClient();
  const today = todayPK();
  const months = lastMonths(today, 6);

  const [employeesRes, salaries, logins, memberships] = await Promise.all([
    supabase.from("employees").select("*").order("status").order("name"),
    supabase.from("transactions").select("employee_id, salary_month, amount, currency").eq("category", "salary").gte("salary_month", `${months[0]}-01`),
    supabase.from("team_members").select("id, name, email, role").eq("active", true).order("name"),
    supabase.from("project_members").select("team_member_id, projects(status)"),
  ]);
  const employees = employeesRes.data ?? [];
  const paid = new Map<string, Set<string>>();
  for (const row of salaries.data ?? []) {
    if (!row.employee_id || !row.salary_month) continue;
    if (!paid.has(row.employee_id)) paid.set(row.employee_id, new Set());
    paid.get(row.employee_id)!.add(row.salary_month.slice(0, 7));
  }
  const thisMonth = today.slice(0, 7);
  const active = employees.filter((e) => e.status !== "left");
  const payroll = active.filter((e) => e.currency === "PKR").reduce((sum, e) => sum + e.salary, 0);
  const paidThisMonth = (salaries.data ?? []).filter((s) => s.salary_month?.slice(0, 7) === thisMonth && s.currency === "PKR").reduce((sum, s) => sum + s.amount, 0);
  const pending = active.filter((e) => !paid.get(e.id)?.has(thisMonth));
  const loginOptions = (logins.data ?? []).map((l) => ({ id: l.id, name: `${l.name ?? l.email} (${l.role})` }));
  const activeProjectsByMember = new Map<string, number>();
  for (const pm of memberships.data ?? []) {
    if (pm.projects && ["planning", "in_progress", "review"].includes(pm.projects.status)) {
      activeProjectsByMember.set(pm.team_member_id, (activeProjectsByMember.get(pm.team_member_id) ?? 0) + 1);
    }
  }

  const addButton = <EmployeeFormDialog logins={loginOptions} trigger={<Button><Plus /> Add employee</Button>} />;

  return (
    <div className="flex flex-col gap-7">
      <div className="grid grid-cols-2 gap-3 sm:gap-5 wide:grid-cols-4">
        <KpiCard icon={<UserRound />} tone="accent" label="Team members" value={active.length} sub={`${employees.filter((e) => e.status === "on_leave").length} on leave`} subTone="muted" />
        <KpiCard icon={<Wallet />} tone="info" label="Monthly payroll" value={formatMoney(payroll, "PKR")} sub="Active + on leave" subTone="muted" />
        <KpiCard icon={<BadgeCheck />} tone="success" label={`Paid for ${formatMonthShort(monthStart(today))}`} value={formatMoney(paidThisMonth, "PKR")} />
        <KpiCard icon={<CalendarCheck />} tone="warning" label="Salaries pending" value={pending.length} sub={pending.length ? `For ${formatMonthShort(monthStart(today))}` : "All paid"} subTone={pending.length ? "warning" : "success"} />
      </div>

      <Section title="Employees" actions={addButton}>
        {employees.length === 0 ? (
          <Card>
            <EmptyState icon={<UserRound />} title="No employees yet" description="Add your team to track salaries. Give someone a login under Settings → Team & roles." action={addButton} />
          </Card>
        ) : (
          <ul className="space-y-4">
            {employees.map((employee) => {
              const paidMonths = [...(paid.get(employee.id) ?? [])];
              const login = (logins.data ?? []).find((l) => l.id === employee.team_member_id);
              return (
                <li key={employee.id}>
                  <Card className={cn("grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-4 px-4 py-4 sm:px-5 xl:grid-cols-[auto_1.2fr_1fr_1.4fr_auto]", employee.status === "left" && "opacity-60")}>
                    <Avatar name={employee.name} size={52} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-bold">{employee.name}</p>
                        <StatusPill status={employee.status} label={EMPLOYEE_STATUS_LABELS[employee.status]} />
                      </div>
                      <p className="truncate text-sm text-muted">
                        {employee.role ?? "No role"}
                        {login ? ` · login: ${login.role}` : ""}
                        {login && activeProjectsByMember.get(login.id) ? ` · ${activeProjectsByMember.get(login.id)} active projects` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 justify-self-end xl:order-last">
                      {employee.status !== "left" ? (
                        <PaySalaryDialog employee={employee} paidMonths={paidMonths} trigger={<Button variant="outline" size="pill">Pay salary</Button>} />
                      ) : null}
                      <EmployeeMenu employee={employee} logins={loginOptions} canDelete={isOwner(member.role)} />
                    </div>
                    <div className="col-span-3 text-sm xl:col-span-1">
                      <p className="tabular font-semibold">{formatMoney(employee.salary, employee.currency)}<span className="font-medium text-muted">/month</span></p>
                      <p className="text-[13px] text-muted">
                        {formatPhone(employee.phone)} · joined {formatDate(employee.joined_on)}
                      </p>
                    </div>
                    <div className="col-span-3 xl:col-span-1">
                      <p className="mb-1.5 text-xs font-semibold text-muted">Salary, last 6 months</p>
                      <ol className="flex gap-1.5" aria-label="Salary paid per month">
                        {months.map((m) => {
                          const isPaid = paidMonths.includes(m);
                          const beforeJoin = employee.joined_on ? `${m}-31` < employee.joined_on : false;
                          return (
                            <li
                              key={m}
                              title={`${formatMonthShort(`${m}-01`)}: ${beforeJoin ? "before joining" : isPaid ? "paid" : "not paid"}`}
                              className={cn(
                                "flex h-7 w-10 items-center justify-center rounded-lg text-[11px] font-bold",
                                beforeJoin ? "bg-surface-2 text-muted/50" : isPaid ? "bg-primary text-primary-ink" : m === thisMonth ? "border border-dashed border-primary text-primary" : "bg-danger-tint text-danger",
                              )}
                            >
                              {formatMonthShort(`${m}-01`)}
                              <span className="sr-only">{isPaid ? " paid" : " not paid"}</span>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 text-sm text-muted">
          Logins and roles are managed in <Link href="/settings?tab=team" className="font-semibold text-primary hover:underline">Settings → Team &amp; roles</Link>.
        </p>
      </Section>
    </div>
  );
}
