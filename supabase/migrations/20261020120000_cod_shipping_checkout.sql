-- 83: configured COD delivery, physical stock and reviewed shipping snapshots.
-- Configuration stays disabled. No inventory, accounts or business rows are seeded.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

alter table public.commerce_shipping_companies
 add column checkout_enabled boolean not null default false,
 add column checkout_governorates text[] not null default '{}',
 add constraint shipping_checkout_areas_check check (
  cardinality(checkout_governorates)<=30 and
  (not checkout_enabled or cardinality(checkout_governorates)>0) and
  array_position(checkout_governorates,null) is null
 );
alter table public.customer_orders
 add column shipping_company_id uuid,
 add column shipping_company_name text,
 add column shipping_fee_amount numeric(12,2) not null default 0 check(shipping_fee_amount>=0);
-- Snapshot identity/name/fee survive later carrier edits or removal.

create function private.cod_shipping(p_company uuid,p_governorate text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare company public.commerce_shipping_companies%rowtype;
begin
 select * into company from public.commerce_shipping_companies
 where id=p_company and is_active and checkout_enabled for share;
 if not found or not exists(select 1 from unnest(company.checkout_governorates) area
  where lower(btrim(area))=lower(btrim(p_governorate)) and btrim(area)<>'') then
  raise exception 'checkout:delivery';
 end if;
 return jsonb_build_object('companyId',company.id,'companyName',company.name,'fee',company.client_shipping_price);
end $$;

create function private.cod_authorize(p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from auth.users where id=p_user_id and not coalesce(is_anonymous,false)
  and email_confirmed_at is not null and nullif(btrim(email),'') is not null) then
  raise exception 'Confirm your account email before ordering.' using errcode='42501';
 end if;
end $$;

-- Retain the reviewed82 implementation; only compose the COD requirements.
do $$ declare name text; definition text; anchor text;begin
 foreach name in array array['checkout_intent','checkout_review'] loop
  definition:=pg_get_functiondef(case when name='checkout_intent'
   then 'private.checkout_intent(jsonb,jsonb)'::regprocedure else 'private.checkout_review(jsonb)'::regprocedure end);
  anchor:='CREATE OR REPLACE FUNCTION private.'||name||'(';
  if position(anchor in definition)<>1 then raise exception 'Review checkout function %. Stop.',name;end if;
  execute replace(definition,anchor,'CREATE OR REPLACE FUNCTION private.'||name||'_before_cod(');
 end loop;
end $$;

create or replace function private.checkout_intent(p_order jsonb,p_items jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare intent jsonb:=private.checkout_intent_before_cod(p_order,p_items); company uuid;
begin
 company:=nullif(btrim(p_order->>'shipping_company_id'),'')::uuid;
 -- Absent fields preserve historical command fingerprints and exact recovery.
 if company is not null then
  intent:=jsonb_set(intent,'{order}',(intent->'order')||jsonb_build_object('shipping_company_id',company));
 end if;
 return intent;
end $$;

create or replace function private.checkout_review(p_intent jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare review jsonb:=private.checkout_review_before_cod(p_intent); shipping jsonb; line jsonb;
 product public.products%rowtype; available integer; quantity integer;
begin
 if p_intent#>>'{order,payment_method}'<>'cash' then return review;end if;
 if review->>'erpMode'<>'built_in' or (review->>'isPreorder')::boolean then
  raise exception 'COD requires ready stock in the built-in inventory.';
 end if;
 -- The existing review locks product/variant records. The existing creator still
 -- allocates units and decrements balances atomically; no stock is manufactured.
 for line in select value from jsonb_array_elements(p_intent->'items') loop
  select * into product from public.products where id=(line->>'product_id')::uuid;
  quantity:=(line->>'quantity')::integer;
  if product.stock_quantity<quantity or product.primary_warehouse_id is null or not exists(
   select 1 from public.commerce_warehouses where id=product.primary_warehouse_id and is_active for share
  ) then raise exception 'checkout:stock';end if;
  select inventory.quantity into available from public.commerce_warehouse_inventory inventory
   where warehouse_id=product.primary_warehouse_id and product_id=product.id for share;
  if not found or available<quantity then raise exception 'checkout:stock';end if;
  if product.is_serialized and not exists(select 1 from public.product_variants
   where id=(line->>'variant_id')::uuid and stock_quantity>=quantity) then raise exception 'checkout:stock';end if;
 end loop;
 shipping:=private.cod_shipping((p_intent#>>'{order,shipping_company_id}')::uuid,p_intent#>>'{order,governorate}');
 return review||jsonb_build_object('shipping',shipping,'shippingFee',(shipping->>'fee')::numeric,
  'totalAmount',(review->>'totalAmount')::numeric+(shipping->>'fee')::numeric,
  'requiredNow',(review->>'requiredNow')::numeric+(shipping->>'fee')::numeric,'allowOutOfStock',false);
end $$;

create function private.prepare_cod_shipping() returns trigger
language plpgsql security definer set search_path='' as $$
declare shipping jsonb;
begin
 -- Historical/internal inserts without a checkout selection retain their contract.
 -- Every new cash checkout requires a selection in the guarded review above.
 if new.shipping_company_id is null then return new;end if;
 if new.payment_method is distinct from 'cash' or new.is_preorder then raise exception 'checkout:delivery';end if;
 shipping:=private.cod_shipping(new.shipping_company_id,new.governorate);
 new.shipping_company_name:=shipping->>'companyName';
 new.shipping_fee_amount:=(shipping->>'fee')::numeric;
 new.total_amount:=new.total_amount+new.shipping_fee_amount;
 return new;
end $$;
create trigger customer_orders_prepare_cod_shipping before insert on public.customer_orders
 for each row execute function private.prepare_cod_shipping();

-- Add only the selected identity to the established normal-order insert. The
-- trigger supplies trusted price/name BEFORE SMS and other insert side effects.
do $$ declare definition text; anchor text;begin
 definition:=pg_get_functiondef('public.commerce_create_normal_customer_order(uuid,jsonb,jsonb,boolean,uuid)'::regprocedure);
 anchor:=E'    shipping_method,\n    payment_method,';
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'Review normal order shipping columns.';end if;
 definition:=replace(definition,anchor,E'    shipping_method,\n    shipping_company_id,\n    payment_method,');
 anchor:=E'    nullif(btrim(p_order ->> ''shipping_method''), ''''),\n    nullif(btrim(p_order ->> ''payment_method''), ''''),';
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'Review normal order shipping values.';end if;
 execute replace(definition,anchor,E'    nullif(btrim(p_order ->> ''shipping_method''), ''''),\n    nullif(p_order ->> ''shipping_company_id'', '''')::uuid,\n    nullif(btrim(p_order ->> ''payment_method''), ''''),');
end $$;

do $$ declare name text; definition text; anchor text;begin
 foreach name in array array['quote','command'] loop
  definition:=pg_get_functiondef(case when name='quote'
   then 'public.commerce_checkout_quote(uuid,uuid,jsonb,jsonb)'::regprocedure
   else 'public.commerce_checkout_command(uuid,uuid,uuid,jsonb,jsonb)'::regprocedure end);
  anchor:='perform private.checkout_authorize(p_user_id);';
  if position(anchor in definition)=0 then raise exception 'Review checkout authorization.';end if;
  definition:=replace(definition,anchor,anchor||E'\n if lower(btrim(p_order->>''payment_method''))=''cash'' then perform private.cod_authorize(p_user_id);end if;');
  if name='command' then
   anchor:='settings.allow_out_of_stock_purchases,p_cart_id';
   if position(anchor in definition)=0 then raise exception 'Review checkout stock allocation.';end if;
   definition:=replace(definition,anchor,'case when intent#>>''{order,payment_method}''=''cash'' then false else settings.allow_out_of_stock_purchases end,p_cart_id');
  end if;
  execute definition;
 end loop;
end $$;

revoke all on function private.cod_shipping(uuid,text),private.cod_authorize(uuid),private.prepare_cod_shipping(),
 private.checkout_intent_before_cod(jsonb,jsonb),private.checkout_review_before_cod(jsonb),
 private.checkout_intent(jsonb,jsonb),private.checkout_review(jsonb) from public,anon,authenticated,service_role;
-- Existing quote/command grants and revoked legacy entry points stay unchanged.
notify pgrst,'reload schema';
commit;
