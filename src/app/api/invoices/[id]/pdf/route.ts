import { NextResponse, type NextRequest } from "next/server";
import { getMember, canSeeFinance } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadInvoicePdfData } from "@/lib/data/invoice-pdf-data";
import { renderInvoicePdf } from "@/lib/pdf/invoice-pdf";
import { isUuid } from "@/lib/utils";

/** Branded invoice PDF for signed-in owners/managers (RLS applies). ?download=1 to save. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const member = await getMember();
  if (!member || !canSeeFinance(member.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = await loadInvoicePdfData(await createClient(), { id });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const pdf = await renderInvoicePdf(data);
  const disposition = request.nextUrl.searchParams.get("download") ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${data.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
