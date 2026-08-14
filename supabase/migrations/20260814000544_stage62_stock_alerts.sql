-- =============================================================================
-- Stage 6.2 — Alertas de reposición
-- =============================================================================
-- Forward-only. Sin logística (Stage 7) ni órdenes de compra.
-- - stock_alerts / stock_alert_events
-- - Trigger en products: abre/cierra según stock <= min_stock
-- - Una sola alerta activa (open|in_progress) por producto
-- - RPC transition_stock_alert (admin)
-- - Backfill de productos legacy bajo mínimo
-- =============================================================================

-- ─── Tablas ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- products.id is integer in the consolidated local baseline and bigint in
  -- the historical production schema. bigint remains FK-compatible with both.
  product_id bigint NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed')),
  -- Snapshots al abrir (y se refrescan en cada sync activo)
  stock_at_open integer NOT NULL,
  min_stock_at_open integer NOT NULL,
  stock_current integer NOT NULL,
  min_stock_current integer NOT NULL,
  suggested_qty integer NOT NULL CHECK (suggested_qty >= 1),
  deficit integer NOT NULL DEFAULT 0 CHECK (deficit >= 0),
  resolution_kind text
    CHECK (
      resolution_kind IS NULL
      OR resolution_kind IN ('manual', 'auto_stock')
    ),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  dismissed_at timestamptz,
  note text,
  CONSTRAINT stock_alerts_note_len CHECK (note IS NULL OR char_length(note) <= 500),
  CONSTRAINT stock_alerts_resolution_consistency CHECK (
    (status = 'resolved' AND resolution_kind IS NOT NULL)
    OR (status = 'dismissed' AND resolution_kind IS NULL)
    OR (status IN ('open', 'in_progress') AND resolution_kind IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.stock_alert_events (
  id bigserial PRIMARY KEY,
  alert_id uuid NOT NULL REFERENCES public.stock_alerts(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_kind text NOT NULL DEFAULT 'system'
    CHECK (actor_kind IN ('system', 'admin')),
  reason text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_alert_events_reason_len CHECK (reason IS NULL OR char_length(reason) <= 500)
);

-- Una sola alerta activa por producto
CREATE UNIQUE INDEX IF NOT EXISTS stock_alerts_one_active_per_product
  ON public.stock_alerts (product_id)
  WHERE status IN ('open', 'in_progress');

CREATE INDEX IF NOT EXISTS stock_alerts_status_opened_idx
  ON public.stock_alerts (status, opened_at DESC);
CREATE INDEX IF NOT EXISTS stock_alerts_product_id_idx
  ON public.stock_alerts (product_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS stock_alerts_active_urgency_idx
  ON public.stock_alerts (deficit DESC, stock_current ASC, opened_at ASC)
  WHERE status IN ('open', 'in_progress');
CREATE INDEX IF NOT EXISTS stock_alert_events_alert_id_idx
  ON public.stock_alert_events (alert_id, created_at);

COMMENT ON TABLE public.stock_alerts IS
  'Stage 6.2 alertas de reposición. Activas: open|in_progress. Una por producto.';
COMMENT ON TABLE public.stock_alert_events IS
  'Historial de transiciones de alertas de stock.';

-- ─── Regla de cantidad sugerida (misma que dominio TS) ───────────────────────
-- target = max(min_stock * 2, min_stock + 1); si min_stock = 0 → 1
-- suggested = max(1, target - stock) cuando stock <= min_stock
CREATE OR REPLACE FUNCTION public.stock_alert_target_qty(p_min_stock integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN coalesce(p_min_stock, 0) <= 0 THEN 1
    ELSE greatest(p_min_stock * 2, p_min_stock + 1)
  END;
$$;

CREATE OR REPLACE FUNCTION public.stock_alert_suggested_qty(p_stock integer, p_min_stock integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT greatest(
    1,
    public.stock_alert_target_qty(p_min_stock) - coalesce(p_stock, 0)
  );
$$;

CREATE OR REPLACE FUNCTION public.stock_alert_deficit(p_stock integer, p_min_stock integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT greatest(0, coalesce(p_min_stock, 0) - coalesce(p_stock, 0));
$$;

REVOKE ALL ON FUNCTION public.stock_alert_target_qty(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stock_alert_suggested_qty(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stock_alert_deficit(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stock_alert_target_qty(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.stock_alert_suggested_qty(integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.stock_alert_deficit(integer, integer) TO authenticated, service_role;

-- ─── Sync por producto (trigger + backfill) ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_stock_alert_for_product(p_product_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_stock integer;
  v_min integer;
  v_active public.stock_alerts%ROWTYPE;
  v_alert_id uuid;
  v_suggested integer;
  v_deficit integer;
BEGIN
  IF p_product_id IS NULL THEN
    RETURN;
  END IF;

  -- Serializa backfill/trigger/reintentos del mismo producto. La actualización
  -- de products ya toma row lock, pero este lock también cubre invocaciones
  -- internas directas del owner durante migraciones y tareas operativas.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('stage62:stock-alert:' || p_product_id::text, 0)
  );

  SELECT p.stock, p.min_stock
  INTO v_stock, v_min
  FROM public.products p
  WHERE p.id = p_product_id;

  IF NOT FOUND THEN
    -- producto eliminado: CASCADE limpia filas
    RETURN;
  END IF;

  v_stock := coalesce(v_stock, 0);
  v_min := coalesce(v_min, 0);
  v_suggested := public.stock_alert_suggested_qty(v_stock, v_min);
  v_deficit := public.stock_alert_deficit(v_stock, v_min);

  SELECT * INTO v_active
  FROM public.stock_alerts a
  WHERE a.product_id = p_product_id
    AND a.status IN ('open', 'in_progress')
  FOR UPDATE;

  IF v_stock <= v_min THEN
    IF FOUND THEN
      -- Refrescar métricas de la alerta activa
      UPDATE public.stock_alerts
      SET
        stock_current = v_stock,
        min_stock_current = v_min,
        suggested_qty = v_suggested,
        deficit = v_deficit,
        updated_at = now()
      WHERE id = v_active.id;
    ELSE
      INSERT INTO public.stock_alerts (
        product_id,
        status,
        stock_at_open,
        min_stock_at_open,
        stock_current,
        min_stock_current,
        suggested_qty,
        deficit
      ) VALUES (
        p_product_id,
        'open',
        v_stock,
        v_min,
        v_stock,
        v_min,
        v_suggested,
        v_deficit
      )
      RETURNING id INTO v_alert_id;

      INSERT INTO public.stock_alert_events (
        alert_id, from_status, to_status, actor_user_id, actor_kind, reason, meta
      ) VALUES (
        v_alert_id,
        NULL,
        'open',
        NULL,
        'system',
        'opened',
        jsonb_build_object(
          'stock', v_stock,
          'min_stock', v_min,
          'suggested_qty', v_suggested,
          'deficit', v_deficit
        )
      );
    END IF;
  ELSE
    -- stock recuperado: cerrar alerta activa automáticamente
    IF FOUND THEN
      UPDATE public.stock_alerts
      SET
        status = 'resolved',
        resolution_kind = 'auto_stock',
        stock_current = v_stock,
        min_stock_current = v_min,
        suggested_qty = v_suggested,
        deficit = 0,
        resolved_at = coalesce(resolved_at, now()),
        updated_at = now()
      WHERE id = v_active.id;

      INSERT INTO public.stock_alert_events (
        alert_id, from_status, to_status, actor_user_id, actor_kind, reason, meta
      ) VALUES (
        v_active.id,
        v_active.status,
        'resolved',
        NULL,
        'system',
        'auto_stock_recovery',
        jsonb_build_object(
          'stock', v_stock,
          'min_stock', v_min,
          'resolution_kind', 'auto_stock'
        )
      );
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_stock_alert_for_product(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_stock_alert_for_product(bigint) FROM anon;
REVOKE ALL ON FUNCTION public.sync_stock_alert_for_product(bigint) FROM authenticated;
-- Solo invocable por trigger / owner / service_role (no grant a authenticated)

CREATE OR REPLACE FUNCTION public.trg_products_sync_stock_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.sync_stock_alert_for_product(NEW.id);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.stock IS DISTINCT FROM OLD.stock
       OR NEW.min_stock IS DISTINCT FROM OLD.min_stock THEN
      PERFORM public.sync_stock_alert_for_product(NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_products_sync_stock_alert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_products_sync_stock_alert() FROM anon;
REVOKE ALL ON FUNCTION public.trg_products_sync_stock_alert() FROM authenticated;

DROP TRIGGER IF EXISTS products_sync_stock_alert ON public.products;
CREATE TRIGGER products_sync_stock_alert
  AFTER INSERT OR UPDATE OF stock, min_stock ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_products_sync_stock_alert();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_alert_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.stock_alerts FROM PUBLIC;
REVOKE ALL ON TABLE public.stock_alerts FROM anon;
REVOKE ALL ON TABLE public.stock_alerts FROM authenticated;
REVOKE ALL ON TABLE public.stock_alert_events FROM PUBLIC;
REVOKE ALL ON TABLE public.stock_alert_events FROM anon;
REVOKE ALL ON TABLE public.stock_alert_events FROM authenticated;

DROP POLICY IF EXISTS stock_alerts_select_admin ON public.stock_alerts;
CREATE POLICY stock_alerts_select_admin
  ON public.stock_alerts
  FOR SELECT
  TO authenticated
  USING (public.is_app_admin());

DROP POLICY IF EXISTS stock_alert_events_select_admin ON public.stock_alert_events;
CREATE POLICY stock_alert_events_select_admin
  ON public.stock_alert_events
  FOR SELECT
  TO authenticated
  USING (public.is_app_admin());

GRANT SELECT ON TABLE public.stock_alerts TO authenticated;
GRANT SELECT ON TABLE public.stock_alert_events TO authenticated;
GRANT ALL ON TABLE public.stock_alerts TO service_role;
GRANT ALL ON TABLE public.stock_alert_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.stock_alert_events_id_seq TO service_role;

-- ─── RPC transición admin ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.transition_stock_alert(
  p_alert_id uuid,
  p_to_status text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_alert public.stock_alerts%ROWTYPE;
  v_from text;
  v_to text;
  v_note text;
  v_allowed boolean := false;
  v_resolution text := NULL;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF p_alert_id IS NULL THEN
    RAISE EXCEPTION 'invalid_alert_id' USING ERRCODE = '23514';
  END IF;

  v_to := lower(trim(coalesce(p_to_status, '')));
  IF v_to NOT IN ('open', 'in_progress', 'resolved', 'dismissed') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '23514';
  END IF;

  v_note := nullif(trim(coalesce(p_note, '')), '');
  IF v_note IS NOT NULL AND char_length(v_note) > 500 THEN
    RAISE EXCEPTION 'invalid_note' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_alert
  FROM public.stock_alerts a
  WHERE a.id = p_alert_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'alert_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_from := v_alert.status;

  -- Idempotencia
  IF v_from = v_to THEN
    RETURN jsonb_build_object(
      'alert_id', v_alert.id,
      'product_id', v_alert.product_id,
      'status', v_alert.status,
      'resolution_kind', v_alert.resolution_kind,
      'idempotent_replay', true
    );
  END IF;

  IF v_from = 'open' AND v_to IN ('in_progress', 'resolved', 'dismissed') THEN
    v_allowed := true;
  ELSIF v_from = 'in_progress' AND v_to IN ('resolved', 'dismissed') THEN
    v_allowed := true;
  -- permitir reabrir manual? no: terminales sin salida
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'invalid_transition' USING ERRCODE = '23514';
  END IF;

  IF v_to = 'dismissed' AND (v_note IS NULL OR char_length(v_note) < 3) THEN
    RAISE EXCEPTION 'dismiss_note_required' USING ERRCODE = '23514';
  END IF;

  IF v_to = 'resolved' THEN
    v_resolution := 'manual';
    IF v_note IS NULL OR char_length(v_note) < 3 THEN
      RAISE EXCEPTION 'resolve_note_required' USING ERRCODE = '23514';
    END IF;
  END IF;

  UPDATE public.stock_alerts a
  SET
    status = v_to,
    resolution_kind = CASE WHEN v_to = 'resolved' THEN v_resolution ELSE NULL END,
    assigned_to = CASE
      WHEN v_to = 'in_progress' THEN v_uid
      ELSE a.assigned_to
    END,
    note = CASE
      WHEN v_note IS NOT NULL THEN v_note
      ELSE a.note
    END,
    resolved_at = CASE
      WHEN v_to = 'resolved' THEN coalesce(a.resolved_at, now())
      ELSE a.resolved_at
    END,
    dismissed_at = CASE
      WHEN v_to = 'dismissed' THEN coalesce(a.dismissed_at, now())
      ELSE a.dismissed_at
    END,
    updated_at = now()
  WHERE a.id = v_alert.id;

  INSERT INTO public.stock_alert_events (
    alert_id, from_status, to_status, actor_user_id, actor_kind, reason, meta
  ) VALUES (
    v_alert.id,
    v_from,
    v_to,
    v_uid,
    'admin',
    coalesce(v_note, v_to),
    jsonb_build_object(
      'resolution_kind', v_resolution
    )
  );

  RETURN jsonb_build_object(
    'alert_id', v_alert.id,
    'product_id', v_alert.product_id,
    'status', v_to,
    'from_status', v_from,
    'resolution_kind', v_resolution,
    'idempotent_replay', false
  );
END;
$$;

COMMENT ON FUNCTION public.transition_stock_alert(uuid, text, text) IS
  'Stage 6.2: transición admin de alerta de stock. Idempotente. Sin service role en app.';

REVOKE ALL ON FUNCTION public.transition_stock_alert(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transition_stock_alert(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.transition_stock_alert(uuid, text, text) TO authenticated;

-- ─── Backfill seguro (productos legacy bajo mínimo) ───────────────────────────
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.id
    FROM public.products p
    WHERE coalesce(p.stock, 0) <= coalesce(p.min_stock, 0)
    ORDER BY p.id
  LOOP
    PERFORM public.sync_stock_alert_for_product(r.id);
  END LOOP;
END $$;
