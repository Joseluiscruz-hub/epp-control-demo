import test from "node:test";
import assert from "node:assert/strict";
import { replacementUrgency, replacementUrgencyTextClass } from "./replacement-urgency";

const now = new Date("2026-10-11T12:00:00Z");
const inDays = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

test("vencido cuando la fecha ya pasó", () => {
  assert.equal(replacementUrgency(inDays(-1), now), "overdue");
});

test("crítico a 30 días o menos", () => {
  assert.equal(replacementUrgency(inDays(0.5), now), "critical");
  assert.equal(replacementUrgency(inDays(30), now), "critical");
});

test("advertencia entre 31 y 90 días", () => {
  assert.equal(replacementUrgency(inDays(31), now), "warning");
  assert.equal(replacementUrgency(inDays(90), now), "warning");
});

test("neutro con más de 90 días, sin fecha o fecha inválida", () => {
  assert.equal(replacementUrgency(inDays(300), now), "ok");
  assert.equal(replacementUrgency(null, now), "ok");
  assert.equal(replacementUrgency(new Date("x"), now), "ok");
});

test("clases de color por urgencia", () => {
  assert.match(replacementUrgencyTextClass("overdue"), /critical/);
  assert.match(replacementUrgencyTextClass("warning"), /warning/);
  assert.doesNotMatch(replacementUrgencyTextClass("ok"), /critical|warning/);
});
