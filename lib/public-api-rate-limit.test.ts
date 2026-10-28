import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Firestore } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";
import { requirePublicRateLimit } from "./public-api-rate-limit";

function makeRequest(forwardedFor: string) {
  return { headers: new Headers({ "x-forwarded-for": forwardedFor }) } as unknown as NextRequest;
}

function makeFakeDb() {
  const docIds: string[] = [];
  const db = {
    collection: () => ({
      doc: (id: string) => {
        docIds.push(id);
        return { id };
      },
    }),
    runTransaction: async (fn: (transaction: unknown) => Promise<number>) =>
      fn({
        get: async () => ({ exists: false, data: () => undefined }),
        set: () => undefined,
      }),
  };
  return { db: db as unknown as Firestore, docIds };
}

describe("requirePublicRateLimit", () => {
  it("usa la IP del ultimo salto confiable: falsificar X-Forwarded-For no cambia la cubeta", async () => {
    const { db, docIds } = makeFakeDb();
    await requirePublicRateLimit(db, makeRequest("203.0.113.7"), "portal_employee_lookup");
    await requirePublicRateLimit(db, makeRequest("1.1.1.1, 203.0.113.7"), "portal_employee_lookup");
    await requirePublicRateLimit(db, makeRequest("2.2.2.2, 203.0.113.7, 169.254.1.1"), "portal_employee_lookup");
    assert.equal(new Set(docIds).size, 1);
  });

  it("separa clientes con IP real distinta", async () => {
    const { db, docIds } = makeFakeDb();
    await requirePublicRateLimit(db, makeRequest("1.1.1.1, 203.0.113.7"), "portal_employee_lookup");
    await requirePublicRateLimit(db, makeRequest("1.1.1.1, 203.0.113.8"), "portal_employee_lookup");
    assert.equal(new Set(docIds).size, 2);
  });
});
