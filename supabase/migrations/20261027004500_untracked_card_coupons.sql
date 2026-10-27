-- Additive coupon correction for normal untracked CARD sales.
-- Existing orders, backorder/preorder restrictions and physical stock stay intact.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$ declare d text; a text; begin
 d:=pg_get_functiondef('public.commerce_create_normal_customer_order(uuid,jsonb,jsonb,boolean,uuid)'::regprocedure);
 a:='if (review->>''stockFulfillmentState''=''awaiting_stock'' and not coalesce(p_allow_out_of_stock,false)) or (review->>''isPreorder'')::boolean or p_order->>''coupon_code'' is not null then';
 if position(a in d)=0 then raise exception 'Review normal coupon boundary.';end if;
 d:=replace(d,a,'if (review->>''stockFulfillmentState''=''awaiting_stock'' and (not coalesce(p_allow_out_of_stock,false) or p_order->>''coupon_code'' is not null)) or (review->>''isPreorder'')::boolean then');
 a:='payment_method,subtotal_amount,total_amount,currency,';
 if position(a in d)=0 then raise exception 'Review financial snapshot columns.';end if;
 d:=replace(d,a,'payment_method,subtotal_amount,discount_amount,coupon_code,total_amount,currency,');
 a:='''card'',(review->>''orderValue'')::numeric,(review->>''orderValue'')::numeric,''EGP'',';
 if position(a in d)=0 then raise exception 'Review financial snapshot amounts.';end if;
 d:=replace(d,a,'''card'',(review->>''orderValue'')::numeric,(review->>''discountAmount'')::numeric,intent#>>''{order,coupon_code}'',(review->>''orderValue'')::numeric-(review->>''discountAmount'')::numeric,''EGP'',');
 a:='if stored.total_amount<>(review->>''totalAmount'')::numeric then raise exception ''checkout:quote'';end if;';
 if position(a in d)=0 then raise exception 'Review coupon consumption boundary.';end if;
 execute replace(d,a,a||$patch$
 if intent#>>'{order,coupon_code}' is not null then
  if review->>'stockFulfillmentState'<>'untracked'
   or (select count(*) from public.site_coupons where upper(code)=intent#>>'{order,coupon_code}')<>1 then
   raise exception 'checkout:coupon';end if;
  -- The shared commercial review locked/revalidated this row. The durable cart
  -- receipt and existing-order return prevent repeated or concurrent consumption.
  update public.site_coupons set usage_count=usage_count+1,updated_at=clock_timestamp()
   where upper(code)=intent#>>'{order,coupon_code}';
  if not found then raise exception 'checkout:coupon';end if;
 end if;
 $patch$);
end $$;
notify pgrst,'reload schema';
commit;
