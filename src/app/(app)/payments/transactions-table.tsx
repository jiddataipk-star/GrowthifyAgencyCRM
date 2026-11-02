"use client";

import * as React from "react";
import Link from "next/link";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { Download, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CATEGORY_LABELS, METHOD_LABELS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { RowMenu, RowMenuItem, RowMenuSeparator } from "@/components/ui/misc";
import { Confirm } from "@/components/ui/confirm";
import { Amount, TxIcon } from "@/components/app/domain";
import type { FormOptions } from "@/lib/data/lookups";
import { TransactionFormDialog, type EditableTx } from "./transaction-form";
import { deleteTransactionAction } from "./actions";

export type TxRow = EditableTx & {
  invoice_id: string | null;
  clients: { business_name: string } | null;
  projects: { title: string } | null;
  employees: { name: string } | null;
  invoices: { number: string } | null;
};

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, TxRow>();

function title(tx: TxRow) {
  return tx.description ?? tx.clients?.business_name ?? tx.employees?.name ?? CATEGORY_LABELS[tx.category];
}

function linkLabel(tx: TxRow) {
  if (tx.invoices) return { href: `/invoices/${tx.invoice_id}`, label: tx.invoices.number };
  if (tx.projects) return { href: `/projects/${tx.project_id}`, label: tx.projects.title };
  if (tx.clients) return { href: `/clients/${tx.client_id}`, label: tx.clients.business_name };
  return null;
}

/** Transactions table (TanStack Table v9) with BankDash outline-pill row actions; row-cards on phones. */
export function TransactionsTable({
  rows,
  options,
  canDelete,
}: {
  rows: TxRow[];
  options: Pick<FormOptions, "clients" | "projects" | "employees">;
  canDelete: boolean;
}) {
  const [remove, setRemove] = React.useState<TxRow | null>(null);

  const columns = React.useMemo(
    () =>
      helper.columns([
        helper.display({
          id: "description",
          header: "Description",
          cell: ({ row }) => {
            const tx = row.original;
            const link = linkLabel(tx);
            return (
              <div className="flex min-w-0 items-center gap-3">
                <TxIcon type={tx.type} size="sm" />
                <div className="min-w-0">
                  <p className="max-w-[260px] truncate font-semibold">{title(tx)}</p>
                  {link ? (
                    <Link href={link.href} className="block max-w-[260px] truncate text-xs text-muted hover:text-accent-fg">{link.label}</Link>
                  ) : (
                    <p className="text-xs text-muted">{tx.notes ? tx.notes.slice(0, 40) : "—"}</p>
                  )}
                </div>
              </div>
            );
          },
        }),
        helper.accessor("reference", {
          header: "Reference",
          cell: ({ getValue }) => <span className="font-mono text-xs text-fg-2">{getValue() ?? "—"}</span>,
        }),
        helper.accessor("category", {
          header: "Category",
          cell: ({ getValue }) => <span className="text-fg-2">{CATEGORY_LABELS[getValue()]}</span>,
        }),
        helper.accessor("method", {
          header: "Method",
          cell: ({ getValue }) => <span className="text-fg-2">{METHOD_LABELS[getValue()]}</span>,
        }),
        helper.accessor("date", {
          header: "Date",
          cell: ({ getValue }) => <span className="whitespace-nowrap text-fg-2">{formatDate(getValue())}</span>,
        }),
        helper.display({
          id: "amount",
          header: () => <span className="block text-right">Amount</span>,
          cell: ({ row }) => (
            <div className="text-right">
              <Amount minor={row.original.amount} currency={row.original.currency} type={row.original.type} />
              {row.original.tax_withheld ? <p className="text-[11px] text-muted">WHT {formatMoney(row.original.tax_withheld, row.original.currency)}</p> : null}
            </div>
          ),
        }),
        helper.display({
          id: "actions",
          header: () => <span className="block text-right">Receipt</span>,
          cell: ({ row }) => <RowActions tx={row.original} options={options} canDelete={canDelete} onDelete={setRemove} />,
        }),
      ]),
    [options, canDelete],
  );

  const table = useTable({ features, columns, data: rows });

  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-line bg-surface px-6 py-2 lg:block">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th key={header.id} className="h-[52px] pr-4 text-left font-medium whitespace-nowrap text-fg-2 last:pr-0">
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className="h-[60px] pr-4 last:pr-0">
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 lg:hidden">
        {rows.map((tx) => (
          <li key={tx.id} className="flex items-center gap-3 rounded-card border border-line bg-surface p-4">
            <TxIcon type={tx.type} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{title(tx)}</p>
              <p className="truncate text-xs text-muted">
                {formatDate(tx.date)} · {METHOD_LABELS[tx.method]}
                {tx.reference ? ` · ${tx.reference}` : ""}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Amount minor={tx.amount} currency={tx.currency} type={tx.type} className="text-sm" />
              <RowActions tx={tx} options={options} canDelete={canDelete} onDelete={setRemove} compact />
            </div>
          </li>
        ))}
      </ul>

      <Confirm
        open={remove !== null}
        onOpenChange={(open) => !open && setRemove(null)}
        title="Delete this transaction?"
        description={
          remove ? `${title(remove)} · ${formatMoney(remove.amount, remove.currency)}. Linked invoices and milestones are recalculated. This cannot be undone.` : undefined
        }
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (!remove) return;
          const result = await deleteTransactionAction({ id: remove.id });
          if (result.ok) toast.success("Transaction deleted");
          else toast.error(result.error);
        }}
      />
    </>
  );
}

function RowActions({
  tx,
  options,
  canDelete,
  onDelete,
  compact,
}: {
  tx: TxRow;
  options: Pick<FormOptions, "clients" | "projects" | "employees">;
  canDelete: boolean;
  onDelete: (tx: TxRow) => void;
  compact?: boolean;
}) {
  const editTrigger = React.useRef<HTMLButtonElement>(null);
  return (
    <div className="flex items-center justify-end gap-1">
      {tx.receipt_url && !compact ? (
        <Button asChild variant="outline" size="pill">
          <a href={`/api/receipts/${tx.id}`} target="_blank" rel="noopener noreferrer">
            <Download className="!size-3.5" /> Download
          </a>
        </Button>
      ) : null}
      <RowMenu label="Transaction actions">
        {tx.receipt_url && compact ? <RowMenuItem icon={<Download />} href={`/api/receipts/${tx.id}`}>Download receipt</RowMenuItem> : null}
        <RowMenuItem icon={<Pencil />} onSelect={() => editTrigger.current?.click()}>Edit</RowMenuItem>
        {canDelete ? (
          <>
            <RowMenuSeparator />
            <RowMenuItem icon={<Trash2 />} danger onSelect={() => onDelete(tx)}>Delete</RowMenuItem>
          </>
        ) : null}
      </RowMenu>
      <TransactionFormDialog tx={tx} options={options} trigger={<button ref={editTrigger} type="button" className="hidden" tabIndex={-1} aria-hidden />} />
    </div>
  );
}
