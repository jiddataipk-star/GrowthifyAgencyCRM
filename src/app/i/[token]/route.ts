import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadInvoicePdfData } from "@/lib/data/invoice-pdf-data";
import { renderInvoicePdf } from "@/lib/pdf/invoice-pdf";
import { isUuid } from "@/lib/utils";

/**
 * Public invoice link shared with the client on WhatsApp. The unguessable share token
 * (UUID v4) is the authorisation; the owner can regenerate it to revoke old links.
 * Drafts are never served.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isUuid(token)) return new NextResponse("Not found", { status: 404 });
  const data = await loadInvoicePdfData(createAdminClient(), { share_token: token });
  if (!data) return new NextResponse("This invoice link is no longer valid.", { status: 404 });
  const pdf = await renderInvoicePdf(data);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${data.number}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
