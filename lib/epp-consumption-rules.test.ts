import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  EPP_CONSUMPTION_RULES,
  findEppConsumptionRule,
  resolveAssignmentReportConsumption,
  resolveEppConsumption,
} from "./epp-consumption-rules";
import { resolveInventoryStockDecrease, resolveStockFromPackageRule } from "./epp-package-rules";

describe("EPP consumption rules", () => {
  test("contains the 24 configured SAP materials", () => {
    assert.equal(EPP_CONSUMPTION_RULES.length, 24);
    assert.deepEqual(
      EPP_CONSUMPTION_RULES.map((rule) => rule.sapMaterial),
      [
        "90016863", "90016866", "90016869", "90016867", "90149605",
        "90149607", "90149608", "90016897", "90149610", "90149609",
        "90149611", "90149578", "90149580", "90149552", "90149553",
        "90149554", "90149555", "90016860", "90016859", "90016827",
        "90008560", "90008561", "90016951", "90016950",
      ]
    );
  });

  test("resolves the exact decimal decrease per issued piece", () => {
    assert.equal(resolveEppConsumption({ material: "90016866" }).quantity, 0.04);
    assert.equal(resolveEppConsumption({ material: "90149610" }).quantity, 0.08);
    assert.equal(resolveEppConsumption({ material: "90149578" }).quantity, 0.01);
    assert.equal(resolveEppConsumption({ material: "90016951" }).quantity, 0.08);
    assert.equal(resolveEppConsumption({ material: "90016950" }).quantity, 0.1);
  });

  test("applies the package factor configured for all requested coveralls", () => {
    const expectedRules = new Map([
      ["90016863", [25, 0.04]],
      ["90016869", [25, 0.04]],
      ["90016866", [25, 0.04]],
      ["90016867", [12, 0.08]],
      ["90149605", [25, 0.04]],
      ["90149607", [25, 0.04]],
      ["90149608", [25, 0.04]],
    ]);

    for (const [material, [unitsPerPackage, unitDecrease]] of expectedRules) {
      const rule = findEppConsumptionRule({ material });
      assert.equal(rule?.unitsPerPackage, unitsPerPackage);
      assert.equal(rule?.unitDecrease, unitDecrease);
    }
  });

  test("applies the configured package factors for Condor coats", () => {
    const medium = findEppConsumptionRule({ sku: "SEGURID068" });
    assert.equal(medium?.sapMaterial, "90016951");
    assert.equal(medium?.unitsPerPackage, 12);
    assert.equal(medium?.unitDecrease, 0.08);

    const large = findEppConsumptionRule({ sku: "segurid-069" });
    assert.equal(large?.sapMaterial, "90016950");
    assert.equal(large?.unitsPerPackage, 10);
    assert.equal(large?.unitDecrease, 0.1);
  });

  test("multiplies the unit decrease by the physical quantity issued", () => {
    assert.equal(resolveEppConsumption({ sku: "1YEM2", issuedQuantity: 2 }).quantity, 0.02);
    assert.equal(resolveEppConsumption({ material: "90149552", issuedQuantity: 3 }).quantity, 0.24);
  });

  test("matches known supplier aliases without using material names", () => {
    assert.equal(findEppConsumptionRule({ sku: "3ppm1" })?.sapMaterial, "90149611");
    assert.equal(findEppConsumptionRule({ sku: "2-LEM-0" })?.sapMaterial, "90149552");
    assert.equal(findEppConsumptionRule({ sku: "62xj76" })?.sapMaterial, "90008560");
    assert.equal(findEppConsumptionRule({ sku: "62-XJ-77" })?.sapMaterial, "90008561");
  });

  test("matches the supplier aliases added for Tyvek coveralls", () => {
    assert.equal(findEppConsumptionRule({ sku: "2kpm0" })?.sapMaterial, "90149605");
    assert.equal(findEppConsumptionRule({ sku: "2-KPM-2" })?.sapMaterial, "90149607");
    assert.equal(findEppConsumptionRule({ sku: "2 KPM 3" })?.sapMaterial, "90149608");
  });

  test("keeps ordinary materials in pieces", () => {
    assert.deepEqual(resolveEppConsumption({ sku: "CASCO-01", issuedQuantity: 2 }), {
      quantity: 2,
      issuedQuantity: 2,
      quantityUnit: "PZA",
    });
  });

  test("converts legacy assignment quantities and preserves new UMB quantities", () => {
    assert.equal(resolveAssignmentReportConsumption({
      material: "90149553",
      quantity: 1,
    }).quantity, 0.08);

    assert.equal(resolveAssignmentReportConsumption({
      material: "90149553",
      quantity: 0.16,
      issuedQuantity: 2,
      quantityUnit: "UMB",
    }).quantity, 0.16);
  });

  test("uses the exact material rule when package stock is imported", () => {
    const sleeves = resolveStockFromPackageRule({
      material: "90016897",
      name: "Mangas ANSELL EPP PC-7-11-200",
      stockInput: 1,
    });
    assert.equal(sleeves.stock, 25);
    assert.equal(sleeves.metadata?.unitsPerPackage, 25);
    assert.equal((sleeves.stock - 1) / (sleeves.metadata?.unitsPerPackage ?? 1), 0.96);

    const gloves = resolveStockFromPackageRule({
      material: "90016860",
      name: "Guantes ANSELL EPP PM-37175-9",
      stockInput: 3,
    });
    assert.equal(gloves.stock, 36);
    assert.equal(gloves.metadata?.unitsPerPackage, 12);

    const tyvek = resolveStockFromPackageRule({
      material: "90016863",
      name: "OVEROL DUPONT EPP TY127S-M",
      stockInput: 3,
    });
    assert.equal(tyvek.stock, 75);
    assert.equal(tyvek.metadata?.unitsPerPackage, 25);

    const tychem = resolveStockFromPackageRule({
      material: "90016867",
      name: "OVEROL DUPONT EPP QC 127S XL TYCHEM",
      stockInput: 1,
    });
    assert.equal(tychem.stock, 12);
    assert.equal(tychem.metadata?.unitsPerPackage, 12);
  });

  test("converts each sleeve box to 25 pieces and discounts one piece per issue", () => {
    for (const sleeve of [
      { material: "90008560", sku: "62XJ76", name: "Manga Resistente A Cortes Negro Ch PQ50" },
      { material: "90008561", sku: "62XJ77", name: "Manga Resistente A Cortes Negro G PQ50" },
    ]) {
      const imported = resolveStockFromPackageRule({
        ...sleeve,
        stockInput: 1,
      });

      assert.equal(imported.stock, 25);
      assert.equal(imported.metadata?.stockUnit, "PZA");
      assert.equal(imported.metadata?.packageUnit, "CAJA");
      assert.equal(imported.metadata?.unitsPerPackage, 25);
      assert.equal(resolveInventoryStockDecrease({
        stockUnit: imported.metadata?.stockUnit,
        packageUnit: imported.metadata?.packageUnit,
        unitsPerPackage: imported.metadata?.unitsPerPackage,
        issuedQuantity: 1,
      }), 1);
      assert.equal(imported.stock - 1, 24);
      assert.equal(resolveEppConsumption({
        material: sleeve.material,
        issuedQuantity: 1,
      }).quantity, 0.04);
    }
  });

  test("keeps manually boxed stock in boxes and discounts the package fraction", () => {
    const boxed = resolveStockFromPackageRule({
      sku: "SKU-CAJA-01",
      name: "Articulo en caja manual",
      stockInput: 1,
      packageUnit: "CAJA",
      unitsPerPackage: 5,
    });

    assert.equal(boxed.stock, 1);
    assert.equal(boxed.metadata?.stockUnit, "CAJA");
    assert.equal(boxed.metadata?.unitsPerPackage, 5);
    assert.equal(resolveInventoryStockDecrease({
      stockUnit: boxed.metadata?.stockUnit,
      packageUnit: boxed.metadata?.packageUnit,
      unitsPerPackage: boxed.metadata?.unitsPerPackage,
      issuedQuantity: 1,
    }), 0.2);
    assert.equal(resolveEppConsumption({
      sku: "SKU-CAJA-01",
      issuedQuantity: 1,
      stockUnit: "CAJA",
      packageUnit: "CAJA",
      unitsPerPackage: 5,
    }).quantity, 0.2);
  });
});
