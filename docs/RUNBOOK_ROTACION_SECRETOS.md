# Runbook — Rotación de secretos (Etapa 0 / SEC-03)

**No pegar valores de secretos en este archivo, tickets ni chats.**
Este runbook lista *qué* rotar y en qué orden. La ejecución requiere **aprobación explícita**.

## Credenciales y consumidores a evaluar

| Credencial / artefacto | Dónde se usa | ¿Rotar si… |
|---|---|---|
| Supabase **service_role** / secret | Edge Functions, scripts admin, `.env.local` | Apareció en zip, `passsupa.txt`, git o chat |
| Supabase **anon** / publishable | Cliente web (público por diseño) | Compromiso de app + abuso; rotar implica redeploy |
| DB password / **pooler** URL | Conexiones directas, CLI, integraciones | Estuvo en `supabase/.temp/pooler-url` o artefactos |
| Tokens **Vercel** (OIDC/token CLI) | Deploy, env de proyecto | Token de usuario o de integración filtrado |
| Secretos de Edge Function `passkey-auth` | Supabase Functions secrets | Tras rotar service role o si se redeploya la función |
| Sesiones de usuarios | Auth | Si hubo toma de cuenta sospechada: forzar sign-out global |

## Orden recomendado (forward-fix)

1. **Backup** de base y export de env de Vercel (dashboard, no a git).
2. **Supabase → Project Settings → API**: generar nuevo service role; actualizar:
   - Vercel project env (`SUPABASE_SERVICE_ROLE_KEY` si existe)
   - Secrets de Edge Functions
   - `.env.local` local de operadores (fuera de git)
3. **Database password / pooler**: reset en dashboard; actualizar connection strings solo en gestores de secretos.
4. **Vercel**: invalidar tokens personales de CLI afectados (`vercel logout` + re-login); revisar env del proyecto.
5. **Redeploy** de la app y de `passkey-auth` (ya contenida) para tomar secretos nuevos.
6. **Auth**: si el incidente lo justifica, revocar sesiones (dashboard Auth) — solo con aprobación.
7. **Verificación**: login contraseña OK; catálogo OK; panel autenticado OK; **no** reactivar passkeys.
8. **Documentar** en registro de incidente (privado): hora, qué se rotó, evidencia de redeploy — **sin valores**.

## Purga de historial Git

- Si secretos reales estuvieron en commits de `main`/`origin`: planificar `git filter-repo` / BFG **con backup y aprobación**.
- Borrar el archivo local **no** elimina historial remoto ni clones.
- Mientras tanto: rotar primero (el secreto viejo queda inválido).

## Exclusiones de repo (ya en `.gitignore`)

- `passsupa.txt`, `.env*`, `supabase/.temp/`, `*.zip`, dumps/backups

## Post-rotación

- [ ] Nuevo service role no aparece en git (`git log -S` no debe mostrar el valor nuevo)
- [ ] Edge Function contenida sigue respondiendo 403 a passkeys
- [ ] Vercel preview/prod levantan con env actualizados
