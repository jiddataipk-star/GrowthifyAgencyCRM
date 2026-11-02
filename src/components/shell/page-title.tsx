"use client";

import { usePathname } from "next/navigation";
import { titleFor } from "@/components/shell/nav";

export function PageTitle({ className }: { className?: string }) {
  const pathname = usePathname();
  return <h1 className={className}>{titleFor(pathname)}</h1>;
}
