"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

/** Error boundary for every authenticated page: keeps the shell, offers a retry. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <ErrorState
      title="This page couldn't load"
      description={error.digest ? `Something went wrong on our side (ref ${error.digest}). Try again; if it keeps happening, check the Supabase and Vercel status.` : undefined}
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
