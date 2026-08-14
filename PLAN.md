# Plan de implementación por etapas — Ilara

- **Fecha de planificación:** 9 de agosto de 2026
- **Fuente:** [`AUDITORIA.md`](./AUDITORIA.md)
- **Estado:** Etapas 0–7 cerradas en producción; Etapa 8 en roadmap
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
| 3. PWA y rendimiento | 3–5 días | PWA instalable online-only + catálogo ISR | No |
| 4. Calidad operativa | 5–8 días | E2E, a11y, observabilidad y recuperación | No |
| 5. Arquitectura incremental | 5–10 días | Reducir deuda sin reescritura | No |
| 6. Producto | Roadmap posterior | Pedidos, stock, devoluciones y reportes | No |
| 7. Envíos y logística | Roadmap posterior | Evaluar proveedores, cotizar y gestionar envíos | No |

## 4. Etapa 0 — Contención inmediata

**Estado (2026-08-12): CERRADA Y VERIFICADA EN PRODUCCIÓN.**

- **Objetivo:** reducir el riesgo activo sin esperar refactors ni rediseños.
- **Condición de inicio:** acceso a Supabase, Vercel y logs de producción.
- **Condición de salida:** todos los criterios de la sección 4.7 cumplidos.

### 4.1 Preparar ventana y evidencia

- [x] Responsable técnico y aprobación de negocio confirmados durante la ventana.
- [x] Logs de Supabase y Vercel revisados durante preflight y post-deploy.
- [x] Backup estructural pre-Stage 1 creado y localizado.
- [x] Cambios de contención versionados en commits acotados sobre `main` por
  decisión del propietario.
- [x] Matriz aislada con dos cuentas locales y smoke productivo con las dos cuentas
  reales.

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

- [x] Registro de passkey no disponible en producción (403 `PASSKEYS_DISABLED`).
- [x] Login por passkey retirado de UI y descartado por decisión de negocio.
- [x] Login por contraseña verificado con las dos cuentas reales.
- [x] Respuestas de la Edge Function no incluyen secretos ni información de
  existencia de correos (respuesta fija `PASSKEYS_DISABLED`).

**Rollback:** volver a la versión anterior de la UI solamente si la Edge Function
continúa bloqueada; no reactivar el flujo vulnerable para recuperar comodidad.

### 4.3 Cerrar exposición anónima — SEC-02

Separar la corrección en dos cambios desplegables:

**Cambio A: ventas**

- [x] Inventariar políticas y grants efectivos de `sales` y `sale_items`. *(versionado en repo + migraciones stage0)*
- [x] Revocar acceso directo de `anon` y eliminar políticas públicas obsoletas
  (aplicado; probe productivo 401).
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
- [x] Revocar el privilegio general y conceder sólo columnas públicas (aplicado;
  `purchase_price` anónimo devuelve 401).
- [x] Mantener RLS para decidir qué productos/combos son visibles. *(políticas reafirmadas en migración)*

**Secuencia para evitar caída del catálogo:** desplegar primero el cliente con
selección explícita y la nueva superficie pública; validarla; recién después
revocar la superficie antigua.

### 4.4 Proteger comprobantes — STO-01

- [x] Bucket `receipts` confirmado privado en producción.
- [x] Privacidad aplicada mediante migración versionada.
- [x] Aplicar políticas por prefijo/propietario y prohibir listado anónimo. *(en migración)*
- [x] Servir descargas mediante URL firmada de corta duración. *(TTL 300s en `receiptStorage`)*
- [x] Límites de tamaño y MIME verificados en bucket y aplicación.
- [x] Comprobante real verificado: URL firmada autorizada y acceso directo anónimo
  denegado.

### 4.5 Evaluar y rotar secretos — SEC-03

- [x] El propietario confirmó que ZIP, `passsupa.txt` y pooler permanecieron
  totalmente privados y nunca salieron del equipo.
- [x] Rotación de Supabase descartada para este incidente: no hubo exposición.
- [x] Rotación de pooler descartada por la misma evaluación.
- [x] Invalidación de tokens Vercel no requerida por este incidente.
- [x] Purga coordinada no requerida; exclusiones preventivas permanecen activas.
- [x] Añadir `supabase/.temp/`, ZIPs y respaldos a las exclusiones apropiadas.
- [x] Mantener `.env.example` sin valores y usar el gestor de secretos del entorno. *(sin cambios de valores; runbook en `docs/RUNBOOK_ROTACION_SECRETOS.md`)*

**Nota:** borrar el archivo actual no elimina copias, historial, caches o clones.

### 4.6 Corregir JSON-LD — SEC-04

- [x] Escapar `<` como `\\u003c` antes de insertar el JSON-LD. *(`serializeJsonLd`)*
- [x] Añadir una prueba con nombre/notas que contengan `</script>`.
- [x] Verificar que el resultado siga siendo JSON-LD válido. *(tests unitarios)*
- [x] Corrección desplegada y cubierta por prueba.

### 4.7 Gate de salida de contención

La etapa 0 termina únicamente cuando:

- [x] Una petición anónima a `sales` devuelve 401.
- [x] Una petición anónima a `sale_items` devuelve acceso denegado o cero
  superficie.
- [x] Una petición anónima no puede solicitar `purchase_price`, notas internas ni
  campos de auditoría de productos.
- [x] El catálogo público sigue mostrando productos, combos y orden agregado.
- [x] Ningún comprobante puede abrirse sin autorización o URL firmada válida.
- [x] Passkeys están desactivadas definitivamente y contraseña funciona.
- [x] JSON-LD resiste el payload hostil de prueba. *(en repo; smoke HTML post-deploy recomendado)*
- [x] Decisión documentada: artefactos privados, sin exposición ni rotación.

## 5. Etapa 1 — Seguridad e integridad del negocio

**Estado (2026-08-12): CERRADA Y VERIFICADA EN PRODUCCIÓN.** El núcleo de
autorización, precios, ventas, stock y receipts fue validado. DATA-03 y el lifecycle
ampliado de archivos permanecen como backlog explícito para etapas posteriores.

**Objetivo:** reconstruir las funciones desactivadas y asegurar que toda venta
tenga un resultado autoritativo y consistente.

### 5.1 Passkeys — SEC-01

- [x] Decisión de negocio: Ilara no utilizará passkeys.
- [x] UI retirada y Edge Function contenida globalmente con 403 fijo.
- [x] Helpers y tablas sin superficie directa para `anon`/`authenticated`.
- [x] Diseño v2 conservado únicamente como referencia histórica; no forma parte
  del roadmap activo ni del gate de cierre.

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
- [x] Smoke autenticado en producción con las dos cuentas admin: login, venta,
  precio, stock, eliminación y comprobante correctos.

Criterio de aceptación:

- [x] Implementado en migraciones/app en repositorio.
- [x] Revisión humana y smoke productivo completados.
- [x] Validado con las dos cuentas reales post-deploy.

### 5.4 Transacciones de inventario — DATA-03

**Backlog no bloqueante del cierre Stage 1; trasladado a arquitectura/calidad.**

- [ ] Crear RPC transaccional para actualizar combo y todos sus ítems.
- [ ] Validar componentes existentes, cantidades positivas y combo no vacío.
- [ ] Convertir visibilidad/badges masivos a una operación por lote.
- [ ] Para borrados masivos, devolver éxitos/fallos explícitos o usar atomicidad
  según la decisión de negocio.
- [ ] Añadir pruebas de rollback ante un componente inválido.

### 5.5 Ciclo de vida de archivos — STO-01

**Privacidad cerrada; lifecycle ampliado trasladado a calidad operativa.**

- [ ] Centralizar validación de MIME, extensión y tamaño.
- [ ] Usar nombres no predecibles y rutas por propietario/entidad.
- [ ] Eliminar el objeto nuevo si falla la persistencia de su entidad.
- [ ] Eliminar el objeto anterior después de confirmar un reemplazo.
- [ ] Añadir tarea segura de detección de huérfanos con modo dry-run.

### 5.6 Gate de salida de etapa 1

- [x] Passkeys fuera de alcance por decisión de negocio; contención 403 verificada.
- [x] Matriz de autorización aprobada y smoke productivo completado.
- [x] Tests unitarios/estructurales de roles y precios en CI local.
- [x] Matriz Stage 0 + Stage 1: 25/25 sobre instancia local restaurada desde el
  esquema productivo, sin datos de usuarios.
- [x] Venta, stock, eliminación y receipt verificados con cuentas reales en producción.
- [x] DATA-03 transferido explícitamente al backlog; no pertenece al núcleo cerrado.
- [x] Privacidad STO-01 verificada; lifecycle ampliado transferido a Stage 4/5.

## 6. Etapa 2 — Gobierno y reproducibilidad de datos

**Estado (2026-08-12): COMPLETADO, DESPLEGADO Y VERIFICADO.** Stage 0/1 no se
reabrieron.

**Objetivo:** poder crear, auditar y recuperar el entorno sin scripts manuales ni
estado oculto en el dashboard.

### 6.1 Consolidar migraciones — DATA-02

- [x] Inventariar objetos de `supabase/sql`, `supabase/migrations` y producción.
  *(`docs/STAGE2_INVENTORY.md`)*
- [x] Elegir un baseline que reconstruya tablas, constraints, índices, funciones,
  triggers, grants, RLS, Storage y datos de referencia no sensibles.
  *(`20250101000000_baseline_core_schema.sql` completo para greenfield; no reescribe
  historial remoto ya aplicado)*
- [x] Marcar scripts manuales históricos como archivados; no borrarlos hasta
  validar el baseline. *(`supabase/sql/README.md`)*
- [x] Crear una base vacía y ejecutar el flujo completo desde cero.
  *(`supabase db reset --local` incluye Stage 0 + 1 + 2)*
- [x] Comparar el resultado local con el remoto mediante schema diff.
  *(no existe staging; se contrastó local→producción en solo lectura y quedó
  documentado el residual bigint/serial y default privileges)*
- [x] Ejecutar advisors y clasificar warnings de seguridad/performance.
  *(local Stage 2: 0 security warn/error y 0 FKs sin índice; hosted conserva
  warnings previos/intencionales de RPC DEFINER y protección de contraseñas filtradas)*
- [x] Guardar evidencia de `migration list` local y remoto.
  *(ambos alineados hasta `20260812013913`)*

### 6.2 Tipos y validación

- [x] Generar tipos TypeScript desde el esquema versionado.
  *(`types/database.generated.ts`, `npm run db:types`)*
- [ ] Eliminar gradualmente tipos manuales duplicados y casts desde `unknown`.
  *(inventariados; refactor masivo fuera de alcance Stage 2)*
- [ ] Añadir validación de payloads en Server Actions, Route Handlers y límites de
  RPC; no confiar sólo en tipos de compilación. *(diferido a calidad/arquitectura)*
- [x] Versionar el comando de regeneración y comprobar diff en CI.
  *(`db:types`, `db:types:check`, job `db-security`)*

### 6.3 Pruebas de seguridad de base en CI

- [x] Levantar Supabase local o un staging efímero.
- [x] Aplicar todas las migraciones desde cero.
- [x] Ejecutar matriz de acceso `anon` / roles autenticados / service role.
  *(`scripts/db-security-matrix.mjs`; roles auth vía suite Stage 1)*
- [x] Probar columnas públicas, ventas, clientes, gastos, comprobantes y RPC.
- [x] Fallar CI si una tabla expuesta carece de RLS o grants declarados.
  *(`scripts/check-rls-coverage.mjs`)*
- [x] Ejecutar advisors y conservar un reporte sanitizado.
  *(`docs/ETAPA2_RUNBOOK.md` + clasificación advisors)*

### 6.4 Gate de salida de etapa 2

- [x] `supabase db reset` o flujo equivalente reconstruye el entorno. *(local)*
- [x] No quedan cambios de esquema aplicados sólo desde dashboard.
  *(nuevos cambios versionados; residual histórico documentado)*
- [x] Tipos generados coinciden con el esquema. *(check local)*
- [x] CI detecta una política anónima permisiva introducida deliberadamente en una
  prueba de control. *(`npm run test:db-insecure-control`)*
- [x] Deploy de `20260812013913` en producción + smoke no mutante.
  *(sitio/catálogo 200; ventas/campos internos anon 401; passkeys 403)*

## 7. Etapa 3 — PWA y rendimiento

**Estado (2026-08-12): COMPLETADA, DESPLEGADA Y VERIFICADA EN PRODUCCIÓN.**

**Decisión de negocio definitiva:** PWA instalable (icono, standalone, app-like)
**sin** funcionamiento offline. Sin precache, sin runtime cache de páginas/API/
Supabase/sesión, sin colas ni ventas offline. Ver
[`docs/ETAPA3_PWA_RENDIMIENTO_RUNBOOK.md`](./docs/ETAPA3_PWA_RENDIMIENTO_RUNBOOK.md).

### 7.1 Reparar PWA — PWA-01

- [x] Retirar Serwist (`@serwist/next`, `serwist`, `app/sw.ts`, wrapper en
  `next.config.ts`) — incompatibilidad Turbopack y offline no deseado.
- [x] Service worker estático mínimo `public/sw.js`: install/activate, limpieza de
  CacheStorage legacy, fetch listener **sin** `respondWith` (network-only).
- [x] Registro cliente `components/PwaRegister.tsx` en layout raíz.
- [x] Iconos reales: 192×192, 512×512, maskable 512, apple-touch 180
  (`npm run pwa-icons` / `check:pwa-icons`).
- [x] Manifest `display: standalone`, theme `#ff6eb4`, scope `/`, start_url `/`.
- [x] Headers `Cache-Control: no-cache` para `/sw.js`.
- [x] Tests unitarios + E2E PWA; script `check:pwa-icons`.
- [x] Smoke posdeploy: `/sw.js` 200, registro SW y 6/6 Playwright PWA contra
  `ilara.com.ar`; deploy sólo en Vercel `ilara`.

### 7.2 Recuperar cache del catálogo — PERF-01

- [x] Cliente público `lib/supabase/public.ts` **sin** `cookies()`.
- [x] Catálogo listado y PDP usan DTO público (`CATALOG_*_SELECT`) vía cliente
  público.
- [x] `revalidate` de catálogo/PDP deja de anularse por cookies; las fichas
  visibles se prerenderizan con `generateStaticParams` (ISR viable).
- [ ] Invalidación on-demand por tags al mutar productos (backlog opcional Stage 4+).
- [x] Medición local documentada en runbook Stage 3 (antes/después sanitizado).

### 7.3 Optimización medida

- [x] `display: "swap"` en fuentes Outfit/Fraunces (LCP texto).
- [x] Iconos PWA reducidos de decenas de KB incorrectos a PNG dimensionados.
- [x] Eliminación de Serwist del bundle de build (menos deps y sin warning Turbopack).
- [ ] `content-visibility` / bundle analyzer profundo → backlog Stage 4–5 si hay
  evidencia de regresión.
- [ ] Vitest ESM warning residual → no bloqueante Stage 3.

### 7.4 Gate de salida de etapa 3

- [x] Criterios locales: instalable (manifest+SW+iconos), sin offline de negocio,
  sin cache app/Supabase en SW, build sin Serwist/Turbopack warning PWA.
- [x] Deploy a Vercel proyecto **`ilara`** únicamente + smoke prod.
- [x] Catálogo público sin `cookies()` en fetch de datos.
- [x] SW no cachea autenticado ni comprobantes (no cachea nada de app).

## 8. Etapa 4 — Calidad operativa

**Estado (2026-08-12): DESPLEGADO Y VERIFICADO EN PRODUCCIÓN.** Commit
`775bc95`; CI GitHub verde (incluido E2E local aislado) y deployment único
Vercel `ilara` con smoke GET-only 16/16 en `https://ilara.com.ar`.
Runbooks: `docs/ETAPA4_CALIDAD_OPERATIVA_RUNBOOK.md`,
`docs/ETAPA4_OBSERVABILIDAD_RUNBOOK.md`, `docs/ETAPA4_OPERACION_RUNBOOK.md`.

### 8.1 E2E y CI — TEST-01

- [x] Workflow con Playwright Chromium + cache en repo. *(job `e2e` verificado
  verde en GitHub)*
- [x] Smoke catálogo/login/headers/SW. *(`npm run test:smoke`, `SMOKE_BASE_URL` obligatorio)*
- [x] E2E ampliados (auth, catálogo, PWA, POS API, a11y, mobile); mutaciones solo `E2E_*` local.
- [x] Datos aislados + bloqueo prod; en CI fail-closed sin keys (no skip silencioso).
- [x] Lint/tipos/unit/integración/E2E/build en `ci.yml` (gate de merge = owner/GitHub).
- [x] Smoke posdeploy read-only GET-only documentado.

### 8.2 Observabilidad — OBS-01

- [x] Capa opt-in local (logs JSON sanitizados); **sin** Sentry instalado/forzado.
- [x] Sanitización PII/secretos + request ID validado.
- [ ] Alertas en proveedor externo *(pendiente owner)*.
- [x] Eventos técnicos sin PII documentados.
- [x] Runbooks de respuesta documentados.

### 8.3 Accesibilidad — A11Y-01

- [x] `Dialog` con trap, Escape (stack), restore, inert/aria-hidden, scroll lock.
- [x] Confirmaciones unitarias vía `useConfirm` (logout, delete unitarios, etc.).
- [x] Bulk destructivos/visibilidad/badge migrados a `BulkActionDialog` (Inventario,
  Gastos, HistorialVentas, Clientes), desplegado y smoke verificado.
- [x] Sin `window.confirm` en código de app.
- [x] axe + teclado en E2E login/catálogo/mobile + bulk (e2e/bulk-a11y.spec.ts).
- [x] E2E mutantes bulk: confirman delete de inventario y clientes (seed aislado,
  UI + Supabase local, cleanup en `finally`, loading sin Escape/backdrop,
  axe sobre diálogo abierto). **Solo** `E2E_*` loopback.

### 8.4 Recuperación y operación

- [ ] RPO/RTO con negocio *(propuestas en runbook; no decisión)*.
- [ ] Backup adicional / PITR *(owner)*.
- [x] Restore **local** documentado (`db reset`); **no** restore productivo.
- [x] Deploy/rollback/secretos/incidente documentados.
- [x] 404 + error/reintento uniformes.

### 8.5 Gate de salida de etapa 4

- [x] CI remoto verde. *(Branch protection/required checks sigue siendo decisión owner.)*
- [ ] Alertas con error sintético *(pendiente)*.
- [x] Teclado en flujos E2E cubiertos (local).
- [ ] Restore productivo medido *(pendiente; no aplicar aquí)*.

## 9. Etapa 5 — Arquitectura incremental

**Objetivo:** reducir deuda sin una reescritura que ponga en riesgo la operación.

**Estado:** implementado, validado y publicado en `main` (commit `a8f4a8e`).
Sin SQL/migraciones remotas adicionales.
Runbook: [`docs/ETAPA5_ARQUITECTURA_RUNBOOK.md`](./docs/ETAPA5_ARQUITECTURA_RUNBOOK.md).

- [x] DAL `server-only` incremental: `lib/dal/auth.ts`, `lib/dal/catalog.ts` +
  `lib/catalog/serverCatalog.ts` (autorización/sesión cerca de la fuente en servidor).
- [x] Clientes separados: `lib/supabase/browser.ts`, `public.ts` (server-only),
  `server.ts` (server-only). Barril `lib/supabase.ts` solo browser+tipos panel.
- [x] Módulos verticales en `lib/domain/`: catalog, sales, customers, expenses,
  inventory (+ errors/images/types).
- [x] Extracción de lógica crítica: `createSale` (payload/errores/parse), mappers
  catálogo público, selects admin/gastos/clientes; POS/Clientes cableados.
  Componentes grandes no reescritos por estética.
- [x] DTOs públicos `PublicCatalogProduct/Combo` sin `purchase_price` ni internos;
  panel conserva `Producto` admin.
- [x] Taxonomía mínima `AppError` + mapeo RPC; confirmaciones Stage 4 intactas.
- [x] `server-only` en módulos de servidor/públicos/DAL; dependencia `server-only`
  instalada. Service role **no** en app (tests Stage 5).
- [x] README Node `>=20.9.0` y fuentes vigentes auditoría/plan (ya alineado; docs
  históricos marcados archivados).
- [x] Runbook Stage 5 + tests `lib/__tests__/stage5Architecture.test.ts`.

Criterio de salida:

- [x] Ningún secreto o service role en código de app/cliente (verificado por test
  de frontera local).
- [x] Responsabilidades separadas en dominios críticos (catálogo público, ventas
  POS, clientes bulk); UI grande residual documentada.
- [x] Lógica crítica de Stage 5 con pruebas unitarias.
- [x] Commit `a8f4a8e` + push a `main`; CI remoto verde.
- [x] Deploy productivo Vercel `ilara` READY.
- [x] Smoke productivo read-only `https://ilara.com.ar`: 16/16 checks OK
  (catálogo, login, headers, manifest, service worker y rutas protegidas).

## 10. Etapa 6 — Producto

Esta etapa comienza sólo después de cerrar las etapas 0–2. El orden final depende
de valor comercial y capacidad operativa.

Runbook 6.1: [`docs/ETAPA6_1_PEDIDOS_CATALOGO_RUNBOOK.md`](./docs/ETAPA6_1_PEDIDOS_CATALOGO_RUNBOOK.md).

### 10.1 Stage 6.1 — Pedidos desde el catálogo

**Estado (2026-08-13): CERRADO, DESPLEGADO Y VERIFICADO EN PRODUCCIÓN.**
Migración `20260813205545`, Vercel `ilara` READY, smoke productivo 16/16 y
pedido controlado verificado y limpiado.

- [x] Modelo `orders` / `order_items` / `order_status_events` + RLS/RPC
- [x] Precios autoritativos de catálogo + cupón revalidado + snapshots
- [x] Idempotencia de creación y transiciones
- [x] Stock: pending no descuenta; confirm reserva; cancel restaura una vez
- [x] Checkout público + WhatsApp post-pedido
- [x] Panel admin (tab Pedidos)
- [x] Tests unitarios + integración local + suite DB
- [x] Commit / push / CI remoto
- [x] Migración productiva + deploy Vercel `ilara` + smoke

### 10.2 Stage 6.2 — Alertas de reposición

**Estado (2026-08-13): CERRADO, DESPLEGADO Y VERIFICADO EN PRODUCCIÓN.**
Migraciones `20260814000544` y `20260814000745`, Vercel `ilara` READY y
smoke transaccional productivo aprobado sin residuos.

Runbook: [`docs/ETAPA6_2_ALERTAS_REPOSICION_RUNBOOK.md`](./docs/ETAPA6_2_ALERTAS_REPOSICION_RUNBOOK.md).

- [x] Trigger Postgres en `products` + tablas `stock_alerts` / `stock_alert_events`
- [x] Una alerta activa por producto; auto-cierre y nuevo ciclo
- [x] Cantidad sugerida determinista + panel admin + RPC transición
- [x] Tests unitarios, integración, E2E, suite DB/CI
- [x] Commit / push / CI remoto
- [x] Migración productiva + deploy Vercel `ilara` + smoke

### 10.3 Resto del roadmap de producto (pendiente)

1. ~~**Pedidos desde catálogo**~~ → ver 10.1 (cerrado en producción)
2. ~~**Alertas de reposición**~~ → ver 10.2 (cerrado en producción)
3. ~~**Devoluciones y notas de crédito**~~: cerrado en producción con notas
   parciales, stock por snapshot, auditoría e idempotencia. Ver
   [`docs/ETAPA6_3_DEVOLUCIONES_RUNBOOK.md`](./docs/ETAPA6_3_DEVOLUCIONES_RUNBOOK.md).
4. ~~**Reportes de margen**~~: cerrado en producción con costo histórico por
   componente, descuentos, devoluciones, calidad del dato y panel admin. Ver
   [`docs/ETAPA6_4_REPORTES_MARGEN_RUNBOOK.md`](./docs/ETAPA6_4_REPORTES_MARGEN_RUNBOOK.md).
5. ~~**CRM mínimo**~~: cerrado en producción con historial neto, etiquetas,
   notas internas y consentimiento auditable admin-only. Ver
   [`docs/ETAPA6_5_CRM_RUNBOOK.md`](./docs/ETAPA6_5_CRM_RUNBOOK.md).
6. ~~**Cuentas por cobrar/pagar y conciliación**~~: ledger auditable, pagos
   parciales, vencimientos, notas de crédito y caja por medio. Ver
   [`docs/ETAPA6_6_FINANZAS_RUNBOOK.md`](./docs/ETAPA6_6_FINANZAS_RUNBOOK.md).
*(La numeración 4–6 de este bloque corresponde a las iniciativas 6.4–6.6 del
roadmap de producto.)*

**Decisión de negocio (2026-08-13): Stage 6 termina en 6.6.** La iniciativa 6.7
fue eliminada. B2B/mayoristas y multisucursal no quedan en el backlog. Pagos
online se separa como **Etapa 8**.

**Fuera de alcance de Etapa 6:** cotización, transportistas, sucursales de correo,
etiquetas, tracking y cualquier otra integración logística. Esos temas pertenecen
exclusivamente a Etapa 7 y no deben bloquear la implementación de pedidos.

Cada feature debe incluir antes de desarrollo:

- hipótesis y métrica de éxito;
- modelo de permisos;
- impacto en stock, precios y auditoría;
- migración reversible/forward-fix;
- pruebas y runbook operativo.

## 11. Etapa 7 — Envíos y logística

**Estado (2026-08-14): CERRADA, DESPLEGADA Y VERIFICADA EN PRODUCCIÓN.**

Runbook: [`docs/ETAPA7_ENVIA_COTIZACIONES_RUNBOOK.md`](./docs/ETAPA7_ENVIA_COTIZACIONES_RUNBOOK.md).

**Decisión de negocio (2026-08-13): Envia.com es la plataforma logística elegida.**
No se desarrollarán integraciones directas con Correo Argentino, OCA ni Andreani;
los servicios disponibles se consumirán exclusivamente a través de Envia.com.

Alcance cerrado:

1. [x] Credencial productiva validada y guardada sólo como secreto de Supabase.
2. [x] Edge Function `shipping-quotes` como adaptador exclusivo de Envia.com.
3. [x] Dirección guiada por provincia/localidad oficial, calle y altura; CP resuelto automáticamente.
4. [x] Opciones reales normalizadas, ordenadas por importe y con errores seguros.
5. [x] Snapshot temporal backend-only, consumo único e idempotente por el RPC.
6. [x] Total autoritativo del pedido incluye envío; panel muestra el snapshot.
7. [x] Rate limit por hash de IP, CORS acotado y logs sin token ni PII de contacto.
8. [x] Tests unitarios, reconstrucción DB, matriz RLS, build y E2E visual local.
9. [x] Migración `20260814092526`, secreto y Edge Function aplicados en producción.
10. [x] Cotización productiva CP 1000: ocho opciones reales; `anon` a quotes = 401.
11. [x] Stage 7.1: Georef oficial carga 24 provincias y localidades dependientes.
12. [x] Stage 7.1: dirección normalizada → Nominatim con caché/1 req·s → CP → Envia.
13. [x] Snapshot del pedido conserva domicilio normalizado, CP y coordenadas.

Configuración operativa implementada:

- origen: Neuquén Capital, código postal `8300`;
- un solo bulto tipo bolsa;
- medidas de referencia: `20 × 35 × 5 cm`;
- peso máximo de referencia: `1 kg`;
- sin seguro ni generación de etiqueta en esta etapa.

Decisión de alcance: Stage 7 cierra con **cotización y snapshot en pedidos**.
Generar etiquetas, contratar/recaudar el envío, tracking y webhooks no se ejecutan
automáticamente; si negocio los solicita serán una etapa nueva con domicilio real
de origen, política operativa y pruebas que puedan producir cargos.

- [x] Plataforma logística elegida por negocio: **Envia.com**.
- [x] Credencial productiva disponible (sandbox descartado por falla informada).
- [x] Bolsa fijada en `20 × 35 × 5 cm`, hasta `1 kg`.
- [x] Caída/timeout no inventa tarifas y mantiene el pedido sin confirmar.
- [x] Privacidad, secretos, rate limiting y observabilidad implementados.
- [x] Deploy y forward-fix documentados en el runbook.

## 12. Etapa 8 — Pagos online

**Decisión de negocio (2026-08-13):** pagos online deja de pertenecer a Stage 6
y pasa a ser una etapa independiente. B2B y multisucursal quedan descartados.

Alcance previsto:

1. Elegir proveedor y modalidad de checkout; Mercado Pago es candidato, todavía
   no una decisión técnica cerrada.
2. Crear pagos exclusivamente desde backend con importes autoritativos del pedido.
3. Verificar webhooks firmados e idempotentes; nunca confirmar por la URL de retorno.
4. Modelar estados pendiente, aprobado, rechazado, cancelado y reembolsado.
5. Definir reserva y liberación de stock cuando un pago vence o falla.
6. Integrar reembolsos con Stage 6.3, comisiones con Stage 6.4 y conciliación con
   Stage 6.6.
7. Incorporar auditoría, observabilidad y panel de inconsistencias.

Gate previo a desarrollo:

- [ ] Proveedor y modalidad seleccionados.
- [ ] Cuenta comercial y credenciales de prueba disponibles.
- [ ] Política de reserva/vencimiento de stock definida.
- [ ] Política de reembolsos, contracargos y comisiones definida.
- [ ] Requisitos fiscales y de comprobantes confirmados.
- [ ] Plan de pruebas, secretos, deploy y forward-fix aprobado.

## 13. División sugerida en cambios/PR

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

### 13.1 Orden de deploy de contención (Etapa 0)

Fuente vigente: [`docs/ETAPA0_ORDEN_DEPLOY.md`](./docs/ETAPA0_ORDEN_DEPLOY.md).

1. Backup y preservación de logs
2. Deploy Edge Function `passkey-auth` bloqueada
3. RPC agregado (`stage0_harden_catalog_sales_rpc`)
4. Cierre anon sales/sale_items (`stage0_close_anon_sales`)
5. Deploy app (DTO público, UI, JSON-LD)
6. Grants catálogo column-level (`stage0_public_catalog_column_grants`, REVOKE anon+PUBLIC)
7. Pruebas integración anon/positivas/cross-user (`npm run test:integration`)
8. Migración legacy receipts + bucket privado estricto (`stage0_receipts_private_bucket`)

### 13.2 Forward-fix Stage 0 (inventario legacy)

| Migración | Estado | Acción |
|---|---|---|
| `stage0_revoke_authenticated_legacy_inventory` | **Aplicado y verificado en producción** | REVOKE EXECUTE de `stage0_inventory_legacy_receipt_urls()` a `authenticated`; EXECUTE solo `service_role` |

No reabrir EXECUTE a `authenticated`. No reabrir anon.

## 14. Checklist global de Definition of Done

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

## 15. Métricas de cierre

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

## 16. Registro de avance

| Fecha | Etapa | Cambio | Estado | Evidencia / PR |
|---|---|---|---|---|
| 2026-08-09 | Planificación | Creación de auditoría y plan vigente | Completado | `AUDITORIA.md`, `PLAN.md` |
| 2026-08-09 | 0 Contención | Implementación en repo (passkeys, DTO catálogo, migraciones, JSON-LD, runbooks) | En curso | Sin deploy/prod aún; gate 4.7 pendiente |
| 2026-08-09 | 0 Contención | Fix bloqueadores: REVOKE PUBLIC, receipts límites explícitos, legacy documentado, tests integración, orden deploy | En curso | Ver docs/ETAPA0_ORDEN_DEPLOY.md |
| 2026-08-10 | 0 Contención | **Aplicado y verificado en producción** (passkey EF, migraciones stage0, Vercel ilara.com.ar, receipts private, 2 legacy migrados) | Verificado | Smoke anon 401 ventas; passkey 403; catálogo 200; receipts public=false |
| 2026-08-10 | 0 Contención | Forward-fix inventario legacy: REVOKE EXECUTE a authenticated | Verificado | Aplicado en prod (`*_stage0_revoke_authenticated_legacy_inventory.sql`) |
| 2026-08-10 | 0 Contención | Evaluación de secretos (SEC-03) | Completado | Propietario confirma que nunca salieron del equipo; rotación no requerida |
| 2026-08-10 | 1 Seguridad e integridad | Roles + RLS + POS precios (Opción A) + passkeys v2 diseño | En curso | Primera versión en repo; **no desplegado** |
| 2026-08-11 | 1 Seguridad e integridad | Corrección integral Etapa 1 (frontera POS, bootstrap, RLS, pagos, tests, docs) | En revisión | `docs/ETAPA1_RUNBOOK.md`; **no desplegado**; pendiente review humana |
| 2026-08-11 | 1 Seguridad e integridad | Re-auditoría: user_roles policies post-21412, sin DELETE ventas, lock last_admin, breakdown estricto, tests secuencia | En revisión | Solo local; **no desplegado** |
| 2026-08-11 | 1 Seguridad e integridad | Corrección post-review: catálogo anon preservado, delete concurrente serializado, breakdown presente solo mixto, fixtures de roles restaurables | En revisión | Solo local; **no desplegado** |
| 2026-08-12 | 0–1 Cierre | Supabase + Vercel desplegados; dos admins; smoke login/venta/stock/receipt; probes anon y passkey verdes; passkeys descartadas | Completado | Commits `48dd39a`, `80a709a`; verificación productiva 2026-08-12 |
| 2026-08-12 | 2 Gobierno de datos | Baseline greenfield, forward-only Stage 2, tipos, CI db-security, inventario y runbook | Completado | Commit `47b470d`; CI verde; migración `20260812013913` y smoke productivo OK |
| 2026-08-12 | 5 Arquitectura incremental | DAL/DTOs, clientes Supabase separados, dominios críticos y lógica POS testeada; sin SQL remoto adicional | Completado | Commit `a8f4a8e`; CI verde; deploy Vercel `ilara` READY; smoke productivo read-only 16/16 OK |
| 2026-08-13 | 6.1 Pedidos catálogo | Orders/RPC/checkout/panel; sin logística | Completado | Commits `66507b8`, `89ac418`, `485ed14`; migración `20260813205545`; CI `31745190425`; Vercel `ilara` READY; smoke 16/16 y pedido controlado limpio |
| 2026-08-13 | 6.4 Reportes de margen | Costo histórico, devoluciones, calidad del dato y panel admin | Completado | Commit `3b277b9`; migración `20260814020513`; CI `31763396516`; Vercel `ilara` READY; smoke 16/16 |
| 2026-08-14 | 6.5 CRM mínimo | Historial neto, etiquetas, notas y consentimiento admin-only | Completado | Commit `adefe8a`; migración `20260814024158`; CI `31765289604`; Vercel `ilara` READY; smoke 16/16 |
| 2026-08-14 | 6.6 Finanzas | CxC/CxP, cobros/pagos append-only y conciliación de caja | Completado | Commits `30d1463`, `1c3cd67`; migración `20260814033000`; CI `31767514128`; Vercel `ilara` READY; smoke 16/16 |
| 2026-08-14 | 6.2 Alertas reposición | Trigger stock + panel + RPC; sin compras ni logística | Completado | Migraciones `20260814000544` y `20260814000745`; CI, Vercel y smoke productivo verdes |
| 2026-08-14 | 7 / 7.1 Envíos y logística | Dirección guiada + CP automático + cotización Envia + snapshot autoritativo | Completado | Migraciones `20260814092526` y `20260814205248`; Edge `shipping-quotes`; Georef + Nominatim + Envia; ver runbook |
| 2026-08-13 | Roadmap 6.7 / 8 | Reordenamiento de expansión comercial | Completado | Stage 6.7 eliminado; B2B y multisucursal descartados; pagos online movido a Etapa 8 |

Estados permitidos: `Pendiente`, `En curso`, `Bloqueado`, `En revisión`,
`Desplegado`, `Verificado` y `Completado`.
