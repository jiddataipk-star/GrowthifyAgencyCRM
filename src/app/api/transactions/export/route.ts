import { NextResponse, type NextRequest } from "next/server";
import { getMember, canSeeFinance } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseTxFilters, transactionsQuery } from "@/lib/data/transactions";
import { CATEGORY_LABELS, METHOD_LABELS } from "@/lib/constants";
import { toCsv } from "@/lib/csv";
import { todayPK } from "@/lib/dates";

/** CSV export of the Payments view (same filters). Amounts are in major units. */
export async function GET(request: NextRequest) {
  const member = await getMember();
  if (!member || !canSeeFinance(member.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const supabase = await createClient();
  const filters = parseTxFilters(Object.fromEntries(request.nextUrl.searchParams));
  const { data, error } = await transactionsQuery(supabase, filters).limit(10000);
  if (error) return NextResponse.json({ error: "Export failed" }, { status: 500 });

  const csv = toCsv(
    ["Date", "Time", "Type", "Amount", "Currency", "From / to", "For", "Category", "Method", "Reference / TID", "Client", "Project", "Employee", "Screenshot", "Notes"],
    (data ?? []).map((tx) => [
      tx.date,
      tx.time?.slice(0, 5),
      tx.type,
      (tx.type === "expense" ? -tx.amount : tx.amount) / 100,
      tx.currency,
      tx.party_name,
      tx.description,
      CATEGORY_LABELS[tx.category],
      METHOD_LABELS[tx.method],
      tx.reference,
      tx.clients?.business_name,
      tx.projects?.title,
      tx.employees?.name,
      tx.receipt_url ? "yes" : "",
      tx.notes,
    ]),
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="growthify-transactions-${todayPK()}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
