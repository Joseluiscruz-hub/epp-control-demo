/**
 * Exporta el reporte semanal de ARIA a reports/aria/<fecha>.md.
 * Uso: FIREBASE_SERVICE_ACCOUNT_JSON=... npm run report:aria [-- --days=7]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderAriaWeeklyReport } from "../lib/aria-observability";
import { buildAriaReport } from "../lib/aria-report-server";
import { getAdminDb } from "../lib/firebase-admin";

const days = Number(process.argv.find((a) => a.startsWith("--days="))?.split("=")[1] ?? 7);
buildAriaReport(getAdminDb(), days).then(({ summary, truncated }) => {
  const md = renderAriaWeeklyReport(summary) + (truncated ? "\n> Aviso: se alcanzo el limite de 5000 consultas; el reporte es parcial.\n" : "");
  const dir = join(process.cwd(), "reports", "aria");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${summary.to.slice(0, 10)}.md`);
  writeFileSync(file, md);
  console.log(md);
  console.log(`Guardado en ${file}`);
}).catch((e) => { console.error(e); process.exit(1); });
