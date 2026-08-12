# Passkeys v2 — diseño archivado (no activar)

**Estado (2026-08-12): DESCARTADO POR DECISIÓN DE NEGOCIO.** Ilara no utilizará
passkeys. La UI permanece retirada y todas las rutas responden 403 con
`PASSKEYS_CONTAINED = true`. Este documento se conserva sólo como evidencia
histórica; no es roadmap activo.

## Objetivos de seguridad

| Requisito | Diseño |
|---|---|
| Registro solo con sesión | Bearer JWT → `getUser()`; `auth.uid()` es el dueño |
| Challenge 1 uso | Tabla `passkey_challenges`: insert + delete atómico; TTL corto (≤5 min) |
| Vinculación de contexto | Challenge guarda `user_id`, `type`, `rp_id`, `origin`, `expires_at` |
| Origin / RP ID | Allowlist en secretos de Edge Function (`PASSKEY_RP_ID`, `PASSKEY_ORIGINS`) — nunca del cliente |
| Verificación crypto | `@simplewebauthn/server` verifyRegistration/Authentication |
| Login sin enumeración | Respuestas uniformes si no hay credencial; búsqueda por credential id indexado |
| Sin auto-crear usuarios | Prohibido `createUser` en registro |
| Replay | Challenge consumido; contador de autenticador actualizado |
| CORS | Solo orígenes allowlist |
| Rate limit | Por IP y por usuario (funciones existentes) |
| Auditoría | Eventos sin credential id completo ni PII sensible |

## Endpoints previstos (aún bloqueados globalmente)

1. `POST /register/start` — requiere sesión
2. `POST /register/finish` — verifica + inserta credencial del `auth.uid()`
3. `POST /login/start` — challenge de autenticación (discoverable o por allowCredentials)
4. `POST /login/finish` — verify + sesión (magic link hash o session admin controlada)
5. `list/remove/update` — solo dueño autenticado

Mientras `PASSKEYS_CONTAINED` es true, **todas** las rutas responden `403 PASSKEYS_DISABLED`.

## Activación gradual

1. Staging: setear secretos RP/origenes; desplegar función **sin** quitar contención; tests de integración.
2. Quitar contención **solo en staging** (`PASSKEYS_CONTAINED=false` + redeploy función y app).
3. Ejecutar matriz de pruebas (ver abajo).
4. Revisión humana explícita (checklist firmada en incidente/PR).
5. Producción: mismos secretos; deploy función; deploy app; smoke.
6. Monitoreo 24–48 h de rate limit y fallos de verify.

## Rollback

1. Restaurar `PASSKEYS_CONTAINED = true` en Edge Function y app.
2. Redeploy función + app.
3. Login por contraseña sigue operativo (no depende de passkeys).
4. No borrar credenciales existentes sin evidencia; solo dejar de usarlas.

## Matriz de pruebas obligatoria (antes de activar)

- [ ] Registro sin sesión → 401
- [ ] Usuario A no vincula credencial a B
- [ ] Origin o RP ID falsos → fail
- [ ] Challenge vencido / reusado → fail
- [ ] Login válido OK; replay fail
- [ ] No enumeración de emails por timing/mensaje
- [ ] Rate limit efectivo

## No hacer

- Activar UI de passkeys en Login mientras contención esté on.
- Aceptar `clientOrigin` / `rpId` del body del cliente como fuente de verdad.
- Crear usuarios en el flujo de registro passkey.
