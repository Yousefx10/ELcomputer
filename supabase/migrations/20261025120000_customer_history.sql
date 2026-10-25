-- Additive historical records only. Bundle after the pending Beta migrations.
-- This schema has no commerce, Auth creation, inventory, provider or notification writes.
begin;
create schema customer_history_private;
revoke all on schema customer_history_private from public, anon, authenticated, service_role;

create table customer_history_private.sources (
 id uuid primary key, source_key text not null unique check(length(source_key) between 1 and 100),
 snapshot_sha256 text not null check(snapshot_sha256 ~ '^[a-f0-9]{64}$'),
 hidden_at timestamptz, imported_at timestamptz not null default clock_timestamp()
);
create table customer_history_private.customers (
 source_id uuid not null references customer_history_private.sources(id), legacy_id text not null check(legacy_id ~ '^[1-9][0-9]{0,17}$'),
 email text not null check(length(email)<=254 and email=lower(btrim(email))), record jsonb not null check(jsonb_typeof(record)='object'),
 claim_approved boolean not null default false, review_evidence text,
 auth_user_id uuid references auth.users(id) on delete set null, linked_at timestamptz,
 primary key(source_id,legacy_id),
 check(not claim_approved or (review_evidence is not null and review_evidence ~ '^[a-f0-9]{64}$'))
);
create unique index customer_history_approved_email on customer_history_private.customers(source_id,email) where claim_approved;
create unique index customer_history_linked_user on customer_history_private.customers(source_id,auth_user_id) where auth_user_id is not null;
create index customer_history_claim_email on customer_history_private.customers(email) where claim_approved and auth_user_id is null;
create table customer_history_private.orders (
 source_id uuid not null references customer_history_private.sources(id), legacy_id text not null check(legacy_id ~ '^[1-9][0-9]{0,17}$'),
 customer_legacy_id text, record jsonb not null check(jsonb_typeof(record)='object'),
 primary key(source_id,legacy_id),
 foreign key(source_id,customer_legacy_id) references customer_history_private.customers(source_id,legacy_id)
);
create index customer_history_order_customer on customer_history_private.orders(source_id,customer_legacy_id);
create table customer_history_private.items (
 source_id uuid not null, legacy_id text not null check(legacy_id ~ '^[1-9][0-9]{0,17}$'), order_legacy_id text not null,
 record jsonb not null check(jsonb_typeof(record)='object'), primary key(source_id,legacy_id),
 foreign key(source_id,order_legacy_id) references customer_history_private.orders(source_id,legacy_id)
);
create index customer_history_item_order on customer_history_private.items(source_id,order_legacy_id);
create table customer_history_private.batches (
 source_id uuid not null references customer_history_private.sources(id), batch_id uuid not null,
 payload_sha256 text not null, receipt jsonb not null, completed_at timestamptz not null default clock_timestamp(),
 primary key(source_id,batch_id)
);
alter table customer_history_private.sources enable row level security;
alter table customer_history_private.customers enable row level security;
alter table customer_history_private.orders enable row level security;
alter table customer_history_private.items enable row level security;
alter table customer_history_private.batches enable row level security;
revoke all on all tables in schema customer_history_private from public,anon,authenticated,service_role;

create function public.customer_history_import_batch(p_source_id uuid,p_source_key text,p_source_sha256 text,p_batch_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,customer_history_private
as $$
declare source customer_history_private.sources; prior customer_history_private.batches; value jsonb; saved jsonb;
 fingerprint text; result jsonb; n_customers integer:=0;n_orders integer:=0;n_items integer:=0;
begin
 if p_source_id is null or p_batch_id is null or p_source_key is null or length(p_source_key) not between 1 and 100
  or p_source_sha256 is null or p_source_sha256 !~ '^[a-f0-9]{64}$' or p_payload is null or jsonb_typeof(p_payload)<>'object'
  or octet_length(p_payload::text)>1048576
  or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('customers','orders','items'))
  or jsonb_typeof(p_payload->'customers') is distinct from 'array' or jsonb_typeof(p_payload->'orders') is distinct from 'array'
  or jsonb_typeof(p_payload->'items') is distinct from 'array' then raise exception 'Invalid historical batch.';end if;
 if jsonb_array_length(p_payload->'customers')>50 or jsonb_array_length(p_payload->'orders')>50 or jsonb_array_length(p_payload->'items')>300 then raise exception 'Historical batch is too large.';end if;
 perform pg_advisory_xact_lock(hashtextextended('customer-history:'||p_source_id::text,0));
 fingerprint:=encode(sha256(convert_to(p_payload::text,'UTF8')),'hex');
 select * into source from customer_history_private.sources where id=p_source_id;
 if found and (source.source_key<>p_source_key or source.snapshot_sha256<>p_source_sha256 or source.hidden_at is not null) then raise exception 'Historical source requires review.';end if;
 if not found then insert into customer_history_private.sources(id,source_key,snapshot_sha256) values(p_source_id,p_source_key,p_source_sha256);end if;
 select * into prior from customer_history_private.batches where source_id=p_source_id and batch_id=p_batch_id;
 if found then if prior.payload_sha256<>fingerprint then raise exception 'Historical command changed.';end if;return prior.receipt;end if;
 for value in select * from jsonb_array_elements(p_payload->'customers') loop
  if jsonb_typeof(value)<>'object' or value->>'legacy_id' is null or value->>'legacy_id' !~ '^[1-9][0-9]{0,17}$'
   or value->>'email' is null or value->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
   or value->>'email'<>lower(btrim(value->>'email')) or length(value->>'email')>254
   or jsonb_typeof(value->'profile') is distinct from 'object' or jsonb_typeof(value->'billing_address') is distinct from 'object'
   or jsonb_typeof(value->'shipping_address') is distinct from 'object'
   or jsonb_typeof(value->'claim_approved') is distinct from 'boolean'
   or exists(select 1 from jsonb_object_keys(value) k where k not in ('legacy_id','email','profile','billing_address','shipping_address','claim_approved','review_evidence'))
   then raise exception 'Invalid historical customer.';end if;
  select record into saved from customer_history_private.customers where source_id=p_source_id and legacy_id=value->>'legacy_id';
  if found then if saved<>value then raise exception 'Historical customer changed.';end if;
  else insert into customer_history_private.customers(source_id,legacy_id,email,record,claim_approved,review_evidence)
   values(p_source_id,value->>'legacy_id',value->>'email',value,(value->>'claim_approved')::boolean,value->>'review_evidence');n_customers:=n_customers+1;end if;
 end loop;
 for value in select * from jsonb_array_elements(p_payload->'orders') loop
  if jsonb_typeof(value)<>'object' or value->>'legacy_id' is null or value->>'legacy_id' !~ '^[1-9][0-9]{0,17}$'
   or value->>'kind' is null or value->>'kind' not in ('shop_order','shop_order_refund')
   or value->>'total' is null or value->>'total' !~ '^-?[0-9]{1,12}(\.[0-9]{1,6})?$'
   or value->>'currency' is null or value->>'currency' !~ '^[A-Z]{3}$'
   or exists(select 1 from jsonb_object_keys(value) k where k not in ('legacy_id','customer_legacy_id','kind','parent_legacy_id','status','currency','total','created_at','payment_method','payment_title','transaction_reference','paid_at_original','completed_at_original','date_variants','billing_address','shipping_address','refund_amount','refund_reason','shipping_reference','shipping_awb','fulfillment_events','original_customer_legacy_id'))
   then raise exception 'Invalid historical order.';end if;
  select record into saved from customer_history_private.orders where source_id=p_source_id and legacy_id=value->>'legacy_id';
  if found then if saved<>value then raise exception 'Historical order changed.';end if;
  else insert into customer_history_private.orders(source_id,legacy_id,customer_legacy_id,record)
   values(p_source_id,value->>'legacy_id',nullif(value->>'customer_legacy_id',''),value);n_orders:=n_orders+1;end if;
 end loop;
 for value in select * from jsonb_array_elements(p_payload->'items') loop
  if jsonb_typeof(value)<>'object' or value->>'legacy_id' is null or value->>'legacy_id' !~ '^[1-9][0-9]{0,17}$'
   or value->>'order_legacy_id' is null or value->>'order_legacy_id' !~ '^[1-9][0-9]{0,17}$'
   or value->>'kind' is null or value->>'kind' not in ('line_item','shipping','fee','tax','coupon')
   or exists(select 1 from jsonb_object_keys(value) k where k not in ('legacy_id','order_legacy_id','kind','title','quantity','product_legacy_id','variant_legacy_id','subtotal','total','tax')) then raise exception 'Invalid historical item.';end if;
  select record into saved from customer_history_private.items where source_id=p_source_id and legacy_id=value->>'legacy_id';
  if found then if saved<>value then raise exception 'Historical item changed.';end if;
  else insert into customer_history_private.items(source_id,legacy_id,order_legacy_id,record)
   values(p_source_id,value->>'legacy_id',value->>'order_legacy_id',value);n_items:=n_items+1;end if;
 end loop;
 result:=jsonb_build_object('customers',n_customers,'orders',n_orders,'items',n_items,'batch_id',p_batch_id);
 insert into customer_history_private.batches(source_id,batch_id,payload_sha256,receipt) values(p_source_id,p_batch_id,fingerprint,result);
 return result;
end $$;

create function public.customer_history_claim(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,customer_history_private as $$
declare v_email text; amount integer;
begin
 -- A verified current mailbox is necessary; the owner-reviewed source approval is separate.
 select lower(btrim(u.email)) into v_email from auth.users u join public.customer_profiles p on p.id=u.id
  where u.id=p_user_id and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and p.is_active;
 if v_email is null or (select count(*) from auth.users u where lower(btrim(u.email))=v_email)<>1 then raise exception 'Verified customer access required.';end if;
 perform pg_advisory_xact_lock(hashtextextended('history-claim:'||v_email,0));
 update customer_history_private.customers c set auth_user_id=p_user_id,linked_at=clock_timestamp()
  from customer_history_private.sources s where s.id=c.source_id and s.hidden_at is null and c.email=v_email
   and c.claim_approved and c.auth_user_id is null;
 get diagnostics amount=row_count;
 return jsonb_build_object('connected',amount);
end $$;

create function public.customer_history_read(p_user_id uuid,p_source_id uuid default null,p_order_id text default null,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path=pg_catalog,customer_history_private as $$
declare v_email text; row_data jsonb; result jsonb; profiles jsonb; total integer;
begin
 select lower(btrim(u.email)) into v_email from auth.users u join public.customer_profiles p on p.id=u.id
  where u.id=p_user_id and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and p.is_active;
 if v_email is null then raise exception 'Verified customer access required.';end if;
 if p_offset<0 or p_offset>100000 or (p_order_id is not null and (p_source_id is null or p_order_id !~ '^[1-9][0-9]{0,17}$')) then raise exception 'Invalid historical request.';end if;
 if p_order_id is not null then
  select o.record into row_data from customer_history_private.orders o join customer_history_private.customers c on c.source_id=o.source_id and c.legacy_id=o.customer_legacy_id
   join customer_history_private.sources s on s.id=o.source_id
   where o.source_id=p_source_id and o.legacy_id=p_order_id and c.auth_user_id=p_user_id and c.email=v_email and s.hidden_at is null;
  if not found then return null;end if;
  select coalesce(jsonb_agg(i.record order by length(i.legacy_id),i.legacy_id),'[]'::jsonb) into result
   from customer_history_private.items i where i.source_id=p_source_id and i.order_legacy_id=p_order_id;
  return jsonb_build_object('order',row_data,'items',result);
 end if;
 select count(*)::integer into total from customer_history_private.orders o join customer_history_private.customers c on c.source_id=o.source_id and c.legacy_id=o.customer_legacy_id
  join customer_history_private.sources s on s.id=o.source_id where c.auth_user_id=p_user_id and c.email=v_email and s.hidden_at is null;
 select coalesce(jsonb_agg(rows.value order by rows.created desc nulls last,rows.legacy_id desc),'[]'::jsonb) into result from (
  select jsonb_build_object('source_id',o.source_id,'legacy_id',o.legacy_id,'kind',o.record->>'kind','status',o.record->>'status','currency',o.record->>'currency','total',o.record->>'total','created_at',o.record->>'created_at') value,o.record->>'created_at' created,o.legacy_id
   from customer_history_private.orders o join customer_history_private.customers c on c.source_id=o.source_id and c.legacy_id=o.customer_legacy_id
   join customer_history_private.sources s on s.id=o.source_id where c.auth_user_id=p_user_id and c.email=v_email and s.hidden_at is null
   order by o.record->>'created_at' desc nulls last,o.legacy_id desc limit 10 offset p_offset
 ) rows;
 select coalesce(jsonb_agg(jsonb_build_object('source_id',c.source_id,'profile',c.record->'profile','billing_address',c.record->'billing_address','shipping_address',c.record->'shipping_address')),'[]'::jsonb) into profiles
  from customer_history_private.customers c join customer_history_private.sources s on s.id=c.source_id
  where c.auth_user_id=p_user_id and c.email=v_email and s.hidden_at is null;
 return jsonb_build_object('orders',result,'total',total,'profiles',profiles);
end $$;

-- Recovery hides this source without restoring backups over newer customers/orders.
create function public.customer_history_hide_source(p_source_id uuid,p_snapshot_sha256 text) returns boolean
language plpgsql security definer set search_path=pg_catalog,customer_history_private as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('customer-history:'||p_source_id::text,0));
 update customer_history_private.sources set hidden_at=coalesce(hidden_at,clock_timestamp()) where id=p_source_id and snapshot_sha256=p_snapshot_sha256;
 if not found then raise exception 'Historical source mismatch.';end if;return true;
end $$;

revoke all on function public.customer_history_import_batch(uuid,text,text,uuid,jsonb),public.customer_history_claim(uuid),public.customer_history_read(uuid,uuid,text,integer),public.customer_history_hide_source(uuid,text) from public,anon,authenticated;
grant execute on function public.customer_history_import_batch(uuid,text,text,uuid,jsonb),public.customer_history_claim(uuid),public.customer_history_read(uuid,uuid,text,integer),public.customer_history_hide_source(uuid,text) to service_role;
commit;
