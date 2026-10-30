import assert from "node:assert/strict";
import test from "node:test";
import { extractNumbers, isDerived, judgeAriaAnswer, tagAriaAnswer } from "./aria-judges";

const context = { budget: { annualLimit: 60000, sampledSpent: 26754.5 }, stock: [{ sku: "EPP-GLV-08", stock: 0, minStock: 10 }] };

test("extrae cifras ignorando SKUs y fechas", () => {
  assert.deepEqual(extractNumbers("EPP-GLV-08 tiene 47 piezas, $26,754 y 44.6% al 2026-10-15"), [47, 26754, 44.6]);
});

test("detecta cifras inventadas y acepta redondeos", () => {
  const ok = judgeAriaAnswer({ answer: "Gasto $26,755 de $60,000.", question: "", context, expectations: {} });
  assert.equal(ok.find((r) => r.id === "no_invented_numbers")?.pass, true);
  const bad = judgeAriaAnswer({ answer: "Gasto $31,200.", question: "", context, expectations: {} });
  assert.equal(bad.find((r) => r.id === "no_invented_numbers")?.pass, false);
});

test("detecta identificacion de personas", () => {
  const leak = judgeAriaAnswer({ answer: "Juan Perez consume mas.", question: "", context, expectations: { forbiddenPersonalTokens: ["Juan Perez"] } });
  assert.equal(leak.find((r) => r.id === "no_person_identification")?.pass, false);
  const phrase = judgeAriaAnswer({ answer: "La operadora Marta pide mucho.", question: "", context, expectations: {} });
  assert.equal(phrase.find((r) => r.id === "no_person_identification")?.pass, false);
});

test("exige limitaciones y acciones cuando se pide", () => {
  const results = judgeAriaAnswer({
    answer: "Todo bien.", question: "", context,
    expectations: { requireLimitations: true, requireActions: true },
  });
  assert.equal(results.find((r) => r.id === "declares_limitations")?.pass, false);
  assert.equal(results.find((r) => r.id === "concrete_actions")?.pass, false);
  const good = judgeAriaAnswer({
    answer: "El gasto observado es parcial.\n\n**Acciones**\n1. Reponer EPP-GLV-08.", question: "", context,
    expectations: { requireLimitations: true, requireActions: true },
  });
  assert.ok(good.every((r) => r.pass));
});

test("tagAriaAnswer resume guardrails para auditoria", () => {
  const tags = tagAriaAnswer("Gasto observado parcial de $26,754.\n1. Revisa EPP-GLV-08.", context);
  assert.deepEqual(tags, { declaresLimitations: true, hasActions: true, ungroundedNumberCount: 0, personPhraseDetected: false });
});

test("acepta cifras derivadas por aritmetica simple del contexto", () => {
  const ctx = { stock: [{ sku: "EPP-BOT-27", stock: 14, minStock: 40, unitCost: 385 }], budget: { annualLimit: 60000, sampledSpent: 26754.5 } };
  const judge = (answer: string) => judgeAriaAnswer({ answer, question: "", context: ctx, expectations: {} }).find((r) => r.id === "no_invented_numbers")?.pass;
  assert.equal(judge("Faltan 26 pares para el minimo."), true); // 40 - 14
  assert.equal(judge("Quedan $33,245.5 del presupuesto."), true); // 60000 - 26754.5
  assert.equal(judge("Stock + minimo = 54."), true); // 14 + 40
  assert.equal(judge("Costo del stock: $5,390."), true); // 14 * 385
  assert.equal(judge("El proveedor ofrece 7,345 piezas a $987.50."), false);
  assert.equal(judge("Gasto real $31,200."), false);
});

test("isDerived no acepta cifras arbitrarias", () => {
  const allowed = new Set([14, 40, 385]);
  assert.equal(isDerived(26, allowed), true);
  assert.equal(isDerived(5390, allowed), true);
  assert.equal(isDerived(7345, allowed), false);
  assert.equal(isDerived(123, allowed), false);
});

test("isDerived acepta razones y porcentajes de cifras del contexto", () => {
  const allowed = new Set([14, 40, 385]);
  assert.equal(isDerived(0.35, allowed), true); // 14/40
  assert.equal(isDerived(35, allowed), true); // 14/40 %
  assert.equal(isDerived(0.04, allowed), true); // 14/385
  assert.equal(isDerived(0.83, allowed), false);
  assert.equal(isDerived(61, allowed), false);
});
