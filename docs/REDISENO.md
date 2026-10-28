# Rediseño corporativo de AssetGuard

Fuente de verdad: `app/theme-corporate.css` (se importa al final en `app/layout.tsx`).

| Token | Claro | Oscuro |
|---|---|---|
| `--background` | #F3F5F7 | #0B0F11 |
| `--card` / `--surface` | #FFFFFF | #12171A |
| `--border` | #E2E7EB | #222B30 |
| `--primary` (acento) | #0B6B5C | #6FE3BE |
| `--warning` | #9A5B0B | #E3A15F |
| `--critical` | #B3382B | #F0866B |

Reglas
- Un solo acento. El rojo (`--critical`) es solo para estados críticos; la paleta `red-*` de Tailwind apunta a ese token.
- Sin degradados, brillos, sombras de color ni contadores animados.
- Tipografía: IBM Plex Sans (texto) e IBM Plex Mono (cifras, etiquetas `.section-eyebrow`).
- Consola: tema claro por defecto, con interruptor. Kiosko y portal siempre en oscuro.
- Panel de ARIA (`theme-keep`) mantiene su fondo oscuro fijo con valores literales.
- Texto sobre fondos de acento: `--primary-foreground` (blanco en claro, casi negro en oscuro).
