import { IDEMPOTENCY_HEADER, isRetryableIdempotentFailure } from "./idempotency";

const RETRY_DELAYS_MS = [400, 1200];

/**
 * fetch con llave de idempotencia: manda la MISMA llave en header y body en cada reintento
 * (errores de red, 5xx o 408). El servidor garantiza que la operacion se aplica una sola vez.
 */
export async function fetchWithIdempotencyKey(
  url: string,
  init: { method: string; headers: Record<string, string>; body: Record<string, unknown> },
  idempotencyKey: string,
  maxAttempts = RETRY_DELAYS_MS.length + 1
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const isLast = attempt === maxAttempts - 1;
    try {
      const response = await fetch(url, {
        method: init.method,
        headers: { ...init.headers, [IDEMPOTENCY_HEADER]: idempotencyKey },
        body: JSON.stringify({ ...init.body, idempotencyKey }),
      });
      if (isLast || !isRetryableIdempotentFailure(null, response.status)) return response;
    } catch (error) {
      lastError = error;
      if (isLast || !isRetryableIdempotentFailure(error)) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt] ?? 1200));
  }
  throw lastError ?? new Error("idempotent_fetch_failed");
}
