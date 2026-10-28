import type { AdminSession } from "./server-auth";
import type { UserProfile } from "./admin-profile";
import type { PlantScope } from "./plants";

type ConfiguredAlertApprover = {
  employeeId: string;
  name: string;
  email: string;
};

type ConfiguredGlobalAlertApprover = {
  name: string;
  email: string;
};

export type KioskAlertApproverConfig = {
  plants: Partial<Record<PlantScope, readonly ConfiguredAlertApprover[]>>;
  global: readonly ConfiguredGlobalAlertApprover[];
};

const EMPTY_CONFIG: KioskAlertApproverConfig = { plants: {}, global: [] };

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Interpreta KIOSK_ALERT_APPROVERS (JSON). Los aprobadores NO viven en el codigo:
 * son datos personales y se entregan por Secret Manager / variable de entorno.
 * Formato: { "plants": { "<planta>": [{ "employeeId", "name", "email" }] },
 *            "global": [{ "name", "email" }] }
 * Falla cerrado: JSON invalido o entradas incompletas no autorizan a nadie.
 */
export function parseKioskAlertApproverConfig(raw: string): KioskAlertApproverConfig {
  if (!raw.trim()) return EMPTY_CONFIG;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("[kiosk-alert-approvers] KIOSK_ALERT_APPROVERS no es JSON valido; no se configuran aprobadores.");
    return EMPTY_CONFIG;
  }
  if (!parsed || typeof parsed !== "object") return EMPTY_CONFIG;

  const source = parsed as { plants?: unknown; global?: unknown };
  const plants: Partial<Record<PlantScope, readonly ConfiguredAlertApprover[]>> = {};

  if (source.plants && typeof source.plants === "object") {
    for (const [plantaId, entries] of Object.entries(source.plants as Record<string, unknown>)) {
      if (!Array.isArray(entries)) continue;
      const valid = entries.flatMap((entry): ConfiguredAlertApprover[] => {
        const item = (entry ?? {}) as Record<string, unknown>;
        const employeeId = cleanString(item.employeeId);
        const name = cleanString(item.name);
        const email = cleanString(item.email);
        return employeeId && name && email.includes("@") ? [{ employeeId, name, email }] : [];
      });
      if (valid.length > 0) plants[plantaId as PlantScope] = valid;
    }
  }

  const global = Array.isArray(source.global)
    ? source.global.flatMap((entry): ConfiguredGlobalAlertApprover[] => {
        const item = (entry ?? {}) as Record<string, unknown>;
        const name = cleanString(item.name);
        const email = cleanString(item.email);
        return name && email.includes("@") ? [{ name, email }] : [];
      })
    : [];

  return { plants, global };
}

let cachedRaw: string | undefined;
let cachedConfig: KioskAlertApproverConfig = EMPTY_CONFIG;

/** Lee la configuracion en cada llamada (con cache por valor) para poder cambiarla sin reiniciar pruebas. */
export function getKioskAlertApproverConfig(): KioskAlertApproverConfig {
  const raw = process.env.KIOSK_ALERT_APPROVERS ?? "";
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedConfig = parseKioskAlertApproverConfig(raw);
  }
  return cachedConfig;
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export type KioskApprovalActor = {
  uid: string;
  email: string;
  role: AdminSession["role"];
  plantaId: AdminSession["plantaId"];
  employeeId: string | null;
  name: string;
  permissionSource: "plant_allowlist" | "global_admin" | "explicit_permission" | "standard_admin";
};

function findPlantApprover(plantaId: PlantScope, employeeId: string | undefined) {
  if (!employeeId) return null;
  return getKioskAlertApproverConfig().plants[plantaId]?.find((approver) => approver.employeeId === employeeId) ?? null;
}

export function findKioskAlertApproverByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  for (const [plantaId, approvers] of Object.entries(getKioskAlertApproverConfig().plants)) {
    const approver = approvers?.find((candidate) => normalizeEmail(candidate.email) === normalizedEmail);
    if (approver) return { ...approver, plantaId: plantaId as PlantScope };
  }
  return null;
}

export function findGlobalKioskAlertApproverByEmail(email: string): ConfiguredGlobalAlertApprover | null {
  const normalizedEmail = normalizeEmail(email);
  return getKioskAlertApproverConfig().global.find((approver) => normalizeEmail(approver.email) === normalizedEmail) ?? null;
}

export function buildProvisionedKioskAlertApproverProfile(uid: string, email: string): UserProfile | null {
  const approver = findKioskAlertApproverByEmail(email);
  if (approver && approver.plantaId !== "nacional") {
    return {
      uid,
      email: normalizeEmail(email),
      role: "admin_local",
      plantaId: approver.plantaId,
      displayName: approver.name,
      employeeId: approver.employeeId,
      permissions: {
        canApproveKioskRequests: true,
        canApproveKioskAlerts: true,
      },
      active: true,
    };
  }

  const globalApprover = findGlobalKioskAlertApproverByEmail(email);
  if (!globalApprover) return null;

  return {
    uid,
    email: normalizeEmail(email),
    role: "admin_global",
    plantaId: "nacional",
    displayName: globalApprover.name,
    permissions: {
      canApproveKioskRequests: true,
      canApproveKioskAlerts: true,
    },
    active: true,
  };
}

export function buildKioskApprovalActor(adminUser: AdminSession, requestPlantId: PlantScope): KioskApprovalActor {
  const profileEmployeeId = adminUser.profile.employeeId;
  const configuredApprover = findPlantApprover(requestPlantId, profileEmployeeId);
  const isGlobalAdmin = adminUser.role === "admin_global";
  const hasExplicitPermission = adminUser.profile.permissions?.canApproveKioskAlerts === true;

  return {
    uid: adminUser.uid,
    email: adminUser.email,
    role: adminUser.role,
    plantaId: adminUser.plantaId,
    employeeId: configuredApprover?.employeeId ?? profileEmployeeId ?? null,
    name: configuredApprover?.name ?? adminUser.profile.displayName ?? adminUser.email,
    permissionSource: configuredApprover
      ? "plant_allowlist"
      : isGlobalAdmin
        ? "global_admin"
      : hasExplicitPermission
        ? "explicit_permission"
        : "standard_admin",
  };
}

export function canApproveKioskAlert(adminUser: AdminSession, requestPlantId: PlantScope) {
  if (adminUser.role === "admin_global") return true;

  const employeeId = adminUser.profile.employeeId;
  if (findPlantApprover(requestPlantId, employeeId)) return true;

  return (
    adminUser.profile.permissions?.canApproveKioskAlerts === true &&
    typeof employeeId === "string" &&
    employeeId.length > 0
  );
}

export function kioskAlertApproverIdsForPlant(plantaId: PlantScope) {
  return getKioskAlertApproverConfig().plants[plantaId]?.map((approver) => approver.employeeId) ?? [];
}
