# Plan de implementación por etapas — Ilara

- **Fecha de planificación:** 9 de agosto de 2026
- **Fuente:** [`AUDITORIA.md`](./AUDITORIA.md)
- **Estado:** propuesto para ejecución
- **Horizonte técnico estimado:** 3 a 5 semanas para una persona dedicada
- **Unidad de esfuerzo:** día-persona, sin incluir funcionalidades nuevas de negocio

## 1. Objetivo y reglas de ejecución

El objetivo es cerrar primero los riesgos que pueden comprometer cuentas, datos o
dinero; después recuperar confiabilidad operativa y recién entonces ampliar el
producto. El orden de las etapas es deliberado y no debe invertirse.

Reglas de trabajo:

1. Ningún cambio de seguridad se aplica directamente en producción sin una
   migración o artefacto versionado, salvo contención de emergencia. Si hubiera
   una acción manual urgente, debe reproducirse inmediatamente en una migración.
2. Todo cambio de Supabase se prueba primero en local o staging, incluyendo
   `anon`, usuario autenticado permitido y usuario autenticado no permitido.
3. Para cada tabla expuesta se verifican por separado: esquema expuesto, `GRANT`,
   RLS y columnas accesibles. Ninguno de esos controles sustituye a los otros.
4. Las migraciones se crean con la CLI instalada y su comando vigente; no se
   inventan nombres ni timestamps manualmente.
5. Antes de desplegar una migración se ejecutan advisors, lista de migraciones,
   pruebas de autorización y un respaldo verificable.
6. No se copian secretos, correos, nombres de clientes ni comprobantes a tickets,
   logs de CI o documentos.
7. Cada cambio debe tener criterios de aceptación, rollback operativo y una
   persona revisora distinta de quien lo implementa cuando sea posible.
8. Los checks globales mínimos son lint, TypeScript, unitarios, build y E2E
   aplicables. Un build verde no reemplaza las pruebas de autorización.

## 2. Roles sugeridos

| Rol | Responsabilidad |
|---|---|
| Responsable técnico | Implementación, PR, migraciones y coordinación de deploy |
| Responsable de base | Revisar RLS, grants, funciones, Storage, advisors y backups |
| Responsable de negocio | Decidir reglas de precios, acceso por rol y políticas comerciales |
| Revisor/QA | Ejecutar criterios de aceptación y guardar evidencia sin datos sensibles |
| Responsable de incidente | Revisar logs, alcance de exposición y rotación de credenciales |

En un equipo pequeño una persona puede cubrir varios roles, pero la decisión de
precios y la aceptación del riesgo residual deben pertenecer al negocio.

## 3. Resumen de etapas

| Etapa | Plazo orientativo | Resultado | Bloquea la siguiente |
|---|---:|---|---|
| 0. Contención | 0–24 horas | Cerrar toma de cuentas y lectura anónima sensible | Sí |
| 1. Seguridad e integridad | 3–5 días | Reconstruir auth, precios y transacciones | Sí |
| 2. Gobierno de datos | 4–6 días | Base reproducible, tipada y verificable | Sí |
| 3. PWA y rendimiento | 3–5 días | Offline real y catálogo cacheable | No |
| 4. Calidad operativa | 5–8 días | E2E, a11y, observabilidad y recuperación | No |
| 5. Arquitectura incremental | 5–10 días | Reducir deuda sin reescritura | No |
| 6. Producto | Roadmap posterior | Pedidos, stock, devoluciones y reportes | No |

## 4. Etapa 0 — Contención inmediata

- **Objetivo:** reducir el riesgo activo sin esperar refactors ni rediseños.
- **Condición de inicio:** acceso a Supabase, Vercel y logs de producción.
- **Condición de salida:** todos los criterios de la sección 4.7 cumplidos.

### 4.1 Preparar ventana y evidencia

- [ ] Designar responsable técnico, responsable de incidente y aprobador de
  negocio.
- [ ] Registrar hora de inicio y preservar logs de Supabase Auth, Edge Functions,
  Data API, Storage y Vercel disponibles.
- [ ] Obtener un respaldo de base y comprobar que el artefacto puede localizarse.
- [ ] Crear una rama de contención con cambios pequeños; evitar mezclar refactors.
- [ ] Preparar una cuenta de prueba autorizada y otra no autorizada en staging.

**Entregable:** registro privado de incidente con timestamps y responsables, sin
datos personales copiados.

### 4.2 Contener passkeys — SEC-01

Orden recomendado:

1. Hacer que la Edge Function rechace temporalmente las rutas de passkey con una
   respuesta controlada.
2. Ocultar o desactivar el botón en login y mostrar acceso por contraseña.
3. Confirmar que el login tradicional y recuperación de cuenta siguen funcionando.
4. Revisar usuarios y credenciales passkey creados desde el despliegue de la
   función; no eliminarlos sin preservar evidencia y evaluar sesiones activas.

Checklist:

- [x] Registro de passkey no disponible en producción. *(código en repo; **requiere deploy de Edge Function**)*
- [x] Login por passkey no disponible hasta completar la etapa 1. *(UI + cliente; **requiere deploy app + función**)*
- [ ] Login por contraseña verificado en desktop y mobile. *(pendiente smoke post-deploy)*
- [x] Respuestas de la Edge Function no incluyen secretos ni información de
  existencia de correos. *(respuesta fija `PASSKEYS_DISABLED`; **requiere deploy función**)*

**Rollback:** volver a la versión anterior de la UI solamente si la Edge Function
continúa bloqueada; no reactivar el flujo vulnerable para recuperar comodidad.

### 4.3 Cerrar exposición anónima — SEC-02

Separar la corrección en dos cambios desplegables:

**Cambio A: ventas**

- [x] Inventariar políticas y grants efectivos de `sales` y `sale_items`. *(versionado en repo + migraciones stage0)*
- [x] Revocar acceso directo de `anon` y eliminar políticas públicas obsoletas. *(migración `stage0_close_anon_sales`; **no aplicada en prod**)*
- [x] Mantener únicamente el RPC agregado requerido por el orden del catálogo,
  con retorno mínimo y sin nombres, notas, pagos, usuarios ni comprobantes. *(reafirmado en `stage0_harden_catalog_sales_rpc`)*
- [x] Verificar que el RPC no sea `SECURITY DEFINER` público sin comprobaciones y
  que tenga `search_path` fijo si necesita privilegios elevados. *(search_path=public; REVOKE PUBLIC; GRANT solo anon/authenticated)*

**Cambio B: catálogo de productos**

- [x] Definir el DTO público: identificador, nombre, descripción pública, precio
  de venta, descuento, imágenes, categoría, badge y disponibilidad estrictamente
  necesaria. *(`lib/catalog/publicCatalogSelect.ts`)*
- [x] Excluir precio de compra, notas internas, stock mínimo, auditoría y cualquier
  otro dato operativo. *(código + grants de migración `stage0_public_catalog_column_grants`)*
- [x] Reemplazar `select('*')` y `products(*)` por columnas explícitas. *(hooks + serverCatalog)*
- [x] Revocar el privilegio de tabla general y conceder sólo las columnas públicas,
  o usar una superficie pública equivalente correctamente protegida. *(migración preparada; **no aplicada en prod**)*
- [x] Mantener RLS para decidir qué productos/combos son visibles. *(políticas reafirmadas en migración)*

**Secuencia para evitar caída del catálogo:** desplegar primero el cliente con
selección explícita y la nueva superficie pública; validarla; recién después
revocar la superficie antigua.

### 4.4 Proteger comprobantes — STO-01

- [ ] Consultar el flag real del bucket `receipts` en producción. *(requiere dashboard / aprobación)*
- [x] Cambiarlo a privado mediante una migración versionada si fuera público. *(`stage0_receipts_private_bucket`; **no aplicada en prod**)*
- [x] Aplicar políticas por prefijo/propietario y prohibir listado anónimo. *(en migración)*
- [x] Servir descargas mediante URL firmada de corta duración. *(TTL 300s en `receiptStorage`)*
- [x] Verificar límites de tamaño y MIME en bucket y aplicación. *(app + migración; bucket en prod pendiente)*
- [ ] Comprobar con una ruta histórica que una URL directa anónima no descarga el
  archivo. *(ver `docs/STO01_VERIFICACION_RECEIPTS.md` post-apply)*

### 4.5 Evaluar y rotar secretos — SEC-03

- [ ] Determinar si `ilara-app.zip`, `passsupa.txt` o `pooler-url` salieron del
  equipo o llegaron a un remoto/artefacto. *(decisión de negocio / incidente)*
- [ ] Rotar service role/secret de Supabase si pudo quedar expuesto. *(runbook listo; **requiere aprobación**)*
- [ ] Rotar contraseña y credenciales de pooler cuando corresponda.
- [ ] Invalidar tokens de Vercel aún vigentes.
- [ ] Purgar secretos reales del historial con coordinación y respaldo.
- [x] Añadir `supabase/.temp/`, ZIPs y respaldos a las exclusiones apropiadas.
- [x] Mantener `.env.example` sin valores y usar el gestor de secretos del entorno. *(sin cambios de valores; runbook en `docs/RUNBOOK_ROTACION_SECRETOS.md`)*

**Nota:** borrar el archivo actual no elimina copias, historial, caches o clones.

### 4.6 Corregir JSON-LD — SEC-04

- [x] Escapar `<` como `\\u003c` antes de insertar el JSON-LD. *(`serializeJsonLd`)*
- [x] Añadir una prueba con nombre/notas que contengan `</script>`.
- [x] Verificar que el resultado siga siendo JSON-LD válido. *(tests unitarios)*
- [ ] Desplegar independientemente del futuro endurecimiento de CSP.

### 4.7 Gate de salida de contención

La etapa 0 termina únicamente cuando:

- [ ] Una petición anónima a `sales` devuelve acceso denegado o cero superficie. *(migración lista; verificar post-apply)*
- [ ] Una petición anónima a `sale_items` devuelve acceso denegado o cero
  superficie.
- [ ] Una petición anónima no puede solicitar `purchase_price`, notas internas ni
  campos de auditoría de productos.
- [ ] El catálogo público sigue mostrando productos, combos y orden agregado.
- [ ] Ningún comprobante puede abrirse sin autorización o URL firmada válida.
- [ ] Passkeys están desactivadas y contraseña funciona. *(código listo; falta deploy + smoke)*
- [x] JSON-LD resiste el payload hostil de prueba. *(en repo; smoke HTML post-deploy recomendado)*
- [ ] Existe una decisión documentada sobre rotación y alcance del incidente.

## 5. Etapa 1 — Seguridad e integridad del negocio

**Objetivo:** reconstruir las funciones desactivadas y asegurar que toda venta
tenga un resultado autoritativo y consistente.

### 5.1 Rediseñar passkeys — SEC-01

- [x] Diseño v2 documentado (`docs/PASSKEYS_V2.md`); contención sigue activa.
- [ ] Mantener RP ID, nombre y orígenes en secretos/configuración de servidor. *(pendiente activación)*
- [ ] Exigir bearer token y resolver la identidad con `getUser()` en registro.
- [ ] Vincular cada challenge a `auth.uid()`, acción, RP ID, origen y expiración.
- [ ] Consumir el challenge de manera atómica y rechazar reuso.
- [ ] Impedir que registro cree/confirme usuarios o acepte otro correo.
- [ ] Para login, buscar credenciales por ID indexado sin enumerar usuarios.
- [ ] Aplicar CORS allowlist y rate limiting por IP/cuenta con límites razonables.
- [ ] Fijar `search_path`, revocar `EXECUTE` de `PUBLIC` y conceder sólo a roles
  necesarios en funciones privilegiadas.
- [ ] Registrar eventos de seguridad sin credential IDs completos ni PII.
- [x] UI y endpoints **no activados** hasta checklist de activación.

Pruebas obligatorias (antes de quitar contención):

- [ ] Registro sin sesión devuelve 401.
- [ ] Usuario A no puede vincular una credencial a usuario B.
- [ ] Origen o RP ID falsificado falla.
- [ ] Challenge vencido o reutilizado falla.
- [ ] Login válido funciona y el replay falla.
- [ ] No se puede descubrir si un correo existe por diferencias de respuesta.

### 5.2 Formalizar autorización — AUTH-01

- [x] Roles: `admin`, `vendedor`, `none` (`docs/ETAPA1_ROLES_Y_PRECIOS.md`).
- [x] Tabla `user_roles` + helpers DEFINER (`search_path=''`) + `set_user_role` (lock + last_admin).
- [x] `bootstrap_first_admin(uuid)` solo **service_role**, lock 87201411, sin autoclaim en UI.
- [x] RLS por rol; `user_roles_select_admin` reafirmada tras 21412; sin DELETE directo ventas.
- [x] RPC POS DEFINER endurecido; payment_breakdown estricto; vendedor sin UPDATE products.
- [x] Frontend UX por rol; **no** es fuente de autorización.
- [x] Tests de secuencia de migraciones + integración (fail si STAGE1=1 incompleto; skip si off).
- [x] Preflight 21412 preserva las policies anon del catálogo Stage 0; delete venta usa lock de fila.
- [x] Decisión de negocio: no asignar `vendedor` en el corto/mediano plazo; el rol
  queda dormido y la superficie POS reducida se difiere hasta que vaya a utilizarse.
- [x] Migración 20260812002815 revoca grants heredados peligrosos, helpers internos
  públicos y la policy amplia de actualización de recibos.
- [x] Roles productivos: dos cuentas `admin`, cero `vendedor` (2026-08-12).
- [x] Revisión de seguridad pre-deploy y advisors ejecutados tras migrar Supabase.

### 5.3 Unificar precios del POS — DATA-01

Decisión de negocio (documentada en repo):

- [x] **Opción A:** POS cobra precio de lista; descuento web solo catálogo.
- [x] Combos: `combos.sale_price`; histórico en `sale_items.unit_price/subtotal`.
- [x] RPC recalcula total e ignora `unit_price`/`total`/`product_name`/descuentos del cliente.
- [x] Valida status, payment_method, breakdown (mixto, suma, métodos, montos > 0).
- [x] Devuelve `sale` + `lines` autoritativos; UI/comprobante usan respuesta RPC.
- [x] Preview UI alineada (`totalCarritoPos` / `precioLista*`).
- [x] Rechaza `line_type` inválido, precios catálogo ≤ 0, productos inexistentes; qty enteras > 0.
- [ ] Smoke autenticado en producción después del deploy de la app.

Criterio de aceptación:

- [x] Implementado en migraciones/app en repositorio.
- [ ] **No** “listo para deploy automático”: falta revisión humana + smoke staging/prod.
- [ ] Validado en entorno con roles reales post-deploy.

### 5.4 Transacciones de inventario — DATA-03

- [ ] Crear RPC transaccional para actualizar combo y todos sus ítems.
- [ ] Validar componentes existentes, cantidades positivas y combo no vacío.
- [ ] Convertir visibilidad/badges masivos a una operación por lote.
- [ ] Para borrados masivos, devolver éxitos/fallos explícitos o usar atomicidad
  según la decisión de negocio.
- [ ] Añadir pruebas de rollback ante un componente inválido.

### 5.5 Ciclo de vida de archivos — STO-01

- [ ] Centralizar validación de MIME, extensión y tamaño.
- [ ] Usar nombres no predecibles y rutas por propietario/entidad.
- [ ] Eliminar el objeto nuevo si falla la persistencia de su entidad.
- [ ] Eliminar el objeto anterior después de confirmar un reemplazo.
- [ ] Añadir tarea segura de detección de huérfanos con modo dry-run.

### 5.6 Gate de salida de etapa 1

- [ ] Suite de passkeys negativa y positiva verde *(passkeys siguen contenidas; v2 no activado)*.
- [x] Matriz de autorización definida en repo; pendiente aprobación negocio + smoke prod.
- [x] Tests unitarios/estructurales de roles y precios en CI local.
- [x] Matriz Stage 0 + Stage 1: 25/25 sobre instancia local restaurada desde el
  esquema productivo, sin datos de usuarios.
- [ ] Tests de ventas y stock verdes sobre base real de staging.
- [ ] Prueba de rollback de combo (DATA-03, fuera del núcleo de esta entrega).
- [ ] Política de archivos y retención (STO-01 lifecycle, parcial en Etapa 0).

## 6. Etapa 2 — Gobierno y reproducibilidad de datos

**Objetivo:** poder crear, auditar y recuperar el entorno sin scripts manuales ni
estado oculto en el dashboard.

### 6.1 Consolidar migraciones — DATA-02

- [ ] Inventariar objetos de `supabase/sql`, `supabase/migrations` y producción.
- [ ] Elegir un baseline que reconstruya tablas, constraints, índices, funciones,
  triggers, grants, RLS, Storage y datos de referencia no sensibles.
- [ ] Marcar scripts manuales históricos como archivados; no borrarlos hasta
  validar el baseline.
- [ ] Crear una base vacía y ejecutar el flujo completo desde cero.
- [ ] Comparar el resultado con staging mediante schema diff.
- [ ] Ejecutar advisors y corregir warnings de seguridad/performance.
- [ ] Guardar evidencia de `migration list` local y remoto.

### 6.2 Tipos y validación

- [ ] Generar tipos TypeScript desde el esquema versionado.
- [ ] Eliminar gradualmente tipos manuales duplicados y casts desde `unknown`.
- [ ] Añadir validación de payloads en Server Actions, Route Handlers y límites de
  RPC; no confiar sólo en tipos de compilación.
- [ ] Versionar el comando de regeneración y comprobar diff en CI.

### 6.3 Pruebas de seguridad de base en CI

- [ ] Levantar Supabase local o un staging efímero.
- [ ] Aplicar todas las migraciones desde cero.
- [ ] Ejecutar matriz de acceso `anon` / roles autenticados / service role.
- [ ] Probar columnas públicas, ventas, clientes, gastos, comprobantes y RPC.
- [ ] Fallar CI si una tabla expuesta carece de RLS o grants declarados.
- [ ] Ejecutar advisors y conservar un reporte sanitizado.

### 6.4 Gate de salida de etapa 2

- [ ] `supabase db reset` o flujo equivalente reconstruye el entorno.
- [ ] No quedan cambios de esquema aplicados sólo desde dashboard.
- [ ] Tipos generados coinciden con el esquema.
- [ ] CI detecta una política anónima permisiva introducida deliberadamente en una
  prueba de control.

## 7. Etapa 3 — PWA y rendimiento

### 7.1 Reparar PWA — PWA-01

- [ ] Elegir Serwist con integración Turbopack soportada/configurador o build con
  Webpack; registrar la decisión en un ADR breve.
- [ ] Generar iconos cuadrados reales de 192 × 192, 512 × 512 y 180 × 180.
- [ ] Definir icono maskable y colores de theme/background coherentes.
- [ ] Asegurar que el build genera el service worker esperado.
- [ ] Verificar `/sw.js` con status 200, JavaScript MIME, `no-cache`/`no-store` y
  CSP restringida para service worker.
- [ ] Definir qué funciona offline y evitar cachear respuestas privadas o datos de
  sesión.
- [ ] Añadir aserción posbuild y smoke test posdeploy.

### 7.2 Recuperar cache del catálogo — PERF-01

- [ ] Crear cliente de Supabase público y server-only que no invoque `cookies()`.
- [ ] Consultar sólo el DTO público definido en etapa 0.
- [ ] Aplicar ISR, cache tags o revalidación explícita según frecuencia de cambios.
- [ ] Invalidar cache después de cambios de catálogo relevantes.
- [ ] Medir TTFB, cache hit y carga de imágenes antes/después.

### 7.3 Optimización medida

- [ ] Corregir advertencia ESM de configuración de Vitest.
- [ ] Revisar `content-visibility` en impresión, scroll rápido y screenshots.
- [ ] Ejecutar análisis de bundle y optimizar sólo chunks con impacto medido.
- [ ] Revisar tamaños/dimensiones de assets y `sizes` de imágenes.

### 7.4 Gate de salida de etapa 3

- [ ] PWA instalable en Chrome/Android y comportamiento offline documentado.
- [ ] `/sw.js` verificado automáticamente después del deploy.
- [ ] Catálogo público cacheable sin exponer cookies ni campos internos.
- [ ] No se cachean respuestas autenticadas o comprobantes.

## 8. Etapa 4 — Calidad operativa

### 8.1 E2E y CI — TEST-01

- [ ] Instalar navegadores Playwright en CI con cache compatible.
- [ ] Actualizar el smoke test del encabezado del catálogo.
- [ ] Cubrir login, autorización, venta, stock, combos, gastos, comprobantes,
  carrito, cupón, WhatsApp, PWA y mobile.
- [ ] Usar datos de prueba aislados y limpieza determinista.
- [ ] Ejecutar lint, tipos, unitarios, integración, E2E y build en cada PR.
- [ ] Añadir smoke tests posdeploy para catálogo, login, headers y service worker.

### 8.2 Observabilidad — OBS-01

- [ ] Integrar Sentry, OpenTelemetry o equivalente en cliente, servidor y Edge
  Functions.
- [ ] Definir sanitización de PII y secretos antes de enviar eventos.
- [ ] Añadir correlation/request ID y errores estructurados.
- [ ] Crear alertas para fallos de login, RPC de venta, Storage y errores 5xx.
- [ ] Registrar métricas de negocio técnicas sin datos personales: ventas fallidas,
  conflictos de stock, latencia y tasa de error.
- [ ] Documentar runbooks para cada alerta.

### 8.3 Accesibilidad — A11Y-01

- [ ] Crear un componente Dialog único con focus trap, Escape, restauración de
  foco, fondo inerte, scroll lock y labels.
- [ ] Migrar passkeys, gastos, inventario, ventas y confirmaciones.
- [ ] Sustituir `div onClick` por botones/enlaces semánticos.
- [ ] Sustituir `confirm()` por diálogo accesible y testeable.
- [ ] Ejecutar axe y recorrido sólo con teclado en desktop/mobile.

### 8.4 Recuperación y operación

- [ ] Definir RPO y RTO con negocio.
- [ ] Automatizar backup adicional si el plan de Supabase lo requiere.
- [ ] Ejecutar una restauración completa en entorno aislado.
- [ ] Documentar deploy, rollback, rotación de secretos y respuesta a incidentes.
- [ ] Añadir página 404 y estados uniformes de error/reintento.

### 8.5 Gate de salida de etapa 4

- [ ] CI completo verde y obligatorio para merge.
- [ ] Alertas probadas mediante un error sintético.
- [ ] Flujos principales completables sólo con teclado.
- [ ] Restauración ejecutada y tiempo medido.

## 9. Etapa 5 — Arquitectura incremental

**Objetivo:** reducir deuda sin una reescritura que ponga en riesgo la operación.

- [ ] Crear una DAL `server-only` para operaciones sensibles y autorización cerca
  de la fuente de datos.
- [ ] Separar cliente público de catálogo, cliente browser autenticado y cliente
  server-side.
- [ ] Organizar por módulos verticales: ventas, inventario, clientes, gastos y
  catálogo.
- [ ] Extraer primero lógica pura y servicios de los componentes mayores de 600
  líneas; mantener PRs pequeños.
- [ ] Definir contratos/DTO y evitar entidades de base completas en la UI.
- [ ] Centralizar manejo de errores, loading, formularios y confirmaciones.
- [ ] Añadir `server-only` a módulos que utilicen secretos o datos internos.
- [ ] Actualizar README a Node `>=20.9.0` y enlazar sólo esta auditoría y este plan
  como fuentes vigentes.
- [ ] Marcar roadmaps históricos como archivados para eliminar contradicciones.

Criterio de salida:

- [ ] Ningún secreto o service role puede entrar en un bundle de cliente.
- [ ] Los componentes principales quedan por debajo de un tamaño acordado o tienen
  responsabilidades claramente separadas.
- [ ] Cada módulo tiene al menos pruebas de su lógica crítica.

## 10. Etapa 6 — Roadmap de producto

Esta etapa comienza sólo después de cerrar las etapas 0–2. El orden final depende
de valor comercial y capacidad operativa.

1. **Pedidos desde catálogo:** convertir el carrito/WhatsApp en una orden con
   estados, trazabilidad y validación de stock.
2. **Alertas de reposición:** stock menor o igual a mínimo, sugerencia de compra y
   responsable de resolución.
3. **Devoluciones y notas de crédito:** reversión trazable de pagos y stock sin
   editar ventas históricas.
4. **Reportes de margen:** usar precio de compra histórico, descuentos y costos,
   no sólo facturación.
5. **CRM mínimo:** historial, etiquetas y consentimiento para campañas.
6. **Cuentas por cobrar/pagar y conciliación:** saldos, vencimientos y estados.
7. **B2B, pagos online o multisucursal:** evaluar sólo cuando la operación actual
   tenga autorización granular y observabilidad.

Cada feature debe incluir antes de desarrollo:

- hipótesis y métrica de éxito;
- modelo de permisos;
- impacto en stock, precios y auditoría;
- migración reversible/forward-fix;
- pruebas y runbook operativo.

## 11. División sugerida en cambios/PR

| Orden | Cambio | Contenido |
|---:|---|---|
| 1 | `SEC-contencion-passkeys-jsonld` | Bloqueo de passkeys y escape JSON-LD |
| 2 | `DB-cierre-anon` | Grants/RLS de ventas y catálogo público mínimo |
| 3 | `STORAGE-receipts-private` | Bucket privado, políticas y URLs firmadas |
| 4 | `SEC-passkeys-v2` | Rediseño completo y tests de seguridad |
| 5 | `BUS-pos-authoritative-pricing` | Regla de precios y RPC autoritativo |
| 6 | `DB-atomic-inventory` | Combo y operaciones masivas transaccionales |
| 7 | `DB-migration-baseline` | Reproducibilidad, tipos y tests de RLS |
| 8 | `PWA-serwist` | Service worker, iconos y smoke posdeploy |
| 9 | `PERF-public-catalog-cache` | Cliente público sin cookies e ISR/cache |
| 10 | `OPS-e2e-observability-a11y` | CI, tracing, dialogs y recuperación |

No agrupar cambios 1–6 en un único PR: requieren rollback y validación
independientes.

### 11.1 Orden de deploy de contención (Etapa 0)

Fuente vigente: [`docs/ETAPA0_ORDEN_DEPLOY.md`](./docs/ETAPA0_ORDEN_DEPLOY.md).

1. Backup y preservación de logs
2. Deploy Edge Function `passkey-auth` bloqueada
3. RPC agregado (`stage0_harden_catalog_sales_rpc`)
4. Cierre anon sales/sale_items (`stage0_close_anon_sales`)
5. Deploy app (DTO público, UI, JSON-LD)
6. Grants catálogo column-level (`stage0_public_catalog_column_grants`, REVOKE anon+PUBLIC)
7. Pruebas integración anon/positivas/cross-user (`npm run test:integration`)
8. Migración legacy receipts + bucket privado estricto (`stage0_receipts_private_bucket`)

### 11.2 Forward-fix Stage 0 (inventario legacy)

| Migración | Estado | Acción |
|---|---|---|
| `stage0_revoke_authenticated_legacy_inventory` | **Aplicado y verificado en producción** | REVOKE EXECUTE de `stage0_inventory_legacy_receipt_urls()` a `authenticated`; EXECUTE solo `service_role` |

No reabrir EXECUTE a `authenticated`. No reabrir anon.

## 12. Checklist global de Definition of Done

Un ítem sólo puede marcarse terminado si:

- [ ] Tiene código/migración y documentación versionados.
- [ ] Incluye pruebas positivas y negativas proporcionales al riesgo.
- [ ] Lint, tipos, unitarios y build están verdes.
- [ ] Integración/E2E relevante está verde.
- [ ] Se verificó en staging con roles reales.
- [ ] Tiene plan de despliegue y recuperación/forward-fix.
- [ ] No registra PII ni secretos.
- [ ] Los criterios de aceptación fueron validados por QA/revisor.
- [ ] Se desplegó y pasó smoke test posdeploy.
- [ ] `AUDITORIA.md` y este plan se actualizaron si cambió el riesgo residual.

## 13. Métricas de cierre

| Métrica | Objetivo |
|---|---:|
| Filas sensibles accesibles por `anon` | 0 |
| Columnas internas accesibles desde catálogo | 0 |
| Registro passkey sin sesión aceptado | 0 |
| Diferencia UI / base / comprobante | $0 |
| Migraciones reproducibles desde cero | 100 % |
| E2E críticos ejecutados en CI | 100 % |
| `/sw.js` después de deploy | HTTP 200 |
| Errores 5xx sin traza/correlation ID | 0 |
| Restauraciones ensayadas | al menos 1 por trimestre |

## 14. Registro de avance

| Fecha | Etapa | Cambio | Estado | Evidencia / PR |
|---|---|---|---|---|
| 2026-08-09 | Planificación | Creación de auditoría y plan vigente | Completado | `AUDITORIA.md`, `PLAN.md` |
| 2026-08-09 | 0 Contención | Implementación en repo (passkeys, DTO catálogo, migraciones, JSON-LD, runbooks) | En curso | Sin deploy/prod aún; gate 4.7 pendiente |
| 2026-08-09 | 0 Contención | Fix bloqueadores: REVOKE PUBLIC, receipts límites explícitos, legacy documentado, tests integración, orden deploy | En curso | Ver docs/ETAPA0_ORDEN_DEPLOY.md |
| 2026-08-10 | 0 Contención | **Aplicado y verificado en producción** (passkey EF, migraciones stage0, Vercel ilara.com.ar, receipts private, 2 legacy migrados) | Verificado | Smoke anon 401 ventas; passkey 403; catálogo 200; receipts public=false |
| 2026-08-10 | 0 Contención | Forward-fix inventario legacy: REVOKE EXECUTE a authenticated | Verificado | Aplicado en prod (`*_stage0_revoke_authenticated_legacy_inventory.sql`) |
| 2026-08-10 | 0 Contención | Rotación de secretos (SEC-03) | Pendiente | Decisión de incidente; ver `docs/RUNBOOK_ROTACION_SECRETOS.md` |
| 2026-08-10 | 1 Seguridad e integridad | Roles + RLS + POS precios (Opción A) + passkeys v2 diseño | En curso | Primera versión en repo; **no desplegado** |
| 2026-08-11 | 1 Seguridad e integridad | Corrección integral Etapa 1 (frontera POS, bootstrap, RLS, pagos, tests, docs) | En revisión | `docs/ETAPA1_RUNBOOK.md`; **no desplegado**; pendiente review humana |
| 2026-08-11 | 1 Seguridad e integridad | Re-auditoría: user_roles policies post-21412, sin DELETE ventas, lock last_admin, breakdown estricto, tests secuencia | En revisión | Solo local; **no desplegado** |
| 2026-08-11 | 1 Seguridad e integridad | Corrección post-review: catálogo anon preservado, delete concurrente serializado, breakdown presente solo mixto, fixtures de roles restaurables | En revisión | Solo local; **no desplegado** |

Estados permitidos: `Pendiente`, `En curso`, `Bloqueado`, `En revisión`,
`Desplegado`, `Verificado` y `Completado`.
