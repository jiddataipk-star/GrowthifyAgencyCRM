import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import { addDays, dueLabel, formatDayMonth, todayPK } from "@/lib/dates";
import { renewalLabel } from "@/lib/collections";
import { formatMoney } from "@/lib/money";
import { PLATFORM_LABELS } from "@/lib/constants";
import type { AppNotification } from "@/components/shell/notifications";

/**
 * Notifications are derived live from the data (nothing to mark as read, never stale):
 * renewals due within 3 days, payments to collect that are due, follow-ups, broken social connections.
 */
export async function loadNotifications(supabase: ServerClient): Promise<AppNotification[]> {
  const today = todayPK();
  const [settings, renewals, followUps, dues, social] = await Promise.all([
    supabase.from("settings").select("notify_renewals, notify_followups, notify_overdue, notify_social").maybeSingle(),
    supabase
      .from("subscriptions")
      .select("id, name, amount, currency, next_due_date, clients(business_name)")
      .eq("status", "active")
      .lte("next_due_date", addDays(today, 3))
      .order("next_due_date")
      .limit(10),
    supabase
      .from("leads")
      .select("id, name, business, next_follow_up")
      .not("stage", "in", "(won,lost)")
      .lte("next_follow_up", today)
      .order("next_follow_up")
      .limit(10),
    supabase
      .from("dues")
      .select("id, title, amount, amount_paid, currency, due_date, payer_name, clients(business_name)")
      .eq("status", "pending")
      .lte("due_date", today)
      .order("due_date")
      .limit(10),
    supabase.from("social_accounts").select("id, platform, name").eq("status", "needs_reconnect"),
  ]);

  const prefs = settings.data ?? { notify_renewals: true, notify_followups: true, notify_overdue: true, notify_social: true };
  const items: AppNotification[] = [];

  if (prefs.notify_renewals) {
    for (const sub of renewals.data ?? []) {
      items.push({
        id: `renewal-${sub.id}`,
        kind: "renewal",
        title: `${sub.clients?.business_name ?? "Client"} · ${formatMoney(sub.amount, sub.currency)}`,
        detail: `${sub.name} — ${renewalLabel(sub.next_due_date, today)}`,
        href: "/collections",
        urgent: sub.next_due_date <= today,
      });
    }
  }
  if (prefs.notify_overdue) {
    for (const due of dues.data ?? []) {
      items.push({
        id: `due-${due.id}`,
        kind: "due",
        title: `${due.clients?.business_name ?? due.payer_name ?? "Payment"} · ${formatMoney(due.amount - due.amount_paid, due.currency)}`,
        detail: `${due.title} — ${dueLabel(due.due_date, today)}`,
        href: `/collections?due=${due.id}`,
        urgent: due.due_date < today,
      });
    }
  }
  if (prefs.notify_followups) {
    for (const lead of followUps.data ?? []) {
      items.push({
        id: `lead-${lead.id}`,
        kind: "followup",
        title: `Follow up: ${lead.name}${lead.business ? ` (${lead.business})` : ""}`,
        detail: lead.next_follow_up === today ? "Due today" : `Was due ${formatDayMonth(lead.next_follow_up)}`,
        href: `/leads?lead=${lead.id}`,
        urgent: (lead.next_follow_up ?? today) < today,
      });
    }
  }
  if (prefs.notify_social) {
    for (const account of social.data ?? []) {
      items.push({
        id: `social-${account.id}`,
        kind: "social",
        title: `${PLATFORM_LABELS[account.platform]} needs reconnecting`,
        detail: "Daily stats are paused until you reconnect.",
        href: "/settings?tab=integrations",
        urgent: true,
      });
    }
  }

  return items.sort((a, b) => Number(b.urgent) - Number(a.urgent));
}
