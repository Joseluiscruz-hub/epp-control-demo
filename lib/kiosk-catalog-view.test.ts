import test from "node:test";
import assert from "node:assert/strict";
import type { PPECatalogItem } from "./kiosk-types";
import {
  buildCategoryTabs,
  categoryLabel,
  displayItemCode,
  formatCountdown,
  formatDaysAgo,
  getEarlyReplacementNotice,
  getItemStatus,
  getStockLevel,
  maskEmployeeId,
} from "./kiosk-catalog-view";

const NOW = new Date("2026-10-11T18:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000);

const sized: PPECatalogItem = {
  id: "guantes",
  name: "Guantes",
  category: "Guantes",
  replacementDays: 30,
  hasSizes: true,
  sku: "public:Guantes:Guantes",
  sizes: {
    T7: { sku: "public:Guantes:Guantes:T7", available: true },
    T8: { sku: "191K43", stock: 2, minStock: 3 },
    T9: { sku: "191K44", stock: 0 },
  },
};

test("pestañas: Todos y solo categorías presentes, en el orden del kiosko", () => {
  const tabs = buildCategoryTabs([
    { category: "Ropa" }, { category: "Guantes" }, { category: "Zeta" }, { category: "Guantes" }, { category: "Proteccion Auditiva" },
  ]);
  assert.deepEqual(tabs, ["Todos", "Guantes", "Ropa", "Proteccion Auditiva", "Zeta"]);
  assert.equal(categoryLabel("Proteccion Auditiva"), "Protección auditiva");
  assert.equal(categoryLabel("Cascos"), "Cascos");
});

test("estado del artículo: sin autorización, sin stock y disponible", () => {
  assert.equal(getItemStatus({ ...sized, active: false }), "unauthorized");
  assert.equal(getItemStatus(sized), "ok");
  assert.equal(getItemStatus({ ...sized, sizes: { T9: { sku: "x", stock: 0 } } }), "empty");
  assert.equal(getItemStatus({ id: "c", name: "c", category: "Cascos", replacementDays: 1, hasSizes: false, available: false }), "empty");
});

test("nivel de stock: pocas piezas solo con existencias numéricas", () => {
  assert.equal(getStockLevel(sized), "ok");
  assert.equal(getStockLevel(sized, "T7"), "ok");
  assert.equal(getStockLevel(sized, "T8"), "low");
  assert.equal(getStockLevel(sized, "T9"), "empty");
});

test("código visible: oculta los alias públicos", () => {
  assert.equal(displayItemCode(sized), undefined);
  assert.equal(displayItemCode(sized, "T7"), undefined);
  assert.equal(displayItemCode(sized, "T8"), "191K43");
  assert.equal(displayItemCode({ ...sized, hasSizes: false, sku: "2JP75" }), "2JP75");
});

test("nómina enmascarada y cuenta regresiva", () => {
  assert.equal(maskEmployeeId("5120417"), "5•••17");
  assert.equal(maskEmployeeId("12"), "12");
  assert.equal(formatCountdown(272), "04:32");
  assert.equal(formatCountdown(-3), "00:00");
});

test("aviso de reposición anticipada con el mismo criterio que el servidor", () => {
  const notice = getEarlyReplacementNotice({ assignedAt: daysAgo(6).toISOString() }, 30, NOW);
  assert.deepEqual(notice, { daysUsed: 6, daysRemaining: 24, replacementDays: 30, severity: "critical" });

  const later = getEarlyReplacementNotice({ assignedAt: daysAgo(20) }, 30, NOW);
  assert.equal(later?.severity, "warning");

  assert.equal(getEarlyReplacementNotice({ assignedAt: daysAgo(30) }, 30, NOW), null);
  assert.equal(getEarlyReplacementNotice({ assignedAt: daysAgo(3), nextReplacementAt: daysAgo(1) }, 30, NOW), null);
  assert.equal(getEarlyReplacementNotice({ assignedAt: "no-es-fecha" }, 30, NOW), null);
  assert.equal(getEarlyReplacementNotice(null, 30, NOW), null);
  assert.equal(getEarlyReplacementNotice({ assignedAt: { toDate: () => daysAgo(2) } }, 30, NOW)?.daysUsed, 2);
});

test("días transcurridos en texto", () => {
  assert.equal(formatDaysAgo(0), "hoy");
  assert.equal(formatDaysAgo(1), "hace 1 día");
  assert.equal(formatDaysAgo(6), "hace 6 días");
});
