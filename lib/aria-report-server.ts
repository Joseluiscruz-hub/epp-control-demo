import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { ARIA_QUERY_COLLECTION, summarizeAriaQueries, type AriaQueryLog } from "./aria-observability";

export async function buildAriaReport(db: Firestore, days = 7, nowMs = Date.now()) {
  const fromMs = nowMs - days * 86_400_000;
  const snap = await db.collection(ARIA_QUERY_COLLECTION)
    .where("createdAt", ">=", Timestamp.fromMillis(fromMs))
    .orderBy("createdAt", "desc")
    .limit(5000)
    .get();
  const rows = snap.docs.map((d) => d.data() as Partial<AriaQueryLog>);
  return { summary: summarizeAriaQueries(rows, { fromMs, toMs: nowMs }), truncated: snap.size >= 5000 };
}
