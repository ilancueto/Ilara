# Patrones de UI (sin Storybook)

Referencia rápida para mantener consistencia (C5).

## Tarjetas

- **`PastelCard`** (`components/ui/PastelCard.tsx`): contenedor con borde suave y hover opcional. Usar `noHover` en modales o listas densas.

## Formularios

- Clases globales: `form-input`, `form-select`, `form-label`, `form-section` (ver `globals.css`).
- Botones: `btn-primary`, `btn-ghost` donde aplique.

## Feedback

- **Toasts:** `useToast()` desde `ToastContext`; tipos `success` | `error` | `warning` | `info`.
- **Estados vacíos:** `EmptyState` o mensajes centrados con icono + texto secundario.

## Catálogo público

- Constantes de orden y paginación: `components/Catalogo/catalogConstants.ts`.
- Listas derivadas (filtro + orden + página): `hooks/useCatalogDerivedLists.ts`.
- Badges: `lib/catalogBadges.ts`.

## Punto de venta vs catálogo web

- Precios mostrados al cliente web: `precioCatalogoProducto` en `lib/posPricing.ts` (incluye % descuento del producto).
- Precio de lista en POS / ticket: `precioListaProducto` (lista base).
