-- Atomic combo edits. INVOKER preserves existing admin RLS and column privileges.
CREATE OR REPLACE FUNCTION public.save_inventory_combo(
  p_payload jsonb,
  p_combo_id bigint DEFAULT NULL,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_id public.combos.id%TYPE;
  v_updated_at timestamptz;
  v_name text := btrim(p_payload->>'name');
  v_price numeric;
  v_items jsonb := p_payload->'items';
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_inventory() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR
     v_name IS NULL OR char_length(v_name) NOT BETWEEN 1 AND 200 OR
     jsonb_typeof(p_payload->'sale_price') IS DISTINCT FROM 'number' OR
     jsonb_typeof(p_payload->'is_active') IS DISTINCT FROM 'boolean' OR
     jsonb_typeof(v_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'invalid_combo' USING ERRCODE = '23514';
  END IF;
  v_price := (p_payload->>'sale_price')::numeric;
  IF v_price <= 0 OR v_price > 999999999 OR jsonb_array_length(v_items) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'invalid_combo' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_items) item
    WHERE jsonb_typeof(item->'product_id') IS DISTINCT FROM 'number'
       OR jsonb_typeof(item->'quantity') IS DISTINCT FROM 'number'
       OR coalesce(item->>'product_id', '') !~ '^[1-9][0-9]{0,14}$'
       OR coalesce(item->>'quantity', '') !~ '^[1-9][0-9]{0,5}$'
  ) OR (SELECT count(*) <> count(DISTINCT item->>'product_id') FROM jsonb_array_elements(v_items) item) THEN
    RAISE EXCEPTION 'invalid_combo_items' USING ERRCODE = '23514';
  END IF;
  IF p_combo_id IS NULL THEN
    INSERT INTO public.combos(name, description, sale_price, is_active)
    VALUES (v_name, nullif(btrim(p_payload->>'description'), ''), v_price, (p_payload->>'is_active')::boolean)
    RETURNING id INTO v_id;
  ELSE
    SELECT id, updated_at INTO v_id, v_updated_at FROM public.combos WHERE id = p_combo_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'combo_not_found' USING ERRCODE = 'P0002'; END IF;
    IF p_expected_updated_at IS NULL OR v_updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'combo_changed' USING ERRCODE = '40001';
    END IF;
    UPDATE public.combos SET name = v_name, description = nullif(btrim(p_payload->>'description'), ''),
      sale_price = v_price, is_active = (p_payload->>'is_active')::boolean, updated_at = clock_timestamp()
    WHERE id = v_id;
    DELETE FROM public.combo_items WHERE combo_id = v_id;
  END IF;
  -- FK/unique/check failures roll back the header and deleted components too.
  INSERT INTO public.combo_items(combo_id, product_id, quantity)
  SELECT v_id, (item->>'product_id')::bigint, (item->>'quantity')::integer
  FROM jsonb_array_elements(v_items) item;
  RETURN jsonb_build_object('id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.save_inventory_combo(jsonb, bigint, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_inventory_combo(jsonb, bigint, timestamptz) TO authenticated;
