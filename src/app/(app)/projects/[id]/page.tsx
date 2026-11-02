import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import { requireMember, canSeeFinance, isOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadActors, loadFormOptions } from "@/lib/data/lookups";
import { PROJECT_STATUS_LABELS, SERVICE_TYPE_LABELS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { dueLabel, formatDate, todayPK } from "@/lib/dates";
import { isUuid, param } from "@/lib/utils";
import { Card, Detail } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { LinkTabs } from "@/components/ui/misc";
import { StatusPill } from "@/components/ui/pill";
import { Avatar } from "@/components/ui/avatar";
import { FilesPanel } from "@/components/app/files-panel";
import { ActivityFeed } from "@/components/app/activity";
import { ProjectFormDialog } from "../project-form";
import { PaymentScheduleCard, ProgressControl, ProjectDangerZone, TasksCard } from "./project-widgets";

export const metadata: Metadata = { title: "Project" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function ProjectPage(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton kpis={0} />}>
      <ProjectDetail {...props} />
    </Suspense>
  );
}

async function ProjectDetail({ params, searchParams }: Props) {
  const member = await requireMember();
  const finance = canSeeFinance(member.role);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const today = todayPK();

  const [projectRes, membersRes, duesRes, tasksRes, filesRes, teamRes] = await Promise.all([
    supabase.from("projects").select("*, clients(id, business_name)").eq("id", id).maybeSingle(),
    supabase.from("project_members").select("team_member_id, team_members(id, name, email, avatar_url)").eq("project_id", id),
    finance ? supabase.from("dues").select("*").eq("project_id", id).order("position").order("due_date") : Promise.resolve({ data: [] }),
    supabase.from("tasks").select("id, title, done, due_date, assignee_id, created_by").eq("project_id", id).order("done").order("position"),
    supabase.from("files").select("id, name, size, created_at").eq("entity", "project").eq("entity_id", id).order("created_at", { ascending: false }),
    supabase.from("team_members").select("id, name, email").eq("active", true).order("name"),
  ]);
  const project = projectRes.data;
  if (!project) notFound();

  const tabs = [
    { value: "work", label: finance ? "Tasks & payments" : "Tasks" },
    { value: "files", label: "Files" },
    ...(finance ? [{ value: "activity", label: "Activity" }] : []),
  ];
  const tab = tabs.some((t) => t.value === param(query.tab)) ? param(query.tab)! : "work";
  const assigned = (membersRes.data ?? []).map((m) => m.team_members).filter(Boolean) as { id: string; name: string | null; email: string; avatar_url: string | null }[];
  const links = (project.links ?? {}) as Record<string, string>;
  const team = (teamRes.data ?? []).map((m) => ({ id: m.id, name: m.name ?? m.email }));
  const options = finance ? await loadFormOptions(supabase) : null;

  let activity = null;
  let actors: Record<string, string> = {};
  if (tab === "activity" && finance) {
    const dueIds = (duesRes.data ?? []).map((d) => d.id);
    const { data } = await supabase.from("activity_log").select("id, entity, action, label, diff, created_at, actor_id").in("entity_id", [id, ...dueIds]).order("created_at", { ascending: false }).limit(100);
    activity = data ?? [];
    actors = await loadActors(supabase);
  }

  return (
    <div className="flex flex-col gap-7">
      <Link href="/projects" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> All projects
      </Link>

      <div className="grid grid-cols-1 gap-7 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-2xl font-bold tracking-[-0.01em]">{project.title}</h2>
                <StatusPill status={project.status} label={PROJECT_STATUS_LABELS[project.status]} />
              </div>
              <p className="mt-1 text-fg-2">
                {finance && project.clients ? (
                  <Link href={`/clients/${project.clients.id}`} className="font-semibold hover:text-primary">{project.clients.business_name}</Link>
                ) : (
                  project.clients?.business_name
                )}{" "}
                · {SERVICE_TYPE_LABELS[project.service_type]}
              </p>
            </div>
            {finance && options ? (
              <div className="flex gap-2.5">
                <ProjectFormDialog
                  project={{ ...project, member_ids: assigned.map((m) => m.id) }}
                  clients={options.clients}
                  members={options.members}
                  trigger={<Button variant="secondary" size="sm"><Pencil /> Edit</Button>}
                />
                {isOwner(member.role) ? <ProjectDangerZone id={project.id} title={project.title} /> : null}
              </div>
            ) : null}
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
            {finance ? <Detail label="Contract value">{formatMoney(project.value, project.currency)}</Detail> : null}
            <Detail label="Start">{formatDate(project.start_date)}</Detail>
            <Detail label="Deadline">
              <span className={project.deadline && project.deadline < today && project.status !== "delivered" ? "text-danger" : undefined}>{formatDate(project.deadline)}</span>
            </Detail>
            <Detail label="Timeline">{project.status === "delivered" ? "Delivered" : project.deadline ? dueLabel(project.deadline, today).replace("Due", "") : "—"}</Detail>
          </dl>
          {Object.keys(links).length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {(["repo", "staging", "live"] as const).map((key) =>
                links[key] ? (
                  <Button key={key} asChild variant="outline" size="pill">
                    <a href={links[key]} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="!size-3.5" /> {key === "repo" ? "Repository" : key === "staging" ? "Staging" : "Live site"}
                    </a>
                  </Button>
                ) : null,
              )}
            </div>
          ) : null}
          {project.notes ? <p className="mt-5 rounded-2xl bg-surface-2 p-4 text-sm whitespace-pre-line text-fg-2">{project.notes}</p> : null}
        </Card>

        <div className="flex flex-col gap-7">
          <ProgressControl id={project.id} status={project.status} progress={project.progress} />
          <Card>
            <p className="mb-4 text-card font-bold">Team</p>
            {assigned.length ? (
              <ul className="space-y-3">
                {assigned.map((m) => (
                  <li key={m.id} className="flex items-center gap-3">
                    <Avatar src={m.avatar_url} name={m.name ?? m.email} size={36} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{m.name ?? m.email}</p>
                      <p className="truncate text-xs text-muted">{m.email}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No one assigned yet{finance ? " — use Edit to assign team members." : "."}</p>
            )}
          </Card>
        </div>
      </div>

      <LinkTabs tabs={tabs} />

      {tab === "work" ? (
        <div className={finance ? "grid grid-cols-1 gap-7 xl:grid-cols-2" : ""}>
          <TasksCard projectId={project.id} tasks={tasksRes.data ?? []} team={team} today={today} />
          {finance && options && project.clients ? (
            <PaymentScheduleCard
              projectId={project.id}
              clientId={project.client_id}
              clientName={project.clients.business_name}
              currency={project.currency}
              contractValue={project.value}
              dues={duesRes.data ?? []}
              today={today}
              options={{ clients: options.clients, projects: options.projects }}
            />
          ) : null}
        </div>
      ) : null}
      {tab === "files" ? <FilesPanel entity="project" entityId={project.id} files={filesRes.data ?? []} /> : null}
      {tab === "activity" && activity ? <ActivityFeed rows={activity} actors={actors} /> : null}
    </div>
  );
}
