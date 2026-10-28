import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { auth, db, ensureFirebaseReady, getAppCheckTokenForRequest, isAppCheckRequiredForClient } from "./firebase";
import {
  KioskEarlyReplacementAlert,
  KioskEmployee,
  KioskRequestItem,
  KioskRequestStatus,
  PPECatalogItem,
  ReplacementReason,
} from "./kiosk-types";
import {
  canUseLocalFallback,
  createLocalKioskRequest,
  getLocalActiveAssignment,
  getLocalKioskEmployee,
  getLocalKioskRequestStatus,
  getLocalPPECatalog,
  isLocalKioskRequestId,
  isOfflineRuntime,
  listLocalKioskRequests,
  saveLocalKioskEmployeePin,
  updateLocalKioskRequestStatus,
} from "./kiosk-local-store";
import { legacyHashPin } from "./pin-utils";
import type { ActivePlantId } from "./plants";
import { isInsecureKioskLocalAuthEnabled } from "./kiosk-local-auth-policy";
import { SERVER_UNAVAILABLE_MESSAGE, readOfflineFallbackInput, shouldFallbackAfterError } from "./offline-fallback-policy";

class KioskApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "KioskApiError";
    this.status = status;
  }
}

async function parseKioskApiError(response: Response, fallback: string) {
  try {
    const data = await response.json();
    return typeof data?.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
}

// Solo sin red real + modo offline activo (o herramienta local en localhost).
// Un error del servidor ya no crea registros locales: el servidor pudo haber guardado la operacion.
function canFallbackToLocal(error?: unknown) {
  // Nunca ante una respuesta HTTP (KioskApiError): el servidor pudo haber guardado la operacion.
  return shouldFallbackAfterError(error, readOfflineFallbackInput());
}

function normalizeCatalogDuration(item: PPECatalogItem): PPECatalogItem {
  const replacementDays = Number(item.replacementDays ?? 365);
  return {
    ...item,
    replacementDays: Number.isFinite(replacementDays) && replacementDays > 0 ? replacementDays : 365,
  };
}

// ── Empleado ──────────────────────────────────────────────────────────────────

function isLocalRuntime() {
  return typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

export async function getEmployeeById(employeeId: string): Promise<KioskEmployee | null> {
  try {
    const response = await fetch("/api/kiosk/employee", {
      method: "POST",
      headers: await kioskApiHeaders(),
      body: JSON.stringify({ employeeId }),
    });
    if (response.ok) {
      const payload = await response.json();
      if (payload?.employee && typeof payload.employee === "object") {
        return payload.employee as KioskEmployee;
      }
      return null;
    }
    throw new KioskApiError(
      await parseKioskApiError(response, "No se pudo consultar el colaborador."),
      response.status
    );
  } catch (error) {
    if (canFallbackToLocal(error)) {
      console.warn("[Kiosko] Usando empleado local por error de Firebase.", error);
      return getLocalKioskEmployee(employeeId, true);
    }
    throw error;
  }
}

export async function saveEmployeePin(employeeId: string, activationCode: string, pin: string): Promise<void> {
  try {
    const response = await fetch("/api/kiosk/pin/setup", {
      method: "POST",
      headers: await kioskApiHeaders(),
      body: JSON.stringify({ employeeId, activationCode, pin }),
    });

    if (!response.ok) {
      throw new KioskApiError(
        await parseKioskApiError(response, "No se pudo configurar el PIN."),
        response.status
      );
    }
  } catch (error) {
    if (canFallbackToLocal(error) && isInsecureKioskLocalAuthEnabled()) {
      console.warn("[Kiosko] Guardando PIN en modo local.", error);
      saveLocalKioskEmployeePin(employeeId, legacyHashPin(pin));
      return;
    }
    throw error;
  }
}

export async function validateEmployeePin(
  employeeId: string,
  pin: string
): Promise<boolean> {
  try {
    const response = await fetch("/api/kiosk/pin/verify", {
      method: "POST",
      headers: await kioskApiHeaders(),
      body: JSON.stringify({ employeeId, pin }),
    });

    if (response.ok) {
      const data = await response.json();
      return data?.valid === true;
    }

    throw new KioskApiError(
      await parseKioskApiError(response, "No se pudo validar el PIN."),
      response.status
    );
  } catch (error) {
    if (canFallbackToLocal(error) && isInsecureKioskLocalAuthEnabled()) {
      const emp = await getEmployeeById(employeeId);
      return !!emp?.pin && emp.pin === legacyHashPin(pin);
    }
    if (error instanceof KioskApiError && error.status === 401) return false;
    throw error;
  }
}

// ── Catálogo ──────────────────────────────────────────────────────────────────

export async function getPPECatalog(plantId?: string): Promise<PPECatalogItem[]> {
  const localCatalog = () => getLocalPPECatalog().filter((item) => (
    !plantId || !item.plantaId || item.plantaId === plantId
  ));

  try {
    const response = await fetch("/api/kiosk/catalog", {
      headers: await kioskApiHeaders(),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new KioskApiError(
        typeof payload?.error === "string" ? payload.error : "No se pudo consultar el catalogo.",
        response.status
      );
    }

    const rawItems: unknown[] = Array.isArray(payload?.items) ? payload.items : [];
    const items = rawItems
      .filter((item: unknown): item is PPECatalogItem => (
        typeof item === "object" && item !== null && "id" in item && "name" in item
      ))
      .map((item) => normalizeCatalogDuration(item))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
    return items;
  } catch (error) {
    if (canFallbackToLocal(error)) {
      console.warn("[Kiosko] Usando catalogo local por error del servidor.", error);
      return localCatalog();
    }
    throw error;
  }
}

// ── Asignaciones activas del empleado ─────────────────────────────────────────

export async function getActiveAssignment(
  employeeId: string,
  sku: string,
  itemId?: string,
  size?: string
): Promise<{ id: string } & Record<string, unknown> | null> {
  try {
    const response = await fetch("/api/kiosk/assignment", {
      method: "POST",
      headers: await kioskApiHeaders(),
      body: JSON.stringify({
        employeeId,
        sku,
        ...(itemId ? { itemId } : {}),
        ...(size ? { size } : {}),
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      return payload?.assignment ?? (canUseLocalFallback() ? getLocalActiveAssignment(employeeId, sku) : null);
    }

    throw new KioskApiError(
      typeof payload?.error === "string" ? payload.error : "No se pudo consultar la asignacion activa.",
      response.status
    );
  } catch (error) {
    if (canFallbackToLocal(error)) {
      console.warn("[Kiosko] Consultando asignacion local por error de Firebase.", error);
      return getLocalActiveAssignment(employeeId, sku);
    }
    throw error;
  }
}

// ── Dispensar EPP ─────────────────────────────────────────────────────────────

export interface DispenseParams {
  employeeId: string;
  sku: string;
  size: string;
  itemId: string;          // doc ID en ppe_catalog
  replacementDays: number;
  reason: ReplacementReason;
  chargeAmount?: number;
  signatureDataUrl?: string;
  issuedByKiosk: boolean;
}

export async function dispenseEPP(params: DispenseParams): Promise<string> {
  try {
    const employee = await getEmployeeById(params.employeeId);
    const employeeName =
      employee?.name ||
      (typeof window !== "undefined" ? sessionStorage.getItem("kiosk_employee_name") ?? "" : "");

    if (!employeeName) {
      throw new KioskApiError("No se pudo identificar al colaborador para crear la solicitud.", 409);
    }

    return await createKioskRequest({
      employeeId: params.employeeId,
      employeeName,
      items: [{
        itemId: params.itemId,
        itemName: params.itemId,
        sku: params.sku,
        size: params.size || "N/A",
        replacementDays: params.replacementDays,
        replacementReason: params.reason,
        chargeAmount: params.chargeAmount ?? 0,
        signatureDataUrl: params.signatureDataUrl ?? null,
      }],
    });
  } catch (error) {
    if (!canFallbackToLocal(error)) throw error;
    console.warn("[Kiosko] API de solicitud no disponible; creando solicitud local.", error);
    return createLocalKioskRequest({
      employeeId: params.employeeId,
      employeeName: typeof window !== "undefined" ? sessionStorage.getItem("kiosk_employee_name") ?? "" : "",
      items: [{
        itemId: params.itemId,
        itemName: params.itemId,
        sku: params.sku,
        size: params.size || "N/A",
        replacementDays: params.replacementDays,
        replacementReason: params.reason,
        chargeAmount: params.chargeAmount ?? 0,
        signatureDataUrl: params.signatureDataUrl ?? null,
      }],
    });
  }
}

// ── Solicitudes de kiosko ─────────────────────────────────────────────────────

const KIOSK_REQUEST_MAX_ATTEMPTS = 3;
const KIOSK_REQUEST_RETRY_DELAYS_MS = [400, 1200];

function newClientRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Respaldo para navegadores sin randomUUID (contexto no seguro): UUID v4 con getRandomValues.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isRetryableKioskRequestError(error: unknown) {
  // Error de red (fetch lanza TypeError) o error temporal del servidor.
  if (error instanceof KioskApiError) return error.status >= 500 || error.status === 408;
  return error instanceof TypeError;
}

function waitMs(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Crea una solicitud de kiosko de forma idempotente.
 * Se genera UN clientRequestId por intento del usuario (o se usa el que pase quien llama)
 * y se reutiliza en todos los reintentos: si el servidor ya la guardo, responde con la misma
 * solicitud (`duplicated: true`) en vez de crear otra.
 */
export async function createKioskRequest(input: {
  employeeId: string;
  employeeName: string;
  plantaId?: string;
  items: KioskRequestItem[];
  clientRequestId?: string;
}): Promise<string> {
  const { clientRequestId: suppliedId, ...payload } = input;
  const clientRequestId = suppliedId || newClientRequestId();

  try {
    let lastError: unknown;
    for (let attempt = 0; attempt < KIOSK_REQUEST_MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch("/api/kiosk/requests", {
          method: "POST",
          headers: { ...(await kioskApiHeaders()), "Idempotency-Key": clientRequestId },
          body: JSON.stringify({ ...payload, clientRequestId }),
        });

        if (!response.ok) {
          throw new KioskApiError(
            await parseKioskApiError(response, "No se pudo crear la solicitud."),
            response.status
          );
        }

        const data = await response.json();
        if (typeof data?.requestId === "string") return data.requestId;
        throw new KioskApiError("Respuesta invalida del servidor.", 500);
      } catch (error) {
        lastError = error;
        const isLastAttempt = attempt === KIOSK_REQUEST_MAX_ATTEMPTS - 1;
        if (isLastAttempt || !isRetryableKioskRequestError(error)) throw error;
        await waitMs(KIOSK_REQUEST_RETRY_DELAYS_MS[attempt] ?? 1200);
      }
    }
    throw lastError;
  } catch (error) {
    if (!canFallbackToLocal(error)) {
      if (error instanceof TypeError) throw new KioskApiError(SERVER_UNAVAILABLE_MESSAGE, 503);
      throw error;
    }
    console.warn("[Kiosko] Sin red: creando solicitud en modo local.", error);
    return createLocalKioskRequest(payload);
  }
}

export async function getKioskRequestStatus(requestId: string): Promise<KioskRequestStatus> {
  if (isLocalKioskRequestId(requestId)) {
    const localStatus = getLocalKioskRequestStatus(requestId);
    if (!localStatus) throw new Error("kiosk_request_not_found");
    return localStatus;
  }

  try {
    const response = await fetch("/api/kiosk/request-status", {
      method: "POST",
      headers: await kioskApiHeaders(),
      body: JSON.stringify({ requestId }),
    });
    if (!response.ok) throw new KioskApiError(await parseKioskApiError(response, "No se pudo consultar el folio."), response.status);
    const status = (await response.json()).status;
    if (status === "approved" || status === "rejected" || status === "pending") {
      return status;
    }
  } catch (error) {
    const localStatus = getLocalKioskRequestStatus(requestId);
    if (localStatus) return localStatus;
    throw error;
  }
  throw new Error("kiosk_request_invalid_status");
}

export type KioskServerSession = { employeeId: string; employeeName: string; plantId: string; expiresAt: number };

export async function getKioskServerSession(): Promise<KioskServerSession | null> {
  const response = await fetch("/api/kiosk/session", { headers: await kioskApiHeaders(), cache: "no-store" });
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new KioskApiError(await parseKioskApiError(response, "No se pudo validar la sesion."), response.status);
  return response.json();
}

export async function logoutKioskServerSession() {
  await fetch("/api/kiosk/session/logout", { method: "POST", headers: await kioskApiHeaders() }).catch(() => undefined);
}

export interface AdminKioskRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeArea?: string;
  plantaId?: string;
  items: KioskRequestItem[];
  status: KioskRequestStatus;
  createdAt?: Date;
  hasEarlyReplacementAlert?: boolean;
  earlyReplacementWarnings?: KioskEarlyReplacementAlert[];
  earlyReplacementAlertIds?: string[];
  assignmentIds?: string[];
}

async function kioskApiHeaders() {
  const appCheckToken = await getAppCheckTokenForRequest();
  if (!appCheckToken && isAppCheckRequiredForClient()) {
    throw new KioskApiError("No se pudo validar App Check. Recarga el kiosko e intenta de nuevo.", 401);
  }

  return {
    "Content-Type": "application/json",
    ...(appCheckToken ? { "X-Firebase-AppCheck": appCheckToken } : {}),
  };
}

function normalizeEarlyReplacementAlert(input: unknown): KioskEarlyReplacementAlert | null {
  if (!input || typeof input !== "object") return null;
  const data = input as Record<string, unknown>;
  const toDateValue = (value: unknown) => {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    if (typeof value === "string") return value;
    if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
      return (value.toDate() as Date).toISOString();
    }
    return undefined;
  };

  return {
    itemId: String(data.itemId ?? ""),
    itemName: String(data.itemName ?? ""),
    sku: String(data.sku ?? ""),
    size: String(data.size ?? ""),
    replacementDays: Number(data.replacementDays ?? 0),
    daysUsed: Number(data.daysUsed ?? 0),
    daysRemaining: Number(data.daysRemaining ?? 0),
    assignedAt: toDateValue(data.assignedAt),
    nextEligibleAt: toDateValue(data.nextEligibleAt),
    previousAssignmentId: typeof data.previousAssignmentId === "string" ? data.previousAssignmentId : undefined,
    severity: data.severity === "critical" ? "critical" : "warning",
  };
}

export async function listAdminKioskRequests(
  status: KioskRequestStatus = "pending",
  max = 25,
  activePlantId: ActivePlantId = "todas"
): Promise<AdminKioskRequest[]> {
  const localRequests = listLocalKioskRequests(status, max);

  try {
    await ensureFirebaseReady();
    const constraints = activePlantId === "todas"
      ? [where("status", "==", status), limit(Math.max(1, Math.min(max, 50)))]
      : [
          where("status", "==", status),
          where("plantaId", "==", activePlantId),
          limit(Math.max(1, Math.min(max, 50))),
        ];
    const snap = await getDocs(
      query(
        collection(db, "kiosk_requests"),
        ...constraints
      )
    );

    const remoteRequests = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        employeeId: data.employeeId ?? "",
        employeeName: data.employeeName ?? "",
        employeeArea: data.employeeArea ?? "",
        plantaId: data.plantaId ?? "",
        items: Array.isArray(data.items) ? (data.items as KioskRequestItem[]) : [],
        status: data.status as KioskRequestStatus,
        createdAt: data.createdAt?.toDate?.(),
        hasEarlyReplacementAlert: data.hasEarlyReplacementAlert === true,
        earlyReplacementWarnings: Array.isArray(data.earlyReplacementWarnings)
          ? data.earlyReplacementWarnings
              .map(normalizeEarlyReplacementAlert)
              .filter((alert): alert is KioskEarlyReplacementAlert => alert !== null)
          : [],
        earlyReplacementAlertIds: Array.isArray(data.earlyReplacementAlertIds)
          ? data.earlyReplacementAlertIds.filter((id: unknown): id is string => typeof id === "string")
          : [],
        assignmentIds: Array.isArray(data.assignmentIds)
          ? data.assignmentIds.filter((id: unknown): id is string => typeof id === "string")
          : [],
      };
    });

    return [...localRequests, ...remoteRequests]
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
      .slice(0, Math.max(1, Math.min(max, 50)));
  } catch (error) {
    console.warn("[Kiosko] Listando solicitudes locales por error de Firebase.", error);
    return localRequests;
  }
}

export async function updateKioskRequestStatus(requestId: string, status: Extract<KioskRequestStatus, "approved" | "rejected">): Promise<void> {
  if (isLocalKioskRequestId(requestId)) {
    updateLocalKioskRequestStatus(requestId, status);
    return;
  }

  await ensureFirebaseReady();
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new KioskApiError("Inicia sesion online como administrador para gestionar solicitudes.", 401);
  }

  const response = await fetch("/api/kiosk/requests", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ requestId, status }),
  });

  if (!response.ok) {
    throw new KioskApiError(
      await parseKioskApiError(response, "No se pudo actualizar la solicitud."),
      response.status
    );
  }
}
