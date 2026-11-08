-- Owner brief 7 Nov 2026: stock and cost live only in Daftra; the website only sells orders.
-- With Daftra connected and inventory tracking off, checkout read an empty local stock copy and refused every product.
-- 1. In Daftra mode, local stock is checked only when the store requires inventory tracking.
-- 2. The untracked-sale path already used in built-in mode now also serves Daftra mode.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

do $do$
declare d text:=pg_get_functiondef('private.checkout_review_before_cod(jsonb)'::regprocedure);
 a text:=$a$if (product.is_serialized or not settings.allow_out_of_stock_purchases) and public.erp_storefront_stock($a$;
 b text:=$a$if settings.inventory_tracking_required and (product.is_serialized or not settings.allow_out_of_stock_purchases) and public.erp_storefront_stock($a$;
begin
 if position(a in d)=0 then raise exception 'Checkout review differs from the reviewed version.'; end if;
 execute replace(d,a,b);
end $do$;

do $do$
declare d text:=pg_get_functiondef('private.checkout_review_before_pdc(jsonb)'::regprocedure);
 a text:=$a$if review->>'erpMode'<>'built_in' or (review->>'isPreorder')::boolean then$a$;
 b text:=$a$if (review->>'erpMode'<>'built_in' and coalesce((select site_cfg.inventory_tracking_required from public.site_settings site_cfg where site_cfg.key='default'),true)) or (review->>'isPreorder')::boolean then$a$;
begin
 if position(a in d)=0 then raise exception 'Checkout review differs from the reviewed version.'; end if;
 execute replace(d,a,b);
end $do$;

-- Orders and online payments in an untracked store never touch local stock, so either ERP mode may take them.
create function private.assert_checkout_erp() returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.site_settings where key='default' for share;
 if public.get_active_erp_mode()='daftra' and not coalesce((select site_cfg.inventory_tracking_required from public.site_settings site_cfg where site_cfg.key='default'),true) then return; end if;
 perform public.assert_built_in_erp();
end $$;
revoke all on function private.assert_checkout_erp() from public,anon,authenticated;

do $do$
declare fn text; d text; a text:='perform public.assert_built_in_erp();';
begin
 foreach fn in array array['public.commerce_create_normal_customer_order','public.commerce_create_builtin_customer_order'] loop
  select pg_get_functiondef(p.oid) into strict d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname||'.'||p.proname=fn and p.prokind='f';
  if position(a in d)=0 then raise exception 'Checkout function % differs from the reviewed version.',fn; end if;
  execute replace(d,a,'perform private.assert_checkout_erp();');
 end loop;
end $do$;

-- Daftra's own order path reserves local stock, so it applies only when the store tracks inventory.
do $do$
declare d text:=pg_get_functiondef('public.commerce_create_customer_order_before_order_sms(uuid,jsonb,jsonb,boolean,uuid)'::regprocedure);
 a text:=$a$if public.get_active_erp_mode()='daftra' then$a$;
 b text:=$a$if public.get_active_erp_mode()='daftra' and coalesce((select site_cfg.inventory_tracking_required from public.site_settings site_cfg where site_cfg.key='default'),true) then$a$;
begin
 if position(a in d)=0 then raise exception 'Order path differs from the reviewed version.'; end if;
 execute replace(d,a,b);
end $do$;

do $do$
declare d text:=(select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='commerce_prepare_payment_checkout_before_merchant_retry' and p.prokind='f');
 a text:=$a$or review->>'erpMode'<>'built_in' then raise exception 'checkout:quote';$a$;
 b text:=$a$or (review->>'erpMode'<>'built_in' and coalesce((select site_cfg.inventory_tracking_required from public.site_settings site_cfg where site_cfg.key='default'),true)) then raise exception 'checkout:quote';$a$;
begin
 if position(a in d)=0 then raise exception 'Payment checkout differs from the reviewed version.'; end if;
 execute replace(d,a,b);
end $do$;

notify pgrst,'reload schema';
commit;
