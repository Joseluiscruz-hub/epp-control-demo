/**
 * Regenerates evals/cases/aria-eval-v1.json from case-specs.ts + scenarios.ts.
 * Run: npm run eval:aria:build
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildAriaOperationalContext } from "@/lib/aria-context";
import { CASE_SPECS } from "./case-specs";
import { buildGoldenAnswer } from "./golden";
import { PERSONAL_TOKENS, SCENARIOS } from "./scenarios";

export function contextForScenario(id: string) {
  const s = SCENARIOS[id];
  if (!s) throw new Error(`Escenario desconocido: ${id}`);
  return buildAriaOperationalContext({ ...s, now: new Date(s.now) });
}

export function buildCases() {
  return CASE_SPECS.map((spec) => {
    const ctx = contextForScenario(spec.scenario);
    const partial = ctx.dataQuality.assignmentSampleLimited || (ctx.budget !== null && !ctx.budget.complete);
    const requireLimitations = partial
      // privacy/norm: the expected behavior is refusal / defer to Seguridad e Higiene,
      // not a data-limitation disclaimer; only required there if the context is partial.
      || ["coverage", "missing_data"].includes(spec.intent)
      || ctx.totals.assignmentsAnalyzed === 0;
    return {
      id: spec.id,
      category: spec.category,
      scenario: spec.scenario,
      scenarioDescription: SCENARIOS[spec.scenario].description,
      question: spec.question,
      history: spec.history ?? [],
      expectedBehavior: spec.expectedBehavior,
      expectedContext: {
        sampleLimited: ctx.dataQuality.assignmentSampleLimited,
        budgetComplete: ctx.budget ? ctx.budget.complete : null,
      },
      expectations: {
        requireLimitations,
        requireActions: true,
        mustMention: spec.expectations?.mustMention ?? [],
        mustMentionAny: spec.expectations?.mustMentionAny ?? [],
        mustNotMention: spec.expectations?.mustNotMention ?? [],
        forbiddenPersonalTokens: PERSONAL_TOKENS,
      },
      goldenAnswer: buildGoldenAnswer(ctx, spec.intent),
    };
  });
}

if (process.argv[1]?.endsWith("build-cases.ts")) {
  const cases = buildCases();
  const out = join(process.cwd(), "evals", "cases", "aria-eval-v1.json");
  writeFileSync(out, `${JSON.stringify({ version: "aria-eval-v1", generatedFrom: "evals/case-specs.ts", count: cases.length, cases }, null, 2)}\n`);
  console.log(`Escribi ${cases.length} casos en ${out}`);
}
