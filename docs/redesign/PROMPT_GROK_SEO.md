# Prompt de ejecución SEO para Ilara

Actuá como responsable de SEO técnico, arquitectura de ecommerce y desarrollo Next.js. Trabajá en `C:\Users\ilaan\ilara-app`, sitio público `https://ilara.com.ar`. Ilara vende productos de belleza y tiene un catálogo público conectado a un panel privado. Quiero aumentar tráfico orgánico cualificado y pedidos, no sólo obtener un puntaje de una herramienta. Auditá, priorizá e implementá las mejoras de código; entregá además un plan editorial y de medición. No prometas posiciones ni multiplicadores de tráfico.

## 1. Contexto y método

Leé `AGENTS.md`, las guías de la versión instalada en `node_modules/next/dist/docs/`, `docs/CORRECCIONES_2026-09-05.md` y `docs/redesign/PLAN_FRONTEND.md`. Inspeccioná Git y preservá todo el trabajo anterior, aunque esté sin commit. El rediseño y SEO deben ser compatibles: no vuelvas a introducir una portada pesada o bloques de keywords que empeoren la compra. No despliegues sin revisión del dueño.

Consultá documentación vigente de Google Search Central para cada decisión relevante. No uses consejos antiguos sobre Next.js, snippets o tipos de schema. Separá hallazgos comprobados, hipótesis y bloqueos por falta de acceso. No inventes datos de Search Console, volúmenes de búsqueda, conversiones ni rankings.

Antes de cambiar nada, creá `docs/seo/AUDITORIA.md` con una tabla: URL/archivo, problema, evidencia reproducible, impacto probable, solución, esfuerzo y prioridad. Ejecutá primero P0/P1; no gastes el presupuesto en cambios cosméticos de impacto incierto.

## 2. Auditoría del sitio real y el código

Rastreá de forma acotada el catálogo y una muestra representativa de productos, categorías si existen, paginaciones, filtros y rutas inexistentes. Revisá status HTTP, redirecciones, canonical, meta robots, título, descripción, H1, enlaces HTML, imágenes, JSON-LD y contenido renderizado. Compará HTML inicial con DOM: un sitemap no sustituye una navegación rastreable.

Archivos iniciales:

- `app/layout.tsx`, `app/catalogo/page.tsx`, `app/catalogo/p/[id]/page.tsx`.
- `app/robots.ts`, `app/sitemap-xml/route.ts`, `next.config.ts`, `proxy.ts` si existe.
- `lib/site.ts`, `lib/productStructuredData.ts`, `lib/catalog/serverCatalog.ts`.
- `components/Catalogo.tsx`, `hooks/useCatalogDerivedLists.ts`, DTO y selects públicos.

Pistas concretas que debés verificar, sin tratarlas como diagnóstico ya cerrado:

1. El sitemap usa `created_at` para fichas y la fecha actual para catálogo. Evitar simular actualizaciones: usar una fecha real de modificación relevante o eliminar `lastmod` si no hay una fuente fiable. No invertir tiempo en ajustar `priority/changefreq` como palanca principal.
2. La generación del sitemap puede devolver sólo el catálogo cuando falla la consulta. Diseñar una respuesta de error o caché válida que no convierta una caída transitoria de datos en una desaparición masiva de URLs.
3. La función de JSON-LD usa `Ilara Beauty` como marca de producto cuando falta `brand`. Verificar si corresponde: vendedor y marca no son equivalentes; omitir una marca desconocida en lugar de inventarla.
4. JSON-LD declara devoluciones gratuitas y ventana de tres días. Verificar una política real y visible aprobada por el dueño; no publicar datos de devoluciones no confirmados ni dar asesoramiento legal por cuenta propia.
5. Hoy se ocultan productos agotados. Analizar el costo SEO de esa regla y proponer mantener accesibles fichas temporalmente agotadas con `OutOfStock` y alternativas. No cambiar esa decisión comercial silenciosamente. Distinguir agotado temporal, discontinuado y producto inexistente.
6. Una prueba anterior acepta 200 para productos inexistentes. Inspeccionar HTTP, HTML y robots: comprobar `notFound()`/streaming en esta versión de Next y evitar soft 404. No devolver 404 por una caída temporal de Supabase.
7. Filtros y paginación del frontend pueden no generar enlaces rastreables. Comprobar que Google pueda descubrir todas las fichas relevantes sin tener que ejecutar una búsqueda o pulsar controles arbitrarios.

## 3. Indexación y arquitectura

Definí qué tipos de URL se indexan y cuáles no. Catálogo, fichas y categorías útiles pueden ser indexables; búsqueda interna, combinaciones arbitrarias de filtros, login, bolsa, checkout, pago, seguimiento y panel no deben generar inventario SEO.

`robots.txt` no es autorización y tampoco garantiza desindexación. No bloquear el rastreo de una URL si dependés de que Google lea su `noindex`. Las rutas privadas siguen protegidas por servidor, aunque tengan robots. Nunca expongas tokens o datos de pedidos en sitemap, canonical, JSON-LD o analítica.

Unificar HTTPS, host preferido, trailing slash y canonical, evitando cadenas de redirects y URLs `vercel.app` en producción. No cambiar `/catalogo/p/[id]` sólo porque un slug suene mejor. Si una migración de URLs tiene un beneficio demostrado, preparar mapa completo de 301, actualizar enlaces/sitemap y probar preservación de señales antes de ejecutarla.

Diseñar categorías estables con títulos y contenido útiles basadas en inventario real y demanda validada. No crear cientos de páginas casi iguales por marca, tono o ciudad. Paginaciones deben enlazar páginas reales y tener canonical apropiado a su propio contenido; no canonicalizar automáticamente toda página 2+ a la primera.

Para filtros, elegir una estrategia explícita de rastreo/indexación consistente con la documentación actual. Canonical no es una herramienta universal para controlar rastreo ni corresponde apuntar toda combinación a una página no equivalente.

## 4. Fichas, contenido y búsqueda local

Metadatos únicos y naturales: producto/marca cuando existan; categoría y propuesta relevante. Evitar relleno y límites de caracteres tratados como reglas rígidas. Un H1 claro, contenido comprensible y enlaces internos contextuales.

Usar sólo información verificable: nombre, marca, tamaño, color, presentación, precio, disponibilidad y descripción pública. Nunca reutilizar `notes` internas, costos o auditoría. Si falta descripción pública, preparar un esquema de contenido y backlog de carga; cualquier ampliación del modelo de datos debe ser mínima, explícita y separada del trabajo visual.

Crear un mapa de intención de búsqueda → página existente/propuesta → contenido necesario → próxima acción. Investigar consultas de maquillaje, skincare y productos vendidos realmente. Priorizar categoría y producto sobre un blog genérico. No inventar volúmenes si no hay herramienta disponible.

Para SEO local, verificar primero qué ubicación, modalidad de atención, horario y área de servicio son públicos y reales. Neuquén aparece en el código, pero no autoriza inventar una dirección física o sucursales. Preparar mejoras de información comercial y Google Business Profile sólo si el negocio es elegible; no publicar ni alterar perfiles externos sin aprobación. No crear doorway pages por localidad.

Entregar 10 briefs priorizados, no 100 artículos automáticos: intención, URL objetivo, título propuesto, esquema breve, datos faltantes y productos/enlaces internos. Ningún texto debe inventar beneficios médicos, certificaciones, ingredientes o reseñas.

## 5. Datos estructurados y canales de producto

Revisar `Product`, `Offer`, `BreadcrumbList` y `Organization` según elegibilidad actual. Precio, moneda ARS, stock, imágenes y políticas deben coincidir con la página visible y el servidor. No usar un precio de transferencia condicionado como si fuera el único precio incondicional. Verificar las reglas actuales de precios y ofertas antes de elegir el marcado.

No inventar GTIN, MPN, marca, `aggregateRating`, reseñas o `priceValidUntil`; omitir datos opcionales desconocidos. No agregar FAQ/review schema esperando rich results para los que el sitio no es elegible. Mantener salida JSON segura contra inyección de scripts.

Evaluar Google Merchant Center/listados gratuitos: preparar un feed con datos verdaderos, URLs canónicas e identificadores estables si procede. No abrir cuentas, aceptar condiciones ni publicar feeds externos automáticamente. Documentar requisitos y accesos pendientes.

## 6. Rendimiento y descubrimiento en buscadores con IA

Medir por separado datos de campo y laboratorio. Usar Search Console/CrUX si están disponibles y Lighthouse reproducible como diagnóstico. Objetivos de campo al percentil 75: LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1; validar contra documentación vigente. Sin datos de campo, declararlo.

Revisar imagen LCP, `next/image`/`sizes`, fuentes locales, JS del catálogo, requests duplicados, layouts que saltan y carga de terceros. No degradar carrito ni frescura de precios/stock para mejorar una métrica. No cachear seguimiento privado ni páginas con capacidades de acceso.

Para buscadores con IA, consultar los requisitos vigentes de Google y otros proveedores concretos. Priorizar contenido útil, datos coherentes, acceso rastreable y fuentes verificables. No presentar `llms.txt`, schema extra o menciones artificiales como atajos de posicionamiento.

## 7. Medición, validación y entrega

Si hay acceso a Search Console, registrar baseline de 28/90 días: clics, impresiones, CTR, consultas, páginas, dispositivo, indexación y Core Web Vitals. Si no hay acceso, seguir con auditoría pública/código y entregar instrucciones para obtenerlo; no marcar esos análisis como hechos.

Separar consultas de marca/no marca y medir pedidos atribuidos al tráfico orgánico cuando exista una implementación fiable. No contar una visita al formulario como compra. Diseñar eventos sin PII y respetar la configuración de privacidad existente. No cargar un nuevo tracker sin revisar consentimiento y duplicación.

Implementar tests de regresión útiles: canonical y metadata por tipo de página, rutas inexistentes, sitemap XML válido y sólo URLs elegibles, JSON-LD con importes correctos, agotados según regla aprobada y exclusión de rutas privadas. Ejecutar lint, TypeScript, tests y build. Revisar varias URLs con Rich Results Test/URL Inspection cuando haya acceso; reportar lo que cada herramienta realmente verificó.

Entregar:

1. `docs/seo/AUDITORIA.md`: hallazgos y evidencias antes/después.
2. Correcciones implementadas y pruebas, agrupadas por impacto.
3. `docs/seo/MAPA_CONTENIDOS.md`: categorías, enlaces internos y 10 briefs.
4. `docs/seo/MEDICION.md`: baseline disponible y revisiones a 14, 30 y 90 días, sin atribuir causalidad por una comparación simple.
5. `docs/seo/ESTADO.md`: completado, bloqueado, siguiente paso y accesos pendientes. Actualizarlo en cada etapa para retomar con poco contexto.

Trabajá primero rastreo/indexación y errores de veracidad; después arquitectura/metadatos/schema; luego rendimiento/contenido/medición. No gastes todo el contexto en una auditoría interminable: implementá las correcciones seguras y justificadas, preservando el rediseño y las reglas del negocio. Dejá el resultado listo para revisar antes de desplegar.

## Documentación inicial

- https://developers.google.com/search/docs/specialty/ecommerce
- https://developers.google.com/search/docs/specialty/ecommerce/help-google-understand-your-ecommerce-site-structure
- https://developers.google.com/search/docs/appearance/structured-data/product
- https://developers.google.com/search/docs/crawling-indexing/crawling-managing-faceted-navigation
- https://developers.google.com/search/docs/fundamentals/ai-optimization-guide

Verificá vigencia y contenido de estas fuentes al ejecutar; no deduzcas reglas actuales de memoria.
