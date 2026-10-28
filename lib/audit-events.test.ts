import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { NextRequest } from "next/server";
import { buildAuditEvent } from "./audit-events";

function makeRequest(forwardedFor: string) {
  const headers = new Headers({ "x-forwarded-for": forwardedFor, "user-agent": "test-agent" });
  return { headers } as unknown as NextRequest;
}

const input = { type: "test.event", targetCollection: "tests", targetId: "1" };
const original = { salt: process.env.AUDIT_IP_SALT, env: process.env.NODE_ENV };

afterEach(() => {
  if (original.salt === undefined) delete process.env.AUDIT_IP_SALT;
  else process.env.AUDIT_IP_SALT = original.salt;
  (process.env as Record<string, string | undefined>).NODE_ENV = original.env;
});

describe("buildAuditEvent ipHash", () => {
  it("omite el hash de IP en produccion si AUDIT_IP_SALT no esta configurado", () => {
    delete process.env.AUDIT_IP_SALT;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const event = buildAuditEvent(input, makeRequest("203.0.113.7"));
    assert.equal(event.ipHash, null);
    assert.equal(event.userAgent, "test-agent");
  });

  it("hashea la IP confiable con AUDIT_IP_SALT en produccion", () => {
    process.env.AUDIT_IP_SALT = "prod-salt";
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const event = buildAuditEvent(input, makeRequest("203.0.113.7"));
    assert.match(String(event.ipHash), /^[0-9a-f]{64}$/);
    // Un valor falsificado a la izquierda no altera el hash.
    const spoofed = buildAuditEvent(input, makeRequest("1.1.1.1, 203.0.113.7"));
    assert.equal(spoofed.ipHash, event.ipHash);
  });

  it("mantiene el hash con fallback fuera de produccion", () => {
    delete process.env.AUDIT_IP_SALT;
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    const event = buildAuditEvent(input, makeRequest("203.0.113.7"));
    assert.match(String(event.ipHash), /^[0-9a-f]{64}$/);
  });
});
