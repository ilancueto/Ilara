-- =============================================================================
-- Stage 9.5 — 10% de descuento por transferencia
-- =============================================================================
-- El precio de lista (sale_price) es el que se cobra con Mercado Pago.
-- Transferencia = 10% menos sobre productos, sin tocar el envío.
-- No se usa comisión + redondeo para el precio de la clienta.
-- Pedidos y pagos ya grabados no se reescriben.

ALTER TABLE public.payment_pricing_versions
  ADD COLUMN IF NOT EXISTS transfer_discount_rate numeric(8, 4) NOT NULL DEFAULT 0.10
    CHECK (transfer_discount_rate >= 0 AND transfer_discount_rate < 1);

COMMENT ON COLUMN public.payment_pricing_versions.transfer_discount_rate IS
  'Descuento de transferencia sobre el precio de lista. 0.10 = 10%. No altera sale_price.';

CREATE OR REPLACE FUNCTION public.payment_transfer_price(
  p_list numeric,
  p_discount_rate numeric DEFAULT 0.10
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
BEGIN
  IF p_list < 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '23514';
  END IF;
  IF p_discount_rate < 0 OR p_discount_rate >= 1 THEN
    RAISE EXCEPTION 'invalid_transfer_discount' USING ERRCODE = '23514';
  END IF;
  IF p_list = 0 THEN
    RETURN 0;
  END IF;
  RETURN round(p_list * (1 - p_discount_rate), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.payment_transfer_price(numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.payment_transfer_price(numeric, numeric)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.payment_quote_totals(
  p_payload jsonb,
  p_fee_rate numeric DEFAULT NULL,
  p_increment numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rate numeric := 0.10;
  v_version public.payment_pricing_versions%ROWTYPE;
  v_lines jsonb := '[]'::jsonb;
  v_elem jsonb;
  v_lt text;
  v_qty integer;
  v_unit_list numeric;
  v_unit_transfer numeric;
  v_sub_list numeric := 0;
  v_sub_transfer numeric := 0;
  v_coupon_pct numeric := 0;
  v_coupon_list numeric := 0;
  v_coupon_transfer numeric := 0;
  v_ship numeric := 0;
  v_merch_list numeric;
  v_merch_transfer numeric;
BEGIN
  PERFORM private.payment_pricing_require_admin();
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '23514';
  END IF;
  IF p_payload ? 'total' OR p_payload ? 'subtotal' OR p_payload ? 'unit_price'
     OR p_payload ? 'public_price' OR p_payload ? 'amount_due' THEN
    RAISE EXCEPTION 'client_price_not_allowed' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_version
  FROM public.payment_pricing_versions
  WHERE status = 'active'
  ORDER BY version_number DESC
  LIMIT 1;
  IF FOUND THEN
    v_rate := coalesce(v_version.transfer_discount_rate, 0.10);
  END IF;
  IF p_payload->>'transfer_discount_rate' ~ '^[0-9]+(\.[0-9]+)?$' THEN
    v_rate := (p_payload->>'transfer_discount_rate')::numeric;
  END IF;
  IF v_rate < 0 OR v_rate >= 1 THEN
    RAISE EXCEPTION 'invalid_transfer_discount' USING ERRCODE = '23514';
  END IF;

  IF jsonb_typeof(p_payload->'lines') <> 'array' OR jsonb_array_length(p_payload->'lines') = 0 THEN
    RAISE EXCEPTION 'empty_lines' USING ERRCODE = '23514';
  END IF;

  FOR v_elem IN SELECT value FROM jsonb_array_elements(p_payload->'lines')
  LOOP
    v_lt := coalesce(nullif(trim(v_elem->>'line_type'), ''), '');
    IF v_elem->>'quantity' ~ '^[0-9]+$' THEN
      v_qty := (v_elem->>'quantity')::integer;
    ELSE
      v_qty := NULL;
    END IF;
    IF v_qty IS NULL OR v_qty <= 0 OR v_qty > 99 THEN
      RAISE EXCEPTION 'invalid_quantity' USING ERRCODE = '23514';
    END IF;

    IF v_lt = 'product' THEN
      SELECT round(
        p.sale_price::numeric * (1 - coalesce(p.discount_percentage, 0)::numeric / 100.0),
        0
      )
      INTO v_unit_list
      FROM public.products p
      WHERE p.id = CASE WHEN v_elem->>'product_id' ~ '^[0-9]+$' THEN (v_elem->>'product_id')::integer END
        AND coalesce(p.visible_in_catalog, true) IS TRUE;
      IF v_unit_list IS NULL THEN
        RAISE EXCEPTION 'product_not_available' USING ERRCODE = '23514';
      END IF;
    ELSIF v_lt = 'combo' THEN
      SELECT round(c.sale_price::numeric, 0)
      INTO v_unit_list
      FROM public.combos c
      WHERE c.id = CASE WHEN v_elem->>'combo_id' ~ '^[0-9]+$' THEN (v_elem->>'combo_id')::integer END
        AND c.is_active IS TRUE;
      IF v_unit_list IS NULL THEN
        RAISE EXCEPTION 'combo_not_available' USING ERRCODE = '23514';
      END IF;
    ELSE
      RAISE EXCEPTION 'invalid_line_type' USING ERRCODE = '23514';
    END IF;

    v_unit_transfer := public.payment_transfer_price(v_unit_list, v_rate);
    v_sub_list := v_sub_list + (v_unit_list * v_qty);
    v_sub_transfer := v_sub_transfer + (v_unit_transfer * v_qty);
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'line_type', v_lt,
      'quantity', v_qty,
      'unit_base', v_unit_transfer,
      'unit_public', v_unit_list,
      'base', v_unit_transfer * v_qty,
      'public', v_unit_list * v_qty
    ));
  END LOOP;

  IF p_payload->>'coupon_percent' ~ '^[0-9]+(\.[0-9]+)?$' THEN
    v_coupon_pct := (p_payload->>'coupon_percent')::numeric;
  END IF;
  IF v_coupon_pct < 0 OR v_coupon_pct > 100 THEN
    RAISE EXCEPTION 'invalid_coupon' USING ERRCODE = '23514';
  END IF;
  IF v_coupon_pct > 0 THEN
    v_coupon_list := round(v_sub_list * v_coupon_pct / 100.0, 0);
  END IF;

  IF p_payload->>'shipping_base' IS NOT NULL THEN
    IF p_payload->>'shipping_base' !~ '^[0-9]+(\.[0-9]+)?$' THEN
      RAISE EXCEPTION 'invalid_shipping' USING ERRCODE = '23514';
    END IF;
    v_ship := (p_payload->>'shipping_base')::numeric;
    IF v_ship < 0 THEN
      RAISE EXCEPTION 'invalid_shipping' USING ERRCODE = '23514';
    END IF;
  END IF;

  -- 10% sobre mercadería después del cupón. El envío no se descuenta.
  v_merch_list := greatest(v_sub_list - v_coupon_list, 0);
  v_merch_transfer := public.payment_transfer_price(v_merch_list, v_rate);
  v_coupon_transfer := public.payment_transfer_price(v_sub_list, v_rate) - v_merch_transfer;

  RETURN jsonb_build_object(
    'transfer_discount_rate', v_rate,
    'effective_fee_rate', coalesce(v_version.effective_fee_rate, 0),
    'rounding_increment', coalesce(v_version.rounding_increment, 100),
    'lines', v_lines,
    'subtotal_base', v_sub_transfer,
    'subtotal_public', v_sub_list,
    'coupon_base', v_coupon_transfer,
    'coupon_public', v_coupon_list,
    'shipping_base', v_ship,
    'shipping_public', v_ship,
    'total_base', v_merch_transfer + v_ship,
    'total_public', v_merch_list + v_ship,
    'transfer_saving', (v_merch_list + v_ship) - (v_merch_transfer + v_ship)
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.quote_order_payment_amounts(p_order public.orders)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_ver public.payment_pricing_versions%ROWTYPE;
  v_list numeric := 0;
  v_rate numeric := 0.10;
  v_merch numeric;
  v_public numeric;
  v_base numeric;
  rec record;
BEGIN
  SELECT * INTO v_ver
  FROM public.payment_pricing_versions
  WHERE status = 'active'
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pricing_version_missing' USING ERRCODE = 'P0002';
  END IF;
  v_rate := coalesce(v_ver.transfer_discount_rate, 0.10);

  FOR rec IN
    SELECT oi.quantity, oi.unit_price
    FROM public.order_items oi
    WHERE oi.order_id = p_order.id
  LOOP
    v_list := v_list + rec.unit_price * rec.quantity;
  END LOOP;

  IF coalesce(p_order.coupon_discount_percentage, 0) > 0 THEN
    v_list := v_list - round(v_list * p_order.coupon_discount_percentage::numeric / 100.0, 0);
  END IF;
  v_merch := greatest(v_list, 0);
  v_public := v_merch + coalesce(p_order.shipping_amount, 0);
  v_base := public.payment_transfer_price(v_merch, v_rate) + coalesce(p_order.shipping_amount, 0);

  RETURN jsonb_build_object(
    'version_id', v_ver.id,
    'effective_fee_rate', v_ver.effective_fee_rate,
    'transfer_discount_rate', v_rate,
    'base_amount', v_base,
    'public_amount', v_public,
    'price_uplift', v_public - v_base,
    'transfer_saving', v_public - v_base,
    'mp_minutes', v_ver.mp_reservation_minutes,
    'transfer_hours', v_ver.transfer_reservation_hours,
    'payments_enabled', v_ver.payments_enabled,
    'mercado_pago_enabled', v_ver.mercado_pago_enabled,
    'bank_transfer_enabled', v_ver.bank_transfer_enabled,
    'receipt_required', v_ver.receipt_required,
    'bank_cbu', v_ver.bank_cbu,
    'bank_alias', v_ver.bank_alias,
    'bank_name', v_ver.bank_name,
    'bank_account_holder', v_ver.bank_account_holder,
    'bank_cuit', v_ver.bank_cuit,
    'bank_instructions', v_ver.bank_instructions
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.payment_public_pricing_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.payment_pricing_versions%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.payment_pricing_versions
  WHERE status = 'active'
  ORDER BY version_number DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('catalog_dual_price_visible', false);
  END IF;

  RETURN jsonb_build_object(
    'catalog_dual_price_visible', v_row.catalog_dual_price_visible IS TRUE,
    'mercado_pago_enabled', v_row.mercado_pago_enabled IS TRUE,
    'bank_transfer_enabled', v_row.bank_transfer_enabled IS TRUE,
    'version_id', v_row.id,
    'transfer_discount_rate', coalesce(v_row.transfer_discount_rate, 0.10),
    'effective_fee_rate', 0,
    'rounding_increment', 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.payment_admin_preview_pricing(p_version_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ver public.payment_pricing_versions%ROWTYPE;
  v_products integer := 0;
  v_combos integer := 0;
  v_rate numeric := 0.10;
BEGIN
  PERFORM private.payment_pricing_require_admin();
  IF p_version_id IS NOT NULL THEN
    SELECT * INTO v_ver FROM public.payment_pricing_versions WHERE id = p_version_id;
  ELSE
    SELECT * INTO v_ver
    FROM public.payment_pricing_versions
    WHERE status IN ('active', 'draft')
    ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, version_number DESC
    LIMIT 1;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pricing_version_missing' USING ERRCODE = 'P0002';
  END IF;
  v_rate := coalesce(v_ver.transfer_discount_rate, 0.10);

  SELECT count(*)::integer INTO v_products
  FROM public.products p
  WHERE coalesce(p.visible_in_catalog, true) IS TRUE
    AND p.sale_price IS NOT NULL
    AND p.sale_price::numeric > 0;

  SELECT count(*)::integer INTO v_combos
  FROM public.combos c
  WHERE c.is_active IS TRUE
    AND c.sale_price IS NOT NULL
    AND c.sale_price::numeric > 0;

  RETURN jsonb_build_object(
    'version', to_jsonb(v_ver),
    'affected_products', v_products,
    'affected_combos', v_combos,
    'samples', coalesce((
      SELECT jsonb_agg(to_jsonb(q) || jsonb_build_object('saving', q.public_price - q.transfer_price))
      FROM (
        SELECT *
        FROM (
          SELECT
            'product'::text AS kind,
            p.id,
            p.name,
            p.sale_price::numeric AS sale_price,
            coalesce(p.discount_percentage, 0)::numeric AS discount_percentage,
            public.payment_transfer_price(
              round(p.sale_price::numeric * (1 - coalesce(p.discount_percentage, 0)::numeric / 100.0), 0),
              v_rate
            ) AS transfer_price,
            round(p.sale_price::numeric * (1 - coalesce(p.discount_percentage, 0)::numeric / 100.0), 0) AS public_price
          FROM public.products p
          WHERE coalesce(p.visible_in_catalog, true) IS TRUE
            AND p.sale_price IS NOT NULL
            AND p.sale_price::numeric > 0
          ORDER BY p.name
          LIMIT 8
        ) products
        UNION ALL
        SELECT *
        FROM (
          SELECT
            'combo'::text AS kind,
            c.id,
            c.name,
            c.sale_price::numeric AS sale_price,
            0::numeric AS discount_percentage,
            public.payment_transfer_price(round(c.sale_price::numeric, 0), v_rate) AS transfer_price,
            round(c.sale_price::numeric, 0) AS public_price
          FROM public.combos c
          WHERE c.is_active IS TRUE
            AND c.sale_price IS NOT NULL
            AND c.sale_price::numeric > 0
          ORDER BY c.name
          LIMIT 4
        ) combos
      ) q
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.payment_admin_save_draft(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_next integer;
  v_row public.payment_pricing_versions%ROWTYPE;
BEGIN
  v_uid := private.payment_pricing_require_admin();
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '23514';
  END IF;

  SELECT coalesce(max(version_number), 0) + 1
  INTO v_next
  FROM public.payment_pricing_versions;

  INSERT INTO public.payment_pricing_versions (
    version_number,
    status,
    effective_fee_rate,
    rounding_increment,
    transfer_discount_rate,
    listed_fee_rate,
    iva_rate,
    mp_reservation_minutes,
    transfer_reservation_hours,
    payments_enabled,
    mercado_pago_enabled,
    bank_transfer_enabled,
    catalog_dual_price_visible,
    bank_cbu,
    bank_alias,
    bank_name,
    bank_account_holder,
    bank_cuit,
    bank_instructions,
    receipt_required,
    notes,
    created_by
  ) VALUES (
    v_next,
    'draft',
    coalesce((p_payload->>'effective_fee_rate')::numeric, 0),
    coalesce((p_payload->>'rounding_increment')::numeric, 1),
    coalesce((p_payload->>'transfer_discount_rate')::numeric, 0.10),
    nullif(p_payload->>'listed_fee_rate', '')::numeric,
    nullif(p_payload->>'iva_rate', '')::numeric,
    coalesce((p_payload->>'mp_reservation_minutes')::integer, 30),
    coalesce((p_payload->>'transfer_reservation_hours')::integer, 24),
    coalesce((p_payload->>'payments_enabled')::boolean, false),
    coalesce((p_payload->>'mercado_pago_enabled')::boolean, false),
    coalesce((p_payload->>'bank_transfer_enabled')::boolean, false),
    coalesce((p_payload->>'catalog_dual_price_visible')::boolean, false),
    nullif(trim(p_payload->>'bank_cbu'), ''),
    nullif(trim(p_payload->>'bank_alias'), ''),
    nullif(trim(p_payload->>'bank_name'), ''),
    nullif(trim(p_payload->>'bank_account_holder'), ''),
    nullif(trim(p_payload->>'bank_cuit'), ''),
    nullif(trim(p_payload->>'bank_instructions'), ''),
    coalesce((p_payload->>'receipt_required')::boolean, true),
    nullif(trim(p_payload->>'notes'), ''),
    v_uid
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;
