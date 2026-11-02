import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { InvoicePdfData } from "@/lib/pdf/invoice-pdf";
import { invoiceDisplayStatus } from "@/lib/invoices";
import { todayPK } from "@/lib/dates";

const INVOICE_SELECT =
  "number, status, issue_date, due_date, currency, subtotal, discount, tax_rate, tax, total, amount_paid, notes, invoice_items(description, qty, unit_price, amount, position), clients(business_name, contact_name, email, phone, address, city, country, ntn), projects(title)" as const;

/**
 * Loads everything the PDF needs. Pass the user's client (RLS) for the app,
 * or the admin client for the public share link (already authorised by token).
 */
export async function loadInvoicePdfData(
  supabase: SupabaseClient<Database>,
  where: { id: string } | { share_token: string },
): Promise<InvoicePdfData | null> {
  let query = supabase.from("invoices").select(INVOICE_SELECT);
  query = "id" in where ? query.eq("id", where.id) : query.eq("share_token", where.share_token).neq("status", "draft");
  const [{ data: invoice }, { data: company }] = await Promise.all([
    query.maybeSingle(),
    supabase
      .from("settings")
      .select(
        "company_name, tagline, email, phone, whatsapp_number, show_whatsapp_on_invoice, website, address, city, country, ntn, strn, bank_name, account_title, account_number, iban, wallet_details, payment_notes, invoice_footer",
      )
      .maybeSingle(),
  ]);
  if (!invoice || !invoice.clients || !company) return null;
  return {
    number: invoice.number,
    status: invoice.status,
    displayStatus: invoiceDisplayStatus(invoice, todayPK()),
    issue_date: invoice.issue_date,
    due_date: invoice.due_date,
    currency: invoice.currency,
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    tax_rate: Number(invoice.tax_rate),
    tax: invoice.tax,
    total: invoice.total,
    amount_paid: invoice.amount_paid,
    notes: invoice.notes,
    items: [...invoice.invoice_items].sort((a, b) => a.position - b.position),
    client: invoice.clients,
    project: invoice.projects,
    company,
  };
}
