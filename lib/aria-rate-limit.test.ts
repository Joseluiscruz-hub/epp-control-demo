import assert from "node:assert/strict";
import test from "node:test";
import { nextRateWindow } from "./aria-rate-limit";

const policy = { maxRequests: 2, windowMs: 1000 };

test("abre ventana nueva y cuenta solicitudes", () => {
  const first = nextRateWindow(undefined, 0, policy);
  assert.deepEqual(first, { allowed: true, retryAfterSeconds: 0, requestCount: 1, windowExpiresAt: 1000 });
  const second = nextRateWindow(first, 100, policy);
  assert.equal(second.allowed, true);
  assert.equal(second.requestCount, 2);
});

test("bloquea al exceder y reabre al expirar", () => {
  const blocked = nextRateWindow({ requestCount: 2, windowExpiresAt: 1000 }, 200, policy);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 1);
  const reopened = nextRateWindow({ requestCount: 2, windowExpiresAt: 1000 }, 1001, policy);
  assert.equal(reopened.allowed, true);
  assert.equal(reopened.requestCount, 1);
});
