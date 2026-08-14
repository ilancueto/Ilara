# Stage 6.5 — CRM mínimo

## Objetivo

Convertir la ficha de cliente en una herramienta operativa administrable sin
exponer información CRM sensible a vendedores, catálogo público ni usuarios
anónimos.

La ficha admin incluye:

- métricas netas: compras, importe bruto, devoluciones, neto y ticket medio;
- historial unificado de ventas y notas de crédito;
- hasta 10 etiquetas por cliente;
- notas internas append-only, archivables sin destruir evidencia;
- consentimiento para campañas con estado, origen, evidencia e historial.

## Modelo y veracidad

- `customer_tags`: catálogo interno de etiquetas.
- `customer_tag_assignments`: relación atómica cliente/etiqueta.
- `customer_notes`: notas internas; archivar registra fecha y usuario.
- `customer_consent_events`: eventos append-only. El estado vigente es siempre el
  último evento, no un booleano sobrescribible.
- Las métricas excluyen `pending_payment` y restan reintegros de Stage 6.3.
- Notas y consentimientos usan `ON DELETE RESTRICT`: un cliente con historia CRM
  no puede eliminarse hasta resolver explícitamente su retención. Las etiquetas
  asignadas sí se limpian con el cliente.

## Permisos

- Las cuatro tablas tienen RLS habilitado y ningún grant para `anon` ni
  `authenticated`.
- `service_role` conserva acceso operativo para migraciones y recuperación.
- Los RPC son `SECURITY DEFINER`, fijan `search_path = ''`, exigen sesión y
  `is_app_admin()` internamente.
- El vendedor conserva la ficha básica de cliente/POS, pero no puede leer ni
  mutar etiquetas, notas, consentimientos o métricas CRM.
- El cliente browser nunca contiene `service_role`.

RPC públicos para usuarios autenticados, con autorización interna:

- `customer_crm_profile(integer)`
- `customer_crm_tags()`
- `customer_crm_upsert_tag(bigint,text,text)`
- `customer_crm_set_tags(integer,bigint[])`
- `customer_crm_add_note(integer,text)`
- `customer_crm_archive_note(bigint)`
- `customer_crm_record_consent(integer,boolean,text,text)`

## Operación

El admin abre **Clientes → Ver perfil**. El panel CRM se carga dinámicamente para
no enviar ese módulo a vendedores. Registrar una autorización o revocación crea
un nuevo evento; no modifica los anteriores.

No registrar información médica, documentos, tarjetas, contraseñas ni secretos
en notas o evidencia. El consentimiento significa permiso de marketing y no
reemplaza requisitos legales/fiscales externos.

## Migración y recuperación

Migración: `20260814024158_stage65_customer_crm.sql`.

Es forward-only. Ante un problema:

1. ocultar temporalmente el panel CRM;
2. revocar `EXECUTE` a `authenticated` en los RPC afectados si existe riesgo de
   confidencialidad;
3. corregir mediante una nueva migración;
4. no borrar tablas de notas/consentimiento ni revertirlas destructivamente.

## Validación local

- dos reconstrucciones completas desde cero con la migración Stage 6.5;
- integración CRM: 7/7, incluidos roles, tablas cerradas, métricas netas,
  devolución, pendiente, etiquetas, notas, consentimiento y protección de borrado;
- unitarios globales: 130/130;
- RLS: 29/29 tablas; matriz anon/service y security advisors verdes;
- lint, TypeScript, tipos generados y build Next.js 16.3 verdes;
- Playwright CRM: 1/1, sin violaciones axe críticas.

## Cierre productivo

Pendiente en esta misma etapa: commit/push, CI remoto, migración Supabase
productiva, deployment Vercel `ilara`, smoke y actualización final de evidencia.
