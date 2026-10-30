/**
 * Versioned business rules (24+ EPP replacement rules and 69 reorder points).
 * Source of truth: Firestore `business_rules/current` -> `business_rules_versions/{version}`.
 * Fallback: in-code seed (lib/epp-duration-rules.ts, lib/epp-reorder-points.ts).
 */
import {
  EPP_DURATION_RULES,
  setActiveEppDurationRules,
  type EppDurationRule,
} from "./epp-duration-rules";
import { EPP_REORDER_POINTS, normalizeEppMaterialCode, setActiveEppReorderPoints } from "./epp-reorder-points";

export const BUSINESS_RULES_COLLECTION = "business_rules";
export const BUSINESS_RULES_VERSIONS_COLLECTION = "business_rules_versions";
export const BUSINESS_RULES_POINTER_DOC = "current";
export const SEED_VERSION = 1;

export type BusinessRulesPayload = {
  durationRules: EppDurationRule[];
  reorderPoints: Record<string, number>;
};

export type BusinessRulesSnapshot = BusinessRulesPayload & {
  version: number;
  source: "firestore" | "defaults";
};

export function defaultBusinessRules(): BusinessRulesSnapshot {
  return {
    version: 0,
    source: "defaults",
    durationRules: EPP_DURATION_RULES,
    reorderPoints: EPP_REORDER_POINTS,
  };
}

export type ValidationResult = { ok: true; value: BusinessRulesPayload } | { ok: false; errors: string[] };

export function validateBusinessRules(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!input || typeof input !== "object") return { ok: false, errors: ["Payload invalido."] };
  const raw = input as Record<string, unknown>;
  const durationRules: EppDurationRule[] = [];
  const seenIds = new Set<string>();
  const seenCodes = new Set<string>();

  if (!Array.isArray(raw.durationRules) || raw.durationRules.length === 0 || raw.durationRules.length > 500) {
    errors.push("durationRules debe ser una lista de 1 a 500 reglas.");
  } else {
    raw.durationRules.forEach((entry, i) => {
      const r = (entry ?? {}) as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id.trim() : "";
      const sku = typeof r.erpSku === "string" ? r.erpSku.trim() : "";
      const description = typeof r.description === "string" ? r.description.trim() : "";
      const sap = typeof r.sapMaterial === "string" && r.sapMaterial.trim() ? r.sapMaterial.trim() : undefined;
      const quantity = Number(r.quantity);
      const days = Number(r.replacementDays);
      const unit = r.unit;
      if (!/^[a-z0-9-]{2,64}$/.test(id)) errors.push(`durationRules[${i}].id invalido.`);
      if (seenIds.has(id)) errors.push(`durationRules[${i}].id duplicado (${id}).`);
      if (!sku) errors.push(`durationRules[${i}].erpSku requerido.`);
      for (const code of [sku, sap].filter(Boolean) as string[]) {
        const norm = normalizeEppMaterialCode(code);
        if (seenCodes.has(norm)) errors.push(`durationRules[${i}] codigo duplicado (${code}).`);
        seenCodes.add(norm);
      }
      if (!description || description.length > 200) errors.push(`durationRules[${i}].description requerida (max 200).`);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) errors.push(`durationRules[${i}].quantity debe ser entero 1-100.`);
      if (unit !== "Pza" && unit !== "Par") errors.push(`durationRules[${i}].unit debe ser Pza o Par.`);
      if (!Number.isInteger(days) || days < 1 || days > 730) errors.push(`durationRules[${i}].replacementDays debe ser entero 1-730.`);
      seenIds.add(id);
      durationRules.push({ id, erpSku: sku, ...(sap ? { sapMaterial: sap } : {}), description, quantity, unit: unit as "Pza" | "Par", replacementDays: days });
    });
  }

  const reorderPoints: Record<string, number> = {};
  if (!raw.reorderPoints || typeof raw.reorderPoints !== "object" || Array.isArray(raw.reorderPoints)) {
    errors.push("reorderPoints debe ser un objeto { material: puntoDeReorden }.");
  } else {
    const entries = Object.entries(raw.reorderPoints as Record<string, unknown>);
    if (entries.length === 0 || entries.length > 2000) errors.push("reorderPoints debe tener de 1 a 2000 materiales.");
    for (const [code, value] of entries) {
      const norm = normalizeEppMaterialCode(code);
      const n = Number(value);
      if (!norm) { errors.push(`reorderPoints: codigo invalido "${code}".`); continue; }
      if (!Number.isInteger(n) || n < 0 || n > 100000) { errors.push(`reorderPoints[${code}] debe ser entero 0-100000.`); continue; }
      reorderPoints[norm] = n;
    }
  }

  return errors.length ? { ok: false, errors: errors.slice(0, 50) } : { ok: true, value: { durationRules, reorderPoints } };
}

/** Applies a snapshot to the in-memory lookups used by every rule consumer. */
export function applyBusinessRules(snapshot: BusinessRulesSnapshot | null) {
  if (!snapshot || snapshot.source === "defaults") {
    setActiveEppDurationRules(null);
    setActiveEppReorderPoints(null);
    return;
  }
  setActiveEppDurationRules(snapshot.durationRules);
  setActiveEppReorderPoints(snapshot.reorderPoints);
}
