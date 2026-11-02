import * as React from "react";
import { ArrowDownLeft, ArrowUpRight, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { whatsappLink } from "@/lib/phone";
import { PLATFORM_LABELS } from "@/lib/constants";
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
        type === "expense" && "text-fg",
        className,
      )}
    >
      {formatMoney(signed, currency, { sign: type ? "always" : "auto" })}
    </span>
  );
}

export function TxIcon({ type, size = "md" }: { type: "income" | "expense"; size?: "md" | "sm" }) {
  return (
    <IconCircle tone={type === "income" ? "success" : "neutral"} size={size}>
      {type === "income" ? <ArrowDownLeft /> : <ArrowUpRight />}
    </IconCircle>
  );
}

/** Letter monogram in the platform's tint (matches the style frame). */
export function PlatformMark({ platform, size = 40 }: { platform: Enums<"social_platform">; size?: number }) {
  return (
    <span
      aria-hidden
      className="font-display flex shrink-0 items-center justify-center rounded-full bg-primary-tint text-[13px] font-bold text-primary"
      style={{ width: size, height: size }}
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
          "inline-flex size-8 items-center justify-center rounded-full text-success transition-colors hover:bg-success-tint",
          className,
        )}
      >
        <MessageCircle className="size-4" />
      </a>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border border-success/40 bg-white px-3.5 text-[13px] font-semibold whitespace-nowrap text-success transition-colors hover:bg-success-tint",
        className,
      )}
    >
      <MessageCircle className="size-4" aria-hidden />
      {label}
    </a>
  );
}

export type PaymentDetails = {
  company_name?: string | null;
  bank_name?: string | null;
  account_title?: string | null;
  account_number?: string | null;
  iban?: string | null;
  jazzcash_number?: string | null;
  easypaisa_number?: string | null;
  raast_id?: string | null;
  payment_notes?: string | null;
};

/** The "how to pay us" block appended to WhatsApp reminders. */
export function paymentDetailsText(details: PaymentDetails | null | undefined): string {
  if (!details) return "";
  const lines = [
    details.bank_name || details.account_number || details.iban
      ? [`Bank: ${details.bank_name ?? ""}`.trim(), details.account_title ? `Title: ${details.account_title}` : "", details.account_number ? `A/C: ${details.account_number}` : "", details.iban ? `IBAN: ${details.iban}` : ""]
          .filter((l) => l && l !== "Bank:")
          .join("\n")
      : "",
    details.jazzcash_number ? `JazzCash: ${details.jazzcash_number}` : "",
    details.easypaisa_number ? `Easypaisa: ${details.easypaisa_number}` : "",
    details.raast_id ? `Raast ID: ${details.raast_id}` : "",
    details.payment_notes ?? "",
  ].filter(Boolean);
  return lines.length ? `\n\nPayment details:\n${lines.join("\n")}` : "";
}

/** "Assalam o Alaikum …" reminder for money that is due, with our payment details. */
export function paymentReminder({
  contact,
  item,
  amount,
  currency,
  due,
  details,
  company,
}: {
  contact?: string | null;
  item: string;
  amount: number;
  currency: string;
  due: string;
  details?: PaymentDetails | null;
  company?: string;
}) {
  const greeting = contact ? `Assalam o Alaikum ${contact},` : "Assalam o Alaikum,";
  const name = company ?? details?.company_name ?? "Growthify Agency";
  return `${greeting} a gentle reminder for ${item}: ${formatMoney(amount, currency)} (due ${due}).${paymentDetailsText(details)}\n\nPlease share the screenshot after payment. JazakAllah! — ${name}`;
}

export function RowList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <ul className={cn("divide-y divide-line", className)}>{children}</ul>;
}
