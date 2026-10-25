-- 92: ordinary card backorders, without manufactured warehouse/serial stock.
-- No publication, settings activation, provider call or historical order update.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

alter table public.site_settings
 add column backorder_fulfillment_message text not null default '' check(length(backorder_fulfillment_message)<=500),
 add column backorder_fulfillment_message_ar text not null default '' check(length(backorder_fulfillment_message_ar)<=500);
alter table public.customer_orders
 add column stock_fulfillment_state text not null default 'ready' check(stock_fulfillment_state in ('ready','awaiting_stock')),
 add column fulfillment_message text not null default '',
 add column backorder_accepted_at timestamptz;

-- The shared quote continues to validate publication, models and ERP ownership.
-- Only ordinary built-in CARD orders can defer physical allocation.
do $$ declare d text; anchor text; begin
 d:=pg_get_functiondef('private.checkout_review_before_cod(jsonb)'::regprocedure);
 anchor:='if available<quantity then raise exception ''checkout:unavailable'';end if;';
 if position(anchor in d)=0 then raise exception 'Review serialized availability guard.';end if;
 d:=replace(d,anchor,'if available<quantity and not (method=''card'' and settings.allow_out_of_stock_purchases) then raise exception ''checkout:unavailable'';end if;');
 execute d;
 d:=pg_get_functiondef('public.commerce_checkout_command(uuid,uuid,uuid,jsonb,jsonb)'::regprocedure);
 anchor:='case when intent#>>''{order,payment_method}'' in (''cash'',''card'') then false else settings.allow_out_of_stock_purchases end,p_cart_id';
 if position(anchor in d)=0 then raise exception 'Review checkout stock policy.';end if;
 execute replace(d,anchor,'case when intent#>>''{order,payment_method}''=''cash'' then false else settings.allow_out_of_stock_purchases end,p_cart_id');
end $$;

create or replace function private.checkout_review_before_pdc(p_intent jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare review jsonb:=private.checkout_review_before_cod(p_intent); settings public.site_settings%rowtype;
 product public.products%rowtype; line jsonb; available integer; balance integer; shipping jsonb;
 shortage boolean:=false; message text; method text:=p_intent#>>'{order,payment_method}';
begin
 if method not in ('cash','card') then return review;end if;
 if review->>'erpMode'<>'built_in' or (review->>'isPreorder')::boolean then
  raise exception 'Purchase requires built-in inventory.';end if;
 select * into settings from public.site_settings where key='default' for share;
 for line in select value from jsonb_array_elements(p_intent->'items') loop
  select * into product from public.products where id=(line->>'product_id')::uuid;
  if product.price<=0 then raise exception 'checkout:unavailable';end if;
  balance:=0;available:=0;
  if product.primary_warehouse_id is not null and exists(select 1 from public.commerce_warehouses
   where id=product.primary_warehouse_id and is_active for share) then
   select quantity into balance from public.commerce_warehouse_inventory
    where warehouse_id=product.primary_warehouse_id and product_id=product.id for share;
   available:=least(product.stock_quantity,coalesce(balance,0));
   if product.is_serialized then
    select least(available,count(*)::integer) into available from public.commerce_serialized_units
     where product_id=product.id and variant_id=(line->>'variant_id')::uuid
      and warehouse_id=product.primary_warehouse_id and status='in_stock';
    select least(available,stock_quantity) into available from public.product_variants where id=(line->>'variant_id')::uuid;
   end if;
  end if;
  if coalesce(available,0)<(line->>'quantity')::integer then shortage:=true;end if;
 end loop;
 if shortage and not (method='card' and settings.allow_out_of_stock_purchases) then raise exception 'checkout:stock';end if;
 if shortage then
  message:=case when p_intent#>>'{order,locale}'='ar' then nullif(btrim(settings.backorder_fulfillment_message_ar),'')
   else nullif(btrim(settings.backorder_fulfillment_message),'') end;
  if message is null then raise exception 'Backorder delivery information is unavailable.';end if;
 end if;
 shipping:=private.cod_shipping((p_intent#>>'{order,shipping_company_id}')::uuid,p_intent#>>'{order,governorate}');
 return review||jsonb_build_object('shipping',shipping,'shippingFee',(shipping->>'fee')::numeric,
  'totalAmount',(review->>'totalAmount')::numeric+(shipping->>'fee')::numeric,
  'requiredNow',(review->>'requiredNow')::numeric+(shipping->>'fee')::numeric,
  'allowOutOfStock',method='card' and settings.allow_out_of_stock_purchases,
  'stockFulfillmentState',case when shortage then 'awaiting_stock' else 'ready' end,
  'fulfillmentMessage',coalesce(message,''));
end $$;

alter function public.commerce_create_normal_customer_order(uuid,jsonb,jsonb,boolean,uuid)
 rename to commerce_create_normal_customer_order_before_backorders;
create function public.commerce_create_normal_customer_order(p_user_id uuid,p_order jsonb,p_items jsonb,p_allow_out_of_stock boolean,p_cart_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare review jsonb; intent jsonb; stored public.customer_orders%rowtype; line jsonb;
 product public.products%rowtype; variant public.product_variants%rowtype; quantity integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server access required.' using errcode='42501';end if;
 perform public.assert_built_in_erp();perform private.checkout_authorize(p_user_id);
 if p_cart_id is not null then
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||p_cart_id::text,0));
  select * into stored from public.customer_orders where user_id=p_user_id and checkout_cart_id=p_cart_id;
  if found then return jsonb_build_object('order',to_jsonb(stored),'created',false);end if;
 end if;
 -- Preserve all existing non-card contracts, including authorized manual flows.
 if p_order->>'payment_method' is distinct from 'card' or nullif(p_order->>'shipping_company_id','') is null then
  return public.commerce_create_normal_customer_order_before_backorders(p_user_id,p_order,p_items,p_allow_out_of_stock,p_cart_id);
 end if;
 perform private.cod_authorize(p_user_id);
 intent:=private.checkout_intent(p_order,p_items);review:=private.checkout_review(intent);
 if review->>'stockFulfillmentState'<>'awaiting_stock' then
  return public.commerce_create_normal_customer_order_before_backorders(p_user_id,p_order,p_items,false,p_cart_id);
 end if;
 if not coalesce(p_allow_out_of_stock,false) or (review->>'isPreorder')::boolean or p_order->>'coupon_code' is not null then
  raise exception 'Review this special order without a coupon.';end if;
 if p_order->>'backorder_accepted' is distinct from 'true' then raise exception 'Accept the special-order delivery terms.';end if;
 -- A mixed order waits as one parcel. No part claims a physical reservation.
 -- Existing stock is allocated atomically only when the full paid order is released.
 insert into public.customer_orders(user_id,checkout_cart_id,order_number,status,first_name,last_name,email,phone,
  street_address,city,governorate,shipping_method,shipping_company_id,payment_method,subtotal_amount,total_amount,currency,
  stock_fulfillment_state,fulfillment_message,backorder_accepted_at)
 values(p_user_id,p_cart_id,coalesce(nullif(btrim(p_order->>'order_number'),''),'ORD-'||replace(gen_random_uuid()::text,'-','')),
  'on_hold',btrim(p_order->>'first_name'),nullif(btrim(p_order->>'last_name'),''),nullif(btrim(p_order->>'email'),''),
  btrim(p_order->>'phone'),btrim(p_order->>'street_address'),btrim(p_order->>'city'),btrim(p_order->>'governorate'),
  'shipping',(p_order->>'shipping_company_id')::uuid,'card',(review->>'orderValue')::numeric,(review->>'orderValue')::numeric,'EGP',
  'awaiting_stock',review->>'fulfillmentMessage',clock_timestamp()) returning * into stored;
 for line in select value from jsonb_array_elements(intent->'items') loop
  select * into product from public.products where id=(line->>'product_id')::uuid;
  variant:=null;quantity:=(line->>'quantity')::integer;
  if product.is_serialized then select * into variant from public.product_variants where id=(line->>'variant_id')::uuid;end if;
  insert into public.customer_order_items(order_id,product_id,variant_id,product_title,product_slug,image_url,
   variant_name,variant_code,variant_sku,variant_color_name,variant_color_hex,unit_price,quantity,line_total)
  values(stored.id,product.id,variant.id,product.title,product.slug,product.image_url,variant.name,variant.code,variant.sku,
   variant.color_name,variant.color_hex,round(product.price,2),quantity,round(product.price,2)*quantity);
 end loop;
 if stored.total_amount<>(review->>'totalAmount')::numeric then raise exception 'checkout:quote';end if;
 return jsonb_build_object('order',to_jsonb(stored),'created',true,'serialized_units_assigned',0);
end $$;

-- Reuse the established paid-order allocator and named Orders permission.
do $$ declare d text; begin
 d:=pg_get_functiondef('public.commerce_release_preorder(uuid,uuid)'::regprocedure);
 if position('if not found or not v_order.is_preorder then' in d)=0
  or position('preorder_fulfillment_state=''ready''' in d)=0 then raise exception 'Review physical allocation contract.';end if;
 d:=replace(d,'public.commerce_release_preorder(','public.commerce_release_backorder(');
 d:=replace(d,'if not found or not v_order.is_preorder then','if not found or v_order.is_preorder or v_order.fulfillment_message='''' then');
 d:=replace(d,'if v_order.preorder_fulfillment_state = ''ready'' then return to_jsonb(v_order); end if;',
  'if v_order.stock_fulfillment_state=''ready'' then return to_jsonb(v_order);end if; perform public.assert_built_in_erp(); perform set_config(''app.backorder_stock_write'',''on'',true);');
 d:=replace(d,'preorder_fulfillment_state=''ready''','stock_fulfillment_state=''ready''');
 d:=replace(d,'Assigned on preorder release.','Assigned on special-order release.');
 -- Require a real active warehouse even for nonserialized lines.
 d:=replace(d,'if v_product.is_serialized then',
  'if v_product.primary_warehouse_id is null or not exists(select 1 from public.commerce_warehouses where id=v_product.primary_warehouse_id and is_active for share) then raise exception ''An active warehouse is required.'';end if;'||E'\n    if v_product.is_serialized then');
 execute d;
end $$;

create function private.guard_backorder_fulfillment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.stock_fulfillment_state is distinct from old.stock_fulfillment_state
  and current_setting('app.backorder_stock_write',true) is distinct from 'on' then raise exception 'Allocate physical stock before release.';end if;
 if new.stock_fulfillment_state='awaiting_stock' and new.status not in ('on_hold','cancelled','refunded') then
  raise exception 'This special order is awaiting physical stock.';end if;
 return new;
end $$;
create trigger customer_orders_backorder_guard before insert or update on public.customer_orders
 for each row execute function private.guard_backorder_fulfillment();

-- Apply the existing packing/shipping exclusion to ordinary backorders too.
do $$ declare name text;d text;anchor text;begin
 foreach name in array array['preorder_guard_packing','preorder_guard_shipping_job'] loop
  d:=pg_get_functiondef(('public.'||name||'()')::regprocedure);
  anchor:='orders.is_preorder'||E'\n      and orders.preorder_fulfillment_state <> ''ready''';
  if position(anchor in d)=0 then raise exception 'Review packing/shipping guard.';end if;
  execute replace(d,anchor,'((orders.is_preorder and orders.preorder_fulfillment_state <> ''ready'') or orders.stock_fulfillment_state=''awaiting_stock'')');
 end loop;
end $$;
revoke all on function public.commerce_create_normal_customer_order(uuid,jsonb,jsonb,boolean,uuid),public.commerce_release_backorder(uuid,uuid) from public,anon,authenticated;
grant execute on function public.commerce_create_normal_customer_order(uuid,jsonb,jsonb,boolean,uuid),public.commerce_release_backorder(uuid,uuid) to service_role;
revoke all on function private.guard_backorder_fulfillment() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
