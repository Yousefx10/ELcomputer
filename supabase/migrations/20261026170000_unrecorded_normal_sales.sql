-- 95: opt-in normal CARD sales without recorded inventory.
-- Existing orders, balances, permissions, provider gates and defaults are retained.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

alter table public.site_settings add column inventory_tracking_required boolean not null default true;
alter table public.customer_orders drop constraint customer_orders_stock_fulfillment_state_check;
alter table public.customer_orders add constraint customer_orders_stock_fulfillment_state_check
 check(stock_fulfillment_state in ('ready','awaiting_stock','untracked'));

-- Use the existing commercial review: ownership, publication, model, price,
-- method and ERP checks still run. Only the built-in CARD quantity gate changes.
do $$ declare d text; a text; begin
 d:=pg_get_functiondef('private.checkout_review_before_cod(jsonb)'::regprocedure);
 a:='if available<quantity and not (method=''card'' and settings.allow_out_of_stock_purchases) then';
 if position(a in d)=0 then raise exception 'Review serialized stock contract.';end if;
 d:=replace(d,a,'if available<quantity and not (method=''card'' and (settings.allow_out_of_stock_purchases or not settings.inventory_tracking_required)) then');
 a:='elsif not settings.allow_out_of_stock_purchases and product.stock_quantity<quantity then';
 if position(a in d)=0 then raise exception 'Review ordinary stock contract.';end if;
 execute replace(d,a,'elsif not settings.allow_out_of_stock_purchases and not (method=''card'' and not settings.inventory_tracking_required) and product.stock_quantity<quantity then');

 d:=pg_get_functiondef('private.checkout_review_before_pdc(jsonb)'::regprocedure);
 a:='for line in select value from jsonb_array_elements(p_intent->''items'') loop';
 if position(a in d)=0 then raise exception 'Review delivery quote contract.';end if;
 execute replace(d,a,$patch$
 if method='card' and not settings.inventory_tracking_required then
  message:=case when p_intent#>>'{order,locale}'='ar' then nullif(btrim(settings.backorder_fulfillment_message_ar),'')
   else nullif(btrim(settings.backorder_fulfillment_message),'') end;
  if message is null then raise exception 'Delivery information is unavailable.';end if;
  for line in select value from jsonb_array_elements(p_intent->'items') loop
   if not exists(select 1 from public.products where id=(line->>'product_id')::uuid and price>0) then
    raise exception 'checkout:unavailable';end if;
  end loop;
  shipping:=private.cod_shipping((p_intent#>>'{order,shipping_company_id}')::uuid,p_intent#>>'{order,governorate}');
  return review||jsonb_build_object('shipping',shipping,'shippingFee',(shipping->>'fee')::numeric,
   'totalAmount',(review->>'totalAmount')::numeric+(shipping->>'fee')::numeric,
   'requiredNow',(review->>'requiredNow')::numeric+(shipping->>'fee')::numeric,
   'allowOutOfStock',true,'stockFulfillmentState','untracked','fulfillmentMessage',message);
 end if;
 for line in select value from jsonb_array_elements(p_intent->'items') loop
 $patch$);

 -- Reuse the existing receipt/row-lock transaction and no-allocation insert.
 d:=pg_get_functiondef('public.commerce_create_normal_customer_order(uuid,jsonb,jsonb,boolean,uuid)'::regprocedure);
 a:='if review->>''stockFulfillmentState''<>''awaiting_stock'' then';
 if position(a in d)=0 then raise exception 'Review allocation decision.';end if;
 d:=replace(d,a,'if review->>''stockFulfillmentState'' not in (''awaiting_stock'',''untracked'') then');
 a:='if not coalesce(p_allow_out_of_stock,false) or (review->>''isPreorder'')::boolean or p_order->>''coupon_code'' is not null then';
 if position(a in d)=0 then raise exception 'Review ordinary order boundary.';end if;
 d:=replace(d,a,'if (review->>''stockFulfillmentState''=''awaiting_stock'' and not coalesce(p_allow_out_of_stock,false)) or (review->>''isPreorder'')::boolean or p_order->>''coupon_code'' is not null then');
 a:='if p_order->>''backorder_accepted'' is distinct from ''true'' then';
 if position(a in d)=0 then raise exception 'Review special-order consent.';end if;
 d:=replace(d,a,'if review->>''stockFulfillmentState''=''awaiting_stock'' and p_order->>''backorder_accepted'' is distinct from ''true'' then');
 a:='''on_hold'',btrim(p_order->>''first_name'')';
 if position(a in d)=0 then raise exception 'Review unpaid status.';end if;
 d:=replace(d,a,'case when review->>''stockFulfillmentState''=''untracked'' then ''pending_payment'' else ''on_hold'' end,btrim(p_order->>''first_name'')');
 a:='''awaiting_stock'',review->>''fulfillmentMessage'',clock_timestamp())';
 if position(a in d)=0 then raise exception 'Review fulfillment snapshot.';end if;
 execute replace(d,a,'review->>''stockFulfillmentState'',review->>''fulfillmentMessage'',case when review->>''stockFulfillmentState''=''awaiting_stock'' then clock_timestamp() end)');

 -- Never allocate units later to an order explicitly sold without tracking.
 d:=pg_get_functiondef('public.commerce_release_backorder(uuid,uuid)'::regprocedure);
 a:='if v_order.stock_fulfillment_state=''ready'' then return to_jsonb(v_order);end if;';
 if position(a in d)=0 then raise exception 'Review release contract.';end if;
 execute replace(d,a,'if v_order.stock_fulfillment_state in (''ready'',''untracked'') then return to_jsonb(v_order);end if;');

 -- Paid untracked orders still require a matching product/model SKU for every
 -- requested item, the named operator, active session and validated private video.
 -- Tracked orders retain exact assigned-unit scans, locks and authorization.
 d:=pg_get_functiondef('public.validate_order_packing_scan()'::regprocedure);
 a:='elsif v_item_is_serialized then';
 if position(a in d)=0 then raise exception 'Review exact-unit scan guard.';end if;
 execute replace(d,a,'elsif v_item_is_serialized and not exists(select 1 from public.customer_orders where id=v_session.order_id and stock_fulfillment_state=''untracked'') then');
 d:=pg_get_functiondef('public.complete_order_packing_session(uuid,uuid,text,text,text,text)'::regprocedure);
 a:='where order_items.order_id = v_order.id'||E'\n      and ('||E'\n        order_items.variant_id is not null';
 if position(a in d)=0 then raise exception 'Review packing completion contract.';end if;
 execute replace(d,a,'where order_items.order_id = v_order.id and v_order.stock_fulfillment_state <> ''untracked'''||E'\n      and ('||E'\n        order_items.variant_id is not null');
end $$;

-- The mode is frozen on the order and cannot be obtained by changing a profile,
-- passing a client flag, toggling settings after checkout, or relabeling old orders.
create or replace function private.guard_backorder_fulfillment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.stock_fulfillment_state is distinct from old.stock_fulfillment_state
  and current_setting('app.backorder_stock_write',true) is distinct from 'on' then raise exception 'Allocate physical stock before release.';end if;
 if new.stock_fulfillment_state='awaiting_stock' and new.status not in ('on_hold','cancelled','refunded') then
  raise exception 'This special order is awaiting physical stock.';end if;
 if new.stock_fulfillment_state='untracked' then
  if new.is_preorder or new.payment_method<>'card' then raise exception 'Untracked sales require a normal card order.';end if;
  if tg_op='INSERT' and not exists(select 1 from public.site_settings where key='default' and not inventory_tracking_required) then
   raise exception 'Untracked sales are disabled.';end if;
 end if;
 return new;
end $$;

notify pgrst,'reload schema';
commit;
