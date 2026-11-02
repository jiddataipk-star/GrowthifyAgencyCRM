import Image from "next/image";
import { cn } from "@/lib/utils";

/** Full logo, switching file with the theme (final bright-lime assets, never recoloured). */
export function Logo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <span className={cn("block", className)}>
      <Image
        src="/brand/growthify-logo-on-dark.png"
        alt="Growthify Agency"
        width={1600}
        height={560}
        priority={priority}
        className="h-auto w-full light:hidden"
      />
      <Image
        src="/brand/growthify-logo-on-light.png"
        alt="Growthify Agency"
        width={1600}
        height={560}
        priority={priority}
        className="hidden h-auto w-full light:block"
      />
    </span>
  );
}

/** The G-arrow symbol (transparent background) for the collapsed rail. */
export function Symbol({ className }: { className?: string }) {
  return <Image src="/brand/growthify-symbol.svg" alt="Growthify" width={862} height={830} className={cn("h-auto", className)} />;
}
