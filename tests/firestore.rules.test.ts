import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

const PROJECT_ID = "demo-control-epp-rules";

let testEnv: RulesTestEnvironment;

const globalAdminProfile = {
  uid: "global-admin",
  email: "global-admin@example.invalid",
  role: "admin_global",
  plantaId: "nacional",
  active: true,
};

const localAdminProfile = {
  uid: "local-cua",
  email: "local-cua@example.invalid",
  role: "admin_local",
  plantaId: "norte",
  active: true,
};

async function seedRulesFixtures() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, "users", globalAdminProfile.uid), globalAdminProfile),
      setDoc(doc(db, "users", localAdminProfile.uid), localAdminProfile),
      setDoc(doc(db, "users", "ordinary-user"), {
        uid: "ordinary-user",
        email: "ordinary@example.invalid",
        role: "employee",
        plantaId: "norte",
        active: true,
      }),
      setDoc(doc(db, "employees", "employee-cua"), {
        id: "employee-cua",
        name: "Empleado Norte",
        area: "Demo",
        active: true,
        plantaId: "norte",
      }),
      setDoc(doc(db, "employees", "employee-sur"), {
        id: "employee-sur",
        name: "Empleado Sur",
        area: "Demo",
        active: true,
        plantaId: "sur",
      }),
      setDoc(doc(db, "ppe_catalog", "item-cua"), {
        name: "Casco Norte",
        plantaId: "norte",
        stock: 10,
      }),
      setDoc(doc(db, "ppe_catalog", "item-sur"), {
        name: "Casco Sur",
        plantaId: "sur",
        stock: 10,
      }),
      setDoc(doc(db, "kiosk_catalog", "public-cua"), {
        name: "Casco Demo",
        category: "Cascos",
        available: true,
        plantaId: "norte",
      }),
      setDoc(doc(db, "audit_events", "event-1"), {
        eventType: "DEMO_EVENT",
        plantaId: "norte",
      }),
    ]);
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: await readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedRulesFixtures();
});

after(async () => {
  await testEnv.cleanup();
});

describe("Firestore deny-by-default", () => {
  it("deniega empleados y catalogo privado a clientes anonimos", async () => {
    const db = testEnv.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(db, "employees", "employee-cua")));
    await assertFails(getDoc(doc(db, "ppe_catalog", "item-cua")));
  });

  it("deniega colecciones privadas a un usuario sin rol administrativo", async () => {
    const db = testEnv.authenticatedContext("ordinary-user").firestore();

    await assertFails(getDoc(doc(db, "employees", "employee-cua")));
    await assertFails(getDoc(doc(db, "inventory_movements", "movement-1")));
  });

  it("permite al administrador local leer solo su planta", async () => {
    const db = testEnv.authenticatedContext(localAdminProfile.uid).firestore();

    await assertSucceeds(getDoc(doc(db, "employees", "employee-cua")));
    await assertFails(getDoc(doc(db, "employees", "employee-sur")));
    await assertSucceeds(getDoc(doc(db, "ppe_catalog", "item-cua")));
    await assertFails(getDoc(doc(db, "ppe_catalog", "item-sur")));
  });

  it("exige que las consultas del administrador local esten acotadas por planta", async () => {
    const db = testEnv.authenticatedContext(localAdminProfile.uid).firestore();

    const ownPlant = query(collection(db, "employees"), where("plantaId", "==", "norte"));
    const allPlants = collection(db, "employees");

    const ownSnapshot = await assertSucceeds(getDocs(ownPlant));
    assert.equal(ownSnapshot.size, 1);
    await assertFails(getDocs(allPlants));
  });

  it("permite al administrador global consultar todas las plantas", async () => {
    const db = testEnv.authenticatedContext(globalAdminProfile.uid).firestore();

    const snapshot = await assertSucceeds(getDocs(collection(db, "employees")));
    assert.equal(snapshot.size, 2);
  });

  it("impide autoescalacion de rol", async () => {
    const ordinaryDb = testEnv.authenticatedContext("ordinary-user").firestore();
    const localAdminDb = testEnv.authenticatedContext(localAdminProfile.uid).firestore();

    await assertFails(updateDoc(doc(ordinaryDb, "users", "ordinary-user"), { role: "admin_global" }));
    await assertFails(updateDoc(doc(localAdminDb, "users", localAdminProfile.uid), { role: "admin_global" }));
  });

  it("impide escrituras directas de movimientos incluso al administrador global", async () => {
    const db = testEnv.authenticatedContext(globalAdminProfile.uid).firestore();

    await assertFails(setDoc(doc(db, "inventory_movements", "movement-1"), {
      itemId: "item-cua",
      plantaId: "norte",
      delta: -1,
    }));
  });

  it("permite al backend escribir sin reglas y conserva el bloqueo del cliente", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await assertSucceeds(setDoc(doc(context.firestore(), "inventory_movements", "server-movement"), {
        itemId: "item-cua",
        plantaId: "norte",
        delta: -1,
      }));
    });

    const clientDb = testEnv.authenticatedContext(globalAdminProfile.uid).firestore();
    const snapshot = await assertSucceeds(getDoc(doc(clientDb, "inventory_movements", "server-movement")));
    assert.equal(snapshot.exists(), true);
    await assertFails(updateDoc(doc(clientDb, "inventory_movements", "server-movement"), { delta: -2 }));
  });

  it("bloquea el acceso directo al catalogo de kiosko", async () => {
    const db = testEnv.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(db, "kiosk_catalog", "public-cua")));
    await assertFails(updateDoc(doc(db, "kiosk_catalog", "public-cua"), { available: false }));
  });

  it("impide que un administrador local sobrescriba empleados de otra planta", async () => {
    const db = testEnv.authenticatedContext(localAdminProfile.uid).firestore();
    const now = Timestamp.now();
    // Documento completo y valido segun el esquema anterior: antes de este cambio
    // la regla solo validaba request.resource y permitia "re-homing" a la planta propia.
    const hijackedEmployee = {
      id: "employee-sur",
      name: "Sobrescrito",
      area: "Demo",
      active: false,
      plantaId: "norte",
      createdAt: now,
      updatedAt: now,
      firstLogin: null,
      termsAccepted: null,
      termsAcceptedAt: null,
      credentialResetAt: null,
      credentialResetByUid: null,
      credentialResetByEmail: null,
      credentialVersion: null,
      division: null,
      personnelArea: null,
      plantArea: null,
      costCenter: null,
      positionId: null,
      position: null,
      jobFunction: null,
      hireDate: null,
      sex: null,
      source: null,
      rfc: null,
      imss: null,
      curp: null,
      schemaVersion: null,
    };

    await assertFails(getDoc(doc(db, "employees", "employee-sur")));
    await assertFails(setDoc(doc(db, "employees", "employee-sur"), hijackedEmployee));
    await assertFails(setDoc(doc(db, "kiosk_employees", "employee-sur"), {
      name: "Sobrescrito",
      active: false,
      updatedAt: now,
      plantaId: "norte",
    }));
  });

  it("bloquea escrituras directas de cliente en colecciones administradas por la API", async () => {
    const globalDb = testEnv.authenticatedContext(globalAdminProfile.uid).firestore();
    const localDb = testEnv.authenticatedContext(localAdminProfile.uid).firestore();
    const now = Timestamp.now();

    await assertFails(updateDoc(doc(localDb, "employees", "employee-cua"), { active: false, updatedAt: now }));
    await assertFails(updateDoc(doc(globalDb, "employees", "employee-cua"), { active: false, updatedAt: now }));
    await assertFails(setDoc(doc(globalDb, "kiosk_employees", "employee-cua"), {
      name: "Empleado Norte",
      active: true,
      updatedAt: now,
      plantaId: "norte",
    }));
    await assertFails(setDoc(doc(globalDb, "users", "new-admin"), {
      uid: "new-admin",
      email: "new-admin@example.invalid",
      role: "admin_local",
      plantaId: "sur",
      active: true,
    }));
    await assertFails(setDoc(doc(globalDb, "budget_goals", "norte-2026"), {
      plantaId: "norte",
      year: 2026,
      annualLimit: 1000,
      alertThresholds: [80],
      currency: "MXN",
      updatedAt: now,
      updatedBy: globalAdminProfile.uid,
    }));
  });

  it("restringe la auditoria al administrador global", async () => {
    const globalDb = testEnv.authenticatedContext(globalAdminProfile.uid).firestore();
    const localDb = testEnv.authenticatedContext(localAdminProfile.uid).firestore();

    await assertSucceeds(getDoc(doc(globalDb, "audit_events", "event-1")));
    await assertFails(getDoc(doc(localDb, "audit_events", "event-1")));
  });

  it("bloquea las llaves de idempotencia para cualquier cliente", async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    const globalDb = testEnv.authenticatedContext(globalAdminProfile.uid).firestore();
    const keyId = "assignment.create_3f2504e0-4f89-41d3-9a0c-0305e82c3301";

    await assertFails(getDoc(doc(anonDb, "idempotency_keys", keyId)));
    await assertFails(getDoc(doc(globalDb, "idempotency_keys", keyId)));
    await assertFails(setDoc(doc(globalDb, "idempotency_keys", keyId), { result: { stock: 99 } }));
    await assertFails(getDocs(collection(globalDb, "idempotency_keys")));
  });

  it("bloquea el indice de solicitudes pendientes de kiosko para cualquier cliente", async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    const globalDb = testEnv.authenticatedContext(globalAdminProfile.uid).firestore();
    const indexId = "employee-cua_item-cua_N%2FA";

    await assertFails(getDoc(doc(anonDb, "kiosk_pending_index", indexId)));
    await assertFails(getDoc(doc(globalDb, "kiosk_pending_index", indexId)));
    await assertFails(setDoc(doc(globalDb, "kiosk_pending_index", indexId), { requestId: "fake" }));
    await assertFails(getDocs(collection(globalDb, "kiosk_pending_index")));
  });
  it("niega escrituras de cliente en ARIA y reglas de negocio", async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    const globalDb = testEnv.authenticatedContext(globalAdminProfile.uid).firestore();

    await assertFails(setDoc(doc(globalDb, "aria_queries", "q1"), { acceptedByUser: true }));
    await assertFails(getDoc(doc(anonDb, "aria_queries", "q1")));
    await assertFails(getDoc(doc(globalDb, "aria_rate_limits", "user_x")));
    await assertFails(setDoc(doc(globalDb, "aria_rate_limits", "user_x"), { requestCount: 0 }));
    await assertFails(setDoc(doc(globalDb, "business_rules", "current"), { version: "hack" }));
    await assertFails(setDoc(doc(globalDb, "business_rules_versions", "v999"), { durationRules: [] }));
    await assertFails(getDoc(doc(anonDb, "business_rules", "current")));
  });
});
