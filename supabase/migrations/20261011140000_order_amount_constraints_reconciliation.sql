-- Migration 69: reconcile the separately approved checkpoint-63 integrity correction.
-- Preserve correct existing objects; reject unknown drift rather than replace it.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path='';
LOCK TABLE public.customer_orders IN ACCESS EXCLUSIVE MODE;

DO $reconcile$
DECLARE
  orders oid := 'public.customer_orders'::regclass;
  column_name text;
  constraint_name text;
  attribute smallint;
  amount_attributes smallint[] := ARRAY[]::smallint[];
  existing_count integer;
  actual record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class
    WHERE oid=orders AND relkind='r' AND relpersistence='p' AND relrowsecurity
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_inherits WHERE inhrelid=orders OR inhparent=orders
  ) THEN
    RAISE EXCEPTION 'Unsupported customer_orders relation. Stop for review.';
  END IF;

  -- The two amounts and existing total invariant share the reviewed money shape.
  FOREACH column_name IN ARRAY ARRAY['subtotal_amount','discount_amount','total_amount'] LOOP
    SELECT a.attnum INTO attribute
    FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid=orders AND a.attname=column_name AND NOT a.attisdropped
      AND a.attnum>0 AND a.atttypid='pg_catalog.numeric'::regtype
      AND pg_catalog.format_type(a.atttypid,a.atttypmod)='numeric(12,2)'
      AND a.attnotnull AND a.attgenerated='' AND a.attidentity=''
      AND pg_catalog.pg_get_expr(d.adbin,d.adrelid) IN ('0','0::numeric');
    IF attribute IS NULL THEN
      RAISE EXCEPTION 'Unsupported customer_orders column %. Stop for review.',column_name;
    END IF;
    IF column_name<>'total_amount' THEN
      amount_attributes:=pg_catalog.array_append(amount_attributes,attribute);
    END IF;
    constraint_name:='customer_orders_'||column_name||'_check';
    SELECT c.*,pg_catalog.pg_get_constraintdef(c.oid,false) AS definition INTO actual
    FROM pg_catalog.pg_constraint c WHERE c.conrelid=orders AND c.conname=constraint_name;
    IF FOUND THEN
      IF actual.contype<>'c' OR NOT actual.convalidated
        OR actual.definition<>'CHECK (('||column_name||' >= (0)::numeric))'
        OR actual.conkey IS DISTINCT FROM ARRAY[attribute]::smallint[]
        OR NOT actual.conislocal OR actual.coninhcount<>0 OR actual.conparentid<>0
        OR actual.connoinherit OR actual.condeferrable OR actual.condeferred THEN
        RAISE EXCEPTION 'Unexpected customer_orders constraint %. Stop for review.',constraint_name;
      END IF;
    ELSIF column_name='total_amount' THEN
      RAISE EXCEPTION 'Missing existing customer_orders total invariant. Stop for review.';
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    WHERE c.conrelid=orders AND c.contype='c' AND c.conkey && amount_attributes
      AND c.conname NOT IN ('customer_orders_subtotal_amount_check','customer_orders_discount_amount_check')
  ) THEN
    RAISE EXCEPTION 'Unexpected overlapping customer_orders amount check. Stop for review.';
  END IF;

  SELECT count(*) INTO existing_count FROM pg_catalog.pg_constraint
  WHERE conrelid=orders
    AND conname IN ('customer_orders_subtotal_amount_check','customer_orders_discount_amount_check');
  IF existing_count NOT IN (0,2) THEN
    RAISE EXCEPTION 'Partial customer_orders amount correction. Stop for review.';
  END IF;

  IF existing_count=0 THEN
    -- Validation rejects invalid historical rows; the transaction never rewrites them.
    ALTER TABLE public.customer_orders
      ADD CONSTRAINT customer_orders_subtotal_amount_check CHECK (subtotal_amount>=0) NOT VALID,
      ADD CONSTRAINT customer_orders_discount_amount_check CHECK (discount_amount>=0) NOT VALID;
    ALTER TABLE public.customer_orders VALIDATE CONSTRAINT customer_orders_subtotal_amount_check;
    ALTER TABLE public.customer_orders VALIDATE CONSTRAINT customer_orders_discount_amount_check;
  END IF;
END $reconcile$;

NOTIFY pgrst, 'reload schema';
COMMIT;
