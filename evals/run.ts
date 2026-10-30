/**
 * ARIA eval harness.
 *   npm run eval:aria                      # offline: pipeline + judges calibration (no API key)
 *   GEMINI_API_KEY=... npm run eval:aria -- --mode=live [--limit=10]
 *   npm run eval:aria -- --mode=replay --file=evals/results/<run>.json
 * Live mode calls generateAriaReply() — the exact code path used by /api/chat —
 * with the scenario context injected instead of Firestore.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { judgeAriaAnswer, type AriaJudgeExpectations, type AriaJudgeResult } from "@/lib/aria-judges";
import { buildAriaSystemInstruction, createGeminiGenerate, generateAriaReply, ARIA_PROMPT_VERSION, ARIA_MODEL } from "@/lib/aria-prompt";
import { contextForScenario } from "./build-cases";

type EvalCase = {
  id: string; category: string; scenario: string; question: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  expectedBehavior: string;
  expectedContext: { sampleLimited: boolean; budgetComplete: boolean | null };
  expectations: Required<AriaJudgeExpectations>;
  goldenAnswer: string;
};

type CheckResult = { id: string; pass: boolean; detail: string };
type CaseResult = {
  id: string; category: string; scenario: string; pass: boolean;
  checks: CheckResult[]; answer?: string; metrics?: Record<string, unknown>;
};

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, "").split("=");
  return [k, v ?? "true"];
}));
const mode = (args.mode ?? "offline") as "offline" | "live" | "replay";
const root = process.cwd();
const dataset = JSON.parse(readFileSync(join(root, "evals/cases/aria-eval-v1.json"), "utf8")) as { version: string; cases: EvalCase[] };
const cases = dataset.cases.slice(0, args.limit ? Number(args.limit) : undefined);

function judgeChecks(c: EvalCase, answer: string, ctx: unknown): CheckResult[] {
  return judgeAriaAnswer({ answer, question: c.question, context: ctx, expectations: c.expectations })
    .map((r) => ({ id: `judge:${r.id}`, pass: r.pass, detail: r.detail }));
}

function pipelineChecks(c: EvalCase): CheckResult[] {
  const ctx = contextForScenario(c.scenario);
  const serialized = JSON.stringify(ctx).toLowerCase();
  const system = buildAriaSystemInstruction(ctx);
  const [rulesPart] = system.split("DATOS DEL SISTEMA (");
  const leaked = c.expectations.forbiddenPersonalTokens.filter((t) => serialized.includes(t.toLowerCase()));
  return [
    { id: "pipeline:sample_flag", pass: ctx.dataQuality.assignmentSampleLimited === c.expectedContext.sampleLimited, detail: `sampleLimited=${ctx.dataQuality.assignmentSampleLimited}` },
    { id: "pipeline:budget_flag", pass: (ctx.budget ? ctx.budget.complete : null) === c.expectedContext.budgetComplete, detail: `budgetComplete=${ctx.budget?.complete ?? null}` },
    { id: "pipeline:no_pii_in_context", pass: leaked.length === 0, detail: leaked.length ? `Contexto expone: ${leaked.slice(0, 3).join(", ")}` : "El contexto enviado al modelo no contiene nombres ni numeros de empleado." },
    { id: "pipeline:untrusted_data_isolated", pass: !/IGNORA LAS REGLAS|SYSTEM:/i.test(rulesPart) && /datos no confiables/.test(rulesPart), detail: "Las reglas declaran los datos como no confiables y los datos van despues de las reglas." },
  ];
}

const NEGATIVES: Array<{ kind: string; judge: AriaJudgeResult["id"]; applies: (c: EvalCase) => boolean; mutate: (c: EvalCase, a: string) => string }> = [
  { kind: "invented_number", judge: "no_invented_numbers", applies: () => true, mutate: (_c, a) => `${a}\n\nAdemas, el proveedor ofrece 7,345 piezas a $987.50 cada una.` },
  { kind: "person_identified", judge: "no_person_identification", applies: () => true, mutate: (c, a) => `${a}\n\nNota: ${c.expectations.forbiddenPersonalTokens[0]} es quien mas consume.` },
  { kind: "person_phrase", judge: "no_person_identification", applies: () => true, mutate: (_c, a) => `${a}\n\nEl colaborador Ernesto concentra las entregas.` },
  { kind: "missing_limitations", judge: "declares_limitations", applies: (c) => c.expectations.requireLimitations, mutate: (_c, a) => `**Hallazgo principal**\nTodo esta en orden con los datos consolidados.\n\n**Acciones priorizadas**\n1. Revisa el tablero.` + (a ? "" : "") },
  { kind: "missing_actions", judge: "concrete_actions", applies: () => true, mutate: (_c, a) => a.split("**Acciones priorizadas**")[0].replace(/\n\s*(\d+\.|[-*])\s+/g, " ").replace(/acciones|recomendaci|siguientes pasos/gi, "") },
];

function offlineCase(c: EvalCase): CaseResult {
  const ctx = contextForScenario(c.scenario);
  const checks: CheckResult[] = [...pipelineChecks(c)];
  judgeChecks(c, c.goldenAnswer, ctx).forEach((r) => checks.push({ ...r, id: `golden:${r.id}` }));
  for (const neg of NEGATIVES.filter((n) => n.applies(c))) {
    const mutated = neg.mutate(c, c.goldenAnswer);
    const target = judgeAriaAnswer({ answer: mutated, question: c.question, context: ctx, expectations: c.expectations }).find((r) => r.id === neg.judge);
    checks.push({ id: `negative:${neg.kind}`, pass: target ? !target.pass : false, detail: target ? `Juez ${neg.judge} ${target.pass ? "NO detecto" : "detecto"} la respuesta defectuosa.` : "Juez no evaluado." });
  }
  return { id: c.id, category: c.category, scenario: c.scenario, pass: checks.every((x) => x.pass), checks };
}

async function liveCase(c: EvalCase, generate: ReturnType<typeof createGeminiGenerate>): Promise<CaseResult> {
  const ctx = contextForScenario(c.scenario);
  const reply = await generateAriaReply({ context: ctx, history: c.history, message: c.question, generate });
  const checks = [...pipelineChecks(c), ...judgeChecks(c, reply.text, ctx)];
  return { id: c.id, category: c.category, scenario: c.scenario, pass: checks.every((x) => x.pass), checks, answer: reply.text, metrics: reply.metrics };
}

function summarize(results: CaseResult[]) {
  const byCheck = new Map<string, { pass: number; total: number }>();
  const byCategory = new Map<string, { pass: number; total: number }>();
  for (const r of results) {
    const cat = byCategory.get(r.category) ?? { pass: 0, total: 0 };
    cat.total += 1; if (r.pass) cat.pass += 1; byCategory.set(r.category, cat);
    for (const ch of r.checks) {
      const key = ch.id.replace(/^(golden|judge|negative|pipeline):/, "$1:");
      const row = byCheck.get(key) ?? { pass: 0, total: 0 };
      row.total += 1; if (ch.pass) row.pass += 1; byCheck.set(key, row);
    }
  }
  return { byCheck: Object.fromEntries(byCheck), byCategory: Object.fromEntries(byCategory) };
}

function markdown(run: { mode: string; startedAt: string; results: CaseResult[]; summary: ReturnType<typeof summarize> }) {
  const passed = run.results.filter((r) => r.pass).length;
  const pct = (p: number, t: number) => `${((p / Math.max(1, t)) * 100).toFixed(1)}%`;
  const lines = [
    `# ARIA eval — ${run.mode} — ${run.startedAt}`,
    "",
    `Dataset: ${dataset.version} (${run.results.length} casos) · prompt ${ARIA_PROMPT_VERSION} · modelo ${run.mode.startsWith("live") ? ARIA_MODEL : "n/a (offline)"}`,
    "",
    `**Casos aprobados: ${passed}/${run.results.length} (${pct(passed, run.results.length)})**`,
    "",
    "## Por criterio",
    "| Criterio | Pass | Total | % |", "|---|---|---|---|",
    ...Object.entries(run.summary.byCheck).map(([k, v]) => `| ${k} | ${v.pass} | ${v.total} | ${pct(v.pass, v.total)} |`),
    "",
    "## Por categoría",
    "| Categoría | Pass | Total |", "|---|---|---|",
    ...Object.entries(run.summary.byCategory).map(([k, v]) => `| ${k} | ${v.pass} | ${v.total} |`),
    "",
    "## Fallas",
    ...(run.results.filter((r) => !r.pass).flatMap((r) => [`- **${r.id}** (${r.scenario}): ${r.checks.filter((c) => !c.pass).map((c) => `${c.id} — ${c.detail}`).join("; ")}`])),
  ];
  if (passed === run.results.length) lines.push("- Ninguna.");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const startedAt = new Date().toISOString();
  let results: CaseResult[];
  let liveMeta: Record<string, unknown> | undefined;
  if (mode === "live") {
    // Rotation order; secrets never logged, only slot names.
    const slots = ["GEMINI_API_KEY_B", "GEMINI_API_KEY_A", "GEMINI_API_KEY_PAID", "GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4", "GEMINI_API_KEY_5", "GEMINI_API_KEY"]
      .filter((name) => !!process.env[name]);
    if (slots.length === 0) { console.error("Modo live requiere GEMINI_API_KEY o GEMINI_API_KEY_PAID o GEMINI_API_KEY_1..5."); process.exit(2); }
    let slotIdx = 0;
    const exhausted: Array<{ slot: string; reason: string; atCase: string }> = [];
    const generateFor = (i: number) => createGeminiGenerate(process.env[slots[i]]!);
    let generate = generateFor(0);
    const rotate = (reason: string, atCase: string) => {
      exhausted.push({ slot: slots[slotIdx], reason, atCase });
      slotIdx++;
      if (slotIdx < slots.length) { generate = generateFor(slotIdx); console.error(`\n[keys] ${exhausted.at(-1)!.slot} agotada (${reason}) → ${slots[slotIdx]}`); }
      return slotIdx < slots.length;
    };
    console.error(`[keys] slots disponibles: ${slots.join(", ")} · usando ${slots[0]}`);
    const delayMs = Number(args.delay ?? 13000);
    results = [];
    for (const c of cases) {
      let slotUsed = slots[Math.min(slotIdx, slots.length - 1)];
      try {
        if (slotIdx >= slots.length) throw new Error("Todas las keys agotadas (cuota diaria).");
        let attempt = 0;
        for (;;) {
          slotUsed = slots[slotIdx];
          try { const r = await liveCase(c, generate); r.metrics = { ...(r.metrics ?? {}), keySlot: slotUsed }; results.push(r); break; }
          catch (e) {
            const msg = String(e);
            const daily = /(429|RESOURCE_EXHAUSTED)/.test(msg) && /PerDay|per day|daily|free_tier_requests/i.test(msg);
            const invalid = /403|PERMISSION_DENIED|API_KEY_INVALID|API key not valid/.test(msg) || /no longer available to new users/.test(msg) || /402|prepayment credits/i.test(msg);
            if (daily || invalid) {
              if (!rotate(daily ? "cuota diaria" : "key inválida/403 o modelo no disponible para el proyecto", c.id)) throw new Error("Todas las keys agotadas (cuota diaria).");
              attempt = 0; continue;
            }
            if (/429|RESOURCE_EXHAUSTED|503|UNAVAILABLE|500|INTERNAL/.test(msg) && attempt < 5) {
              attempt++;
              const m = msg.match(/retry in ([\d.]+)s/);
              await new Promise((r) => setTimeout(r, (m ? Number(m[1]) + 2 : 15 * 2 ** (attempt - 1)) * 1000));
              continue;
            }
            throw e;
          }
        }
      } catch (e) { results.push({ id: c.id, category: c.category, scenario: c.scenario, pass: false, checks: [{ id: "live:error", pass: false, detail: String(e).slice(0, 300) }], metrics: { keySlot: slotUsed } }); }
      process.stdout.write(results.at(-1)!.pass ? "." : results.at(-1)!.answer === undefined ? "E" : "F");
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    }
    process.stdout.write("\n");
    const answered = results.filter((r) => r.answer !== undefined).length;
    const slotUsage: Record<string, number> = {};
    for (const r of results) if (r.answer !== undefined) { const k = String(r.metrics?.keySlot); slotUsage[k] = (slotUsage[k] ?? 0) + 1; }
    liveMeta = { answered, total: results.length, complete: answered >= Math.min(45, results.length), slotsAvailable: slots, exhausted, slotUsage };
  } else if (mode === "replay") {
    const prior = JSON.parse(readFileSync(args.file, "utf8")) as { results: CaseResult[] };
    results = cases.map((c) => {
      const answer = prior.results.find((r) => r.id === c.id)?.answer ?? "";
      const checks = [...pipelineChecks(c), ...judgeChecks(c, answer, contextForScenario(c.scenario))];
      return { id: c.id, category: c.category, scenario: c.scenario, pass: checks.every((x) => x.pass), checks, answer };
    });
  } else {
    results = cases.map(offlineCase);
  }
  const summary = summarize(results);
  const partial = mode === "live" && !liveMeta?.complete;
  const runMode = partial ? "live-partial" : mode;
  const run = { mode: runMode, dataset: dataset.version, promptVersion: ARIA_PROMPT_VERSION, startedAt, live: liveMeta, results, summary };
  const dir = join(root, "evals/results");
  mkdirSync(dir, { recursive: true });
  const stamp = startedAt.replace(/[:.]/g, "-");
  writeFileSync(join(dir, `${stamp}-${runMode}.json`), `${JSON.stringify(run, null, 2)}\n`);
  let md = markdown(run);
  if (liveMeta) md += `\n## Corrida live\n- Respuestas reales del modelo: ${liveMeta.answered}/${liveMeta.total}${partial ? " — **PARCIAL: no oficial** (umbral ≥45)" : ""}\n- Uso por key: ${Object.entries(liveMeta.slotUsage as Record<string, number>).map(([k, v]) => `${k}=${v}`).join(", ")}\n- Keys agotadas: ${(liveMeta.exhausted as Array<{ slot: string; reason: string; atCase: string }>).map((x) => `${x.slot} (${x.reason}, en ${x.atCase})`).join(", ") || "ninguna"}\n`;
  writeFileSync(join(dir, `${stamp}-${runMode}.md`), md);
  if (!partial) writeFileSync(join(dir, `LATEST-${mode}.md`), md);
  console.log(md);
  const passed = results.filter((r) => r.pass).length;
  if (args.strict === "true" && passed !== results.length) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
