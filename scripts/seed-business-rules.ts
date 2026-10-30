/**
 * Migracion: publica las reglas hardcodeadas como business_rules_versions/v1
 * y apunta business_rules/current a v1. Idempotente: si ya existe una version
 * activa no hace nada (usa --force para crear una nueva version desde el codigo).
 *
 *   FIREBASE_SERVICE_ACCOUNT_JSON=... npm run seed:business-rules [-- --dry-run] [-- --force]
 */
import { defaultBusinessRules, validateBusinessRules } from "../lib/business-rules";
import { publishBusinessRules } from "../lib/business-rules-server";
import { getAdminDb } from "../lib/firebase-admin";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const seed = defaultBusinessRules();
  const parsed = validateBusinessRules(seed);
  if (!parsed.ok) throw new Error(`Semilla invalida: ${parsed.errors.join("; ")}`);
  console.log(`Semilla: ${parsed.value.durationRules.length} reglas de vida util, ${Object.keys(parsed.value.reorderPoints).length} puntos de reorden.`);
  if (dryRun) return;
  const db = getAdminDb();
  const pointer = await db.collection("business_rules").doc("current").get();
  if (pointer.exists && pointer.get("activeVersion") && !force) {
    console.log(`Ya existe version activa v${pointer.get("activeVersion")}; nada que hacer.`);
    return;
  }
  const result = await publishBusinessRules(db, { payload: parsed.value, actorUid: "seed-script", note: "Migracion inicial desde lib/epp-duration-rules.ts y lib/epp-reorder-points.ts" });
  if (!result.ok) throw new Error(result.errors.join("; "));
  console.log(`Publicada business_rules_versions/v${result.version} y activada.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
