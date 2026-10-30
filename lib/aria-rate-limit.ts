import { FieldValue, type Firestore } from "firebase-admin/firestore";

/**
 * Per-user and per-plant rate limiting for ARIA (/api/chat).
 * Counters live in `aria_rate_limits` (server-only; Security Rules deny clients)
 * and are updated inside one Admin SDK transaction so concurrent requests
 * cannot both slip under the limit.
 */
export const ARIA_RATE_LIMITS = {
  user: { maxRequests: 20, windowMs: 10 * 60 * 1000 },
  plant: { maxRequests: 120, windowMs: 10 * 60 * 1000 },
} as const;

export type RateWindowState = { requestCount?: unknown; windowExpiresAt?: unknown };

export function nextRateWindow(state: RateWindowState | undefined, now: number, policy: { maxRequests: number; windowMs: number }) {
  const expires = Number(state?.windowExpiresAt ?? 0);
  const within = Number.isFinite(expires) && expires > now;
  const count = within ? Math.max(0, Number(state?.requestCount ?? 0)) : 0;
  if (count >= policy.maxRequests) {
    return { allowed: false as const, retryAfterSeconds: Math.max(1, Math.ceil((expires - now) / 1000)), requestCount: count, windowExpiresAt: expires };
  }
  return { allowed: true as const, retryAfterSeconds: 0, requestCount: count + 1, windowExpiresAt: within ? expires : now + policy.windowMs };
}

export class AriaRateLimitError extends Error {
  status = 429;
  constructor(public retryAfterSeconds: number, public dimension: "user" | "plant") {
    super(dimension === "user"
      ? `Alcanzaste el limite de consultas a ARIA. Intenta en ${retryAfterSeconds} segundos.`
      : `La planta alcanzo el limite de consultas a ARIA. Intenta en ${retryAfterSeconds} segundos.`);
    this.name = "AriaRateLimitError";
  }
}

export async function enforceAriaRateLimit(db: Firestore, input: { uid: string; plantScope: string; now?: number }) {
  const userRef = db.collection("aria_rate_limits").doc(`user_${input.uid}`);
  const plantRef = db.collection("aria_rate_limits").doc(`plant_${input.plantScope}`);
  const outcome = await db.runTransaction(async (tx) => {
    const now = input.now ?? Date.now();
    const [userSnap, plantSnap] = await Promise.all([tx.get(userRef), tx.get(plantRef)]);
    const user = nextRateWindow(userSnap.data(), now, ARIA_RATE_LIMITS.user);
    if (!user.allowed) return { blocked: "user" as const, retry: user.retryAfterSeconds };
    const plant = nextRateWindow(plantSnap.data(), now, ARIA_RATE_LIMITS.plant);
    if (!plant.allowed) return { blocked: "plant" as const, retry: plant.retryAfterSeconds };
    tx.set(userRef, { dimension: "user", requestCount: user.requestCount, windowExpiresAt: user.windowExpiresAt, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(plantRef, { dimension: "plant", requestCount: plant.requestCount, windowExpiresAt: plant.windowExpiresAt, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return null;
  });
  if (outcome) throw new AriaRateLimitError(outcome.retry, outcome.blocked);
}
