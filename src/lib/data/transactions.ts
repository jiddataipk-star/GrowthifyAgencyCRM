import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import { ilikeTerm, isoParam, oneOf } from "@/lib/data/query";
import { param, isUuid } from "@/lib/utils";

const CATEGORIES = ["project", "subscription", "salary", "freelancer", "rent", "utilities", "software", "ads_spend", "travel", "office", "tax", "other"] as const;
const METHODS = ["bank_transfer", "raast", "jazzcash", "easypaisa", "cash", "cheque", "card", "payoneer", "wise", "other"] as const;

export const TX_SELECT =
  "id, type, amount, currency, date, time, party_name, category, method, reference, description, receipt_url, notes, client_id, project_id, subscription_id, due_id, employee_id, created_at, clients(business_name), projects(title), employees(name), subscriptions(name)" as const;

export type TxFilters = ReturnType<typeof parseTxFilters>;

/** Parse and whitelist the Payments page filters (shared by the page and the CSV export). */
export function parseTxFilters(params: Record<string, string | string[] | undefined>) {
  const client = param(params.client);
  const project = param(params.project);
  return {
    type: oneOf(params.tab, ["income", "expense"] as const),
    from: isoParam(params.from),
    to: isoParam(params.to),
    client: isUuid(client) ? client : undefined,
    project: isUuid(project) ? project : undefined,
    category: oneOf(params.category, CATEGORIES),
    method: oneOf(params.method, METHODS),
    currency: oneOf(params.currency, ["PKR", "USD"] as const),
    term: ilikeTerm(param(params.q)),
  };
}

export function transactionsQuery(supabase: ServerClient, filters: TxFilters, options: { count?: boolean } = {}) {
  let query = supabase
    .from("transactions")
    .select(TX_SELECT, options.count ? { count: "exact" } : undefined)
    .order("date", { ascending: false })
    .order("time", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.from) query = query.gte("date", filters.from);
  if (filters.to) query = query.lte("date", filters.to);
  if (filters.client) query = query.eq("client_id", filters.client);
  if (filters.project) query = query.eq("project_id", filters.project);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.method) query = query.eq("method", filters.method);
  if (filters.currency) query = query.eq("currency", filters.currency);
  if (filters.term) query = query.or(`description.ilike.${filters.term},party_name.ilike.${filters.term},reference.ilike.${filters.term},notes.ilike.${filters.term}`);
  return query;
}
