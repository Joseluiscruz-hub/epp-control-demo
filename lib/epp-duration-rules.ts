export interface EppDurationRule {
  id: string;
  sapMaterial?: string;
  erpSku: string;
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
    id: "erp-2ztm8",
    sapMaterial: "90148326",
    erpSku: "2ZTM8",
    description: "Mascarilla Ajustable Des.,Universal,PQ10",
    quantity: 1,
    unit: "Pza",
    replacementDays: 30,
  },
  {
    id: "erp-2cvh2",
    sapMaterial: "90149988",
    erpSku: "2CVH2",
    description: "Lentes d/Seg,A800,Transp,Transp",
    quantity: 1,
    unit: "Pza",
    replacementDays: 45,
  },
  {
    id: "erp-2lem0",
    erpSku: "2LEM0",
    description: "Guantes R/Quimico,T7,Puno Recto,PR,PQ1",
    quantity: 1,
    unit: "Par",
    replacementDays: 30,
  },
  {
    id: "erp-2lem1",
    sapMaterial: "90149553",
    erpSku: "2LEM1",
    description: "Guantes R/Quimico T8,Puno Recto,PR,PQ1",
    quantity: 1,
    unit: "Par",
    replacementDays: 30,
  },
  {
    id: "erp-2lem2",
    sapMaterial: "90149554",
    erpSku: "2LEM2",
    description: "Guantes R/Quimico T9 Puno Recto,PR,PQ1",
    quantity: 1,
    unit: "Par",
    replacementDays: 30,
  },
  {
    id: "erp-2lem3",
    sapMaterial: "90149555",
    erpSku: "2LEM3",
    description: "Guantes R/Quimico T10 Puno Recto,PR,PQ",
    quantity: 1,
    unit: "Par",
    replacementDays: 30,
  },
  {
    id: "erp-2kjm5",
    sapMaterial: "90148260",
    erpSku: "2KJM5",
    description: "Soporte Sacrolumbar Elastico,8An,Ngr,CH",
    quantity: 1,
    unit: "Pza",
    replacementDays: 30,
  },
  {
    id: "erp-2kjm6",
    sapMaterial: "90148261",
    erpSku: "2KJM6",
    description: "Soporte Sacrolumbar Elastico,8An,Negro,M",
    quantity: 1,
    unit: "Pza",
    replacementDays: 30,
  },
  {
    id: "erp-2kjm7",
    sapMaterial: "90148262",
    erpSku: "2KJM7",
    description: "Soporte Sacrolumbar Elastico,8An,Negro,GD",
    quantity: 1,
    unit: "Pza",
    replacementDays: 30,
  },
  {
    id: "erp-2kpm0",
    sapMaterial: "90149605",
    erpSku: "2KPM0",
    description: "Overol c/Capucha,Blanco,Tyvek(R),M,PQ25",
    quantity: 1,
    unit: "Pza",
    replacementDays: 30,
  },
  {
    id: "erp-2kpm2",
    sapMaterial: "90149607",
    erpSku: "2KPM2",
    description: "Overol c/Capucha,Blanco,Tyvek(R),XG,PQ25",
    quantity: 1,
    unit: "Pza",
    replacementDays: 30,
  },
  {
    id: "erp-2kpm3",
    sapMaterial: "90149608",
    erpSku: "2KPM3",
    description: "Overol c/Capucha,Blnco,Tyvek(R),2XG,PQ25",
    quantity: 1,
    unit: "Pza",
    replacementDays: 30,
  },
  {
    id: "erp-3pnm9",
    sapMaterial: "90149609",
    erpSku: "3PNM9",
    description: "Overol c/Capucha,Ama,Tychem(R) QC,M,PQ12",
    quantity: 1,
    unit: "Pza",
    replacementDays: 30,
  },
  {
    id: "erp-3ppm0",
    sapMaterial: "90149610",
    erpSku: "3PPM0",
    description: "Overol con Capucha,Tychem(R) QC,G,PQ12",
    quantity: 1,
    unit: "Pza",
    replacementDays: 30,
  },
  {
    id: "erp-28c088",
    sapMaterial: "90149580",
    erpSku: "28C088",
    description: "Tapones Auditivos Reutilizables,25dB,PQ100",
    quantity: 1,
    unit: "Pza",
    replacementDays: 30,
  },
  {
    id: "erp-1yem2",
    sapMaterial: "90149578",
    erpSku: "1YEM2",
    description: "Tapones p/Oidos,29dB,Bridado,Univ,PQ100",
    quantity: 2,
    unit: "Pza",
    replacementDays: 30,
  },
  {
    id: "erp-62xj76",
    sapMaterial: "90008560",
    erpSku: "62XJ76",
    description: "Manga Resistente a Cortes,Negro,CH,PQ50",
    quantity: 1,
    unit: "Par",
    replacementDays: 30,
  },
  {
    id: "erp-62xj77",
    sapMaterial: "90008561",
    erpSku: "62XJ77",
    description: "Manga Resistente a Cortes,Negro,G,PQ50",
    quantity: 1,
    unit: "Par",
    replacementDays: 30,
  },
  {
    id: "erp-191k41",
    sapMaterial: "90007693",
    erpSku: "191K41",
    description: "Guantes,Nailon,Tamano 6,Blanco/Negro,PR",
    quantity: 1,
    unit: "Par",
    replacementDays: 45,
  },
  {
    id: "erp-191k42",
    sapMaterial: "90007692",
    erpSku: "191K42",
    description: "Guantes,Nailon,Tamano 7,Blanco/Negro,PR",
    quantity: 1,
    unit: "Par",
    replacementDays: 45,
  },
  {
    id: "erp-191k43",
    sapMaterial: "90007691",
    erpSku: "191K43",
    description: "Guantes,Nailon,Tamano 8,Blanco/Negro,PR",
    quantity: 1,
    unit: "Par",
    replacementDays: 45,
  },
  {
    id: "erp-191k44",
    sapMaterial: "90007690",
    erpSku: "191K44",
    description: "Guantes,Nailon,Tamano 9,Blanco/Negro,PR",
    quantity: 1,
    unit: "Par",
    replacementDays: 45,
  },
  {
    id: "erp-191k45",
    sapMaterial: "90007694",
    erpSku: "191K45",
    description: "Guantes,Nailon,Tamano 10,Blanco/Negro,P",
    quantity: 1,
    unit: "Par",
    replacementDays: 45,
  },
  {
    id: "erp-432em0",
    erpSku: "432EM0",
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

/**
 * Active rule set. Defaults to the in-code seed (EPP_DURATION_RULES); the
 * server replaces it with the Firestore version (business_rules_versions)
 * via setActiveEppDurationRules(). See docs/BUSINESS_RULES.md.
 */
let activeRules: EppDurationRule[] = EPP_DURATION_RULES;
let ruleByCode = buildRuleIndex(activeRules);

function buildRuleIndex(rules: EppDurationRule[]) {
  const index = new Map<string, EppDurationRule>();
  for (const rule of rules) {
    index.set(normalizeCode(rule.erpSku), rule);
    if (rule.sapMaterial) index.set(normalizeCode(rule.sapMaterial), rule);
  }
  return index;
}

export function setActiveEppDurationRules(rules: EppDurationRule[] | null) {
  activeRules = rules && rules.length > 0 ? rules : EPP_DURATION_RULES;
  ruleByCode = buildRuleIndex(activeRules);
}

export function getActiveEppDurationRules() {
  return activeRules;
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
    const rule = ruleByCode.get(normalizeCode(candidate));
    if (rule) return rule;
  }

  const haystack = normalizeText([input.name, input.description].filter(Boolean).join(" "));
  if (!haystack) return undefined;

  return activeRules.find((rule) => {
    const aliases = [rule.erpSku, rule.sapMaterial].filter(Boolean) as string[];
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
    durationRuleSource: "PLANT_ERP",
    durationRuleSku: rule.erpSku,
    durationRuleSapMaterial: rule.sapMaterial ?? null,
    requiredQuantity: rule.quantity,
    requiredUnit: rule.unit,
  };
}
