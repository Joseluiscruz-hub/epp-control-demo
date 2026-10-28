import assert from "node:assert/strict";
import test from "node:test";
import {
  KioskRequestError,
  assertUniqueRequestItems,
  decideApprovedRequestResolution,
  isValidRequestItemShape,
  normalizeFulfillableItems,
  buildKioskPendingIndexId,
  buildKioskRequestDocId,
  isBlockingPendingIndex,
  isValidClientRequestId,
  resolveClientRequestId,
} from "./kiosk-request-domain";

const validItem = {
  itemId: "casco-msa",
  itemName: "Casco MSA",
  sku: "M2303541AR",
  size: "N/A",
  replacementDays: 365,
};

test("accepts the strict public request item shape", () => {
  assert.equal(isValidRequestItemShape({ itemId: "casco-msa", size: "N/A" }), true);
  assert.equal(
    isValidRequestItemShape({ itemId: "casco-msa", unexpected: true }),
    false
  );
});

test("rejects duplicate item and size combinations", () => {
  assert.throws(
    () => assertUniqueRequestItems([
      { itemId: "guante", size: "M" },
      { itemId: "guante", size: "M" },
    ]),
    (error: unknown) => (
      error instanceof KioskRequestError &&
      error.status === 400 &&
      /mismo EPP y talla/.test(error.message)
    )
  );
});

test("allows the same item with different sizes", () => {
  assert.doesNotThrow(() => assertUniqueRequestItems([
    { itemId: "guante", size: "M" },
    { itemId: "guante", size: "L" },
  ]));
});

test("rejects the whole stored request when one item is malformed", () => {
  assert.throws(
    () => normalizeFulfillableItems([
      validItem,
      { itemId: "lentes", itemName: "", sku: "LENTES", replacementDays: 180 },
    ]),
    (error: unknown) => error instanceof KioskRequestError && error.status === 409
  );
});

test("rejects duplicated stored items before stock is mutated", () => {
  assert.throws(
    () => normalizeFulfillableItems([validItem, { ...validItem }]),
    (error: unknown) => error instanceof KioskRequestError && error.status === 409
  );
});

test("normalizes trusted fulfillment fields without dropping the request", () => {
  const [item] = normalizeFulfillableItems([{
    ...validItem,
    replacementReason: "extravio",
    chargeAmount: 125.5,
    signatureDataUrl: "data:image/png;base64,AAAA",
    durationRuleSapMaterial: null,
  }]);

  assert.equal(item.replacementReason, "extravio");
  assert.equal(item.chargeAmount, 125.5);
  assert.equal(item.signatureDataUrl, "data:image/png;base64,AAAA");
  assert.equal(item.durationRuleSapMaterial, null);
});

test("reuses existing assignments on an idempotent approval retry", () => {
  assert.deepEqual(
    decideApprovedRequestResolution({
      currentStatus: "approved",
      existingAssignmentIds: ["assignment-1"],
      approvedWithAlert: false,
      canApproveAlert: true,
    }),
    { kind: "already_fulfilled", assignmentIds: ["assignment-1"] }
  );
});

test("does not resurrect a rejected request even if it has assignment ids", () => {
  assert.throws(
    () => decideApprovedRequestResolution({
      currentStatus: "rejected",
      existingAssignmentIds: ["assignment-1"],
      approvedWithAlert: false,
      canApproveAlert: true,
    }),
    (error: unknown) => error instanceof KioskRequestError && error.status === 409
  );
});

test("requires alert approval permission before an idempotent retry", () => {
  assert.throws(
    () => decideApprovedRequestResolution({
      currentStatus: "approved",
      existingAssignmentIds: ["assignment-1"],
      approvedWithAlert: true,
      canApproveAlert: false,
    }),
    (error: unknown) => error instanceof KioskRequestError && error.status === 403
  );
});

test("buildKioskRequestDocId is deterministic and safe for Firestore", () => {
  const id = "3F2504E0-4F89-41D3-9A0C-0305E82C3301";
  assert.equal(buildKioskRequestDocId("emp-1", id), "emp-1_3f2504e0-4f89-41d3-9a0c-0305e82c3301");
  assert.equal(buildKioskRequestDocId("emp-1", id), buildKioskRequestDocId("emp-1", id.toLowerCase()));
  assert.notEqual(buildKioskRequestDocId("emp-1", id), buildKioskRequestDocId("emp-2", id));
  assert.equal(buildKioskRequestDocId("a/b", id).includes("/"), false);
  assert.throws(() => buildKioskRequestDocId("emp-1", "no-es-uuid"), (e) => e instanceof KioskRequestError && e.status === 400);
  assert.throws(() => buildKioskRequestDocId("  ", id), KioskRequestError);
});

test("buildKioskPendingIndexId normalizes size and escapes separators", () => {
  assert.equal(buildKioskPendingIndexId("emp-1", "casco", undefined), "emp-1_casco_N%2FA");
  assert.equal(buildKioskPendingIndexId("emp-1", "casco", ""), buildKioskPendingIndexId("emp-1", "casco", "N/A"));
  assert.notEqual(buildKioskPendingIndexId("emp-1", "guante", "8"), buildKioskPendingIndexId("emp-1", "guante", "9"));
  assert.equal(buildKioskPendingIndexId("emp-1", "bota", "26/27").includes("/"), false);
  assert.equal(buildKioskPendingIndexId("emp", "..", "N/A").startsWith("emp_%2E%2E_"), true);
});

test("resolveClientRequestId accepts body or header, rejects bad or mismatched values", () => {
  const id = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
  assert.equal(resolveClientRequestId(undefined, null), null);
  assert.equal(resolveClientRequestId(id, null), id);
  assert.equal(resolveClientRequestId(undefined, id.toUpperCase()), id);
  assert.equal(resolveClientRequestId(id, id.toUpperCase()), id);
  assert.throws(() => resolveClientRequestId("abc", null), KioskRequestError);
  assert.throws(() => resolveClientRequestId(123, null), KioskRequestError);
  assert.throws(() => resolveClientRequestId(undefined, "abc"), KioskRequestError);
  assert.throws(() => resolveClientRequestId(id, "6ba7b810-9dad-11d1-80b4-00c04fd430c8"), KioskRequestError);
  assert.equal(isValidClientRequestId(id), true);
});

test("isBlockingPendingIndex only blocks other pending requests", () => {
  assert.equal(isBlockingPendingIndex({ indexRequestId: "r1", currentRequestId: "r2", referencedRequestStatus: "pending" }), true);
  assert.equal(isBlockingPendingIndex({ indexRequestId: "r1", currentRequestId: "r1", referencedRequestStatus: "pending" }), false);
  assert.equal(isBlockingPendingIndex({ indexRequestId: "r1", currentRequestId: "r2", referencedRequestStatus: "approved" }), false);
  assert.equal(isBlockingPendingIndex({ indexRequestId: "r1", currentRequestId: "r2", referencedRequestStatus: undefined }), false);
  assert.equal(isBlockingPendingIndex({ indexRequestId: "", currentRequestId: "r2", referencedRequestStatus: "pending" }), false);
});
