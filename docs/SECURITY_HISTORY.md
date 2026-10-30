# Auditoría de secretos — mirror de demostración

Este repositorio es un **mirror sanitizado** del sistema original, publicado con **historial de Git nuevo**:
el historial del repo de producción (con varios autores y una API key web de Firebase ya retirada) nunca se copia aquí.

- Datos anonimizados: plantas **Norte/Sur**, empresa de ejemplo **DEMO CORP**, materiales y SKUs ficticios, sin nombres de personas.
- La configuración de Firebase es de ejemplo; las claves reales viven solo en variables de entorno (`.env*` está en `.gitignore`, `.env.example` no lleva valores).
- Cada port se revisa con `gitleaks git . --redact` y con una búsqueda de identificadores de la planta de origen antes de hacer commit.

En el repo de producción se decidió no reescribir el historial (varios autores, PRs fusionados) y restringir/rotar la API key web en Google Cloud Console.

## Cómo repetir la auditoría
```bash
gitleaks git . --redact
```
