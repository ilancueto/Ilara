-- Etapa 1 / DATA-01: precios POS autoritativos (Opción A) + frontera transaccional.
-- - SECURITY DEFINER, search_path vacío, relaciones cualificadas.
-- - Vendedor vende y descuenta stock sin UPDATE directo en products.
-- - Cliente no impone unit_price/total/subtotal/product_name/discount.
-- - payment_breakdown: ausente ≠ presente inválido; array estricto.
-- - delete_sale_and_restore_stock: solo admin DEFINER (único camino de borrado).

CREATE OR REPLACE FUNCTION public.create_sale_with_items(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_sale_id integer;
  v_sale jsonb;
  v_lines jsonb;
  sale_rec jsonb;
  lines_json jsonb;
  rec record;
  v_has_sm boolean;
  v_total numeric := 0;
  v_status text;
  v_pay_method text;
  v_pay_sum numeric;
  v_breakdown jsonb := NULL;
  v_bd_raw jsonb;
  v_bd_type text;
  v_allowed_methods text[] := ARRAY['efectivo', 'tarjeta', 'transferencia', 'mixto', 'credito'];
  v_allowed_status text[] := ARRAY['completed', 'pending_payment'];
  v_elem jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_use_pos() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '23514';
  END IF;

  sale_rec := p_payload->'sale';
  lines_json := coalesce(p_payload->'lines', '[]'::jsonb);

  IF sale_rec IS NULL OR jsonb_typeof(sale_rec) <> 'object' THEN
    RAISE EXCEPTION 'invalid_sale' USING ERRCODE = '23514';
  END IF;

  IF jsonb_typeof(lines_json) <> 'array' OR jsonb_array_length(lines_json) = 0 THEN
    RAISE EXCEPTION 'empty_lines' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(lines_json) AS t(elem)
    WHERE coalesce(elem->>'line_type', '') NOT IN ('product', 'combo')
  ) THEN
    RAISE EXCEPTION 'invalid_line_type' USING ERRCODE = '23514';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stock_movements'
  ) INTO v_has_sm;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(lines_json) AS t(elem)
    WHERE (elem->>'quantity') IS NULL
      OR trim(elem->>'quantity') = ''
      OR (elem->>'quantity')::numeric != floor((elem->>'quantity')::numeric)
      OR (elem->>'quantity')::integer <= 0
  ) THEN
    RAISE EXCEPTION 'invalid_quantity' USING ERRCODE = '23514';
  END IF;

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

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(lines_json) AS t(elem)
    WHERE (elem->>'line_type') = 'product'
      AND (
        (elem->>'product_id') IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM public.products p WHERE p.id = (elem->>'product_id')::integer
        )
      )
  ) THEN
    RAISE EXCEPTION 'invalid_product_line' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(lines_json) AS t(elem)
    LEFT JOIN public.products p
      ON (elem->>'line_type') = 'product' AND p.id = (elem->>'product_id')::integer
    LEFT JOIN public.combos c
      ON (elem->>'line_type') = 'combo' AND c.id = (elem->>'combo_id')::integer
    WHERE (
      (elem->>'line_type') = 'product'
      AND (p.sale_price IS NULL OR p.sale_price::numeric <= 0)
    ) OR (
      (elem->>'line_type') = 'combo'
      AND (c.sale_price IS NULL OR c.sale_price::numeric <= 0)
    )
  ) THEN
    RAISE EXCEPTION 'invalid_catalog_price' USING ERRCODE = '23514';
  END IF;

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

  -- Opción A: lista POS = round(sale_price); ignora unit_price/total del cliente.
  SELECT COALESCE(SUM(x.line_sub), 0) INTO v_total
  FROM (
    WITH elems AS (
      SELECT elem FROM jsonb_array_elements(lines_json) AS z(elem)
    ),
    lines AS (
      SELECT
        e.elem,
        (e.elem->>'line_type') AS lt,
        CASE WHEN e.elem->>'line_type' = 'product' THEN (e.elem->>'product_id')::integer END AS pid,
        CASE WHEN e.elem->>'line_type' = 'combo' THEN (e.elem->>'combo_id')::integer END AS cid,
        (e.elem->>'quantity')::integer AS q
      FROM elems e
    )
    SELECT
      CASE
        WHEN l.lt = 'product' THEN round(p.sale_price::numeric, 0) * l.q
        WHEN l.lt = 'combo' THEN round(c.sale_price::numeric, 0) * l.q
      END AS line_sub
    FROM lines l
    LEFT JOIN public.products p ON l.lt = 'product' AND p.id = l.pid
    LEFT JOIN public.combos c ON l.lt = 'combo' AND c.id = l.cid
    WHERE (l.lt = 'product' AND p.id IS NOT NULL)
       OR (l.lt = 'combo' AND c.id IS NOT NULL)
  ) x;

  IF v_total IS NULL OR v_total <= 0 THEN
    RAISE EXCEPTION 'invalid_total' USING ERRCODE = '23514';
  END IF;

  v_status := coalesce(nullif(trim(sale_rec->>'status'), ''), 'completed');
  IF v_status <> ALL (v_allowed_status) THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '23514';
  END IF;

  v_pay_method := nullif(trim(sale_rec->>'payment_method'), '');
  IF v_pay_method IS NULL OR v_pay_method <> ALL (v_allowed_methods) THEN
    RAISE EXCEPTION 'invalid_payment_method' USING ERRCODE = '23514';
  END IF;

  -- Coherencia status ↔ payment_method (opción restrictiva documentada).
  IF v_status = 'pending_payment' AND v_pay_method IS DISTINCT FROM 'credito' THEN
    RAISE EXCEPTION 'payment_status_mismatch' USING ERRCODE = '23514';
  END IF;
  IF v_pay_method = 'credito' AND v_status IS DISTINCT FROM 'pending_payment' THEN
    RAISE EXCEPTION 'payment_status_mismatch' USING ERRCODE = '23514';
  END IF;

  -- payment_breakdown: distinguir ausente vs presente inválido.
  IF sale_rec ? 'payment_breakdown' THEN
    v_bd_raw := sale_rec->'payment_breakdown';
    v_bd_type := jsonb_typeof(v_bd_raw);

    IF v_bd_type <> 'array' THEN
      RAISE EXCEPTION 'invalid_payment_breakdown' USING ERRCODE = '23514';
    ELSE
      v_breakdown := v_bd_raw;

      -- Cada elemento debe ser objeto con method/amount válidos.
      FOR v_elem IN SELECT value FROM jsonb_array_elements(v_breakdown) AS t(value)
      LOOP
        IF jsonb_typeof(v_elem) <> 'object' THEN
          RAISE EXCEPTION 'invalid_payment_breakdown' USING ERRCODE = '23514';
        END IF;

        IF coalesce(nullif(trim(v_elem->>'method'), ''), '') = '' THEN
          RAISE EXCEPTION 'invalid_payment_breakdown' USING ERRCODE = '23514';
        END IF;

        IF lower(trim(v_elem->>'method')) NOT IN ('efectivo', 'tarjeta', 'transferencia') THEN
          RAISE EXCEPTION 'invalid_payment_breakdown' USING ERRCODE = '23514';
        END IF;

        -- amount: number o string numérico simple; no object/array/bool/null.
        IF NOT (v_elem ? 'amount') OR (v_elem->'amount') IS NULL
           OR jsonb_typeof(v_elem->'amount') = 'null' THEN
          RAISE EXCEPTION 'invalid_payment_breakdown' USING ERRCODE = '23514';
        END IF;

        IF jsonb_typeof(v_elem->'amount') NOT IN ('number', 'string') THEN
          RAISE EXCEPTION 'invalid_payment_breakdown' USING ERRCODE = '23514';
        END IF;

        IF jsonb_typeof(v_elem->'amount') = 'string'
           AND trim(v_elem->>'amount') !~ '^[0-9]+([.][0-9]+)?$' THEN
          RAISE EXCEPTION 'invalid_payment_breakdown' USING ERRCODE = '23514';
        END IF;

        IF (v_elem->>'amount')::numeric <= 0 THEN
          RAISE EXCEPTION 'invalid_payment_breakdown' USING ERRCODE = '23514';
        END IF;
      END LOOP;

      IF jsonb_array_length(v_breakdown) > 0 THEN
        SELECT COALESCE(SUM((e->>'amount')::numeric), 0) INTO v_pay_sum
        FROM jsonb_array_elements(v_breakdown) e;

        IF abs(v_pay_sum - v_total) > 0.009 THEN
          RAISE EXCEPTION 'payment_mismatch' USING ERRCODE = '23514';
        END IF;
      END IF;
    END IF;
  ELSE
    v_breakdown := NULL;
  END IF;

  -- mixto exige array no vacío (ya validado si presente).
  IF v_pay_method = 'mixto' THEN
    IF v_breakdown IS NULL OR jsonb_array_length(v_breakdown) = 0 THEN
      RAISE EXCEPTION 'payment_breakdown_required' USING ERRCODE = '23514';
    END IF;
  ELSIF v_breakdown IS NOT NULL THEN
    -- La UI solo envía breakdown para mixto. Evita registros contradictorios
    -- (p.ej. payment_method=efectivo con un desglose íntegro de tarjeta).
    RAISE EXCEPTION 'payment_breakdown_not_allowed' USING ERRCODE = '23514';
  END IF;

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
    v_total,
    v_pay_method,
    nullif(trim(sale_rec->>'customer_name'), ''),
    CASE
      WHEN sale_rec->'customer_id' IS NULL OR jsonb_typeof(sale_rec->'customer_id') = 'null' THEN NULL
      ELSE (sale_rec->'customer_id')::text::integer
    END,
    nullif(trim(sale_rec->>'notes'), ''),
    v_status,
    v_uid,
    v_breakdown
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
    CASE WHEN l.lt = 'product' THEN l.pid END,
    CASE WHEN l.lt = 'combo' THEN l.cid END,
    CASE
      WHEN l.lt = 'product' THEN p.name
      WHEN l.lt = 'combo' THEN c.name
    END,
    l.q,
    CASE
      WHEN l.lt = 'product' THEN round(p.sale_price::numeric, 0)
      WHEN l.lt = 'combo' THEN round(c.sale_price::numeric, 0)
    END,
    CASE
      WHEN l.lt = 'product' THEN round(p.sale_price::numeric, 0) * l.q
      WHEN l.lt = 'combo' THEN round(c.sale_price::numeric, 0) * l.q
    END,
    0
  FROM (
    SELECT
      e.elem,
      (e.elem->>'line_type') AS lt,
      CASE WHEN e.elem->>'line_type' = 'product' THEN (e.elem->>'product_id')::integer END AS pid,
      CASE WHEN e.elem->>'line_type' = 'combo' THEN (e.elem->>'combo_id')::integer END AS cid,
      (e.elem->>'quantity')::integer AS q
    FROM jsonb_array_elements(lines_json) AS e(elem)
  ) l
  LEFT JOIN public.products p ON l.lt = 'product' AND p.id = l.pid
  LEFT JOIN public.combos c ON l.lt = 'combo' AND c.id = l.cid
  WHERE (l.lt = 'product' AND p.id IS NOT NULL)
     OR (l.lt = 'combo' AND c.id IS NOT NULL);

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
      v_uid
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

  SELECT COALESCE(jsonb_agg(to_jsonb(si.*) ORDER BY si.id), '[]'::jsonb)
  INTO v_lines
  FROM public.sale_items si
  WHERE si.sale_id = v_sale_id;

  RETURN jsonb_build_object(
    'sale', v_sale,
    'lines', v_lines,
    'pricing_policy', 'pos_list_price_no_catalog_discount'
  );
END;
$$;

COMMENT ON FUNCTION public.create_sale_with_items(jsonb) IS
  'Venta atómica DEFINER: auth.uid+can_use_pos; precios lista; payment_breakdown estricto; FOR UPDATE stock.';

REVOKE ALL ON FUNCTION public.create_sale_with_items(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_sale_with_items(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_sale_with_items(jsonb) TO authenticated;

-- ─── delete_sale_and_restore_stock (único camino de borrado; admin DEFINER) ─

CREATE OR REPLACE FUNCTION public.delete_sale_and_restore_stock(p_sale_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_receipt text;
  v_has_sm boolean;
  rec record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF p_sale_id IS NULL THEN
    RAISE EXCEPTION 'invalid_sale_id' USING ERRCODE = '22023';
  END IF;

  -- Serializa borrados concurrentes de la misma venta antes de leer sus líneas
  -- y restaurar stock. Si otra transacción ya la eliminó, no devuelve fila.
  SELECT s.receipt_url
  INTO v_receipt
  FROM public.sales s
  WHERE s.id = p_sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'sale_not_found' USING ERRCODE = 'P0002';
  END IF;

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
REVOKE ALL ON FUNCTION public.delete_sale_and_restore_stock(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_sale_and_restore_stock(integer) TO authenticated;

COMMENT ON FUNCTION public.delete_sale_and_restore_stock(integer) IS
  'Único camino de borrado de venta + restore stock. DEFINER; is_app_admin().';
