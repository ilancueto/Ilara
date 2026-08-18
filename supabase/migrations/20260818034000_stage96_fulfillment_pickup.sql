-- =============================================================================
-- Stage 9.6 — Retiro en el local y entrega a coordinar
-- =============================================================================
-- El envío por correo sigue pidiendo cotización Envia.
-- Retiro y "a coordinar" no cotizan, no cobran envío y no tocan sale_price
-- ni pedidos ya grabados.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_mode text NOT NULL DEFAULT 'envio'
    CHECK (fulfillment_mode IN ('envio', 'retiro', 'coordinar'));

COMMENT ON COLUMN public.orders.fulfillment_mode IS
  'Cómo se entrega el pedido: envio (correo), retiro en el local, o a coordinar.';

ALTER FUNCTION public.create_catalog_order(jsonb)
  RENAME TO create_catalog_order_core_stage83;

REVOKE ALL ON FUNCTION public.create_catalog_order_core_stage83(jsonb)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_catalog_order(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hash text;
  v_mode text;
  v_zone text;
  v_result jsonb;
  v_order_id uuid;
  v_replay boolean;
  v_existing text;
  v_order public.orders%ROWTYPE;
  v_carrier text;
  v_service text;
  v_estimate text;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '23514';
  END IF;
  IF p_payload ? 'shipping_amount' OR p_payload ? 'shipping_carrier'
     OR p_payload ? 'public_price' OR p_payload ? 'amount_due' THEN
    RAISE EXCEPTION 'client_price_not_allowed' USING ERRCODE = '23514';
  END IF;

  v_hash := lower(trim(coalesce(p_payload->>'access_capability_hash', '')));
  IF v_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_access_capability' USING ERRCODE = '23514';
  END IF;

  v_mode := nullif(trim(coalesce(p_payload->>'fulfillment_mode', '')), '');
  IF v_mode IS NULL THEN
    IF nullif(trim(coalesce(p_payload->>'shipping_quote_id', '')), '') IS NOT NULL THEN
      v_mode := 'envio';
    ELSE
      RAISE EXCEPTION 'invalid_fulfillment_mode' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF v_mode NOT IN ('envio', 'retiro', 'coordinar') THEN
    RAISE EXCEPTION 'invalid_fulfillment_mode' USING ERRCODE = '23514';
  END IF;

  v_zone := nullif(trim(coalesce(p_payload->>'fulfillment_zone', '')), '');
  IF v_zone IS NOT NULL AND char_length(v_zone) > 80 THEN
    RAISE EXCEPTION 'invalid_fulfillment_zone' USING ERRCODE = '23514';
  END IF;

  IF v_mode = 'envio' THEN
    v_result := public.create_catalog_order_core_stage72(
      p_payload - 'access_capability_hash' - 'fulfillment_mode' - 'fulfillment_zone'
    );
    v_order_id := (v_result->>'order_id')::uuid;
    UPDATE public.orders
    SET fulfillment_mode = 'envio'
    WHERE id = v_order_id
      AND fulfillment_mode IS DISTINCT FROM 'envio';
  ELSE
    IF nullif(trim(coalesce(p_payload->>'shipping_quote_id', '')), '') IS NOT NULL THEN
      RAISE EXCEPTION 'fulfillment_shipping_conflict' USING ERRCODE = '23514';
    END IF;

    v_result := public.create_catalog_order_core_stage61(
      p_payload - 'access_capability_hash' - 'fulfillment_mode' - 'fulfillment_zone' - 'shipping_quote_id'
    );
    v_order_id := (v_result->>'order_id')::uuid;
    v_replay := coalesce((v_result->>'idempotent_replay')::boolean, false);

    SELECT * INTO v_order
    FROM public.orders o
    WHERE o.id = v_order_id
    FOR UPDATE;

    IF v_mode = 'retiro' THEN
      v_carrier := 'Retiro en el local';
      v_service := 'En el local';
      v_estimate := 'Horario a coordinar';
    ELSE
      v_carrier := 'A coordinar';
      v_service := 'Por WhatsApp';
      v_estimate := 'Lo coordinamos por WhatsApp';
    END IF;

    IF v_replay THEN
      IF v_order.fulfillment_mode IS DISTINCT FROM v_mode THEN
        RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = '23514';
      END IF;
    ELSE
      UPDATE public.orders
      SET
        fulfillment_mode = v_mode,
        shipping_quote_id = NULL,
        shipping_provider = NULL,
        shipping_amount = 0,
        shipping_currency = 'ARS',
        shipping_carrier = v_carrier,
        shipping_carrier_description = v_carrier,
        shipping_service = v_service,
        shipping_service_description = v_service,
        shipping_delivery_estimate = v_estimate,
        shipping_destination_city = v_zone,
        shipping_destination_formatted_address = v_zone,
        updated_at = now()
      WHERE id = v_order_id;
    END IF;

    SELECT * INTO v_order FROM public.orders o WHERE o.id = v_order_id;
    v_result := v_result || jsonb_build_object(
      'total', v_order.total,
      'shipping_amount', v_order.shipping_amount,
      'shipping_currency', coalesce(v_order.shipping_currency, 'ARS'),
      'shipping_carrier', v_order.shipping_carrier_description,
      'shipping_service', v_order.shipping_service_description,
      'shipping_delivery_estimate', v_order.shipping_delivery_estimate,
      'shipping_destination_postal_code', coalesce(v_order.shipping_destination_postal_code, ''),
      'shipping_destination_city', coalesce(v_order.shipping_destination_city, ''),
      'shipping_destination_state', coalesce(v_order.shipping_destination_state, ''),
      'shipping_destination_formatted_address', v_order.shipping_destination_formatted_address
    );
  END IF;

  v_replay := coalesce((v_result->>'idempotent_replay')::boolean, false);
  IF v_replay THEN
    SELECT c.capability_hash INTO v_existing
    FROM public.order_access_capabilities c
    WHERE c.order_id = v_order_id;
    IF v_existing IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = '23514';
    END IF;
  ELSE
    INSERT INTO public.order_access_capabilities (order_id, capability_hash, expires_at)
    VALUES (v_order_id, v_hash, now() + interval '30 days');
  END IF;

  RETURN v_result || jsonb_build_object('fulfillment_mode', v_mode);
END;
$$;

COMMENT ON FUNCTION public.create_catalog_order(jsonb) IS
  'Crea el pedido con envío cotizado, retiro en el local o entrega a coordinar. Sin plaintext de la clave.';

REVOKE ALL ON FUNCTION public.create_catalog_order(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_catalog_order(jsonb) TO anon, authenticated;
