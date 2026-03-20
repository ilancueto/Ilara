# Nota – auditoría de dependencias (`npm audit`)

## Estado actual

**Fecha:** 2026-03-21

- **Next.js** actualizado a **16.2.0** (junto con `eslint-config-next` y `@next/bundle-analyzer` alineados).
- Tras `npm install`: **`npm audit` → 0 vulnerabilidades** (verificar de vez en cuando con `npm audit`).

## Mantenimiento

- Correr `npm audit` después de cambios grandes de dependencias.
- El proyecto usa **@serwist/next** (no el stack histórico `next-pwa` / workbox del doc antiguo de pentest).
