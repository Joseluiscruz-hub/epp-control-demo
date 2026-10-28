import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import type { NextRequest } from "next/server";
import { installKioskApproversFixture } from "./kiosk-approvers-fixture";

installKioskApproversFixture();

const mockVerifyIdToken = mock.fn();
const mockGet = mock.fn();
const mockSet = mock.fn();

mock.module("./firebase-admin", {
  namedExports: {
    getAdminAuth: () => ({ verifyIdToken: mockVerifyIdToken }),
    getAdminDb: () => ({
      collection: () => ({ doc: () => ({ get: mockGet, set: mockSet }) }),
    }),
  },
});

// Bootstrap config is read at module load, so it must be set before importing.
process.env.ENABLE_BOOTSTRAP_ADMIN = "true";
process.env.BOOTSTRAP_ADMIN_EMAIL = "bootstrap@example.com";

const serverAuthModule = import("./server-auth");

async function getServerAuth() {
  return serverAuthModule;
}

function makeRequest(token?: string): NextRequest {
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  return { headers } as unknown as NextRequest;
}

function makeDecodedToken(overrides: Record<string, unknown> = {}) {
  return { uid: "uid-123", email: "admin@example.com", email_verified: true, name: "Admin Test", ...overrides };
}

function makeProfileSnap(data: Record<string, unknown> | null) {
  return {
    exists: data !== null,
    data: () => data ?? undefined,
  };
}

describe("requireAdminUser", () => {
  it("lanza AuthHttpError 401 si no hay Authorization header", async () => {
    const { AuthHttpError, requireAdminUser } = await getServerAuth();
    await assert.rejects(
      () => requireAdminUser(makeRequest()),
      (error) => error instanceof AuthHttpError && error.status === 401
    );
  });

  it("lanza AuthHttpError 401 si el token es invalido", async () => {
    const { AuthHttpError, requireAdminUser } = await getServerAuth();
    mockVerifyIdToken.mock.mockImplementationOnce(async () => {
      throw new Error("invalid token");
    });

    await assert.rejects(
      () => requireAdminUser(makeRequest("bad-token")),
      (error) => error instanceof AuthHttpError && error.status === 401
    );
  });

  it("lanza AuthHttpError 403 si la cuenta no tiene email", async () => {
    const { AuthHttpError, requireAdminUser } = await getServerAuth();
    mockVerifyIdToken.mock.mockImplementationOnce(async () => makeDecodedToken({ email: undefined }));

    await assert.rejects(
      () => requireAdminUser(makeRequest("valid-token")),
      (error) => error instanceof AuthHttpError && error.status === 403
    );
  });

  it("lanza AuthHttpError 403 si el perfil esta desactivado", async () => {
    const { AuthHttpError, requireAdminUser } = await getServerAuth();
    mockVerifyIdToken.mock.mockImplementationOnce(async () => makeDecodedToken());
    mockGet.mock.mockImplementationOnce(async () =>
      makeProfileSnap({ role: "admin_local", plantaId: "norte", active: false })
    );

    await assert.rejects(
      () => requireAdminUser(makeRequest("valid-token")),
      (error) => error instanceof AuthHttpError && error.status === 403
    );
  });

  it("retorna AdminSession para admin_local con perfil valido", async () => {
    const { requireAdminUser } = await getServerAuth();
    mockVerifyIdToken.mock.mockImplementationOnce(async () => makeDecodedToken());
    mockGet.mock.mockImplementationOnce(async () =>
      makeProfileSnap({ role: "admin_local", plantaId: "norte", active: true })
    );

    const session = await requireAdminUser(makeRequest("valid-token"));
    assert.equal(session.uid, "uid-123");
    assert.equal(session.email, "admin@example.com");
    assert.equal(session.role, "admin_local");
    assert.equal(session.plantaId, "norte");
  });

  it("auto-provisiona aprobador de alerta por correo permitido", async () => {
    const { requireAdminUser } = await getServerAuth();
    mockVerifyIdToken.mock.mockImplementationOnce(async () =>
      makeDecodedToken({
        uid: "uid-julio",
        email: "aprobador.uno@example.com",
        name: "Aprobador Uno",
      })
    );
    mockGet.mock.mockImplementationOnce(async () => makeProfileSnap(null));
    mockSet.mock.mockImplementationOnce(async () => undefined);

    const session = await requireAdminUser(makeRequest("valid-token"));

    assert.equal(session.uid, "uid-julio");
    assert.equal(session.role, "admin_local");
    assert.equal(session.plantaId, "norte");
    assert.equal(session.profile.employeeId, "1000001");
    assert.equal(session.profile.permissions?.canApproveKioskAlerts, true);
    assert.equal(mockSet.mock.callCount(), 1);
  });

  it("auto-provisiona aprobador global por correo permitido", async () => {
    const { requireAdminUser } = await getServerAuth();
    const initialSetCount = mockSet.mock.callCount();

    mockVerifyIdToken.mock.mockImplementationOnce(async () =>
      makeDecodedToken({
        uid: "uid-global-admin",
        email: "admin.global@example.com",
        name: "Admin Global",
      })
    );
    mockGet.mock.mockImplementationOnce(async () => makeProfileSnap(null));
    mockSet.mock.mockImplementationOnce(async () => undefined);

    const session = await requireAdminUser(makeRequest("valid-token"));

    assert.equal(session.uid, "uid-global-admin");
    assert.equal(session.role, "admin_global");
    assert.equal(session.plantaId, "nacional");
    assert.equal(session.profile.permissions?.canApproveKioskAlerts, true);
    assert.equal(mockSet.mock.callCount(), initialSetCount + 1);
  });

  it("repara un perfil legacy incompleto para un correo global permitido", async () => {
    const { requireAdminUser } = await getServerAuth();
    const initialSetCount = mockSet.mock.callCount();

    mockVerifyIdToken.mock.mockImplementationOnce(async () =>
      makeDecodedToken({
        uid: "uid-legacy-global",
        email: "admin.global@example.com",
        name: "Admin Global",
      })
    );
    mockGet.mock.mockImplementationOnce(async () =>
      makeProfileSnap({ email: "admin.global@example.com", isAdmin: true, active: true })
    );
    mockSet.mock.mockImplementationOnce(async () => undefined);

    const session = await requireAdminUser(makeRequest("valid-token"));

    assert.equal(session.role, "admin_global");
    assert.equal(session.plantaId, "nacional");
    assert.equal(mockSet.mock.callCount(), initialSetCount + 1);
    assert.equal(
      (mockSet.mock.calls.at(-1)?.arguments[0] as { source?: string }).source,
      "kiosk_alert_approver_profile_repair"
    );
  });

  it("no auto-provisiona un correo permitido si el email no esta verificado", async () => {
    const { AuthHttpError, requireAdminUser } = await getServerAuth();
    const initialSetCount = mockSet.mock.callCount();

    mockVerifyIdToken.mock.mockImplementationOnce(async () =>
      makeDecodedToken({
        uid: "uid-unverified-allowlist",
        email: "aprobador.uno@example.com",
        email_verified: false,
      })
    );
    mockGet.mock.mockImplementationOnce(async () => makeProfileSnap(null));

    await assert.rejects(
      () => requireAdminUser(makeRequest("valid-token")),
      (error) => error instanceof AuthHttpError && error.status === 403
    );
    assert.equal(mockSet.mock.callCount(), initialSetCount);
  });

  it("no repara un perfil legacy global si el email no esta verificado", async () => {
    const { AuthHttpError, requireAdminUser } = await getServerAuth();
    const initialSetCount = mockSet.mock.callCount();

    mockVerifyIdToken.mock.mockImplementationOnce(async () =>
      makeDecodedToken({
        uid: "uid-unverified-global",
        email: "admin.global@example.com",
        email_verified: false,
      })
    );
    mockGet.mock.mockImplementationOnce(async () =>
      makeProfileSnap({ email: "admin.global@example.com", isAdmin: true, active: true })
    );

    await assert.rejects(
      () => requireAdminUser(makeRequest("valid-token")),
      (error) => error instanceof AuthHttpError && error.status === 403
    );
    assert.equal(mockSet.mock.callCount(), initialSetCount);
  });

  it("concede bootstrap admin solo con email verificado", async () => {
    const { requireAdminUser } = await getServerAuth();
    mockVerifyIdToken.mock.mockImplementationOnce(async () =>
      makeDecodedToken({ uid: "uid-bootstrap", email: "bootstrap@example.com" })
    );
    mockGet.mock.mockImplementationOnce(async () => makeProfileSnap(null));

    const session = await requireAdminUser(makeRequest("valid-token"));
    assert.equal(session.uid, "uid-bootstrap");
    assert.equal(session.role, "admin_global");
  });

  it("rechaza bootstrap admin si el email no esta verificado", async () => {
    const { AuthHttpError, requireAdminUser } = await getServerAuth();
    for (const emailVerified of [false, undefined]) {
      mockVerifyIdToken.mock.mockImplementationOnce(async () =>
        makeDecodedToken({ uid: "uid-bootstrap", email: "bootstrap@example.com", email_verified: emailVerified })
      );
      mockGet.mock.mockImplementationOnce(async () => makeProfileSnap(null));

      await assert.rejects(
        () => requireAdminUser(makeRequest("valid-token")),
        (error) => error instanceof AuthHttpError && error.status === 403
      );
    }
  });

  it("no reactiva un perfil legacy deshabilitado", async () => {
    const { AuthHttpError, requireAdminUser } = await getServerAuth();
    mockVerifyIdToken.mock.mockImplementationOnce(async () =>
      makeDecodedToken({
        uid: "uid-disabled-global",
        email: "admin.global@example.com",
      })
    );
    mockGet.mock.mockImplementationOnce(async () =>
      makeProfileSnap({ email: "admin.global@example.com", isAdmin: true, active: false })
    );

    await assert.rejects(
      () => requireAdminUser(makeRequest("valid-token")),
      (error) => error instanceof AuthHttpError && error.status === 403
    );
  });
});

describe("requireGlobalAdminUser", () => {
  it("lanza 403 si el usuario es admin_local", async () => {
    const { AuthHttpError, requireGlobalAdminUser } = await getServerAuth();
    mockVerifyIdToken.mock.mockImplementationOnce(async () => makeDecodedToken());
    mockGet.mock.mockImplementationOnce(async () =>
      makeProfileSnap({ role: "admin_local", plantaId: "sur", active: true })
    );

    await assert.rejects(
      () => requireGlobalAdminUser(makeRequest("valid-token")),
      (error) => error instanceof AuthHttpError && error.status === 403
    );
  });
});

describe("canAdminUsePlant", () => {
  it("global admin puede usar cualquier planta", async () => {
    const { canAdminUsePlant } = await getServerAuth();
    const globalAdmin = { role: "admin_global", plantaId: "nacional" } as Parameters<typeof canAdminUsePlant>[0];

    assert.equal(canAdminUsePlant(globalAdmin, "sur"), true);
    assert.equal(canAdminUsePlant(globalAdmin, "norte"), true);
    assert.equal(canAdminUsePlant(globalAdmin, null), true);
  });

  it("local admin solo puede usar su planta", async () => {
    const { canAdminUsePlant } = await getServerAuth();
    const localAdmin = { role: "admin_local", plantaId: "norte" } as Parameters<typeof canAdminUsePlant>[0];

    assert.equal(canAdminUsePlant(localAdmin, "norte"), true);
    assert.equal(canAdminUsePlant(localAdmin, "sur"), false);
  });

  it("local admin puede usar plantaId null o undefined", async () => {
    const { canAdminUsePlant } = await getServerAuth();
    const localAdmin = { role: "admin_local", plantaId: "norte" } as Parameters<typeof canAdminUsePlant>[0];

    assert.equal(canAdminUsePlant(localAdmin, null), true);
    assert.equal(canAdminUsePlant(localAdmin, undefined), true);
  });
});
