import "server-only";

/** The token is invalid/expired/revoked: the account must be reconnected. */
export class ReconnectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReconnectError";
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Json = Record<string, unknown>;

/**
 * fetch + JSON with a timeout. Maps auth failures (HTTP 401, Meta OAuthException
 * code 190, Google invalid_grant) to ReconnectError so the account is flagged.
 */
export async function getJson<T = Json>(url: string, init: RequestInit = {}, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    const text = await response.text();
    let body: Json = {};
    try {
      body = text ? (JSON.parse(text) as Json) : {};
    } catch {
      body = { raw: text.slice(0, 200) };
    }
    if (!response.ok) {
      const error = (body.error ?? {}) as Json;
      const message = String(error.message ?? body.error_description ?? body.error ?? response.statusText);
      const code = Number(error.code ?? 0);
      if (response.status === 401 || code === 190 || body.error === "invalid_grant" || error.type === "OAuthException" && code === 102) {
        throw new ReconnectError(message);
      }
      throw new ApiError(message, response.status);
    }
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

export function postForm<T = Json>(url: string, form: Record<string, string>): Promise<T> {
  return getJson<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
  });
}

/** Run optional metric calls without letting one deprecated metric fail the sync. */
export async function optional<T>(fn: () => Promise<T>, warnings: string[], label: string): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ReconnectError) throw error;
    warnings.push(`${label}: ${error instanceof Error ? error.message : "failed"}`);
    return null;
  }
}
