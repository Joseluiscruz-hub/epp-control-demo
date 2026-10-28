import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AuthHttpError, type AdminSession } from "@/lib/server-auth";
import { buildPlantScopedInventoryId, resolveWritePlant } from "./_lib";

const globalAdmin = { uid: "g", email: "g@x", role: "admin_global", plantaId: "nacional" } as unknown as AdminSession;
const localAdmin = { uid: "l", email: "l@x", role: "admin_local", plantaId: "sur" } as unknown as AdminSession;

describe("planta de escritura en inventario", () => {
  it("admin local siempre escribe en su planta", () => {
    assert.equal(resolveWritePlant(localAdmin, "norte"), "sur");
  });

  it("admin global con planta valida", () => {
    assert.equal(resolveWritePlant(globalAdmin, "norte"), "norte");
  });

  it("admin global con planta invalida o faltante => 409", () => {
    for (const value of ["planta-desconocida", undefined, "nacional"]) {
      assert.throws(() => resolveWritePlant(globalAdmin, value), (e) => e instanceof AuthHttpError && e.status === 409);
    }
  });

  it("no construye ids de inventario para plantas desconocidas", () => {
    assert.equal(buildPlantScopedInventoryId("sur", "abc"), "sur__abc");
    assert.throws(() => buildPlantScopedInventoryId("planta-desconocida", "abc"), (e) => e instanceof AuthHttpError && e.status === 409);
  });
});
