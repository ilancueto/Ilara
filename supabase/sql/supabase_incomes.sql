-- Ingresos que no son ventas (regalo, donación, ventas anteriores al sistema, etc.)
-- Ejecutar en Supabase: SQL Editor → New query → Pegar y Run

CREATE TABLE IF NOT EXISTS incomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  type text NOT NULL CHECK (type IN ('regalo', 'donacion', 'ventas_anteriores', 'otro')),
  description text,
  notes text,
  created_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_incomes_user_date ON incomes(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_incomes_type ON incomes(type);

COMMENT ON TABLE incomes IS 'Ingresos que no provienen de ventas del POS: regalo, donación, ventas anteriores al sistema, etc.';

ALTER TABLE incomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own incomes" ON incomes;
CREATE POLICY "Authenticated can manage incomes"
  ON incomes FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
