import { addDays, format, startOfWeek, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';

export interface DistributionAssignment {
  assignedAt: Date;
  employeeId: string;
  /** Valor de `replacementReason` de la entrega (vida_util, desgaste, extravio) o vacío. */
  reason?: string;
}

export interface WeeklyBucket {
  weekStart: Date;
  label: string;
  count: number;
}

export interface AreaBucket {
  area: string;
  count: number;
}

export type ReasonKey = 'desgaste' | 'vida_util' | 'extravio' | 'dotacion';

export interface ReasonBucket {
  key: ReasonKey;
  label: string;
  count: number;
  /** Porcentaje entero; los de todos los motivos suman 100 (método del mayor residuo). */
  percent: number;
}

/** Mismas etiquetas que el reporte de consumo: "desgaste" se muestra como uso normal. */
export const REASON_LABELS: Record<ReasonKey, string> = {
  desgaste: 'Uso normal',
  vida_util: 'Reposición por vida útil',
  extravio: 'Extravío',
  dotacion: 'Dotación',
};

const REASON_ORDER: ReasonKey[] = ['desgaste', 'vida_util', 'extravio', 'dotacion'];

function toReasonKey(reason: string | undefined): ReasonKey {
  return reason === 'desgaste' || reason === 'vida_util' || reason === 'extravio' ? reason : 'dotacion';
}

export interface DeliveryDistribution {
  /** Entregas por semana (lunes a domingo), de la más antigua a la actual. */
  weekly: WeeklyBucket[];
  /** Áreas con más entregas, de mayor a menor. */
  byArea: AreaBucket[];
  /** Entregas por motivo, en orden fijo; solo los motivos con entregas. */
  byReason: ReasonBucket[];
  /** Entregas cargadas en el panel con fecha válida. */
  sample: number;
  /** Entregas dentro de la ventana de semanas; es la base de las tres gráficas. */
  inWindow: number;
}

export const EMPTY_DISTRIBUTION: DeliveryDistribution = { weekly: [], byArea: [], byReason: [], sample: 0, inWindow: 0 };

/**
 * Reparte 100 puntos entre los conteos con el método del mayor residuo, para que
 * los porcentajes enteros sumen exactamente 100. Con total 0 devuelve ceros.
 */
export function roundPercentages(counts: number[]): number[] {
  const total = counts.reduce((sum, c) => sum + c, 0);
  if (total <= 0) return counts.map(() => 0);
  const raw = counts.map((c) => (c / total) * 100);
  const floors = raw.map(Math.floor);
  let remaining = 100 - floors.reduce((sum, f) => sum + f, 0);
  const order = raw
    .map((value, index) => ({ index, remainder: value - floors[index] }))
    .sort((a, b) => b.remainder - a.remainder || counts[b.index] - counts[a.index] || a.index - b.index);
  for (const { index } of order) {
    if (remaining <= 0) break;
    floors[index] += 1;
    remaining -= 1;
  }
  return floors;
}

/**
 * Agrupa las entregas cargadas en el panel por semana, área y motivo.
 * Las tres gráficas usan la misma ventana de `weeks` semanas (lunes a domingo).
 * Solo cuenta lo que recibe: no consulta nada ni inventa datos.
 */
export function buildDistribution(
  assignments: DistributionAssignment[],
  areaByEmployee: Map<string, string>,
  now: Date = new Date(),
  weeks = 8,
  topAreas = 5,
): DeliveryDistribution {
  const valid = assignments.filter((a) => a.assignedAt instanceof Date && !Number.isNaN(a.assignedAt.getTime()));
  const currentWeek = startOfWeek(now, { weekStartsOn: 1 });
  const windowStart = subWeeks(currentWeek, weeks - 1);
  const windowEnd = addDays(currentWeek, 7);
  const windowed = valid.filter((a) => a.assignedAt >= windowStart && a.assignedAt < windowEnd);

  const weekly: WeeklyBucket[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const weekStart = subWeeks(currentWeek, i);
    const weekEnd = addDays(weekStart, 7);
    const count = valid.filter((a) => a.assignedAt >= weekStart && a.assignedAt < weekEnd).length;
    weekly.push({ weekStart, label: format(weekStart, 'd MMM', { locale: es }), count });
  }

  const areaCounts = new Map<string, number>();
  windowed.forEach((a) => {
    const area = areaByEmployee.get(a.employeeId);
    if (area) areaCounts.set(area, (areaCounts.get(area) ?? 0) + 1);
  });
  const byArea = [...areaCounts.entries()]
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count || a.area.localeCompare(b.area))
    .slice(0, topAreas);

  const reasonCounts = new Map<ReasonKey, number>();
  windowed.forEach((a) => {
    const key = toReasonKey(a.reason);
    reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
  });
  const presentReasons = REASON_ORDER.filter((key) => (reasonCounts.get(key) ?? 0) > 0);
  const percents = roundPercentages(presentReasons.map((key) => reasonCounts.get(key) ?? 0));
  const byReason = presentReasons.map((key, i) => ({
    key,
    label: REASON_LABELS[key],
    count: reasonCounts.get(key) ?? 0,
    percent: percents[i],
  }));

  return { weekly, byArea, byReason, sample: valid.length, inWindow: windowed.length };
}
