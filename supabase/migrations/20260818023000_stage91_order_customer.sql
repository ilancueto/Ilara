-- =============================================================================
-- Stage 9.1 — vínculo pedido web ↔ cliente CRM
-- =============================================================================
-- Forward-only. Snapshots del pedido no se reescriben. Flags de Stage 8 intactos.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_id integer
    REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_customer_id_created_idx
  ON public.orders (customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.order_customer_link_audit (
  id bigserial PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  match_count integer NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_customer_link_audit_order_id_key UNIQUE (order_id)
);

ALTER TABLE public.order_customer_link_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_customer_link_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.order_customer_link_audit TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.order_customer_link_audit_id_seq TO service_role;

COMMENT ON COLUMN public.orders.customer_id IS
  'Cliente CRM asociado. Nullable para históricos y teléfonos ambiguos.';
COMMENT ON TABLE public.order_customer_link_audit IS
  'Stage 9.1: pedidos no vinculados automáticamente (0 o varios clientes).';

CREATE OR REPLACE FUNCTION private.digits_only(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g');
$$;

CREATE OR REPLACE FUNCTION private.split_customer_name(p_name text)
RETURNS TABLE (first_name text, last_name text)
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    coalesce(nullif(trim(split_part(trim(coalesce(p_name, '')), ' ', 1)), ''), 'Cliente'),
    coalesce(
      nullif(trim(substr(trim(coalesce(p_name, '')), length(split_part(trim(coalesce(p_name, '')), ' ', 1)) + 1)), ''),
      '.'
    );
$$;

CREATE OR REPLACE FUNCTION private.match_customer_by_phone(p_phone text)
RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_digits text := private.digits_only(p_phone);
  v_id integer;
  v_count integer;
BEGIN
  IF v_digits IS NULL OR char_length(v_digits) < 8 THEN
    RETURN NULL;
  END IF;
  SELECT count(*)::integer, min(c.id)
  INTO v_count, v_id
  FROM public.customers c
  WHERE private.digits_only(c.phone) = v_digits;
  IF v_count = 1 THEN
    RETURN v_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION private.ensure_catalog_customer(
  p_name text,
  p_phone text,
  p_email text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_digits text := private.digits_only(p_phone);
  v_id integer;
  v_count integer;
  v_first text;
  v_last text;
  v_email text := nullif(trim(coalesce(p_email, '')), '');
BEGIN
  IF v_digits IS NULL OR char_length(v_digits) < 8 THEN
    RETURN NULL;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('stage91:cust:' || v_digits, 0)
  );

  SELECT count(*)::integer INTO v_count
  FROM public.customers c
  WHERE private.digits_only(c.phone) = v_digits;

  IF v_count > 1 THEN
    RETURN NULL;
  END IF;

  SELECT * FROM private.split_customer_name(p_name) INTO v_first, v_last;

  IF v_count = 1 THEN
    SELECT c.id INTO v_id
    FROM public.customers c
    WHERE private.digits_only(c.phone) = v_digits;
    UPDATE public.customers
    SET
      email = CASE
        WHEN email IS NULL OR btrim(email) = '' THEN v_email
        ELSE email
      END,
      phone = CASE
        WHEN phone IS NULL OR btrim(phone) = '' THEN v_digits
        ELSE phone
      END
    WHERE id = v_id;
    RETURN v_id;
  END IF;

  INSERT INTO public.customers (first_name, last_name, phone, email)
  VALUES (v_first, v_last, v_digits, v_email)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.orders_assign_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.customer_id IS NULL THEN
    NEW.customer_id := private.ensure_catalog_customer(
      NEW.customer_name, NEW.customer_phone, NEW.customer_email
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_assign_customer_trg ON public.orders;
CREATE TRIGGER orders_assign_customer_trg
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION private.orders_assign_customer();

-- Backfill: sólo vínculo inequívoco. No crea clientes.
INSERT INTO public.order_customer_link_audit (order_id, customer_phone, match_count, reason)
SELECT o.id, o.customer_phone, cnt.n,
  CASE WHEN cnt.n = 0 THEN 'no_customer' ELSE 'ambiguous_phone' END
FROM public.orders o
CROSS JOIN LATERAL (
  SELECT count(*)::integer AS n
  FROM public.customers c
  WHERE private.digits_only(c.phone) = private.digits_only(o.customer_phone)
) cnt
WHERE o.customer_id IS NULL
  AND cnt.n <> 1
ON CONFLICT DO NOTHING;

UPDATE public.orders o
SET customer_id = private.match_customer_by_phone(o.customer_phone)
WHERE o.customer_id IS NULL
  AND private.match_customer_by_phone(o.customer_phone) IS NOT NULL;

REVOKE ALL ON FUNCTION private.digits_only(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.split_customer_name(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.match_customer_by_phone(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.ensure_catalog_customer(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.orders_assign_customer() FROM PUBLIC, anon, authenticated;

-- CRM: pedidos web en el perfil
CREATE OR REPLACE FUNCTION public.customer_crm_profile(p_customer_id integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_result jsonb;
BEGIN
  IF v_uid IS NULL OR NOT (SELECT public.is_app_admin()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_customer_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.customers c WHERE c.id = p_customer_id
  ) THEN
    RAISE EXCEPTION 'customer_not_found' USING ERRCODE = 'P0002';
  END IF;

  WITH eligible_sales AS (
    SELECT s.id, s.sale_date, s.created_at, s.total, s.status, s.payment_method
    FROM public.sales s
    WHERE s.customer_id = p_customer_id
      AND coalesce(s.status, 'completed') <> 'pending_payment'
  ),
  returned AS (
    SELECT sr.sale_id, sum(sr.refund_total)::numeric AS refund_total
    FROM public.sale_returns sr
    JOIN eligible_sales es ON es.id = sr.sale_id
    GROUP BY sr.sale_id
  ),
  sale_facts AS (
    SELECT es.*,
      coalesce(r.refund_total, 0)::numeric AS refund_total,
      greatest(0, es.total - coalesce(r.refund_total, 0))::numeric AS net_total
    FROM eligible_sales es
    LEFT JOIN returned r ON r.sale_id = es.id
  ),
  catalog_orders AS (
    SELECT o.id, o.order_number, o.status, o.total, o.created_at, o.confirmed_at, o.cancelled_at
    FROM public.orders o
    WHERE o.customer_id = p_customer_id
  ),
  metrics AS (
    SELECT
      count(*)::bigint AS sale_count,
      coalesce(sum(total), 0)::numeric AS gross_spent,
      coalesce(sum(refund_total), 0)::numeric AS refund_total,
      coalesce(sum(net_total), 0)::numeric AS net_spent,
      coalesce(avg(net_total), 0)::numeric AS average_ticket,
      min(sale_date) AS first_purchase_at,
      max(sale_date) AS last_purchase_at
    FROM sale_facts
  ),
  order_metrics AS (
    SELECT
      count(*)::bigint AS order_count,
      coalesce(sum(total), 0)::numeric AS order_total,
      max(created_at) AS last_order_at,
      count(*) FILTER (WHERE status = 'pending')::bigint AS pending_count,
      count(*) FILTER (WHERE status IN ('confirmed', 'preparing', 'ready'))::bigint AS open_count,
      count(*) FILTER (WHERE status = 'completed')::bigint AS completed_count,
      count(*) FILTER (WHERE status = 'cancelled')::bigint AS cancelled_count
    FROM catalog_orders
  )
  SELECT jsonb_build_object(
    'customer', jsonb_build_object(
      'id', c.id,
      'first_name', c.first_name,
      'last_name', c.last_name,
      'email', c.email,
      'phone', c.phone,
      'created_at', c.created_at
    ),
    'metrics', jsonb_build_object(
      'sale_count', m.sale_count,
      'gross_spent', m.gross_spent,
      'refund_total', m.refund_total,
      'net_spent', m.net_spent,
      'average_ticket', round(m.average_ticket, 2),
      'first_purchase_at', m.first_purchase_at,
      'last_purchase_at', m.last_purchase_at
    ),
    'catalog_orders', jsonb_build_object(
      'order_count', om.order_count,
      'order_total', om.order_total,
      'last_order_at', om.last_order_at,
      'pending_count', om.pending_count,
      'open_count', om.open_count,
      'completed_count', om.completed_count,
      'cancelled_count', om.cancelled_count,
      'recent', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', r.id,
          'order_number', r.order_number,
          'status', r.status,
          'total', r.total,
          'created_at', r.created_at
        ) ORDER BY r.created_at DESC)
        FROM (
          SELECT * FROM catalog_orders ORDER BY created_at DESC LIMIT 20
        ) r
      ), '[]'::jsonb)
    ),
    'tags', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.name, 'color', t.color
      ) ORDER BY lower(t.name))
      FROM public.customer_tag_assignments a
      JOIN public.customer_tags t ON t.id = a.tag_id
      WHERE a.customer_id = c.id
    ), '[]'::jsonb),
    'notes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', n.id, 'body', n.body, 'created_at', n.created_at
      ) ORDER BY n.created_at DESC, n.id DESC)
      FROM (
        SELECT * FROM public.customer_notes
        WHERE customer_id = c.id AND archived_at IS NULL
        ORDER BY created_at DESC, id DESC
        LIMIT 50
      ) n
    ), '[]'::jsonb),
    'consent', coalesce((
      SELECT jsonb_build_object(
        'granted', e.granted, 'source', e.source,
        'evidence_note', e.evidence_note, 'created_at', e.created_at
      )
      FROM public.customer_consent_events e
      WHERE e.customer_id = c.id AND e.channel = 'marketing'
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT 1
    ), jsonb_build_object('granted', false, 'source', null, 'evidence_note', null, 'created_at', null)),
    'consent_history', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e.id, 'granted', e.granted, 'source', e.source,
        'evidence_note', e.evidence_note, 'created_at', e.created_at
      ) ORDER BY e.created_at DESC, e.id DESC)
      FROM (
        SELECT * FROM public.customer_consent_events
        WHERE customer_id = c.id AND channel = 'marketing'
        ORDER BY created_at DESC, id DESC
        LIMIT 20
      ) e
    ), '[]'::jsonb),
    'activity', coalesce((
      SELECT jsonb_agg(x.event ORDER BY x.event_at DESC)
      FROM (
        SELECT event, event_at FROM (
          SELECT jsonb_build_object(
            'id', 'sale-' || sf.id, 'type', 'sale', 'event_at', sf.sale_date,
            'sale_id', sf.id, 'amount', sf.total, 'status', sf.status,
            'payment_method', sf.payment_method
          ) AS event, sf.sale_date AS event_at
          FROM sale_facts sf
          UNION ALL
          SELECT jsonb_build_object(
            'id', 'return-' || sr.id, 'type', 'return', 'event_at', sr.created_at,
            'sale_id', sr.sale_id, 'amount', -sr.refund_total,
            'credit_note_number', sr.credit_note_number, 'reason', sr.reason
          ) AS event, sr.created_at AS event_at
          FROM public.sale_returns sr
          JOIN eligible_sales es ON es.id = sr.sale_id
          UNION ALL
          SELECT jsonb_build_object(
            'id', 'order-' || o.id, 'type', 'order', 'event_at', o.created_at,
            'order_id', o.id, 'order_number', o.order_number,
            'amount', o.total, 'status', o.status
          ) AS event, o.created_at AS event_at
          FROM catalog_orders o
        ) events
        ORDER BY event_at DESC
        LIMIT 50
      ) x
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.customers c
  CROSS JOIN metrics m
  CROSS JOIN order_metrics om
  WHERE c.id = p_customer_id;

  RETURN v_result;
END;
$$;
