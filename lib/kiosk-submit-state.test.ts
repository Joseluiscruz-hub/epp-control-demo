import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getKioskSubmitState } from "./kiosk-submit-state";

describe("boton de envio del kiosko (sin desplazamiento obligatorio)", () => {
  it("se habilita sin desplazarse: solo requiere EPP elegido y motivo", () => {
    const state = getKioskSubmitState({ selectedCount: 1, requestReason: "desgaste", submitting: false });
    assert.equal(state.enabled, true);
  });
  it("mantiene la validacion de EPP elegido", () => {
    assert.equal(getKioskSubmitState({ selectedCount: 0, requestReason: "desgaste", submitting: false }).enabled, false);
  });
  it("mantiene la validacion de motivo", () => {
    const s = getKioskSubmitState({ selectedCount: 2, requestReason: null, submitting: false });
    assert.equal(s.enabled, false);
    assert.match(s.hint, /motivo/);
  });
  it("se deshabilita mientras se envia (evita dobles envios)", () => {
    assert.equal(getKioskSubmitState({ selectedCount: 1, requestReason: "desgaste", submitting: true }).enabled, false);
  });
});
