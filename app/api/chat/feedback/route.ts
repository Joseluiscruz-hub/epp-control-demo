import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { ARIA_QUERY_COLLECTION, parseAriaFeedback } from "@/lib/aria-observability";
import { getAdminDb } from "@/lib/firebase-admin";
import { AuthHttpError, requireAdminUser } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Records whether the admin found an ARIA answer useful (acceptedByUser). */
export async function POST(req: NextRequest) {
  try {
    const adminUser = await requireAdminUser(req);
    const parsed = parseAriaFeedback(await req.json().catch(() => null));
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

    const db = getAdminDb();
    const ref = db.collection(ARIA_QUERY_COLLECTION).doc(parsed.queryId);
    const status = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return 404;
      if (snap.get("actorUid") !== adminUser.uid) return 403;
      tx.update(ref, {
        acceptedByUser: parsed.accepted,
        feedbackComment: parsed.comment,
        feedbackAt: FieldValue.serverTimestamp(),
      });
      return 200;
    });
    if (status === 404) return Response.json({ error: "Consulta no encontrada." }, { status: 404 });
    if (status === 403) return Response.json({ error: "Solo quien hizo la consulta puede calificarla." }, { status: 403 });
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof AuthHttpError) return Response.json({ error: error.message }, { status: error.status });
    console.error("[ARIA feedback]", error);
    return Response.json({ error: "No se pudo guardar la calificacion." }, { status: 500 });
  }
}
