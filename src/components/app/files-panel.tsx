"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { uploadFile } from "@/components/app/upload";
import { addFile, deleteFile } from "@/app/(app)/files/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Confirm } from "@/components/ui/confirm";
import { formatDateTime } from "@/lib/dates";

export type FileRow = { id: string; name: string; size: number; created_at: string };

function size(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Upload / list / download / delete files attached to a client or project. */
export function FilesPanel({ entity, entityId, files }: { entity: "client" | "project"; entityId: string; files: FileRow[] }) {
  const router = useRouter();
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [confirm, setConfirm] = React.useState<FileRow | null>(null);

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(list)) {
        const uploaded = await uploadFile("files", `${entity}/${entityId}`, file);
        const result = await addFile({ entity, entity_id: entityId, path: uploaded.path, name: uploaded.name, size: uploaded.size, mime_type: uploaded.type || undefined });
        if (!result.ok) throw new Error(result.error);
      }
      toast.success(list.length === 1 ? "File uploaded" : `${list.length} files uploaded`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-card font-bold">Files</p>
        <Button size="sm" variant="secondary" loading={busy} onClick={() => input.current?.click()}>
          <Upload /> Upload
        </Button>
        <input ref={input} type="file" multiple className="sr-only" tabIndex={-1} onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }} />
      </div>
      {files.length === 0 ? (
        <EmptyState compact icon={<FileText />} title="No files yet" description="Contracts, proposals, designs and handover documents live here." />
      ) : (
        <ul className="divide-y divide-line">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-3 py-3">
              <FileText className="size-5 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{file.name}</p>
                <p className="text-xs text-muted">
                  {size(file.size)} · {formatDateTime(file.created_at)}
                </p>
              </div>
              <Button asChild variant="outline" size="pill">
                <a href={`/api/files/${file.id}`} target="_blank" rel="noopener noreferrer">
                  <Download className="!size-4" /> Download
                </a>
              </Button>
              <button type="button" onClick={() => setConfirm(file)} className="rounded-full p-2 text-muted hover:text-danger" aria-label={`Delete ${file.name}`}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Confirm
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Delete this file?"
        description={confirm?.name}
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (!confirm) return;
          const result = await deleteFile({ id: confirm.id });
          if (result.ok) toast.success("File deleted");
          else toast.error(result.error);
        }}
      />
    </Card>
  );
}
