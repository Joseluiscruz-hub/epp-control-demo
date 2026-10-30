import { Timestamp } from "firebase-admin/firestore";
import { NextRequest } from "next/server";
import { buildAuditEvent } from "@/lib/audit-events";
import { buildAriaOperationalContext, type AriaDataDocument } from "@/lib/aria-context";
import { parseChatMessageInput } from "@/lib/chat-request";
import { getAdminDb } from "@/lib/firebase-admin";
import { tagAriaAnswer } from "@/lib/aria-judges";
import { ARIA_QUERY_COLLECTION, buildAriaQueryLog } from "@/lib/aria-observability";
import { createGeminiGenerate, generateAriaReply } from "@/lib/aria-prompt";
import { AriaRateLimitError, enforceAriaRateLimit } from "@/lib/aria-rate-limit";
import { AuthHttpError, requireAdminUser, type AdminSession } from "@/lib/server-auth";
import type { PlantScope } from "@/lib/plants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ASSIGNMENT_READ_LIMIT = 2000;

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveScope(adminUser: AdminSession, requestedScope: PlantScope): PlantScope {
  return adminUser.role === "admin_global" ? requestedScope : adminUser.plantaId;
}

function toDocuments(snapshot: FirebaseFirestore.QuerySnapshot): AriaDataDocument[] {
  return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

async function readOperationalContext(adminUser: AdminSession, requestedScope: PlantScope) {
  const db = getAdminDb();
  const scope = resolveScope(adminUser, requestedScope);
  const plantFilter = scope === "nacional" ? null : scope;
  const now = new Date();
  const yearStart = new Date(`${now.getFullYear()}-01-01T00:00:00-06:00`);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const assignmentStart = yearStart < ninetyDaysAgo ? yearStart : ninetyDaysAgo;

  const inventoryQuery = plantFilter
    ? db.collection("ppe_catalog").where("plantaId", "==", plantFilter).limit(1000)
    : db.collection("ppe_catalog").limit(1000);
  const employeesQuery = plantFilter
    ? db.collection("employees").where("active", "==", true).where("plantaId", "==", plantFilter).limit(2000)
    : db.collection("employees").where("active", "==", true).limit(2000);
  const assignmentsQuery = db.collection("assignments")
    .where("assignedAt", ">=", Timestamp.fromDate(assignmentStart))
    .orderBy("assignedAt", "desc")
    .limit(ASSIGNMENT_READ_LIMIT);
  const goalRef = db.collection("budget_goals").doc(`${scope}-${now.getFullYear()}`);

  const [inventorySnap, employeesSnap, assignmentsSnap, goalSnap] = await Promise.all([
    inventoryQuery.get(),
    employeesQuery.get(),
    assignmentsQuery.get(),
    goalRef.get(),
  ]);

  const assignments = toDocuments(assignmentsSnap).filter(({ data }) => {
    if (!plantFilter) return true;
    return readText(data.plantaId) === plantFilter;
  });

  return buildAriaOperationalContext({
    scope,
    now,
    inventory: toDocuments(inventorySnap),
    employees: toDocuments(employeesSnap),
    assignments,
    budgetGoal: goalSnap.exists ? goalSnap.data() ?? null : null,
    assignmentSampleLimited: assignmentsSnap.size >= ASSIGNMENT_READ_LIMIT,
  });
}

export async function POST(req: NextRequest) {
  try {
    const adminUser = await requireAdminUser(req);
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "Configuracion incompleta: define GEMINI_API_KEY en el servidor." },
        { status: 503 }
      );
    }

    const body = await req.json();
    const parsed = parseChatMessageInput(body);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }

    const scope = resolveScope(adminUser, parsed.plantaId);
    await enforceAriaRateLimit(getAdminDb(), { uid: adminUser.uid, plantScope: scope });

    const context = await readOperationalContext(adminUser, parsed.plantaId);
    const reply = await generateAriaReply({
      context,
      history: parsed.history,
      message: parsed.message,
      generate: createGeminiGenerate(apiKey),
    });

    const text = reply.text;
    if (!text) {
      return Response.json({ error: "ARIA no genero una respuesta util. Intenta reformular la consulta." }, { status: 502 });
    }

    const guardrails = tagAriaAnswer(text, context);
    const db = getAdminDb();
    const queryRef = db.collection(ARIA_QUERY_COLLECTION).doc();
    const batch = db.batch();
    batch.set(queryRef, {
      ...buildAriaQueryLog({
        actorUid: adminUser.uid,
        plantScope: context.scope,
        messageLength: parsed.message.length,
        historyMessages: parsed.history.length,
        reply,
        guardrails,
        nowMs: Date.now(),
      }),
      createdAt: Timestamp.now(),
    });
    batch.set(db.collection("audit_events").doc(), buildAuditEvent({
      type: "aria.query",
      actorUid: adminUser.uid,
      actorEmail: adminUser.email,
      targetCollection: ARIA_QUERY_COLLECTION,
      targetId: queryRef.id,
      metadata: {
        messageLength: parsed.message.length,
        historyMessages: parsed.history.length,
        plantScope: context.scope,
        inventoryItems: context.totals.inventoryItems,
        activeEmployees: context.totals.activeEmployees,
        assignmentsAnalyzed: context.totals.assignmentsAnalyzed,
        assignmentSampleLimited: context.dataQuality.assignmentSampleLimited,
        latencyMs: reply.metrics.latencyMs,
        promptTokensApprox: reply.metrics.promptTokensApprox,
        outputTokensApprox: reply.metrics.outputTokensApprox,
        promptVersion: reply.metrics.promptVersion,
        guardrails,
      },
    }, req));
    await batch.commit();

    return Response.json({
      text,
      success: true,
      meta: {
        queryId: queryRef.id,
        scope: context.scope,
        generatedAt: context.generatedAt,
        sampleLimited: context.dataQuality.assignmentSampleLimited,
        latencyMs: reply.metrics.latencyMs,
      },
    });
  } catch (error: unknown) {
    if (error instanceof AriaRateLimitError) {
      return Response.json(
        { error: error.message, retryAfterSeconds: error.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
      );
    }
    if (error instanceof AuthHttpError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    const status = typeof error === "object" && error !== null && "status" in error
      && typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : 500;
    const message = typeof error === "object" && error !== null && "message" in error
      && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";

    console.error("[Chat API Error]", error);

    if (status === 403 && message.toLowerCase().includes("api key was reported as leaked")) {
      return Response.json(
        { error: "La API key de Gemini fue deshabilitada por exposicion. Reemplaza GEMINI_API_KEY en el servidor." },
        { status: 403 }
      );
    }
    if (status === 403) {
      return Response.json({ error: "Gemini rechazo la solicitud por permisos de API key." }, { status: 403 });
    }
    if (status === 429) {
      return Response.json({ error: "ARIA alcanzo temporalmente el limite de consultas. Intenta de nuevo en un minuto." }, { status: 429 });
    }

    return Response.json({ error: "No se pudo procesar la consulta con ARIA." }, { status: 500 });
  }
}
