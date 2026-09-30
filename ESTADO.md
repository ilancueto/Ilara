# Estado actual de Ilara

Fecha de revisión: 29–30 de septiembre de 2026. Esta es la fuente de estado actual. Los informes de agosto y del 5 de septiembre conservan evidencia histórica; no describen por sí solos la versión desplegada hoy.

## Correcciones y comprobaciones de esta revisión

- Next.js actualizado de 16.3.0 a 16.3.7, con ESLint y bundle analyzer de la misma versión. Dependencias compatibles actualizadas: `npm audit` sin vulnerabilidades.
- Lint sin errores ni advertencias; los mockups estáticos quedan fuera del análisis de la aplicación.
- Configuración de Vitest en ESM explícito, sin advertencias de configuración CommonJS.
- Catálogo: lectura por rangos con cantidad exacta y orden estable. Un límite de la API no corta silenciosamente productos, combos o categorías; un fallo intermedio no publica resultados parciales.
- Orden más vendidos: agregados públicos disponibles en el render del servidor y la hidratación, evitando reordenar una página inicial con un ranking vacío.
- Smoke: ficha inexistente exige HTTP 404; la ruta privada exige redirección a login. Ya no acepta HTTP 200 como protección válida.
- SEO: chequeos remotos sin inyección de fallos; inyección restringida a loopback y restauración del archivo de prueba original.
- Emails: hasta tres intentos frente a errores de red, 429 y 5xx, con el mismo cuerpo y clave de idempotencia; presupuesto total de ocho segundos y respeto de Retry-After. Errores permanentes no se reintentan. Esto no es una cola durable entre ejecuciones.
- SQL aislado reproducible: las 56 migraciones completas se aplican en PGlite, sin Docker. Verifica RLS en 51 tablas, grants públicos, denegaciones anónimas, privacidad de comprobantes, precios autoritativos del POS, stock, precios de catálogo, idempotencia y transiciones administrativas. También se prueba rollback y conflicto de edición de combos y la denegación de RPC de Mercado Pago reservadas al backend.
- Permisos de Mercado Pago: `attach_mp_preference` y `mp_preference_context` sólo pueden ejecutarse con service role. Cuatro predicados de permisos usan SECURITY INVOKER. Migración aplicada y comprobada en producción; [evidencia y revisión de RPC](docs/SEGURIDAD_RPC_2026-09-29.md).
- Tipos regenerados desde producción mediante el conector: corregida nullabilidad y obligatoriedad de columnas reales; `tsc --noEmit` aprobado. La generación y comparación contra staging siguen pendientes.

## Evidencia local

| Comprobación | Resultado |
|---|---|
| Pruebas unitarias | 259 aprobadas en 53 archivos |
| Lint | Sin errores ni advertencias |
| Auditoría de dependencias | Sin vulnerabilidades |
| Build | Next.js 16.3.7, 72 páginas generadas |
| Navegador: autenticación pública, catálogo y PWA | 16 pruebas aprobadas |
| Navegador: ficha → bolsa → formulario | 2 pruebas adicionales aprobadas, a 390 y 1440 px, sin enviar pedidos |
| Smoke local | 16 comprobaciones aprobadas |
| SEO local | 20 comprobaciones aprobadas |
| SQL aislado | 56 migraciones, 51 tablas con RLS y ciclos de stock/pedidos/combos aprobados |

Las comprobaciones públicas del navegador usaron lecturas de catálogo; no crearon pedidos, usuarios, cobros ni mensajes en producción. Las pruebas de escritura SQL se ejecutaron en la base aislada. Esta evidencia no reemplaza las suites de integración en Supabase staging.

## Supabase en la nube

Decisión del propietario: Supabase en la nube; no utilizar Docker en la computadora ni en CI. PostgreSQL aislado es una prueba complementaria; no reemplaza Auth, Storage o PostgREST del staging real.

Producción: `qbbnvdmadgomfmrsfxlo`. La consulta de sólo lectura del 29/09 confirmó una versión activa con `payments_enabled`, `mercado_pago_enabled`, `bank_transfer_enabled` y `catalog_dual_price_visible` en `true`. Los informes que describían flags apagados corresponden al cierre histórico de agosto. La función de combos atómicos existe y rechaza una invocación sin usuario administrador.

Staging: debe ser un proyecto dedicado diferente de producción. CI y las pruebas mutantes requieren referencia, URL, claves y conexión de DB explícitas. La reconexión se verificó el 29/09: el conector ahora ve producción `ilara-app` (`qbbnvdmadgomfmrsfxlo`), activa, en `ilancueto's Org` (`ssvkizrhdwcuybhcaatm`). Los otros proyectos visibles son FinningCAT y FINSA Staging y no son destinos autorizados para Ilara. Con aprobación general del propietario se consultó el costo (US$0/mes) e intentó crear `ilara-staging` en la organización de producción: el proveedor rechazó la creación por el límite de dos proyectos gratuitos activos de la cuenta. No se pausaron ni eliminaron otras aplicaciones. Las suites cloud siguen pendientes; GitHub sólo tiene `ILARA_CRON_SECRET`, sin las credenciales de staging.

Instrucciones: [Supabase en la nube](docs/SUPABASE_CLOUD_TESTS.md). No hay fallback automático a producción ni a Supabase local.

Comprobación adicional de salud, 29/09 a las 23:16 ART (30/09 02:16 UTC), tras el aviso del propietario de que veía «unhealthy»: `get_project` informa `ACTIVE_HEALTHY`; Auth `/auth/v1/health`, lectura anónima de un ID de producto y Storage `/storage/v1/status` responden HTTP 200. PostgreSQL respondió una consulta de estado y no está en recuperación. El propietario confirmó después que el aviso desapareció y autorizó probar sobre ese proyecto. En esta continuación se ejecutaron comprobaciones de sólo lectura; no se cambiaron los guardrails de los runners cloud ni se ejecutaron las suites mutantes.

Comprobaciones adicionales sobre producción:

- Historial de Supabase: 56 migraciones, incluidas `20260905162516_atomic_combo_save` y `20260930023621_harden_mp_backend_rpc_permissions`.
- RLS activo en las 51 tablas públicas; ninguna tabla pública sin RLS.
- 45 probes HTTP HEAD con clave pública anónima: las 40 tablas sensibles enumeradas en la matriz y las cinco columnas internas de productos rechazaron lectura con HTTP 401/403. Sin lectura de filas sensibles ni uso de service role en estos probes.
- Ninguna función `SECURITY DEFINER` del esquema público carece de un `search_path` explícito. Esto no valida por sí solo la autorización de su cuerpo.
- Advisors tras la corrección: 28 avisos INFO de RLS sin políticas; 6 WARN de funciones `SECURITY DEFINER` ejecutables por anon y 40 por authenticated. Los controles internos se revisaron y 13 RPC administrativas rechazaron un UID ficticio sin rol dentro de una transacción READ ONLY con rollback. Las suites completas de autorización cloud siguen pendientes. La protección contra contraseñas filtradas continúa desactivada: la organización es Free y la interfaz la ofrece exclusivamente en Pro; no se contrató un plan. Referencias: [revisión de RPC](docs/SEGURIDAD_RPC_2026-09-29.md), [contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Publicación

El dominio apunta a Vercel `ilara`, proyecto `prj_l1212uETlGghvn8jChfiXCp68SzN`. La inspección al iniciar esta revisión encontró `dpl_CoZCHucgDcZ8xwGpCS6Y6Wu2tnnu`, del 5/09. La ficha inexistente todavía devolvía HTTP 200 en esa versión; el paquete SEO local devuelve HTTP 404.

Publicación completada: `dpl_8zA5rjQaRu4QAuoxLavG1mxCYgQG`, URL `https://ilara-co0zghqrc-ilara.vercel.app`, proyecto autorizado `ilara`. Build remoto correcto con Next.js 16.3.7 y 72 páginas. Antes de promover se verificó el deployment protegido mediante `vercel curl`: smoke 16/16 y SEO 14/14. Después de promover, el dominio `https://ilara.com.ar` aprobó smoke 16/16 y SEO remoto 14/14, sin inyección de fallos. La ficha inexistente ahora responde 404 real.

Navegador sobre el dominio publicado: 8/8 pruebas de `e2e/catalogo.spec.ts` aprobadas, incluidos ficha → bolsa → formulario a 390 y 1440 px sin enviar pedidos, marca, login, buscador, 404, búsqueda vacía y ranking SSR/hidratación. La primera ejecución tuvo tres timeouts con un límite específico de 15 segundos; se quitó ese override y se repitió el archivo completo con el presupuesto común de Playwright. Las navegaciones de catálogo tardaron aproximadamente 22 segundos en este equipo; el resultado valida funcionalidad, no un objetivo de rendimiento.

Comprobación remota previa a publicación, 29/09 por la noche: la versión anterior obtuvo smoke 15/16 y SEO 3/14. Fallaban ficha inexistente (200), paginación, búsqueda sin resultados, orden/filtro noindex, normalización de queries, página fuera de rango, schema de devoluciones, ID malformado y sitemap. Esos fallos quedaron corregidos en las comprobaciones posteriores a la publicación.

Revisión previa de archivos históricos: se inspeccionaron las 26 capturas de `docs/redesign`, `docs/review-2026-09-05` y `docs/seo`. Muestran catálogo público, prototipos y formularios sin datos ingresados; no se observaron datos de clientes ni credenciales. Escaneo de 586 archivos publicables sin coincidencias con credenciales privadas conocidas ni tokens `sb_secret_`/`sbp_`. Se preservaron todos los archivos. La única mutación en producción fue la migración de permisos; no se crearon pedidos, usuarios, cobros ni mensajes.

## Límites y decisiones de producto

La PWA requiere internet. Etiquetas de envío y tracking automático, wishlist, recuperación de carritos, compras/proveedores y lotes son ampliaciones del producto, no correcciones de los flujos existentes. La cola durable de notificaciones, alertas externas y una prueba de restauración de backups siguen requiriendo trabajo operativo específico; los reintentos inmediatos no los sustituyen. Los objetivos de recuperación RPO/RTO deben ser aceptados por el negocio y respaldados por una prueba de restauración.

Los componentes grandes se pueden seguir extrayendo en cambios acotados; su tamaño no debe registrarse como una falla de funcionamiento. No se ejecutaron cobros reales ni mensajes a clientes durante esta revisión.
