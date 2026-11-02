"use client";

import { useSearchParams } from "next/navigation";

export function DeniedEmail() {
  const email = useSearchParams().get("email");
  return (
    <p className="mt-3 text-[15px] text-fg-2">
      {email ? (
        <>
          <span className="font-semibold break-all text-fg">{email}</span> isn&apos;t on the Growthify team list.
        </>
      ) : (
        "This Google account isn't on the Growthify team list."
      )}
    </p>
  );
}
