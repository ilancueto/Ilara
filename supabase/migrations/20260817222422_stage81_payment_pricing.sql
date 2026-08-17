-- =============================================================================
-- Stage 8.1 — Precios públicos versionados (feature apagada)
-- =============================================================================
-- Forward-only. No muta products.sale_price.
-- Flags de catálogo/cobro nacen en false. Activación atómica = Stage 8.6.

CREATE TABLE IF NOT EXISTS public.payment_pricing_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number integer NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'active', 'superseded')),
  effective_fee_rate numeric(12, 8) NOT NULL
    CHECK (effective_fee_rate >= 0 AND effective_fee_rate < 1),
  rounding_increment numeric(12, 2) NOT NULL CHECK (rounding_increment > 0),
  listed_fee_rate numeric(12, 8)
    CHECK (listed_fee_rate IS NULL OR (listed_fee_rate >= 0 AND listed_fee_rate < 1)),
  iva_rate numeric(12, 8)
    CHECK (iva_rate IS NULL OR (iva_rate >= 0 AND iva_rate < 1)),
  mp_reservation_minutes integer NOT NULL DEFAULT 30
    CHECK (mp_reservation_minutes BETWEEN 5 AND 1440),
  transfer_reservation_hours integer NOT NULL DEFAULT 24
    CHECK (transfer_reservation_hours BETWEEN 1 AND 168),
  payments_enabled boolean NOT NULL DEFAULT false,
  mercado_pago_enabled boolean NOT NULL DEFAULT false,
  bank_transfer_enabled boolean NOT NULL DEFAULT false,
  catalog_dual_price_visible boolean NOT NULL DEFAULT false,
  bank_cbu text CHECK (bank_cbu IS NULL OR char_length(bank_cbu) BETWEEN 6 AND 32),
  bank_alias text CHECK (bank_alias IS NULL OR char_length(bank_alias) BETWEEN 3 AND 40),
  bank_name text CHECK (bank_name IS NULL OR char_length(bank_name) BETWEEN 2 AND 80),
  bank_account_holder text
    CHECK (bank_account_holder IS NULL OR char_length(bank_account_holder) BETWEEN 2 AND 80),
  bank_cuit text CHECK (bank_cuit IS NULL OR char_length(bank_cuit) BETWEEN 8 AND 20),
  bank_instructions text
    CHECK (bank_instructions IS NULL OR char_length(bank_instructions) <= 500),
  receipt_required boolean NOT NULL DEFAULT true,
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  activated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  activated_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_pricing_versions_number_key UNIQUE (version_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_pricing_versions_one_active
  ON public.payment_pricing_versions (status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS payment_pricing_versions_created_idx
  ON public.payment_pricing_versions (created_at DESC);

COMMENT ON TABLE public.payment_pricing_versions IS
  'Stage 8.1: versiones de precio público. sale_price permanece como base/transferencia.';

ALTER TABLE public.payment_pricing_versions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.payment_pricing_versions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_pricing_versions TO service_role;

INSERT INTO public.payment_pricing_versions (
  version_number,
  status,
  effective_fee_rate,
  rounding_increment,
  listed_fee_rate,
  iva_rate,
  payments_enabled,
  mercado_pago_enabled,
  bank_transfer_enabled,
  catalog_dual_price_visible,
  notes
)
SELECT
  1,
  'active',
  0.053119,
  100,
  0.0439,
  0.21,
  false,
  false,
  false,
  false,
  'Versión inicial Stage 8.1. Flags apagados.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_pricing_versions
);

-- ─── Motor autoritativo ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.payment_public_price(
  p_base numeric,
  p_fee_rate numeric DEFAULT 0.053119,
  p_increment numeric DEFAULT 100
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
DECLARE
  v_raw numeric;
BEGIN
  IF p_base < 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '23514';
  END IF;
  IF p_fee_rate < 0 OR p_fee_rate >= 1 THEN
    RAISE EXCEPTION 'invalid_fee_rate' USING ERRCODE = '23514';
  END IF;
  IF p_increment <= 0 THEN
    RAISE EXCEPTION 'invalid_rounding_increment' USING ERRCODE = '23514';
  END IF;
  IF p_base = 0 THEN
    RETURN 0;
  END IF;

  v_raw := p_base / (1 - p_fee_rate);
  RETURN ceil(v_raw / p_increment) * p_increment;
END;
$$;

COMMENT ON FUNCTION public.payment_public_price(numeric, numeric, numeric) IS
  'Stage 8.1: precio público = techo de base/(1-tasa) al múltiplo configurado.';

REVOKE ALL ON FUNCTION public.payment_public_price(numeric, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.payment_public_price(numeric, numeric, numeric)
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
  v_fee numeric;
  v_inc numeric;
  v_version public.payment_pricing_versions%ROWTYPE;
  v_lines jsonb := '[]'::jsonb;
  v_elem jsonb;
  v_lt text;
  v_qty integer;
  v_unit_base numeric;
  v_unit_public numeric;
  v_sub_base numeric := 0;
  v_sub_public numeric := 0;
  v_coupon_pct numeric := 0;
  v_coupon_base numeric := 0;
  v_coupon_public numeric := 0;
  v_ship_base numeric := 0;
  v_ship_public numeric := 0;
BEGIN
  PERFORM private.payment_pricing_require_admin();
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '23514';
  END IF;
  IF p_payload ? 'total' OR p_payload ? 'subtotal' OR p_payload ? 'unit_price'
     OR p_payload ? 'public_price' OR p_payload ? 'amount_due' THEN
    RAISE EXCEPTION 'client_price_not_allowed' USING ERRCODE = '23514';
  END IF;

  IF p_fee_rate IS NULL OR p_increment IS NULL THEN
    SELECT * INTO v_version
    FROM public.payment_pricing_versions
    WHERE status = 'active'
    ORDER BY version_number DESC
    LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'pricing_version_missing' USING ERRCODE = 'P0002';
    END IF;
    v_fee := coalesce(p_fee_rate, v_version.effective_fee_rate);
    v_inc := coalesce(p_increment, v_version.rounding_increment);
  ELSE
    v_fee := p_fee_rate;
    v_inc := p_increment;
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
      INTO v_unit_base
      FROM public.products p
      WHERE p.id = CASE WHEN v_elem->>'product_id' ~ '^[0-9]+$' THEN (v_elem->>'product_id')::integer END
        AND coalesce(p.visible_in_catalog, true) IS TRUE;
      IF v_unit_base IS NULL THEN
        RAISE EXCEPTION 'product_not_available' USING ERRCODE = '23514';
      END IF;
    ELSIF v_lt = 'combo' THEN
      SELECT round(c.sale_price::numeric, 0)
      INTO v_unit_base
      FROM public.combos c
      WHERE c.id = CASE WHEN v_elem->>'combo_id' ~ '^[0-9]+$' THEN (v_elem->>'combo_id')::integer END
        AND c.is_active IS TRUE;
      IF v_unit_base IS NULL THEN
        RAISE EXCEPTION 'combo_not_available' USING ERRCODE = '23514';
      END IF;
    ELSE
      RAISE EXCEPTION 'invalid_line_type' USING ERRCODE = '23514';
    END IF;

    v_unit_public := public.payment_public_price(v_unit_base, v_fee, v_inc);
    v_sub_base := v_sub_base + (v_unit_base * v_qty);
    v_sub_public := v_sub_public + (v_unit_public * v_qty);
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'line_type', v_lt,
      'quantity', v_qty,
      'unit_base', v_unit_base,
      'unit_public', v_unit_public,
      'base', v_unit_base * v_qty,
      'public', v_unit_public * v_qty
    ));
  END LOOP;

  IF p_payload->>'coupon_percent' ~ '^[0-9]+(\.[0-9]+)?$' THEN
    v_coupon_pct := (p_payload->>'coupon_percent')::numeric;
  END IF;
  IF v_coupon_pct < 0 OR v_coupon_pct > 100 THEN
    RAISE EXCEPTION 'invalid_coupon' USING ERRCODE = '23514';
  END IF;
  IF v_coupon_pct > 0 THEN
    v_coupon_base := round(v_sub_base * v_coupon_pct / 100.0, 0);
    v_coupon_public := round(v_sub_public * v_coupon_pct / 100.0, 0);
  END IF;

  IF p_payload->>'shipping_base' IS NOT NULL THEN
    IF p_payload->>'shipping_base' !~ '^[0-9]+(\.[0-9]+)?$' THEN
      RAISE EXCEPTION 'invalid_shipping' USING ERRCODE = '23514';
    END IF;
    v_ship_base := (p_payload->>'shipping_base')::numeric;
    IF v_ship_base < 0 THEN
      RAISE EXCEPTION 'invalid_shipping' USING ERRCODE = '23514';
    END IF;
    IF v_ship_base > 0 THEN
      v_ship_public := public.payment_public_price(v_ship_base, v_fee, v_inc);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'effective_fee_rate', v_fee,
    'rounding_increment', v_inc,
    'lines', v_lines,
    'subtotal_base', v_sub_base,
    'subtotal_public', v_sub_public,
    'coupon_base', v_coupon_base,
    'coupon_public', v_coupon_public,
    'shipping_base', v_ship_base,
    'shipping_public', v_ship_public,
    'total_base', greatest(v_sub_base - v_coupon_base, 0) + v_ship_base,
    'total_public', greatest(v_sub_public - v_coupon_public, 0) + v_ship_public,
    'transfer_saving',
      (greatest(v_sub_public - v_coupon_public, 0) + v_ship_public)
      - (greatest(v_sub_base - v_coupon_base, 0) + v_ship_base)
  );
END;
$$;

COMMENT ON FUNCTION public.payment_quote_totals(jsonb, numeric, numeric) IS
  'Stage 8.1: cotiza base/público. Rechaza importes del cliente.';

REVOKE ALL ON FUNCTION public.payment_quote_totals(jsonb, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payment_quote_totals(jsonb, numeric, numeric)
  TO authenticated, service_role;

-- ─── Contexto público (sin jerga; vacío si el flag está apagado) ─────────────
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

  IF NOT FOUND OR v_row.catalog_dual_price_visible IS NOT TRUE THEN
    RETURN jsonb_build_object('catalog_dual_price_visible', false);
  END IF;

  RETURN jsonb_build_object(
    'catalog_dual_price_visible', true,
    'version_id', v_row.id,
    'effective_fee_rate', v_row.effective_fee_rate,
    'rounding_increment', v_row.rounding_increment
  );
END;
$$;

COMMENT ON FUNCTION public.payment_public_pricing_context() IS
  'Stage 8.1: contexto de dual price. Sin datos bancarios ni flags internos extra.';

REVOKE ALL ON FUNCTION public.payment_public_pricing_context() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.payment_public_pricing_context() TO anon, authenticated, service_role;

-- ─── Admin ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.payment_pricing_require_admin()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  RETURN v_uid;
END;
$$;

REVOKE ALL ON FUNCTION private.payment_pricing_require_admin() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.payment_admin_list_versions()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.payment_pricing_require_admin();
  RETURN coalesce((
    SELECT jsonb_agg(to_jsonb(v) ORDER BY v.version_number DESC)
    FROM public.payment_pricing_versions v
  ), '[]'::jsonb);
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
  v_uid uuid;
  v_ver public.payment_pricing_versions%ROWTYPE;
  v_products integer;
  v_combos integer;
BEGIN
  v_uid := private.payment_pricing_require_admin();

  IF p_version_id IS NULL THEN
    SELECT * INTO v_ver FROM public.payment_pricing_versions WHERE status = 'active' LIMIT 1;
  ELSE
    SELECT * INTO v_ver FROM public.payment_pricing_versions WHERE id = p_version_id;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pricing_version_missing' USING ERRCODE = 'P0002';
  END IF;

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
            round(p.sale_price::numeric * (1 - coalesce(p.discount_percentage, 0)::numeric / 100.0), 0) AS transfer_price,
            public.payment_public_price(
              round(p.sale_price::numeric * (1 - coalesce(p.discount_percentage, 0)::numeric / 100.0), 0),
              v_ver.effective_fee_rate,
              v_ver.rounding_increment
            ) AS public_price
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
            round(c.sale_price::numeric, 0) AS transfer_price,
            public.payment_public_price(
              round(c.sale_price::numeric, 0),
              v_ver.effective_fee_rate,
              v_ver.rounding_increment
            ) AS public_price
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
    coalesce((p_payload->>'effective_fee_rate')::numeric, 0.053119),
    coalesce((p_payload->>'rounding_increment')::numeric, 100),
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

CREATE OR REPLACE FUNCTION public.payment_admin_activate_version(p_version_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_row public.payment_pricing_versions%ROWTYPE;
BEGIN
  v_uid := private.payment_pricing_require_admin();
  IF p_version_id IS NULL THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_row
  FROM public.payment_pricing_versions
  WHERE id = p_version_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pricing_version_missing' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.payment_pricing_versions
  SET
    status = 'superseded',
    superseded_at = coalesce(superseded_at, now()),
    updated_at = now()
  WHERE status = 'active'
    AND id <> p_version_id;

  UPDATE public.payment_pricing_versions
  SET
    status = 'active',
    activated_by = v_uid,
    activated_at = now(),
    superseded_at = NULL,
    updated_at = now()
  WHERE id = p_version_id
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'payment_admin_list_versions()',
    'payment_admin_preview_pricing(uuid)',
    'payment_admin_save_draft(jsonb)',
    'payment_admin_activate_version(uuid)'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', fn);
  END LOOP;
END $$;
