-- Opt-in delivery discounts for normal untracked CARD checkout.
-- Zero defaults retain existing offers and every historical financial snapshot.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table public.site_coupons add column delivery_discount_value numeric(12,2) not null default 0
 constraint site_coupons_delivery_discount_value_check check(delivery_discount_value>=0);
alter table public.customer_orders add column delivery_discount_amount numeric(12,2) not null default 0
 constraint customer_orders_delivery_discount_amount_check check(
  delivery_discount_amount>=0 and delivery_discount_amount<=shipping_fee_amount
  and delivery_discount_amount<=discount_amount
  and (delivery_discount_amount=0 or (payment_method='card' and not is_preorder and stock_fulfillment_state='untracked')));

do $$ declare d text; a text; begin
 d:=pg_get_functiondef('private.checkout_review(jsonb)'::regprocedure);
 a:='declare review jsonb;';
 if position(a in d)=0 then raise exception 'Review delivery coupon variables.';end if;
 d:=replace(d,a,'declare review jsonb; delivery_discount numeric:=0;');
 a:='review:=private.checkout_review_before_pdc(p_intent);';
 if position(a in d)=0 then raise exception 'Review delivery coupon pricing.';end if;
 execute replace(d,a,a||$patch$
 if p_intent#>>'{order,coupon_code}' is not null then
  select c.delivery_discount_value into delivery_discount from public.site_coupons c
   where upper(c.code)=p_intent#>>'{order,coupon_code}' for update;
  if coalesce(delivery_discount,0)>0 then
   if p_intent#>>'{order,payment_method}'<>'card' or (review->>'isPreorder')::boolean
    or review->>'stockFulfillmentState' is distinct from 'untracked' then
    raise exception 'Delivery coupons require normal untracked card checkout.';end if;
   delivery_discount:=least(delivery_discount,(review->>'shippingFee')::numeric);
   if (review->>'totalAmount')::numeric-delivery_discount<=0 then raise exception 'checkout:coupon';end if;
   review:=review||jsonb_build_object('deliveryDiscountAmount',delivery_discount,
    'discountAmount',(review->>'discountAmount')::numeric+delivery_discount,
    'totalAmount',(review->>'totalAmount')::numeric-delivery_discount,
    'requiredNow',(review->>'requiredNow')::numeric-delivery_discount);
  end if;
 end if;
 $patch$);

 d:=pg_get_functiondef('public.commerce_create_normal_customer_order(uuid,jsonb,jsonb,boolean,uuid)'::regprocedure);
 a:='subtotal_amount,discount_amount,coupon_code,total_amount,currency,';
 if position(a in d)=0 then raise exception 'Review delivery discount snapshot columns.';end if;
 d:=replace(d,a,'subtotal_amount,discount_amount,delivery_discount_amount,coupon_code,total_amount,currency,');
 a:='(review->>''discountAmount'')::numeric,intent#>>''{order,coupon_code}''';
 if position(a in d)=0 then raise exception 'Review delivery discount snapshot values.';end if;
 execute replace(d,a,'(review->>''discountAmount'')::numeric,coalesce((review->>''deliveryDiscountAmount'')::numeric,0),intent#>>''{order,coupon_code}''');

 d:=pg_get_functiondef('private.guard_card_checkout_snapshot()'::regprocedure);
 a:='if new.card_checkout_verified is distinct from old.card_checkout_verified or';
 if position(a in d)=0 then raise exception 'Review immutable delivery discount guard.';end if;
 execute replace(d,a,a||E'\n  new.delivery_discount_amount is distinct from old.delivery_discount_amount or');
end $$;
notify pgrst,'reload schema';
commit;
