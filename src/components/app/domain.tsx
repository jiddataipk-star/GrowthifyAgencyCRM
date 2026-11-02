import * as React from "react";
import { ArrowDownLeft, ArrowUpRight, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { whatsappLink } from "@/lib/phone";
import { PLATFORM_COLORS, PLATFORM_LABELS } from "@/lib/constants";
import { IconCircle } from "@/components/ui/card";
import type { Enums } from "@/types/db";

/** Coloured amount: + success for income, − danger for expense. */
export function Amount({
  minor,
  currency,
  type,
  className,
}: {
  minor: number;
  currency: string;
  type?: "income" | "expense";
  className?: string;
}) {
  const signed = type === "expense" ? -Math.abs(minor) : minor;
  return (
    <span
      className={cn(
        "tabular font-bold whitespace-nowrap",
        type === "income" && "text-success",
        type === "expense" && "text-danger",
        className,
      )}
    >
      {formatMoney(signed, currency, { sign: type ? "always" : "auto" })}
    </span>
  );
}

export function TxIcon({ type, size = "md" }: { type: "income" | "expense"; size?: "md" | "sm" }) {
  return (
    <IconCircle tone={type === "income" ? "success" : "danger"} size={size}>
      {type === "income" ? <ArrowDownLeft /> : <ArrowUpRight />}
    </IconCircle>
  );
}

/** Letter monogram in the platform's tint (matches the style frame). */
export function PlatformMark({ platform, size = 46 }: { platform: Enums<"social_platform">; size?: number }) {
  const color = PLATFORM_COLORS[platform];
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold light:!text-fg"
      style={{ width: size, height: size, color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {PLATFORM_LABELS[platform][0]}
    </span>
  );
}

/** Opens WhatsApp with an optional pre-filled message. Never sends automatically. */
export function WhatsAppLink({
  phone,
  message,
  label = "WhatsApp",
  variant = "pill",
  className,
}: {
  phone: string | null | undefined;
  message?: string;
  label?: string;
  variant?: "pill" | "icon";
  className?: string;
}) {
  const href = whatsappLink(phone, message);
  if (!href) return null;
  if (variant === "icon") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${label} (opens WhatsApp)`}
        title={label}
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-full text-success transition-colors hover:bg-[color-mix(in_srgb,var(--success)_12%,transparent)]",
          className,
        )}
      >
        <MessageCircle className="size-[18px]" />
      </a>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border border-success/50 px-4 text-[13px] font-semibold whitespace-nowrap text-success transition-colors hover:bg-[color-mix(in_srgb,var(--success)_10%,transparent)]",
        className,
      )}
    >
      <MessageCircle className="size-4" aria-hidden />
      {label}
    </a>
  );
}

/** "Assalam o Alaikum …" reminder for a due payment. */
export function paymentReminder({
  contact,
  item,
  amount,
  currency,
  due,
  company = "Growthify Agency",
}: {
  contact?: string | null;
  item: string;
  amount: number;
  currency: string;
  due: string;
  company?: string;
}) {
  const greeting = contact ? `Assalam o Alaikum ${contact},` : "Assalam o Alaikum,";
  return `${greeting} a gentle reminder that the payment for ${item} (${formatMoney(amount, currency)}) is due on ${due}. Thank you! — ${company}`;
}

export function RowList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <ul className={cn("divide-y divide-line", className)}>{children}</ul>;
}
