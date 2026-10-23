-- 91: company-scoped tariff drafts/history only. No prices are seeded or quoted.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create table private.shipping_tariffs (
 id uuid primary key, company_id uuid not null, version integer not null check(version>0),
 revision integer not null check(revision>0), status text not null check(status in ('draft','verified')),
 document jsonb not null check(jsonb_typeof(document)='object' and octet_length(document::text)<=2000000),
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 updated_by uuid not null, unique(company_id,version)
);
create table private.shipping_tariff_revisions (
 tariff_id uuid not null references private.shipping_tariffs(id), revision integer not null,
 command_id uuid not null unique, actor_id uuid not null, request jsonb not null,
 status text not null, document jsonb not null, created_at timestamptz not null default clock_timestamp(),
 primary key(tariff_id,revision)
);
-- No FK to company/admin: retained historical receipts survive a full reset.
-- They contain configuration only, never credentials or recipient information.
alter table private.shipping_tariffs enable row level security;
alter table private.shipping_tariff_revisions enable row level security;
revoke all on private.shipping_tariffs,private.shipping_tariff_revisions from public,anon,authenticated,service_role;

create function private.shipping_tariff_actor(p_admin uuid,p_company uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' or not exists(select 1 from public.admin_users
  where id=p_admin and is_active and (role='owner' or (coalesce((permissions->>'settings.view')::boolean,false) and coalesce((permissions->>'settings.edit')::boolean,false)))) then
  raise exception 'Tariff permission required.' using errcode='42501';
 end if;
 perform 1 from public.commerce_shipping_companies where id=p_company and provider='pdc' for share;
 if not found then raise exception 'Shipping company unavailable.' using errcode='22023';end if;
end $$;

create function private.shipping_tariff_validate(d jsonb,p_verify boolean) returns void
language plpgsql security definer set search_path='' as $$
declare z jsonb; m jsonb; s jsonb; k text; n integer;
begin
 if d is null or jsonb_typeof(d) is distinct from 'object' or octet_length(d::text)>2000000
  or d->>'format' is distinct from 'shipping-tariff/v1' or d->>'provider' is distinct from 'pdc'
  or d->>'currency' is distinct from 'EGP' or nullif(btrim(d->>'title'),'') is null or length(d->>'title')>120
  or d->'automatic_annual_increase' is distinct from 'false'::jsonb
  or coalesce(d->>'base_weight_kg','') !~ '^(0|[1-9][0-9]{0,4})\.[0-9]{3}$' or (d->>'base_weight_kg')::numeric<=0
  or coalesce(d->>'volumetric_divisor','') !~ '^[1-9][0-9]{0,6}$' or (d->>'volumetric_divisor')::integer>1000000
  or coalesce(d->>'extra_weight_rounding','') not in ('unverified','ceil_kg','pro_rata')
  or coalesce(d->>'vat_scope','') not in ('unverified','freight_only','freight_and_fees')
  or coalesce(d->>'cod_basis','') not in ('unverified','collected_amount','declared_value')
  or coalesce(d->>'failed_delivery_basis','') not in ('unverified','freight_ex_vat','freight_inc_vat')
  or jsonb_typeof(d->'zones') is distinct from 'array' or jsonb_array_length(d->'zones')<>6
  or jsonb_typeof(d->'mappings') is distinct from 'array' or jsonb_array_length(d->'mappings')>5000
  or jsonb_typeof(d->'surcharges') is distinct from 'array' or jsonb_array_length(d->'surcharges')>50 then
  raise exception 'Invalid tariff.' using errcode='22023';
 end if;
 foreach k in array array['product_confirmed','validity_confirmed','surcharges_confirmed','insurance_enabled'] loop
  if jsonb_typeof(d->k) is distinct from 'boolean' then raise exception 'Invalid tariff.' using errcode='22023';end if;
 end loop;
 foreach k in array array['vat_percent','cod_percent','insurance_percent','failed_delivery_percent'] loop
  if coalesce(d->>k,'') !~ '^(0|[1-9][0-9]{0,2})\.[0-9]{2}$' or (d->>k)::numeric>100 then raise exception 'Invalid tariff.' using errcode='22023';end if;
 end loop;
 foreach k in array array['effective_from','effective_until'] loop
  if d->k is distinct from 'null'::jsonb and (coalesce(d->>k,'') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or (d->>k)::date::text<>d->>k) then
   raise exception 'Invalid tariff date.' using errcode='22023';end if;
 end loop;
 if d->>'effective_until'<d->>'effective_from' then raise exception 'Invalid tariff dates.' using errcode='22023';end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(d->'zones'))<>6 then raise exception 'Invalid zones.' using errcode='22023';end if;
 for z in select value from jsonb_array_elements(d->'zones') loop
  if coalesce(z->>'id','') !~ '^[1-6]$' then raise exception 'Invalid zone.' using errcode='22023';end if;
  foreach k in array array['base_price','additional_kg_price'] loop
   if coalesce(z->>k,'') !~ '^(0|[1-9][0-9]{0,9})\.[0-9]{2}$' then raise exception 'Invalid zone rate.' using errcode='22023';end if;
  end loop;
 end loop;
 if (select count(distinct value->>'provider_city_id') from jsonb_array_elements(d->'mappings'))<>jsonb_array_length(d->'mappings') then
  raise exception 'Duplicate city.' using errcode='22023';end if;
 for m in select value from jsonb_array_elements(d->'mappings') loop
  if coalesce(m->>'provider_city_id','') !~ '^[1-9][0-9]{0,9}$' or (m->>'provider_city_id')::bigint>2147483647
   or coalesce(m->>'review_state','') not in ('unverified','confirmed','excluded')
   or (m->'zone_id' is distinct from 'null'::jsonb and coalesce(m->>'zone_id','') !~ '^[1-6]$') then
   raise exception 'Invalid city mapping.' using errcode='22023';end if;
 end loop;
 for s in select value from jsonb_array_elements(d->'surcharges') loop
  if coalesce(s->>'kind','') not in ('fixed','percent') or coalesce(s->>'basis','') not in ('freight','declared_value','cod')
   or coalesce(s->>'value','') !~ '^(0|[1-9][0-9]{0,9})\.[0-9]{2}$'
   or (s->>'kind'='percent' and (s->>'value')::numeric>100) or jsonb_typeof(s->'vat_applicable') is distinct from 'boolean' then
   raise exception 'Invalid surcharge.' using errcode='22023';end if;
 end loop;
 if not p_verify then return;end if;
 if d->'product_confirmed'<>'true'::jsonb or d->'validity_confirmed'<>'true'::jsonb or d->'surcharges_confirmed'<>'true'::jsonb
  or d->>'effective_from' is null or d->>'extra_weight_rounding'='unverified' or d->>'vat_scope'='unverified'
  or d->>'cod_basis'='unverified' or d->>'failed_delivery_basis'='unverified'
  or not exists(select 1 from public.shipping_provider_settings s,jsonb_array_elements(s.products_cache) p
   where s.id='pdc' and p->>'id'=d->>'product_id') then raise exception 'Tariff is unverified.' using errcode='22023';end if;
 n:=0;
 for m in select value from jsonb_array_elements(d->'mappings') loop
  if m->>'review_state'='excluded' then continue;end if;
  n:=n+1;
  if m->>'review_state'<>'confirmed' or m->>'zone_id' is null
   or (select count(*) from public.shipping_city_mappings a where a.provider='pdc'
    and a.provider_city_id=(m->>'provider_city_id')::integer and a.governorate=m->>'governorate'
    and a.city=m->>'city' and a.city_arabic is not distinct from m->>'city_arabic')<>1
   or (select count(*) from public.shipping_city_mappings a where a.provider='pdc'
    and lower(btrim(a.governorate))=lower(btrim(m->>'governorate'))
    and (lower(btrim(a.city))=lower(btrim(m->>'city')) or (m->>'city_arabic' is not null and lower(btrim(a.city_arabic))=lower(btrim(m->>'city_arabic')))))<>1
   or not exists(select 1 from public.shipping_provider_settings s,jsonb_array_elements(s.cities_cache) c
    where s.id='pdc' and c->>'id'=m->>'provider_city_id') then raise exception 'Tariff areas are unverified.' using errcode='22023';end if;
 end loop;
 if n=0 then raise exception 'No verified tariff areas.' using errcode='22023';end if;
end $$;

create function public.shipping_tariff_read(p_admin uuid,p_company uuid,p_tariff uuid default null,p_revision integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare selected private.shipping_tariffs%rowtype; historic private.shipping_tariff_revisions%rowtype; doc jsonb;
begin
 perform private.shipping_tariff_actor(p_admin,p_company);
 if p_tariff is null then select * into selected from private.shipping_tariffs where company_id=p_company order by version desc limit 1;
 else select * into selected from private.shipping_tariffs where company_id=p_company and id=p_tariff;
  if not found then raise exception 'Tariff unavailable.' using errcode='22023';end if;
 end if;
 doc:=selected.document;
 if p_revision is not null then
  select * into historic from private.shipping_tariff_revisions where tariff_id=selected.id and revision=p_revision;
  if not found then raise exception 'Revision unavailable.' using errcode='22023';end if;
  doc:=historic.document;
 end if;
 return jsonb_build_object('versions',coalesce((select jsonb_agg(x order by version desc) from (
  select id,version,revision,status,updated_at,document->>'title' title from private.shipping_tariffs where company_id=p_company order by version desc limit 100) x),'[]'::jsonb),
  'selected',case when selected.id is null then null else to_jsonb(selected)||jsonb_build_object('document',doc,'viewed_revision',coalesce(p_revision,selected.revision),'viewed_status',coalesce(historic.status,selected.status)) end,
  'history',coalesce((select jsonb_agg(x order by revision desc) from (
   select revision,status,actor_id,created_at from private.shipping_tariff_revisions where tariff_id=selected.id order by revision desc limit 100) x),'[]'::jsonb));
end $$;

create function public.shipping_tariff_save(p_admin uuid,p_company uuid,p_tariff uuid,p_command uuid,p_expected integer,p_document jsonb,p_verify boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_tariff private.shipping_tariffs%rowtype; receipt private.shipping_tariff_revisions%rowtype;
 request jsonb:=jsonb_build_object('company',p_company,'tariff',p_tariff,'expected',p_expected,'document',p_document,'verify',p_verify);
 v integer; next_status text:=case when p_verify then 'verified' else 'draft' end;
begin
 perform pg_advisory_xact_lock_shared(hashtextextended('elcomputer-system-reset',0));
 perform private.shipping_tariff_actor(p_admin,p_company);
 if p_tariff is null or p_command is null or p_expected is null or p_expected<0 or p_verify is null then raise exception 'Invalid tariff command.' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('shipping-tariff:'||p_company::text,0));
 select * into receipt from private.shipping_tariff_revisions where command_id=p_command;
 if found then
  if receipt.actor_id<>p_admin or receipt.request<>request then raise exception 'Tariff command conflict.' using errcode='40001';end if;
  return jsonb_build_object('id',receipt.tariff_id,'revision',receipt.revision,'status',receipt.status,'replayed',true,'checkout_eligible',false);
 end if;
 perform private.shipping_tariff_validate(p_document,p_verify);
 select * into current_tariff from private.shipping_tariffs where id=p_tariff for update;
 if found then
  if current_tariff.company_id<>p_company or current_tariff.revision<>p_expected or current_tariff.status<>'draft' then
   raise exception 'Tariff revision conflict.' using errcode='40001';end if;
  update private.shipping_tariffs set document=p_document,status=next_status,revision=revision+1,updated_at=clock_timestamp(),updated_by=p_admin where id=p_tariff returning * into current_tariff;
 else
  if p_expected<>0 then raise exception 'Tariff revision conflict.' using errcode='40001';end if;
  select coalesce(max(version),0)+1 into v from private.shipping_tariffs where company_id=p_company;
  insert into private.shipping_tariffs(id,company_id,version,revision,status,document,updated_by)
   values(p_tariff,p_company,v,1,next_status,p_document,p_admin) returning * into current_tariff;
 end if;
 insert into private.shipping_tariff_revisions(tariff_id,revision,command_id,actor_id,request,status,document)
 values(p_tariff,current_tariff.revision,p_command,p_admin,request,next_status,p_document);
 return jsonb_build_object('id',p_tariff,'revision',current_tariff.revision,'status',next_status,'replayed',false,'checkout_eligible',false);
end $$;

revoke all on function private.shipping_tariff_actor(uuid,uuid),private.shipping_tariff_validate(jsonb,boolean),
 public.shipping_tariff_read(uuid,uuid,uuid,integer),public.shipping_tariff_save(uuid,uuid,uuid,uuid,integer,jsonb,boolean) from public,anon,authenticated,service_role;
grant execute on function public.shipping_tariff_read(uuid,uuid,uuid,integer),public.shipping_tariff_save(uuid,uuid,uuid,uuid,integer,jsonb,boolean) to service_role;

-- Both configuration and append-only audit survive resets. Unknown tables fail.
do $$ declare definition text; anchor text:='''pdc_dispatches''';begin
 definition:=pg_get_functiondef('catalog_private.reset_assert_coverage()'::regprocedure);
 if position(anchor in definition)=0 then raise exception 'Review tariff reset retention.';end if;
 execute replace(definition,anchor,anchor||',''shipping_tariffs'',''shipping_tariff_revisions''');
end $$;
notify pgrst,'reload schema';
commit;
