# Auditoría SEO — Ilara

Fecha: 5 de septiembre de 2026. Sitio público auditado: `https://ilara.com.ar`. Código: rama `codex/catalogo-redesign` (el rediseño ya está en producción: `dpl_CoZCHucgDcZ8xwGpCS6Y6Wu2tnnu`).

Fuentes consultadas al ejecutar (vigentes):

- [Product structured data](https://developers.google.com/search/docs/appearance/structured-data/product) (actualizado 2025-12-10)
- [Ecommerce site structure](https://developers.google.com/search/docs/specialty/ecommerce/help-google-understand-your-ecommerce-site-structure) (2025-12-10)
- [Faceted navigation](https://developers.google.com/search/docs/crawling-indexing/crawling-managing-faceted-navigation) (2025-12-18)
- [Optimizing for generative AI on Google Search](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) (2026-07-10)

Sin acceso a Search Console ni CrUX de campo. Los volúmenes de búsqueda y rankings no se inventan.

## Qué se indexa

| Tipo | Indexable | Evidencia |
|---|---|---|
| `/catalogo` | Sí | `robots: index, follow`, canonical `https://ilara.com.ar/catalogo` |
| `/catalogo/p/{id}` existente | Sí | canonical propio, JSON-LD Product |
| `/catalogo/p/{id}` inexistente | No debería | **Hoy HTTP 200** con título “Producto no encontrado” |
| `/` | No | 307 → `/catalogo`; metadata `noindex` |
| `/login` | No | `noindex, follow` |
| `/pedido` | No | `noindex, nofollow` + `Disallow: /pedido` |
| Panel (`/gastos`, etc.) | No | proxy redirige a `/login` sin sesión |
| `?q=&cat=&sort=&page=` | No | sólo `history.replaceState`; canonical del catálogo sin query |

## Hallazgos

| URL / archivo | Problema | Evidencia | Impacto probable | Solución | Esfuerzo | Prioridad |
|---|---|---|---|---|---|---|
| `/catalogo/p/999999991` | Soft 404: HTTP 200, hereda `index, follow` del layout | HEAD 200; title “Producto no encontrado \| Ilara”; smoke acepta 200 | Google puede tratar la URL como blanda y gastar rastreo | `notFound()` también en `generateMetadata`; `robots: noindex`; `not-found.tsx` del segmento | S | P0 |
| `lib/productStructuredData.ts` | JSON-LD declara devolución gratis y 3 días | HTML de `/catalogo/p/86`: `FreeReturn`, `merchantReturnDays: 3` | Desajuste con la ficha (ya no promete plazos). Riesgo de datos de merchant incorrectos | Quitar `hasMerchantReturnPolicy` hasta tener política visible aprobada | S | P0 |
| `lib/productStructuredData.ts` | Marca inventada si falta `brand` | Código: `SCHEMA_FALLBACK_BRAND = 'Ilara Beauty'`. En p/86 la marca real es Tejar (OK). Productos sin marca recibirían la marca del vendedor | Confunde marca y vendedor | Omitir `brand` si no hay dato; el `seller` sigue siendo Ilara | S | P0 |
| `app/sitemap-xml/route.ts` | `lastmod` del catálogo = hoy; fichas = `created_at` | Sitemap 62 URLs; catálogo `lastmod` 2026-09-05; p/86 `lastmod` 2026-03-28 | Simula frescura diaria del listado; `created_at` no es modificación | Publicar sólo `<loc>`; no usar `changefreq`/`priority` como palanca | S | P0 |
| `app/sitemap-xml/route.ts` | Si falla Supabase, responde 200 con 1 URL | `catch` y `!pr.ok` dejan sólo `/catalogo` | Un fallo transitorio puede borrar ~60 URLs del sitemap en Google | HTTP 503 + `Retry-After` cuando la consulta falla | S | P0 |
| `components/Catalogo.tsx` | Paginación y categorías son botones, no `<a href>` | Grid SSR muestra la primera página (15). El resto vive en estado cliente / sitemap | Googlebot no “busca” ni pagina; el sitemap mitiga | Índice HTML de todos los productos en `/catalogo` + sitemap fiable | M | P1 |
| Productos agotados ocultos | Fichas desaparecen del catálogo y del sitemap | `PUBLIC_CATALOG_MIN_STOCK` + select del servidor | URLs antiguas pueden 404; se pierde historial de la ficha | **No cambiar ahora.** Propuesta: mantener ficha con `OutOfStock` un tiempo | — | P1 (decisión) |
| Filtros `?q&cat&min&max` | No hay páginas de categoría con contenido propio | Categorías reales en nav; no hay rutas `/catalogo/bases` | Evita facetas infinitas (correcto). No hay landing de intención “labiales Neuquén” | No indexar facetas. Briefs de categoría en el mapa de contenidos; no crear doorway pages | M | P2 |
| Search Console / CrUX | Sin baseline de clics, indexación ni CWV de campo | No hay propiedad verificada en esta sesión | No se puede medir orgánico ni LCP p75 real | Instrucciones en `MEDICION.md` | — | Bloqueo |
| Merchant Center / GBP | No hay feed ni ficha de negocio gestionada aquí | No se abrieron cuentas | Menos elegibilidad a listados y respuestas locales | Documentar requisitos; no publicar perfiles sin aprobación | — | Bloqueo |
| JSON-LD Offer `price` | Precio 6500 ARS en p/86 | Coincide con el precio visible, no con el de transferencia (5850) | Correcto según documentación de merchant listings | Conservar precio público; no marcar el de transferencia como único | — | OK |
| `llms.txt` / schema extra | No existe | Guía de IA de Google: no hace falta | Añadirlo no ayuda ni perjudica en Google | No crear | — | OK |

## Hipótesis (no comprobadas)

- El 200 en fichas inexistentes puede venir de ISR/`notFound()` en Next 16.3 al generar un param bajo demanda. Tras el cambio hay que verificar HEAD otra vez **después** de un deploy.
- Neuquén en metadata es coherente con el negocio; no hay dirección física verificada en el código para LocalBusiness.

## Implementado y verificado en local (`next start`)

Causa del soft 404: Next 16.3 devuelve **200** si `notFound()` corre después de empezar el stream (`loading.tsx` en raíz y en `/catalogo`). Evidencia: docs de Next, archivo `loading.md` § Status Codes. Tras sacar esos boundaries de las fichas, `/catalogo/p/999999991` y `/catalogo/p/86abc` responden **404** + `noindex` en `next start`.

El índice HTML masivo se retiró: las tarjetas ya son enlaces reales y duplicaba la grilla. Sitemap: vacío válido ≠ 503.

Ver `ESTADO.md` para la tabla HTTP. No se publicó este paquete.
