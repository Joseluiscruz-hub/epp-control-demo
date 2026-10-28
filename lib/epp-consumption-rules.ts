export const EPP_CONSUMPTION_QUANTITY_UNIT = "UMB" as const;

export interface EppConsumptionRule {
  id: string;
  sapMaterial: string;
  supplierSku?: string;
  unitsPerPackage: number;
  unitDecrease: number;
}

export interface EppConsumptionResult {
  quantity: number;
  issuedQuantity: number;
  quantityUnit: typeof EPP_CONSUMPTION_QUANTITY_UNIT | "PZA";
  rule?: EppConsumptionRule;
}

export const EPP_CONSUMPTION_RULES: readonly EppConsumptionRule[] = [
  { id: "sap-90016863", sapMaterial: "90016863", unitsPerPackage: 25, unitDecrease: 0.04 },
  { id: "sap-90016866", sapMaterial: "90016866", unitsPerPackage: 25, unitDecrease: 0.04 },
  { id: "sap-90016869", sapMaterial: "90016869", unitsPerPackage: 25, unitDecrease: 0.04 },
  { id: "sap-90016867", sapMaterial: "90016867", unitsPerPackage: 12, unitDecrease: 0.08 },
  { id: "sap-90149605", sapMaterial: "90149605", supplierSku: "2KPM0", unitsPerPackage: 25, unitDecrease: 0.04 },
  { id: "sap-90149607", sapMaterial: "90149607", supplierSku: "2KPM2", unitsPerPackage: 25, unitDecrease: 0.04 },
  { id: "sap-90149608", sapMaterial: "90149608", supplierSku: "2KPM3", unitsPerPackage: 25, unitDecrease: 0.04 },
  { id: "sap-90016897", sapMaterial: "90016897", unitsPerPackage: 25, unitDecrease: 0.04 },
  { id: "sap-90149610", sapMaterial: "90149610", supplierSku: "3PPM0", unitsPerPackage: 12, unitDecrease: 0.08 },
  { id: "sap-90149609", sapMaterial: "90149609", supplierSku: "3PNM9", unitsPerPackage: 12, unitDecrease: 0.08 },
  { id: "sap-90149611", sapMaterial: "90149611", supplierSku: "3PPM1", unitsPerPackage: 12, unitDecrease: 0.08 },
  { id: "sap-90149578", sapMaterial: "90149578", supplierSku: "1YEM2", unitsPerPackage: 100, unitDecrease: 0.01 },
  { id: "sap-90149580", sapMaterial: "90149580", supplierSku: "28C088", unitsPerPackage: 100, unitDecrease: 0.01 },
  { id: "sap-90149552", sapMaterial: "90149552", supplierSku: "2LEM0", unitsPerPackage: 12, unitDecrease: 0.08 },
  { id: "sap-90149553", sapMaterial: "90149553", supplierSku: "2LEM1", unitsPerPackage: 12, unitDecrease: 0.08 },
  { id: "sap-90149554", sapMaterial: "90149554", supplierSku: "2LEM2", unitsPerPackage: 12, unitDecrease: 0.08 },
  { id: "sap-90149555", sapMaterial: "90149555", supplierSku: "2LEM3", unitsPerPackage: 12, unitDecrease: 0.08 },
  { id: "sap-90016860", sapMaterial: "90016860", unitsPerPackage: 12, unitDecrease: 0.08 },
  { id: "sap-90016859", sapMaterial: "90016859", unitsPerPackage: 12, unitDecrease: 0.08 },
  { id: "sap-90016827", sapMaterial: "90016827", unitsPerPackage: 12, unitDecrease: 0.08 },
  { id: "sap-90008560", sapMaterial: "90008560", supplierSku: "62XJ76", unitsPerPackage: 25, unitDecrease: 0.04 },
  { id: "sap-90008561", sapMaterial: "90008561", supplierSku: "62XJ77", unitsPerPackage: 25, unitDecrease: 0.04 },
  { id: "sap-90016951", sapMaterial: "90016951", supplierSku: "SEGURID068", unitsPerPackage: 12, unitDecrease: 0.08 },
  { id: "sap-90016950", sapMaterial: "90016950", supplierSku: "SEGURID069", unitsPerPackage: 10, unitDecrease: 0.1 },
];

function normalizeCode(value: unknown) {
  return typeof value === "string"
    ? value.toUpperCase().replace(/[^A-Z0-9]/g, "")
    : "";
}

function positiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isPackageUnit(value: unknown) {
  return value === "CAJA" || value === "BOLSA";
}

export function roundEppConsumptionQuantity(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function findEppConsumptionRule(input: {
  sku?: unknown;
  material?: unknown;
  codes?: readonly unknown[];
}) {
  const codes = new Set(
    [input.sku, input.material, ...(input.codes ?? [])]
      .map(normalizeCode)
      .filter(Boolean)
  );

  return EPP_CONSUMPTION_RULES.find((rule) => (
    codes.has(rule.sapMaterial) || Boolean(rule.supplierSku && codes.has(rule.supplierSku))
  ));
}

export function resolveEppConsumption(input: {
  sku?: unknown;
  material?: unknown;
  codes?: readonly unknown[];
  issuedQuantity?: unknown;
  stockUnit?: unknown;
  packageUnit?: unknown;
  unitsPerPackage?: unknown;
}): EppConsumptionResult {
  const issuedQuantity = positiveNumber(input.issuedQuantity, 1);
  const rule = findEppConsumptionRule(input);

  if (!rule) {
    const unitsPerPackage = positiveNumber(input.unitsPerPackage, 0);
    if (isPackageUnit(input.stockUnit) && input.stockUnit === input.packageUnit && unitsPerPackage > 0) {
      return {
        quantity: roundEppConsumptionQuantity(issuedQuantity / unitsPerPackage),
        issuedQuantity,
        quantityUnit: EPP_CONSUMPTION_QUANTITY_UNIT,
      };
    }

    return {
      quantity: roundEppConsumptionQuantity(issuedQuantity),
      issuedQuantity,
      quantityUnit: "PZA",
    };
  }

  return {
    quantity: roundEppConsumptionQuantity(issuedQuantity * rule.unitDecrease),
    issuedQuantity,
    quantityUnit: EPP_CONSUMPTION_QUANTITY_UNIT,
    rule,
  };
}

export function resolveAssignmentReportConsumption(input: {
  sku?: unknown;
  material?: unknown;
  codes?: readonly unknown[];
  quantity?: unknown;
  issuedQuantity?: unknown;
  quantityUnit?: unknown;
}) {
  const persistedQuantity = positiveNumber(input.quantity, 0);
  if (input.quantityUnit === EPP_CONSUMPTION_QUANTITY_UNIT && persistedQuantity > 0) {
    return {
      quantity: roundEppConsumptionQuantity(persistedQuantity),
      quantityUnit: EPP_CONSUMPTION_QUANTITY_UNIT,
      rule: findEppConsumptionRule(input),
    };
  }

  const issuedQuantity = positiveNumber(input.issuedQuantity, persistedQuantity || 1);
  const resolved = resolveEppConsumption({ ...input, issuedQuantity });
  return {
    quantity: resolved.quantity,
    quantityUnit: resolved.quantityUnit,
    rule: resolved.rule,
  };
}
