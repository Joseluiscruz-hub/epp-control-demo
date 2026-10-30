# Caso de estudio: control de EPP con kiosko y asistente de IA

*Planta de manufactura en México. Información anonimizada: no se nombra a la empresa, a las plantas ni a las personas.*

## 1. Problema

El problema de fondo no era la velocidad, era el **descontrol**. La entrega de Equipo de Protección Personal (guantes, lentes, cascos, botas, respiradores, overoles) se hacía en almacén sin un registro confiable por persona. Eso tenía cuatro consecuencias:

- **No se podía aplicar la vida útil.** Sin historial individual no había forma de distinguir un reemplazo legítimo de una pérdida o de un abuso, por ejemplo guantes pedidos varias veces en una quincena.
- **Los faltantes se descubrían tarde.** El inventario y las compras no estaban conectados, y los puntos de reorden vivían en hojas de cálculo.
- **Las unidades no cuadraban.** El kiosko entrega piezas, pero el ERP registra la baja en unidad base (caja, bolsa, paquete), así que conciliar era manual.
- **Quien decidía tenía poca visibilidad.** Presupuesto, consumo por área y riesgo se armaban a mano y tarde.

## 2. Solución

Es una plataforma web (Next.js 15 en Cloud Run, Firestore y Firebase Auth) con cuatro piezas:

1. **Kiosko de autoservicio (PWA).** El colaborador se identifica con un PIN de 6 dígitos, ve su catálogo con tallas y solicita su equipo. El servidor valida la vida útil contra la entrega anterior. Una reposición anticipada genera una alerta, crítica o de advertencia, que solo puede aprobar un responsable autorizado.
2. **Consola administrativa.** Inventario por SKU y talla, importación masiva, alertas de reorden con exportación a solicitud de compra, presupuesto anual con gasto observado, reportes por área y monitoreo en vivo. Cada administrador local ve solo su planta.
3. **Reglas de negocio versionadas.** Son 24 reglas de vida útil y 69 puntos de reorden guardados en Firestore (`business_rules_versions`). Un administrador global publica una versión nueva o hace rollback sin desplegar, y cada cambio queda auditado. Las constantes del código quedan solo como semilla y como respaldo si Firestore falla.
4. **ARIA, el asistente de análisis.** Usa Gemini 2.5 Flash y corre solo en el servidor. Recibe un contexto **agregado**: inventario priorizado, consumo de 30 y 90 días por SKU y por área, sugerencias de compra a 60 días y presupuesto. Nunca recibe nombres ni números de empleado. Sus reglas: no inventar, declarar cuándo los datos son parciales, reportar anomalías por área y nunca por persona, y no citar normas sin validación de Seguridad e Higiene.

**Seguridad por diseño**
- Las Security Rules niegan toda escritura del cliente.
- Stock, asignaciones, PIN y presupuesto se escriben en transacciones del Admin SDK, con llaves de idempotencia en entregas.
- El PIN se guarda con bcrypt y tiene bloqueo progresivo.
- Los flujos públicos usan App Check y rate limit por IP con hash salado.
- ARIA tiene rate limit por usuario y por planta.
- Detalle en [THREAT_MODEL.md](THREAT_MODEL.md).

## 3. Resultados

| Indicador | Resultado |
|---|---|
| Duración del piloto | 2 meses |
| Usuarios registrados | **543** |
| Entregas registradas | **494** |
| Diferencias contra el inventario del ERP (SAP) | **0** |
| Incidentes críticos | **0**: la operación fue estable |
| Trazabilidad | Antes no existía registro por persona. Con el piloto, cada entrega queda ligada a un colaborador, con folio, fecha, hora y motivo. |
| Pruebas automatizadas | **275 pruebas unitarias** más pruebas de Security Rules con emulador, todas en CI |
| Evaluación de ARIA | **48 casos** en 10 categorías. La corrida offline (pipeline y calibración de jueces) aprueba 48 de 48: los jueces aceptan las respuestas correctas y detectan el 100 % de las defectuosas. Ver [`evals/results/LATEST-offline.md`](../evals/results/LATEST-offline.md). |
| Evaluación live de ARIA (gemini-2.5-flash, prompt 2026-10-30.1) | **36/48 casos (75.0 %)**. Sin identificación de personas 100 %, cifras respaldadas 93.8 %, acciones concretas 89.6 %. Corrida previa con prompt/jueces anteriores: 23/48 (47.9 %), archivada. Ver [`evals/results/LATEST-live.md`](../evals/results/LATEST-live.md). |

**Cómo se demuestra que ARIA no alucina.** La respuesta no es "porque el prompt lo dice". Son tres mecanismos:
- Los casos de evaluación con jueces deterministas: cifras respaldadas, cero identificación de personas, limitaciones declaradas y acciones concretas.
- La bitácora de cada consulta en producción: latencia, tokens, `sampleLimited`, cifras sin respaldo y feedback 👍/👎 del usuario.
- Un reporte semanal que resume todo lo anterior.

## 4. Limitaciones

- **La corrida live aprueba 36 de 48 casos (75 %).** Fallas principales: totales de compra calculados que el juez no puede verificar, resúmenes sin acciones explícitas y un caso de privacidad que repite la palabra "sancionar". El siguiente paso es fijar un umbral en CI.
- **Los jueces son heurísticos** (regex y conjuntos de cifras). Una cifra derivada correcta, como el "presupuesto restante", puede marcarse como sin respaldo, y una respuesta puede pasar los jueces y aun así ser poco útil. Por eso existe el feedback del usuario.
- **El piloto fue en una sola planta durante 2 meses.** Los resultados no se pueden extrapolar sin más datos. Las métricas de consumo de ARIA se marcan como parciales cuando la lectura llega a su límite de 2,000 asignaciones.
- **El kiosko depende de conectividad.** El modo sin conexión es solo para demostración.
- **Las reglas versionadas todavía se editan por API.** Falta un editor visual.

## 5. Aprendizajes

- Lo crítico vive en el servidor y en transacciones. Las reglas de Firestore son la segunda barrera, no la primera.
- Un asistente de IA útil en operación necesita límites explícitos **y medición**: un dataset de evaluación, jueces auditables y bitácora por consulta.
- Sacar las reglas del código obliga a definir validación, versionado y rollback. Eso es precisamente lo que las hace seguras de cambiar.
- Los datos personales y las listas de permisos no pertenecen al repositorio, y el historial de Git también cuenta.
