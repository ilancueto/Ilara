-- Seed ficticio únicamente (Stage 2). Sin PII real ni datos de producción.
-- Se ejecuta con `supabase db reset` cuando hay seed configurado.

DO $$
DECLARE
  cat_id integer;
BEGIN
  SELECT id INTO cat_id FROM public.categories WHERE name = 'Demo maquillaje' LIMIT 1;
  IF cat_id IS NULL THEN
    INSERT INTO public.categories (name) VALUES ('Demo maquillaje') RETURNING id INTO cat_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE name = 'Demo skincare') THEN
    INSERT INTO public.categories (name) VALUES ('Demo skincare');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Producto demo labial') THEN
    INSERT INTO public.products (
      name, category_id, brand, sale_price, purchase_price, stock, min_stock,
      visible_in_catalog, discount_percentage
    ) VALUES (
      'Producto demo labial', cat_id, 'Ilara Demo', 1500, 600, 25, 3, true, 0
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE name = 'Producto demo interno') THEN
    INSERT INTO public.products (
      name, category_id, brand, sale_price, purchase_price, stock, min_stock,
      visible_in_catalog, notes
    ) VALUES (
      'Producto demo interno', cat_id, 'Ilara Demo', 900, 400, 10, 2, false,
      'Solo panel — no catálogo'
    );
  END IF;
END $$;
