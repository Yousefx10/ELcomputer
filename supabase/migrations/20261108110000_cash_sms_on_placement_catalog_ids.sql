-- Cash orders get their SMS when placed, like paid orders, without waiting for staff review.
-- Product views use the same variant ID as carts, orders and the catalog feed.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

do $patch$
declare d text;accepted constant text:=$a$status in('processing','in_progress','being_shipped','out_for_delivery','completed','delivered')$a$;
begin
 d:=pg_get_functiondef('public.sms_capture_transactional()'::regprocedure);
 if (length(d)-length(replace(d,accepted,'')))/length(accepted)<>2 then raise exception 'sms capture anchor changed';end if;
 execute replace(d,accepted,$a$status not in('cancelled','returned','refunded')$a$);

 d:=pg_get_functiondef('public.commerce_meta_event(text,uuid,jsonb)'::regprocedure);
 if position($a$vid:=nullif(p_event->>'variantId','')::uuid;$a$ in d)=0 then raise exception 'meta event anchor changed';end if;
 execute replace(d,$a$vid:=nullif(p_event->>'variantId','')::uuid;$a$,
  $a$vid:=nullif(p_event->>'variantId','')::uuid;
  if vid is null and ename='ViewContent' then select v.id into vid from public.product_variants v where v.product_id=pid and v.is_active order by v.created_at,v.id limit 1;end if;$a$);
end $patch$;
commit;
