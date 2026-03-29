-- P1: Ventas atómicas (stock + ítems en una transacción), borrado con restauración de combos,
--     y combo_id en sale_items para saber qué devolver al eliminar.
--
-- Después del deploy: en Supabase Dashboard → Storage → bucket `receipts` → marcar como **private**
-- y aplicar migración 20260328120001_storage_receipts_policies.sql (o políticas equivalentes).

-- ─── sale_items.combo_id ─────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'combos'
  ) THEN
    ALTER TABLE public.sale_items
      ADD COLUMN IF NOT EXISTS combo_id integer REFERENCES public.combos(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.sale_items.combo_id IS 'Si la línea es un combo vendido; product_id queda NULL.';

-- ─── create_sale_with_items ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_sale_with_items(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_sale_id integer;
  v_sale jsonb;
  sale_rec jsonb := p_payload->'sale';
  lines_json jsonb := coalesce(p_payload->'lines', '[]'::jsonb);
  rec record;
  v_has_sm boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF jsonb_array_length(lines_json) = 0 THEN
    RAISE EXCEPTION 'empty_lines' USING ERRCODE = '23514';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stock_movements'
  ) INTO v_has_sm;

  -- Combos referenciados deben existir
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(lines_json) AS t(elem)
    WHERE (elem->>'line_type') = 'combo'
      AND NOT EXISTS (
        SELECT 1 FROM public.combos c WHERE c.id = (elem->>'combo_id')::integer
      )
  ) THEN
    RAISE EXCEPTION 'invalid_combo' USING ERRCODE = '23503';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(lines_json) AS t(elem)
    WHERE (elem->>'line_type') = 'combo'
      AND NOT EXISTS (
        SELECT 1 FROM public.combo_items ci WHERE ci.combo_id = (elem->>'combo_id')::integer
      )
  ) THEN
    RAISE EXCEPTION 'empty_combo' USING ERRCODE = '23514';
  END IF;

  -- Líneas producto: product_id obligatorio
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(lines_json) AS t(elem)
    WHERE (elem->>'line_type') = 'product'
      AND (elem->>'product_id') IS NULL
  ) THEN
    RAISE EXCEPTION 'invalid_product_line' USING ERRCODE = '23514';
  END IF;

  -- Bloqueo + validación de stock (orden estable por product_id)
  FOR rec IN
    WITH line_elems AS (
      SELECT elem FROM jsonb_array_elements(lines_json) AS x(elem)
    ),
    expanded AS (
      SELECT (elem->>'product_id')::integer AS product_id, (elem->>'quantity')::integer AS qty
      FROM line_elems
      WHERE (elem->>'line_type') = 'product'
      UNION ALL
      SELECT ci.product_id, (le.elem->>'quantity')::integer * ci.quantity
      FROM line_elems le
      INNER JOIN public.combo_items ci ON ci.combo_id = (le.elem->>'combo_id')::integer
      WHERE (le.elem->>'line_type') = 'combo'
    ),
    needed AS (
      SELECT product_id, sum(qty)::bigint AS qty
      FROM expanded
      GROUP BY product_id
    )
    SELECT p.id AS product_id, p.stock, n.qty
    FROM needed n
    INNER JOIN public.products p ON p.id = n.product_id
    ORDER BY p.id
    FOR UPDATE OF p
  LOOP
    IF rec.stock < rec.qty THEN
      RAISE EXCEPTION 'insufficient_stock'
        USING ERRCODE = '23514',
        DETAIL = format('product_id=%s need=%s have=%s', rec.product_id, rec.qty, rec.stock);
    END IF;
  END LOOP;

  INSERT INTO public.sales (
    sale_date,
    total,
    payment_method,
    customer_name,
    customer_id,
    notes,
    status,
    created_by,
    payment_breakdown
  )
  VALUES (
    coalesce((sale_rec->>'sale_date')::timestamptz, now()),
    (sale_rec->>'total')::numeric,
    nullif(trim(sale_rec->>'payment_method'), ''),
    nullif(trim(sale_rec->>'customer_name'), ''),
    CASE
      WHEN sale_rec->'customer_id' IS NULL OR jsonb_typeof(sale_rec->'customer_id') = 'null' THEN NULL
      ELSE (sale_rec->'customer_id')::text::integer
    END,
    nullif(trim(sale_rec->>'notes'), ''),
    coalesce(nullif(trim(sale_rec->>'status'), ''), 'completed'),
    CASE
      WHEN sale_rec->>'created_by' IS NULL OR trim(sale_rec->>'created_by') = '' THEN NULL
      ELSE (sale_rec->>'created_by')::uuid
    END,
    CASE
      WHEN sale_rec->'payment_breakdown' IS NOT NULL
        AND jsonb_typeof(sale_rec->'payment_breakdown') = 'array'
      THEN sale_rec->'payment_breakdown'
      ELSE NULL
    END
  )
  RETURNING id INTO v_sale_id;

  INSERT INTO public.sale_items (
    sale_id,
    product_id,
    combo_id,
    product_name,
    quantity,
    unit_price,
    subtotal,
    discount_percentage
  )
  SELECT
    v_sale_id,
    CASE WHEN (elem->>'line_type') = 'product' THEN (elem->>'product_id')::integer ELSE NULL END,
    CASE WHEN (elem->>'line_type') = 'combo' THEN (elem->>'combo_id')::integer ELSE NULL END,
    coalesce(elem->>'product_name', ''),
    (elem->>'quantity')::integer,
    (elem->>'unit_price')::numeric,
    (elem->>'subtotal')::numeric,
    coalesce((elem->>'discount_percentage')::numeric, 0)
  FROM jsonb_array_elements(lines_json) AS x(elem);

  UPDATE public.products p
  SET stock = p.stock - sub.qty
  FROM (
    WITH line_elems AS (
      SELECT elem FROM jsonb_array_elements(lines_json) AS x2(elem)
    ),
    expanded AS (
      SELECT (elem->>'product_id')::integer AS product_id, (elem->>'quantity')::integer AS qty
      FROM line_elems
      WHERE (elem->>'line_type') = 'product'
      UNION ALL
      SELECT ci.product_id, (le.elem->>'quantity')::integer * ci.quantity
      FROM line_elems le
      INNER JOIN public.combo_items ci ON ci.combo_id = (le.elem->>'combo_id')::integer
      WHERE (le.elem->>'line_type') = 'combo'
    ),
    needed AS (
      SELECT product_id, sum(qty)::integer AS qty
      FROM expanded
      GROUP BY product_id
    )
    SELECT * FROM needed
  ) sub
  WHERE p.id = sub.product_id;

  IF v_has_sm THEN
    INSERT INTO public.stock_movements (product_id, type, quantity, reference_type, reference_id, notes, user_id)
    SELECT
      n.product_id,
      'sale',
      -n.qty,
      'sale',
      v_sale_id,
      NULL,
      auth.uid()
    FROM (
      WITH line_elems AS (
        SELECT elem FROM jsonb_array_elements(lines_json) AS x3(elem)
      ),
      expanded AS (
        SELECT (elem->>'product_id')::integer AS product_id, (elem->>'quantity')::integer AS qty
        FROM line_elems
        WHERE (elem->>'line_type') = 'product'
        UNION ALL
        SELECT ci.product_id, (le.elem->>'quantity')::integer * ci.quantity
        FROM line_elems le
        INNER JOIN public.combo_items ci ON ci.combo_id = (le.elem->>'combo_id')::integer
        WHERE (le.elem->>'line_type') = 'combo'
      ),
      needed AS (
        SELECT product_id, sum(qty)::integer AS qty
        FROM expanded
        GROUP BY product_id
      )
      SELECT * FROM needed
    ) n;
  END IF;

  SELECT to_jsonb(s.*) INTO v_sale FROM public.sales s WHERE s.id = v_sale_id;
  RETURN jsonb_build_object('sale', v_sale);
END;
$$;

REVOKE ALL ON FUNCTION public.create_sale_with_items(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_sale_with_items(jsonb) TO authenticated;

COMMENT ON FUNCTION public.create_sale_with_items(jsonb) IS
  'Crea venta, ítems, descuenta stock agregado por producto (combos correctos con líneas duplicadas) y movimientos; todo atómico.';

-- ─── delete_sale_and_restore_stock ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_sale_and_restore_stock(p_sale_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_receipt text;
  v_has_sm boolean;
  rec record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.sales WHERE id = p_sale_id) THEN
    RAISE EXCEPTION 'sale_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT receipt_url INTO v_receipt FROM public.sales WHERE id = p_sale_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stock_movements'
  ) INTO v_has_sm;

  FOR rec IN
    WITH items AS (
      SELECT * FROM public.sale_items WHERE sale_id = p_sale_id
    ),
    restored AS (
      SELECT product_id, quantity::bigint AS qty
      FROM items
      WHERE product_id IS NOT NULL
      UNION ALL
      SELECT ci.product_id, (si.quantity * ci.quantity)::bigint
      FROM items si
      INNER JOIN public.combo_items ci ON ci.combo_id = si.combo_id
      WHERE si.combo_id IS NOT NULL
      UNION ALL
      SELECT ci.product_id, (si.quantity * ci.quantity)::bigint
      FROM items si
      CROSS JOIN LATERAL (
        SELECT c.id
        FROM public.combos c
        WHERE lower(trim(c.name)) = lower(trim(si.product_name))
        ORDER BY c.id
        LIMIT 1
      ) cm
      INNER JOIN public.combo_items ci ON ci.combo_id = cm.id
      WHERE si.product_id IS NULL AND si.combo_id IS NULL
    ),
    agg AS (
      SELECT product_id, sum(qty)::integer AS qty
      FROM restored
      GROUP BY product_id
    )
    SELECT p.id AS product_id, agg.qty
    FROM agg
    INNER JOIN public.products p ON p.id = agg.product_id
    ORDER BY p.id
    FOR UPDATE OF p
  LOOP
    UPDATE public.products
    SET stock = stock + rec.qty
    WHERE id = rec.product_id;
  END LOOP;

  IF v_has_sm THEN
    DELETE FROM public.stock_movements
    WHERE reference_type = 'sale' AND reference_id = p_sale_id;
  END IF;

  DELETE FROM public.sale_items WHERE sale_id = p_sale_id;
  DELETE FROM public.sales WHERE id = p_sale_id;

  RETURN jsonb_build_object('receipt_stored', v_receipt, 'ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_sale_and_restore_stock(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_sale_and_restore_stock(integer) TO authenticated;

COMMENT ON FUNCTION public.delete_sale_and_restore_stock(integer) IS
  'Elimina venta e ítems, restaura stock (productos y componentes de combo via combo_id o nombre legacy), borra movimientos de venta.';
