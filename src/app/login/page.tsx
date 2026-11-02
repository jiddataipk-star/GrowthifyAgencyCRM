import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/shell/brand";
import { GoogleSignIn } from "./google-sign-in";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-line bg-sidebar p-14 lg:flex lg:flex-col">
        <Logo className="w-[200px]" priority />
        <div className="mt-auto max-w-xl">
          <p className="mb-6 inline-flex rounded-full border border-line px-3.5 py-1.5 text-xs font-bold tracking-[0.18em] text-accent-fg uppercase">
            Growthify OS
          </p>
          <h1 className="text-[52px] leading-[1.02] font-extrabold tracking-[-0.03em] text-balance">
            We build the systems your business runs on.
          </h1>
          <p className="mt-6 max-w-md text-lg text-fg-2">
            Clients, projects, subscriptions, invoices, team and growth — one private workspace for the agency.
          </p>
        </div>
        <dl className="mt-14 grid max-w-xl grid-cols-3 gap-6 border-t border-line pt-8">
          {[
            ["PKR-first", "Money in rupees, USD kept separate"],
            ["Role-based", "Owner · Manager · Staff"],
            ["Audit trail", "Every change is logged"],
          ].map(([title, text]) => (
            <div key={title}>
              <dt className="font-bold text-accent-fg">{title}</dt>
              <dd className="mt-1 text-sm text-muted">{text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-[420px]">
          <Logo className="mx-auto mb-10 w-[190px] lg:hidden" priority />
          <div className="rounded-card border border-line bg-surface p-7 sm:p-9">
            <h2 className="text-[26px] font-bold tracking-[-0.01em]">Sign in</h2>
            <p className="mt-2 text-[15px] text-fg-2">Use your Google account. Only team members invited by the owner can enter.</p>
            <Suspense fallback={<div className="mt-8 h-[50px] rounded-control bg-surface-2" />}>
              <GoogleSignIn />
            </Suspense>
          </div>
          <p className="mt-6 text-center text-xs text-muted">Private workspace of Growthify Agency · Faisalabad, Pakistan</p>
        </div>
      </section>
    </div>
  );
}
