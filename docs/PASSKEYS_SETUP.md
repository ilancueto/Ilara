# Passkeys retiradas

La implementación histórica de passkeys fue eliminada el 23 de agosto de 2026.

- La interfaz no ofrece registro, vinculación ni login WebAuthn.
- No existe cliente `lib/passkeyAuth.ts` ni dependencia `supakeys`.
- La Edge Function `passkey-auth` conserva únicamente una respuesta de contención
  `403 PASSKEYS_DISABLED`, para que cualquier cliente viejo falle de forma explícita.
- Las tablas históricas permanecen cerradas por RLS hasta una migración de limpieza
  separada; no exponen endpoints operativos ni contienen secretos nuevos.

No desplegar una implementación de passkeys desde documentación o SQL antiguos. Una
eventual versión futura debe diseñarse y auditarse como funcionalidad nueva.
