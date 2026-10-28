import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getIpHashSalt, getTrustedClientIp, isInternalIp, isIpHashSaltConfigured } from "./request-ip";

function headers(values: Record<string, string>) {
  const result = new Headers();
  Object.entries(values).forEach(([key, value]) => result.set(key, value));
  return result;
}

describe("getTrustedClientIp", () => {
  it("usa el ultimo salto (agregado por Cloud Run) e ignora valores falsificados a la izquierda", () => {
    assert.equal(getTrustedClientIp(headers({ "x-forwarded-for": "1.2.3.4, 203.0.113.7" })), "203.0.113.7");
    assert.equal(getTrustedClientIp(headers({ "x-forwarded-for": "9.9.9.9,8.8.8.8, 203.0.113.7" })), "203.0.113.7");
  });

  it("omite saltos internos o link-local agregados por la infraestructura", () => {
    assert.equal(
      getTrustedClientIp(headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.7, 169.254.1.1" })),
      "203.0.113.7"
    );
    assert.equal(getTrustedClientIp(headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.5" })), "203.0.113.7");
  });

  it("respeta saltos de proxy confiables adicionales", () => {
    const value = headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.7, 34.120.0.1" });
    assert.equal(getTrustedClientIp(value, 2), "203.0.113.7");
    assert.equal(getTrustedClientIp(value, 1), "34.120.0.1");
  });

  it("usa TRUSTED_PROXY_HOPS cuando se configura", () => {
    const previous = process.env.TRUSTED_PROXY_HOPS;
    process.env.TRUSTED_PROXY_HOPS = "2";
    try {
      assert.equal(
        getTrustedClientIp(headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.7, 34.120.0.1" })),
        "203.0.113.7"
      );
    } finally {
      if (previous === undefined) delete process.env.TRUSTED_PROXY_HOPS;
      else process.env.TRUSTED_PROXY_HOPS = previous;
    }
  });

  it("normaliza puertos e IPv6 y descarta basura", () => {
    assert.equal(getTrustedClientIp(headers({ "x-forwarded-for": "evil, 203.0.113.7:4431" })), "203.0.113.7");
    assert.equal(getTrustedClientIp(headers({ "x-forwarded-for": "[2001:DB8::1]:443" })), "2001:db8::1");
    assert.equal(getTrustedClientIp(headers({ "x-forwarded-for": "not-an-ip" })), "unknown");
  });

  it("usa x-real-ip solo sin X-Forwarded-For y devuelve unknown si no hay datos", () => {
    assert.equal(getTrustedClientIp(headers({ "x-real-ip": "198.51.100.2" })), "198.51.100.2");
    assert.equal(getTrustedClientIp(headers({})), "unknown");
  });

  it("si todos los saltos son internos usa el mas cercano", () => {
    assert.equal(getTrustedClientIp(headers({ "x-forwarded-for": "10.0.0.1, 192.168.0.4" })), "192.168.0.4");
  });
});

describe("isInternalIp", () => {
  it("detecta rangos privados, loopback y link-local", () => {
    for (const ip of ["10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "127.0.0.1", "169.254.1.1", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      assert.equal(isInternalIp(ip), true, ip);
    }
    for (const ip of ["203.0.113.7", "172.32.0.1", "8.8.8.8", "2001:db8::1"]) {
      assert.equal(isInternalIp(ip), false, ip);
    }
  });
});

describe("getIpHashSalt", () => {
  const original = { salt: process.env.AUDIT_IP_SALT, env: process.env.NODE_ENV, project: process.env.GOOGLE_CLOUD_PROJECT };

  afterEach(() => {
    if (original.salt === undefined) delete process.env.AUDIT_IP_SALT;
    else process.env.AUDIT_IP_SALT = original.salt;
    (process.env as Record<string, string | undefined>).NODE_ENV = original.env;
    if (original.project === undefined) delete process.env.GOOGLE_CLOUD_PROJECT;
    else process.env.GOOGLE_CLOUD_PROJECT = original.project;
  });

  it("usa AUDIT_IP_SALT cuando esta configurado", () => {
    process.env.AUDIT_IP_SALT = "  secret-salt  ";
    assert.equal(getIpHashSalt("fallback"), "secret-salt");
    assert.equal(isIpHashSaltConfigured(), true);
  });

  it("usa un fallback estable fuera de produccion", () => {
    delete process.env.AUDIT_IP_SALT;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    assert.equal(getIpHashSalt("fallback"), "fallback");
    assert.equal(isIpHashSaltConfigured(), false);
  });
});
