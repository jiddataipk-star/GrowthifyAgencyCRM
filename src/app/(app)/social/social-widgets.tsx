"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { todayPK } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, FormGrid, Input, Select } from "@/components/ui/form";
import { addManualAccountAction, addManualMetricAction, syncNowAction } from "./actions";

export function SyncButton({ id, label = "Sync now", variant = "outline" }: { id?: string; label?: string; variant?: "outline" | "secondary" | "primary" }) {
  const [pending, start] = React.useTransition();
  return (
    <Button
      variant={variant}
      size={variant === "outline" ? "pill" : "sm"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await syncNowAction({ id });
          if (result.ok) toast.success(result.data.failed ? `Synced ${result.data.synced}, ${result.data.failed} need attention` : "Synced");
          else toast.error(result.error);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw className="!size-3.5" />} {pending ? "Syncing…" : label}
    </Button>
  );
}

export function ManualCountDialog({ accountId, platformLabel, trigger }: { accountId: string; platformLabel: string; trigger: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const defaults = { date: todayPK(), followers: "", views: "" };
  const { register, handleSubmit, reset, formState, setError } = useForm({ defaultValues: defaults });
  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) reset(defaults); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={`Add ${platformLabel} follower count`} description="Saved as a daily snapshot so it appears in the charts. Re-entering a date replaces it." size="sm">
        <form
          noValidate
          onSubmit={handleSubmit(async (values) => {
            const result = await addManualMetricAction({
              social_account_id: accountId,
              date: values.date,
              followers: Number(values.followers),
              views: values.views === "" ? undefined : Number(values.views),
            });
            if (!result.ok) {
              for (const [name, message] of Object.entries(result.fieldErrors ?? {})) setError(name as "followers", { message });
              toast.error(result.error);
              return;
            }
            toast.success("Snapshot saved");
            setOpen(false);
          })}
        >
          <FormGrid className="sm:grid-cols-1">
            <Field label="Date" htmlFor="m-date"><Input type="date" {...register("date")} /></Field>
            <Field label="Followers" htmlFor="m-followers" error={formState.errors.followers?.message}><Input type="number" min="0" inputMode="numeric" autoFocus {...register("followers")} /></Field>
            <Field label="Views / impressions (optional)" htmlFor="m-views"><Input type="number" min="0" inputMode="numeric" {...register("views")} /></Field>
          </FormGrid>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" size="lg" loading={formState.isSubmitting}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddManualAccountDialog() {
  const [open, setOpen] = React.useState(false);
  const defaults = { platform: "tiktok" as "tiktok" | "linkedin", name: "Growthify Agency", handle: "", profile_url: "" };
  const { register, handleSubmit, reset, formState, setError } = useForm({ defaultValues: defaults });
  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) reset(defaults); }}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm"><Plus /> Manual platform</Button>
      </DialogTrigger>
      <DialogContent title="Add a manually tracked platform" description="For platforms without an approved API yet (TikTok, LinkedIn company page)." size="sm">
        <form
          noValidate
          onSubmit={handleSubmit(async (values) => {
            const result = await addManualAccountAction(values);
            if (!result.ok) {
              for (const [name, message] of Object.entries(result.fieldErrors ?? {})) setError(name as "name", { message });
              toast.error(result.error);
              return;
            }
            toast.success("Platform added");
            setOpen(false);
          })}
        >
          <FormGrid className="sm:grid-cols-1">
            <Field label="Platform" htmlFor="ma-platform"><Select options={[{ value: "tiktok", label: "TikTok" }, { value: "linkedin", label: "LinkedIn" }]} {...register("platform")} /></Field>
            <Field label="Name" htmlFor="ma-name" error={formState.errors.name?.message}><Input {...register("name")} /></Field>
            <Field label="Handle" htmlFor="ma-handle"><Input placeholder="@growthifyagencypk" {...register("handle")} /></Field>
            <Field label="Profile link" htmlFor="ma-url" error={formState.errors.profile_url?.message}><Input type="url" placeholder="https://" {...register("profile_url")} /></Field>
          </FormGrid>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" size="lg" loading={formState.isSubmitting}>Add</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
