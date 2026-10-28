import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InvalidPlantError, normalizePlantId, requireKnownPlantId, plantMatches, resolveRecordPlantId } from "./plants";

describe("requireKnownPlantId (caminos de escritura)", () => {
  it("acepta plantas conocidas y sus alias", () => {
    assert.equal(requireKnownPlantId("sur"), "sur");
    assert.equal(requireKnownPlantId("norte"), "norte");
    assert.equal(requireKnownPlantId("Planta Sur"), "sur");
    assert.equal(requireKnownPlantId("NTE"), "norte");
  });

  it("rechaza con 409 una planta desconocida en vez de caer a norte", () => {
    for (const value of ["planta-desconocida", "", "  ", null, undefined, 42, "nacional", "todas"]) {
      assert.throws(
        () => requireKnownPlantId(value, "material"),
        (error) => error instanceof InvalidPlantError && error.status === 409 && /material/.test(error.message),
        `debio rechazar ${String(value)}`
      );
    }
  });

  it("documenta el comportamiento anterior que se reemplaza", () => {
    assert.equal(normalizePlantId("planta-desconocida"), "norte");
  });
});

describe("resolveRecordPlantId (seguimiento Codex #69)", () => {
  it("no hereda planta: colaborador o material sin plantaId => 409", () => {
    assert.throws(() => resolveRecordPlantId({}, "colaborador"), (e: unknown) => e instanceof InvalidPlantError && e.status === 409);
    assert.throws(() => resolveRecordPlantId({ plantaId: undefined }, "material"), InvalidPlantError);
    assert.throws(() => resolveRecordPlantId(undefined, "material"), InvalidPlantError);
    assert.throws(() => resolveRecordPlantId({ plantaId: "" }, "material"), InvalidPlantError);
  });
  it("acepta la planta propia del registro, con alias", () => {
    assert.equal(resolveRecordPlantId({ plantaId: "sur" }, "material"), "sur");
    assert.equal(resolveRecordPlantId({ plantaId: "Planta Sur" }, "colaborador"), "sur");
  });
});

describe("sesion de kiosko: parseo con alias igual que /api/kiosk/requests", () => {
  it("'Planta Sur' se emite como sur (normalizePlantId la mandaba a norte)", () => {
    assert.equal(requireKnownPlantId("Planta Sur", "colaborador de kiosko"), "sur");
    assert.notEqual(normalizePlantId("Planta Sur"), "sur");
  });
  it("planta desconocida o ausente => error claro 409", () => {
    assert.throws(() => requireKnownPlantId("Marte", "colaborador de kiosko"), /Planta invalida/);
    assert.throws(() => requireKnownPlantId(undefined, "colaborador de kiosko"), InvalidPlantError);
  });
});

describe("plantMatches (comparacion sesion vs planta guardada)", () => {
  it("compara por planta canonica con alias", () => {
    assert.equal(plantMatches("Planta Sur", "sur"), true);
    assert.equal(plantMatches("sur", "sur"), true);
    assert.equal(plantMatches("Planta Sur", "norte"), false);
  });
  it("falla cerrado ante planta ausente o desconocida", () => {
    assert.equal(plantMatches(undefined, "sur"), false);
    assert.equal(plantMatches("", "sur"), false);
    assert.equal(plantMatches("Marte", "Marte"), false);
    assert.equal(plantMatches("sur", undefined), false);
  });
});
