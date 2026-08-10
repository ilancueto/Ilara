# Etapa 0 — Preservación y diagnóstico (pre-despliegue)

Documento operativo de contención. **No copiar PII, secretos ni comprobantes** a tickets, chats o este archivo.

## Antes de aplicar migraciones o redeploy en producción

### 1. Roles y ventana

- [ ] Responsable técnico, responsable de incidente y aprobador de negocio designados.
- [ ] Hora de inicio de contención registrada (UTC y hora local).
- [ ] Cuenta de prueba autorizada y otra no autorizada preparadas en **staging** (no en prod si se puede evitar).

### 2. Logs a preservar (exportar / no rotar hasta análisis)

| Fuente | Qué conservar | Notas |
|---|---|---|
| Supabase Auth | Logs de login, sign-up, recovery (ventana del incidente) | Dashboard → Logs |
| Supabase Edge Functions | Invocaciones de `passkey-auth` | Sin pegar cuerpos con emails |
| Supabase Data API / Postgres | Consultas anónimas si el plan de logging lo permite | Solo metadatos si hay PII |
| Supabase Storage | Accesos al bucket `receipts` | No descargar archivos a docs |
| Vercel | Deployments, function logs, request logs del periodo | Sanitizar |

### 3. Respaldo de base

- [ ] Crear backup verificable en el plan Supabase actual (o snapshot / `pg_dump` con acceso privilegiado).
- [ ] Comprobar que el artefacto es localizable (nombre, fecha, región) **sin** copiar su contenido a git.
- [ ] No versionar dumps en el repositorio.

### 4. Artefactos locales a no publicar

- `.env.local`, `passsupa.txt`, `*.zip` del repo, `supabase/.temp/*`
- Cualquier export de ventas/clientes

### 5. Bloqueos de acceso (sin eludir permisos)

Si falta permiso de dashboard, API o Storage, **registrar el bloqueo** y escalar; no usar workarounds con service role en scripts ad hoc sin aprobación.

## Criterio

Esta checklist se completa **antes** del primer deploy de contención. La implementación en repo puede existir sin haber desplegado; el gate de salida de Etapa 0 del `PLAN.md` exige verificación en el entorno objetivo.
