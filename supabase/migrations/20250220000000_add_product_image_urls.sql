-- Múltiples imágenes por producto (catálogo)
-- Ejecutar en el SQL Editor de Supabase si no usás migraciones CLI.

ALTER TABLE products
ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT NULL;

-- Opcional: rellenar desde image_url para productos que ya tenían una imagen
UPDATE products
SET image_urls = ARRAY[image_url]
WHERE image_url IS NOT NULL
  AND (image_urls IS NULL OR image_urls = '{}');
