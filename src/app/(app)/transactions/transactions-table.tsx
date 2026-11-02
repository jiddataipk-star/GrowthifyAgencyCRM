"use client";

import * as React from "react";
import Link from "next/link";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { Eye, ImageIcon, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CATEGORY_LABELS, METHOD_LABELS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDayMonth } from "@/lib/dates";
import { RowMenu, RowMenuItem, RowMenuSeparator } from "@/components/ui/misc";
import { Confirm } from "@/components/ui/confirm";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Detail } from "@/components/ui/card";
import { Amount, TxIcon } from "@/components/app/domain";
import type { FormOptions } from "@/lib/data/lookups";
import { TransactionFormDialog, type EditableTx } from "./transaction-form";
import { deleteTransactionAction } from "./actions";

export type TxRow = EditableTx & {
  due_id: string | null;
  created_at: string;
  clients: { business_name: string } | null;
  projects: { title: string } | null;
  employees: { name: string } | null;
  subscriptions: { name: string } | null;
};

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, TxRow>();

function purpose(tx: TxRow) {
  return tx.description ?? tx.subscriptions?.name ?? tx.projects?.title ?? CATEGORY_LABELS[tx.category];
}
function who(tx: TxRow) {
  return tx.party_name ?? tx.clients?.business_name ?? tx.employees?.name ?? null;
}
function time(tx: TxRow) {
  if (!tx.time) return null;
  const [h, m] = tx.time.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** Transactions (TanStack Table): date & time, from/to, what for, method, TID, amount, screenshot. */
export function TransactionsTable({ rows, options, canDelete }: { rows: TxRow[]; options: Pick<FormOptions, "clients" | "projects" | "employees">; canDelete: boolean }) {
  const [remove, setRemove] = React.useState<TxRow | null>(null);
  const [view, setView] = React.useState<TxRow | null>(null);

  const columns = React.useMemo(
    () =>
      helper.columns([
        helper.accessor("date", {
          header: "Date & time",
          cell: ({ row }) => (
            <div className="whitespace-nowrap">
              <p className="font-medium">{formatDate(row.original.date)}</p>
              <p className="text-xs text-muted">{time(row.original) ?? "—"}</p>
            </div>
          ),
        }),
        helper.display({
          id: "who",
          header: "From / to",
          cell: ({ row }) => (
            <div className="flex min-w-0 items-center gap-3">
              <TxIcon type={row.original.type} size="sm" />
              <div className="min-w-0">
                <p className="max-w-[220px] truncate font-semibold">{who(row.original) ?? "—"}</p>
                {row.original.clients && row.original.party_name ? (
                  <Link href={`/clients/${row.original.client_id}`} className="block max-w-[220px] truncate text-xs text-muted hover:text-primary">
                    {row.original.clients.business_name}
                  </Link>
                ) : (
                  <p className="text-xs text-muted">{row.original.employees ? "Team member" : row.original.type === "income" ? "Money in" : "Money out"}</p>
                )}
              </div>
            </div>
          ),
        }),
        helper.display({
          id: "purpose",
          header: "For",
          cell: ({ row }) => (
            <div className="min-w-0">
              <p className="max-w-[240px] truncate">{purpose(row.original)}</p>
              <p className="text-xs text-muted">{CATEGORY_LABELS[row.original.category]}</p>
            </div>
          ),
        }),
        helper.display({
          id: "method",
          header: "Method · TID",
          cell: ({ row }) => (
            <div>
              <p className="text-fg-2">{METHOD_LABELS[row.original.method]}</p>
              <p className="tabular max-w-[150px] truncate text-xs text-muted">{row.original.reference ?? "—"}</p>
            </div>
          ),
        }),
        helper.display({
          id: "amount",
          header: () => <span className="block text-right">Amount</span>,
          cell: ({ row }) => (
            <div className="text-right">
              <Amount minor={row.original.amount} currency={row.original.currency} type={row.original.type} />
            </div>
          ),
        }),
        helper.display({
          id: "actions",
          header: () => <span className="sr-only">Actions</span>,
          cell: ({ row }) => <RowActions tx={row.original} options={options} canDelete={canDelete} onDelete={setRemove} onView={setView} />,
        }),
      ]),
    [options, canDelete],
  );

  const table = useTable({ features, columns, data: rows });

  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-line bg-surface shadow-card lg:block">
        <table className="w-full text-sm">
          <thead className="bg-canvas">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th key={header.id} className="h-11 px-4 text-left text-[12.5px] font-semibold whitespace-nowrap text-muted first:pl-5 last:pr-3">
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="cursor-pointer border-t border-line hover:bg-canvas" onClick={() => setView(row.original)}>
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className="h-[62px] px-4 first:pl-5 last:pr-3">
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2.5 lg:hidden">
        {rows.map((tx) => (
          <li key={tx.id}>
            <button type="button" onClick={() => setView(tx)} className="flex w-full items-center gap-3 rounded-card border border-line bg-surface p-4 text-left shadow-card">
              <TxIcon type={tx.type} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{who(tx) ?? purpose(tx)}</p>
                <p className="truncate text-xs text-muted">
                  {formatDayMonth(tx.date)}
                  {time(tx) ? ` · ${time(tx)}` : ""} · {METHOD_LABELS[tx.method]}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Amount minor={tx.amount} currency={tx.currency} type={tx.type} className="text-sm" />
                {tx.receipt_url ? <ImageIcon className="size-3.5 text-muted" aria-label="Has screenshot" /> : null}
              </div>
            </button>
          </li>
        ))}
      </ul>

      <TxDetail tx={view} onClose={() => setView(null)} />
      <Confirm
        open={remove !== null}
        onOpenChange={(open) => !open && setRemove(null)}
        title="Delete this transaction?"
        description={remove ? `${purpose(remove)} · ${formatMoney(remove.amount, remove.currency)}. A linked payment request reopens automatically. This cannot be undone.` : undefined}
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

function TxDetail({ tx, onClose }: { tx: TxRow | null; onClose: () => void }) {
  return (
    <Dialog open={tx !== null} onOpenChange={(open) => !open && onClose()}>
      {tx ? (
        <DialogContent title={tx.type === "income" ? "Money in" : "Money out"} description={purpose(tx)}>
          <div className="mb-5 flex items-baseline justify-between gap-4 rounded-control bg-canvas px-4 py-3">
            <Amount minor={tx.amount} currency={tx.currency} type={tx.type} className="font-display text-2xl" />
            <span className="text-sm text-muted">{CATEGORY_LABELS[tx.category]}</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Detail label={tx.type === "income" ? "Received from" : "Paid to"}>{who(tx) ?? "—"}</Detail>
            <Detail label="Date & time">
              {formatDate(tx.date)}
              {time(tx) ? `, ${time(tx)}` : ""}
            </Detail>
            <Detail label="Method">{METHOD_LABELS[tx.method]}</Detail>
            <Detail label="Reference / TID">{tx.reference ?? "—"}</Detail>
            <Detail label="Client">{tx.clients ? <Link href={`/clients/${tx.client_id}`} className="text-primary hover:underline">{tx.clients.business_name}</Link> : "—"}</Detail>
            <Detail label="Project / plan">{tx.projects?.title ?? tx.subscriptions?.name ?? "—"}</Detail>
            {tx.notes ? <Detail label="Notes" className="col-span-2">{tx.notes}</Detail> : null}
          </dl>
          <div className="mt-5">
            <p className="mb-2 text-[12.5px] font-medium text-muted">Screenshot / receipt</p>
            {tx.receipt_url ? (
              tx.receipt_url.toLowerCase().endsWith(".pdf") ? (
                <a href={`/api/receipts/${tx.id}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary hover:underline">
                  Open PDF receipt
                </a>
              ) : (
                <a href={`/api/receipts/${tx.id}`} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-control border border-line bg-canvas">
                  {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                  <img src={`/api/receipts/${tx.id}`} alt="Payment screenshot" className="max-h-[360px] w-full object-contain" />
                </a>
              )
            ) : (
              <p className="text-sm text-muted">No screenshot attached.</p>
            )}
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function RowActions({
  tx,
  options,
  canDelete,
  onDelete,
  onView,
}: {
  tx: TxRow;
  options: Pick<FormOptions, "clients" | "projects" | "employees">;
  canDelete: boolean;
  onDelete: (tx: TxRow) => void;
  onView: (tx: TxRow) => void;
}) {
  const editTrigger = React.useRef<HTMLButtonElement>(null);
  return (
    // Stop row clicks (which open the detail view) when using the menu.
    <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
      {tx.receipt_url ? <ImageIcon className="size-4 text-muted" aria-label="Has screenshot" /> : null}
      <RowMenu label="Transaction actions">
        <RowMenuItem icon={<Eye />} onSelect={() => onView(tx)}>View details</RowMenuItem>
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
