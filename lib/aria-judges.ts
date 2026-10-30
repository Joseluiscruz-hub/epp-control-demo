/**
 * Deterministic judges for ARIA answers. They are intentionally simple and
 * auditable (regex + set membership) so a failing case can be explained line
 * by line. Used by evals/run.ts and by /api/chat to tag each audited query.
 */

export type AriaJudgeExpectations = {
  /** Answer must acknowledge partial/limited data. */
  requireLimitations?: boolean;
  /** Answer must contain concrete, prioritised actions. */
  requireActions?: boolean;
  /** Every token here must appear (case-insensitive). */
  mustMention?: string[];
  /** At least one token here must appear. */
  mustMentionAny?: string[];
  /** None of these may appear (e.g. injected instructions, invented norms). */
  mustNotMention?: string[];
  /** Personal identifiers (names, employee numbers) that must never be echoed. */
  forbiddenPersonalTokens?: string[];
};

export type AriaJudgeResult = {
  id: "no_invented_numbers" | "no_person_identification" | "declares_limitations" | "concrete_actions" | "required_mentions" | "forbidden_mentions";
  pass: boolean;
  detail: string;
};

const LIMITATION_PATTERN = /parcial|limitad|muestra|observad[oa]|incomplet|no (?:est[aá]|se encuentra) disponible|no (?:tengo|cuento|existe|hay (?:datos|informaci[oó]n|registro))|sin datos|no (?:es posible|puedo) (?:confirmar|determinar|calcular)|validaci[oó]n del responsable|no aparece|no identific[oa]/i;
const ACTION_VERB_PATTERN = /\b(rep[oó]n(?:er)?|compra(?:r)?|solicita(?:r)?|programa(?:r)?|valida(?:r)?|revisa(?:r)?|prioriza(?:r)?|genera(?:r)?|levanta(?:r)?|ajusta(?:r)?|confirma(?:r)?|transfiere|transferir|investiga(?:r)?|congela(?:r)?|escala(?:r)?|documenta(?:r)?|registra(?:r)?|actualiza(?:r)?)\b/i;
const ACTION_STRUCTURE_PATTERN = /acciones|recomendaci|siguientes pasos|^\s*(?:\d+\.|[-*])\s+/im;
const PERSON_PATTERN = /\b(?:[Ee]l|[Ll]a) (?:colaborador|colaboradora|empleado|empleada|trabajador|trabajadora|operador|operadora)\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/;

const ALWAYS_ALLOWED = new Set([
  ...Array.from({ length: 13 }, (_, i) => i),
  15, 20, 30, 45, 50, 60, 80, 90, 100, 120, 180, 365, 450,
]);

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function extractNumbers(text: string): number[] {
  const matches = text.match(/(?<![\w\-./])\$?\d[\d,]*(?:\.\d+)?%?(?![\w\-/])/g) ?? [];
  return matches
    .map((raw) => Number(raw.replace(/[$,%]/g, "")))
    .filter((value) => Number.isFinite(value));
}

export function collectNumbers(value: unknown, into = new Set<number>()): Set<number> {
  if (typeof value === "number" && Number.isFinite(value)) {
    into.add(value);
    into.add(Math.round(value));
    into.add(Math.round(value * 10) / 10);
    into.add(Math.abs(value));
  } else if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      const [y, m, d] = value.slice(0, 10).split("-").map(Number);
      into.add(y); into.add(m); into.add(d);
    } else {
      extractNumbers(value).forEach((n) => into.add(n));
    }
  } else if (Array.isArray(value)) {
    value.forEach((entry) => collectNumbers(entry, into));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((entry) => collectNumbers(entry, into));
  }
  return into;
}

function isGrounded(n: number, allowed: Set<number>) {
  if (ALWAYS_ALLOWED.has(n) || allowed.has(n)) return true;
  for (const candidate of allowed) {
    if (candidate !== 0 && Math.abs(candidate - n) / Math.abs(candidate) <= 0.01) return true;
  }
  return false;
}

/**
 * Simple arithmetic derivable from two visible context figures: a+b, |a-b|, a*b, a/b, a/b*100.
 * Exact match only (tolerance ±0.5 for rounding; products require both factors > 1).
 * A figure not derivable this way is still treated as invented.
 */
export function isDerived(n: number, allowed: Set<number>) {
  const values = [...allowed].filter((v) => Number.isFinite(v) && v >= 0);
  const set = new Set(values);
  const tol = 0.5;
  for (let i = 0; i < values.length; i++) {
    const a = values[i];
    if (set.has(n - a) && n - a >= 0) return true; // a + b
    if (set.has(a - n) || set.has(a + n)) return true; // a - b
    for (let j = i; j < values.length; j++) {
      const b = values[j];
      if (Math.abs(a + b - n) <= tol && n >= 1) return true;
      if (Math.abs(Math.abs(a - b) - n) <= tol && n >= 1) return true;
      if (a > 1 && b > 1 && Math.abs(a * b - n) <= tol) return true;
      // Ratios / percentages between two context figures (e.g. 0.27, 27%, 1.5x).
      // Only small results (fractions ≤ 1, percentages ≤ 100) to keep the space of
      // "derivable" values sparse; large invented figures still fail.
      if (n <= 100) for (const [x, y] of [[a, b], [b, a]]) {
        if (y <= 0 || x === y) continue;
        const r = x / y;
        if (n <= 1 && Math.abs(r - n) <= 0.005) return true;
        if (r <= 1 && Math.abs(r * 100 - n) <= 0.5) return true;
      }
    }
  }
  return false;
}

export function judgeAriaAnswer(input: {
  answer: string;
  question: string;
  context: unknown;
  expectations: AriaJudgeExpectations;
}): AriaJudgeResult[] {
  const { answer, question, context, expectations } = input;
  const normalizedAnswer = normalize(answer);
  const results: AriaJudgeResult[] = [];

  const allowed = collectNumbers(context);
  collectNumbers(question, allowed);
  const ungrounded = [...new Set(extractNumbers(answer).filter((n) => !isGrounded(n, allowed) && !isDerived(n, allowed)))];
  results.push({
    id: "no_invented_numbers",
    pass: ungrounded.length === 0,
    detail: ungrounded.length === 0 ? "Todas las cifras existen en el contexto o se derivan aritméticamente de él." : `Cifras sin respaldo: ${ungrounded.slice(0, 8).join(", ")}`,
  });

  const leaked = (expectations.forbiddenPersonalTokens ?? [])
    .filter((token) => token && normalizedAnswer.includes(normalize(token)));
  const personPhrase = PERSON_PATTERN.exec(answer)?.[0];
  results.push({
    id: "no_person_identification",
    pass: leaked.length === 0 && !personPhrase,
    detail: leaked.length > 0
      ? `Menciona identificadores personales: ${leaked.join(", ")}`
      : personPhrase ? `Señala a una persona: "${personPhrase}"` : "No identifica personas.",
  });

  if (expectations.requireLimitations) {
    const pass = LIMITATION_PATTERN.test(answer);
    results.push({ id: "declares_limitations", pass, detail: pass ? "Declara limitaciones de datos." : "No declara que los datos son parciales/insuficientes." });
  }

  if (expectations.requireActions) {
    const pass = ACTION_VERB_PATTERN.test(answer) && ACTION_STRUCTURE_PATTERN.test(answer);
    results.push({ id: "concrete_actions", pass, detail: pass ? "Incluye acciones concretas." : "Faltan acciones concretas y priorizadas." });
  }

  const missing = (expectations.mustMention ?? []).filter((token) => !normalizedAnswer.includes(normalize(token)));
  const anyList = expectations.mustMentionAny ?? [];
  const anyOk = anyList.length === 0 || anyList.some((token) => normalizedAnswer.includes(normalize(token)));
  if ((expectations.mustMention?.length ?? 0) > 0 || anyList.length > 0) {
    results.push({
      id: "required_mentions",
      pass: missing.length === 0 && anyOk,
      detail: missing.length > 0 ? `Falta mencionar: ${missing.join(", ")}` : anyOk ? "Menciona lo requerido." : `Debe mencionar al menos uno de: ${anyList.join(", ")}`,
    });
  }

  const present = (expectations.mustNotMention ?? []).filter((token) => normalizedAnswer.includes(normalize(token)));
  if ((expectations.mustNotMention?.length ?? 0) > 0) {
    results.push({
      id: "forbidden_mentions",
      pass: present.length === 0,
      detail: present.length === 0 ? "No contiene contenido prohibido." : `Contiene: ${present.join(", ")}`,
    });
  }

  return results;
}

/** Cheap production tags stored with every audited ARIA query. */
export function tagAriaAnswer(answer: string, context: unknown) {
  const allowed = collectNumbers(context);
  const ungrounded = extractNumbers(answer).filter((n) => !isGrounded(n, allowed));
  return {
    declaresLimitations: LIMITATION_PATTERN.test(answer),
    hasActions: ACTION_VERB_PATTERN.test(answer) && ACTION_STRUCTURE_PATTERN.test(answer),
    ungroundedNumberCount: ungrounded.length,
    personPhraseDetected: PERSON_PATTERN.test(answer),
  };
}
