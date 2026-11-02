import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Initials for avatars: "Nova Clinic" → "NC". */
export function initials(name: string | null | undefined, max = 2): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, max)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Percentage change, or null when there is no baseline to compare against. */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Treat empty strings from forms as null for nullable DB columns. */
export function emptyToNull<T>(value: T): T | null {
  return typeof value === "string" && value.trim() === "" ? null : value;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Read a single string from Next.js searchParams. */
export function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
