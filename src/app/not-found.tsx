import Link from "next/link";
import { SearchX } from "lucide-react";
import { Logo } from "@/components/shell/brand";
import { IconCircle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12 text-center">
      <Logo onDark={false} className="mb-10 w-[180px]" />
      <IconCircle tone="accent">
        <SearchX />
      </IconCircle>
      <h1 className="mt-5 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 max-w-sm text-fg-2">The link may be old, or the record was deleted or archived.</p>
      <Button asChild className="mt-7">
        <Link href="/">Back to Overview</Link>
      </Button>
    </div>
  );
}
