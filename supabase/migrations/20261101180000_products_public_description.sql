-- Descripción pública opcional del catálogo (visible a anon). Distinta de notes (interna).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS public_description text;

COMMENT ON COLUMN public.products.public_description IS
  'Texto público de la ficha del catálogo. Nunca copiar notes internas aquí automáticamente.';

-- Extiende grants de columna para anon (misma superficie que stage0).
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
  created_at,
  public_description
) ON TABLE public.products TO anon;
