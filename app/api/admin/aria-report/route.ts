import { NextRequest } from "next/server";
import { renderAriaWeeklyReport } from "@/lib/aria-observability";
import { buildAriaReport } from "@/lib/aria-report-server";
import { getAdminDb } from "@/lib/firebase-admin";
import { AuthHttpError, requireGlobalAdminUser } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/aria-report?days=7&format=md|json — global admins only. */
export async function GET(req: NextRequest) {
  try {
    await requireGlobalAdminUser(req);
    const days = Math.min(31, Math.max(1, Number(req.nextUrl.searchParams.get("days") ?? 7) || 7));
    const { summary, truncated } = await buildAriaReport(getAdminDb(), days);
    if (req.nextUrl.searchParams.get("format") === "md") {
      return new Response(renderAriaWeeklyReport(summary), { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
    }
    return Response.json({ summary, truncated });
  } catch (error) {
    if (error instanceof AuthHttpError) return Response.json({ error: error.message }, { status: error.status });
    console.error("[ARIA report]", error);
    return Response.json({ error: "No se pudo generar el reporte." }, { status: 500 });
  }
}
