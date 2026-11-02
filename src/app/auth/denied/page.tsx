import type { Metadata } from "next";
import { Suspense } from "react";
import { ShieldX } from "lucide-react";
import { Logo } from "@/components/shell/brand";
import { IconCircle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeniedEmail } from "./denied-email";

export const metadata: Metadata = { title: "Access not granted" };

export default function DeniedPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <Logo onDark={false} className="mb-10 w-[180px]" />
      <div className="w-full max-w-[440px] rounded-card border border-line bg-surface p-8 text-center">
        <IconCircle tone="danger" className="mx-auto">
          <ShieldX />
        </IconCircle>
        <h1 className="mt-5 text-2xl font-bold">Access not granted</h1>
        <Suspense fallback={<p className="mt-3 text-[15px] text-fg-2">This Google account isn&apos;t on the Growthify team list.</p>}>
          <DeniedEmail />
        </Suspense>
        <p className="mt-3 text-sm text-muted">Ask the owner to invite you from Settings → Team &amp; roles, then sign in again.</p>
        <form action="/auth/signout" method="post" className="mt-7">
          <Button type="submit" size="lg" className="w-full">
            Use another Google account
          </Button>
        </form>
      </div>
    </div>
  );
}
