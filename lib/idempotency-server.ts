import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";
import {
  IDEMPOTENCY_COLLECTION,
  buildIdempotencyDocId,
  decideIdempotentOperation,
  type IdempotencyRecord,
  type IdempotencyScope,
} from "./idempotency";

export type IdempotentOutcome<T> = { duplicated: boolean; result: T };

/**
 * Ejecuta `work` dentro de una transaccion de Firestore protegida por una llave de idempotencia.
 * Lee primero idempotency_keys/{scope}_{key}; si existe, devuelve el resultado guardado sin
 * ejecutar `work` (no se vuelve a descontar stock). Si no, ejecuta `work` y guarda el resultado
 * en la MISMA transaccion, de modo que dos envios concurrentes con la misma llave solo aplican uno.
 * `work` debe hacer todas sus lecturas antes de escribir; el resultado debe ser serializable.
 */
export async function runIdempotentTransaction<T extends Record<string, unknown>>(
  db: Firestore,
  params: { scope: IdempotencyScope; key: string; actorUid: string; fingerprint: string },
  work: (transaction: Transaction) => Promise<T>
): Promise<IdempotentOutcome<T>> {
  const ref = db.collection(IDEMPOTENCY_COLLECTION).doc(buildIdempotencyDocId(params.scope, params.key));

  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const decision = decideIdempotentOperation<T>(
      snap.exists ? (snap.data() as Partial<IdempotencyRecord<T>>) : null,
      params
    );
    if (decision.kind === "replay") {
      return { duplicated: true, result: decision.result };
    }

    const result = await work(transaction);
    transaction.set(ref, {
      scope: params.scope,
      key: params.key,
      actorUid: params.actorUid,
      fingerprint: params.fingerprint,
      result,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { duplicated: false, result };
  });
}
