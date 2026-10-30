import assert from "node:assert/strict";
import test from "node:test";
import { applyBusinessRules, defaultBusinessRules, validateBusinessRules } from "./business-rules";
import { EPP_DURATION_RULES, resolveEppReplacementDays } from "./epp-duration-rules";
import { EPP_REORDER_POINTS, getEppReorderPoint } from "./epp-reorder-points";

test("los defaults del codigo son una version valida (semilla de migracion)", () => {
  const d = defaultBusinessRules();
  const parsed = validateBusinessRules(d);
  assert.equal(parsed.ok, true);
  assert.equal(Object.keys(EPP_REORDER_POINTS).length, 69);
  assert.equal(EPP_DURATION_RULES.length, 24);
});

test("rechaza reglas invalidas", () => {
  const bad = validateBusinessRules({
    durationRules: [{ id: "X", erpSku: "", description: "", quantity: 0, unit: "Caja", replacementDays: -1 }],
    reorderPoints: { "90149605": -3 },
  });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.ok(bad.errors.length >= 5);
});

test("aplicar una version de Firestore cambia las consultas sin deploy y se puede revertir", () => {
  const rule = EPP_DURATION_RULES[1];
  const before = resolveEppReplacementDays({ sku: rule.erpSku }, 999);
  applyBusinessRules({
    version: 2,
    source: "firestore",
    durationRules: EPP_DURATION_RULES.map((r) => (r.id === rule.id ? { ...r, replacementDays: 77 } : r)),
    reorderPoints: { ...EPP_REORDER_POINTS, "90149605": 42 },
  });
  try {
    assert.equal(resolveEppReplacementDays({ sku: rule.erpSku }, 999), 77);
    assert.equal(getEppReorderPoint("90149605"), 42);
  } finally {
    applyBusinessRules(null);
  }
  assert.equal(resolveEppReplacementDays({ sku: rule.erpSku }, 999), before);
  assert.equal(getEppReorderPoint("90149605"), EPP_REORDER_POINTS["90149605"]);
});
