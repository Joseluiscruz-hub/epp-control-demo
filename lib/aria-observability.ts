/**
 * ARIA query log (`aria_queries`) + weekly report aggregation.
 * One document per answered query, written by /api/chat with the Admin SDK.
 * Feedback (acceptedByUser) is set later by /api/chat/feedback.
 */
import type { AriaReplyResult } from "./aria-prompt";
import type { tagAriaAnswer } from "./aria-judges";

export const ARIA_QUERY_COLLECTION = "aria_queries";

export type AriaQueryLog = {
  actorUid: string;
  plantScope: string;
  messageLength: number;
  historyMessages: number;
  latencyMs: number;
  promptTokensApprox: number;
  outputTokensApprox: number;
  promptTokensReported: number | null;
  outputTokensReported: number | null;
  sampleLimited: boolean;
  budgetComplete: boolean | null;
  promptVersion: string;
  model: string;
  guardrails: ReturnType<typeof tagAriaAnswer>;
  acceptedByUser: boolean | null;
  feedbackComment: string | null;
  createdAtMs: number;
};

export function buildAriaQueryLog(input: {
  actorUid: string; plantScope: string; messageLength: number; historyMessages: number;
  reply: AriaReplyResult; guardrails: ReturnType<typeof tagAriaAnswer>; nowMs: number;
}): AriaQueryLog {
  const m = input.reply.metrics;
  return {
    actorUid: input.actorUid,
    plantScope: input.plantScope,
    messageLength: input.messageLength,
    historyMessages: input.historyMessages,
    latencyMs: m.latencyMs,
    promptTokensApprox: m.promptTokensApprox,
    outputTokensApprox: m.outputTokensApprox,
    promptTokensReported: m.promptTokensReported,
    outputTokensReported: m.outputTokensReported,
    sampleLimited: m.sampleLimited,
    budgetComplete: m.budgetComplete,
    promptVersion: m.promptVersion,
    model: m.model,
    guardrails: input.guardrails,
    acceptedByUser: null,
    feedbackComment: null,
    createdAtMs: input.nowMs,
  };
}

export type FeedbackParse = { ok: true; queryId: string; accepted: boolean; comment: string | null } | { ok: false; error: string };

export function parseAriaFeedback(body: unknown): FeedbackParse {
  if (!body || typeof body !== "object") return { ok: false, error: "Cuerpo invalido." };
  const b = body as Record<string, unknown>;
  const queryId = typeof b.queryId === "string" ? b.queryId.trim() : "";
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(queryId)) return { ok: false, error: "queryId invalido." };
  if (typeof b.accepted !== "boolean") return { ok: false, error: "accepted debe ser booleano." };
  const comment = typeof b.comment === "string" ? b.comment.trim().slice(0, 500) : "";
  return { ok: true, queryId, accepted: b.accepted, comment: comment || null };
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

export function summarizeAriaQueries(rows: Array<Partial<AriaQueryLog>>, period: { fromMs: number; toMs: number }) {
  const latencies = rows.map((r) => Number(r.latencyMs)).filter(Number.isFinite);
  const rated = rows.filter((r) => typeof r.acceptedByUser === "boolean");
  const accepted = rated.filter((r) => r.acceptedByUser === true).length;
  const byPlant: Record<string, number> = {};
  rows.forEach((r) => { const k = r.plantScope ?? "desconocida"; byPlant[k] = (byPlant[k] ?? 0) + 1; });
  const count = (pred: (r: Partial<AriaQueryLog>) => boolean) => rows.filter(pred).length;
  return {
    from: new Date(period.fromMs).toISOString(),
    to: new Date(period.toMs).toISOString(),
    queries: rows.length,
    uniqueUsers: new Set(rows.map((r) => r.actorUid)).size,
    byPlant,
    latencyMs: { p50: percentile(latencies, 50), p95: percentile(latencies, 95) },
    tokensApprox: {
      prompt: rows.reduce((s, r) => s + Number(r.promptTokensApprox ?? 0), 0),
      output: rows.reduce((s, r) => s + Number(r.outputTokensApprox ?? 0), 0),
    },
    sampleLimitedQueries: count((r) => r.sampleLimited === true),
    sampleLimitedWithoutDisclaimer: count((r) => r.sampleLimited === true && r.guardrails?.declaresLimitations === false),
    answersWithUngroundedNumbers: count((r) => Number(r.guardrails?.ungroundedNumberCount ?? 0) > 0),
    answersWithPersonPhrase: count((r) => r.guardrails?.personPhraseDetected === true),
    answersWithoutActions: count((r) => r.guardrails?.hasActions === false),
    feedback: { rated: rated.length, accepted, rejected: rated.length - accepted, acceptanceRate: rated.length ? Math.round((accepted / rated.length) * 1000) / 10 : null },
  };
}

export function renderAriaWeeklyReport(summary: ReturnType<typeof summarizeAriaQueries>) {
  const fmt = (v: number | null, suffix = "") => (v === null ? "sin datos" : `${v}${suffix}`);
  return [
    `# Reporte semanal ARIA (${summary.from.slice(0, 10)} → ${summary.to.slice(0, 10)})`,
    "",
    `- Consultas: ${summary.queries} de ${summary.uniqueUsers} usuarios`,
    `- Por planta: ${Object.entries(summary.byPlant).map(([k, v]) => `${k}=${v}`).join(", ") || "sin datos"}`,
    `- Latencia p50/p95: ${fmt(summary.latencyMs.p50, " ms")} / ${fmt(summary.latencyMs.p95, " ms")}`,
    `- Tokens aproximados: prompt ${summary.tokensApprox.prompt}, respuesta ${summary.tokensApprox.output}`,
    `- Consultas con muestra parcial: ${summary.sampleLimitedQueries} (sin advertencia: ${summary.sampleLimitedWithoutDisclaimer})`,
    `- Respuestas con cifras sin respaldo en el contexto: ${summary.answersWithUngroundedNumbers}`,
    `- Respuestas que señalan a una persona: ${summary.answersWithPersonPhrase}`,
    `- Respuestas sin acciones concretas: ${summary.answersWithoutActions}`,
    `- Feedback: ${summary.feedback.rated} calificadas, ${summary.feedback.accepted} útiles, ${summary.feedback.rejected} no útiles (aceptación ${fmt(summary.feedback.acceptanceRate, "%")})`,
    "",
  ].join("\n");
}
