"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { projectSchema, type ProjectInput } from "@/lib/validation";
import { currencyOptions, projectStatusOptions, serviceTypeOptions } from "@/lib/constants";
import { todayPK } from "@/lib/dates";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox, Field, FormGrid, Input, Select, Textarea, Label } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { applyFieldErrors } from "@/components/app/form-utils";
import type { Option } from "@/lib/data/lookups";
import type { Tables } from "@/types/db";
import { createProjectAction, updateProjectAction } from "./actions";

type ProjectWithMembers = Tables<"projects"> & { member_ids: string[] };

function defaults(project?: ProjectWithMembers, clientId?: string): ProjectInput {
  const links = (project?.links ?? {}) as Record<string, string>;
  return {
    client_id: project?.client_id ?? clientId ?? "",
    title: project?.title ?? "",
    service_type: project?.service_type ?? "custom_software",
    value: project ? project.value / 100 : 0,
    currency: project?.currency ?? "PKR",
    start_date: project?.start_date ?? todayPK(),
    deadline: project?.deadline ?? "",
    status: project?.status ?? "planning",
    progress: project?.progress ?? 0,
    repo: links.repo ?? "",
    staging: links.staging ?? "",
    live: links.live ?? "",
    notes: project?.notes ?? "",
    member_ids: project?.member_ids ?? [],
  };
}

export function ProjectFormDialog({
  project,
  clients,
  members,
  defaultClientId,
  trigger,
}: {
  project?: ProjectWithMembers;
  clients: Option[];
  members: Option[];
  defaultClientId?: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const form = useForm<ProjectInput>({ resolver: zodResolver(projectSchema) as never, defaultValues: defaults(project, defaultClientId) });
  const { register, handleSubmit, formState, setError, reset, watch, setValue } = form;
  const errors = formState.errors;
  const memberIds = watch("member_ids") ?? [];

  const onSubmit = handleSubmit(async (values) => {
    const result = project ? await updateProjectAction({ ...values, id: project.id }) : await createProjectAction(values);
    if (!result.ok) {
      applyFieldErrors(result.fieldErrors, setError);
      toast.error(result.error);
      return;
    }
    toast.success(project ? "Project updated" : "Project created");
    setOpen(false);
    if (!project && result.data) router.push(`/projects/${(result.data as { id: string }).id}`);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset(defaults(project, defaultClientId));
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={project ? "Edit project" : "New project"} size="lg">
        {clients.length === 0 ? (
          <p className="text-fg-2">Add a client first — every project belongs to a client.</p>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <FormGrid>
              <Field label="Client" htmlFor="client_id" error={errors.client_id?.message} required>
                <Select placeholder="Choose a client" options={clients.map((c) => ({ value: c.id, label: c.name }))} {...register("client_id")} />
              </Field>
              <Field label="Project title" htmlFor="title" error={errors.title?.message} required>
                <Input placeholder="e.g. Clinic CRM & booking bot" {...register("title")} />
              </Field>
              <Field label="Service type" htmlFor="service_type" error={errors.service_type?.message}>
                <Select options={serviceTypeOptions} {...register("service_type")} />
              </Field>
              <div className="grid grid-cols-[1fr_120px] gap-3">
                <Field label="Contract value" htmlFor="value" error={errors.value?.message}>
                  <Input type="number" inputMode="decimal" min="0" step="0.01" {...register("value")} />
                </Field>
                <Field label="Currency" htmlFor="currency">
                  <Select options={currencyOptions.map((o) => ({ value: o.value, label: o.value }))} {...register("currency")} />
                </Field>
              </div>
              <Field label="Start date" htmlFor="start_date" error={errors.start_date?.message}>
                <Input type="date" {...register("start_date")} />
              </Field>
              <Field label="Deadline" htmlFor="deadline" error={errors.deadline?.message}>
                <Input type="date" {...register("deadline")} />
              </Field>
              <Field label="Status" htmlFor="status" error={errors.status?.message}>
                <Select options={projectStatusOptions} {...register("status")} />
              </Field>
              <Field label="Progress (%)" htmlFor="progress" error={errors.progress?.message}>
                <Input type="number" min="0" max="100" step="5" {...register("progress")} />
              </Field>
              <Field label="Repository link" htmlFor="repo" error={errors.repo?.message}>
                <Input type="url" placeholder="https://github.com/…" {...register("repo")} />
              </Field>
              <Field label="Staging link" htmlFor="staging" error={errors.staging?.message}>
                <Input type="url" placeholder="https://staging…" {...register("staging")} />
              </Field>
              <Field label="Live link" htmlFor="live" error={errors.live?.message} className="sm:col-span-2">
                <Input type="url" placeholder="https://…" {...register("live")} />
              </Field>
              {members.length ? (
                <fieldset className="sm:col-span-2">
                  <Label className="mb-3">Assigned team members</Label>
                  <div className="flex flex-wrap gap-2">
                    {members.map((member) => {
                      const checked = memberIds.includes(member.id);
                      return (
                        <label
                          key={member.id}
                          className={`flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${checked ? "border-accent-fg text-accent-fg" : "border-line text-fg-2 hover:border-line-strong"}`}
                        >
                          <Checkbox
                            checked={checked}
                            onChange={(event) =>
                              setValue(
                                "member_ids",
                                event.target.checked ? [...memberIds, member.id] : memberIds.filter((id) => id !== member.id),
                              )
                            }
                            className="size-4"
                          />
                          {member.name}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ) : null}
              <Field label="Notes" htmlFor="notes" error={errors.notes?.message} className="sm:col-span-2">
                <Textarea placeholder="Scope, credentials location, anything the team needs…" {...register("notes")} />
              </Field>
            </FormGrid>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="lg" loading={formState.isSubmitting}>
                {project ? "Save changes" : "Create project"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
