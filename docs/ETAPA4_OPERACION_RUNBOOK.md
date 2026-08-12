# Etapa 4 — Operación y recuperación

- **Estado local:** procedimientos documentados + 404/error UI
- **RPO/RTO:** **propuestas** pendientes de decisión de negocio
- **Fecha:** 2026-08-12
- **Vercel autorizado:** solo `ilara` (`prj_l1212uETlGghvn8jChfiXCp68SzN`)
- **Supabase prod:** `qbbnvdmadgomfmrsfxlo`

## 1. RPO / RTO — propuestas (NO decidido por el dueño)

| Métrica | **Propuesta** (no binding) | Notas |
|---|---|---|
| RPO (pérdida máxima de datos) | **24 h** (alineado a backups diarios de Supabase Pro) | Si el plan es Free, el RPO efectivo puede ser peor; validar plan actual |
| RTO (tiempo de recuperación) | **4–8 h** para restore de DB + redeploy app | Depende de práctica de restore y disponibilidad del owner |

**Acción requerida del owner:** confirmar o modificar RPO/RTO y el plan de
Supabase (PITR si aplica).

## 2. Backup (procedimiento reproducible — no ejecutado aquí)

### 2.1 Backup automático Supabase

1. Dashboard Supabase → proyecto `ilara-app` / ref `qbbnvdmadgomfmrsfxlo`.
2. Database → Backups: anotar retención y si hay PITR.
3. Exportar evidencia (screenshot privado, sin datos) con fecha.

### 2.2 Dump lógico manual (aislado)

```bash
# NO ejecutar contra prod desde CI. Solo owner en máquina controlada.
# Ejemplo de dump (ajustar connection string del pooler/direct):
# pg_dump "$DATABASE_URL" --format=custom --file="backups/manual-$(date +%Y%m%d).dump"
```

Conservar dumps **fuera del git** (ya hay exclusiones). No commitear dumps.

### 2.3 Backup de código

- Git `main` + tags de release.
- Vercel deployment history del proyecto **ilara**.

## 3. Restauración aislada (validación local — no prod)

**Objetivo:** practicar restore sin tocar producción.

```bash
cd /path/to/ilara-app
npx supabase start
npx supabase db reset --local   # reconstruye baseline + Stage 0–2 migraciones
npm run test:db-rls
# exportar keys: npx supabase status -o env
npm run test:db-security
```

**No afirmar** que se restauró producción. Sólo validar el flujo local.

Si se prueba un dump real:

1. Crear proyecto Supabase **temporal** o Postgres Docker.
2. Restore del dump.
3. Verificar conteos sanitizados (sin exportar PII).
4. Destruir el entorno temporal.

## 4. Deploy (solo proyecto Vercel `ilara`)

Preflight obligatorio: leer `docs/VERCEL_PROYECTO_AUTORIZADO.md`.

```bash
# 1. Checks locales verdes (lint, tsc, test, build, e2e local si aplica)
# 2. Commit en main (humano)
# 3. Push a origin/main → deployment Production – ilara
# 4. Smoke posdeploy de solo lectura:
#    SMOKE_BASE_URL=https://ilara.com.ar npm run test:smoke
```

**Prohibido:** crear/linkear proyecto `ilara-app` en Vercel.

## 5. Rollback

1. Vercel → proyecto `ilara` → Deployments → **Promote** del deployment previo bueno.
2. Si el fallo es migración DB: **no** re-aplicar ciegamente; usar restore/backup
   y plan de migración forward-only (Stages 0–3 ya aplicadas no se reescriben).
3. Confirmar con `npm run test:smoke` contra producción (solo lectura).

## 6. Rotación de secretos

Ver `docs/RUNBOOK_ROTACION_SECRETOS.md`. Resumen:

1. Rotar en Supabase (anon/service si expuestos).
2. Actualizar Vercel env del proyecto **ilara**.
3. Redeploy.
4. Invalidar sesiones si aplica.

## 7. Incidente

1. Contener (revocar keys, deshabilitar feature, rollback).
2. Evidencia con timestamps **sin** copiar PII a tickets públicos.
3. Alcance: logs Vercel + Supabase (lectura).
4. Comunicación al owner.
5. Postmortem breve en doc privada.

## 8. UI de error / 404 (implementado localmente)

| Ruta/archivo | Rol |
|---|---|
| `app/not-found.tsx` | 404 con enlaces a catálogo/login |
| `app/error.tsx` | Error de segmento + reintento + telemetría |
| `app/global-error.tsx` | Error raíz |
| `components/ui/ErrorState.tsx` | Componente reutilizable |

## 9. Smoke posdeploy

```bash
SMOKE_BASE_URL=https://ilara.com.ar npm run test:smoke
```

Valida: catálogo, login, headers seguridad, manifest, SW online-only, 404.
**Solo lectura.**
