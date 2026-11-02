import type { Enums } from "@/types/db";

/** "Overdue" is derived (sent/partly paid and past due), never stored — so it can't go stale. */
export function invoiceDisplayStatus(
  invoice: { status: Enums<"invoice_status">; due_date: string },
  today: string,
): Enums<"invoice_status"> | "overdue" {
  if ((invoice.status === "sent" || invoice.status === "partial") && invoice.due_date < today) return "overdue";
  return invoice.status;
}

/** Same arithmetic as the database trigger, for live previews in the editor. */
export function invoiceTotals(items: { qty: number; unit_price: number }[], discount: number, taxRate: number) {
  const subtotal = items.reduce((sum, item) => sum + Math.round((Number(item.qty) || 0) * (Number(item.unit_price) || 0)), 0);
  const appliedDiscount = Math.min(Math.max(discount || 0, 0), subtotal);
  const tax = Math.round(((subtotal - appliedDiscount) * (taxRate || 0)) / 100);
  return { subtotal, discount: appliedDiscount, tax, total: subtotal - appliedDiscount + tax };
}
