-- =============================================================================
-- Stage 7.1 — Dirección estructurada y código postal resuelto por el sistema
-- =============================================================================

ALTER TABLE public.shipping_quotes
  ADD COLUMN destination_province_id text,
  ADD COLUMN destination_locality_id text,
  ADD COLUMN destination_street text,
  ADD COLUMN destination_number text,
  ADD COLUMN destination_formatted_address text,
  ADD COLUMN destination_lat numeric(9, 6),
  ADD COLUMN destination_lon numeric(9, 6),
  ADD CONSTRAINT shipping_quotes_structured_address CHECK (
    (
      destination_province_id IS NULL
      AND destination_locality_id IS NULL
      AND destination_street IS NULL
      AND destination_number IS NULL
      AND destination_formatted_address IS NULL
      AND destination_lat IS NULL
      AND destination_lon IS NULL
    )
    OR (
      destination_province_id ~ '^[0-9]{2}$'
      AND destination_locality_id ~ '^[0-9]{8}$'
      AND char_length(destination_street) BETWEEN 1 AND 160
      AND char_length(destination_number) BETWEEN 1 AND 20
      AND char_length(destination_formatted_address) BETWEEN 1 AND 300
      AND destination_lat BETWEEN -55.2 AND -21.7
      AND destination_lon BETWEEN -73.7 AND -53.5
    )
  );

ALTER TABLE public.orders
  ADD COLUMN shipping_destination_province_id text,
  ADD COLUMN shipping_destination_locality_id text,
  ADD COLUMN shipping_destination_street text,
  ADD COLUMN shipping_destination_number text,
  ADD COLUMN shipping_destination_formatted_address text,
  ADD COLUMN shipping_destination_lat numeric(9, 6),
  ADD COLUMN shipping_destination_lon numeric(9, 6),
  ADD CONSTRAINT orders_structured_shipping_address CHECK (
    (
      shipping_destination_province_id IS NULL
      AND shipping_destination_locality_id IS NULL
      AND shipping_destination_street IS NULL
      AND shipping_destination_number IS NULL
      AND shipping_destination_formatted_address IS NULL
      AND shipping_destination_lat IS NULL
      AND shipping_destination_lon IS NULL
    )
    OR (
      shipping_destination_province_id ~ '^[0-9]{2}$'
      AND shipping_destination_locality_id ~ '^[0-9]{8}$'
      AND char_length(shipping_destination_street) BETWEEN 1 AND 160
      AND char_length(shipping_destination_number) BETWEEN 1 AND 20
      AND char_length(shipping_destination_formatted_address) BETWEEN 1 AND 300
      AND shipping_destination_lat BETWEEN -55.2 AND -21.7
      AND shipping_destination_lon BETWEEN -73.7 AND -53.5
    )
  );

-- Reservar el cupo antes de llamar a geocodificadores/proveedores. El CP se
-- completa cuando la dirección fue resuelta.
ALTER TABLE public.shipping_quote_requests
  ALTER COLUMN destination_postal_code DROP NOT NULL;

-- Caché mínimo: conserva sólo hash irreversible + CP. Evita retener domicilios
-- en claro y cumple la obligación de cachear del geocodificador público.
CREATE TABLE public.shipping_geocode_cache (
  query_hash text PRIMARY KEY CHECK (char_length(query_hash) = 64),
  postal_code text NOT NULL CHECK (postal_code ~ '^[0-9]{4}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.shipping_geocode_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.shipping_geocode_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_geocode_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shipping_geocode_cache FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.shipping_geocode_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.shipping_geocode_cache TO service_role;
GRANT ALL ON TABLE public.shipping_geocode_requests TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.shipping_geocode_requests_id_seq TO service_role;

-- Serializa llamadas no cacheadas entre instancias para respetar 1 req/s.
CREATE OR REPLACE FUNCTION public.acquire_shipping_geocode_slot()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_last timestamptz;
  v_wait_seconds double precision;
BEGIN
  PERFORM pg_advisory_xact_lock(73171001);

  SELECT requested_at INTO v_last
  FROM public.shipping_geocode_requests
  ORDER BY id DESC
  LIMIT 1;

  IF v_last IS NOT NULL THEN
    v_wait_seconds := 1.1 - extract(epoch FROM (clock_timestamp() - v_last));
    IF v_wait_seconds > 0 THEN
      PERFORM pg_sleep(v_wait_seconds);
    END IF;
  END IF;

  INSERT INTO public.shipping_geocode_requests DEFAULT VALUES;
  DELETE FROM public.shipping_geocode_requests
  WHERE requested_at < clock_timestamp() - interval '1 day';
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_shipping_geocode_slot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_shipping_geocode_slot() TO service_role;

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
      shipping_destination_province_id = v_quote.destination_province_id,
      shipping_destination_locality_id = v_quote.destination_locality_id,
      shipping_destination_street = v_quote.destination_street,
      shipping_destination_number = v_quote.destination_number,
      shipping_destination_formatted_address = v_quote.destination_formatted_address,
      shipping_destination_lat = v_quote.destination_lat,
      shipping_destination_lon = v_quote.destination_lon,
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
    'shipping_destination_state', v_order.shipping_destination_state,
    'shipping_destination_formatted_address', v_order.shipping_destination_formatted_address
  );
END;
$$;

COMMENT ON FUNCTION public.create_catalog_order(jsonb) IS
  'Stage 7.1: consume cotización Envia y copia dirección normalizada completa al pedido.';
REVOKE ALL ON FUNCTION public.create_catalog_order(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_catalog_order(jsonb) TO anon, authenticated;

COMMENT ON TABLE public.shipping_geocode_cache IS
  'Stage 7.1: caché privado hash→CP; no conserva domicilios en claro.';
