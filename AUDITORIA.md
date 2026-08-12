# Auditoría técnica y funcional — Ilara

- **Fecha de corte:** 9 de agosto de 2026
- **Aplicación revisada:** Ilara App / Ilara Beauty
- **Estado del documento:** vigente

**Documento de ejecución asociado:** [`PLAN.md`](./PLAN.md)

> Este documento reemplaza la auditoría anterior de la raíz, que había quedado
> desactualizada. Los documentos históricos dentro de `docs/` se conservan como
> referencia, pero no deben utilizarse para determinar el estado actual.

## 1. Resumen ejecutivo

Ilara tiene una base funcional y visual sólida: el proyecto compila, pasa lint y
tipos, sus pruebas unitarias están verdes y el catálogo público funciona bien en
desktop y mobile. No obstante, **no debe considerarse segura para producción**
hasta resolver dos vulnerabilidades críticas verificadas:

1. El flujo de registro de passkeys no vincula la credencial a una sesión
   autenticada y confía en correo, RP ID y origen aportados por el cliente.
2. La API de producción permite leer anónimamente ventas, líneas de venta y
   columnas internas de productos.

También existe una inconsistencia de precios entre el POS y el RPC que persiste
la venta, una PWA que no publica su service worker, drift entre las políticas de
base versionadas y producción, y deuda operativa en migraciones, observabilidad
y pruebas de integración.

### Dictamen por área

| Área | Estado | Motivo principal |
|---|---|---|
| Seguridad de identidad | Crítico | Registro de passkeys susceptible de vinculación a otra cuenta |
| Privacidad de datos | Crítico | Ventas y campos internos accesibles con el rol `anon` |
| Integridad monetaria | Alto | POS y base aplican reglas de precio distintas |
| Gobierno de base de datos | Alto | Drift confirmado y esquema no completamente reproducible |
| PWA / offline | Alto | `/sw.js` devuelve 404 y los iconos no cumplen el manifest |
| Calidad de código | Bueno con deuda | Checks verdes, pero componentes grandes y lógica distribuida |
| UX visual | Bueno | Catálogo pulido, responsive y sin inestabilidad observada |
| Accesibilidad | Mejorable | Diálogos y controles interactivos no siguen un patrón completo |
| Observabilidad | Bajo | Sin trazas de errores, alertas ni diagnóstico centralizado |
| Dependencias | Bueno | Sin vulnerabilidades conocidas en `npm audit` al corte |

## 2. Alcance y metodología

La auditoría incluyó:

- Arquitectura Next.js 16 / React 19 y configuración de producción.
- Autenticación, autorización, Edge Functions, RLS, RPC y Storage de Supabase.
- Flujos de ventas, inventario, combos, catálogo, comprobantes y gastos.
- Revisión de TypeScript, lint, pruebas, build, CI y dependencias.
- Comprobaciones HTTP y funcionales no destructivas sobre producción.
- Consultas de solo lectura con el rol anónimo para comprobar exposición real.
- Revisión visual del catálogo en viewport desktop y mobile.
- Contraste con documentación vigente de Next.js, Serwist y Supabase.

No se realizaron:

- Tomas de cuenta, creación de usuarios o explotación del flujo vulnerable.
- Escrituras, eliminaciones o modificaciones de datos de producción.
- Pruebas de carga o denegación de servicio.
- Inspección privilegiada del dashboard, logs internos o configuración efectiva
  de buckets; esos puntos se marcan como pendientes de verificación.
- Exposición de valores de secretos o datos comerciales encontrados.

Los conteos y respuestas de producción corresponden al momento de la prueba y
pueden cambiar con la actividad normal del negocio.

## 3. Validaciones ejecutadas

| Control | Resultado | Observación |
|---|---|---|
| `npm run lint` | Correcto | Sin errores |
| `tsc --noEmit --incremental false` | Correcto | TypeScript estricto sin errores |
| `npm run test` | Correcto | 5 archivos, 29 pruebas |
| `npm run build` | Correcto con advertencia | Serwist no soporta la ruta Turbopack actual |
| `npm audit --json` | Correcto | 0 vulnerabilidades conocidas |
| `npm run test:e2e` | No ejecutable | Chromium de Playwright no está instalado |
| Smoke tests reproducidos en producción | 5 de 6 | El sexto espera un encabezado antiguo del catálogo |
| Service worker en producción | Fallido | `/sw.js` devuelve 404 |
| Catálogo desktop/mobile | Correcto | Responsive, 15 tarjetas y CLS observado igual a 0 |

El build clasifica `/catalogo`, `/catalogo/p/[id]` y `/sitemap-xml` como rutas
dinámicas. Aunque el catálogo declara revalidación, su cliente de Supabase usa
`cookies()` y producción responde con cache privada y `no-store`.

## 4. Hallazgos

### SEC-01 — Registro de passkeys sin identidad autenticada

- **Severidad:** crítica
- **Estado:** confirmado por revisión de código; función desplegada comprobada de
forma no destructiva.

`supabase/functions/passkey-auth/index.ts` presenta los siguientes problemas:

- `/register/start` no exige ni valida un bearer token.
- Recibe `email`, `rpId`, `rpName` y `clientOrigin` desde el cliente.
- El origen esperado se deriva de `clientOrigin` en lugar de una allowlist del
  servidor.
- CORS permite cualquier origen.
- `/register/finish` busca una cuenta por el correo recibido, vincula la
  credencial y puede crear un usuario confirmado si no existe.
- El flujo genera una sesión mediante un enlace/OTP después de la vinculación.

**Impacto:** un tercero podría registrar una credencial propia contra el correo
de un operador y obtener acceso con sus privilegios. La auditoría no ejecutó el
ataque completo.

**Remediación requerida:** desactivar passkeys hasta que el registro exija sesión,
vincule el desafío a `auth.uid()`, use RP ID y orígenes definidos en servidor,
impida la creación automática de usuarios y aplique desafíos de un solo uso con
expiración y contexto de operación.

### SEC-02 — Exposición anónima de ventas y columnas internas

- **Severidad:** crítica
- **Estado:** confirmado contra producción mediante consultas de solo lectura.

El rol `anon` devolvió al momento de la prueba:

- 62 filas de `sales`.
- 152 filas de `sale_items`.
- Campos de ventas como nombre de cliente, notas, URL de comprobante, desglose
  de pagos, total, fechas, estado y usuarios de auditoría.
- Campos internos de productos como precio de compra, notas, stock mínimo y
  campos de auditoría.
- Los combos pueden ampliar la exposición porque el cliente solicita relaciones
  con `products(*)`.

El repositorio pretende restringir `sales` y `sale_items` a usuarios autenticados
en `supabase/sql/supabase_rls_all.sql`, por lo que el resultado demuestra drift
entre código y producción.

RLS controla filas, no columnas. El catálogo utiliza `select('*')` en
`hooks/useCatalogData.ts`, de modo que una política pública de lectura permite
pedir también campos internos. La solución recomendada es una vista
`security_invoker`, un RPC o una superficie pública equivalente con columnas
explícitas, junto con grants mínimos y pruebas negativas para `anon`.

**Impacto:** exposición de información comercial y potencialmente personal. Se
debe tratar como un incidente hasta determinar, mediante logs, alcance temporal y
acceso a comprobantes.

### SEC-03 — Secretos y artefactos sensibles

**Severidad:** alta; crítica si los artefactos fueron compartidos o publicados.

Durante la auditoría se encontró un archivo `ilara-app.zip` de aproximadamente
39 MB que contenía `.env.local`, `.git` y `passsupa.txt`. El ZIP ya no aparecía en
el estado final del directorio, pero:

- `passsupa.txt` existió en commits contenidos por `main` y `origin/main`.
- `supabase/.temp/pooler-url` permanece sin versionar y no está ignorado.
- El ZIP contenía nombres de variables de alto privilegio, incluyendo service
  role de Supabase y credenciales de Vercel.

No se mostraron ni copiaron los valores. Debe verificarse si esos artefactos
fueron subidos o compartidos, rotar cualquier credencial potencialmente expuesta
y purgar secretos reales del historial de forma coordinada.

### SEC-04 — XSS persistente mediante JSON-LD

**Severidad:** alta.

`app/catalogo/p/[id]/page.tsx` inserta `JSON.stringify(jsonLd)` mediante
`dangerouslySetInnerHTML`. El objeto incorpora nombre, notas y marca editables.
Sin escapar `<`, una cadena `</script>` puede cerrar el bloque. El CSP actual
permite scripts inline y aumenta el impacto.

La corrección mínima es serializar con reemplazo de `<` por `\\u003c` y añadir
una prueba con payload hostil. Después debe evaluarse un CSP con hashes, SRI o
nonce según la estrategia de renderizado.

### DATA-01 — Divergencia de precios entre POS y RPC

**Severidad:** alta.
**Estado (2026-08-11):** **Opción A en repo, reforzada** (migración
`stage1_pos_authoritative_pricing` + UI). RPC `SECURITY DEFINER` endurecido:
`auth.uid` + `can_use_pos`, precios lista `round(sale_price)`, ignora
unit_price/total/nombre/descuentos del cliente; valida status, payment_method,
breakdown (mixto obligatorio, suma, métodos internos); stock con `FOR UPDATE`.
UI preview usa `precioListaProducto` / `precioListaCombo` / `totalCarritoPos`.
**Pendiente:** aplicar migraciones stage1 en staging/prod y smoke con roles reales.
**No** se declara aceptación de deploy hasta esa verificación.

### DATA-02 — Esquema y políticas no reproducibles

**Severidad:** alta.

Una parte importante del esquema está en `supabase/sql` como scripts manuales,
mientras `supabase/migrations` contiene cambios posteriores. Un entorno nuevo no
puede reconstruirse confiablemente con un único flujo. El drift de RLS confirmado
en producción demuestra el riesgo operativo.

Toda modificación futura debe nacer como migración, probarse en un entorno
aislado, pasar advisors, verificarse con `supabase migration list` y contener
grants y RLS explícitos. Desde abril de 2026, proyectos nuevos pueden optar por no
exponer automáticamente nuevas tablas a Data API; por ello se deben comprobar
por separado exposición, `GRANT` y RLS.

### DATA-03 — Operaciones no transaccionales

**Severidad:** media.

- La edición de combos actualiza el combo, elimina todos sus ítems y luego inserta
  reemplazos mediante llamadas separadas. Un fallo intermedio deja datos vacíos o
  parciales.
- Algunos cambios masivos de inventario se ejecutan secuencialmente y pueden
  quedar aplicados a medias.

Estas operaciones deben moverse a RPC transaccionales o actualizaciones por lote
con resultados explícitos por elemento.

### STO-01 — Privacidad y ciclo de vida de archivos

**Severidad:** alta hasta verificar producción.

- El script base de gastos crea `receipts` como bucket público.
- Una migración posterior documenta el cambio a privado, pero no ejecuta el
  cambio automáticamente.
- Como `sales` expone `receipt_url` anónimamente, un bucket público podría hacer
  accesibles los archivos.
- Subidas de productos y comprobantes no aplican de forma uniforme límites de
  tamaño/MIME ni eliminan siempre objetos reemplazados o huérfanos.

No se confirmó el flag efectivo del bucket por falta de acceso privilegiado. La
verificación debe ser una tarea de contención y la configuración final debe quedar
en una migración reproducible.

### AUTH-01 — Autenticación sin autorización granular

**Severidad:** media-alta.
**Estado (2026-08-12):** cuatro migraciones de Etapa 1 aplicadas en Supabase
producción; dos cuentas `admin`, cero `vendedor`. App Vercel aún no desplegada.
Modelo `admin` / `vendedor` / `none` en `public.user_roles`; helpers DEFINER con
`search_path = ''`; policies `user_roles_select_own` + `user_roles_select_admin`
reafirmadas al final de 21412; ventas: sin INSERT/DELETE Data API; borrado solo
`delete_sale_and_restore_stock`; bootstrap solo service_role + lock 87201411;
`set_user_role` serializa last_admin con el mismo lock.

La revisión de producción en modo lectura confirmó todas las versiones de Etapa 0
y ninguna de Etapa 1. También detectó grants directos heredados demasiado amplios,
ejecución pública de helpers internos y una policy amplia de Storage que RLS por
rol no corregía por sí sola. La migración
`20260812002815_stage1_harden_legacy_anon_grants.sql` versiona el cierre. El orden
completo se aplicó sobre una copia local del esquema productivo y la matriz de
integración Stage 0 + Stage 1 pasó 25/25, sin copiar datos de usuarios.

Decisión de negocio: `vendedor` no se asignará en el corto/mediano plazo. Su SELECT
completo sobre `products` queda como deuda dormida; antes de habilitar ese rol debe
crearse una superficie POS de columnas mínimas.

### PWA-01 — PWA no publicada

**Severidad:** alta para la promesa offline; no afecta el uso web básico.

- `https://ilara.com.ar/sw.js` devuelve 404.
- El HTML publicado no registra el service worker.
- El build local no genera `public/sw.js`.
- Serwist advierte que la integración actual no soporta Turbopack.
- El icono declarado como 512 × 512 mide 308 × 117; otros tamaños declarados
  tampoco coinciden con los archivos reales.

Se debe elegir explícitamente la integración soportada de Serwist para Turbopack
o compilar con Webpack y añadir una aserción posbuild/posdeploy sobre `/sw.js`.

### PERF-01 — Revalidación del catálogo anulada

**Severidad:** media.

`app/catalogo/page.tsx` declara `revalidate = 60`, pero
`lib/supabase/server.ts` llama a `cookies()`. Esto vuelve dinámica la ruta y la
respuesta productiva usa cache privada con `no-store`.

Debe existir un cliente público, sin cookies y con un DTO de catálogo reducido,
para que ISR o cache por tags funcionen realmente.

### ARCH-01 — Frontera de datos y mantenibilidad

**Severidad:** media.

- Gran parte de la lectura y mutación ocurre directamente desde Client
  Components; RLS es la verdadera frontera de seguridad.
- No hay una DAL marcada `server-only` para operaciones sensibles.
- Los tipos de base son manuales y usan conversiones desde `unknown`, lo que
  facilita drift.
- Hay componentes de 600 a 850 líneas en inventario, tablero, catálogo, clientes,
  detalle público e historial.

La recomendación es introducir módulos verticales y una DAL de manera incremental,
sin reescritura general.

### TEST-01 — Cobertura insuficiente en las zonas de mayor riesgo

**Severidad:** media.

Las 29 pruebas unitarias pasan, pero no cubren Edge Functions, RLS, RPC de ventas,
Storage ni autorización. E2E no se ejecuta en CI y el smoke test contiene una
expectativa visual obsoleta.

Los defectos críticos encontrados están precisamente fuera de la cobertura
actual. Se requieren pruebas de integración sobre Supabase local o staging y
Playwright en CI con navegador instalado.

### A11Y-01 — Diálogos y controles inconsistentes

**Severidad:** media-baja.

Existe un hook de accesibilidad para diálogos, pero reconoce que no implementa un
focus trap completo y no todos los modales lo utilizan. El modal de passkeys y
otros diálogos carecen de una combinación consistente de `role="dialog"`,
`aria-modal`, foco inicial, restauración de foco, fondo inerte y cierre con Escape.
También existen tarjetas con `div onClick` y confirmaciones nativas.

### OBS-01 — Observabilidad insuficiente

**Severidad:** media.

La aplicación tiene Vercel Analytics/Speed Insights y varios `console.error`,
pero no hay integración efectiva de Sentry/OpenTelemetry, trazas de Edge
Functions, alertas ni contexto estructurado. Algunas consultas fallidas terminan
mostrando estados vacíos sin error ni reintento.

### DOC-01 — Documentación contradictoria

**Severidad:** baja con impacto operativo.

Existen varias auditorías, roadmaps y checklists que describen estados ya
resueltos o incorrectos. Por ejemplo, documentos anteriores indican que no hay
error boundaries, que RLS no fue revisado o que el problema PWA era únicamente el
matcher. También el README declara Node 18+, mientras Next instalado exige Node
`>=20.9.0`.

`AUDITORIA.md` y `PLAN.md` deben considerarse las fuentes vigentes; los demás
documentos históricos deben marcarse como archivados o enlazar a estos.

## 5. Fortalezas verificadas

- Lint, TypeScript, tests unitarios y build de producción pasan.
- El lockfile está versionado y `npm audit` no detectó vulnerabilidades conocidas.
- El RPC de ventas usa transacciones y bloqueos apropiados para stock.
- Las rutas privadas pasan por `proxy.ts` y la validación usa `getUser()`.
- Existen error boundaries, estados de carga y carga diferida de módulos internos.
- El catálogo tiene metadata, Open Graph, sitemap, robots y datos estructurados.
- Producción envía CSP, HSTS, `X-Frame-Options`, `nosniff`, referrer policy y
  permissions policy.
- El catálogo actual es visualmente consistente, responsive y no mostró CLS en
  la comprobación realizada.
- Los modales pesados del catálogo ya se cargan de forma diferida.

## 6. Riesgo residual y decisión de salida

El estado recomendado es **NO-GO para considerar la plataforma asegurada** hasta
cerrar `SEC-01` y `SEC-02`. La aplicación web puede seguir operando únicamente si
se ejecuta primero la fase de contención definida en `PLAN.md`, se preservan los
logs y se acepta explícitamente el riesgo residual durante el despliegue.

La salida de contención requiere, como mínimo:

- Passkeys desactivadas o corregidas.
- Cero filas sensibles accesibles por `anon`.
- Cero columnas internas de producto en la superficie pública.
- Bucket de comprobantes privado y con políticas verificadas.
- Secretos evaluados y rotados cuando corresponda.
- JSON-LD escapado y cubierto por prueba.

## 7. Referencias técnicas vigentes

- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase — Column Level Security](https://supabase.com/docs/guides/database/postgres/column-level-security)
- [Supabase — Securing your API](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase — Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase — cambio de exposición automática de Data API](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
- [Next.js — Data Security](https://nextjs.org/docs/app/guides/data-security)
- [Next.js — JSON-LD](https://nextjs.org/docs/app/guides/json-ld)
- [Next.js — Content Security Policy](https://nextjs.org/docs/app/guides/content-security-policy)
- [Next.js — Progressive Web Apps](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [Serwist — Next.js](https://serwist.pages.dev/docs/next/getting-started)

## 8. Control de cambios

| Fecha | Cambio |
|---|---|
| 2026-08-09 | Auditoría completa basada en código, checks locales y verificaciones no destructivas de producción |
| 2026-08-09 | **Etapa 0 en repositorio (no desplegada):** contención passkeys (UI + Edge Function), selects de catálogo sin columnas internas, migraciones versionadas para anon/sales/receipts, JSON-LD escapado, runbook de rotación. **Producción sigue vulnerable hasta aplicar migraciones, redeploy de función y deploy de app.** |
| 2026-08-09 | Fix bloqueadores Etapa 0: REVOKE SELECT anon+PUBLIC en catálogo; receipts con límites fijos y SELECT estricto; inventario/procedimiento legacy; suite `test:integration`; orden de deploy actualizado en `docs/ETAPA0_ORDEN_DEPLOY.md`. |
| 2026-08-10 | **Etapa 0 desplegada y verificada en producción** (proyecto qbbnvdmadgomfmrsfxlo + Vercel ilara.com.ar). Contención passkeys, cierre anon ventas, grants catálogo, receipts privado, smoke OK. |
| 2026-08-10 | Forward-fix Stage 0: REVOKE EXECUTE de `stage0_inventory_legacy_receipt_urls()` a `authenticated` — **aplicado y verificado en producción** (`*_stage0_revoke_authenticated_legacy_inventory.sql`). |
| 2026-08-10 | Residual SEC-03: **rotación de secretos** sigue pendiente de decisión de incidente. |
| 2026-08-10 | **Etapa 1 en repo (no desplegada):** primera implementación roles+RLS+precios. |
| 2026-08-11 | **Etapa 1 corregida en repo (no desplegada):** frontera POS DEFINER, sin bypass Data API vendedor, bootstrap seguro sin autoclaim, RLS sin recursión, pagos endurecidos, tests semánticos, runbook SQL vs service_role. Ver `docs/ETAPA1_RUNBOOK.md`. Pendiente revisión humana y deploy controlado. |
| 2026-08-11 | **Etapa 1 re-auditoría local:** reafirma `user_roles_select_admin` tras 21412; sin DELETE directo sales/líneas; lock 87201411 en set_user_role; payment_breakdown estricto; DEFINER `search_path=''`; tests de secuencia de migraciones e integración sin pass silencioso. **No desplegado.** |
| 2026-08-11 | **Etapa 1 post-review local:** preflight preserva policies anon del catálogo Stage 0; borrado de venta serializado con `FOR UPDATE`; JSON null y breakdown no-mixto rechazados; integración restaura roles previos y cubre doble borrado. **No desplegado.** |
