# Estado SEO

> Evidencia histórica del 5/09. La revisión del 29/09 y el estado de publicación están en [ESTADO.md](../../ESTADO.md).

> Actualización 29/09: el paquete ya está publicado en `ilara.com.ar`, deployment `dpl_8zA5rjQaRu4QAuoxLavG1mxCYgQG`. Smoke 16/16 y SEO remoto 14/14 aprobados; ficha inexistente 404. Las secciones siguientes conservan el estado histórico anterior.

Fecha de esta revisión: 5 de septiembre de 2026.

## Qué está publicado (producción)

- Rediseño visual en `https://ilara.com.ar` (`dpl_CoZCHucgDcZ8xwGpCS6Y6Wu2tnnu`).
- SEO de producción **todavía viejo**: `/catalogo/p/999999991` responde **200**; JSON-LD con `FreeReturn` y 3 días; sitemap con `lastmod`.
- Este paquete **no se publicó**.

## Hallazgos de la revisión independiente (REVISION_CODEX.md)

Veredicto anterior: **REQUIERE AJUSTES**. Esta pasada corrige los dos hallazgos y los verifica con `next start`.

### Problema 1 — paginación y búsqueda sólo al hidratar

**Causa:** `app/catalogo/(list)/page.tsx` no leía `searchParams`, no pasaba `initialView` y exportaba metadata estática con canonical `/catalogo`. `Catalogo.tsx` aplicaba `q`/`page`/`sort`/`cat` en `useLayoutEffect` desde `window.location.search`. Un GET HTTP a `?page=2` o `?q=inexistenteprueba` devolvía los mismos 15 productos de la página 1, todos con `index, follow` y canonical de la primera página.

**Corrección:**
- El servidor espera `searchParams`, los valida con `parseCatalogView` y pasa `initialView`.
- El HTML inicial coincide con la URL. La hidratación no reescribe ese estado.
- Página 1: canonical `https://ilara.com.ar/catalogo`. `?page=1` y parámetros inválidos redirigen (307) a la forma normalizada.
- `?page=N` (N>1, sin búsqueda/filtro/orden alternativo): indexable, canonical propio.
- Búsqueda, categoría, orden distinto del default y rango de precio: `noindex, follow`, canonical propio (no se colapsa a la página 1).
- Página fuera de rango: 404 real. Se eliminó `app/catalogo/(list)/loading.tsx` para que `notFound()` no streamee un 200.
- Parámetros repetidos: se toma el primero.

**Caché / render:** `searchParams` es Request-time en Next 16; `/catalogo` pasa a ser **dinámica** (`ƒ` en el build). El snapshot de productos/combos/categorías se cachea aparte con `unstable_cache` 60s (`lib/catalog/publicCatalogSnapshot.ts`). Un fallo de consulta no se guarda en esa caché. No hay ISR de HTML del listado: cada query renderiza su documento. El comentario que prometía ISR del catálogo se quitó.

### Problema 2 — noindex durante una falla temporal

**Causa:** `status: 'error'` en `app/catalogo/p/[id]/page.tsx` devolvía `ProductoCatalogoRecover` con metadata `robots: noindex`. Eso es un 200 recuperable que puede pedir a Google que retire una ficha válida. `noStore()` no anula esa directiva.

**Corrección:**
- Producto válido: 200, `index, follow`, Product/Offer.
- Inexistente u oculto/agotado: `notFound()` → 404, sin Product/Offer. Regla comercial `PUBLIC_CATALOG_MIN_STOCK = 1` intacta.
- ID malformado: 404 sin consultar la base.
- Fallo del proveedor: se lanza en el Server Component. **Status comprobado en `next start`: 500.** Cuerpo `Internal Server Error`. Sin `noindex`, sin Product/Offer, sin `Cache-Control` público. No es 503 (Next 16 no asigna 503 a `error.tsx` en este caso). `generateMetadata` no lanza (un throw ahí también daba 500 plano) y no pone `noindex`.
- `app/catalogo/p/error.tsx` queda para navegación cliente; el GET de producción no lo usa en esta versión.
- No se cachea el error como ausencia: tras quitar el fallo, el ID de prueba pasa a 404 real y `p/86` sigue 200 indexable.

**Caché / ficha:** `generateStaticParams` + `revalidate = 120`. Las fichas conocidas se prerenderizan (● SSG). Si la regeneración ISR lanza, Next conserva la última HTML válida (precios/stock del HTML hasta 120s). La compra no usa esa HTML como fuente de verdad: el checkout sigue validando precio y stock. No hay fallback permanente 200 vacío.

## Cómo se simuló la falla temporal

Sólo en local, sin tocar Supabase de producción:

1. `next start` con `ILARA_ALLOW_SEO_FAULT=1`.
2. Archivo fijo `.seo-fault-local` en el cwd (`product 123456789`, `sitemap empty`, `sitemap error`).
3. Inerte si `VERCEL` está definido o falta la env. No hay query param público. El visitante no puede activarlo.

## Tabla HTTP — antes (revisión Codex) vs después (`next start` local)

Antes, el chequeo 7/7 no cubría paginación. Medición Codex aparte:

| Caso | Antes | Después (`http://127.0.0.1:3000`) |
|---|---|---|
| `/catalogo` | 200, index, canonical `/catalogo`, 15 productos (86…68) | 200, index, follow, canonical `/catalogo` |
| `/catalogo?page=2` | **mismos 15**, canonical `/catalogo`, index | 200, index, follow, canonical `...?page=2`, **otros IDs** |
| `/catalogo?q=inexistenteprueba` | **mismos 15**, canonical `/catalogo`, index | 200, **noindex, follow**, canonical con `q`, vacío “No encontramos productos” |
| `/catalogo?sort=precio-asc` | no medido | 200, noindex, follow, canonical propio, `precio-asc` en el HTML |
| `/catalogo?cat=combos` | no medido | 200, noindex, follow, canonical propio |
| `/catalogo?page=1` | no medido | **307** a `/catalogo` |
| `/catalogo?sort=nope` | no medido | **307** a `/catalogo` |
| `/catalogo?page=99` | no medido | **404**, noindex |
| Ficha válida `/catalogo/p/86` | 200, index, Product+Offer 6500 | igual: 200, index, Offer.price **6500**, marca Tejar, seller Ilara Beauty, sin FreeReturn |
| ID inexistente | 404, noindex | 404, noindex, sin Product/Offer |
| ID malformado | 404, noindex | 404, noindex |
| Falla temporal (ID no prerenderizado + archivo de fallo) | no simulado; rama `error` era 200+noindex | **500**, sin noindex, sin Product/Offer, sin caché pública |
| Recuperación (se borra el archivo) | — | el ID de prueba → **404** (no queda 500); `p/86` → **200 indexable** |
| Sitemap con productos | 200, 62 URLs | 200, urlset con `/catalogo` y fichas, sin lastmod |
| Sitemap vacío válido | test unitario | HTTP 200 sólo con `/catalogo` (simulado) |
| Sitemap fallo | test unitario 503 | HTTP **503**, Retry-After 300, no-store (simulado) |
| robots.txt / login | OK | OK |

Chequeo ampliado: `SEO_BASE_URL=http://127.0.0.1:3000 node scripts/seo-http-check.mjs` → **20/20 OK**.

## Archivos tocados en esta corrección

- `app/catalogo/(list)/page.tsx` — searchParams, metadata, `initialView`; se quitó `revalidate` del listado.
- `app/catalogo/(list)/loading.tsx` — eliminado (404 reales de página fuera de rango).
- `components/Catalogo.tsx` — hidratación desde `initialView`; no clampa durante carga.
- `lib/domain/catalog/catalogView.ts` — política indexable, redirect, tope de página.
- `lib/domain/catalog/deriveCatalogListing.ts` — mismo filtrado/paginación en servidor y cliente.
- `lib/catalog/publicCatalogSnapshot.ts`, `lib/catalog/catalogSeo.ts`.
- `hooks/useCatalogDerivedLists.ts`, `hooks/useCatalogData.ts`, `components/Catalogo/catalogConstants.ts`.
- `app/catalogo/p/[id]/page.tsx` — throw en fallo; metadata sin noindex.
- `app/catalogo/p/layout.tsx`, `app/catalogo/p/error.tsx`.
- `lib/catalog/publicProductPage.ts`, `productProviderError.ts`, `localSeoFault.ts`, `parseLocalSeoFault.ts`.
- `app/sitemap-xml/route.ts` — simulación local de vacío/error.
- `components/Catalogo/ProductoCatalogoRecover.tsx`, `.gitignore`, tests y `scripts/seo-http-check.mjs`.

## Checks de código (ejecutados en esta pasada)

| Check | Resultado |
|---|---|
| `npm run lint` | 0 errores, 28 warnings de `mockup` |
| `npx tsc --noEmit --incremental false` | OK |
| `npm run test` | 50 archivos, **252** pruebas |
| `npm run build` | OK. `/catalogo` **ƒ** dinámica; fichas **●** SSG; 72 páginas |
| HTTP `seo-http-check.mjs` contra `next start` | **20/20** |
| Navegador Playwright (390 y 1440) | OK: hidratación página 2 sin salto, paginación, búsqueda, ficha, regreso, bolsa, 404 de inexistente |

Capturas: `docs/seo/review-catalogo-1440.png`, `review-catalogo-390.png`, `review-ficha-390.png`, `review-ficha-1440.png`, `review-bolsa-390.png`, `review-ficha-inexistente-390.png`. No se envió pedido.

## Pendientes reales

- Publicar este paquete cuando el dueño lo autorice. **No hay deploy ni push en esta pasada.**
- Search Console / CrUX, GBP, Merchant Center.
- Política de devoluciones si se quiere marcar (sigue sin inventarse en JSON-LD).
- El GET 500 de ficha en `next start` no renderiza el HTML de `error.tsx` (cuerpo `Internal Server Error`). El status y la ausencia de noindex son los que importan para el crawler; mejorar el HTML humano queda aparte.
- En producción, las fichas ya prerenderizadas seguirían sirviendo last-good 200 durante una caída de Supabase (ISR 120s), que es el comportamiento buscado.

## Siguiente paso

Nueva revisión independiente del paquete. Este código **no** está en producción.
