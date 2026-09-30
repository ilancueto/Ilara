-- Production predates the versioned baseline. Preserve its nullable legacy
-- fields and explicit-price inserts when provisioning a fresh cloud project.
-- No application rows are rewritten.
ALTER TABLE public.products
  ALTER COLUMN created_at DROP NOT NULL,
  ALTER COLUMN updated_at DROP NOT NULL,
  ALTER COLUMN min_stock DROP NOT NULL,
  ALTER COLUMN sale_price DROP DEFAULT;
ALTER TABLE public.sales
  ALTER COLUMN created_at DROP NOT NULL,
  ALTER COLUMN sale_date DROP NOT NULL,
  ALTER COLUMN status DROP NOT NULL,
  ALTER COLUMN total DROP DEFAULT;
ALTER TABLE public.sale_items
  ALTER COLUMN sale_id DROP NOT NULL,
  ALTER COLUMN product_name DROP DEFAULT,
  ALTER COLUMN quantity DROP DEFAULT,
  ALTER COLUMN subtotal DROP DEFAULT,
  ALTER COLUMN unit_price DROP DEFAULT;
ALTER TABLE public.expenses ALTER COLUMN user_id SET NOT NULL;
