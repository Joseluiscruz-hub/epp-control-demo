import type { KioskRequestItem, ReplacementReason } from "./kiosk-types";

export const VALID_KIOSK_REPLACEMENT_REASONS = new Set<ReplacementReason>([
  "vida_util",
  "desgaste",
  "extravio",
]);

const REQUEST_ITEM_KEYS = new Set([
  "itemId",
  "itemName",
  "sku",
  "size",
  "replacementDays",
  "replacementReason",
  "durationRuleId",
  "durationRuleSource",
  "durationRuleSku",
  "durationRuleSapMaterial",
  "requiredQuantity",
  "requiredUnit",
  "chargeAmount",
  "signatureDataUrl",
  "earlyReplacementAlert",
]);

export class KioskRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "KioskRequestError";
    this.status = status;
  }
}

export type RequestItemInput = Partial<KioskRequestItem>;

export type FulfillableKioskItem = KioskRequestItem & {
  chargeAmount?: number;
  signatureDataUrl?: string | null;
};

export function readKioskText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function readKioskNumber(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidRequestItemShape(value: unknown): value is RequestItemInput {
  if (!isObject(value)) return false;
  if (Object.keys(value).some((key) => !REQUEST_ITEM_KEYS.has(key))) return false;

  const itemId = readKioskText(value.itemId);
  if (!itemId) return false;

  const replacementReason = readKioskText(value.replacementReason);
  if (
    replacementReason &&
    !VALID_KIOSK_REPLACEMENT_REASONS.has(replacementReason as ReplacementReason)
  ) {
    return false;
  }

  if (
    value.replacementDays != null &&
    (!Number.isFinite(Number(value.replacementDays)) || Number(value.replacementDays) <= 0)
  ) {
    return false;
  }

  if (
    value.chargeAmount != null &&
    (!Number.isFinite(Number(value.chargeAmount)) || Number(value.chargeAmount) < 0)
  ) {
    return false;
  }

  return value.signatureDataUrl == null || typeof value.signatureDataUrl === "string";
}

function requestItemKey(item: Pick<RequestItemInput, "itemId" | "size">) {
  const itemId = readKioskText(item.itemId);
  const size = readKioskText(item.size) || "N/A";
  return `${itemId}\u0000${size}`;
}

export function assertUniqueRequestItems(
  items: readonly Pick<RequestItemInput, "itemId" | "size">[],
  status = 400
) {
  const seen = new Set<string>();

  items.forEach((item) => {
    const key = requestItemKey(item);
    if (seen.has(key)) {
      throw new KioskRequestError(
        "No se puede solicitar el mismo EPP y talla mas de una vez.",
        status
      );
    }
    seen.add(key);
  });
}

function parseFulfillableItem(raw: unknown, index: number): FulfillableKioskItem {
  if (!isObject(raw)) {
    throw new KioskRequestError(
      `La solicitud contiene un articulo invalido en la posicion ${index + 1}.`,
      409
    );
  }

  const itemId = readKioskText(raw.itemId);
  const itemName = readKioskText(raw.itemName);
  const sku = readKioskText(raw.sku);
  const size = readKioskText(raw.size) || "N/A";
  const replacementDays = readKioskNumber(raw.replacementDays);
  const replacementReason = readKioskText(raw.replacementReason);

  if (!itemId || !itemName || !sku || replacementDays <= 0) {
    throw new KioskRequestError(
      `La solicitud contiene un articulo incompleto en la posicion ${index + 1}.`,
      409
    );
  }

  return {
    itemId,
    itemName,
    sku,
    size,
    replacementDays,
    requiredQuantity: readKioskNumber(raw.requiredQuantity, 1),
    requiredUnit: readKioskText(raw.requiredUnit),
    unitCost: Math.max(0, readKioskNumber(raw.unitCost)),
    category: readKioskText(raw.category) || "Sin categoria",
    ...(VALID_KIOSK_REPLACEMENT_REASONS.has(replacementReason as ReplacementReason)
      ? { replacementReason: replacementReason as ReplacementReason }
      : {}),
    ...(readKioskNumber(raw.chargeAmount) > 0
      ? { chargeAmount: readKioskNumber(raw.chargeAmount) }
      : {}),
    ...(typeof raw.signatureDataUrl === "string"
      ? { signatureDataUrl: raw.signatureDataUrl }
      : {}),
    ...(readKioskText(raw.durationRuleId)
      ? { durationRuleId: readKioskText(raw.durationRuleId) }
      : {}),
    ...(readKioskText(raw.durationRuleSource)
      ? { durationRuleSource: readKioskText(raw.durationRuleSource) }
      : {}),
    ...(readKioskText(raw.durationRuleSku)
      ? { durationRuleSku: readKioskText(raw.durationRuleSku) }
      : {}),
    ...(raw.durationRuleSapMaterial === null
      ? { durationRuleSapMaterial: null }
      : readKioskText(raw.durationRuleSapMaterial)
        ? { durationRuleSapMaterial: readKioskText(raw.durationRuleSapMaterial) }
        : {}),
  };
}

export type ApprovedRequestResolutionDecision =
  | { kind: "fulfill" }
  | { kind: "already_fulfilled"; assignmentIds: string[] };

export function decideApprovedRequestResolution(params: {
  currentStatus: string;
  existingAssignmentIds: string[];
  approvedWithAlert: boolean;
  canApproveAlert: boolean;
}): ApprovedRequestResolutionDecision {
  const {
    currentStatus,
    existingAssignmentIds,
    approvedWithAlert,
    canApproveAlert,
  } = params;

  if (currentStatus !== "pending" && currentStatus !== "approved") {
    throw new KioskRequestError(`La solicitud ya esta ${currentStatus}.`, 409);
  }
  if (approvedWithAlert && !canApproveAlert) {
    throw new KioskRequestError(
      "Este usuario no esta autorizado para aprobar solicitudes con alerta de vida util.",
      403
    );
  }
  if (existingAssignmentIds.length > 0) {
    return { kind: "already_fulfilled", assignmentIds: existingAssignmentIds };
  }
  return { kind: "fulfill" };
}

export function normalizeFulfillableItems(input: unknown): FulfillableKioskItem[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new KioskRequestError(
      "Solicitud de kiosko incompleta para sincronizar consumo.",
      409
    );
  }

  const items = input.map(parseFulfillableItem);
  assertUniqueRequestItems(items, 409);
  return items;
}

// ── Idempotencia de solicitudes de kiosko ─────────────────────────────────────

export const KIOSK_PENDING_INDEX_COLLECTION = "kiosk_pending_index";

const CLIENT_REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidClientRequestId(value: unknown): value is string {
  return typeof value === "string" && CLIENT_REQUEST_ID_PATTERN.test(value);
}

/**
 * Resuelve el clientRequestId enviado por el kiosko (body y/o header Idempotency-Key).
 * - Si no viene en ningun lado (cliente viejo) devuelve null: el servidor genera uno.
 * - Si viene con formato invalido o body y header no coinciden, lanza 400.
 */
export function resolveClientRequestId(bodyValue: unknown, headerValue: string | null | undefined): string | null {
  const fromBody = bodyValue === undefined || bodyValue === null || bodyValue === "" ? null : bodyValue;
  const fromHeader = headerValue ? headerValue.trim() : null;

  if (fromBody !== null && !isValidClientRequestId(fromBody)) {
    throw new KioskRequestError("clientRequestId invalido.", 400);
  }
  if (fromHeader !== null && !isValidClientRequestId(fromHeader)) {
    throw new KioskRequestError("Idempotency-Key invalido.", 400);
  }
  if (fromBody !== null && fromHeader !== null && fromBody.toLowerCase() !== fromHeader.toLowerCase()) {
    throw new KioskRequestError("clientRequestId e Idempotency-Key no coinciden.", 400);
  }
  const value = (fromBody ?? fromHeader) as string | null;
  return value ? value.toLowerCase() : null;
}

function encodeDocIdPart(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new KioskRequestError(`${label} requerido para el id de solicitud.`, 400);
  // Firestore no permite "/" en ids; encodeURIComponent tambien escapa "%" para que no haya colisiones.
  return encodeURIComponent(trimmed).replace(/\./g, "%2E");
}

/** Id determinista del documento kiosk_requests: mismo empleado + mismo intento = mismo documento. */
export function buildKioskRequestDocId(employeeId: string, clientRequestId: string) {
  if (!isValidClientRequestId(clientRequestId)) {
    throw new KioskRequestError("clientRequestId invalido.", 400);
  }
  return `${encodeDocIdPart(employeeId, "employeeId")}_${clientRequestId.toLowerCase()}`;
}

/** Id del indice de solicitudes pendientes: un solo pendiente por empleado + articulo + talla. */
export function buildKioskPendingIndexId(employeeId: string, itemId: string, size?: string | null) {
  const normalizedSize = readKioskText(size) || "N/A";
  return [
    encodeDocIdPart(employeeId, "employeeId"),
    encodeDocIdPart(itemId, "itemId"),
    encodeDocIdPart(normalizedSize, "size"),
  ].join("_");
}

/** Un indice pendiente solo bloquea si apunta a otra solicitud que sigue pendiente. */
export function isBlockingPendingIndex(params: {
  indexRequestId: unknown;
  currentRequestId: string;
  referencedRequestStatus: unknown;
}) {
  const indexRequestId = readKioskText(params.indexRequestId);
  if (!indexRequestId || indexRequestId === params.currentRequestId) return false;
  const status = readKioskText(params.referencedRequestStatus) || null;
  return status === "pending";
}
