"use client";

import * as React from "react";
import { Ban, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RowMenu, RowMenuItem, RowMenuSeparator } from "@/components/ui/misc";
import { Confirm } from "@/components/ui/confirm";
import { PaymentDialog } from "@/components/app/payment-dialog";
import { formatMoney } from "@/lib/money";
import { formatDayMonth } from "@/lib/dates";
import { INTERVAL_LABELS } from "@/lib/constants";
import type { Option, PlanOption } from "@/lib/data/lookups";
import type { Tables } from "@/types/db";
import { SubscriptionFormDialog } from "./subscription-form";
import { deleteSubscriptionAction, markSubscriptionPaidAction, setSubscriptionStatusAction } from "./actions";

export function MarkPaidButton({ sub, clientName, variant = "outline" }: { sub: Tables<"subscriptions">; clientName?: string | null; variant?: "outline" | "primary" }) {
  if (sub.status === "cancelled") return null;
  return (
    <PaymentDialog
      title={`Renew · ${clientName ?? sub.name}`}
      description={
        <>
          {sub.name} · renewal date <b className="text-fg">{formatDayMonth(sub.next_due_date)}</b>. Records the payment and extends it by {INTERVAL_LABELS[sub.interval_months]}.
        </>
      }
      currency={sub.currency}
      amount={sub.amount}
      partyName={clientName}
      submitLabel="Mark paid & renew"
      trigger={<Button variant={variant} size={variant === "primary" ? "sm" : "pill"}>Mark paid</Button>}
      onSubmit={(values) =>
        markSubscriptionPaidAction({
          id: sub.id,
          amount: values.amount,
          paid_on: values.paid_on,
          time: values.time,
          party_name: values.party_name,
          method: values.method as never,
          reference: values.reference,
          receipt_url: values.receipt_url,
          notes: values.notes,
        })
      }
    />
  );
}

export function SubscriptionMenu({
  sub,
  clients,
  plans,
  canDelete,
}: {
  sub: Tables<"subscriptions">;
  clients: Option[];
  plans: PlanOption[];
  canDelete: boolean;
}) {
  const [confirm, setConfirm] = React.useState<null | "cancel" | "delete">(null);
  const editTrigger = React.useRef<HTMLButtonElement>(null);

  async function setStatus(status: "active" | "paused" | "cancelled") {
    const result = await setSubscriptionStatusAction({ id: sub.id, status });
    if (result.ok) toast.success(status === "active" ? "Subscription resumed" : status === "paused" ? "Subscription paused" : "Subscription cancelled");
    else toast.error(result.error);
  }

  return (
    <>
      <RowMenu label={`Actions for ${sub.name}`}>
        <RowMenuItem icon={<Pencil />} onSelect={() => editTrigger.current?.click()}>Edit</RowMenuItem>
        {sub.status === "active" ? <RowMenuItem icon={<Pause />} onSelect={() => setStatus("paused")}>Pause</RowMenuItem> : null}
        {sub.status !== "active" ? <RowMenuItem icon={<Play />} onSelect={() => setStatus("active")}>Resume</RowMenuItem> : null}
        {sub.status !== "cancelled" ? <RowMenuItem icon={<Ban />} danger onSelect={() => setConfirm("cancel")}>Cancel subscription</RowMenuItem> : null}
        {canDelete ? (
          <>
            <RowMenuSeparator />
            <RowMenuItem icon={<Trash2 />} danger onSelect={() => setConfirm("delete")}>Delete</RowMenuItem>
          </>
        ) : null}
      </RowMenu>
      <SubscriptionFormDialog subscription={sub} clients={clients} plans={plans} trigger={<button ref={editTrigger} type="button" className="hidden" aria-hidden tabIndex={-1} />} />
      <Confirm
        open={confirm === "cancel"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Cancel ${sub.name}?`}
        description={`It stops counting towards MRR (${formatMoney(sub.amount, sub.currency)}). Past payments stay on record.`}
        confirmLabel="Cancel subscription"
        danger
        onConfirm={() => setStatus("cancelled")}
      />
      <Confirm
        open={confirm === "delete"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Delete this subscription?"
        description="Recorded payments stay in Payments without the subscription link. Prefer Cancel to keep history."
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          const result = await deleteSubscriptionAction({ id: sub.id });
          if (result.ok) toast.success("Subscription deleted");
          else toast.error(result.error);
        }}
      />
    </>
  );
}
