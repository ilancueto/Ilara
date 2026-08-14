-- =============================================================================
-- Stage 7 — Cotizaciones de envío Envia.com
-- =============================================================================
-- La Edge Function escribe cotizaciones con service_role. anon/authenticated no
-- pueden leerlas ni modificarlas. El RPC público consume una cotización vigente
-- y suma su snapshot al pedido dentro de la misma transacción.

CREATE TABLE public.shipping_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_group_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'envia'
    CHECK (provider = 'envia'),
  destination_postal_code text NOT NULL
    CHECK (destination_postal_code ~ '^[0-9]{4}$'),
  destination_city text NOT NULL CHECK (char_length(destination_city) BETWEEN 1 AND 100),
  destination_state text NOT NULL CHECK (char_length(destination_state) BETWEEN 1 AND 40),
  carrier text NOT NULL CHECK (char_length(carrier) BETWEEN 1 AND 80),
  carrier_description text NOT NULL CHECK (char_length(carrier_description) BETWEEN 1 AND 120),
  service text NOT NULL CHECK (char_length(service) BETWEEN 1 AND 100),
  service_description text NOT NULL CHECK (char_length(service_description) BETWEEN 1 AND 160),
  delivery_estimate text CHECK (delivery_estimate IS NULL OR char_length(delivery_estimate) <= 120),
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL CHECK (currency = 'ARS'),
  request_ip_hash text NOT NULL CHECK (char_length(request_ip_hash) = 64),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  order_id uuid UNIQUE,
  CONSTRAINT shipping_quotes_expiry CHECK (expires_at > created_at),
  CONSTRAINT shipping_quotes_consumption CHECK (
    (consumed_at IS NULL AND order_id IS NULL)
    OR (consumed_at IS NOT NULL AND order_id IS NOT NULL)
  )
);

CREATE TABLE public.shipping_quote_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_ip_hash text NOT NULL CHECK (char_length(request_ip_hash) = 64),
  destination_postal_code text NOT NULL
    CHECK (destination_postal_code ~ '^[0-9]{4}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shipping_quote_requests_ip_created_idx
  ON public.shipping_quote_requests (request_ip_hash, created_at DESC);

CREATE INDEX shipping_quotes_group_idx
  ON public.shipping_quotes (quote_group_id, amount);
CREATE INDEX shipping_quotes_ip_created_idx
  ON public.shipping_quotes (request_ip_hash, created_at DESC);
CREATE INDEX shipping_quotes_expiry_idx
  ON public.shipping_quotes (expires_at)
  WHERE consumed_at IS NULL;

ALTER TABLE public.shipping_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_quote_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shipping_quotes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.shipping_quote_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.shipping_quotes TO service_role;
GRANT ALL ON TABLE public.shipping_quote_requests TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.shipping_quote_requests_id_seq TO service_role;

ALTER TABLE public.orders
  ADD COLUMN shipping_quote_id uuid,
  ADD COLUMN shipping_provider text,
  ADD COLUMN shipping_carrier text,
  ADD COLUMN shipping_carrier_description text,
  ADD COLUMN shipping_service text,
  ADD COLUMN shipping_service_description text,
  ADD COLUMN shipping_delivery_estimate text,
  ADD COLUMN shipping_amount numeric(12, 2) NOT NULL DEFAULT 0 CHECK (shipping_amount >= 0),
  ADD COLUMN shipping_currency text,
  ADD COLUMN shipping_destination_postal_code text,
  ADD COLUMN shipping_destination_city text,
  ADD COLUMN shipping_destination_state text;

ALTER TABLE public.orders
  DROP CONSTRAINT orders_total_consistency,
  ADD CONSTRAINT orders_total_consistency
    CHECK (total = subtotal - discount_total + shipping_amount),
  ADD CONSTRAINT orders_shipping_quote_key UNIQUE (shipping_quote_id),
  ADD CONSTRAINT orders_shipping_quote_fkey
    FOREIGN KEY (shipping_quote_id) REFERENCES public.shipping_quotes(id) ON DELETE RESTRICT,
  ADD CONSTRAINT orders_shipping_complete CHECK (
    (shipping_quote_id IS NULL AND shipping_amount = 0 AND shipping_provider IS NULL)
    OR (
      shipping_quote_id IS NOT NULL
      AND shipping_provider = 'envia'
      AND shipping_carrier IS NOT NULL
      AND shipping_carrier_description IS NOT NULL
      AND shipping_service IS NOT NULL
      AND shipping_service_description IS NOT NULL
      AND shipping_amount > 0
      AND shipping_currency = 'ARS'
      AND shipping_destination_postal_code ~ '^[0-9]{4}$'
      AND shipping_destination_city IS NOT NULL
      AND shipping_destination_state IS NOT NULL
    )
  );

ALTER TABLE public.shipping_quotes
  ADD CONSTRAINT shipping_quotes_order_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;

-- Conservar el núcleo Stage 6.1 sin acceso directo y envolverlo con consumo de quote.
ALTER FUNCTION public.create_catalog_order(jsonb)
  RENAME TO create_catalog_order_core_stage61;
REVOKE ALL ON FUNCTION public.create_catalog_order_core_stage61(jsonb)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_catalog_order(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_quote_id uuid;
  v_quote public.shipping_quotes%ROWTYPE;
  v_result jsonb;
  v_order public.orders%ROWTYPE;
  v_order_id uuid;
  v_is_replay boolean;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '23514';
  END IF;

  BEGIN
    v_quote_id := nullif(trim(coalesce(p_payload->>'shipping_quote_id', '')), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'invalid_shipping_quote' USING ERRCODE = '23514';
  END;
  IF v_quote_id IS NULL THEN
    RAISE EXCEPTION 'shipping_quote_required' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_quote
  FROM public.shipping_quotes q
  WHERE q.id = v_quote_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_shipping_quote' USING ERRCODE = '23514';
  END IF;

  v_result := public.create_catalog_order_core_stage61(p_payload - 'shipping_quote_id');
  v_order_id := (v_result->>'order_id')::uuid;
  v_is_replay := coalesce((v_result->>'idempotent_replay')::boolean, false);

  SELECT * INTO v_order
  FROM public.orders o
  WHERE o.id = v_order_id
  FOR UPDATE;

  IF v_is_replay THEN
    IF v_order.shipping_quote_id IS DISTINCT FROM v_quote_id THEN
      RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF v_quote.consumed_at IS NOT NULL OR v_quote.order_id IS NOT NULL THEN
      RAISE EXCEPTION 'shipping_quote_consumed' USING ERRCODE = '23514';
    END IF;
    IF v_quote.expires_at <= now() THEN
      RAISE EXCEPTION 'shipping_quote_expired' USING ERRCODE = '23514';
    END IF;

    UPDATE public.orders o
    SET
      shipping_quote_id = v_quote.id,
      shipping_provider = v_quote.provider,
      shipping_carrier = v_quote.carrier,
      shipping_carrier_description = v_quote.carrier_description,
      shipping_service = v_quote.service,
      shipping_service_description = v_quote.service_description,
      shipping_delivery_estimate = v_quote.delivery_estimate,
      shipping_amount = v_quote.amount,
      shipping_currency = v_quote.currency,
      shipping_destination_postal_code = v_quote.destination_postal_code,
      shipping_destination_city = v_quote.destination_city,
      shipping_destination_state = v_quote.destination_state,
      total = o.total + v_quote.amount,
      updated_at = now()
    WHERE o.id = v_order_id;

    UPDATE public.shipping_quotes q
    SET consumed_at = now(), order_id = v_order_id
    WHERE q.id = v_quote_id;

    SELECT * INTO v_order FROM public.orders o WHERE o.id = v_order_id;
  END IF;

  RETURN v_result || jsonb_build_object(
    'total', v_order.total,
    'shipping_amount', v_order.shipping_amount,
    'shipping_currency', v_order.shipping_currency,
    'shipping_carrier', v_order.shipping_carrier_description,
    'shipping_service', v_order.shipping_service_description,
    'shipping_delivery_estimate', v_order.shipping_delivery_estimate,
    'shipping_destination_postal_code', v_order.shipping_destination_postal_code,
    'shipping_destination_city', v_order.shipping_destination_city,
    'shipping_destination_state', v_order.shipping_destination_state
  );
END;
$$;

COMMENT ON FUNCTION public.create_catalog_order(jsonb) IS
  'Stage 7: crea pedido y consume una cotización Envia vigente; total autoritativo incluye envío.';
REVOKE ALL ON FUNCTION public.create_catalog_order(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_catalog_order(jsonb) TO anon, authenticated;

COMMENT ON TABLE public.shipping_quotes IS
  'Stage 7: snapshots efímeros de tarifas Envia. Sólo service_role escribe; create_catalog_order consume.';
COMMENT ON TABLE public.shipping_quote_requests IS
  'Stage 7: rate limit de cotizaciones por hash de IP; no guarda IP en claro.';
