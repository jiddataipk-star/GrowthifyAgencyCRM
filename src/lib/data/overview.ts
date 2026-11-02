import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import { addDays, monthStart, todayPK } from "@/lib/dates";

export type Kpis = {
  mrr_pkr: number;
  mrr_usd: number;
  mrr_prev_pkr: number;
  active_subscriptions: number;
  revenue_pkr: number;
  revenue_usd: number;
  revenue_prev_pkr: number;
  revenue_prev_full_pkr: number;
  expenses_pkr: number;
  expenses_prev_pkr: number;
  outstanding_pkr: number;
  outstanding_usd: number;
  outstanding_count: number;
  overdue_count: number;
  active_clients: number;
  new_clients: number;
  as_of: string;
};

export async function loadOverview(supabase: ServerClient) {
  const today = todayPK();
  const [kpis, cashflow, byService, recent, renewals, projects, followUps, social] = await Promise.all([
    supabase.rpc("report_kpis"),
    supabase.rpc("report_cashflow", { p_months: 12 }),
    supabase.rpc("report_revenue_by_service", { p_from: monthStart(today), p_to: today }),
    supabase
      .from("transactions")
      .select("id, type, amount, currency, date, category, description, clients(business_name), projects(title), subscriptions(name)")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("subscriptions")
      .select("id, name, amount, currency, next_due_date, clients(id, business_name, phone, whatsapp)")
      .eq("status", "active")
      .lte("next_due_date", addDays(today, 7))
      .order("next_due_date")
      .limit(8),
    supabase
      .from("projects")
      .select("id, title, progress, status, deadline, service_type, clients(business_name)")
      .in("status", ["planning", "in_progress", "review"])
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(5),
    supabase
      .from("leads")
      .select("id, name, business, phone, next_follow_up, stage")
      .not("stage", "in", "(won,lost)")
      .lte("next_follow_up", today)
      .order("next_follow_up")
      .limit(6),
    loadSocialGrowth(supabase, today),
  ]);

  if (kpis.error) throw kpis.error;

  return {
    today,
    kpis: kpis.data as unknown as Kpis,
    cashflow: cashflow.data ?? [],
    byService: byService.data ?? [],
    recent: recent.data ?? [],
    renewals: renewals.data ?? [],
    projects: projects.data ?? [],
    followUps: followUps.data ?? [],
    social,
  };
}

/** Followers per platform now vs 7 days ago. */
export async function loadSocialGrowth(supabase: ServerClient, today = todayPK()) {
  const since = addDays(today, -8);
  const [accounts, metrics] = await Promise.all([
    supabase.from("social_accounts").select("id, platform, name, handle, status, last_synced_at").order("platform"),
    supabase.from("social_metrics_daily").select("social_account_id, date, followers").gte("date", since).order("date"),
  ]);
  return (accounts.data ?? []).map((account) => {
    const rows = (metrics.data ?? []).filter((m) => m.social_account_id === account.id && m.followers !== null);
    const latest = rows.at(-1);
    const weekAgo = rows.find((m) => m.date >= addDays(latest?.date ?? today, -7));
    return {
      ...account,
      followers: latest?.followers ?? null,
      change7d: latest && weekAgo && weekAgo !== latest ? (latest.followers ?? 0) - (weekAgo.followers ?? 0) : null,
    };
  });
}
