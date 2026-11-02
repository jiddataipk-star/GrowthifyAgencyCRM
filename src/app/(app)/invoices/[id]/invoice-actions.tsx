"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Copy, Download, Link2, MessageCircle, Pencil, RefreshCw, Send, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RowMenu, RowMenuItem, RowMenuSeparator } from "@/components/ui/misc";
import { Confirm } from "@/components/ui/confirm";
import { PaymentDialog } from "@/components/app/payment-dialog";
import { whatsappLink, whatsappShareLink } from "@/lib/phone";
import { formatMoney } from "@/lib/money";
import { formatDayMonth } from "@/lib/dates";
import { deleteInvoiceAction, markInvoiceSentAction, recordInvoicePaymentAction, regenerateShareLinkAction, voidInvoiceAction } from "../actions";

type Props = {
  id: string;
  number: string;
  status: "draft" | "sent" | "partial" | "paid" | "void";
  currency: string;
  balance: number;
  total: number;
  dueDate: string;
  shareUrl: string;
  clientPhone: string | null;
  contactName: string | null;
  company: string;
  editable: boolean;
  canDelete: boolean;
};

export function InvoiceActions(props: Props) {
  const router = useRouter();
  const [confirm, setConfirm] = React.useState<null | "void" | "delete" | "regenerate">(null);
  const [pending, startTransition] = React.useTransition();

  const message = `Assalam o Alaikum${props.contactName ? ` ${props.contactName}` : ""}, please find invoice ${props.number} for ${formatMoney(props.balance || props.total, props.currency)}${
    props.status === "paid" ? "" : `, due on ${formatDayMonth(props.dueDate)}`
  }:\n${props.shareUrl}\n\nThank you! — ${props.company}`;
  const whatsapp = whatsappLink(props.clientPhone, message) ?? whatsappShareLink(message);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    const result = await fn();
    if (result.ok) toast.success(success);
    else toast.error(result.error ?? "Something went wrong");
    return result;
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {props.status !== "void" && props.status !== "paid" ? (
        <PaymentDialog
          title={`Record payment · ${props.number}`}
          description={`Balance due ${formatMoney(props.balance, props.currency)}. If the client deducted withholding tax, enter it separately — together they settle the invoice.`}
          currency={props.currency}
          amount={props.balance}
          amountEditable
          withholding
          submitLabel="Record payment"
          trigger={<Button><Wallet /> Mark paid</Button>}
          onSubmit={(values) =>
            recordInvoicePaymentAction({
              id: props.id,
              amount: values.amount,
              tax_withheld: values.tax_withheld,
              paid_on: values.paid_on,
              method: values.method as never,
              reference: values.reference,
              receipt_url: values.receipt_url,
              notes: values.notes,
            })
          }
        />
      ) : null}
      {props.status === "draft" ? (
        <Button
          variant="secondary"
          loading={pending}
          onClick={() => startTransition(async () => void (await run(() => markInvoiceSentAction({ id: props.id }), "Marked as sent")))}
        >
          <Send /> Mark sent
        </Button>
      ) : null}
      {props.status !== "draft" && props.status !== "void" ? (
        <Button asChild variant="outline" size="md" className="border-success/60 text-success hover:border-success hover:text-success">
          <a href={whatsapp} target="_blank" rel="noopener noreferrer">
            <MessageCircle /> Share on WhatsApp
          </a>
        </Button>
      ) : null}
      <Button asChild variant="secondary">
        <a href={`/api/invoices/${props.id}/pdf`} target="_blank" rel="noopener noreferrer">
          <Download /> PDF
        </a>
      </Button>
      <RowMenu label="More invoice actions">
        {props.editable ? <RowMenuItem icon={<Pencil />} onSelect={() => router.push(`/invoices/${props.id}/edit`)}>Edit invoice</RowMenuItem> : null}
        {props.status !== "draft" ? (
          <RowMenuItem
            icon={<Copy />}
            onSelect={async () => {
              try {
                await navigator.clipboard.writeText(props.shareUrl);
                toast.success("Client link copied");
              } catch {
                toast.error("Couldn't copy. The link is shown under Share link.");
              }
            }}
          >
            Copy client link
          </RowMenuItem>
        ) : null}
        {props.status !== "draft" ? <RowMenuItem icon={<RefreshCw />} onSelect={() => setConfirm("regenerate")}>New link (revoke old)</RowMenuItem> : null}
        <RowMenuItem icon={<Link2 />} href={`/api/invoices/${props.id}/pdf?download=1`}>Download PDF</RowMenuItem>
        {props.status !== "void" && props.status !== "paid" && props.status !== "partial" ? (
          <>
            <RowMenuSeparator />
            <RowMenuItem icon={<Ban />} danger onSelect={() => setConfirm("void")}>Void invoice</RowMenuItem>
          </>
        ) : null}
        {props.canDelete ? <RowMenuItem icon={<Trash2 />} danger onSelect={() => setConfirm("delete")}>Delete</RowMenuItem> : null}
      </RowMenu>

      <Confirm
        open={confirm === "void"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Void ${props.number}?`}
        description="The number stays used (no gaps), the invoice no longer counts as outstanding and can't receive payments."
        confirmLabel="Void invoice"
        danger
        onConfirm={() => run(() => voidInvoiceAction({ id: props.id }), "Invoice voided")}
      />
      <Confirm
        open={confirm === "delete"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Delete ${props.number}?`}
        description={props.status === "draft" ? "Drafts can be deleted safely." : "Prefer Void for sent invoices so your numbering has no gaps."}
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          const result = await run(() => deleteInvoiceAction({ id: props.id }), "Invoice deleted");
          if (result.ok) router.push("/invoices");
        }}
      />
      <Confirm
        open={confirm === "regenerate"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Create a new client link?"
        description="Links you shared before stop working. Use this if a link was sent to the wrong person."
        confirmLabel="Create new link"
        onConfirm={() => run(() => regenerateShareLinkAction({ id: props.id }), "New link created")}
      />
      <Link href="/invoices" className="sr-only">Back to invoices</Link>
    </div>
  );
}
