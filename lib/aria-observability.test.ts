import assert from "node:assert/strict";
import test from "node:test";
import { parseAriaFeedback, renderAriaWeeklyReport, summarizeAriaQueries } from "./aria-observability";

test("valida feedback", () => {
  assert.equal(parseAriaFeedback({ queryId: "abc", accepted: true }).ok, false);
  assert.equal(parseAriaFeedback({ queryId: "abcdefghij12", accepted: "si" }).ok, false);
  assert.deepEqual(parseAriaFeedback({ queryId: "abcdefghij12", accepted: false, comment: " no " }), { ok: true, queryId: "abcdefghij12", accepted: false, comment: "no" });
});

test("resume consultas de la semana", () => {
  const guard = { declaresLimitations: false, hasActions: true, ungroundedNumberCount: 1, personPhraseDetected: false };
  const summary = summarizeAriaQueries([
    { actorUid: "a", plantScope: "p1", latencyMs: 100, promptTokensApprox: 10, outputTokensApprox: 5, sampleLimited: true, guardrails: guard, acceptedByUser: true },
    { actorUid: "b", plantScope: "p1", latencyMs: 300, promptTokensApprox: 10, outputTokensApprox: 5, sampleLimited: false, guardrails: { ...guard, ungroundedNumberCount: 0 }, acceptedByUser: false },
    { actorUid: "a", plantScope: "p2", latencyMs: 200, promptTokensApprox: 10, outputTokensApprox: 5, sampleLimited: false, guardrails: { ...guard, ungroundedNumberCount: 0 }, acceptedByUser: null },
  ], { fromMs: 0, toMs: 7 * 86400000 });
  assert.equal(summary.queries, 3);
  assert.equal(summary.uniqueUsers, 2);
  assert.deepEqual(summary.latencyMs, { p50: 200, p95: 300 });
  assert.equal(summary.sampleLimitedWithoutDisclaimer, 1);
  assert.equal(summary.answersWithUngroundedNumbers, 1);
  assert.deepEqual(summary.feedback, { rated: 2, accepted: 1, rejected: 1, acceptanceRate: 50 });
  assert.match(renderAriaWeeklyReport(summary), /Consultas: 3 de 2 usuarios/);
});
