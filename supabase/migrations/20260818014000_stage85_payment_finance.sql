-- =============================================================================
-- Stage 8.5 — corte de caja de pedidos, margen de pagos y hallazgos
-- =============================================================================
-- Forward-only. No inserta sales ni incomes. Flags permanecen apagados.

CREATE OR REPLACE FUNCTION public.admin_order_payments(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', p.id,
      'method', p.method,
      'status', p.status,
      'amount_due', p.amount_due,
      'base_amount', p.base_amount,
      'public_amount', p.public_amount,
      'transfer_saving', p.transfer_saving,
      'price_uplift', p.price_uplift,
      'estimated_fee', p.estimated_fee,
      'actual_fee', p.actual_fee,
      'net_received', p.net_received,
      'refunded_amount', p.refunded_amount,
      'expires_at', p.expires_at,
      'approved_at', p.approved_at,
      'rejected_at', p.rejected_at,
      'expected_available_at', p.expected_available_at,
      'reject_reason', p.reject_reason,
      'has_receipt', EXISTS (SELECT 1 FROM public.payment_receipts r WHERE r.payment_id = p.id)
    ) ORDER BY p.created_at DESC)
    FROM public.order_payments p
    WHERE p.order_id = p_order_id
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION private.payment_reconcile_findings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_payments_on boolean := false;
  v_review_hours integer := 24;
BEGIN
  SELECT coalesce(bool_or(payments_enabled), false),
         coalesce(max(transfer_reservation_hours), 24)
  INTO v_payments_on, v_review_hours
  FROM public.payment_pricing_versions
  WHERE status = 'active';

  RETURN coalesce((
    SELECT jsonb_agg(f ORDER BY f->>'code')
    FROM (
      SELECT jsonb_build_object(
        'code', 'confirmed_without_payment',
        'severity', 'warning',
        'order_number', o.order_number,
        'detail', 'Pedido confirmado sin cobro aprobado'
      ) AS f
      FROM public.orders o
      WHERE v_payments_on
        AND o.channel = 'catalog'
        AND o.status IN ('confirmed', 'preparing', 'ready', 'completed')
        AND NOT EXISTS (
          SELECT 1 FROM public.order_payments p
          WHERE p.order_id = o.id AND p.status IN ('approved', 'partially_refunded', 'refunded')
        )

      UNION ALL
      SELECT jsonb_build_object(
        'code', 'approved_on_cancelled_order',
        'severity', 'critical',
        'order_number', o.order_number,
        'detail', 'Hay un cobro aprobado sobre un pedido cancelado'
      )
      FROM public.order_payments p
      JOIN public.orders o ON o.id = p.order_id
      WHERE p.status IN ('approved', 'partially_refunded')
        AND o.status = 'cancelled'

      UNION ALL
      SELECT jsonb_build_object(
        'code', 'fee_delta',
        'severity', 'info',
        'order_number', o.order_number,
        'detail', 'La comisión real difiere de la estimada'
      )
      FROM public.order_payments p
      JOIN public.orders o ON o.id = p.order_id
      WHERE p.method = 'mercado_pago'
        AND p.status IN ('approved', 'partially_refunded', 'refunded')
        AND p.actual_fee IS NOT NULL
        AND p.estimated_fee IS NOT NULL
        AND abs(p.actual_fee - p.estimated_fee) > 1

      UNION ALL
      SELECT jsonb_build_object(
        'code', 'transfer_past_due',
        'severity', 'warning',
        'order_number', o.order_number,
        'detail', 'La transferencia sigue abierta después del vencimiento'
      )
      FROM public.order_payments p
      JOIN public.orders o ON o.id = p.order_id
      WHERE p.method = 'bank_transfer'
        AND p.status IN ('pending', 'requires_review')
        AND p.expires_at <= now()

      UNION ALL
      SELECT jsonb_build_object(
        'code', 'transfer_review_stale',
        'severity', 'warning',
        'order_number', o.order_number,
        'detail', 'Hay un comprobante esperando revisión hace rato'
      )
      FROM public.order_payments p
      JOIN public.orders o ON o.id = p.order_id
      WHERE p.method = 'bank_transfer'
        AND p.status = 'requires_review'
        AND p.updated_at <= now() - make_interval(hours => v_review_hours)

      UNION ALL
      SELECT jsonb_build_object(
        'code', 'refund_inconsistent',
        'severity', 'critical',
        'order_number', o.order_number,
        'detail', 'El reembolso no cierra con el importe cobrado'
      )
      FROM public.order_payments p
      JOIN public.orders o ON o.id = p.order_id
      WHERE p.refunded_amount > p.amount_due
         OR (p.status = 'refunded' AND p.refunded_amount <= 0)
         OR (p.status = 'partially_refunded' AND p.refunded_amount <= 0)

      UNION ALL
      SELECT jsonb_build_object(
        'code', 'amount_or_currency_mismatch',
        'severity', 'critical',
        'order_number', o.order_number,
        'detail', 'Llegó un aviso de cobro con importe o moneda distintos'
      )
      FROM public.payment_events e
      JOIN public.order_payments p ON p.id = e.payment_id
      JOIN public.orders o ON o.id = p.order_id
      WHERE e.event_type = 'payment.mismatch'
        AND e.processing_result = 'rejected'
    ) findings
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION private.payment_reconcile_findings() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.finance_stage8_payments_slice(
  p_from date DEFAULT (current_date - 30),
  p_to date DEFAULT current_date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pos jsonb;
  v_inflow numeric := 0;
  v_outflow numeric := 0;
  v_estimated numeric := 0;
  v_actual numeric := 0;
  v_net numeric := 0;
  v_methods jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to OR p_to - p_from > 3660 THEN
    RAISE EXCEPTION 'invalid_finance_period' USING ERRCODE = '22023';
  END IF;

  v_pos := public.finance_stage66_snapshot(p_from, p_to);

  SELECT
    coalesce(sum(p.amount_due) FILTER (
      WHERE p.status IN ('approved', 'partially_refunded', 'refunded')
        AND p.approved_at::date BETWEEN p_from AND p_to
    ), 0),
    coalesce(sum(p.refunded_amount) FILTER (
      WHERE p.refunded_at IS NOT NULL AND p.refunded_at::date BETWEEN p_from AND p_to
    ), 0),
    coalesce(sum(p.estimated_fee) FILTER (
      WHERE p.status IN ('approved', 'partially_refunded', 'refunded')
        AND p.approved_at::date BETWEEN p_from AND p_to
    ), 0),
    coalesce(sum(p.actual_fee) FILTER (
      WHERE p.status IN ('approved', 'partially_refunded', 'refunded')
        AND p.approved_at::date BETWEEN p_from AND p_to
        AND p.actual_fee IS NOT NULL
    ), 0),
    coalesce(sum(coalesce(p.net_received, p.amount_due - coalesce(p.actual_fee, p.estimated_fee, 0))) FILTER (
      WHERE p.status IN ('approved', 'partially_refunded', 'refunded')
        AND p.approved_at::date BETWEEN p_from AND p_to
    ), 0)
  INTO v_inflow, v_outflow, v_estimated, v_actual, v_net
  FROM public.order_payments p;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'method', x.method,
    'inflow', x.inflow,
    'outflow', x.outflow,
    'net', x.inflow - x.outflow
  ) ORDER BY x.method), '[]'::jsonb)
  INTO v_methods
  FROM (
    SELECT
      p.method,
      coalesce(sum(p.amount_due) FILTER (
        WHERE p.status IN ('approved', 'partially_refunded', 'refunded')
          AND p.approved_at::date BETWEEN p_from AND p_to
      ), 0) AS inflow,
      coalesce(sum(p.refunded_amount) FILTER (
        WHERE p.refunded_at IS NOT NULL AND p.refunded_at::date BETWEEN p_from AND p_to
      ), 0) AS outflow
    FROM public.order_payments p
    GROUP BY p.method
  ) x
  WHERE x.inflow <> 0 OR x.outflow <> 0;

  RETURN jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'origin', 'catalog_payment',
    'pos', jsonb_build_object(
      'inflow', coalesce((v_pos->'summary'->>'period_inflow')::numeric, 0),
      'outflow', coalesce((v_pos->'summary'->>'period_outflow')::numeric, 0),
      'net', coalesce((v_pos->'summary'->>'period_inflow')::numeric, 0)
        - coalesce((v_pos->'summary'->>'period_outflow')::numeric, 0)
    ),
    'catalog', jsonb_build_object(
      'inflow', v_inflow,
      'outflow', v_outflow,
      'net', v_inflow - v_outflow,
      'methods', v_methods
    ),
    'combined', jsonb_build_object(
      'inflow', coalesce((v_pos->'summary'->>'period_inflow')::numeric, 0) + v_inflow,
      'outflow', coalesce((v_pos->'summary'->>'period_outflow')::numeric, 0) + v_outflow,
      'net', coalesce((v_pos->'summary'->>'period_inflow')::numeric, 0)
        - coalesce((v_pos->'summary'->>'period_outflow')::numeric, 0)
        + v_inflow - v_outflow
    ),
    'margin', jsonb_build_object(
      'gross', v_inflow,
      'estimated_fee', v_estimated,
      'actual_fee', v_actual,
      'fee_delta', v_actual - v_estimated,
      'net_received', v_net,
      'refunds', v_outflow
    ),
    'findings', private.payment_reconcile_findings()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_payment_ops_board()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ver public.payment_pricing_versions%ROWTYPE;
  v_health jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ver FROM public.payment_pricing_versions WHERE status = 'active' LIMIT 1;
  BEGIN
    v_health := public.payment_expire_health();
  EXCEPTION WHEN insufficient_privilege OR OTHERS THEN
    v_health := jsonb_build_object('has_run', false);
  END;

  RETURN jsonb_build_object(
    'flags', jsonb_build_object(
      'payments_enabled', coalesce(v_ver.payments_enabled, false),
      'mercado_pago_enabled', coalesce(v_ver.mercado_pago_enabled, false),
      'bank_transfer_enabled', coalesce(v_ver.bank_transfer_enabled, false),
      'catalog_dual_price_visible', coalesce(v_ver.catalog_dual_price_visible, false)
    ),
    'expire', v_health,
    'findings', private.payment_reconcile_findings(),
    'recent', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'order_number', o.order_number,
        'method', p.method,
        'status', p.status,
        'amount_due', p.amount_due,
        'estimated_fee', p.estimated_fee,
        'actual_fee', p.actual_fee,
        'approved_at', p.approved_at,
        'created_at', p.created_at
      ) ORDER BY p.created_at DESC)
      FROM (
        SELECT * FROM public.order_payments ORDER BY created_at DESC LIMIT 40
      ) p
      JOIN public.orders o ON o.id = p.order_id
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finance_stage8_payments_slice(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_payment_ops_board() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_stage8_payments_slice(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_payment_ops_board() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_order_payments(uuid) TO authenticated, service_role;
