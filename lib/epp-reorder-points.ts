export const EPP_REORDER_POINTS: Record<string, number> = {
  "90149605": 5,
  "90149608": 5,
  "32007822": 3,
  "90149607": 5,
  "90149609": 5,
  "90148378": 2,
  "90149552": 3,
  "90149553": 3,
  "90149554": 3,
  "90149555": 3,
  "90148370": 5,
  "90148371": 2,
  "90149551": 2,
  "90149637": 8,
  "90010273": 3,
  "90149965": 5,
  "90005912": 2,
  "90004990": 4,
  "90148247": 5,
  "90149623": 3,
  "90148323": 3,
  "90149624": 3,
  "90149620": 3,
  "90149622": 3,
  "90148321": 3,
  "90148339": 3,
  "90149618": 2,
  "90149616": 2,
  "90149617": 2,
  "90148325": 3,
  "90148326": 3,
  "90149611": 3,
  "90149610": 3,
  "90146983": 3,
  "90146982": 3,
  "90146984": 3,
  "90008561": 2,
  "90008560": 2,
  "90149541": 20,
  "90149544": 5,
  "90149542": 5,
  "90149545": 5,
  "90149543": 5,
  "90148313": 5,
  "90148682": 5,
  "90148683": 5,
  "90148684": 5,
  "90148685": 5,
  "90148686": 5,
  "90146979": 5,
  "90146980": 5,
  "90146981": 5,
  "90007693": 30,
  "90007692": 30,
  "90007691": 30,
  "90007690": 30,
  "90007694": 20,
  "90013315": 20,
  "90148260": 5,
  "90148261": 5,
  "90148263": 5,
  "90148262": 5,
  "90017000": 10,
  "90148269": 8,
  "90148312": 5,
  "90149580": 2,
  "90149578": 2,
  "90006433": 20,
  "90005583": 20,
};

/** Active reorder points; replaced at runtime by the Firestore version. */
let activeReorderPoints: Record<string, number> = EPP_REORDER_POINTS;

export function setActiveEppReorderPoints(points: Record<string, number> | null) {
  activeReorderPoints = points && Object.keys(points).length > 0 ? points : EPP_REORDER_POINTS;
}

export function getActiveEppReorderPoints() {
  return activeReorderPoints;
}

export function normalizeEppMaterialCode(value: unknown) {
  return typeof value === "string"
    ? value.trim().toUpperCase().replace(/[^0-9A-Z]/g, "")
    : "";
}

export function getEppReorderPoint(...codes: unknown[]) {
  for (const code of codes) {
    const normalized = normalizeEppMaterialCode(code);
    if (normalized && Object.prototype.hasOwnProperty.call(activeReorderPoints, normalized)) {
      return activeReorderPoints[normalized];
    }
  }
  return undefined;
}

export function hasEppReorderPoint(...codes: unknown[]) {
  return getEppReorderPoint(...codes) !== undefined;
}
