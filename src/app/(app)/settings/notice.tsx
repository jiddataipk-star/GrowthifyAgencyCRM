"use client";

import { useSearchParams } from "next/navigation";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { PLATFORM_LABELS } from "@/lib/constants";

/** Result banner after an OAuth "Connect" round-trip (?connected=… or ?error=…). */
export function SettingsNotice() {
  const params = useSearchParams();
  const error = params.get("error");
  const connected = params.get("connected");
  if (!error && !connected) return null;
  const name = connected === "meta" ? "Facebook & Instagram" : connected ? (PLATFORM_LABELS as Record<string, string>)[connected] ?? connected : "";
  return error ? (
    <p role="alert" className="flex items-start gap-2.5 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {error}
    </p>
  ) : (
    <p role="status" className="flex items-center gap-2.5 rounded-2xl border border-success/40 bg-success/10 px-4 py-3 text-sm font-semibold text-success">
      <CheckCircle2 className="size-4" /> {name} connected. The first sync has run; it then syncs daily at 03:00 PKT.
    </p>
  );
}
