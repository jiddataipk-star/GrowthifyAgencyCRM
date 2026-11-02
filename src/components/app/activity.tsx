import { History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/dates";

export type ActivityRow = {
  id: string;
  entity: string;
  action: string;
  label: string | null;
  diff: unknown;
  created_at: string;
  actor_id: string | null;
};

const ENTITY: Record<string, string> = {
  clients: "client",
  leads: "lead",
  projects: "project",
  dues: "payment request",
  subscriptions: "subscription",
  plans: "plan",
  transactions: "transaction",
  employees: "employee",
  settings: "settings",
  team_members: "team member",
  services: "service",
  social_accounts: "social account",
};

const HIDDEN = new Set(["id", "created_at", "updated_at", "created_by", "share_token"]);

function changedFields(row: ActivityRow): string {
  if (row.action !== "update" || !row.diff || typeof row.diff !== "object") return "";
  const keys = Object.keys(row.diff as object).filter((k) => !HIDDEN.has(k));
  return keys.length ? ` · ${keys.slice(0, 4).join(", ").replace(/_/g, " ")}${keys.length > 4 ? "…" : ""}` : "";
}

/** Audit trail: who created / edited / deleted what, and when. */
export function ActivityFeed({ rows, actors }: { rows: ActivityRow[]; actors: Record<string, string> }) {
  if (!rows.length) {
    return (
      <Card>
        <EmptyState compact icon={<History />} title="No activity yet" description="Changes to clients, projects, money and settings are recorded here." />
      </Card>
    );
  }
  return (
    <Card className="py-3">
      <ol className="divide-y divide-line">
        {rows.map((row) => (
          <li key={row.id} className="flex gap-3 py-3">
            <span
              aria-hidden
              className={`mt-1.5 size-2.5 shrink-0 rounded-full ${row.action === "delete" ? "bg-danger" : row.action === "create" ? "bg-success" : "bg-primary"}`}
            />
            <div className="min-w-0 flex-1 text-sm">
              <p>
                <span className="font-bold">{(row.actor_id && actors[row.actor_id]) || "System"}</span>{" "}
                <span className="text-fg-2">
                  {row.action === "create" ? "created" : row.action === "delete" ? "deleted" : "updated"} {ENTITY[row.entity] ?? row.entity}
                </span>{" "}
                {row.label ? <span className="font-semibold">{row.label}</span> : null}
                <span className="text-muted">{changedFields(row)}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted">{formatDateTime(row.created_at)}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
