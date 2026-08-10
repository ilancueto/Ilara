-- Etapa 0 / SEC-02: superficie pública mínima de products (column-level para anon).
-- RLS decide qué filas; grants de columna limitan qué campos puede pedir anon.
-- authenticated conserva SELECT de tabla completa para el panel.
--
-- Orden de deploy (ver docs/ETAPA0_ORDEN_DEPLOY.md): app con selects explícitos
-- antes de esta migración; no dejar table-level SELECT residual en PUBLIC.

ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.combo_items ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura de catálogo (filas) para anon.
DROP POLICY IF EXISTS "Anon catalog read products" ON public.products;
CREATE POLICY "Anon catalog read products"
  ON public.products
  FOR SELECT
  TO anon
  USING (
    (visible_in_catalog IS NULL OR visible_in_catalog = true)
    AND stock >= 0
  );

DROP POLICY IF EXISTS "Anon catalog read categories" ON public.categories;
CREATE POLICY "Anon catalog read categories"
  ON public.categories
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Anon read active combos" ON public.combos;
CREATE POLICY "Anon read active combos"
  ON public.combos
  FOR SELECT
  TO anon
  USING (is_active = true);

DROP POLICY IF EXISTS "Anon read combo_items for active combos" ON public.combo_items;
CREATE POLICY "Anon read combo_items for active combos"
  ON public.combo_items
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.combos c
      WHERE c.id = combo_items.combo_id AND c.is_active = true
    )
  );

-- Quitar SELECT de tabla completa a anon Y a PUBLIC antes de grants por columna.
-- (PUBLIC residual + GRANT de columna a anon dejaría table-level vigente.)
REVOKE SELECT ON TABLE public.products FROM anon, PUBLIC;
REVOKE SELECT ON TABLE public.categories FROM anon, PUBLIC;
REVOKE SELECT ON TABLE public.combos FROM anon, PUBLIC;
REVOKE SELECT ON TABLE public.combo_items FROM anon, PUBLIC;

GRANT SELECT (
  id,
  name,
  brand,
  color,
  sale_price,
  stock,
  category_id,
  image_url,
  image_urls,
  discount_percentage,
  catalog_badge,
  visible_in_catalog,
  created_at
) ON TABLE public.products TO anon;

GRANT SELECT (id, name) ON TABLE public.categories TO anon;

GRANT SELECT (
  id,
  name,
  description,
  sale_price,
  image_url,
  is_active,
  created_at
) ON TABLE public.combos TO anon;

GRANT SELECT (id, combo_id, product_id, quantity) ON TABLE public.combo_items TO anon;

-- Panel autenticado: SELECT completo (y mutaciones vía políticas existentes).
GRANT SELECT ON TABLE public.products TO authenticated;
GRANT SELECT ON TABLE public.categories TO authenticated;
GRANT SELECT ON TABLE public.combos TO authenticated;
GRANT SELECT ON TABLE public.combo_items TO authenticated;

COMMENT ON TABLE public.products IS
  'Catálogo: anon solo columnas públicas (sin purchase_price, notes, min_stock ni auditoría). PUBLIC sin SELECT de tabla.';
