import * as React from "react";
import { Slot } from "radix-ui";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const variants = {
  /** Solid brand button (lime on dark, deep green on light). */
  primary: "bg-primary text-primary-ink hover:brightness-95 active:brightness-90",
  /** Quiet filled button. */
  secondary: "bg-surface-2 text-fg hover:bg-surface-3 border border-line",
  /** BankDash outline pill for row actions ("Download", "View details"). */
  outline: "border border-line-strong text-fg hover:border-accent-fg hover:text-accent-fg bg-transparent",
  ghost: "text-fg-2 hover:text-fg hover:bg-surface-2",
  danger: "bg-danger text-white hover:brightness-95",
  "danger-outline": "border border-danger/60 text-danger hover:bg-danger/10",
} as const;

const sizes = {
  lg: "h-[50px] px-6 text-[15px] rounded-control gap-2",
  md: "h-11 px-5 text-[15px] rounded-control gap-2",
  sm: "h-9 px-4 text-sm rounded-[12px] gap-1.5",
  pill: "h-9 px-4 text-[13px] rounded-full gap-1.5",
  icon: "size-10 rounded-full justify-center",
  "icon-sm": "size-8 rounded-full justify-center",
} as const;

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  asChild?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, asChild, disabled, children, type, ...props },
  ref,
) {
  const Component = asChild ? Slot.Root : "button";
  return (
    <Component
      ref={ref}
      type={asChild ? undefined : (type ?? "button")}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-[background,color,border,filter] duration-150 select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[18px] [&_svg]:shrink-0",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {children}
        </>
      )}
    </Component>
  );
});
