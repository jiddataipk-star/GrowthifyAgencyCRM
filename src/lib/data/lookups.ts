import "server-only";
import type { ServerClient } from "@/lib/supabase/server";

export type Option = { id: string; name: string };
export type PlanOption = { id: string; name: string; amount: number; currency: "PKR" | "USD"; interval_months: number; service_type: string };

/** Options for selects in forms (clients, team members, plans, projects, employees). */
export async function loadFormOptions(supabase: ServerClient) {
  const [clients, members, plans, projects, employees] = await Promise.all([
    supabase.from("clients").select("id, business_name").is("archived_at", null).order("business_name"),
    supabase.from("team_members").select("id, name, email").eq("active", true).order("name"),
    supabase.from("plans").select("id, name, amount, currency, interval_months, service_type").eq("active", true).order("name"),
    supabase.from("projects").select("id, title, client_id, currency").order("created_at", { ascending: false }).limit(300),
    supabase.from("employees").select("id, name, salary, currency, status").neq("status", "left").order("name"),
  ]);
  return {
    clients: (clients.data ?? []).map((c) => ({ id: c.id, name: c.business_name })),
    members: (members.data ?? []).map((m) => ({ id: m.id, name: m.name ?? m.email })),
    plans: (plans.data ?? []) as PlanOption[],
    projects: (projects.data ?? []).map((p) => ({ id: p.id, name: p.title, client_id: p.client_id, currency: p.currency })),
    employees: (employees.data ?? []).map((e) => ({ id: e.id, name: e.name, salary: e.salary, currency: e.currency })),
  };
}

export type FormOptions = Awaited<ReturnType<typeof loadFormOptions>>;

/** auth user id → display name, for the activity log. */
export async function loadActors(supabase: ServerClient): Promise<Record<string, string>> {
  const { data } = await supabase.from("team_members").select("user_id, name, email");
  return Object.fromEntries((data ?? []).filter((m) => m.user_id).map((m) => [m.user_id as string, m.name ?? m.email]));
}
