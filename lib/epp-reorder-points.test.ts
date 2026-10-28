import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getEppReorderPoint,
  hasEppReorderPoint,
  normalizeEppMaterialCode,
} from "./epp-reorder-points";

describe("epp reorder points", () => {
  it("normaliza codigos de material", () => {
    assert.equal(normalizeEppMaterialCode(" 901-49605 "), "90149605");
  });

  it("resuelve el punto de pedido por material", () => {
    assert.equal(getEppReorderPoint("90149605"), 5);
    assert.equal(getEppReorderPoint("90007693"), 30);
    assert.equal(getEppReorderPoint("sin-regla"), undefined);
  });

  it("acepta varios identificadores y usa el primero con regla", () => {
    assert.equal(getEppReorderPoint("SKU-TEMP", "90148269"), 8);
    assert.equal(hasEppReorderPoint("90149541"), true);
    assert.equal(hasEppReorderPoint("SKU-TEMP"), false);
  });
});
