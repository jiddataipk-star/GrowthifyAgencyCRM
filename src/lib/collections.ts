import { daysBetween } from "@/lib/dates";
import type { Enums } from "@/types/db";

export type DueState = "pending" | "due_today" | "overdue" | "partial" | "paid" | "cancelled";

/** Display state of a payment request. "Overdue" wins over "part paid": it needs action. */
export function dueState(
  due: { status: Enums<"due_status">; due_date: string; amount_paid: number },
  today: string,
): DueState {
  if (due.status === "cancelled") return "cancelled";
  if (due.status === "paid") return "paid";
  if (due.due_date < today) return "overdue";
  if (due.due_date === today) return "due_today";
  if (due.amount_paid > 0) return "partial";
  return "pending";
}

export function remaining(due: { amount: number; amount_paid: number }) {
  return Math.max(due.amount - due.amount_paid, 0);
}

export type RenewalState = "active" | "expiring" | "expired" | "paused" | "cancelled";

/**
 * Prepaid subscription state. `next_due_date` is the renewal date: the paid
 * period ends the day before it. On/after that date a payment is due.
 */
export function renewalState(sub: { status: Enums<"subscription_status">; next_due_date: string }, today: string, soonDays = 7): RenewalState {
  if (sub.status === "cancelled") return "cancelled";
  if (sub.status === "paused") return "paused";
  const days = daysBetween(today, sub.next_due_date);
  if (days <= 0) return "expired";
  if (days <= soonDays) return "expiring";
  return "active";
}

/** Human line for a renewal date: "Renews in 5 days", "Payment due today", "Lapsed 12 days ago". */
export function renewalLabel(nextDue: string, today: string): string {
  const days = daysBetween(today, nextDue);
  if (days === 0) return "Payment due today";
  if (days < 0) return `Lapsed ${-days} day${days === -1 ? "" : "s"} ago`;
  if (days === 1) return "Renews tomorrow";
  return `Renews in ${days} days`;
}
