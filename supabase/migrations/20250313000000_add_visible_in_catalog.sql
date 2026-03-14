-- Visibilidad en catálogo público (ocultar productos sin precio/fotos hasta completar)
-- Ejecutar en el SQL Editor de Supabase si no usás migraciones CLI.

ALTER TABLE products
ADD COLUMN IF NOT EXISTS visible_in_catalog boolean DEFAULT true;

COMMENT ON COLUMN products.visible_in_catalog IS 'Si false, el producto no se muestra en el catálogo público (útil para ítems en carga sin precio o fotos).';
