export interface EppDurationRule {
  id: string;
  sapMaterial?: string;
  supplierSku: string;
  description: string;
  quantity: number;
  unit: "Pza" | "Par";
  replacementDays: number;
}

export interface EppRuleLookupInput {
  sku?: string;
  material?: string;
  name?: string;
  description?: string;
  codes?: Array<string | undefined | null>;
  sizes?: Record<string, { sku?: string; material?: string } | undefined>;
}

export const EPP_DURATION_RULES: EppDurationRule[] = [
  {
    id: "sku-2ztm8",
    sapMaterial: "90148326",
    supplierSku: "2ZTM8",
    description: "Mascarilla Ajustable Des.,Universal,PQ10",
    quantity: 1,
    unit: "Pza",
    replacementDays: 30,
  },
  {
    id: "sku-2cvh2",
    sapMaterial: "90149988",
    supplierSku: "2CVH2",
    description: "Lentes d/Seg,A800,Transp,Transp",
    quantity: 1,
    unit: "Pza",
    replacementDays: 45,
  },
  {
    id: "sku-2lem0",
    supplierSku: "2LEM0",
    description: "Guantes R/Quimico,T7,Puno Recto,PR,PQ1",
    quantity: 1,
    unit: "Par",
    replacementDays: 30,
  },
  {
    id: "sku-2lem1",
    sapMaterial: "90149553",
    supplierSku: "2LEM1",
    description: "Guantes R/Quimico T8,Puno Recto,PR,PQ1",
    quantity: 1,
    unit: "Par",
    replacementDays: 30,
  },
  {
    id: "sku-2lem2",
    sapMaterial: "90149554",
    supplierSku: "2LEM2",
    description: "Guantes R/Quimico T9 Puno Recto,PR,PQ1",
    quantity: 1,
    unit: "Par",
    replacementDays: 30,
  },
  {
    id: "sku-2lem3",
    sapMaterial: "90149555",
    supplierSku: "2LEM3",
    description: "Guantes R/Quimico T10 Puno Recto,PR,PQ",
    quantity: 1,
    unit: "Par",
    replacementDays: 30,
  },
  {
    id: "sku-2kjm5",
    sapMaterial: "90148260",
    supplierSku: "2KJM5",
    description: "Soporte Sacrolumbar Elastico,8An,Ngr,CH",
    quantity: 1,
    unit: "Pza",
    replacementDays: 30,
  },
  {
    id: "sku-2kjm6",
    sapMaterial: "90148261",
    supplierSku: "2KJM6",
    description: "Soporte Sacrolumbar Elastico,8An,Negro,M",
    quantity: 1,
    unit: "Pza",
    replacementDays: 30,
  },
  {
    id: "sku-2kjm7",
    sapMaterial: "90148262",
    supplierSku: "2KJM7",
    description: "Soporte Sacrolumbar Elastico,8An,Negro,GD",
    quantity: 1,
    unit: "Pza",
    replacementDays: 30,
  },
  {
    id: "sku-2kpm0",
    sapMaterial: "90149605",
    supplierSku: "2KPM0",
    description: "Overol c/Capucha,Blanco,Tyvek(R),M,PQ25",
    quantity: 1,
    unit: "Pza",
    replacementDays: 30,
  },
  {
    id: "sku-2kpm2",
    sapMaterial: "90149607",
    supplierSku: "2KPM2",
    description: "Overol c/Capucha,Blanco,Tyvek(R),XG,PQ25",
    quantity: 1,
    unit: "Pza",
    replacementDays: 30,
  },
  {
    id: "sku-2kpm3",
    sapMaterial: "90149608",
    supplierSku: "2KPM3",
    description: "Overol c/Capucha,Blnco,Tyvek(R),2XG,PQ25",
    quantity: 1,
    unit: "Pza",
    replacementDays: 30,
  },
  {
    id: "sku-3pnm9",
    sapMaterial: "90149609",
    supplierSku: "3PNM9",
    description: "Overol c/Capucha,Ama,Tychem(R) QC,M,PQ12",
    quantity: 1,
    unit: "Pza",
    replacementDays: 30,
  },
  {
    id: "sku-3ppm0",
    sapMaterial: "90149610",
    supplierSku: "3PPM0",
    description: "Overol con Capucha,Tychem(R) QC,G,PQ12",
    quantity: 1,
    unit: "Pza",
    replacementDays: 30,
  },
  {
    id: "sku-28c088",
    sapMaterial: "90149580",
    supplierSku: "28C088",
    description: "Tapones Auditivos Reutilizables,25dB,PQ100",
    quantity: 1,
    unit: "Pza",
    replacementDays: 30,
  },
  {
    id: "sku-1yem2",
    sapMaterial: "90149578",
    supplierSku: "1YEM2",
    description: "Tapones p/Oidos,29dB,Bridado,Univ,PQ100",
    quantity: 2,
    unit: "Pza",
    replacementDays: 30,
  },
  {
    id: "sku-62xj76",
    sapMaterial: "90008560",
    supplierSku: "62XJ76",
    description: "Manga Resistente a Cortes,Negro,CH,PQ50",
    quantity: 1,
    unit: "Par",
    replacementDays: 30,
  },
  {
    id: "sku-62xj77",
    sapMaterial: "90008561",
    supplierSku: "62XJ77",
    description: "Manga Resistente a Cortes,Negro,G,PQ50",
    quantity: 1,
    unit: "Par",
    replacementDays: 30,
  },
  {
    id: "sku-191k41",
    sapMaterial: "90007693",
    supplierSku: "191K41",
    description: "Guantes,Nailon,Tamano 6,Blanco/Negro,PR",
    quantity: 1,
    unit: "Par",
    replacementDays: 45,
  },
  {
    id: "sku-191k42",
    sapMaterial: "90007692",
    supplierSku: "191K42",
    description: "Guantes,Nailon,Tamano 7,Blanco/Negro,PR",
    quantity: 1,
    unit: "Par",
    replacementDays: 45,
  },
  {
    id: "sku-191k43",
    sapMaterial: "90007691",
    supplierSku: "191K43",
    description: "Guantes,Nailon,Tamano 8,Blanco/Negro,PR",
    quantity: 1,
    unit: "Par",
    replacementDays: 45,
  },
  {
    id: "sku-191k44",
    sapMaterial: "90007690",
    supplierSku: "191K44",
    description: "Guantes,Nailon,Tamano 9,Blanco/Negro,PR",
    quantity: 1,
    unit: "Par",
    replacementDays: 45,
  },
  {
    id: "sku-191k45",
    sapMaterial: "90007694",
    supplierSku: "191K45",
    description: "Guantes,Nailon,Tamano 10,Blanco/Negro,P",
    quantity: 1,
    unit: "Par",
    replacementDays: 45,
  },
  {
    id: "sku-432em0",
    supplierSku: "432EM0",
    description: "Guante de piel Puno abierto Talla universal",
    quantity: 1,
    unit: "Par",
    replacementDays: 30,
  },
];

function normalizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

const RULE_BY_CODE = new Map<string, EppDurationRule>();

for (const rule of EPP_DURATION_RULES) {
  RULE_BY_CODE.set(normalizeCode(rule.supplierSku), rule);
  if (rule.sapMaterial) RULE_BY_CODE.set(normalizeCode(rule.sapMaterial), rule);
}

export function getEppDurationRule(input: EppRuleLookupInput): EppDurationRule | undefined {
  const candidates = [
    input.sku,
    input.material,
    ...(input.codes ?? []),
    ...Object.values(input.sizes ?? {}).flatMap((variant) => [
      variant?.sku,
      variant?.material,
    ]),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const rule = RULE_BY_CODE.get(normalizeCode(candidate));
    if (rule) return rule;
  }

  const haystack = normalizeText([input.name, input.description].filter(Boolean).join(" "));
  if (!haystack) return undefined;

  return EPP_DURATION_RULES.find((rule) => {
    const aliases = [rule.supplierSku, rule.sapMaterial].filter(Boolean) as string[];
    return aliases.some((alias) => haystack.includes(normalizeCode(alias)));
  });
}

export function resolveEppReplacementDays(input: EppRuleLookupInput, fallbackDays: number) {
  return getEppDurationRule(input)?.replacementDays ?? fallbackDays;
}

export function getEppDurationRulePayload(input: EppRuleLookupInput) {
  const rule = getEppDurationRule(input);
  if (!rule) return {};

  return {
    durationRuleId: rule.id,
    durationRuleSource: "CATALOGO_SAP",
    durationRuleSku: rule.supplierSku,
    durationRuleSapMaterial: rule.sapMaterial ?? null,
    requiredQuantity: rule.quantity,
    requiredUnit: rule.unit,
  };
}
