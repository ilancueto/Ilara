-- Provider preferences are created and attached only by payments-mp-preference,
-- which uses service_role and verifies the customer's capability/follow token.
-- A customer must never be able to supply a checkout URL through PostgREST.
REVOKE ALL ON FUNCTION public.attach_mp_preference(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attach_mp_preference(jsonb) TO service_role;

-- This context contains customer contact details used by the provider backend.
-- Browser clients use get_catalog_payment_public / get_catalog_order_follow.
REVOKE ALL ON FUNCTION public.mp_preference_context(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mp_preference_context(text) TO service_role;

-- These predicates only delegate to current_app_role(), which performs the
-- privileged lookup for auth.uid(). The outer predicates need no elevation.
ALTER FUNCTION public.is_app_admin() SECURITY INVOKER;
ALTER FUNCTION public.can_manage_inventory() SECURITY INVOKER;
ALTER FUNCTION public.can_manage_finance() SECURITY INVOKER;
ALTER FUNCTION public.can_use_pos() SECURITY INVOKER;
