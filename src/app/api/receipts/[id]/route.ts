import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

/** Redirects to a short-lived signed URL for a transaction's receipt. RLS decides access. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const supabase = await createClient();
  const { data: tx } = await supabase.from("transactions").select("receipt_url").eq("id", id).maybeSingle();
  if (!tx?.receipt_url) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data, error } = await supabase.storage.from("receipts").createSignedUrl(tx.receipt_url, 60);
  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
