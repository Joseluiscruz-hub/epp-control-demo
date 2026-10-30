import { FieldValue, type Firestore } from "firebase-admin/firestore";
import {
  applyBusinessRules,
  BUSINESS_RULES_COLLECTION,
  BUSINESS_RULES_POINTER_DOC,
  BUSINESS_RULES_VERSIONS_COLLECTION,
  defaultBusinessRules,
  validateBusinessRules,
  type BusinessRulesPayload,
  type BusinessRulesSnapshot,
} from "./business-rules";

const CACHE_TTL_MS = 60_000;
let cache: { snapshot: BusinessRulesSnapshot; loadedAt: number } | null = null;

export function resetBusinessRulesCache() {
  cache = null;
}

/**
 * Reads the active version from Firestore (cached 60 s per instance) and
 * applies it to the rule lookups. Any failure (missing pointer, invalid
 * document, Firestore unavailable) falls back to the in-code seed and logs.
 */
export async function loadBusinessRules(db: Firestore, nowMs = Date.now()): Promise<BusinessRulesSnapshot> {
  if (cache && nowMs - cache.loadedAt < CACHE_TTL_MS) return cache.snapshot;
  let snapshot = defaultBusinessRules();
  try {
    const pointer = await db.collection(BUSINESS_RULES_COLLECTION).doc(BUSINESS_RULES_POINTER_DOC).get();
    const version = Number(pointer.get("activeVersion"));
    if (pointer.exists && Number.isInteger(version) && version > 0) {
      const doc = await db.collection(BUSINESS_RULES_VERSIONS_COLLECTION).doc(`v${version}`).get();
      const parsed = validateBusinessRules(doc.data());
      if (doc.exists && parsed.ok) {
        snapshot = { ...parsed.value, version, source: "firestore" };
      } else {
        console.warn(`[business-rules] version v${version} invalida o ausente; usando defaults.`);
      }
    }
  } catch (error) {
    console.warn("[business-rules] No se pudo leer Firestore; usando defaults.", error);
  }
  applyBusinessRules(snapshot);
  cache = { snapshot, loadedAt: nowMs };
  return snapshot;
}

/** Creates version N+1 and moves the pointer atomically. */
export async function publishBusinessRules(db: Firestore, input: { payload: unknown; actorUid: string; note: string }) {
  const parsed = validateBusinessRules(input.payload);
  if (!parsed.ok) return { ok: false as const, errors: parsed.errors };
  const pointerRef = db.collection(BUSINESS_RULES_COLLECTION).doc(BUSINESS_RULES_POINTER_DOC);
  const version = await db.runTransaction(async (tx) => {
    const pointer = await tx.get(pointerRef);
    const current = Number(pointer.get("activeVersion")) || 0;
    const latest = Math.max(current, Number(pointer.get("latestVersion")) || 0);
    const next = latest + 1;
    tx.create(db.collection(BUSINESS_RULES_VERSIONS_COLLECTION).doc(`v${next}`), {
      ...parsed.value,
      version: next,
      previousVersion: current || null,
      note: input.note.slice(0, 300),
      createdBy: input.actorUid,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(pointerRef, { activeVersion: next, latestVersion: next, updatedBy: input.actorUid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return next;
  });
  resetBusinessRulesCache();
  return { ok: true as const, version };
}

/** Points `current` back to an existing version (rollback without deploy). */
export async function activateBusinessRulesVersion(db: Firestore, input: { version: number; actorUid: string }) {
  const pointerRef = db.collection(BUSINESS_RULES_COLLECTION).doc(BUSINESS_RULES_POINTER_DOC);
  const versionRef = db.collection(BUSINESS_RULES_VERSIONS_COLLECTION).doc(`v${input.version}`);
  const ok = await db.runTransaction(async (tx) => {
    const v = await tx.get(versionRef);
    if (!v.exists || !validateBusinessRules(v.data()).ok) return false;
    tx.set(pointerRef, { activeVersion: input.version, updatedBy: input.actorUid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });
  resetBusinessRulesCache();
  return ok;
}

export type { BusinessRulesPayload };
