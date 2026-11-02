"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { CheckCircle2, KeyRound, Unplug } from "lucide-react";
import { toast } from "sonner";
import { PLATFORM_LABELS, SOCIAL_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime, timeAgo } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/form";
import { StatusPill } from "@/components/ui/pill";
import { Confirm } from "@/components/ui/confirm";
import { PlatformMark } from "@/components/app/domain";
import { connectMetaTokenAction, disconnectAction } from "../social/actions";
import { SyncButton } from "../social/social-widgets";
import type { Enums } from "@/types/db";

export type IntegrationAccount = {
  id: string;
  platform: Enums<"social_platform">;
  connection: Enums<"social_connection">;
  name: string | null;
  handle: string | null;
  status: Enums<"social_status">;
  token_expires_at: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  scopes: string[];
  /** Computed on the server (Threads tokens last ~60 days). */
  expires_soon?: boolean;
};

const HOW: Record<string, string> = {
  youtube: "Google sign-in with the Growthify channel's account (read-only YouTube + Analytics).",
  facebook: "System-user token (recommended) or Connect with Facebook — gives the Page and its linked Instagram.",
  instagram: "Comes with the Meta connection (the Instagram professional account linked to the Page).",
  threads: "Threads sign-in (threads_basic + threads_manage_insights).",
  linkedin: "Company page API needs LinkedIn approval — add follower counts manually on the Social page for now.",
  tiktok: "Manual follower counts for now (adapter interface ready for the API).",
};

export function IntegrationsPanel({ accounts, configured }: { accounts: IntegrationAccount[]; configured: { google: boolean; meta: boolean; threads: boolean; encryption: boolean } }) {
  const [disconnecting, setDisconnecting] = React.useState<IntegrationAccount | null>(null);
  const { register, handleSubmit, formState, reset } = useForm({ defaultValues: { token: "" } });

  return (
    <div className="space-y-8">
      {!configured.encryption ? (
        <p className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          TOKEN_ENCRYPTION_KEY is not set — connections can&apos;t be stored until it is (see docs/SETUP.md).
        </p>
      ) : null}

      <section className="rounded-control border border-line p-5">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex size-11 items-center justify-center rounded-full bg-primary-tint text-primary"><KeyRound className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-card font-bold">Meta: Facebook Page + Instagram</h3>
            <p className="mt-1 text-sm text-fg-2">
              <b>Option A (recommended):</b> paste a system-user token from Meta Business Settings → System users (no personal Facebook login needed here).
              <b> Option B:</b> Connect with Facebook.
            </p>
          </div>
          <Button asChild variant="secondary" size="sm" disabled={!configured.meta}>
            <a href="/api/integrations/meta/connect" aria-disabled={!configured.meta}>Connect with Facebook</a>
          </Button>
        </div>
        <form
          className="mt-5"
          onSubmit={handleSubmit(async ({ token }) => {
            const result = await connectMetaTokenAction({ token });
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success(`Connected ${result.data.page}${result.data.instagram ? ` + @${result.data.instagram}` : ""}`);
            reset();
          })}
        >
          <Field label="System-user access token" htmlFor="meta-token" hint="Permissions: pages_show_list, pages_read_engagement, read_insights, instagram_basic, instagram_manage_insights, business_management. Stored encrypted (AES-256-GCM), never shown again.">
            <Textarea rows={2} autoComplete="off" spellCheck={false} placeholder="EAAG…" className="font-mono text-xs" {...register("token", { required: true, minLength: 20 })} />
          </Field>
          <div className="mt-3 flex justify-end">
            <Button type="submit" loading={formState.isSubmitting}>Validate & connect</Button>
          </div>
        </form>
      </section>

      <ul className="divide-y divide-line rounded-control border border-line">
        {accounts.map((account) => {
          const connectHref =
            account.platform === "youtube" ? "/api/integrations/youtube/connect" : account.platform === "threads" ? "/api/integrations/threads/connect" : null;
          const enabled = account.platform === "youtube" ? configured.google : account.platform === "threads" ? configured.threads : true;
          const expiresSoon = account.expires_soon && account.platform === "threads";
          return (
            <li key={account.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3.5">
                <PlatformMark platform={account.platform} size={42} />
                <div className="min-w-0">
                  <p className="font-semibold">
                    {PLATFORM_LABELS[account.platform]}
                    {account.handle ? <span className="font-medium text-muted"> · {account.handle}</span> : null}
                  </p>
                  <p className="text-xs text-muted">
                    {account.status === "connected"
                      ? `${account.connection === "system_user" ? "System user" : account.connection === "manual" ? "Manual" : "OAuth"} · synced ${timeAgo(account.last_synced_at)}${account.token_expires_at ? ` · token until ${formatDateTime(account.token_expires_at)}` : ""}`
                      : HOW[account.platform]}
                  </p>
                  {account.last_error ? <p className="mt-0.5 line-clamp-2 text-xs text-danger">{account.last_error}</p> : null}
                  {expiresSoon ? <p className="mt-0.5 text-xs font-semibold text-fg">Token expires soon — the daily sync refreshes it automatically.</p> : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={account.status} label={SOCIAL_STATUS_LABELS[account.status]} />
                {account.status === "connected" && account.connection !== "manual" ? <SyncButton id={account.id} /> : null}
                {connectHref ? (
                  <Button asChild variant={account.status === "needs_reconnect" ? "danger-outline" : "outline"} size="pill" disabled={!enabled}>
                    <a href={enabled ? connectHref : undefined} aria-disabled={!enabled} title={enabled ? undefined : "Add the API keys first (docs/SETUP.md)"}>
                      {account.status === "not_connected" ? "Connect" : "Reconnect"}
                    </a>
                  </Button>
                ) : null}
                {account.status !== "not_connected" && account.connection !== "manual" ? (
                  <button type="button" onClick={() => setDisconnecting(account)} className="rounded-full p-2 text-muted hover:text-danger" aria-label={`Disconnect ${PLATFORM_LABELS[account.platform]}`}>
                    <Unplug className="size-4" />
                  </button>
                ) : null}
                {account.status === "connected" ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : null}
              </div>
            </li>
          );
        })}
      </ul>
      <Confirm
        open={disconnecting !== null}
        onOpenChange={(open) => !open && setDisconnecting(null)}
        title={`Disconnect ${disconnecting ? PLATFORM_LABELS[disconnecting.platform] : ""}?`}
        description="Stored tokens are deleted. Follower history stays."
        confirmLabel="Disconnect"
        danger
        onConfirm={async () => {
          if (!disconnecting) return;
          const result = await disconnectAction({ id: disconnecting.id });
          if (result.ok) toast.success("Disconnected");
          else toast.error(result.error);
        }}
      />
    </div>
  );
}
