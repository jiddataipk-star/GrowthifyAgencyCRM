import type { Metadata } from "next";
import { Suspense } from "react";
import { HandCoins, MessageCircleMore, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/shell/brand";
import { GoogleSignIn } from "./google-sign-in";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh bg-white lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-frame p-14 text-white lg:flex lg:flex-col">
        <Logo className="w-[190px]" priority />
        <div className="mt-auto max-w-xl">
          <p className="mb-5 inline-flex rounded-full border border-frame-border bg-frame-2 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-accent uppercase">
            Growthify OS
          </p>
          <h1 className="text-[46px] leading-[1.05] font-bold tracking-[-0.03em] text-balance">We build the systems your business runs on.</h1>
          <p className="mt-5 max-w-md text-[17px] text-frame-text">
            Clients, projects, WhatsApp API, collections, profit and growth — one private workspace for the agency.
          </p>
        </div>
        <ul className="mt-12 grid max-w-xl grid-cols-3 gap-5 border-t border-frame-border pt-7">
          {[
            [HandCoins, "Collections", "Who owes what, until it's paid"],
            [MessageCircleMore, "WhatsApp API", "1 month · 3 months · 1 year"],
            [ShieldCheck, "Private", "Google sign-in, invited team only"],
          ].map(([Icon, title, text]) => {
            const I = Icon as typeof HandCoins;
            return (
              <li key={title as string}>
                <I className="size-5 text-accent" aria-hidden />
                <p className="mt-2 font-semibold">{title as string}</p>
                <p className="mt-0.5 text-[13px] text-frame-muted">{text as string}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-[400px]">
          <Logo onDark={false} className="mx-auto mb-10 w-[180px] lg:hidden" priority />
          <h2 className="text-[28px] font-bold">Sign in</h2>
          <p className="mt-2 text-[15px] text-fg-2">Use your Google account. Only team members invited by the owner can enter.</p>
          <Suspense fallback={<div className="mt-8 h-11 rounded-control bg-surface-2" />}>
            <GoogleSignIn />
          </Suspense>
          <p className="mt-10 text-xs text-muted">Private workspace of Growthify Agency · Faisalabad, Pakistan</p>
        </div>
      </section>
    </div>
  );
}
