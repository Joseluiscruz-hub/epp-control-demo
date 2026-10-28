/**
 * Idempotencia de operaciones que mueven stock (entrega manual, ajuste de inventario).
 * Funciones puras: se pueden usar en cliente y servidor y se prueban sin Firestore.
 */

export const IDEMPOTENCY_COLLECTION = "idempotency_keys";
export const IDEMPOTENCY_HEADER = "Idempotency-Key";

export type IdempotencyScope = "assignment.create" | "inventory.stock.adjust";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class IdempotencyError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "IdempotencyError";
    this.status = status;
  }
}

export function isValidIdempotencyKey(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** Genera un UUID v4 (randomUUID o, si no existe, getRandomValues). */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Lee la llave del body (`idempotencyKey`) y/o del header Idempotency-Key.
 * - Sin llave (cliente viejo) => null; el servidor genera una (sin deduplicacion).
 * - Formato invalido o body/header distintos => 400.
 */
export function resolveIdempotencyKey(bodyValue: unknown, headerValue: string | null | undefined): string | null {
  const fromBody = bodyValue === undefined || bodyValue === null || bodyValue === "" ? null : bodyValue;
  const fromHeader = headerValue && headerValue.trim() ? headerValue.trim() : null;
  if (fromBody !== null && !isValidIdempotencyKey(fromBody)) {
    throw new IdempotencyError("idempotencyKey invalido.", 400);
  }
  if (fromHeader !== null && !isValidIdempotencyKey(fromHeader)) {
    throw new IdempotencyError("Idempotency-Key invalido.", 400);
  }
  if (fromBody !== null && fromHeader !== null && fromBody.toLowerCase() !== fromHeader.toLowerCase()) {
    throw new IdempotencyError("idempotencyKey e Idempotency-Key no coinciden.", 400);
  }
  const value = (fromBody ?? fromHeader) as string | null;
  return value ? value.toLowerCase() : null;
}

export function buildIdempotencyDocId(scope: IdempotencyScope, key: string) {
  if (!isValidIdempotencyKey(key)) throw new IdempotencyError("idempotencyKey invalido.", 400);
  return `${scope}_${key.toLowerCase()}`;
}

/** Huella estable del payload: misma llave con otro payload es un error del cliente. */
export function buildRequestFingerprint(payload: Record<string, string | number | boolean | null | undefined>) {
  return Object.keys(payload)
    .sort()
    .filter((key) => payload[key] !== undefined)
    .map((key) => `${key}=${JSON.stringify(payload[key])}`)
    .join("&");
}

export type IdempotencyRecord<T> = {
  scope: IdempotencyScope;
  key: string;
  actorUid: string;
  fingerprint: string;
  result: T;
};

export type IdempotencyDecision<T> =
  | { kind: "execute" }
  | { kind: "replay"; result: T };

/**
 * Decide si se ejecuta la operacion o se devuelve el resultado guardado.
 * Nunca se ejecuta dos veces la misma llave: si ya existe, se repite el resultado.
 */
export function decideIdempotentOperation<T>(
  existing: Partial<IdempotencyRecord<T>> | null | undefined,
  expected: { scope: IdempotencyScope; actorUid: string; fingerprint: string }
): IdempotencyDecision<T> {
  if (!existing) return { kind: "execute" };
  if (existing.scope !== expected.scope || existing.actorUid !== expected.actorUid) {
    throw new IdempotencyError("La llave de idempotencia pertenece a otra operacion.", 409);
  }
  if (existing.fingerprint !== expected.fingerprint) {
    throw new IdempotencyError("La llave de idempotencia ya se uso con datos distintos.", 422);
  }
  return { kind: "replay", result: existing.result as T };
}

/** Errores que vale la pena reintentar con la MISMA llave. */
export function isRetryableIdempotentFailure(error: unknown, status?: number) {
  if (typeof status === "number") return status >= 500 || status === 408;
  return error instanceof TypeError;
}
