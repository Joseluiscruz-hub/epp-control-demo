import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDistribution, roundPercentages } from "./dashboard-distribution";

// Miércoles 14 de octubre de 2026; la semana actual empieza el lunes 12.
const NOW = new Date(2026, 9, 14, 12, 0, 0);
const areas = new Map([["e1", "Producción"], ["e2", "Producción"], ["e3", "Almacén"]]);

describe("buildDistribution", () => {
  it("agrupa por semana de lunes a domingo, de la más antigua a la actual", () => {
    const d = buildDistribution([
      { assignedAt: new Date(2026, 9, 12, 8), employeeId: "e1" }, // lunes actual
      { assignedAt: new Date(2026, 9, 14, 9), employeeId: "e2" }, // semana actual
      { assignedAt: new Date(2026, 9, 11, 23), employeeId: "e1" }, // domingo: semana previa
      { assignedAt: new Date(2026, 8, 30, 10), employeeId: "e3" }, // dos semanas atrás
    ], areas, NOW);
    assert.equal(d.weekly.length, 8);
    assert.equal(d.weekly[7].count, 2);
    assert.equal(d.weekly[6].count, 1);
    assert.equal(d.weekly[5].count, 1);
    assert.equal(d.weekly.reduce((s, w) => s + w.count, 0), 4);
  });

  it("ignora entregas fuera de las 8 semanas y fechas inválidas", () => {
    const d = buildDistribution([
      { assignedAt: new Date(2026, 0, 5), employeeId: "e1" },
      { assignedAt: new Date("no-es-fecha"), employeeId: "e1" },
    ], areas, NOW);
    assert.equal(d.weekly.reduce((s, w) => s + w.count, 0), 0);
    assert.equal(d.sample, 1);
  });

  it("ordena áreas de mayor a menor y omite empleados sin área", () => {
    const d = buildDistribution([
      { assignedAt: NOW, employeeId: "e1" },
      { assignedAt: NOW, employeeId: "e2" },
      { assignedAt: NOW, employeeId: "e3" },
      { assignedAt: NOW, employeeId: "desconocido" },
    ], areas, NOW);
    assert.deepEqual(d.byArea, [{ area: "Producción", count: 2 }, { area: "Almacén", count: 1 }]);
  });

  it("limita el top de áreas", () => {
    const map = new Map(Array.from({ length: 9 }, (_, i) => [`e${i}`, `Área ${i}`] as [string, string]));
    const d = buildDistribution(Array.from({ length: 9 }, (_, i) => ({ assignedAt: NOW, employeeId: `e${i}` })), map, NOW);
    assert.equal(d.byArea.length, 5);
  });

  it("cuenta entregas por motivo en orden fijo y manda lo demás a dotación", () => {
    const d = buildDistribution([
      { assignedAt: NOW, employeeId: "e1", reason: "extravio" },
      { assignedAt: NOW, employeeId: "e1", reason: "desgaste" },
      { assignedAt: NOW, employeeId: "e2", reason: "desgaste" },
      { assignedAt: NOW, employeeId: "e3", reason: "vida_util" },
      { assignedAt: NOW, employeeId: "e3" },
      { assignedAt: NOW, employeeId: "e3", reason: "otro" },
    ], areas, NOW);
    assert.deepEqual(d.byReason.map((r) => [r.key, r.count]), [
      ["desgaste", 2], ["vida_util", 1], ["extravio", 1], ["dotacion", 2],
    ]);
    assert.equal(d.byReason[0].label, "Uso normal");
  });

  it("omite motivos sin entregas", () => {
    const d = buildDistribution([{ assignedAt: NOW, employeeId: "e1", reason: "extravio" }], areas, NOW);
    assert.deepEqual(d.byReason.map((r) => r.key), ["extravio"]);
  });

  it("áreas y motivos usan la misma ventana de 8 semanas que la gráfica semanal", () => {
    const d = buildDistribution([
      { assignedAt: new Date(2026, 9, 13), employeeId: "e1", reason: "desgaste" }, // dentro
      { assignedAt: new Date(2026, 7, 24, 0, 0, 1), employeeId: "e3", reason: "extravio" }, // lunes inicial de la ventana
      { assignedAt: new Date(2026, 7, 23, 23), employeeId: "e3", reason: "extravio" }, // domingo previo: fuera
      { assignedAt: new Date(2026, 0, 5), employeeId: "e2", reason: "vida_util" }, // fuera
    ], areas, NOW);
    assert.equal(d.sample, 4);
    assert.equal(d.inWindow, 2);
    assert.equal(d.weekly.reduce((s, w) => s + w.count, 0), 2);
    assert.equal(d.byArea.reduce((s, a) => s + a.count, 0), 2);
    assert.equal(d.byReason.reduce((s, r) => s + r.count, 0), 2);
    assert.deepEqual(d.byReason.map((r) => r.key), ["desgaste", "extravio"]);
  });

  it("los porcentajes de motivo suman 100", () => {
    const d = buildDistribution([
      ...Array.from({ length: 11 }, () => ({ assignedAt: NOW, employeeId: "e1", reason: "desgaste" })),
      ...Array.from({ length: 7 }, () => ({ assignedAt: NOW, employeeId: "e1", reason: "vida_util" })),
      ...Array.from({ length: 3 }, () => ({ assignedAt: NOW, employeeId: "e1", reason: "extravio" })),
      ...Array.from({ length: 3 }, () => ({ assignedAt: NOW, employeeId: "e1" })),
    ], areas, NOW);
    assert.deepEqual(d.byReason.map((r) => r.percent), [46, 29, 13, 12]);
    assert.equal(d.byReason.reduce((s, r) => s + r.percent, 0), 100);
  });
});

describe("roundPercentages", () => {
  it("reparte por mayor residuo y siempre suma 100", () => {
    assert.deepEqual(roundPercentages([1, 1, 1]), [34, 33, 33]);
    assert.deepEqual(roundPercentages([2, 1]), [67, 33]);
    for (const counts of [[11, 7, 3, 3], [5, 5, 5, 5, 5, 5, 5], [1, 0, 2], [999, 1]]) {
      assert.equal(roundPercentages(counts).reduce((s, p) => s + p, 0), 100);
    }
  });

  it("devuelve ceros si no hay entregas", () => {
    assert.deepEqual(roundPercentages([0, 0]), [0, 0]);
    assert.deepEqual(roundPercentages([]), []);
  });
});
