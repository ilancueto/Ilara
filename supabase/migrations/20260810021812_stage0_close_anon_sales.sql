-- Etapa 0 / SEC-02: cerrar acceso directo de anon a sales y sale_items.
-- El catálogo solo debe usar el RPC catalog_sales_by_product() (agregados).
-- Idempotente: revoca grants, elimina políticas públicas residuales y reafirma RLS.

ALTER TABLE IF EXISTS public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sale_items ENABLE ROW LEVEL SECURITY;

-- Quitar políticas que pudieran otorgar SELECT/ALL a anon o public (nombres conocidos y genéricos).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('sales', 'sale_items')
      AND (
        'anon' = ANY (roles)
        OR 'public' = ANY (roles)
        OR policyname ILIKE '%anon%'
        OR policyname ILIKE '%public%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Revocar privilegios de tabla al rol anon (y PUBLIC por si hubo GRANT amplio).
REVOKE ALL ON TABLE public.sales FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.sale_items FROM anon, PUBLIC;

-- Autenticados conservan acceso operativo del panel (autorización granular = Etapa 1).
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sale_items TO authenticated;

-- Políticas autenticadas (re-crear si faltan; no abren anon).
DROP POLICY IF EXISTS "Authenticated can manage sales" ON public.sales;
CREATE POLICY "Authenticated can manage sales"
  ON public.sales
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can manage sale_items" ON public.sale_items;
CREATE POLICY "Authenticated can manage sale_items"
  ON public.sale_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.sales IS
  'Ventas: sin GRANT/SELECT para anon. Catálogo usa catalog_sales_by_product().';
COMMENT ON TABLE public.sale_items IS
  'Líneas de venta: sin GRANT/SELECT para anon.';
