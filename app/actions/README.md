# Server Actions (`app/actions/`)

- **`coupons.ts`** – `validarCuponCatalogo`: lectura de cupones con el cliente Supabase servidor (cookies + anon key). Misma política RLS que el cliente.
- **`orders.ts`** – `createCatalogOrderAction` (Stage 6.1): creación pública de pedido vía DAL + RPC `create_catalog_order`. Sin service role; sin precios del cliente.

Para operaciones que requieran **service role**, usar **Edge Function** o **API route** en servidor con variable `SUPABASE_SERVICE_ROLE_KEY` (nunca en el cliente).
