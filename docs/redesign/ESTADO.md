# Estado del rediseño

## Entrega de diseño

- Propuesta creada; aplicación publicada sin cambios por esta tarea.
- `prototipo.html`: siete vistas, responsive, fotos públicas reales y datos de demostración. Sin conexión de escritura a APIs ni persistencia de pedidos.
- Especificación: `PLAN_FRONTEND.md`. Prompt de ejecución: `PROMPT_GROK.md`.

## Implementación

Rama: `codex/catalogo-redesign`. El trabajo previo sin commit (correcciones del 5 de septiembre) se conservó. No se desplegó.

### Etapa 1 — Base visual + tarjetas

Tokens públicos en `.storefront` (`#FFFEFA`, acción `#A42447`, Outfit). El wrapper fija tema claro aunque `html` tenga `.dark`, para no contaminar el panel. Componentes en `components/storefront/`: shell, header (logo actual), footer (Ingresar, seguimiento), `ProductCard`.

### Etapa 2 — Catálogo completo

Búsqueda visible, categorías reales + filtro derivado Combos, filtros de precio en sheet, orden existente (default novedades), paginación, empty/error/skeleton. Query params `q/cat/sort/page/min/max` sincronizados en el cliente sin volver dinámica la ruta ISR `/catalogo`.

### Etapa 3 — Producto, combos y bolsa

Ficha con galería manual, CTA único, WhatsApp secundario, barra móvil cuando el CTA sale de vista, entrega sin plazos ni envío gratis inventados. Combos: imagen estática y “Ver qué incluye”. Bolsa: drawer 480 px / móvil pantalla completa, quitar distinto de restar, cupón colapsado, subtotal sin total definitivo, “Continuar con mi pedido” con `refreshCarrito()` y bloqueo “Verificando bolsa…”.

### Etapa 4 — Checkout

Misma acción y testids. Superficie continua, datos + resumen, pasos “Datos y entrega → Pago”. No se muestra “listo” hasta crear el pedido en servidor. Foco al primer campo inválido.

### Etapa 5 — Pago y seguimiento

Mismo header simplificado y tokens. Contratos, `data-testid` y `Referrer-Policy: no-referrer` conservados. Sin simulaciones del prototipo.

### Etapa 6 — QA

- `npm run lint`: 0 errores; 28 warnings preexistentes en `mockup`.
- `npx tsc --noEmit --incremental false`: aprobado.
- `npm run test`: 46 archivos, 234 pruebas (232 previas + 2 de vista URL).
- `npm run build`: aprobado, 72 páginas. `/catalogo` sigue ISR 1 min.
- E2E públicos: `catalogo`, `mobile`, `pwa` y `a11y` aprobados. Axe del catálogo corregido (skeleton con `role=status`). El webServer de Playwright usa un Supabase placeholder (`fetch failed`): no se crearon pedidos ni se afirma cobertura integral. Docker/staging sigue indisponible.
- Capturas locales con `next start` y `.env.local` (catálogo real, sin crear pedido): `impl-catalogo-desktop.png`, `impl-catalogo-mobile.png`, `impl-filtros-mobile.png`, `impl-ficha-mobile.png`, `impl-bolsa-mobile.png`, `impl-checkout-mobile.png`, `impl-checkout-retiro.png`, `impl-pago.png`.

## Archivos tocados (principales)

- `components/storefront/*`
- `components/Catalogo.tsx`, `ModalCarrito.tsx`, `CheckoutPedido.tsx`, `ModalDetalleCombo.tsx`, `PedidoPagoClient.tsx`, `PedidoSeguimientoClient.tsx`, `ProductoCatalogoRecover.tsx`, `ConsumeFollowToken.tsx`
- `components/product/ProductPublicDetailClient.tsx`
- `app/globals.css`, `app/catalogo/page.tsx`, `app/catalogo/loading.tsx`
- `hooks/useCarrito.ts`, `useCatalogDerivedLists.ts`, `useDialogA11y.ts`
- `lib/domain/catalog/catalogView.ts`, `lib/__tests__/catalogView.test.ts`
- `e2e/catalogo.spec.ts`, `e2e/a11y.spec.ts`

## Limitaciones

- Sin capturas comparables con catálogo real en este entorno: el webServer de Playwright usa un Supabase placeholder. Revisar visualmente en local con `.env.local` antes de publicar.
- Panel, Auth, RLS, RPC, pagos y envíos no se reescribieron.
- No se publicó este rediseño.

## Siguiente paso

Revisión visual del dueño a 360/390/768/1440 px. Publicar sólo con autorización explícita.
