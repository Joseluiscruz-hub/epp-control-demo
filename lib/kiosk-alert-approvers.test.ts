import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProvisionedKioskAlertApproverProfile,
  buildKioskApprovalActor,
  canApproveKioskAlert,
  findGlobalKioskAlertApproverByEmail,
  findKioskAlertApproverByEmail,
  kioskAlertApproverIdsForPlant,
  parseKioskAlertApproverConfig,
} from "./kiosk-alert-approvers";
import type { AdminSession } from "./server-auth";
import { installKioskApproversFixture } from "./kiosk-approvers-fixture";

installKioskApproversFixture();

function session(profile: Partial<AdminSession["profile"]>): AdminSession {
  return {
    uid: "uid-1",
    email: "admin@example.com",
    role: "admin_local",
    plantaId: "norte",
    profile: {
      uid: "uid-1",
      email: "admin@example.com",
      role: "admin_local",
      plantaId: "norte",
      active: true,
      ...profile,
    },
  };
}

describe("kiosk alert approvers", () => {
  it("autoriza aprobadores configurados de Norte por employeeId", () => {
    const admin = session({ employeeId: "1000001" });

    assert.equal(canApproveKioskAlert(admin, "norte"), true);
    assert.equal(buildKioskApprovalActor(admin, "norte").name, "Aprobador Uno");
  });

  it("autoriza administradores globales sin exigir employeeId", () => {
    const admin: AdminSession = {
      uid: "uid-global",
      email: "global@example.com",
      role: "admin_global",
      plantaId: "nacional",
      profile: {
        uid: "uid-global",
        email: "global@example.com",
        role: "admin_global",
        plantaId: "nacional",
        displayName: "Admin Global",
        active: true,
      },
    };

    const actor = buildKioskApprovalActor(admin, "norte");

    assert.equal(canApproveKioskAlert(admin, "norte"), true);
    assert.equal(canApproveKioskAlert(admin, "sur"), true);
    assert.equal(actor.permissionSource, "global_admin");
    assert.equal(actor.employeeId, null);
    assert.equal(actor.name, "Admin Global");
  });

  it("permite permiso explicito si existe employeeId trazable", () => {
    const admin = session({
      employeeId: "9999999",
      displayName: "Supervisor externo",
      permissions: { canApproveKioskAlerts: true },
    });

    const actor = buildKioskApprovalActor(admin, "sur");
    assert.equal(canApproveKioskAlert(admin, "sur"), true);
    assert.equal(actor.permissionSource, "explicit_permission");
    assert.equal(actor.name, "Supervisor externo");
  });

  it("rechaza permisos de alerta sin employeeId trazable", () => {
    const admin = session({ permissions: { canApproveKioskAlerts: true } });

    assert.equal(canApproveKioskAlert(admin, "norte"), false);
  });

  it("expone la lista configurada por planta", () => {
    assert.deepEqual(kioskAlertApproverIdsForPlant("norte"), [
      "1000001",
      "1000002",
      "1000003",
      "1000004",
    ]);
  });

  it("resuelve aprobador por correo y excluye usuarios no autorizados", () => {
    assert.equal(findKioskAlertApproverByEmail("APROBADOR.UNO@EXAMPLE.COM")?.employeeId, "1000001");
    assert.equal(findKioskAlertApproverByEmail("persona.ajena@example.com"), null);
  });

  it("resuelve aprobador global por correo", () => {
    assert.equal(findGlobalKioskAlertApproverByEmail("ADMIN.GLOBAL@EXAMPLE.COM")?.email, "admin.global@example.com");
    assert.equal(findGlobalKioskAlertApproverByEmail("persona.ajena@example.com"), null);
  });

  it("construye perfil admin local para auto-provisionar aprobadores por correo", () => {
    assert.deepEqual(
      buildProvisionedKioskAlertApproverProfile("uid-1000001", "aprobador.uno@example.com"),
      {
        uid: "uid-1000001",
        email: "aprobador.uno@example.com",
        role: "admin_local",
        plantaId: "norte",
        displayName: "Aprobador Uno",
        employeeId: "1000001",
        permissions: {
          canApproveKioskRequests: true,
          canApproveKioskAlerts: true,
        },
        active: true,
      }
    );
  });

  it("construye perfil admin global para auto-provisionar correo global permitido", () => {
    assert.deepEqual(
      buildProvisionedKioskAlertApproverProfile("uid-global", "admin.global@example.com"),
      {
        uid: "uid-global",
        email: "admin.global@example.com",
        role: "admin_global",
        plantaId: "nacional",
        displayName: "Administrador global",
        permissions: {
          canApproveKioskRequests: true,
          canApproveKioskAlerts: true,
        },
        active: true,
      }
    );
  });

  it("sin configuracion no hay aprobadores por lista (falla cerrado)", () => {
    const previous = process.env.KIOSK_ALERT_APPROVERS;
    try {
      delete process.env.KIOSK_ALERT_APPROVERS;
      assert.equal(findKioskAlertApproverByEmail("aprobador.uno@example.com"), null);
      assert.equal(findGlobalKioskAlertApproverByEmail("admin.global@example.com"), null);
      assert.deepEqual(kioskAlertApproverIdsForPlant("norte"), []);
      assert.equal(canApproveKioskAlert(session({ employeeId: "1000001" }), "norte"), false);
    } finally {
      if (previous === undefined) delete process.env.KIOSK_ALERT_APPROVERS;
      else process.env.KIOSK_ALERT_APPROVERS = previous;
    }
  });

  it("descarta JSON invalido y entradas incompletas", () => {
    const originalError = console.error;
    console.error = () => undefined;
    try {
      assert.deepEqual(parseKioskAlertApproverConfig("{no es json"), { plants: {}, global: [] });
    } finally {
      console.error = originalError;
    }
    const parsed = parseKioskAlertApproverConfig(JSON.stringify({
      plants: { norte: [
        { employeeId: "1", name: "Valido", email: "valido@example.com" },
        { employeeId: "", name: "Sin id", email: "x@example.com" },
        { employeeId: "2", name: "Sin correo", email: "no-es-correo" },
      ] },
      global: [{ name: "", email: "a@example.com" }, { name: "Global", email: "g@example.com" }],
    }));
    assert.deepEqual(parsed.plants.norte?.map((a) => a.employeeId), ["1"]);
    assert.deepEqual(parsed.global.map((a) => a.email), ["g@example.com"]);
  });
});
