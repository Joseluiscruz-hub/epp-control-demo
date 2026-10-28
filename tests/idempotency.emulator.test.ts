// Prueba de integracion contra el emulador de Firestore (se corre dentro de
// `firebase emulators:exec`, que define FIRESTORE_EMULATOR_HOST).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { buildRequestFingerprint, newIdempotencyKey } from "../lib/idempotency";
import { runIdempotentTransaction } from "../lib/idempotency-server";

// Proyecto distinto al de las pruebas de reglas: clearFirestore() de esas pruebas no borra estos datos.
const PROJECT_ID = "demo-control-epp-idempotency";

describe("runIdempotentTransaction (emulador)", { skip: !process.env.FIRESTORE_EMULATOR_HOST }, () => {
  let app: App;
  let db: Firestore;

  before(() => {
    app = initializeApp({ projectId: PROJECT_ID }, `idempotency-${Date.now()}`);
    db = getFirestore(app);
  });

  after(async () => {
    await deleteApp(app);
  });

  async function deliverOne(itemId: string, key: string) {
    const itemRef = db.collection("ppe_catalog").doc(itemId);
    return runIdempotentTransaction(db, {
      scope: "assignment.create",
      key,
      actorUid: "admin-1",
      fingerprint: buildRequestFingerprint({ employeeId: "emp-1", itemId, size: "N/A" }),
    }, async (transaction) => {
      const snap = await transaction.get(itemRef);
      const stock = Number(snap.data()?.stock ?? 0);
      if (stock < 1) throw new Error("sin_stock");
      transaction.update(itemRef, { stock: stock - 1 });
      transaction.set(db.collection("assignments").doc(key), { itemId, employeeId: "emp-1" });
      return { stock: stock - 1 };
    });
  }

  it("un doble envio concurrente con la misma llave descuenta stock una sola vez", async () => {
    const itemId = `casco-${Date.now()}`;
    await db.collection("ppe_catalog").doc(itemId).set({ stock: 5 });
    const key = newIdempotencyKey();

    const outcomes = await Promise.all([deliverOne(itemId, key), deliverOne(itemId, key), deliverOne(itemId, key)]);

    const stock = (await db.collection("ppe_catalog").doc(itemId).get()).data()?.stock;
    assert.equal(stock, 4);
    assert.equal(outcomes.filter((o) => !o.duplicated).length, 1);
    assert.equal(outcomes.filter((o) => o.duplicated).length, 2);
    outcomes.forEach((o) => assert.deepEqual(o.result, { stock: 4 }));
    const assignments = await db.collection("assignments").where("itemId", "==", itemId).get();
    assert.equal(assignments.size, 1);
  });

  it("llaves distintas son entregas distintas", async () => {
    const itemId = `guante-${Date.now()}`;
    await db.collection("ppe_catalog").doc(itemId).set({ stock: 2 });
    await deliverOne(itemId, newIdempotencyKey());
    await deliverOne(itemId, newIdempotencyKey());
    await assert.rejects(deliverOne(itemId, newIdempotencyKey()), /sin_stock/);
    const stock = (await db.collection("ppe_catalog").doc(itemId).get()).data()?.stock;
    assert.equal(stock, 0);
  });
});
