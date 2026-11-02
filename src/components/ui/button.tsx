import * as React from "react";
import { Slot } from "radix-ui";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const variants = {
  /** Solid Growthify green — the one main action on a screen. */
  primary: "bg-primary text-primary-ink shadow-[0_1px_0_rgb(255_255_255/0.08)_inset,0_1px_2px_rgb(11_18_16/0.12)] hover:bg-primary-hover",
  /** White button with a hairline border. */
  secondary: "border border-line bg-surface text-fg shadow-card hover:border-line-strong hover:bg-surface-2",
  /** Outline pill for row actions ("Mark paid", "View details"). */
  outline: "border border-line-strong bg-surface text-fg hover:border-primary hover:text-primary",
  ghost: "text-fg-2 hover:bg-surface-2 hover:text-fg",
  danger: "bg-danger text-white hover:brightness-95",
  "danger-outline": "border border-danger/35 bg-surface text-danger hover:bg-danger-tint",
} as const;

const sizes = {
  lg: "h-11 px-5 text-[14.5px] rounded-control gap-2",
  md: "h-10 px-4 text-sm rounded-control gap-2",
  sm: "h-9 px-3.5 text-[13.5px] rounded-[10px] gap-1.5",
  pill: "h-8 px-3.5 text-[13px] rounded-full gap-1.5",
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
        "inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-[background,color,border,box-shadow,filter] duration-150 select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
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
