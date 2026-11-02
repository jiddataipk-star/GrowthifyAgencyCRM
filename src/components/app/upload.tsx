"use client";

import * as React from "react";
import { Paperclip, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

export type Bucket = "receipts" | "files" | "logos";

const LIMITS: Record<Bucket, { bytes: number; accept: string; label: string }> = {
  receipts: { bytes: 10 * 1024 * 1024, accept: "image/png,image/jpeg,image/webp,application/pdf", label: "Screenshot (PNG/JPG) or PDF, up to 10 MB" },
  files: { bytes: 25 * 1024 * 1024, accept: "", label: "Any file up to 25 MB" },
  logos: { bytes: 2 * 1024 * 1024, accept: "image/png,image/jpeg,image/webp", label: "PNG, JPG or WebP up to 2 MB" },
};

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(-80);
}

/**
 * Uploads straight from the browser to Supabase Storage with the user's session,
 * so Storage RLS decides access and large files never pass through our server.
 * Returns the object path (private buckets) or the public URL (logos).
 */
export async function uploadFile(bucket: Bucket, folder: string, file: File) {
  const limit = LIMITS[bucket];
  if (file.size > limit.bytes) throw new Error(`File is too large (${limit.label}).`);
  const path = `${folder}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw new Error(error.message.includes("row-level security") ? "You don't have permission to upload here." : error.message);
  const publicUrl = bucket === "logos" ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : null;
  return { path, publicUrl, name: file.name, size: file.size, type: file.type };
}

/** Compact "Attach receipt" control for payment forms. Stores the object path. */
export function ReceiptInput({ value, onChange }: { value: string; onChange: (path: string) => void }) {
  const [busy, setBusy] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  const name = value ? value.split("/").pop()?.replace(/^[0-9a-f-]{36}-/, "") : null;
  return (
    <div>
      <input
        ref={input}
        type="file"
        accept={LIMITS.receipts.accept}
        className="sr-only"
        tabIndex={-1}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            const result = await uploadFile("receipts", new Date().toISOString().slice(0, 7), file);
            onChange(result.path);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Upload failed");
          } finally {
            setBusy(false);
          }
        }}
      />
      {value ? (
        <div className="flex h-11 items-center gap-3 rounded-control border border-line bg-canvas px-3.5">
          <Paperclip className="size-4 text-primary" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</span>
          <button type="button" onClick={() => onChange("")} className="rounded-full p-1 text-muted hover:text-danger" aria-label="Remove receipt">
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className={cn(
            "flex h-11 w-full items-center justify-center gap-2 rounded-control border border-dashed border-line-strong bg-canvas text-[13.5px] font-semibold text-fg-2 transition-colors hover:border-primary hover:text-primary",
            busy && "animate-pulse",
          )}
        >
          <Upload className="size-4" aria-hidden />
          {busy ? "Uploading…" : "Attach screenshot / receipt (optional)"}
        </button>
      )}
      <p className="mt-1.5 text-[12.5px] text-muted">{LIMITS.receipts.label}</p>
    </div>
  );
}

/** Square logo picker that uploads to the public logos bucket. */
export function LogoInput({
  value,
  onChange,
  folder,
  name,
}: {
  value: string;
  onChange: (url: string) => void;
  folder: string;
  name?: string;
}) {
  const [busy, setBusy] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="group relative flex size-[76px] shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-dashed border-line-strong bg-canvas hover:border-primary"
        aria-label={value ? "Change logo" : "Upload logo"}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="size-full object-cover" />
        ) : (
          <Upload className={cn("size-5 text-muted group-hover:text-primary", busy && "animate-pulse")} />
        )}
      </button>
      <div className="text-sm">
        <p className="font-semibold">{name ?? "Logo"}</p>
        <p className="text-muted">{busy ? "Uploading…" : LIMITS.logos.label}</p>
        {value ? (
          <button type="button" className="mt-1 text-[13px] font-semibold text-danger" onClick={() => onChange("")}>
            Remove
          </button>
        ) : null}
      </div>
      <input
        ref={input}
        type="file"
        accept={LIMITS.logos.accept}
        className="sr-only"
        tabIndex={-1}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            const result = await uploadFile("logos", folder, file);
            onChange(result.publicUrl ?? "");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Upload failed");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
