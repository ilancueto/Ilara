-- Etapa 1 / AUTH-01: roles de aplicación (admin | vendedor | none).
-- Fuente de verdad: public.user_roles (NO user_metadata).
-- Asignación: solo admin (RPC) o service_role. Nadie se auto-escala.
-- Bootstrap primer admin: SOLO service_role + user_id explícito + lock.
-- Lock compartido roles: pg_advisory_xact_lock(87201411) — ver set_user_role y bootstrap.

-- Clave estable de serialización de cambios de rol admin (bootstrap + set_user_role).
-- 87201411 = identificador de aplicación Ilara stage1 roles (no es un secreto).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'app_role' AND n.nspname = 'public') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'vendedor', 'none');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles (role);

COMMENT ON TABLE public.user_roles IS
  'Rol de panel Ilara. No editable por el propio usuario vía API abierta; set_user_role / service_role controlan cambios.';

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ─── Helpers SECURITY DEFINER (search_path vacío + cualificación explícita) ─

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT ur.role
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
    ),
    'none'::public.app_role
  );
$$;

COMMENT ON FUNCTION public.current_app_role() IS
  'Rol del JWT actual. Sin fila => none. DEFINER + search_path vacío evita recursión RLS y search_path hijack.';

CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.current_app_role() = 'admin'::public.app_role;
$$;

CREATE OR REPLACE FUNCTION public.can_use_pos()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.current_app_role() IN ('admin'::public.app_role, 'vendedor'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_inventory()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.current_app_role() = 'admin'::public.app_role;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_finance()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.current_app_role() IN ('admin'::public.app_role, 'vendedor'::public.app_role);
$$;

REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_app_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_use_pos() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_inventory() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_finance() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_app_role() FROM anon;
REVOKE ALL ON FUNCTION public.is_app_admin() FROM anon;
REVOKE ALL ON FUNCTION public.can_use_pos() FROM anon;
REVOKE ALL ON FUNCTION public.can_manage_inventory() FROM anon;
REVOKE ALL ON FUNCTION public.can_manage_finance() FROM anon;

GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_use_pos() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_inventory() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_finance() TO authenticated, service_role;

-- ─── RLS user_roles (sin subquery recursiva) ───────────────────────────────
-- Estas policies DEBEN sobrevivir a 21412: no usar barrido %_admin% sobre user_roles
-- sin recrearlas. 21412 las reafirma al final.

DROP POLICY IF EXISTS "user_roles_select_own_or_admin" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_admin" ON public.user_roles;

CREATE POLICY "user_roles_select_own"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "user_roles_select_admin"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (public.is_app_admin());

REVOKE ALL ON TABLE public.user_roles FROM PUBLIC;
REVOKE ALL ON TABLE public.user_roles FROM anon;
REVOKE ALL ON TABLE public.user_roles FROM authenticated;
GRANT SELECT ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;

-- ─── set_user_role (lock 87201411 serializa último-admin) ──────────────────

CREATE OR REPLACE FUNCTION public.set_user_role(p_user_id uuid, p_role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller uuid := (SELECT auth.uid());
  v_caller_role public.app_role;
  v_is_service boolean := coalesce((SELECT auth.jwt()) ->> 'role', '') = 'service_role';
  v_target_is_admin boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_user' USING ERRCODE = '22023';
  END IF;

  IF p_role IS NULL THEN
    RAISE EXCEPTION 'invalid_role' USING ERRCODE = '22023';
  END IF;

  -- Serializa bootstrap y cambios de admin (misma clave que bootstrap_first_admin).
  PERFORM pg_advisory_xact_lock(87201411);

  IF v_is_service THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p_user_id AND ur.role = 'admin'::public.app_role
    ) INTO v_target_is_admin;

    IF p_role IS DISTINCT FROM 'admin'::public.app_role AND v_target_is_admin THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.role = 'admin'::public.app_role AND ur.user_id <> p_user_id
      ) THEN
        RAISE EXCEPTION 'last_admin' USING ERRCODE = '23514';
      END IF;
    END IF;

    INSERT INTO public.user_roles (user_id, role, updated_by)
    VALUES (p_user_id, p_role, p_user_id)
    ON CONFLICT (user_id) DO UPDATE
      SET role = EXCLUDED.role,
          updated_at = now(),
          updated_by = p_user_id;
    RETURN;
  END IF;

  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  v_caller_role := public.current_app_role();
  IF v_caller_role <> 'admin'::public.app_role THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_user_id AND ur.role = 'admin'::public.app_role
  ) INTO v_target_is_admin;

  IF p_role IS DISTINCT FROM 'admin'::public.app_role AND v_target_is_admin THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.role = 'admin'::public.app_role AND ur.user_id <> p_user_id
    ) THEN
      RAISE EXCEPTION 'last_admin' USING ERRCODE = '23514';
    END IF;
  END IF;

  INSERT INTO public.user_roles (user_id, role, updated_by)
  VALUES (p_user_id, p_role, v_caller)
  ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role,
        updated_at = now(),
        updated_by = v_caller;
END;
$$;

COMMENT ON FUNCTION public.set_user_role(uuid, public.app_role) IS
  'Asigna rol. admin (JWT) o service_role. Lock 87201411. Bloquea last_admin.';

REVOKE ALL ON FUNCTION public.set_user_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_user_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role) TO authenticated, service_role;

-- ─── bootstrap_first_admin (solo service_role; misma lock 87201411) ────────

CREATE OR REPLACE FUNCTION public.bootstrap_first_admin(p_user_id uuid)
RETURNS public.app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_service boolean := coalesce((SELECT auth.jwt()) ->> 'role', '') = 'service_role';
BEGIN
  IF NOT v_is_service THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_user' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(87201411);

  IF EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.role = 'admin'::public.app_role
  ) THEN
    RAISE EXCEPTION 'admin_already_exists' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.user_roles (user_id, role, updated_by)
  VALUES (p_user_id, 'admin'::public.app_role, p_user_id)
  ON CONFLICT (user_id) DO UPDATE
    SET role = 'admin'::public.app_role,
        updated_at = now(),
        updated_by = p_user_id;

  RETURN 'admin'::public.app_role;
END;
$$;

COMMENT ON FUNCTION public.bootstrap_first_admin(uuid) IS
  'Primer admin explícito. SOLO service_role + p_user_id. Lock 87201411. No cliente.';

DROP FUNCTION IF EXISTS public.bootstrap_first_admin();

REVOKE ALL ON FUNCTION public.bootstrap_first_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bootstrap_first_admin(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.bootstrap_first_admin(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin(uuid) TO service_role;
