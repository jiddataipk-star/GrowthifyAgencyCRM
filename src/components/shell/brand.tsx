import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Final bright-lime brand files, never recoloured: the "on dark" logo sits on the
 * dark-green frame, the "on light" logo on white pages (login, 404).
 */
export function Logo({ className, priority, onDark = true }: { className?: string; priority?: boolean; onDark?: boolean }) {
  return (
    <span className={cn("block", className)}>
      <Image
        src={onDark ? "/brand/growthify-logo-on-dark.png" : "/brand/growthify-logo-on-light.png"}
        alt="Growthify Agency"
        width={1600}
        height={560}
        priority={priority}
        className="h-auto w-full"
      />
    </span>
  );
}

/** The G-arrow symbol (transparent background) for the collapsed rail. */
export function Symbol({ className }: { className?: string }) {
  return <Image src="/brand/growthify-symbol.svg" alt="Growthify" width={862} height={830} className={cn("h-auto", className)} />;
}
