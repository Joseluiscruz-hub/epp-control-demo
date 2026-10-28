export const PLANTS = [
  { id: "norte", label: "Planta Norte", shortLabel: "Norte" },
  { id: "sur", label: "Planta Sur", shortLabel: "Sur" },
] as const;

export type PlantId = (typeof PLANTS)[number]["id"];
export type PlantScope = PlantId | "nacional";
export type ActivePlantId = PlantId | "todas";

export const DEFAULT_PLANT_ID: PlantId = "norte";

const PLANT_IDS = new Set<string>(PLANTS.map((plant) => plant.id));
const PLANT_ALIASES: Record<PlantId, string[]> = {
  norte: [
    "norte",
    "planta norte",
    "nte",
    "nteopmn001",
  ],
  sur: [
    "sur",
    "planta sur",
    "sur1",
    "suropmn001",
  ],
};

function normalizePlantAlias(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isPlantId(value: unknown): value is PlantId {
  return typeof value === "string" && PLANT_IDS.has(value);
}

export function isActivePlantId(value: unknown): value is ActivePlantId {
  return value === "todas" || isPlantId(value);
}

export function normalizePlantId(value: unknown): PlantId {
  return isPlantId(value) ? value : DEFAULT_PLANT_ID;
}

export function parsePlantId(value: unknown): PlantId | null {
  if (isPlantId(value)) return value;
  if (typeof value !== "string") return null;

  const normalized = normalizePlantAlias(value);
  if (!normalized) return null;

  for (const plant of PLANTS) {
    if (PLANT_ALIASES[plant.id].some((alias) => normalizePlantAlias(alias) === normalized)) {
      return plant.id;
    }
  }

  return null;
}

export function normalizeActivePlantId(value: unknown): ActivePlantId {
  return isActivePlantId(value) ? value : "todas";
}

export function plantLabel(value: unknown) {
  if (value === "todas") return "Vista global";
  if (value === "nacional") return "Nacional";
  return PLANTS.find((plant) => plant.id === value)?.label ?? "Planta sin definir";
}

export class InvalidPlantError extends Error {
  status = 409;

  constructor(message: string) {
    super(message);
    this.name = "InvalidPlantError";
  }
}

/**
 * Para caminos de ESCRITURA (stock, entregas, solicitudes): acepta solo plantas conocidas
 * (o sus alias). A diferencia de normalizePlantId, nunca cae en silencio a la planta por defecto;
 * lanza InvalidPlantError (409) para no descontar stock de otra planta.
 */
export function requireKnownPlantId(value: unknown, context = "registro"): PlantId {
  const plant = parsePlantId(value);
  if (plant) return plant;
  const shown = typeof value === "string" && value.trim() ? `"${value.trim().slice(0, 40)}"` : "sin planta";
  throw new InvalidPlantError(`Planta invalida (${shown}) en ${context}. Corrige la planta antes de continuar.`);
}

/**
 * Plantas de una entrega/ajuste: el colaborador y el material deben traer su propia planta
 * conocida. Nunca se hereda la planta del admin ni la del colaborador (falla cerrado, 409).
 */
export function resolveRecordPlantId(record: { plantaId?: unknown } | undefined, context: string): PlantId {
  return requireKnownPlantId(record?.plantaId, context);
}

/**
 * Compara una planta guardada (posible alias, p. ej. "Planta Sur") con la planta canonica
 * de una sesion. No lanza: planta ausente o desconocida en cualquiera de los lados => false
 * (falla cerrado).
 */
export function plantMatches(stored: unknown, expected: unknown): boolean {
  const a = parsePlantId(stored);
  const b = parsePlantId(expected);
  return a !== null && b !== null && a === b;
}
