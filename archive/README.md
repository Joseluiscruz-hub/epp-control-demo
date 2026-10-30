# Archivo

Esta carpeta guarda archivos de versiones anteriores. **Ningún código, build ni script los usa.** Están aquí como referencia histórica y para no confundirlos con la configuración vigente.

| Archivo | Qué era |
|---|---|
| `firebase-blueprint-v1.json` | Primer esquema conceptual de colecciones, de la etapa de prototipo. |
| `firebase-blueprint-v2.json` | Esquema extendido con el módulo de kiosko (v0.5). Lo reemplazan `firestore.rules` y los tipos en `lib/`. |
| `metadata.json` | Metadatos del generador de prototipos original. |

La fuente de verdad actual del modelo de datos son `firestore.rules`, `lib/*-types.ts` y `docs/BUSINESS_RULES.md`.
