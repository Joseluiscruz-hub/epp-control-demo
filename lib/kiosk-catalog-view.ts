/**
 * Lógica pura de la pantalla de selección de EPP del kiosko.
 * Solo presenta datos que ya llegan del catálogo público y de la asignación
 * activa; las reglas de negocio (alertas, cobros, aprobación) siguen en el servidor.
 */
import type { PPECatalogItem, PPESizeVariant } from "./kiosk-types";

export type CatalogAvailabilityStatus = "ok" | "empty" | "unauthorized";
export type CatalogStockLevel = "ok" | "low" | "empty" | "unauthorized";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Orden preferido de las pestañas; las categorías desconocidas van al final. */
export const KIOSK_CATEGORY_ORDER = [
  "Guantes",
  "Cascos",
  "Gafas",
  "Calzado",
  "Ropa",
  "Proteccion Auditiva",
  "Respiradores",
  "Arneses",
  "Otros",
];

const CATEGORY_LABELS: Record<string, string> = {
  "Proteccion Auditiva": "Protección auditiva",
  "Protección Auditiva": "Protección auditiva",
};

export const ALL_CATEGORIES = "Todos";

export function categoryLabel(category: string) {
  return CATEGORY_LABELS[category] ?? category;
}

/** Pestañas a mostrar: "Todos" más solo las categorías presentes en el catálogo. */
export function buildCategoryTabs(items: Pick<PPECatalogItem, "category">[]) {
  const present = new Set(items.map((item) => item.category).filter(Boolean));
  const known = KIOSK_CATEGORY_ORDER.filter((category) => present.has(category));
  const unknown = [...present]
    .filter((category) => !KIOSK_CATEGORY_ORDER.includes(category))
    .sort((a, b) => a.localeCompare(b, "es"));
  return [ALL_CATEGORIES, ...known, ...unknown];
}

export function isVariantAvailable(variant?: Pick<PPESizeVariant, "available" | "stock">) {
  return Boolean(variant) && (variant?.available === true || Number(variant?.stock ?? 0) > 0);
}

export function getItemStatus(item: PPECatalogItem): CatalogAvailabilityStatus {
  if (item.active === false) return "unauthorized";
  if (item.hasSizes && item.sizes) {
    return Object.values(item.sizes).some(isVariantAvailable) ? "ok" : "empty";
  }
  return item.available === true || Number(item.stock ?? 0) > 0 ? "ok" : "empty";
}

export function statusMessage(status: CatalogAvailabilityStatus) {
  if (status === "unauthorized") return "Sin autorización";
  if (status === "empty") return "Sin stock";
  return "";
}

/**
 * Nivel para el indicador de la tarjeta. "low" solo aparece cuando el catálogo
 * trae existencias numéricas (modo local); el catálogo público solo dice si hay o no.
 */
export function getStockLevel(item: PPECatalogItem, size?: string): CatalogStockLevel {
  const status = getItemStatus(item);
  if (status !== "ok") return status;

  const source: Pick<PPESizeVariant, "stock" | "minStock" | "available"> | undefined =
    item.hasSizes ? (size ? item.sizes?.[size] : undefined) : item;
  if (!source) return "ok";
  if (item.hasSizes && size && !isVariantAvailable(source)) return "empty";
  if (typeof source.stock === "number" && typeof source.minStock === "number" && source.stock > 0 && source.stock <= source.minStock) {
    return "low";
  }
  return "ok";
}

export function stockLevelLabel(level: CatalogStockLevel) {
  switch (level) {
    case "low": return "Pocas piezas";
    case "empty": return "Sin stock";
    case "unauthorized": return "Sin autorización";
    default: return "Disponible";
  }
}

/** El catálogo público usa alias `public:...`; esos no se muestran como código. */
export function displayItemCode(item: PPECatalogItem, size?: string) {
  const candidate = item.hasSizes
    ? (size ? item.sizes?.[size]?.sku : undefined) ?? item.sku
    : item.sku;
  if (!candidate || candidate.startsWith("public:")) return undefined;
  return candidate;
}

/** "5120417" → "5•••17". Evita exponer la nómina completa en una pantalla pública. */
export function maskEmployeeId(employeeId: string) {
  const id = employeeId.trim();
  if (id.length <= 3) return id;
  return `${id.slice(0, 1)}•••${id.slice(-2)}`;
}

export function formatCountdown(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export type EarlyReplacementNotice = {
  daysUsed: number;
  daysRemaining: number;
  replacementDays: number;
  severity: "warning" | "critical";
};

function toValidDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate: unknown }).toDate === "function") {
    const date = (value as { toDate: () => Date }).toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }
  return null;
}

/**
 * Aviso informativo de reposición anticipada. Replica el criterio que usa el
 * servidor al crear la solicitud (días completos desde la entrega y fecha de
 * próxima reposición), para que el colaborador sepa antes de enviar que su
 * solicitud llevará alerta. El servidor sigue siendo quien decide.
 */
export function getEarlyReplacementNotice(
  assignment: Record<string, unknown> | null | undefined,
  itemReplacementDays: number,
  now: Date = new Date()
): EarlyReplacementNotice | null {
  if (!assignment) return null;
  const assignedAt = toValidDate(assignment.assignedAt);
  if (!assignedAt) return null;

  const replacementDays = Number(itemReplacementDays || assignment.replacementDays || 0);
  if (!Number.isFinite(replacementDays) || replacementDays <= 0) return null;

  const nextEligibleAt = toValidDate(assignment.nextReplacementAt)
    ?? new Date(assignedAt.getTime() + replacementDays * DAY_MS);
  const daysUsed = Math.max(0, Math.floor((now.getTime() - assignedAt.getTime()) / DAY_MS));
  const daysRemaining = Math.max(0, Math.ceil((nextEligibleAt.getTime() - now.getTime()) / DAY_MS));
  if (daysRemaining <= 0 || daysUsed >= replacementDays) return null;

  return {
    daysUsed,
    daysRemaining,
    replacementDays,
    severity: daysUsed < Math.ceil(replacementDays * 0.5) ? "critical" : "warning",
  };
}

export function formatDaysAgo(days: number) {
  if (days <= 0) return "hoy";
  if (days === 1) return "hace 1 día";
  return `hace ${days} días`;
}
