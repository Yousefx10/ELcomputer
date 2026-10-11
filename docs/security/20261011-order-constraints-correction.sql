-- Separate review item: restore two missing baseline invariants. NOT authorized.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $guard$ BEGIN
 IF current_setting('elcomputer.order_constraints_approved',true) IS DISTINCT FROM 'restore-two-nonnegative-checks' THEN
   RAISE EXCEPTION 'Separate order-constraint approval required';
 END IF;
 IF (SELECT count(*) FROM supabase_migrations.schema_migrations) <> 63
    OR EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version >= '20261008120000') THEN
   RAISE EXCEPTION 'Migration checkpoint changed';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.customer_orders'::regclass
            AND conname IN ('customer_orders_subtotal_amount_check','customer_orders_discount_amount_check')) THEN
   RAISE EXCEPTION 'Expected missing constraints changed; re-audit';
 END IF;
 IF EXISTS (SELECT 1 FROM public.customer_orders WHERE subtotal_amount<0 OR discount_amount<0) THEN
   RAISE EXCEPTION 'Invalid historical amounts require separate review';
 END IF;
END $guard$;
ALTER TABLE public.customer_orders
 ADD CONSTRAINT customer_orders_subtotal_amount_check CHECK (subtotal_amount >= 0) NOT VALID,
 ADD CONSTRAINT customer_orders_discount_amount_check CHECK (discount_amount >= 0) NOT VALID;
ALTER TABLE public.customer_orders VALIDATE CONSTRAINT customer_orders_subtotal_amount_check;
ALTER TABLE public.customer_orders VALIDATE CONSTRAINT customer_orders_discount_amount_check;
NOTIFY pgrst, 'reload schema';
COMMIT;
