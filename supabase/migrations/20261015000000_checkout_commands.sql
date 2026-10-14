-- 82: purchase-bound checkout, expiring reviews and retained reset tombstones.
begin;
set local lock_timeout='5s';
create table private.checkout_quotes (
 id uuid primary key default gen_random_uuid(), user_id uuid not null, cart_id uuid not null,
 intent_hash bytea not null check(octet_length(intent_hash)=32),
 review_hash bytea not null check(octet_length(review_hash)=32),
 expires_at timestamptz not null default clock_timestamp()+interval '5 minutes',
 retired_by_reset boolean not null default false
);
create index checkout_quotes_cart on private.checkout_quotes(user_id,cart_id);
create table private.checkout_commands (
 user_id uuid not null, command_id uuid not null, intent_hash bytea,
 quote_id uuid, order_id uuid not null unique, committed_at timestamptz not null default clock_timestamp(),
 retired_by_reset boolean not null default false, primary key(user_id,command_id),
 check(intent_hash is null or octet_length(intent_hash)=32)
);
create index checkout_commands_identity on private.checkout_commands(command_id);
alter table private.checkout_quotes enable row level security;
alter table private.checkout_commands enable row level security;
revoke all on private.checkout_quotes,private.checkout_commands from public,anon,authenticated,service_role;
-- Historical rows lack provable request content. Preserve only denial receipts.
insert into private.checkout_commands(user_id,command_id,order_id)
 select user_id,checkout_cart_id,id from public.customer_orders where checkout_cart_id is not null;

create function private.checkout_intent(p_order jsonb,p_items jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare lines jsonb; item jsonb;
begin
 if jsonb_typeof(p_order) is distinct from 'object' or jsonb_typeof(p_items) is distinct from 'array'
  or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'checkout:conflict';end if;
 for item in select value from jsonb_array_elements(p_items) loop
  if (item->>'product_id')::uuid is null or (item->>'quantity') is null or (item->>'quantity')::numeric not between 1 and 99
   or (item->>'quantity')::numeric<>trunc((item->>'quantity')::numeric) then raise exception 'checkout:conflict';end if;
 end loop;
 select jsonb_agg(jsonb_build_object('product_id',product,'variant_id',variant,'quantity',quantity) order by product,variant)
 into lines from (select (value->>'product_id')::uuid product,nullif(value->>'variant_id','')::uuid variant,
  sum((value->>'quantity')::integer) quantity from jsonb_array_elements(p_items) group by 1,2) grouped;
 if exists(select 1 from jsonb_array_elements(lines) where (value->>'quantity')::integer>99) then raise exception 'checkout:conflict';end if;
 return jsonb_build_object('items',lines,'order',jsonb_build_object(
  'first_name',btrim(coalesce(p_order->>'first_name','')),'last_name',btrim(coalesce(p_order->>'last_name','')),
  'email',btrim(coalesce(p_order->>'email','')),'phone',btrim(coalesce(p_order->>'phone','')),
  'street_address',btrim(coalesce(p_order->>'street_address','')),'city',btrim(coalesce(p_order->>'city','')),
  'governorate',btrim(coalesce(p_order->>'governorate','')),
  'shipping_method',btrim(coalesce(p_order->>'shipping_method','shipping')),
  'payment_method',lower(btrim(coalesce(p_order->>'payment_method',''))),
  'coupon_code',upper(nullif(btrim(p_order->>'coupon_code'),'')), 'locale',coalesce(p_order->>'locale','en')));
end $$;

create function private.checkout_authorize(p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare profile public.customer_profiles%rowtype;
begin
 perform pg_advisory_xact_lock_shared(hashtextextended('elcomputer-system-reset',0));
 if auth.role() is distinct from 'service_role' then raise exception 'checkout:permission' using errcode='42501';end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'checkout:conflict';end if;
 select * into profile from public.customer_profiles where id=p_user_id for share;
 if not found or not profile.is_active or not exists(select 1 from auth.users where id=p_user_id and not coalesce(is_anonymous,false)) then
  raise exception 'checkout:permission' using errcode='42501';end if;
end $$;

-- Review the same trusted prices/terms as the established normal/preorder paths.
-- Locks remain held through command creation; downstream allocation revalidates
-- physical stock, warehouse balances, preorder caps and ERP reservations.
create function private.checkout_review(p_intent jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare settings public.site_settings%rowtype; product public.products%rowtype; variant public.product_variants%rowtype;
 coupon public.site_coupons%rowtype; line jsonb; lines jsonb:='[]'; mode text; method text:=p_intent#>>'{order,payment_method}';
 subtotal numeric:=0; due numeric:=0; discount numeric:=0; fee numeric; line_value numeric; line_due numeric;
 quantity integer; available integer; v_code text:=p_intent#>>'{order,coupon_code}'; erp text;
begin
 select * into settings from public.site_settings where key='default' for share;
 if not found or not coalesce((to_jsonb(settings)->>('payment_'||method||'_enabled'))::boolean,false) then
  raise exception 'The selected payment method is not available.';end if;
 if p_intent#>>'{order,shipping_method}'<>'shipping' then raise exception 'Choose an available delivery method.';end if;
 fee:=round(coalesce((to_jsonb(settings)->>('payment_'||method||'_fee'))::numeric,0),2);
 erp:=public.get_active_erp_mode();
 for line in select value from jsonb_array_elements(p_intent->'items') order by value->>'product_id',value->>'variant_id' loop
  select * into product from public.products where id=(line->>'product_id')::uuid for update;
  if not found or not product.is_published or product.selling_mode='coming_soon' then raise exception 'checkout:unavailable';end if;
  if mode is not null and mode<>product.selling_mode then raise exception 'Place preorder and ready-to-ship products in separate orders.';end if;
  mode:=product.selling_mode;quantity:=(line->>'quantity')::integer;
  variant:=null;
  if product.is_serialized then
   select * into variant from public.product_variants where id=(line->>'variant_id')::uuid and product_id=product.id and is_active for update;
   if not found then raise exception 'checkout:unavailable';end if;
  elsif line->>'variant_id' is not null then raise exception 'checkout:unavailable';end if;
  if mode='preorder' then
   if not product.preorder_active or product.preorder_starts_at>clock_timestamp() or product.preorder_ends_at<=clock_timestamp()
    or product.preorder_customer_limit<quantity then raise exception 'checkout:unavailable';end if;
  elsif erp='daftra' then
   if (product.is_serialized or not settings.allow_out_of_stock_purchases) and public.erp_storefront_stock(
    case when product.is_serialized then 'product_variant' else 'product' end,
    coalesce(variant.id,product.id),0)<quantity then raise exception 'checkout:unavailable';end if;
  elsif erp='built_in' then
   if product.is_serialized then
    select count(*) into available from public.commerce_serialized_units where product_id=product.id and variant_id=variant.id
     and warehouse_id=product.primary_warehouse_id and status='in_stock';
    if available<quantity then raise exception 'checkout:unavailable';end if;
   elsif not settings.allow_out_of_stock_purchases and product.stock_quantity<quantity then raise exception 'checkout:unavailable';end if;
  end if;
  line_value:=round(product.price,2)*quantity;
  line_due:=case when mode='preorder' and product.preorder_payment_mode='deposit' then round(line_value*product.preorder_deposit_percent/100,2) else line_value end;
  subtotal:=subtotal+line_value;due:=due+line_due;
  lines:=lines||jsonb_build_array(jsonb_build_object('productId',product.id,'variantId',variant.id,
   'title',product.title,'variantName',variant.name,'quantity',quantity,'total',line_value,'due',line_due,'remaining',line_value-line_due,
   'paymentMode',case when mode='preorder' then product.preorder_payment_mode else 'full' end,
   'depositPercent',case when mode='preorder' then product.preorder_deposit_percent else null end,
   'expectedAvailabilityDate',case when mode='preorder' then product.expected_availability_date else null end,
   'availabilityMessage',case when mode='preorder' then product.availability_message else null end));
 end loop;
 if mode='preorder' and (v_code is not null or method not in ('bank_transfer','instapay')) then raise exception 'Preorders use bank transfer or InstaPay without coupons.';end if;
 if v_code is not null then
  select * into coupon from public.site_coupons where upper(site_coupons.code)=v_code for update;
  if not found or not coupon.is_active or coupon.starts_at>clock_timestamp() or coupon.ends_at<clock_timestamp()
   or subtotal<coupon.minimum_order_amount or coupon.usage_count>=coupon.usage_limit then raise exception 'checkout:coupon';end if;
  discount:=least(subtotal,case when coupon.discount_type='percentage' then round(subtotal*coupon.discount_value/100,2) else round(coupon.discount_value,2) end);
 end if;
 return jsonb_build_object('isPreorder',mode='preorder','orderValue',subtotal,'discountAmount',discount,'paymentFee',fee,
  'totalAmount',subtotal-discount+fee,'requiredNow',due-discount+fee,'remainingAfterPayment',subtotal-due,'lines',lines,
  'erpMode',erp,'allowOutOfStock',settings.allow_out_of_stock_purchases);
end $$;

create function public.commerce_checkout_quote(p_user_id uuid,p_cart_id uuid,p_order jsonb,p_items jsonb) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare intent jsonb; review jsonb; quote private.checkout_quotes%rowtype;
begin
 perform private.checkout_authorize(p_user_id);
 if p_cart_id is null then raise exception 'checkout:conflict';end if;
 perform pg_advisory_xact_lock(hashtextextended('checkout-command:'||p_cart_id::text,0));
 intent:=private.checkout_intent(p_order,p_items);review:=private.checkout_review(intent);
 insert into private.checkout_quotes(user_id,cart_id,intent_hash,review_hash) values(p_user_id,p_cart_id,
  sha256(convert_to(intent::text,'UTF8')),sha256(convert_to(review::text,'UTF8'))) returning * into quote;
 return review||jsonb_build_object('quoteId',quote.id,'expiresAt',quote.expires_at);
end $$;

create function public.commerce_checkout_command(p_user_id uuid,p_cart_id uuid,p_quote_id uuid,p_order jsonb,p_items jsonb) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare intent jsonb; fingerprint bytea; receipt private.checkout_commands%rowtype; quote private.checkout_quotes%rowtype;
 review jsonb; result jsonb; stored public.customer_orders%rowtype; settings public.site_settings%rowtype;
begin
 perform private.checkout_authorize(p_user_id);
 if p_cart_id is null or p_quote_id is null then raise exception 'checkout:quote';end if;
 intent:=private.checkout_intent(p_order,p_items);fingerprint:=sha256(convert_to(intent::text,'UTF8'));
 perform pg_advisory_xact_lock(hashtextextended('checkout-command:'||p_cart_id::text,0));
 if exists(select 1 from private.checkout_commands where command_id=p_cart_id and user_id<>p_user_id) then raise exception 'checkout:conflict';end if;
 select * into receipt from private.checkout_commands where user_id=p_user_id and command_id=p_cart_id;
 if found then
  if receipt.retired_by_reset then raise exception 'checkout:retired';end if;
  if receipt.intent_hash is null then raise exception 'checkout:legacy';end if;
  if receipt.intent_hash<>fingerprint or receipt.quote_id<>p_quote_id then raise exception 'checkout:conflict';end if;
  select * into stored from public.customer_orders where id=receipt.order_id and user_id=p_user_id;
  if not found then raise exception 'checkout:retired';end if;
  return jsonb_build_object('order',to_jsonb(stored),'created',false);
 end if;
 if exists(select 1 from public.customer_orders where user_id=p_user_id and checkout_cart_id=p_cart_id) then raise exception 'checkout:legacy';end if;
 select * into quote from private.checkout_quotes where id=p_quote_id;
 if not found or quote.user_id<>p_user_id or quote.cart_id<>p_cart_id or quote.intent_hash<>fingerprint
  or quote.retired_by_reset or quote.expires_at<=clock_timestamp() then raise exception 'checkout:quote';end if;
 review:=private.checkout_review(intent);
 if quote.review_hash<>sha256(convert_to(review::text,'UTF8')) then raise exception 'checkout:quote';end if;
 if nullif(intent#>>'{order,first_name}','') is null or nullif(intent#>>'{order,street_address}','') is null
  or nullif(intent#>>'{order,city}','') is null or nullif(intent#>>'{order,governorate}','') is null
  or nullif(intent#>>'{order,email}','') is null or intent#>>'{order,phone}' !~ '^01[0-9]{9}$' then raise exception 'Complete your delivery details.';end if;
 select * into settings from public.site_settings where key='default';
 if (review->>'isPreorder')::boolean then
  result:=public.commerce_create_preorder(p_user_id,p_order,intent->'items',p_cart_id);
 else
  result:=public.commerce_create_customer_order(p_user_id,p_order,intent->'items',settings.allow_out_of_stock_purchases,p_cart_id);
 end if;
 if result->>'created' is distinct from 'true' then raise exception 'checkout:legacy';end if;
 if (result#>>'{order,total_amount}')::numeric<>(review->>'totalAmount')::numeric then raise exception 'checkout:quote';end if;
 insert into private.checkout_commands(user_id,command_id,intent_hash,quote_id,order_id)
  values(p_user_id,p_cart_id,fingerprint,p_quote_id,(result#>>'{order,id}')::uuid);
 return result;
end $$;
revoke all on function private.checkout_intent(jsonb,jsonb),private.checkout_authorize(uuid),private.checkout_review(jsonb),
 public.commerce_checkout_quote(uuid,uuid,jsonb,jsonb),public.commerce_checkout_command(uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.commerce_checkout_quote(uuid,uuid,jsonb,jsonb),public.commerce_checkout_command(uuid,uuid,uuid,jsonb,jsonb) to service_role;
-- Close every old bypass while keeping the established routines callable by
-- the definer and preserving their grants for unrelated staff operations.
do $$ declare routine record;begin
 for routine in select oid from pg_proc where pronamespace='public'::regnamespace and
  (proname like 'commerce_create%customer_order%' or proname like 'commerce_create_preorder%' or proname='erp_create_external_customer_order') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',routine.oid::regprocedure);
 end loop;
end $$;

do $guard$ declare definition text;anchor text;begin
 definition:=pg_get_functiondef('catalog_private.reset_assert_coverage()'::regprocedure);
 anchor:='array[''installation_bootstrap'',''salary_payment_commands'']';
 if position(anchor in definition)=0 then raise exception 'Review checkout receipt reset coverage.';end if;
 execute replace(definition,anchor,'array[''installation_bootstrap'',''salary_payment_commands'',''checkout_quotes'',''checkout_commands'']');
 definition:=pg_get_functiondef('catalog_private.reset_manifest()'::regprocedure);
 anchor:=' if new.scope=''media'' then';
 if position(anchor in definition)=0 then raise exception 'Review checkout receipt reset exclusion.';end if;
 execute replace(definition,anchor,E' if new.scope in (''products'',''orders'',''commerce'',''content'',''full'') then\n  update private.checkout_quotes set retired_by_reset=true where not retired_by_reset;\n end if;\n if new.scope in (''orders'',''commerce'',''full'') then\n  update private.checkout_commands set retired_by_reset=true where not retired_by_reset;\n end if;\n'||anchor);
end $guard$;
notify pgrst,'reload schema';
commit;
