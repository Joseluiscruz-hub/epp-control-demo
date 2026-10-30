# Modelo de amenaza (1 página)

**Sistema:** Next.js en Node.js, con Admin SDK, Firestore y Gemini. Tiene un kiosco público para colaboradores y un panel para administradores locales y globales.
**Activos:** stock de EPP, asignaciones, PINs del kiosco, presupuesto, datos de personal y la API key de Gemini.

## Fronteras de confianza
1. **Navegador / kiosco → API.** Todo lo que llega del cliente se considera no confiable.
2. **API → Firestore.** Solo el servidor escribe, con el Admin SDK. Las Security Rules niegan `create/update/delete` desde cualquier cliente en todas las colecciones, y lo verifican `tests/firestore.rules.test.ts` en CI con el emulador.
3. **API → Gemini.** El contexto operativo y el historial salen del servidor. La key vive solo en el servidor (`GEMINI_API_KEY`).

## Amenazas y controles

| Amenaza | Control | Dónde |
|---|---|---|
| Escritura directa a Firestore desde el cliente (subir stock, falsificar asignaciones) | Las rules niegan toda escritura. Todo pasa por las rutas `/api/*` con el Admin SDK. | `firestore.rules`, `tests/firestore.rules.test.ts` |
| Condiciones de carrera en stock, asignaciones o presupuesto | `runTransaction` del Admin SDK más llaves de idempotencia en entregas y ajustes. La meta de presupuesto se lee y escribe dentro de la transacción. | `app/api/assignments`, `app/api/kiosk/requests`, `app/api/inventory/*`, `app/api/budget/goal`, `lib/idempotency-server.ts` |
| Fuerza bruta de PIN | Hash bcrypt en `kiosk_employee_secrets` (sin acceso de cliente), rate limit por empleado y por cliente con bloqueo, y desbloqueo auditado. La migración de PIN legado es atómica (batch). | `lib/kiosk-pin-rate-limit.ts`, `app/api/kiosk/pin/*` |
| Abuso de endpoints públicos del kiosco | App Check, verificación de mismo origen, sesión de kiosco firmada y rate limit por IP con hash salado. | `lib/app-check.ts`, `lib/kiosk-session-server.ts`, `lib/public-api-rate-limit.ts` |
| Escalada entre plantas | `requireAdminUser` y `canAdminUsePlant`. Un admin local solo puede usar su planta, y ARIA fuerza su alcance a esa planta. | `lib/server-auth.ts`, `app/api/chat/route.ts` |
| Costo o abuso de ARIA | Rate limit transaccional por usuario (20 cada 10 min) y por planta (120 cada 10 min). Límites de tamaño en mensaje e historial. | `lib/aria-rate-limit.ts`, `lib/chat-request.ts` |
| Inyección de prompt mediante nombres de inventario o áreas | Los datos se marcan como no confiables y van después de las reglas. Hay casos de eval de inyección. | `lib/aria-prompt.ts`, `evals/` (categoría seguridad) |
| ARIA expone o perfila personas | El contexto solo lleva agregados por área y SKU, sin nombres ni números de empleado. Un juez lo verifica en cada caso de eval y en producción se registra `personPhraseDetected`. | `lib/aria-context.ts`, `lib/aria-judges.ts` |
| ARIA inventa cifras | Un juez de cifras respaldadas corre en las evals, y en cada consulta se guarda `ungroundedNumberCount`. El reporte semanal lo resume. | `lib/aria-observability.ts`, `/api/admin/aria-report` |
| Cambio malicioso de reglas de negocio | Solo un admin global puede cambiarlas, con validación completa. Las versiones no se modifican, hay rollback y cada cambio queda en `audit_events`. | `app/api/admin/business-rules` |
| Fuga de secretos en el repo | `.env*` en `.gitignore` y `.env.example` sin valores. El escaneo de secretos se documenta en el README. | `.gitignore`, `README.md` |
| Repudio | `audit_events` es de solo servidor y solo lo lee un admin global. La IP se guarda como hash salado (nada en claro). | `lib/audit-events.ts` |

## Riesgos residuales
- Las Security Rules aceptan cualquier lectura de un admin con acceso a la planta. Si un token de admin se compromete, quedan expuestas esas lecturas: la mitigación es la expiración de tokens de Firebase y la desactivación de perfiles.
- Los jueces de ARIA son heurísticos. Una respuesta puede pasar los jueces y aun así estar mal.
- El rate limit de ARIA hace dos escrituras en Firestore por consulta, lo cual tiene un costo bajo y aceptado.
