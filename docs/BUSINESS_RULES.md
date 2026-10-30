# Reglas de negocio versionadas (vida útil y puntos de reorden)

## Qué cambió
Las **24 reglas de vida útil** (`lib/epp-duration-rules.ts`) y los **69 puntos de reorden** (`lib/epp-reorder-points.ts`) ya no dependen de un deploy. Ahora viven en Firestore y están versionadas:

```
business_rules/current              { activeVersion, latestVersion, updatedBy, updatedAt }
business_rules_versions/v{N}        { version, previousVersion, durationRules[], reorderPoints{}, note, createdBy, createdAt }
```

- Las versiones no se modifican. Cada cambio crea `v{N+1}` y mueve el puntero en la misma transacción del Admin SDK.
- Las Security Rules permiten **leer** estas colecciones a cualquier admin y **niegan toda escritura desde el cliente**. Solo el servidor puede escribir.

## Cómo se leen
- `lib/business-rules-server.ts → loadBusinessRules(db)` lee el puntero y la versión activa, con caché de 60 s por instancia, y la aplica a las funciones de siempre: `getEppDurationRule`, `resolveEppReplacementDays` y `getEppReorderPoint`. Por eso ningún consumidor tuvo que cambiar.
- Lo llaman `/api/assignments` (POST), `/api/kiosk/requests` (POST/PATCH, después de App Check) y `/api/inventory/items` (GET/POST).
- En el navegador, `hooks/useBusinessRules.ts` consulta `GET /api/admin/business-rules` para que las vistas previas del inventario usen la misma versión que el servidor.

## Fallback
Se usan las constantes del código, que funcionan como semilla, en estos casos:
- no existe el puntero;
- la versión no existe o no pasa `validateBusinessRules`;
- Firestore falla.

El fallback se registra con `console.warn`. Así la operación nunca se queda sin reglas y nunca carga una versión corrupta.

## Cambiar reglas sin deploy (admin global)
```http
PUT /api/admin/business-rules
Authorization: Bearer <ID token admin_global>
{ "note": "Guante anticorte pasa a 60 días", "durationRules": [...], "reorderPoints": { "90149605": 6, ... } }
```
- El payload se valida completo: ids únicos, códigos no repetidos, `unit` igual a Pza o Par, días entre 1 y 730, cantidades enteras.
- Si hay errores, la respuesta es 400 con la lista.
- Cada cambio deja un `audit_events` de tipo `business_rules.publish`.

**Rollback:** `POST /api/admin/business-rules { "activateVersion": 3 }` deja un evento `business_rules.activate`.

## Migración (una vez por proyecto Firebase)
```bash
npm run seed:business-rules -- --dry-run   # muestra conteos (24 / 69) sin escribir
FIREBASE_SERVICE_ACCOUNT_JSON='...' npm run seed:business-rules
```
- El script publica las constantes actuales como `v1` y activa esa versión.
- Es idempotente: si ya hay una versión activa, no hace nada. Con `--force` crea una versión nueva desde el código.
- Después de la migración, las constantes del código quedan solo como semilla y fallback. **La fuente de verdad pasa a ser Firestore.**

## Pruebas
`lib/business-rules.test.ts` verifica tres cosas:
- la semilla es válida y tiene 24 reglas y 69 puntos;
- los payloads inválidos se rechazan;
- aplicar una versión cambia los resultados sin redeploy, y revertir regresa a los defaults.
