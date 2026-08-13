/**
 * Barril de compatibilidad (Stage 5).
 *
 * - Cliente browser: `supabase` / `getBrowserSupabase` desde `./supabase/browser`
 * - Tipos de panel: `./domain/types`
 * - Catálogo público: `./domain/catalog/publicDto` (no usar Producto admin en UI pública)
 * - Server: importar desde `@/lib/supabase/server` o `@/lib/supabase/public` (server-only)
 *
 * No exporta service role ni módulos server-only.
 */

export {
  supabase,
  getBrowserSupabase,
  signIn,
  signOut,
  getUser,
  getSession,
} from '@/lib/supabase/browser'

export type {
  Producto,
  Cupon,
  Categoria,
  Cliente,
  PagoDesglose,
  Venta,
  ItemVenta,
  Combo,
  ComboItem,
  ComboConItems,
  ItemCarrito,
  StockMovement,
  ProductImageSource,
} from '@/lib/domain/types'

export { getProductImages } from '@/lib/domain/images'
