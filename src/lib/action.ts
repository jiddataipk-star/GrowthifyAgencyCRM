import "server-only";
import { revalidatePath } from "next/cache";
import type { z, ZodType } from "zod";
import { getMember, canSeeFinance, isOwner, type Member } from "@/lib/auth";
import { createClient, type ServerClient } from "@/lib/supabase/server";
import type { Role } from "@/types/db";

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

type Access = "member" | "finance" | "owner";

function allowed(role: Role, access: Access) {
  if (access === "owner") return isOwner(role);
  if (access === "finance") return canSeeFinance(role);
  return true;
}

type Context = { supabase: ServerClient; member: Member };

/**
 * Wraps a Server Action: authenticates, checks the role, validates input with Zod,
 * maps database errors to friendly messages and refreshes the UI on success.
 * The database (RLS + triggers) remains the final authority on every write.
 */
export function action<S extends ZodType, T = undefined>(
  access: Access,
  schema: S,
  handler: (input: z.output<S>, ctx: Context) => Promise<T | ActionResult<T>>,
) {
  return async (raw: z.input<S>): Promise<ActionResult<T>> => {
    const member = await getMember();
    if (!member) return { ok: false, error: "Your session has expired. Please sign in again." };
    if (!allowed(member.role, access)) return { ok: false, error: "You don't have permission to do that." };

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return { ok: false, error: "Please check the highlighted fields.", fieldErrors };
    }

    try {
      const supabase = await createClient();
      const result = await handler(parsed.data, { supabase, member });
      revalidatePath("/", "layout");
      if (result && typeof result === "object" && "ok" in result) return result as ActionResult<T>;
      return { ok: true, data: result as T };
    } catch (error) {
      return { ok: false, error: friendlyError(error) };
    }
  };
}

type PgError = { code?: string; message?: string; details?: string };

/** Turn Postgres / PostgREST errors into sentences a person can act on. */
export function friendlyError(error: unknown): string {
  const e = (error ?? {}) as PgError;
  const message = e.message ?? (error instanceof Error ? error.message : "");
  switch (e.code) {
    case "42501":
      return message && !message.includes("row-level security") ? message : "You don't have permission to do that.";
    case "23505":
      return message.includes("duplicate key") ? "That already exists." : message;
    case "23503":
      return "This record is still linked to other records (projects, invoices or payments). Archive it instead.";
    case "23514":
      return message.includes("violates check constraint") ? "Some values are out of range." : message;
    case "P0002":
      return message || "Not found.";
    case "PGRST116":
      return "Not found, or you don't have access.";
  }
  if (process.env.NODE_ENV !== "production") console.error(error);
  return message || "Something went wrong. Please try again.";
}

/** Throw on Supabase errors so `action()` can map them. */
export function must<R extends { data: unknown; error: unknown }>(result: R): NonNullable<R["data"]> {
  if (result.error) throw result.error;
  return result.data as NonNullable<R["data"]>;
}
