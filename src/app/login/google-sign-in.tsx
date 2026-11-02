"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";

const ERRORS: Record<string, string> = {
  auth: "Google sign-in didn't complete. Please try again.",
  missing_code: "The sign-in link was incomplete. Please try again.",
};

/** Only allow relative in-app paths as the post-login destination. */
function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function GoogleSignIn() {
  const params = useSearchParams();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(ERRORS[params.get("error") ?? ""] ?? null);

  async function signIn() {
    setPending(true);
    setError(null);
    const next = safeNext(params.get("next"));
    const { error: oauthError } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (oauthError) {
      setPending(false);
      setError("Couldn't reach Google sign-in. Check that the Google provider is enabled in Supabase.");
    }
  }

  return (
    <div className="mt-8">
      {error ? (
        <p role="alert" className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
      <Button size="lg" className="w-full" onClick={signIn} loading={pending}>
        {pending ? null : <GoogleMark />}
        Continue with Google
      </Button>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="!size-5">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.92l-3.87-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.3v3.1A11.99 11.99 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.29 14.28A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.56.38-2.28v-3.1H1.3A12 12 0 0 0 0 12c0 1.94.46 3.77 1.3 5.38l3.99-3.1Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.3 6.62l3.99 3.1C6.23 6.88 8.88 4.77 12 4.77Z" />
    </svg>
  );
}
