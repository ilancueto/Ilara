-- =============================================================================
-- Stage 6.6 — Cuentas por cobrar/pagar y conciliación financiera
-- =============================================================================
-- Ledger append-only. Las tablas no se exponen directamente a authenticated;
-- toda lectura/escritura de negocio pasa por RPC admin con auth.uid().

CREATE TABLE public.financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('receivable', 'payable')),
  sale_id bigint UNIQUE REFERENCES public.sales(id) ON DELETE RESTRICT,
  customer_id bigint REFERENCES public.customers(id) ON DELETE SET NULL,
  counterparty text,
  description text NOT NULL CHECK (char_length(trim(description)) BETWEEN 3 AND 500),
  original_amount numeric(12,2) NOT NULL CHECK (original_amount > 0),
  due_date date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'partial', 'settled', 'cancelled')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (kind = 'receivable' AND sale_id IS NOT NULL)
    OR (kind = 'payable' AND sale_id IS NULL)
  )
);

CREATE INDEX financial_accounts_kind_status_due_idx
  ON public.financial_accounts (kind, status, due_date, created_at DESC);
CREATE INDEX financial_accounts_customer_idx
  ON public.financial_accounts (customer_id) WHERE customer_id IS NOT NULL;

CREATE TABLE public.financial_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('inflow', 'outflow')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL CHECK (payment_method IN (
    'efectivo', 'transferencia', 'tarjeta_debito', 'tarjeta_credito',
    'mercadopago', 'otro'
  )),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  note text CHECK (note IS NULL OR char_length(trim(note)) BETWEEN 3 AND 500),
  expense_id uuid REFERENCES public.expenses(id) ON DELETE RESTRICT,
  idempotency_key uuid NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX financial_movements_account_date_idx
  ON public.financial_movements (account_id, occurred_at DESC);
CREATE INDEX financial_movements_date_method_idx
  ON public.financial_movements (occurred_at, payment_method);

ALTER TABLE public.incomes
  ADD COLUMN payment_method text NOT NULL DEFAULT 'otro'
  CHECK (payment_method IN (
    'efectivo', 'transferencia', 'tarjeta_debito', 'tarjeta_credito',
    'mercadopago', 'otro'
  ));

ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_movements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.financial_accounts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.financial_movements FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.financial_accounts, public.financial_movements TO service_role;

-- Crea/sincroniza la CxC al guardar una venta a crédito. No borra historial.
CREATE OR REPLACE FUNCTION public.sync_sale_financial_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.payment_method = 'credito' OR NEW.status = 'pending_payment' THEN
    INSERT INTO public.financial_accounts (
      kind, sale_id, customer_id, counterparty, description, original_amount,
      status, created_by, created_at, updated_at
    ) VALUES (
      'receivable', NEW.id, NEW.customer_id,
      nullif(trim(NEW.customer_name), ''),
      'Venta a crédito #' || NEW.id,
      NEW.total,
      CASE WHEN NEW.status = 'pending_payment' THEN 'open' ELSE 'settled' END,
      NEW.created_by,
      coalesce(NEW.sale_date, NEW.created_at, now()), now()
    )
    ON CONFLICT (sale_id) DO UPDATE SET
      customer_id = EXCLUDED.customer_id,
      counterparty = EXCLUDED.counterparty,
      original_amount = EXCLUDED.original_amount,
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sales_sync_financial_account
AFTER INSERT OR UPDATE OF total, status, payment_method, customer_id, customer_name
ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.sync_sale_financial_account();

-- Backfill: todo crédito histórico queda trazable. Para los ya completados se
-- registra un cobro inicial en la fecha de venta, única aproximación disponible.
INSERT INTO public.financial_accounts (
  kind, sale_id, customer_id, counterparty, description, original_amount,
  status, created_by, created_at, updated_at
)
SELECT
  'receivable', s.id, s.customer_id, nullif(trim(s.customer_name), ''),
  'Venta a crédito #' || s.id, s.total,
  CASE WHEN s.status = 'pending_payment' THEN 'open' ELSE 'settled' END,
  s.created_by, coalesce(s.sale_date, s.created_at, now()), now()
FROM public.sales s
WHERE s.payment_method = 'credito' OR s.status = 'pending_payment'
ON CONFLICT (sale_id) DO NOTHING;

INSERT INTO public.financial_movements (
  account_id, direction, amount, payment_method, occurred_at, note,
  idempotency_key, created_by
)
SELECT
  a.id, 'inflow', greatest(a.original_amount - coalesce(r.refunded, 0), 0.01),
  'otro', coalesce(s.sale_date, s.created_at, now()),
  'Cobro histórico importado al iniciar Stage 6.6',
  gen_random_uuid(), coalesce(s.updated_by, s.created_by)
FROM public.financial_accounts a
JOIN public.sales s ON s.id = a.sale_id
LEFT JOIN LATERAL (
  SELECT sum(sr.refund_total) AS refunded
  FROM public.sale_returns sr
  WHERE sr.sale_id = s.id AND sr.refund_method = 'credito_cancelado'
) r ON true
WHERE a.kind = 'receivable'
  AND s.status <> 'pending_payment'
  AND coalesce(s.updated_by, s.created_by) IS NOT NULL
  AND a.original_amount - coalesce(r.refunded, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.financial_movements fm WHERE fm.account_id = a.id
  );

CREATE OR REPLACE FUNCTION public.finance_account_net_amount(p_account public.financial_accounts)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT greatest(
    p_account.original_amount - CASE WHEN p_account.kind = 'receivable' THEN coalesce((
      SELECT sum(sr.refund_total)
      FROM public.sale_returns sr
      WHERE sr.sale_id = p_account.sale_id
        AND sr.refund_method = 'credito_cancelado'
    ), 0) ELSE 0 END,
    0
  )::numeric;
$$;

CREATE OR REPLACE FUNCTION public.refresh_receivable_after_return()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_account public.financial_accounts;
  v_net numeric;
  v_paid numeric;
BEGIN
  IF NEW.refund_method <> 'credito_cancelado' THEN RETURN NEW; END IF;
  SELECT * INTO v_account FROM public.financial_accounts
  WHERE sale_id = NEW.sale_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;
  v_net := public.finance_account_net_amount(v_account);
  SELECT coalesce(sum(amount), 0) INTO v_paid
  FROM public.financial_movements WHERE account_id = v_account.id;
  UPDATE public.financial_accounts SET
    status = CASE WHEN v_paid >= v_net THEN 'settled' WHEN v_paid > 0 THEN 'partial' ELSE 'open' END,
    updated_at = now()
  WHERE id = v_account.id;
  IF v_paid >= v_net THEN
    UPDATE public.sales SET status = 'completed', updated_by = NEW.created_by
    WHERE id = NEW.sale_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sale_returns_refresh_receivable
AFTER INSERT ON public.sale_returns
FOR EACH ROW EXECUTE FUNCTION public.refresh_receivable_after_return();

CREATE OR REPLACE FUNCTION public.finance_stage66_snapshot(
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
  v_result jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to OR p_to - p_from > 3660 THEN
    RAISE EXCEPTION 'invalid_finance_period' USING ERRCODE = '22023';
  END IF;

  WITH account_rows AS (
    SELECT
      a.*,
      public.finance_account_net_amount(a) AS net_amount,
      coalesce((SELECT sum(m.amount) FROM public.financial_movements m WHERE m.account_id = a.id), 0) AS paid_amount,
      coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', m.id, 'amount', m.amount, 'payment_method', m.payment_method,
          'occurred_at', m.occurred_at, 'note', m.note, 'created_by', m.created_by
        ) ORDER BY m.occurred_at DESC, m.created_at DESC)
        FROM public.financial_movements m WHERE m.account_id = a.id
      ), '[]'::jsonb) AS movements
    FROM public.financial_accounts a
  ), cash_lines AS (
    -- Ventas cobradas directamente; las que tienen cuenta financiera se excluyen.
    SELECT
      CASE WHEN s.payment_method = 'tarjeta' THEN 'tarjeta_credito' ELSE s.payment_method END AS method,
      s.total::numeric AS inflow, 0::numeric AS outflow
    FROM public.sales s
    WHERE s.status <> 'pending_payment'
      AND s.sale_date::date BETWEEN p_from AND p_to
      AND s.payment_method <> 'mixto'
      AND NOT EXISTS (SELECT 1 FROM public.financial_accounts a WHERE a.sale_id = s.id)
    UNION ALL
    SELECT
      CASE WHEN b->>'method' = 'tarjeta' THEN 'tarjeta_credito' ELSE b->>'method' END,
      (b->>'amount')::numeric, 0::numeric
    FROM public.sales s
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(s.payment_breakdown, '[]'::jsonb)) b
    WHERE s.status <> 'pending_payment'
      AND s.sale_date::date BETWEEN p_from AND p_to
      AND s.payment_method = 'mixto'
      AND NOT EXISTS (SELECT 1 FROM public.financial_accounts a WHERE a.sale_id = s.id)
    UNION ALL
    SELECT m.payment_method, m.amount, 0::numeric
    FROM public.financial_movements m
    JOIN public.financial_accounts a ON a.id = m.account_id AND a.kind = 'receivable'
    WHERE m.occurred_at::date BETWEEN p_from AND p_to
    UNION ALL
    SELECT i.payment_method, i.amount, 0::numeric
    FROM public.incomes i WHERE i.date BETWEEN p_from AND p_to
    UNION ALL
    SELECT
      CASE WHEN sr.refund_method = 'tarjeta' THEN 'tarjeta_credito' ELSE sr.refund_method END,
      0::numeric, sr.refund_total::numeric
    FROM public.sale_returns sr
    WHERE sr.created_at::date BETWEEN p_from AND p_to
      AND sr.refund_method <> 'credito_cancelado'
    UNION ALL
    SELECT
      CASE WHEN e.payment_method = 'tarjeta' THEN 'tarjeta_credito' ELSE e.payment_method END,
      0::numeric, e.amount::numeric
    FROM public.expenses e WHERE e.date BETWEEN p_from AND p_to
  ), reconciliation AS (
    SELECT method, sum(inflow) AS inflow, sum(outflow) AS outflow
    FROM cash_lines
    WHERE method IN ('efectivo', 'transferencia', 'tarjeta_debito', 'tarjeta_credito', 'mercadopago', 'otro')
    GROUP BY method
  )
  SELECT jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'summary', jsonb_build_object(
      'receivable_open', coalesce(sum(greatest(ar.net_amount - ar.paid_amount, 0)) FILTER (WHERE ar.kind = 'receivable' AND ar.status <> 'cancelled'), 0),
      'payable_open', coalesce(sum(greatest(ar.net_amount - ar.paid_amount, 0)) FILTER (WHERE ar.kind = 'payable' AND ar.status <> 'cancelled'), 0),
      'period_inflow', coalesce((SELECT sum(inflow) FROM cash_lines), 0),
      'period_outflow', coalesce((SELECT sum(outflow) FROM cash_lines), 0)
    ),
    'accounts', coalesce(jsonb_agg(jsonb_build_object(
      'id', ar.id, 'kind', ar.kind, 'sale_id', ar.sale_id,
      'customer_id', ar.customer_id, 'counterparty', ar.counterparty,
      'description', ar.description, 'original_amount', ar.original_amount,
      'net_amount', ar.net_amount, 'paid_amount', ar.paid_amount,
      'balance', greatest(ar.net_amount - ar.paid_amount, 0),
      'due_date', ar.due_date,
      'status', CASE
        WHEN ar.status = 'cancelled' THEN 'cancelled'
        WHEN ar.net_amount - ar.paid_amount <= 0 THEN 'settled'
        WHEN ar.paid_amount > 0 THEN 'partial'
        ELSE 'open'
      END,
      'created_at', ar.created_at, 'movements', ar.movements
    ) ORDER BY
      CASE WHEN ar.status <> 'cancelled' AND ar.net_amount - ar.paid_amount > 0 THEN 0 ELSE 1 END,
      ar.due_date NULLS LAST, ar.created_at DESC), '[]'::jsonb),
    'reconciliation', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'payment_method', r.method, 'inflow', r.inflow, 'outflow', r.outflow,
      'net', r.inflow - r.outflow
    ) ORDER BY r.method) FROM reconciliation r), '[]'::jsonb)
  ) INTO v_result
  FROM account_rows ar;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_create_payable(
  p_counterparty text,
  p_description text,
  p_amount numeric,
  p_due_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_account public.financial_accounts;
BEGIN
  IF v_uid IS NULL OR NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
  IF char_length(trim(coalesce(p_counterparty, ''))) NOT BETWEEN 2 AND 200
     OR char_length(trim(coalesce(p_description, ''))) NOT BETWEEN 3 AND 500
     OR p_amount IS NULL OR p_amount <= 0 OR p_amount > 9999999999.99 THEN
    RAISE EXCEPTION 'invalid_payable' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.financial_accounts (
    kind, counterparty, description, original_amount, due_date, created_by
  ) VALUES (
    'payable', trim(p_counterparty), trim(p_description), round(p_amount, 2), p_due_date, v_uid
  ) RETURNING * INTO v_account;
  RETURN to_jsonb(v_account);
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_record_settlement(
  p_account_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_occurred_at timestamptz DEFAULT now(),
  p_note text DEFAULT NULL,
  p_idempotency_key uuid DEFAULT gen_random_uuid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_account public.financial_accounts;
  v_net numeric;
  v_paid numeric;
  v_balance numeric;
  v_movement public.financial_movements;
  v_expense_id uuid;
BEGIN
  IF v_uid IS NULL OR NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 9999999999.99
     OR p_payment_method NOT IN (
       'efectivo', 'transferencia', 'tarjeta_debito', 'tarjeta_credito', 'mercadopago', 'otro'
     )
     OR p_occurred_at IS NULL
     OR (p_note IS NOT NULL AND char_length(trim(p_note)) NOT BETWEEN 3 AND 500)
     OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'invalid_settlement' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_account FROM public.financial_accounts
  WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'financial_account_not_found' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO v_movement FROM public.financial_movements
  WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN RETURN to_jsonb(v_movement); END IF;
  IF v_account.status = 'cancelled' THEN
    RAISE EXCEPTION 'financial_account_cancelled' USING ERRCODE = '23514';
  END IF;

  v_net := public.finance_account_net_amount(v_account);
  SELECT coalesce(sum(amount), 0) INTO v_paid
  FROM public.financial_movements WHERE account_id = v_account.id;
  v_balance := greatest(v_net - v_paid, 0);
  IF round(p_amount, 2) > v_balance THEN
    RAISE EXCEPTION 'settlement_exceeds_balance' USING ERRCODE = '23514';
  END IF;

  IF v_account.kind = 'payable' THEN
    INSERT INTO public.expenses (
      date, category, description, amount, payment_method, notes, user_id
    ) VALUES (
      p_occurred_at::date, 'otros',
      'Pago a ' || coalesce(v_account.counterparty, 'proveedor') || ': ' || v_account.description,
      round(p_amount, 2), p_payment_method,
      'Generado por cuenta por pagar ' || v_account.id,
      v_uid
    ) RETURNING id INTO v_expense_id;
  END IF;

  INSERT INTO public.financial_movements (
    account_id, direction, amount, payment_method, occurred_at, note,
    expense_id, idempotency_key, created_by
  ) VALUES (
    v_account.id,
    CASE WHEN v_account.kind = 'receivable' THEN 'inflow' ELSE 'outflow' END,
    round(p_amount, 2), p_payment_method, p_occurred_at,
    nullif(trim(p_note), ''), v_expense_id, p_idempotency_key, v_uid
  ) RETURNING * INTO v_movement;

  v_paid := v_paid + round(p_amount, 2);
  UPDATE public.financial_accounts SET
    status = CASE WHEN v_paid >= v_net THEN 'settled' ELSE 'partial' END,
    updated_at = now()
  WHERE id = v_account.id;

  IF v_account.kind = 'receivable' AND v_paid >= v_net THEN
    UPDATE public.sales SET status = 'completed', updated_by = v_uid
    WHERE id = v_account.sale_id;
  END IF;

  RETURN to_jsonb(v_movement) || jsonb_build_object(
    'balance', greatest(v_net - v_paid, 0),
    'account_status', CASE WHEN v_paid >= v_net THEN 'settled' ELSE 'partial' END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_cancel_payable(p_account_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_account public.financial_accounts;
BEGIN
  IF v_uid IS NULL OR NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
  IF char_length(trim(coalesce(p_reason, ''))) NOT BETWEEN 3 AND 500 THEN
    RAISE EXCEPTION 'invalid_cancel_reason' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_account FROM public.financial_accounts
  WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'financial_account_not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_account.kind <> 'payable' OR EXISTS (
    SELECT 1 FROM public.financial_movements WHERE account_id = v_account.id
  ) THEN
    RAISE EXCEPTION 'payable_cannot_be_cancelled' USING ERRCODE = '23514';
  END IF;
  UPDATE public.financial_accounts SET
    status = 'cancelled',
    description = description || ' — Cancelada: ' || trim(p_reason),
    updated_at = now()
  WHERE id = v_account.id RETURNING * INTO v_account;
  RETURN to_jsonb(v_account);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_sale_financial_account() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_receivable_after_return() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finance_account_net_amount(public.financial_accounts) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finance_stage66_snapshot(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finance_create_payable(text, text, numeric, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finance_record_settlement(uuid, numeric, text, timestamptz, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finance_cancel_payable(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.finance_stage66_snapshot(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_create_payable(text, text, numeric, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_record_settlement(uuid, numeric, text, timestamptz, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_cancel_payable(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_sale_financial_account() TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_receivable_after_return() TO service_role;
GRANT EXECUTE ON FUNCTION public.finance_account_net_amount(public.financial_accounts) TO service_role;

COMMENT ON TABLE public.financial_accounts IS
  'Stage 6.6: CxC derivadas de ventas a crédito y CxP manuales.';
COMMENT ON TABLE public.financial_movements IS
  'Stage 6.6: cobros/pagos append-only, idempotentes y auditados.';
COMMENT ON FUNCTION public.finance_stage66_snapshot(date, date) IS
  'Stage 6.6: saldos y conciliación por medio de pago, sólo admin.';
