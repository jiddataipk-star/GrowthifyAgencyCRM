"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, ExternalLink, Pencil, Plus, Trash2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { LEAD_STAGE_LABELS, SERVICE_TYPE_SHORT, SOURCE_LABELS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { dueLabel, formatDayMonth } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RowMenu, RowMenuItem, RowMenuSeparator } from "@/components/ui/misc";
import { Confirm } from "@/components/ui/confirm";
import { WhatsAppLink } from "@/components/app/domain";
import type { Enums } from "@/types/db";
import { ConvertLeadDialog, LeadFormDialog, type Lead } from "./lead-dialogs";
import { deleteLeadAction, moveLeadAction } from "./actions";

const STAGES: Enums<"lead_stage">[] = ["new", "contacted", "proposal_sent", "negotiation", "won", "lost"];
const STAGE_COLOR: Record<Enums<"lead_stage">, string> = {
  new: "var(--info)",
  contacted: "var(--accent-fg)",
  proposal_sent: "var(--warning)",
  negotiation: "var(--warning)",
  won: "var(--success)",
  lost: "var(--danger)",
};

export function LeadsBoard({ leads: initial, today }: { leads: Lead[]; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [leads, setLeads] = React.useState(initial);
  const [active, setActive] = React.useState<Lead | null>(null);
  const [editing, setEditing] = React.useState<Lead | null | undefined>(undefined);
  const [converting, setConverting] = React.useState<Lead | null>(null);
  const [removing, setRemoving] = React.useState<Lead | null>(null);
  const [dismissed, setDismissed] = React.useState<string | null>(null);

  // Fresh server data replaces the optimistic local copy.
  const [source, setSource] = React.useState(initial);
  if (source !== initial) {
    setSource(initial);
    setLeads(initial);
  }

  // Deep link from notifications / search: /leads?lead=<id>
  const deepLink = params.get("lead");
  const deepLead = deepLink && dismissed !== deepLink ? (initial.find((l) => l.id === deepLink) ?? null) : null;
  const editorLead = editing !== undefined ? editing : (deepLead ?? undefined);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function onDragStart(event: DragStartEvent) {
    setActive(leads.find((l) => l.id === event.active.id) ?? null);
  }

  async function onDragEnd(event: DragEndEvent) {
    setActive(null);
    const stage = event.over?.id as Enums<"lead_stage"> | undefined;
    const lead = leads.find((l) => l.id === event.active.id);
    if (!stage || !lead || lead.stage === stage) return;
    if (stage === "won" && !lead.converted_client_id) {
      setConverting(lead);
      return;
    }
    const previous = leads;
    setLeads((list) => list.map((l) => (l.id === lead.id ? { ...l, stage } : l)));
    const result = await moveLeadAction({ id: lead.id, stage });
    if (!result.ok) {
      setLeads(previous);
      toast.error(result.error);
    } else {
      toast.success(`${lead.name} → ${LEAD_STAGE_LABELS[stage]}`);
    }
  }

  function closeEditor(open: boolean) {
    if (open) return;
    setEditing(undefined);
    if (deepLink) {
      setDismissed(deepLink);
      router.replace(pathname, { scroll: false });
    }
  }

  return (
    <>
      <div className="mb-5 flex justify-end">
        <Button onClick={() => setEditing(null)}>
          <Plus /> Add lead
        </Button>
      </div>
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActive(null)}
        accessibility={{
          announcements: {
            onDragStart: ({ active: a }) => `Picked up ${leads.find((l) => l.id === a.id)?.name ?? "lead"}.`,
            onDragOver: ({ over }) => (over ? `Over ${LEAD_STAGE_LABELS[over.id as Enums<"lead_stage">]}.` : "Not over a stage."),
            onDragEnd: ({ over }) => (over ? `Moved to ${LEAD_STAGE_LABELS[over.id as Enums<"lead_stage">]}.` : "Dropped."),
            onDragCancel: () => "Move cancelled.",
          },
        }}
      >
        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 min-[1800px]:grid min-[1800px]:grid-cols-6">
          {STAGES.map((stage) => {
            const items = leads.filter((l) => l.stage === stage);
            const value = items.filter((l) => l.currency === "PKR").reduce((sum, l) => sum + l.est_value, 0);
            return (
              <Column key={stage} stage={stage} count={items.length} value={value}>
                {items.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    today={today}
                    onEdit={() => setEditing(lead)}
                    onConvert={() => setConverting(lead)}
                    onDelete={() => setRemoving(lead)}
                  />
                ))}
                {stage === "new" ? (
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-strong py-3 text-sm font-semibold text-muted hover:border-accent-fg hover:text-accent-fg"
                  >
                    <Plus className="size-4" /> New lead
                  </button>
                ) : null}
              </Column>
            );
          })}
        </div>
        <DragOverlay dropAnimation={null}>{active ? <CardBody lead={active} today={today} dragging /> : null}</DragOverlay>
      </DndContext>

      <LeadFormDialog open={editorLead !== undefined} onOpenChange={closeEditor} lead={editorLead} />
      <ConvertLeadDialog lead={converting} onOpenChange={(open) => !open && setConverting(null)} />
      <Confirm
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Delete lead ${removing?.name}?`}
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (!removing) return;
          const result = await deleteLeadAction({ id: removing.id });
          if (result.ok) toast.success("Lead deleted");
          else toast.error(result.error);
        }}
      />
    </>
  );
}

function Column({ stage, count, value, children }: { stage: Enums<"lead_stage">; count: number; value: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${LEAD_STAGE_LABELS[stage]} (${count})`}
      className={cn(
        "flex w-[272px] shrink-0 snap-start flex-col rounded-card border border-line bg-surface/60 p-3 transition-colors min-[1800px]:w-auto",
        isOver && "border-accent-fg bg-surface-2",
      )}
    >
      <header className="mb-3 px-1.5 pt-1">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ background: STAGE_COLOR[stage] }} />
          <h3 className="text-[15px] font-bold">{LEAD_STAGE_LABELS[stage]}</h3>
          <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-fg-2">{count}</span>
        </div>
        <p className="tabular mt-1 text-xs text-muted">{value ? formatMoney(value, "PKR") : "—"}</p>
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-3">{children}</div>
    </section>
  );
}

function LeadCard({ lead, today, onEdit, onConvert, onDelete }: { lead: Lead; today: string; onEdit: () => void; onConvert: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn("touch-manipulation", isDragging && "opacity-40")}
    >
      <CardBody
        lead={lead}
        today={today}
        handleProps={{ ...attributes, ...listeners }}
        menu={
          <RowMenu label={`Actions for ${lead.name}`}>
            <RowMenuItem icon={<Pencil />} onSelect={onEdit}>Edit</RowMenuItem>
            {lead.converted_client_id ? (
              <RowMenuItem icon={<ExternalLink />} href={`/clients/${lead.converted_client_id}`}>Open client</RowMenuItem>
            ) : (
              <RowMenuItem icon={<UserCheck />} onSelect={onConvert}>Convert to client</RowMenuItem>
            )}
            <RowMenuSeparator />
            <RowMenuItem icon={<Trash2 />} danger onSelect={onDelete}>Delete</RowMenuItem>
          </RowMenu>
        }
      />
    </div>
  );
}

function CardBody({
  lead,
  today,
  dragging,
  handleProps,
  menu,
}: {
  lead: Lead;
  today: string;
  dragging?: boolean;
  handleProps?: React.HTMLAttributes<HTMLDivElement>;
  menu?: React.ReactNode;
}) {
  const due = lead.next_follow_up && !["won", "lost"].includes(lead.stage) ? lead.next_follow_up : null;
  const overdue = due !== null && due < today;
  return (
    <article className={cn("rounded-2xl border border-line bg-surface p-3.5", dragging && "rotate-[1.5deg] border-accent-fg shadow-pop")}>
      <div className="flex items-start gap-2">
        <div
          {...handleProps}
          className="min-w-0 flex-1 cursor-grab rounded-lg outline-offset-4 active:cursor-grabbing"
          aria-roledescription="Draggable lead. Press space to pick up, arrow keys to move, space to drop."
        >
          <p className="truncate text-sm font-bold">{lead.name}</p>
          <p className="truncate text-xs text-muted">{lead.business ?? SOURCE_LABELS[lead.source]}</p>
        </div>
        {menu}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {lead.service_interest ? <span className="font-semibold text-fg-2">{SERVICE_TYPE_SHORT[lead.service_interest]}</span> : null}
        {lead.est_value ? <span className="tabular font-bold text-accent-fg">{formatMoney(lead.est_value, lead.currency, { compact: true })}</span> : null}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        {due ? (
          <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", overdue ? "text-danger" : due === today ? "text-warning" : "text-muted")}>
            <CalendarClock className="size-3.5" /> {due === today ? "Follow up today" : overdue ? dueLabel(due, today) : formatDayMonth(due)}
          </span>
        ) : lead.stage === "lost" && lead.lost_reason ? (
          <span className="truncate text-xs text-muted">{lead.lost_reason}</span>
        ) : lead.converted_client_id ? (
          <Link href={`/clients/${lead.converted_client_id}`} className="text-xs font-semibold text-success hover:underline">Client →</Link>
        ) : (
          <span />
        )}
        <WhatsAppLink variant="icon" phone={lead.phone} label={`WhatsApp ${lead.name}`} className="size-8" />
      </div>
    </article>
  );
}
