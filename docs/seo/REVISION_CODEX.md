# Revisión independiente del paquete SEO — 5 de septiembre de 2026

Veredicto: **REQUIERE AJUSTES antes de aprobar el paquete completo**. No se publicó ni se modificó código de aplicación en esta revisión.

## Comprobaciones reproducidas

`SEO_BASE_URL=http://127.0.0.1:3000 node scripts/seo-http-check.mjs`: **7/7 OK**. Confirmados los 404 reales de ficha inexistente y malformada, sitemap 200 y metadatos de los casos cubiertos. Revisados el contrato de sitemap vacío/error y la eliminación de marca/políticas ficticias del JSON-LD.

## Hallazgo prioritario: paginación y búsqueda sólo se aplican al hidratar

`app/catalogo/(list)/page.tsx` no recibe ni procesa `searchParams`, no pasa `initialView` y declara metadata estática. `components/Catalogo.tsx` aplica la URL en `useLayoutEffect` mediante `window.location.search`.

Solicitudes HTTP independientes devolvieron exactamente los mismos 15 enlaces de producto para:

- `/catalogo`
- `/catalogo?page=2`
- `/catalogo?q=inexistenteprueba`

Primeros IDs: 86, 84, 82, 81, 79. Últimos: 71, 70, 68. Los tres documentos contienen canonical `https://ilara.com.ar/catalogo` y `index, follow`.

Consecuencia: los enlaces de paginación existen, pero cada destino devuelve inicialmente la primera página. El HTML no representa la URL solicitada y la página 2 no tiene canonical propio. Esto no queda cubierto por el 7/7 actual; el sitemap no corrige la incoherencia.

Corrección solicitada: procesar parámetros validados en servidor y alimentar `initialView`; definir metadata acorde a paginación y una política explícita para búsquedas/filtros. Las páginas de paginación indexables deben tener canonical propio. Verificar el costo sobre ISR/caché al introducir `searchParams`, según las guías instaladas de Next.

Agregar comprobaciones HTTP: página 2 devuelve productos distintos cuando el inventario tiene suficientes resultados; canonical de página 2; búsqueda sin resultados coherente desde HTML; política robots para búsqueda/filtros. Verificar hidratación sin saltos y navegación móvil.

Referencia: https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading

## Riesgo pendiente: fallo transitorio de producto

La rama `status: 'error'` de `app/catalogo/p/[id]/page.tsx` devuelve recuperación con metadata `noindex`. No confundir `noStore()` con protección frente a desindexación: evita almacenamiento según el contexto del framework, pero no impide que un crawler procese el `noindex` recibido durante una caída.

Antes de aprobar, simular una falla sólo en el entorno local y comprobar HTTP, robots, caché y recuperación de una ficha válida. Elegir una estrategia de error temporal que no anuncie que un producto válido debe salir del índice; no duplicar consultas en proxy sin justificarlo ni provocar una caída de producción para probar.

No se volvió a ejecutar lint, build o todas las pruebas unitarias: sus resultados anteriores siguen siendo los reportados por el ejecutor, no checks repetidos en esta revisión.
