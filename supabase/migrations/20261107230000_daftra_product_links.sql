-- Owner request 7 Nov 2026 (phase 2A): every bill line is a real Daftra product.
-- 1. Owner-confirmed links: website product option -> Daftra product ID. Several options
--    may share one Daftra product (e.g. switch types sold as one Daftra item). Orders,
--    customers and other link kinds stay one-to-one.
-- 2. Daftra payment method and treasury for online (card, Apple Pay) payments.
-- 3. Saving links retries bills that were waiting for a link.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

drop index public.erp_entity_links_external_uidx;
create unique index erp_entity_links_external_uidx on public.erp_entity_links(provider,external_entity_type,external_id)
 where external_entity_type<>'product';
create index erp_entity_links_external_product_idx on public.erp_entity_links(provider,external_id)
 where external_entity_type='product';

alter table public.erp_provider_settings
 add column online_payment_method text,
 add column online_treasury_id integer,
 add constraint erp_provider_settings_online_payment_method_check
  check (online_payment_method is null or online_payment_method ~ '^[A-Za-z0-9_-]{1,60}$'),
 add constraint erp_provider_settings_online_treasury_check
  check (online_treasury_id is null or online_treasury_id>0);
comment on column public.erp_provider_settings.online_payment_method is
 'Daftra payment method recorded on bills paid online (card, Apple Pay). Null records no payment.';

create function public.erp_save_product_links(p_admin_id uuid,p_links jsonb) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare l jsonb; v uuid; product uuid; ext text; saved integer:=0; removed integer:=0; requeued integer:=0;
begin
 if auth.role() is distinct from 'service_role' or not exists(select 1 from public.admin_users where id=p_admin_id
  and is_active and (role='owner' or coalesce((permissions->>'products.edit')::boolean,false))) then
  raise exception 'Product permission is required.' using errcode='42501';
 end if;
 if jsonb_typeof(p_links) is distinct from 'array' or jsonb_array_length(p_links) not between 1 and 500 then
  raise exception 'Send between 1 and 500 links.' using errcode='22023';
 end if;
 for l in select value from jsonb_array_elements(p_links) loop
  if jsonb_typeof(l)<>'object' or coalesce(l->>'variant_id','') !~ '^[0-9a-fA-F-]{36}$' then raise exception 'Unknown product option.' using errcode='22023'; end if;
  v:=(l->>'variant_id')::uuid; ext:=nullif(btrim(coalesce(l->>'daftra_id','')),'');
  select product_id into product from public.product_variants where id=v;
  if product is null then raise exception 'Unknown product option.' using errcode='22023'; end if;
  if ext is not null and ext !~ '^[1-9][0-9]{0,18}$' then raise exception 'Choose a valid Daftra product.' using errcode='22023'; end if;
  delete from public.erp_entity_links where provider='daftra' and local_entity_type='product_variant' and local_id=v
   and (ext is null or external_id<>ext);
  if found then removed:=removed+1; end if;
  if ext is not null then
   insert into public.erp_entity_links(provider,local_entity_type,local_id,external_entity_type,external_id,external_number,metadata,last_synced_at,updated_at)
   values('daftra','product_variant',v,'product',ext,nullif(left(btrim(coalesce(l->>'daftra_code','')),100),''),
    jsonb_build_object('productId',product,'variantId',v,'linkedBy',p_admin_id,'linkedAt',clock_timestamp(),
     'source',case when l->>'source' in ('code','name','owner') then l->>'source' else 'owner' end),clock_timestamp(),clock_timestamp())
   on conflict(provider,local_entity_type,local_id) do nothing;
   if found then saved:=saved+1; end if;
  end if;
 end loop;
 update public.erp_sync_jobs set status='pending',attempts=0,available_at=clock_timestamp(),last_error=null,updated_at=clock_timestamp()
  where provider='daftra' and operation='order.export' and status='failed' and last_error like 'Link this product%';
 get diagnostics requeued=row_count;
 return jsonb_build_object('saved',saved,'removed',removed,'requeued',requeued);
end $$;

revoke all on function public.erp_save_product_links(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.erp_save_product_links(uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
