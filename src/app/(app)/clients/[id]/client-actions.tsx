"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { archiveClientAction, deleteClientAction } from "../actions";

export function ClientDangerZone({ id, name, archived, canDelete }: { id: string; name: string; archived: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [confirmArchive, setConfirmArchive] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setConfirmArchive(true)}>
        {archived ? <ArchiveRestore /> : <Archive />} {archived ? "Restore" : "Archive"}
      </Button>
      {canDelete ? (
        <Button variant="danger-outline" size="sm" onClick={() => setConfirmDelete(true)}>
          <Trash2 /> Delete
        </Button>
      ) : null}
      <Confirm
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={archived ? `Restore ${name}?` : `Archive ${name}?`}
        description={archived ? "The client will appear in lists again." : "Archived clients are hidden from lists but keep all projects, invoices and payments."}
        confirmLabel={archived ? "Restore" : "Archive"}
        onConfirm={async () => {
          const result = await archiveClientAction({ id, archived: !archived });
          if (result.ok) toast.success(archived ? "Client restored" : "Client archived");
          else toast.error(result.error);
        }}
      />
      <Confirm
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${name} permanently?`}
        description="Only possible when the client has no projects, subscriptions or invoices. Payments keep their history without the client link. This cannot be undone."
        confirmLabel="Delete forever"
        danger
        onConfirm={async () => {
          const result = await deleteClientAction({ id });
          if (result.ok) {
            toast.success("Client deleted");
            router.push("/clients");
          } else toast.error(result.error);
        }}
      />
    </>
  );
}
