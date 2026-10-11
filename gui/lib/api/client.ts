import createClient from "openapi-fetch";
import type { components, paths } from "./schema";

export type Schemas = components["schemas"];

// Vercel: NEXT_PUBLIC_API_URL = Render URL (browser calls it directly, CORS-allowed).
// Local dev: unset → same-origin, next.config rewrites /api/* to uvicorn.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export const api = createClient<paths>({ baseUrl: API_BASE });

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ErrorEnvelope = { error?: { code?: string; message?: string } };

function toApiError(error: unknown, status: number): ApiError {
  const body = (error as ErrorEnvelope | undefined)?.error;
  return new ApiError(body?.code ?? "http_error", body?.message ?? `Request failed (${status}).`, status);
}

export async function unwrap<T>(request: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  let result: { data?: T; error?: unknown; response: Response };
  try {
    result = await request;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("network_error", "Cannot reach the FinanceAI API.", 0);
  }
  if (result.error !== undefined || result.data === undefined) throw toApiError(result.error, result.response.status);
  return result.data;
}

/** For 204 responses (no body). */
export async function expectOk(request: Promise<{ error?: unknown; response: Response }>): Promise<void> {
  let result: { error?: unknown; response: Response };
  try {
    result = await request;
  } catch {
    throw new ApiError("network_error", "Cannot reach the FinanceAI API.", 0);
  }
  if (!result.response.ok) throw toApiError(result.error, result.response.status);
}

/** Download a server-generated CSV; the browser never formats money for export. */
export async function downloadCsv(path: string, init: { method: "GET" | "POST"; body?: unknown }): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: init.method,
      headers: init.body ? { "Content-Type": "application/json" } : undefined,
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError("network_error", "Cannot reach the FinanceAI API.", 0);
  }
  if (!response.ok) throw toApiError(await response.json().catch(() => undefined), response.status);
  const disposition = response.headers.get("content-disposition") ?? "";
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "financeai.csv";
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
