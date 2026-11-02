import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import { addDays, monthStart, todayPK } from "@/lib/dates";

export type Kpis = {
  collected_pkr: number;
  spent_pkr: number;
  profit_pkr: number;
  collected_prev_pkr: number;
  spent_prev_pkr: number;
  profit_prev_pkr: number;
  collected_last_pkr: number;
  spent_last_pkr: number;
  collected_usd: number;
  spent_usd: number;
  payments_count: number;
  to_collect_pkr: number;
  to_collect_usd: number;
  to_collect_count: number;
  due_now_pkr: number;
  overdue_count: number;
  mrr_pkr: number;
  mrr_usd: number;
  active_subscriptions: number;
  whatsapp_active: number;
  renewals_soon: number;
  active_clients: number;
  new_clients: number;
  as_of: string;
};

const PARTY = "business_name, contact_name, phone, whatsapp";

export async function loadOverview(supabase: ServerClient) {
  const today = todayPK();
  const yearAgo = addDays(today, -365);
  const [kpis, cashflow, topClients, expenses, recent, dues, renewals, whatsapp, projects, followUps, social, details] = await Promise.all([
    supabase.rpc("report_kpis"),
    supabase.rpc("report_cashflow", { p_months: 12 }),
    supabase.rpc("report_top_clients", { p_from: yearAgo, p_to: today, p_limit: 6 }),
    supabase.rpc("report_expenses_by_category", { p_from: monthStart(addDays(monthStart(today), -1)), p_to: today }),
    supabase
      .from("transactions")
      .select("id, type, amount, currency, date, time, party_name, category, description, method, clients(business_name), employees(name)")
      .order("date", { ascending: false })
      .order("time", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("dues").select(`*, clients(${PARTY})`).eq("status", "pending").lte("due_date", addDays(today, 7)).order("due_date").limit(6),
    supabase.from("subscriptions").select(`*, clients(${PARTY})`).eq("status", "active").lte("next_due_date", addDays(today, 7)).order("next_due_date").limit(6),
    supabase.from("subscriptions").select("id, amount, interval_months, currency, next_due_date").eq("status", "active").eq("service_type", "whatsapp_api"),
    supabase
      .from("projects")
      .select("id, title, progress, status, deadline, clients(business_name)")
      .in("status", ["planning", "in_progress", "review"])
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(5),
    supabase
      .from("leads")
      .select("id, name, business, phone, next_follow_up")
      .not("stage", "in", "(won,lost)")
      .lte("next_follow_up", today)
      .order("next_follow_up")
      .limit(5),
    loadSocialGrowth(supabase, today),
    supabase.from("settings").select("company_name, bank_name, account_title, account_number, iban, jazzcash_number, easypaisa_number, raast_id, payment_notes").maybeSingle(),
  ]);
  if (kpis.error) throw kpis.error;

  return {
    today,
    kpis: kpis.data as unknown as Kpis,
    cashflow: cashflow.data ?? [],
    topClients: topClients.data ?? [],
    expenses: expenses.data ?? [],
    recent: recent.data ?? [],
    dues: dues.data ?? [],
    renewals: renewals.data ?? [],
    whatsapp: whatsapp.data ?? [],
    projects: projects.data ?? [],
    followUps: followUps.data ?? [],
    social,
    details: details.data ?? null,
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
