import assert from "node:assert/strict";
import test from "node:test";
import {
  IdempotencyError,
  buildIdempotencyDocId,
  buildRequestFingerprint,
  decideIdempotentOperation,
  isRetryableIdempotentFailure,
  isValidIdempotencyKey,
  newIdempotencyKey,
  resolveIdempotencyKey,
  type IdempotencyRecord,
} from "./idempotency";

const SAMPLE_UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

test("newIdempotencyKey generates valid unique UUIDs", () => {
  const a = newIdempotencyKey();
  const b = newIdempotencyKey();
  assert.equal(isValidIdempotencyKey(a), true);
  assert.notEqual(a, b);
});

test("resolveIdempotencyKey reads body or header and validates", () => {
  assert.equal(resolveIdempotencyKey(undefined, null), null);
  assert.equal(resolveIdempotencyKey(undefined, "  "), null);
  assert.equal(resolveIdempotencyKey(SAMPLE_UUID.toUpperCase(), null), SAMPLE_UUID);
  assert.equal(resolveIdempotencyKey(undefined, SAMPLE_UUID), SAMPLE_UUID);
  assert.equal(resolveIdempotencyKey(SAMPLE_UUID, SAMPLE_UUID.toUpperCase()), SAMPLE_UUID);
  assert.throws(() => resolveIdempotencyKey("abc", null), (e) => e instanceof IdempotencyError && e.status === 400);
  assert.throws(() => resolveIdempotencyKey(42, null), IdempotencyError);
  assert.throws(() => resolveIdempotencyKey(undefined, "abc"), IdempotencyError);
  assert.throws(() => resolveIdempotencyKey(SAMPLE_UUID, "6ba7b810-9dad-11d1-80b4-00c04fd430c8"), IdempotencyError);
});

test("buildIdempotencyDocId is scoped and deterministic", () => {
  assert.equal(buildIdempotencyDocId("assignment.create", SAMPLE_UUID.toUpperCase()), `assignment.create_${SAMPLE_UUID}`);
  assert.notEqual(buildIdempotencyDocId("assignment.create", SAMPLE_UUID), buildIdempotencyDocId("inventory.stock.adjust", SAMPLE_UUID));
  assert.throws(() => buildIdempotencyDocId("assignment.create", "x"), IdempotencyError);
});

test("buildRequestFingerprint ignores key order and undefined values", () => {
  assert.equal(
    buildRequestFingerprint({ itemId: "a", size: "M", qty: 2, extra: undefined }),
    buildRequestFingerprint({ qty: 2, size: "M", itemId: "a" })
  );
  assert.notEqual(buildRequestFingerprint({ qty: 2 }), buildRequestFingerprint({ qty: 3 }));
});

test("decideIdempotentOperation executes once, replays, and rejects misuse", () => {
  const expected = { scope: "assignment.create" as const, actorUid: "admin-1", fingerprint: "f1" };
  assert.deepEqual(decideIdempotentOperation(null, expected), { kind: "execute" });
  const record: IdempotencyRecord<{ stock: number }> = { ...expected, key: SAMPLE_UUID, result: { stock: 4 } };
  assert.deepEqual(decideIdempotentOperation(record, expected), { kind: "replay", result: { stock: 4 } });
  assert.throws(() => decideIdempotentOperation({ ...record, actorUid: "otro" }, expected), (e) => e instanceof IdempotencyError && e.status === 409);
  assert.throws(() => decideIdempotentOperation({ ...record, scope: "inventory.stock.adjust" }, expected), (e) => e instanceof IdempotencyError && e.status === 409);
  assert.throws(() => decideIdempotentOperation({ ...record, fingerprint: "f2" }, expected), (e) => e instanceof IdempotencyError && e.status === 422);
});

test("double submit with the same key takes stock only once (simulated store)", () => {
  const store = { stock: 5, keys: new Map<string, IdempotencyRecord<{ stock: number }>>() };
  const expected = { scope: "assignment.create" as const, actorUid: "admin-1", fingerprint: buildRequestFingerprint({ itemId: "casco", size: "N/A" }) };
  const submit = (key: string) => {
    const docId = buildIdempotencyDocId(expected.scope, key);
    const decision = decideIdempotentOperation(store.keys.get(docId), expected);
    if (decision.kind === "replay") return { duplicated: true, result: decision.result };
    store.stock -= 1;
    const result = { stock: store.stock };
    store.keys.set(docId, { ...expected, key, result });
    return { duplicated: false, result };
  };

  const first = submit(SAMPLE_UUID);
  const second = submit(SAMPLE_UUID);
  assert.equal(store.stock, 4);
  assert.deepEqual(first, { duplicated: false, result: { stock: 4 } });
  assert.deepEqual(second, { duplicated: true, result: { stock: 4 } });

  submit(newIdempotencyKey());
  assert.equal(store.stock, 3, "a new attempt with a new key is a new delivery");
});

test("isRetryableIdempotentFailure retries network errors, 5xx and 408 only", () => {
  assert.equal(isRetryableIdempotentFailure(new TypeError("fetch failed")), true);
  assert.equal(isRetryableIdempotentFailure(new Error("x")), false);
  assert.equal(isRetryableIdempotentFailure(null, 503), true);
  assert.equal(isRetryableIdempotentFailure(null, 408), true);
  assert.equal(isRetryableIdempotentFailure(null, 409), false);
  assert.equal(isRetryableIdempotentFailure(null, 200), false);
});
