-- P1/P2 follow-up: created_by siempre auth.uid() (idempotente si 030 ya estaba alineado).
-- Gráfico del tablero en período Total: serie mensual (últimos 36 meses en la app).

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
  v_total numeric := 0;
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

  -- Cantidades enteras > 0 (evita stock negativo por qty maliciosa)
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
      AND (elem->>'product_id') IS NULL
  ) THEN
    RAISE EXCEPTION 'invalid_product_line' USING ERRCODE = '23514';
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
        WHEN l.lt = 'product' THEN
          round((p.sale_price * (1 - coalesce(p.discount_percentage, 0) / 100.0))::numeric, 0) * l.q
        WHEN l.lt = 'combo' THEN
          round(c.sale_price::numeric, 0) * l.q
      END AS line_sub
    FROM lines l
    LEFT JOIN public.products p ON l.lt = 'product' AND p.id = l.pid
    LEFT JOIN public.combos c ON l.lt = 'combo' AND c.id = l.cid
    WHERE (l.lt = 'product' AND p.id IS NOT NULL)
       OR (l.lt = 'combo' AND c.id IS NOT NULL)
  ) x;

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
    nullif(trim(sale_rec->>'payment_method'), ''),
    nullif(trim(sale_rec->>'customer_name'), ''),
    CASE
      WHEN sale_rec->'customer_id' IS NULL OR jsonb_typeof(sale_rec->'customer_id') = 'null' THEN NULL
      ELSE (sale_rec->'customer_id')::text::integer
    END,
    nullif(trim(sale_rec->>'notes'), ''),
    coalesce(nullif(trim(sale_rec->>'status'), ''), 'completed'),
    auth.uid(),
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
    CASE WHEN l.lt = 'product' THEN l.pid END,
    CASE WHEN l.lt = 'combo' THEN l.cid END,
    CASE
      WHEN l.lt = 'product' THEN coalesce(nullif(trim(l.elem->>'product_name'), ''), p.name)
      WHEN l.lt = 'combo' THEN coalesce(nullif(trim(l.elem->>'product_name'), ''), c.name)
    END,
    l.q,
    CASE
      WHEN l.lt = 'product' THEN round((p.sale_price * (1 - coalesce(p.discount_percentage, 0) / 100.0))::numeric, 0)
      WHEN l.lt = 'combo' THEN round(c.sale_price::numeric, 0)
    END,
    CASE
      WHEN l.lt = 'product' THEN round((p.sale_price * (1 - coalesce(p.discount_percentage, 0) / 100.0))::numeric, 0) * l.q
      WHEN l.lt = 'combo' THEN round(c.sale_price::numeric, 0) * l.q
    END,
    CASE WHEN l.lt = 'product' THEN coalesce(p.discount_percentage, 0) ELSE 0 END
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

COMMENT ON FUNCTION public.create_sale_with_items(jsonb) IS
  'Crea venta atómica: quantity>0, precios desde products/combos, total en DB, created_by=auth.uid() (no cliente).';

-- ─── Tablero: ventas por mes (período Total en UI) ─────────────────────────
CREATE OR REPLACE FUNCTION public.dashboard_sales_monthly(p_months integer DEFAULT 24)
RETURNS TABLE(month_start date, total numeric, sale_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $monthly$
DECLARE
  n int := GREATEST(1, LEAST(COALESCE(NULLIF(p_months, 0), 24), 120));
  end_m date;
  i int;
  ms date;
  t numeric;
  c bigint;
BEGIN
  end_m := date_trunc('month', (now() AT TIME ZONE 'America/Argentina/Buenos_Aires'))::date;
  FOR i IN 0..(n - 1) LOOP
    ms := (end_m + ((i - n + 1) || ' months')::interval)::date;
    SELECT COALESCE(SUM(s.total), 0)::numeric, COUNT(*)::bigint
    INTO t, c
    FROM public.sales s
    WHERE COALESCE(s.status, 'completed') <> 'pending_payment'
      AND date_trunc('month', s.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = ms;
    month_start := ms;
    total := t;
    sale_count := c;
    RETURN NEXT;
  END LOOP;
  RETURN;
END;
$monthly$;

REVOKE ALL ON FUNCTION public.dashboard_sales_monthly(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_sales_monthly(integer) TO authenticated;

COMMENT ON FUNCTION public.dashboard_sales_monthly(integer) IS
  'Totales de ventas cobradas por mes calendario (TZ Buenos Aires); alinear con KPI período Total.';

-- Gráfico "Total": misma historia que los KPI (ventas cobradas), agregada por mes desde la primera venta (tope 120 meses).
CREATE OR REPLACE FUNCTION public.dashboard_sales_monthly_total_span()
RETURNS TABLE(month_start date, total numeric, sale_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $mspan$
DECLARE
  end_m date;
  start_m date;
  series_start date;
  ms date;
  t numeric;
  c bigint;
  i int := 0;
BEGIN
  end_m := date_trunc('month', (now() AT TIME ZONE 'America/Argentina/Buenos_Aires'))::date;

  SELECT MIN(date_trunc('month', s.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date)
  INTO start_m
  FROM public.sales s
  WHERE COALESCE(s.status, 'completed') <> 'pending_payment';

  IF start_m IS NULL THEN
    start_m := end_m;
  END IF;

  IF start_m > end_m THEN
    start_m := end_m;
  END IF;

  series_start := date_trunc(
    'month',
    GREATEST(start_m::timestamp, (end_m::timestamp - interval '119 months'))
  )::date;

  LOOP
    ms := (series_start + (i || ' months')::interval)::date;
    EXIT WHEN ms > end_m;
    EXIT WHEN i > 200;
    SELECT COALESCE(SUM(s.total), 0)::numeric, COUNT(*)::bigint
    INTO t, c
    FROM public.sales s
    WHERE COALESCE(s.status, 'completed') <> 'pending_payment'
      AND date_trunc('month', s.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = ms;
    month_start := ms;
    total := t;
    sale_count := c;
    RETURN NEXT;
    i := i + 1;
  END LOOP;
  RETURN;
END;
$mspan$;

REVOKE ALL ON FUNCTION public.dashboard_sales_monthly_total_span() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_sales_monthly_total_span() TO authenticated;

COMMENT ON FUNCTION public.dashboard_sales_monthly_total_span() IS
  'Serie mensual de ventas cobradas desde la primera venta hasta hoy (máx. 120 meses); usar con período Total del tablero.';
