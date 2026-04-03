-- Combos: productos agrupados con precio especial. Ejecutar en Supabase: SQL Editor → New query → Pegar y Run

CREATE TABLE IF NOT EXISTS combos (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  sale_price numeric NOT NULL CHECK (sale_price > 0),
  image_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS combo_items (
  id serial PRIMARY KEY,
  combo_id int NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
  product_id int NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity int NOT NULL CHECK (quantity > 0),
  UNIQUE(combo_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_combo_items_combo ON combo_items(combo_id);
CREATE INDEX IF NOT EXISTS idx_combos_active ON combos(is_active) WHERE is_active = true;

COMMENT ON TABLE combos IS 'Combos de productos con precio especial para destacar en catálogo';
COMMENT ON TABLE combo_items IS 'Productos que componen cada combo';

-- Permitir product_id NULL en sale_items para registrar combos vendidos
ALTER TABLE sale_items ALTER COLUMN product_id DROP NOT NULL;
