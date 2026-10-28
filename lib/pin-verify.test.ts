import assert from "node:assert/strict";
import { describe, it } from "node:test";
import bcrypt from "bcryptjs";
import { comparePin, isBcryptHash, isLegacyPinAllowed } from "./pin-verify";
import { legacyHashPin } from "./pin-utils";

describe("comparePin", () => {
  it("valida PIN contra bcrypt", async () => {
    const hash = await bcrypt.hash("482915", 4);
    assert.equal(isBcryptHash(hash), true);
    assert.equal(await comparePin("482915", hash), true);
    assert.equal(await comparePin("000000", hash), false);
  });

  it("rechaza el hash heredado por defecto", async () => {
    const legacy = legacyHashPin("482915");
    assert.equal(await comparePin("482915", legacy, { allowLegacy: false }), false);
    assert.equal(await comparePin("482915", legacy), false);
  });

  it("acepta el hash heredado solo si se habilita explicitamente", async () => {
    const legacy = legacyHashPin("482915");
    assert.equal(await comparePin("482915", legacy, { allowLegacy: true }), true);
    assert.equal(await comparePin("111111", legacy, { allowLegacy: true }), false);
  });

  it("KIOSK_ALLOW_LEGACY_PIN solo se activa con el valor exacto true", () => {
    assert.equal(isLegacyPinAllowed({ KIOSK_ALLOW_LEGACY_PIN: "true" } as NodeJS.ProcessEnv), true);
    for (const v of [undefined, "", "1", "TRUE", "yes", "false"]) {
      assert.equal(isLegacyPinAllowed({ KIOSK_ALLOW_LEGACY_PIN: v } as NodeJS.ProcessEnv), false);
    }
  });
});
