import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectInventoryImportDocumentId } from "./inventory-document-id";

describe("selectInventoryImportDocumentId", () => {
  it("prefiere el documento scoped cuando ya existe", () => {
    assert.equal(
      selectInventoryImportDocumentId({
        baseId: "epp-guante",
        scopedId: "norte__epp-guante",
        plantaId: "norte",
        baseDocument: { exists: true, plantaId: "norte" },
        scopedDocument: { exists: true, plantaId: "norte" },
      }),
      "norte__epp-guante"
    );
  });

  it("reutiliza documentos legacy de la misma planta", () => {
    assert.equal(
      selectInventoryImportDocumentId({
        baseId: "epp-guante",
        scopedId: "norte__epp-guante",
        plantaId: "norte",
        baseDocument: { exists: true, plantaId: "norte" },
      }),
      "epp-guante"
    );
  });

  it("reutiliza documentos legacy sin planta para completar la migracion", () => {
    assert.equal(
      selectInventoryImportDocumentId({
        baseId: "epp-guante",
        scopedId: "norte__epp-guante",
        plantaId: "norte",
        baseDocument: { exists: true },
      }),
      "epp-guante"
    );
  });

  it("crea documento scoped cuando el legacy pertenece a otra planta", () => {
    assert.equal(
      selectInventoryImportDocumentId({
        baseId: "epp-guante",
        scopedId: "sur__epp-guante",
        plantaId: "sur",
        baseDocument: { exists: true, plantaId: "norte" },
      }),
      "sur__epp-guante"
    );
  });
});
