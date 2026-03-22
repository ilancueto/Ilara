-- Badge fijo en catálogo público (null = reglas automáticas por fecha + % descuento)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS catalog_badge text;

ALTER TABLE products
DROP CONSTRAINT IF EXISTS products_catalog_badge_check;

ALTER TABLE products
ADD CONSTRAINT products_catalog_badge_check
CHECK (
  catalog_badge IS NULL
  OR catalog_badge IN (
    'nuevos',
    'descuento',
    'ultimas',
    'destacado',
    'edicion_limitada'
  )
);

COMMENT ON COLUMN products.catalog_badge IS 'Badge en catálogo: manual (valores permitidos) o NULL para automático.';
