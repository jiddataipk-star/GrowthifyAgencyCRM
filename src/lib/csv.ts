/** RFC 4180 CSV with formula-injection protection (cells starting with = + - @ are prefixed). */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return "";
    let text = String(value);
    if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  // BOM so Excel opens UTF-8 (Urdu names, ₨) correctly.
  return "﻿" + [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
}
