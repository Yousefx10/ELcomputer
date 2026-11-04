begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table public.site_coupons
 add column eligible_category_id uuid references public.categories(id),
 add column per_customer_limit integer check(per_customer_limit>0);
create function private.validate_coupon_capacity(p_intent jsonb,p_cart_id uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare c public.site_coupons; reserved bigint; consumed bigint; customer uuid:=nullif(current_setting('app.checkout_customer_id',true),'')::uuid;
begin
 if p_intent#>>'{order,coupon_code}' is null then return;end if;
 select * into c from public.site_coupons where upper(code)=p_intent#>>'{order,coupon_code}' for update;
 if not found or not c.is_active then raise exception 'coupon:invalid';end if;
 if c.starts_at>clock_timestamp() then raise exception 'coupon:not_started';end if;
 if c.ends_at<=clock_timestamp() then raise exception 'coupon:expired';end if;
 if c.eligible_category_id is not null and exists(select 1 from jsonb_array_elements(p_intent->'items') i
  join public.products p on p.id=(i->>'product_id')::uuid where p.category_id is distinct from c.eligible_category_id) then raise exception 'coupon:ineligible';end if;
 select count(*) into reserved from private.payment_checkout_sessions s
  left join private.payment_checkout_attempts a on a.session_id=s.id
  where s.snapshot#>>'{order,coupon_code}'=upper(c.code) and s.state not in ('paid','retired')
   and s.cart_id is distinct from p_cart_id
   and a.id is not null and not private.checkout_interface_unsubmitted(a.id);
 if c.usage_limit is not null and c.usage_count+reserved>=c.usage_limit then raise exception 'coupon:exhausted';end if;
 if c.per_customer_limit is not null then
  select count(*) into consumed from public.customer_orders o where o.user_id=customer and upper(o.coupon_code)=upper(c.code);
  select count(*) into reserved from private.payment_checkout_sessions s left join private.payment_checkout_attempts a on a.session_id=s.id
   where s.user_id=customer and s.snapshot#>>'{order,coupon_code}'=upper(c.code) and s.state not in ('paid','retired')
    and s.cart_id is distinct from p_cart_id and a.id is not null and not private.checkout_interface_unsubmitted(a.id);
  if consumed+reserved>=c.per_customer_limit then raise exception 'coupon:customer_limit';end if;
 end if;
 -- Accepted orders retain their usage after cancellations/refunds. Historical
 -- commercial evidence is never decremented or inferred from browser events.
end $$;
alter function private.checkout_review(jsonb) rename to checkout_review_before_coupon_capacity;
create function private.checkout_review(p_intent jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform private.validate_coupon_capacity(p_intent,nullif(current_setting('app.checkout_cart_id',true),'')::uuid);
 return private.checkout_review_before_coupon_capacity(p_intent);
end $$;
do $$ declare signature text; d text; a text;begin
 foreach signature in array array['public.commerce_checkout_quote(uuid,uuid,jsonb,jsonb)',
  'public.commerce_prepare_payment_checkout(uuid,uuid,uuid,jsonb,jsonb,text,jsonb)',
  'public.commerce_checkout_command(uuid,uuid,uuid,jsonb,jsonb)'] loop
  d:=pg_get_functiondef(signature::regprocedure);a:='perform private.checkout_authorize(p_user_id);';
  if position(a in d)=0 then raise exception 'Review coupon cart context preimage.';end if;
  execute replace(d,a,a||E'\n perform set_config(''app.checkout_cart_id'',p_cart_id::text,true);');
 end loop;
 d:=pg_get_functiondef('public.commerce_checkout_payment_interface(uuid,uuid,text,uuid,text,bigint)'::regprocedure);
 a:='failure:=private.checkout_retry_receipt(a.id);';
 if position(a in d)=0 then raise exception 'Review coupon submission gate preimage.';end if;
 execute replace(d,a,'perform private.validate_coupon_capacity(s.snapshot->''intent'',s.cart_id);'||E'\n '||a);
end $$;
revoke all on function private.validate_coupon_capacity(jsonb,uuid),private.checkout_review_before_coupon_capacity(jsonb),private.checkout_review(jsonb) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
