-- Etapa 1 / forward-fix de grants legacy y contencion de passkeys.
--
-- Las policies RLS de 20260810221412 son la frontera por rol de aplicacion,
-- pero el esquema historico conserva grants directos demasiado amplios
-- (incluidos TRUNCATE/TRIGGER/REFERENCES). RLS no protege TRUNCATE, por lo que
-- aqui se reconstruye la matriz de privilegios de tabla de forma explicita.
--
-- Los SELECT de catalogo anon son grants por columna creados en Etapa 0. No
-- revocarlos: solo se eliminan privilegios mutantes y administrativos.

-- Catalogo publico: conservar exclusivamente los SELECT de columnas publicas.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.products, public.categories, public.combos, public.combo_items
  FROM anon;

-- Superficies privadas: anon no necesita ningun privilegio de tabla.
REVOKE ALL ON TABLE public.sales, public.sale_items, public.expenses
  FROM anon;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['customers', 'incomes', 'stock_movements']
  LOOP
    IF to_regclass(format('public.%I', v_table)) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', v_table);
    END IF;
  END LOOP;
END $$;

-- Cupones mantiene SELECT para el catalogo; toda mutacion queda cerrada.
DO $$
BEGIN
  IF to_regclass('public.coupons') IS NOT NULL THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
      ON TABLE public.coupons
      FROM anon;
  END IF;
END $$;

-- Quitar privilegios de secuencias a anon. Los SELECT publicos no los usan.
REVOKE ALL ON SEQUENCE
  public.products_id_seq,
  public.categories_id_seq,
  public.combos_id_seq,
  public.combo_items_id_seq,
  public.sales_id_seq,
  public.sale_items_id_seq
  FROM anon, PUBLIC;

DO $$
DECLARE
  v_sequence text;
BEGIN
  FOREACH v_sequence IN ARRAY ARRAY[
    'customers_id_seq', 'coupons_id_seq', 'stock_movements_id_seq'
  ]
  LOOP
    IF to_regclass(format('public.%I', v_sequence)) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL ON SEQUENCE public.%I FROM anon, PUBLIC',
        v_sequence
      );
    END IF;
  END LOOP;
END $$;

-- Reconstruir privilegios authenticated sin TRUNCATE/TRIGGER/REFERENCES.
REVOKE ALL ON TABLE public.products, public.categories, public.combos,
  public.combo_items, public.expenses
  FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.products, public.categories, public.combos, public.combo_items,
  public.expenses
  TO authenticated;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['customers', 'incomes', 'coupons']
  LOOP
    IF to_regclass(format('public.%I', v_table)) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', v_table);
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated',
        v_table
      );
    END IF;
  END LOOP;
END $$;

-- Las ventas y movimientos se reafirman por claridad; las mutaciones de venta
-- se hacen exclusivamente mediante los RPC autoritativos de 20260810221413.
REVOKE ALL ON TABLE public.sales, public.sale_items
  FROM authenticated;
GRANT SELECT, UPDATE ON TABLE public.sales TO authenticated;
GRANT SELECT ON TABLE public.sale_items TO authenticated;

DO $$
BEGIN
  IF to_regclass('public.stock_movements') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.stock_movements FROM authenticated;
    GRANT SELECT ON TABLE public.stock_movements TO authenticated;
  END IF;
END $$;

-- Secuencias requeridas por inserciones directas permitidas por las policies.
GRANT USAGE ON SEQUENCE
  public.products_id_seq,
  public.categories_id_seq,
  public.combos_id_seq,
  public.combo_items_id_seq
  TO authenticated;

DO $$
DECLARE
  v_sequence text;
BEGIN
  FOREACH v_sequence IN ARRAY ARRAY['customers_id_seq', 'coupons_id_seq']
  LOOP
    IF to_regclass(format('public.%I', v_sequence)) IS NOT NULL THEN
      EXECUTE format('GRANT USAGE ON SEQUENCE public.%I TO authenticated', v_sequence);
    END IF;
  END LOOP;
END $$;

-- Etapa 0: el inventario legacy contiene rutas privadas y es solo operativo.
REVOKE ALL ON FUNCTION public.stage0_inventory_legacy_receipt_urls() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stage0_inventory_legacy_receipt_urls() FROM anon;
REVOKE ALL ON FUNCTION public.stage0_inventory_legacy_receipt_urls() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.stage0_inventory_legacy_receipt_urls() TO service_role;

-- Los RPC del tablero son INVOKER y siguen sujetos a RLS, pero no forman parte
-- de la superficie anon. Evitar que un grant historico los publique por error.
DO $$
DECLARE
  v_signature text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.dashboard_finance_kpis(timestamp with time zone)',
    'public.dashboard_sales_daily(integer)',
    'public.dashboard_sales_monthly(integer)',
    'public.dashboard_sales_monthly_total_span()'
  ]
  LOOP
    IF to_regprocedure(v_signature) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon',
        to_regprocedure(v_signature)
      );
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role',
        to_regprocedure(v_signature)
      );
    END IF;
  END LOOP;
END $$;

-- Cerrar search_path mutable en funciones legacy. catalog_sales_by_product
-- conserva su superficie anon intencional y solo devuelve agregados.
ALTER FUNCTION public.catalog_sales_by_product() SET search_path = '';

CREATE OR REPLACE FUNCTION public.update_stock_on_sale()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  UPDATE public.products
  SET stock = stock - NEW.quantity
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.update_updated_at_column() SET search_path = '';

-- Passkeys permanecen contenidas. Los helpers DEFINER no deben ser una API
-- directa mientras PASSKEYS_CONTAINED=true en la Edge Function.
DO $$
DECLARE
  v_signature text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.check_passkey_rate_limit(text,character varying,character varying,integer,integer)',
    'public.cleanup_expired_passkey_challenges()',
    'public.log_passkey_audit_event(public.passkey_audit_event,uuid,text,text,inet,text,text,jsonb,text,text)'
  ]
  LOOP
    IF to_regprocedure(v_signature) IS NOT NULL THEN
      EXECUTE format(
        'ALTER FUNCTION %s SET search_path = %L',
        to_regprocedure(v_signature),
        ''
      );
      EXECUTE format(
        'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
        to_regprocedure(v_signature)
      );
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %s TO service_role',
        to_regprocedure(v_signature)
      );
    END IF;
  END LOOP;
END $$;

-- Tablas de passkeys cerradas mientras la funcionalidad esta deshabilitada.
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'passkey_credentials', 'passkey_challenges',
    'passkey_rate_limits', 'passkey_audit_log'
  ]
  LOOP
    IF to_regclass(format('public.%I', v_table)) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated',
        v_table
      );
    END IF;
  END LOOP;
END $$;

-- Policy legacy demasiado amplia: permitia UPDATE de cualquier receipt a
-- authenticated. Permanecen las cuatro policies estrictas por prefijo uid.
DROP POLICY IF EXISTS "Users can update receipts" ON storage.objects;
