import { NextRequest } from "next/server";
import { buildAuditEvent } from "@/lib/audit-events";
import { activateBusinessRulesVersion, loadBusinessRules, publishBusinessRules, resetBusinessRulesCache } from "@/lib/business-rules-server";
import { getAdminDb } from "@/lib/firebase-admin";
import { AuthHttpError, requireAdminUser, requireGlobalAdminUser } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: active rule set (any admin). Used by the client to stay in sync. */
export async function GET(req: NextRequest) {
  try {
    await requireAdminUser(req);
    resetBusinessRulesCache();
    const snapshot = await loadBusinessRules(getAdminDb());
    return Response.json(snapshot, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (error) {
    if (error instanceof AuthHttpError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "No se pudieron leer las reglas." }, { status: 500 });
  }
}

/**
 * PUT { durationRules, reorderPoints, note } -> publishes version N+1.
 * POST { activateVersion } -> rollback/forward to an existing version.
 * Global admins only; every change is audited.
 */
export async function PUT(req: NextRequest) {
  try {
    const adminUser = await requireGlobalAdminUser(req);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const note = typeof body?.note === "string" ? body.note.trim() : "";
    if (!note) return Response.json({ error: "Incluye una nota que explique el cambio." }, { status: 400 });
    const db = getAdminDb();
    const result = await publishBusinessRules(db, { payload: body, actorUid: adminUser.uid, note });
    if (!result.ok) return Response.json({ error: "Reglas invalidas.", details: result.errors }, { status: 400 });
    await db.collection("audit_events").add(buildAuditEvent({
      type: "business_rules.publish",
      actorUid: adminUser.uid,
      actorEmail: adminUser.email,
      targetCollection: "business_rules_versions",
      targetId: `v${result.version}`,
      metadata: { note },
    }, req));
    return Response.json({ success: true, version: result.version });
  } catch (error) {
    if (error instanceof AuthHttpError) return Response.json({ error: error.message }, { status: error.status });
    console.error("[business-rules PUT]", error);
    return Response.json({ error: "No se pudieron publicar las reglas." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminUser = await requireGlobalAdminUser(req);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const version = Number(body?.activateVersion);
    if (!Number.isInteger(version) || version < 1) return Response.json({ error: "activateVersion invalido." }, { status: 400 });
    const db = getAdminDb();
    const ok = await activateBusinessRulesVersion(db, { version, actorUid: adminUser.uid });
    if (!ok) return Response.json({ error: "Version inexistente o invalida." }, { status: 404 });
    await db.collection("audit_events").add(buildAuditEvent({
      type: "business_rules.activate",
      actorUid: adminUser.uid,
      actorEmail: adminUser.email,
      targetCollection: "business_rules",
      targetId: "current",
      metadata: { activeVersion: version },
    }, req));
    return Response.json({ success: true, activeVersion: version });
  } catch (error) {
    if (error instanceof AuthHttpError) return Response.json({ error: error.message }, { status: error.status });
    console.error("[business-rules POST]", error);
    return Response.json({ error: "No se pudo activar la version." }, { status: 500 });
  }
}
