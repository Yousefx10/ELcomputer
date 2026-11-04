-- Physical ledger position is bound at release time. No settings activation.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create table private.customer_carts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 cart_id uuid not null default gen_random_uuid(), revision uuid not null default gen_random_uuid(),
 version bigint not null default 0, items jsonb not null default '[]', coupon_code text,
 updated_at timestamptz not null default clock_timestamp(),
 check(jsonb_typeof(items)='array' and jsonb_array_length(items)<=100)
);
create table private.customer_cart_receipts (
 user_id uuid not null references auth.users(id) on delete cascade, command_id uuid not null,
 intent_hash bytea not null, applied_version bigint not null, skipped integer not null default 0, created_at timestamptz not null default clock_timestamp(),
 primary key(user_id,command_id)
);
alter table private.customer_carts enable row level security;
alter table private.customer_cart_receipts enable row level security;
revoke all on private.customer_carts,private.customer_cart_receipts from public,anon,authenticated,service_role;

create function private.customer_cart_projection(p_user uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c private.customer_carts; result jsonb:='[]'; line jsonb; p public.storefront_products; v public.product_variants;
 settings public.site_settings; eligible boolean; price numeric;
begin
 select * into c from private.customer_carts where user_id=p_user;
 select * into settings from public.site_settings where key='default';
 for line in select value from jsonb_array_elements(coalesce(c.items,'[]')) loop
  select * into p from public.storefront_products where id=(line->>'id')::uuid and is_published;
  v:=null;
  if line->>'variant_id' is not null then select * into v from public.product_variants where id=(line->>'variant_id')::uuid and product_id=p.id and is_active;end if;
  eligible:=p.id is not null and p.selling_mode<>'coming_soon'
   and (not p.is_serialized and line->>'variant_id' is null or p.is_serialized and v.id is not null);
  if p.selling_mode='preorder' then
   eligible:=eligible and p.preorder_active and (p.preorder_starts_at is null or p.preorder_starts_at<=clock_timestamp())
    and (p.preorder_ends_at is null or p.preorder_ends_at>clock_timestamp())
    and (p.preorder_customer_limit is null or p.preorder_customer_limit>=(line->>'quantity')::int);
  elsif settings.inventory_tracking_required and not settings.allow_out_of_stock_purchases then
   eligible:=eligible and coalesce(v.stock_quantity,p.stock_quantity,0)>=(line->>'quantity')::int;
  end if;
  price:=coalesce(v.sale_price,p.price);
  result:=result||jsonb_build_array(line||jsonb_build_object('eligible',coalesce(eligible,false),
   'title',coalesce(p.title,'Unavailable product'),'slug',p.slug,'image_url',p.image_url,
   'price',coalesce(price,0),'old_price',p.old_price,'stock_quantity',coalesce(v.stock_quantity,p.stock_quantity,0),
   'is_serialized',p.is_serialized,'selling_mode',p.selling_mode,'variant_name',v.name,'variant_sku',v.sku,
   'variant_code',v.code,'variant_options',coalesce(v.option_values,'{}'),
   'allow_out_of_stock_purchases',not settings.inventory_tracking_required or settings.allow_out_of_stock_purchases,
   'preorder_payment_mode',p.preorder_payment_mode,'preorder_deposit_percent',p.preorder_deposit_percent,
   'preorder_customer_limit',p.preorder_customer_limit,'expected_availability_date',p.expected_availability_date,
   'availability_message',p.availability_message));
 end loop;
 return jsonb_build_object('id',c.cart_id,'revision',c.revision,'version',coalesce(c.version,0),
  'items',result,'coupon',case when c.coupon_code is null then null else jsonb_build_object('code',c.coupon_code) end);
end $$;

create function public.commerce_customer_cart(p_user_id uuid,p_command_id uuid default null,p_expected_version bigint default null,p_body jsonb default null) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare c private.customer_carts; receipt private.customer_cart_receipts; proposed jsonb:='[]'; line jsonb; old_line jsonb;
 fp bytea; action text:=p_body->>'action'; mixed integer; validated jsonb; coupon text; skipped integer:=0; merge_mode text;
begin
 perform private.checkout_authorize(p_user_id);
 if p_command_id is null then
  if p_body is not null then raise exception 'cart:invalid';end if;
  return jsonb_build_object('cart',private.customer_cart_projection(p_user_id));
 end if;
 if jsonb_typeof(p_body) is distinct from 'object' or action is null or action not in ('replace','merge')
  or exists(select 1 from jsonb_object_keys(p_body) k where k not in ('action','items','coupon_code','cart_id'))
  or jsonb_typeof(p_body->'items') is distinct from 'array' or jsonb_array_length(p_body->'items')>100
  or p_expected_version is null or p_expected_version<0 then raise exception 'cart:invalid';end if;
 fp:=sha256(convert_to(jsonb_build_object('body',p_body,'version',p_expected_version)::text,'UTF8'));
 perform pg_advisory_xact_lock(hashtextextended('customer-cart:'||p_user_id::text,0));
 select * into receipt from private.customer_cart_receipts where user_id=p_user_id and command_id=p_command_id;
 if found then
  if receipt.intent_hash<>fp then raise exception 'cart:command_conflict';end if;
  return jsonb_build_object('applied',true,'appliedVersion',receipt.applied_version,'replayed',true,'skipped',receipt.skipped,'cart',private.customer_cart_projection(p_user_id));
 end if;
 insert into private.customer_carts(user_id) values(p_user_id) on conflict do nothing;
 select * into c from private.customer_carts where user_id=p_user_id for update;
 if action='replace' and c.version<>p_expected_version then
  return jsonb_build_object('applied',false,'conflict',true,'cart',private.customer_cart_projection(p_user_id));
 end if;
 for line in select value from jsonb_array_elements(p_body->'items') loop
  if jsonb_typeof(line) is distinct from 'object'
   or exists(select 1 from jsonb_object_keys(line) k where k not in ('id','variant_id','quantity','cart_line_id'))
   or (line->>'id')::uuid is null or (line->>'cart_line_id')::uuid is null or jsonb_typeof(line->'quantity') is distinct from 'number'
   or (line->>'quantity')::numeric not between 1 and 99 or (line->>'quantity')::numeric<>trunc((line->>'quantity')::numeric)
   or exists(select 1 from jsonb_array_elements(proposed) i where i->>'cart_line_id'=line->>'cart_line_id'
    or i->>'id'=line->>'id' and coalesce(i->>'variant_id','')=coalesce(line->>'variant_id','')) then raise exception 'cart:invalid';end if;
  perform nullif(line->>'variant_id','')::uuid;
  proposed:=proposed||jsonb_build_array(jsonb_build_object('id',(line->>'id')::uuid,'variant_id',nullif(line->>'variant_id','')::uuid,
   'quantity',(line->>'quantity')::int,'cart_line_id',(line->>'cart_line_id')::uuid));
 end loop;
 if action='merge' then
  -- Maximum quantity per SKU. Repeated guest logins never add quantities again.
  for old_line in select value from jsonb_array_elements(c.items) loop
   select value into line from jsonb_array_elements(proposed) where value->>'id'=old_line->>'id' and coalesce(value->>'variant_id','')=coalesce(old_line->>'variant_id','');
   if found then
    select coalesce(jsonb_agg(case when value=line then old_line||jsonb_build_object('quantity',greatest((line->>'quantity')::int,(old_line->>'quantity')::int)) else value end),'[]') into proposed from jsonb_array_elements(proposed);
   else proposed:=proposed||jsonb_build_array(old_line);end if;
  end loop;
 end if;
 if jsonb_array_length(proposed)>100 then raise exception 'cart:limit';end if;
 -- Project using current catalog data. New/increased unavailable lines fail;
 -- existing unavailable lines remain visible so the customer can remove them.
 update private.customer_carts set items=proposed where user_id=p_user_id;
 validated:=private.customer_cart_projection(p_user_id);
 for line in select value from jsonb_array_elements(validated->'items') loop
  if not (line->>'eligible')::boolean and not exists(select 1 from jsonb_array_elements(c.items) old
    where old->>'id'=line->>'id' and coalesce(old->>'variant_id','')=coalesce(line->>'variant_id','')
     and (old->>'quantity')::int>=(line->>'quantity')::int) then
    if action<>'merge' then raise exception 'cart:unavailable';end if;
    select coalesce(jsonb_agg(value),'[]') into proposed from jsonb_array_elements(proposed) where value->>'cart_line_id'<>line->>'cart_line_id';
    select value into old_line from jsonb_array_elements(c.items) where value->>'id'=line->>'id' and coalesce(value->>'variant_id','')=coalesce(line->>'variant_id','');
    if found then proposed:=proposed||jsonb_build_array(old_line);end if;
    skipped:=skipped+1;
   end if;
 end loop;
 if action='merge' then
  select value->>'selling_mode' into merge_mode from jsonb_array_elements(validated->'items') value
   where exists(select 1 from jsonb_array_elements(c.items) old where old->>'cart_line_id'=value->>'cart_line_id') order by value->>'id' limit 1;
  if merge_mode is null then select value->>'selling_mode' into merge_mode from jsonb_array_elements(validated->'items') where (value->>'eligible')::boolean order by value->>'id' limit 1;end if;
  for line in select value from jsonb_array_elements(validated->'items') where (value->>'eligible')::boolean and value->>'selling_mode'<>merge_mode loop
   select coalesce(jsonb_agg(value),'[]') into proposed from jsonb_array_elements(proposed) where value->>'cart_line_id'<>line->>'cart_line_id';skipped:=skipped+1;
  end loop;
  update private.customer_carts set items=proposed where user_id=p_user_id;
  validated:=private.customer_cart_projection(p_user_id);
 end if;
 select count(distinct value->>'selling_mode') into mixed from jsonb_array_elements(validated->'items') where (value->>'eligible')::boolean;
 if mixed>1 then raise exception 'cart:mixed';end if;
 coupon:=case when action='merge' then c.coupon_code else upper(nullif(btrim(p_body->>'coupon_code'),'')) end;
 if length(coupon)>64 or coupon~'[[:cntrl:]]' then raise exception 'cart:invalid';end if;
 update private.customer_carts set version=version+1,revision=gen_random_uuid(),coupon_code=coupon,
  cart_id=coalesce(nullif(p_body->>'cart_id','')::uuid,case when c.items<>'[]' and proposed='[]' then gen_random_uuid() else cart_id end),updated_at=clock_timestamp() where user_id=p_user_id returning * into c;
 insert into private.customer_cart_receipts(user_id,command_id,intent_hash,applied_version,skipped) values(p_user_id,p_command_id,fp,c.version,skipped);
 return jsonb_build_object('applied',true,'appliedVersion',c.version,'skipped',skipped,'cart',private.customer_cart_projection(p_user_id));
end $$;
revoke all on function private.customer_cart_projection(uuid),public.commerce_customer_cart(uuid,uuid,bigint,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.commerce_customer_cart(uuid,uuid,bigint,jsonb) to service_role;
create function public.commerce_complete_customer_cart(p_user_id uuid,p_session_id uuid) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare s private.payment_checkout_sessions; c private.customer_carts; purchased jsonb; fp bytea;
begin
 perform private.checkout_authorize(p_user_id);
 select * into s from private.payment_checkout_sessions where id=p_session_id and user_id=p_user_id;
 if not found or s.state<>'paid' or s.order_id is null or not exists(select 1 from public.customer_orders
   where id=s.order_id and user_id=p_user_id and payment_status='paid') then raise exception 'cart:unverified';end if;
 perform pg_advisory_xact_lock(hashtextextended('customer-cart:'||p_user_id::text,0));
 fp:=sha256(convert_to('verified-purchase:'||s.id::text,'UTF8'));
 if exists(select 1 from private.customer_cart_receipts where user_id=p_user_id and command_id=s.id) then
  if not exists(select 1 from private.customer_cart_receipts where user_id=p_user_id and command_id=s.id and intent_hash=fp) then raise exception 'cart:command_conflict';end if;
  return jsonb_build_object('cart',private.customer_cart_projection(p_user_id));
 end if;
 select * into c from private.customer_carts where user_id=p_user_id for update;
 if not found then return jsonb_build_object('cart',private.customer_cart_projection(p_user_id));end if;
 select coalesce(jsonb_agg(item||jsonb_build_object('quantity',remaining)),'[]') into purchased from (
  select item,greatest(0,(item->>'quantity')::int-coalesce((line->>'quantity')::int,0)) remaining
  from jsonb_array_elements(c.items) item left join lateral (
   select value line from jsonb_array_elements(coalesce(s.snapshot->'cart_lines','[]'))
   where value->>'cart_line_id'=item->>'cart_line_id'
    and value->>'cart_key'=item->>'id'||':'||coalesce(item->>'variant_id','default') limit 1
  ) match on true
 ) quantities where remaining>0;
 update private.customer_carts set items=purchased,version=version+1,revision=gen_random_uuid(),cart_id=gen_random_uuid(),
  coupon_code=case when purchased='[]' then null else coupon_code end,updated_at=clock_timestamp() where user_id=p_user_id returning * into c;
 insert into private.customer_cart_receipts(user_id,command_id,intent_hash,applied_version) values(p_user_id,s.id,fp,c.version);
 return jsonb_build_object('cart',private.customer_cart_projection(p_user_id));
end $$;
revoke all on function public.commerce_complete_customer_cart(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.commerce_complete_customer_cart(uuid,uuid) to service_role;
create function private.complete_paid_account_cart() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 -- Optional cart cleanup cannot prevent a verified paid order from settling.
 begin perform public.commerce_complete_customer_cart(new.user_id,new.id);exception when others then null;end;
 return new;
end $$;
create trigger account_cart_after_verified_payment after update of state on private.payment_checkout_sessions
 for each row when (new.state='paid' and old.state is distinct from 'paid') execute function private.complete_paid_account_cart();
revoke all on function private.complete_paid_account_cart() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
