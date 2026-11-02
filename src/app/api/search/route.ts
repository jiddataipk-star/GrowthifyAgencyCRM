import { NextResponse, type NextRequest } from "next/server";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Global search (clients, projects, invoices, leads). The SQL function runs under the caller's RLS. */
export async function GET(request: NextRequest) {
  const member = await getMember();
  if (!member) return NextResponse.json({ results: [] }, { status: 401 });
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
  if (q.trim().length < 2) return NextResponse.json({ results: [] });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_all", { p_query: q, p_limit: 6 });
  if (error) return NextResponse.json({ results: [] }, { status: 500 });
  return NextResponse.json({ results: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}
