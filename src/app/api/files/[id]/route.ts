import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

/** Redirects to a short-lived signed download URL. RLS on files + storage decides access. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const supabase = await createClient();
  const { data: file } = await supabase.from("files").select("bucket, path, name").eq("id", id).maybeSingle();
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data, error } = await supabase.storage.from(file.bucket).createSignedUrl(file.path, 60, { download: file.name });
  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
