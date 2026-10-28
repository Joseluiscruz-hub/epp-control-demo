# Control de EPP · demo sanitizada

Plataforma web para controlar la **entrega, vida útil y reposición de Equipo de Protección Personal (EPP)** en planta, con kiosko de autoservicio, portal del colaborador, inventario multi-planta y un asistente de análisis con IA (ARIA).

> **Espejo sanitizado.** Este repositorio es una copia de demostración, con historial nuevo, del sistema que operó en una planta de manufactura de bebidas en México. No contiene datos reales de colaboradores, credenciales, códigos internos de la empresa ni nombres de la empresa o de sus plantas. Las plantas se llaman `norte` y `sur`, y los números de material SAP son ficticios (prefijo `90…`).

**Piloto:** 2 meses de operación con **543 usuarios** registrados y **sin incidentes críticos**.

## Qué hace

| Módulo | Qué hace |
|---|---|
| **Kiosko** (`/kiosko`) | El colaborador se identifica con su número de empleado y un PIN, ve el catálogo con tallas y solicita su equipo. |
| **Portal** (`/portal`) | El colaborador consulta el EPP que tiene asignado. |
| **Inventario** | Catálogo por SKU, talla y variante; ajustes de stock; importación masiva por TSV; alertas de punto de reorden. |
| **Personal** | Directorio e importación masiva desde un layout de personal tipo SAP. |
| **Reportes / Dashboard** | Entregas por semana, área y motivo; exportación de solicitud de compra (SOLPED) a CSV. |
| **Presupuesto / Monitoreo** | Meta anual vs. gasto observado y vista en vivo de la operación. |
| **ARIA** | Asistente de análisis con Gemini, sólo en servidor y con datos agregados. |

## Mecanismo exacto

1. **Identificación en kiosko:** el servidor verifica el PIN contra un hash bcrypt (`lib/pin-verify.ts`), aplica límite de intentos por empleado y por dispositivo (`lib/kiosk-pin-rate-limit.ts`) y emite una sesión opaca firmada con `KIOSK_SESSION_SECRET` en cookie `HttpOnly`/`SameSite=Strict`, ligada a dispositivo, planta y versión de credenciales (`lib/kiosk-session-server.ts`).
2. **Solicitud:** el catálogo público del kiosko se minimiza (`lib/kiosk-catalog-public.ts`) y la solicitud se valida **en servidor** (`app/api/...`) con Admin SDK y transacciones; las reglas de Firestore niegan escrituras críticas desde el cliente (`firestore.rules`).
3. **Vida útil y reposición anticipada:** cada SKU tiene una regla de días de reposición (`lib/epp-duration-rules.ts`). Si alguien pide antes de cumplirla, el servidor genera una alerta (crítica si usó menos de la mitad de la vida útil) que sólo un aprobador autorizado puede liberar (`lib/kiosk-alert-approvers.ts`). Los aprobadores **no viven en el código**: se leen de la variable `KIOSK_ALERT_APPROVERS`.
4. **Consumo en unidad base SAP:** las piezas entregadas se convierten a la unidad de medida base del material (p. ej. caja de 25 → 0.04 por pieza) con `lib/epp-consumption-rules.ts`.
5. **Reorden y compras:** puntos de reorden por material (`lib/epp-reorder-points.ts`) y exportación de SOLPED a CSV con `;` compatible con Excel (`lib/solped-export.ts`).
6. **Multi-planta:** el administrador local sólo ve y escribe en su planta; los caminos de escritura rechazan plantas desconocidas con 409 en vez de caer a una planta por defecto (`lib/plants.ts`).
7. **Auditoría:** eventos de auditoría con IP guardada sólo como hash con sal (`AUDIT_IP_SALT`).
8. **ARIA:** el contexto que recibe el modelo es agregado por área/SKU; el prompt prohíbe identificar personas y trata el texto de la base como dato no confiable.

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind 4 · shadcn/ui · Zustand · Firebase (Firestore, Auth, App Check) · Google Gemini (`@google/genai`) · Docker / Cloud Run · GitHub Actions.

## Cómo ejecutarlo con la configuración de ejemplo

Requisitos: Node.js 20+ y npm.

```bash
cp .env.example .env.local      # rellena con TU proyecto de Firebase (valores de ejemplo incluidos)
npm ci
npm run dev                     # http://localhost:3000
```

- Sin proyecto de Firebase puedes probar la interfaz en **modo local/offline**: pon `NEXT_PUBLIC_ENABLE_OFFLINE_MODE=true` y `NEXT_PUBLIC_ENABLE_INSECURE_KIOSK_LOCAL_AUTH=true` en `.env.local` (sólo para demo local; nunca en producción). Ver `USO_LOCAL.md`.
- ARIA requiere `GEMINI_API_KEY` (sólo servidor).
- `.firebaserc` apunta a `tu-proyecto-prod`: cámbialo por tu proyecto.
- Datos ficticios de staging: `npm run seed:staging:demo` (sólo acepta proyectos cuyo ID contenga `staging` o `demo`, con confirmación explícita; ver `docs/staging-demo.md`).

## Calidad

```bash
npm test            # pruebas unitarias (node:test + tsx)
npm run typecheck
npm run lint
npm run build
npm run test:firestore-rules   # reglas de Firestore con emulador (requiere firebase-tools)
```

Al crear este espejo, `npm test` ejecutó **258 pruebas unitarias, todas en verde**, y `npm run typecheck` y `npm run build` pasaron.

## Notas de anonimización

- Plantas renombradas a `norte` / `sur`; números de material SAP reemplazados por valores ficticios `90xxxxxx`.
- Los códigos de catálogo de proveedor (p. ej. `2LEM0`) y las imágenes de producto (generadas, sin logotipos) se conservan como ejemplo.
- Correos, nombres y números de empleado en pruebas y semillas son ficticios (`example.com`, "Ana Demostracion", etc.).

## Licencia

Ver `LICENSE`.
