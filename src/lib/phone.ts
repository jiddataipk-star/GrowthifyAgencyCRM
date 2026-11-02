/**
 * Pakistani phone handling. People type numbers as 0321-6312898, 3216312898,
 * +92 321 6312898 or 0092…; WhatsApp links need the international form 923216312898.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  digits = digits.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("0092")) digits = digits.slice(2);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (/^03\d{9}$/.test(digits)) digits = `92${digits.slice(1)}`;
  else if (/^3\d{9}$/.test(digits)) digits = `92${digits}`;

  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

/** Display form: +92 321 6312898 for Pakistani mobiles, +<digits> otherwise. */
export function formatPhone(input: string | null | undefined): string {
  const digits = normalizePhone(input);
  if (!digits) return input?.trim() || "—";
  if (/^923\d{9}$/.test(digits)) return `+92 ${digits.slice(2, 5)} ${digits.slice(5)}`;
  return `+${digits}`;
}

/**
 * wa.me link that only opens WhatsApp with an optional pre-filled message.
 * The app never sends anything by itself.
 */
export function whatsappLink(input: string | null | undefined, message?: string): string | null {
  const digits = normalizePhone(input);
  if (!digits) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${text}`;
}

/** wa.me link without a recipient: WhatsApp lets the user pick the chat. */
export function whatsappShareLink(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
