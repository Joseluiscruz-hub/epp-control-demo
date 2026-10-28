import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSolpedCsv,
  buildSolpedFilename,
  buildSolpedFolio,
  buildSolpedRows,
} from "./solped-export";

const generatedAt = new Date(2026, 5, 18, 13, 45);

describe("solped export", () => {
  it("construye folio y nombre de archivo deterministico", () => {
    assert.equal(
      buildSolpedFolio({ plantName: "Norte", generatedAt }),
      "SOLPED-NORTE-20260618-1345"
    );
    assert.equal(
      buildSolpedFilename({ plantName: "Norte", generatedAt }),
      "SOLPED-NORTE-20260618-1345.csv"
    );
  });

  it("calcula filas con cantidad sugerida y motivo", () => {
    const rows = buildSolpedRows([
      {
        itemName: "Guante anticorte",
        sku: "90149605",
        material: "90149605",
        stock: 2,
        reorderPoint: 5,
        shortage: 3,
      },
      {
        itemName: "Lente seguridad",
        sku: "32007822",
        material: "32007822",
        size: "M",
        stock: 0,
        reorderPoint: 3,
        shortage: 3,
      },
    ], { plantName: "Norte", generatedAt });

    assert.equal(rows[0]?.suggestedQuantity, 5);
    assert.equal(rows[0]?.reason, "Punto de pedido alcanzado");
    assert.equal(rows[1]?.size, "M");
    assert.equal(rows[1]?.reason, "Agotado total");
  });

  it("genera csv con encabezados para SAP/compras", () => {
    const csv = buildSolpedCsv([
      {
        itemName: "Guante anticorte",
        sku: "90149605",
        material: "90149605",
        stock: 5,
        reorderPoint: 5,
        shortage: 0,
      },
    ], { plantName: "Norte", generatedAt, generatedBy: "Admin" });

    assert.match(csv, /"Material SAP";"Descripcion";"SKU tecnico"/);
    assert.match(csv, /"Admin";"90149605";"Guante anticorte"/);
    assert.match(csv, /"5";"5";"0";"5"/);
  });
});
