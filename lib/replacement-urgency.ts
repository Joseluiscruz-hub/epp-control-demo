export type ReplacementUrgency = "overdue" | "critical" | "warning" | "ok";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Umbrales (días restantes) para resaltar la fecha de cambio de un EPP. */
export const REPLACEMENT_CRITICAL_DAYS = 30;
export const REPLACEMENT_WARNING_DAYS = 90;

/**
 * Clasifica la próxima fecha de cambio: vencido o a 30 días o menos es crítico,
 * a 90 días o menos es advertencia, y el resto es neutro.
 */
export function replacementUrgency(nextReplacementAt: Date | null | undefined, now: Date = new Date()): ReplacementUrgency {
  if (!nextReplacementAt) return "ok";
  const target = nextReplacementAt.getTime();
  if (Number.isNaN(target)) return "ok";
  const diff = target - now.getTime();
  if (diff < 0) return "overdue";
  const days = diff / DAY_MS;
  if (days <= REPLACEMENT_CRITICAL_DAYS) return "critical";
  if (days <= REPLACEMENT_WARNING_DAYS) return "warning";
  return "ok";
}

/** Clase de color de texto para la fecha de cambio según su urgencia. */
export function replacementUrgencyTextClass(urgency: ReplacementUrgency): string {
  switch (urgency) {
    case "overdue":
    case "critical":
      return "text-[var(--critical)]";
    case "warning":
      return "text-[var(--warning)]";
    default:
      return "text-white/45";
  }
}
