import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isLocalToolHost, isNetworkFailure, shouldFallbackAfterError, shouldFallbackToLocal } from "./offline-fallback-policy";

const prod = "control-epp.example.com";

describe("politica de respaldo local (offline)", () => {
  it("solo cae a local sin red y con el modo offline activo", () => {
    assert.equal(shouldFallbackToLocal({ offlineModeEnabled: true, online: false, hostname: prod }), true);
  });

  it("no cae a local si hay red aunque el servidor falle (5xx)", () => {
    assert.equal(shouldFallbackToLocal({ offlineModeEnabled: true, online: true, hostname: prod }), false);
  });

  it("no cae a local sin red si el modo offline esta apagado", () => {
    assert.equal(shouldFallbackToLocal({ offlineModeEnabled: false, online: false, hostname: prod }), false);
  });

  it("no cae a local si no se conoce el estado de red", () => {
    assert.equal(shouldFallbackToLocal({ offlineModeEnabled: true, online: undefined, hostname: prod }), false);
  });

  it("la herramienta local en localhost conserva su respaldo", () => {
    assert.equal(isLocalToolHost("localhost"), true);
    assert.equal(isLocalToolHost("127.0.0.1"), true);
    assert.equal(isLocalToolHost(prod), false);
    assert.equal(shouldFallbackToLocal({ offlineModeEnabled: false, online: true, hostname: "localhost" }), true);
  });
});

describe("respaldo local solo ante fallo de red (seguimiento Codex #69)", () => {
  const offline = { offlineModeEnabled: true, online: false, hostname: "control-epp.example.com" };
  const local = { offlineModeEnabled: false, online: true, hostname: "localhost" };
  class HttpErr extends Error { constructor(public status: number) { super("http"); } }

  it("excepcion de fetch (TypeError) + sin red => cae a local", () => {
    assert.equal(isNetworkFailure(new TypeError("Failed to fetch")), true);
    assert.equal(shouldFallbackAfterError(new TypeError("Failed to fetch"), offline), true);
  });
  it("respuesta HTTP (4xx/5xx) nunca cae a local, aunque navigator.onLine sea false o sea localhost", () => {
    for (const status of [400, 409, 500, 503]) {
      assert.equal(shouldFallbackAfterError(new HttpErr(status), offline), false);
      assert.equal(shouldFallbackAfterError(new HttpErr(status), local), false);
    }
  });
  it("sin error o error generico no cae a local", () => {
    assert.equal(shouldFallbackAfterError(undefined, offline), false);
    assert.equal(shouldFallbackAfterError(new Error("x"), offline), false);
  });
  it("fallo de red con red disponible en produccion no cae a local", () => {
    assert.equal(shouldFallbackAfterError(new TypeError("Failed to fetch"), { ...offline, online: true }), false);
  });
});
