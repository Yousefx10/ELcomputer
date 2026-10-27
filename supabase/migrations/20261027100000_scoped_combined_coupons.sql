-- Optional eligibility for one combined merchandise/delivery promotion.
-- Existing NULL scopes retain existing coupon behavior and settings.edit RLS.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table public.site_coupons
 add column eligible_customer_id uuid references public.customer_profiles(id),
 add column eligible_product_id uuid references public.products(id),
 add column eligible_shipping_company_id uuid references public.commerce_shipping_companies(id);

do $$ declare d text; a text; begin
 -- Bind the authenticated server-side customer, never the supplied address email.
 d:=pg_get_functiondef('private.checkout_authorize(uuid)'::regprocedure);
 a:='end if;';
 if (length(d)-length(replace(d,a,'')))/length(a)<>3 then raise exception 'Review checkout customer context.';end if;
 a:='raise exception ''checkout:permission'' using errcode=''42501'';end if;';
 if position(a in d)=0 then raise exception 'Review checkout customer authorization.';end if;
 -- Insert after the final profile/identity authorization, preserving prior checks.
 a:='not coalesce(is_anonymous,false)) then';
 if position(a in d)=0 then raise exception 'Review authorized customer identity.';end if;
 a:='raise exception ''checkout:permission'' using errcode=''42501'';end if;'||E'\nend';
 if position(a in d)=0 then raise exception 'Review final customer authorization.';end if;
 execute replace(d,a,'raise exception ''checkout:permission'' using errcode=''42501'';end if;'||E'\n perform set_config(''app.checkout_customer_id'',p_user_id::text,true);\nend');

 d:=pg_get_functiondef('private.checkout_review(jsonb)'::regprocedure);
 a:='declare review jsonb; delivery_discount numeric:=0;';
 if position(a in d)=0 then raise exception 'Review scoped coupon variables.';end if;
 d:=replace(d,a,'declare review jsonb; delivery_discount numeric:=0; promotion public.site_coupons%rowtype;');
 a:='review:=private.checkout_review_before_pdc(p_intent);';
 if position(a in d)=0 then raise exception 'Review scoped coupon boundary.';end if;
 execute replace(d,a,$patch$
 if p_intent#>>'{order,coupon_code}' is not null then
  select * into promotion from public.site_coupons c
   where upper(c.code)=p_intent#>>'{order,coupon_code}' for update;
  if not found
   or (promotion.eligible_customer_id is not null and promotion.eligible_customer_id is distinct from
       nullif(current_setting('app.checkout_customer_id',true),'')::uuid)
   or (promotion.eligible_product_id is not null and exists(
       select 1 from jsonb_array_elements(p_intent->'items') i
        where (i->>'product_id')::uuid is distinct from promotion.eligible_product_id))
   or (promotion.eligible_shipping_company_id is not null and promotion.eligible_shipping_company_id is distinct from
       nullif(p_intent#>>'{order,shipping_company_id}','')::uuid) then
   raise exception 'checkout:coupon';end if;
 end if;
 review:=private.checkout_review_before_pdc(p_intent);
 $patch$);
end $$;
notify pgrst,'reload schema';
commit;
