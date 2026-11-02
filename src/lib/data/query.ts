import "server-only";
import { param } from "@/lib/utils";

export const PAGE_SIZE = 20;

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Strip characters that have meaning inside PostgREST `or=(…)` filters. */
export function ilikeTerm(raw: string | undefined): string | null {
  const term = (raw ?? "").replace(/[,()*%\\:"]/g, " ").trim().slice(0, 80);
  return term.length ? `%${term}%` : null;
}

export function pageFrom(params: Record<string, string | string[] | undefined>) {
  const page = Math.max(1, Number.parseInt(param(params.page) ?? "1", 10) || 1);
  return { page, from: (page - 1) * PAGE_SIZE, to: page * PAGE_SIZE - 1 };
}

export function pageCount(total: number | null) {
  return Math.max(1, Math.ceil((total ?? 0) / PAGE_SIZE));
}

/** Only accept a value if it is one of the allowed options. */
export function oneOf<T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T | undefined {
  const v = param(value);
  return allowed.includes(v as T) ? (v as T) : undefined;
}

export function isoParam(value: string | string[] | undefined): string | undefined {
  const v = param(value);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
}
