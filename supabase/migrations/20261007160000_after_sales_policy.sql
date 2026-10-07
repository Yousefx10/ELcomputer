-- After-sales policy only. No claims, notifications, provider work or historical backfill.
begin;

create function public.after_sales_valid_list(v text[], allowed text[]) returns boolean
language sql immutable set search_path='' as $$
  select v is null or (v <@ allowed and array_position(v,null) is null
    and cardinality(v)=(select count(distinct x) from unnest(v) x));
$$;

create table public.after_sales_policies (
  scope_key text primary key,
  category_id uuid references public.categories(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  revision integer not null default 0 check(revision>=0),
  warranty_configured boolean,
  return_configured boolean,
  warranty_enabled boolean,
  warranty_start_basis text check(warranty_start_basis in ('delivery_date','invoice_date','payment_date','order_date')),
  warranty_fallback_bases text[] check(public.after_sales_valid_list(warranty_fallback_bases,array['delivery_date','invoice_date','payment_date','order_date'])),
  warranty_resolutions text[] check(public.after_sales_valid_list(warranty_resolutions,array['repair','replacement','refund','service_center'])),
  warranty_evidence text check(warranty_evidence in ('disabled','optional','required')),
  warranty_serial text check(warranty_serial in ('disabled','optional','required')),
  warranty_shipping text check(warranty_shipping in ('elcomputer','customer','reason','manual')),
  return_enabled boolean,
  return_window_days integer check(return_window_days between 1 and 365),
  return_start_basis text check(return_start_basis in ('delivery_date','invoice_date','payment_date','order_date')),
  return_fallback_bases text[] check(public.after_sales_valid_list(return_fallback_bases,array['delivery_date','invoice_date','payment_date','order_date'])),
  return_opened text check(return_opened in ('allowed','not_allowed','reason','manual')),
  return_packaging text check(return_packaging in ('not_required','preferred','required')),
  return_evidence text check(return_evidence in ('disabled','optional','required')),
  return_shipping text check(return_shipping in ('elcomputer','customer','reason','manual')),
  policy_timezone text,
  updated_by uuid references public.admin_users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint after_sales_scope_check check(
    (scope_key='global' and category_id is null and product_id is null)
    or (category_id is not null and product_id is null and scope_key='category:'||category_id::text)
    or (product_id is not null and category_id is null and scope_key='product:'||product_id::text)),
  constraint after_sales_global_complete check(scope_key<>'global' or (
    warranty_configured is not null and return_configured is not null and warranty_enabled is not null
    and warranty_start_basis is not null and warranty_fallback_bases is not null and warranty_resolutions is not null
    and warranty_evidence is not null and warranty_serial is not null and warranty_shipping is not null
    and return_enabled is not null and return_window_days is not null and return_start_basis is not null
    and return_fallback_bases is not null and return_opened is not null and return_packaging is not null
    and return_evidence is not null and return_shipping is not null and policy_timezone is not null)),
  constraint after_sales_scoped_configuration check(scope_key='global' or (warranty_configured is null and return_configured is null))
);

create table public.after_sales_return_reasons (
  key text primary key check(key ~ '^[a-z][a-z0-9_]{0,63}$'),
  label_en text not null check(char_length(btrim(label_en)) between 1 and 160),
  label_ar text not null check(char_length(btrim(label_ar)) between 1 and 160),
  is_enabled boolean not null,
  sort_order integer not null check(sort_order between 0 and 10000),
  fault text not null check(fault in ('customer','seller','neutral')),
  shipping text check(shipping in ('elcomputer','customer','manual')),
  opened text check(opened in ('allowed','not_allowed','manual')),
  evidence text check(evidence in ('disabled','optional','required')),
  revision integer not null default 1 check(revision>=1),
  updated_at timestamptz not null default now()
);

create table public.after_sales_policy_versions (
  id uuid primary key default gen_random_uuid(),
  version_key text not null unique,
  -- Materialized entitlement rules ONLY; no admin identities/UI/runtime settings.
  policy jsonb not null check(jsonb_typeof(policy)='object'),
  created_at timestamptz not null default now()
);

-- Editable draft defaults. Nothing is authoritative until that policy is saved.
insert into public.after_sales_policies(scope_key,revision,warranty_configured,return_configured,
  warranty_enabled,warranty_start_basis,warranty_fallback_bases,warranty_resolutions,warranty_evidence,warranty_serial,warranty_shipping,
  return_enabled,return_window_days,return_start_basis,return_fallback_bases,return_opened,return_packaging,return_evidence,return_shipping,policy_timezone)
values('global',1,false,false,false,'delivery_date','{}','{}','optional','optional','manual',
  false,14,'delivery_date','{}','manual','preferred','optional','manual','Africa/Cairo');
insert into public.after_sales_return_reasons(key,label_en,label_ar,is_enabled,sort_order,fault) values
 ('changed_mind','Changed mind','تغيير الرأي',true,10,'neutral'),
 ('wrong_item','Wrong item received','استلام منتج خاطئ',true,20,'neutral'),
 ('damaged_arrival','Damaged on arrival','تلف عند الاستلام',true,30,'neutral'),
 ('defective','Defective product','منتج معيب',true,40,'neutral'),
 ('missing_parts','Missing parts or accessories','نقص أجزاء أو ملحقات',true,50,'neutral'),
 ('not_described','Product not as described','المنتج لا يطابق الوصف',true,60,'neutral'),
 ('other','Other','سبب آخر',true,70,'neutral');

create function public.after_sales_guard_policy() returns trigger language plpgsql set search_path='' as $$
begin
  if new.policy_timezone is not null and not exists(select 1 from pg_catalog.pg_timezone_names where name=new.policy_timezone) then
    raise exception 'Invalid policy timezone.' using errcode='22023';
  end if;
  return new;
end $$;
create trigger after_sales_policy_validation before insert or update on public.after_sales_policies
for each row execute function public.after_sales_guard_policy();

create function public.after_sales_immutable_version() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Purchased after-sales policy versions are immutable.'; end $$;
create trigger after_sales_versions_immutable before update or delete on public.after_sales_policy_versions
for each row execute function public.after_sales_immutable_version();
create trigger after_sales_versions_immutable_truncate before truncate on public.after_sales_policy_versions
for each statement execute function public.after_sales_immutable_version();

create function public.after_sales_resolve_policy(p_product_id uuid default null,p_category_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.after_sales_policies%rowtype; c public.after_sales_policies%rowtype; p public.after_sales_policies%rowtype;
  category uuid; base jsonb; cv jsonb; pv jsonb; sources jsonb:='{}'; k text; reasons jsonb;
begin
  -- All policy writes lock global first. Capture retains these shared locks
  -- through checkout, so it cannot mix revisions or changed reason catalogs.
  select * into g from public.after_sales_policies where scope_key='global' for share;
  if not found then raise exception 'After-sales configuration unavailable.'; end if;
  if p_product_id is not null then
    select category_id into category from public.products where id=p_product_id;
    if not found then raise exception 'Product unavailable.' using errcode='22023'; end if;
  else category:=p_category_id;
    if category is not null and not exists(select 1 from public.categories where id=category) then
      raise exception 'Category unavailable.' using errcode='22023';
    end if;
  end if;
  select * into c from public.after_sales_policies where scope_key='category:'||category::text for share;
  select * into p from public.after_sales_policies where scope_key='product:'||p_product_id::text for share;
  base:=to_jsonb(g)-array['scope_key','category_id','product_id','revision','updated_by','updated_at'];
  cv:=coalesce(jsonb_strip_nulls(to_jsonb(c))-array['scope_key','category_id','product_id','revision','updated_by','updated_at'],'{}');
  pv:=coalesce(jsonb_strip_nulls(to_jsonb(p))-array['scope_key','category_id','product_id','revision','updated_by','updated_at'],'{}');
  for k in select jsonb_object_keys(base) loop
    sources:=sources||jsonb_build_object(k,case when pv?k then 'product' when cv?k then 'category' else 'global' end);
  end loop;
  base:=base||cv||pv;
  select coalesce(jsonb_agg(to_jsonb(r)-array['revision','updated_at'] order by r.sort_order,r.key),'[]') into reasons from public.after_sales_return_reasons r;
  base:=base||jsonb_build_object('return_reasons',reasons);
  return jsonb_build_object('policy',base,'sources',sources,'version_key',
    'global:'||g.revision||'|'||coalesce(c.scope_key,'category:none')||':'||coalesce(c.revision,0)||'|'||coalesce(p.scope_key,'product:none')||':'||coalesce(p.revision,0)||'|rules:'||md5(base::text));
end $$;

create function public.after_sales_save_policy(p_admin_id uuid,p_scope_key text,p_section text,p_revision integer,p_values jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.admin_users%rowtype; old_row public.after_sales_policies%rowtype; next_row public.after_sales_policies%rowtype;
  k text; v jsonb; kind text; allowed text[];
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Server authorization required.'; end if;
  select * into a from public.admin_users where id=p_admin_id and is_active;
  if not found or not(a.role='owner' or (coalesce((a.permissions->>'settings.view')::boolean,false) and coalesce((a.permissions->>'settings.edit')::boolean,false))) then
    raise exception 'Not authorized.'; end if;
  if p_values is null or jsonb_typeof(p_values)<>'object' or p_values='{}' or p_revision is null or p_revision<0
    or p_section is null or p_section not in ('warranty','returns','overrides') then raise exception 'Invalid policy input.' using errcode='22023'; end if;
  -- Checkout locks catalog rows before capturing policy. Acquire the FK
  -- parent lock first as well, before holding global, so first-time overrides
  -- cannot deadlock checkout while validating their product/category FK.
  if p_scope_key ~ '^product:[0-9a-f-]{36}$' then
    perform 1 from public.products where id=substring(p_scope_key from 9)::uuid for key share;
    if not found then raise exception 'Product unavailable.' using errcode='22023'; end if;
  elsif p_scope_key ~ '^category:[0-9a-f-]{36}$' then
    perform 1 from public.categories where id=substring(p_scope_key from 10)::uuid for key share;
    if not found then raise exception 'Category unavailable.' using errcode='22023'; end if;
  end if;
  perform 1 from public.after_sales_policies where scope_key='global' for update;
  if p_scope_key='global' then
    if p_section='overrides' then raise exception 'Choose a policy section.' using errcode='22023'; end if;
  elsif p_scope_key ~ '^category:[0-9a-f-]{36}$' then
    insert into public.after_sales_policies(scope_key,category_id) values(p_scope_key,substring(p_scope_key from 10)::uuid) on conflict do nothing;
  elsif p_scope_key ~ '^product:[0-9a-f-]{36}$' then
    insert into public.after_sales_policies(scope_key,product_id) values(p_scope_key,substring(p_scope_key from 9)::uuid) on conflict do nothing;
  else raise exception 'Invalid policy scope.' using errcode='22023'; end if;
  select * into old_row from public.after_sales_policies where scope_key=p_scope_key for update;
  if not found or old_row.revision<>p_revision then raise exception 'Stale policy.' using errcode='40001'; end if;
  allowed:=array['warranty_enabled','warranty_start_basis','warranty_fallback_bases','warranty_resolutions','warranty_evidence','warranty_serial','warranty_shipping',
    'return_enabled','return_window_days','return_start_basis','return_fallback_bases','return_opened','return_packaging','return_evidence','return_shipping','policy_timezone'];
  for k,v in select * from jsonb_each(p_values) loop
    if not(k=any(allowed)) or (p_scope_key='global' and k<>'policy_timezone' and
      ((p_section='warranty' and k not like 'warranty_%') or (p_section='returns' and k not like 'return_%'))) then
      raise exception 'Invalid policy field.' using errcode='22023'; end if;
    kind:=jsonb_typeof(v);
    if kind='null' and p_scope_key<>'global' then continue; end if;
    if (k in ('warranty_enabled','return_enabled') and kind<>'boolean')
      or (k='return_window_days' and (kind<>'number' or (v#>>'{}')::numeric<>trunc((v#>>'{}')::numeric)))
      or (k in ('warranty_fallback_bases','return_fallback_bases','warranty_resolutions') and kind<>'array')
      or (k not in ('warranty_enabled','return_enabled','return_window_days','warranty_fallback_bases','return_fallback_bases','warranty_resolutions') and kind<>'string') then
      raise exception 'Invalid policy type.' using errcode='22023'; end if;
    if kind='array' and exists(select 1 from jsonb_array_elements(v) x where jsonb_typeof(x)<>'string') then
      raise exception 'Invalid policy list.' using errcode='22023'; end if;
  end loop;
  next_row:=jsonb_populate_record(old_row,p_values);
  if p_scope_key='global' then
    if p_section='warranty' then next_row.warranty_configured:=true; else next_row.return_configured:=true; end if;
  end if;
  update public.after_sales_policies set
    warranty_configured=next_row.warranty_configured,return_configured=next_row.return_configured,
    warranty_enabled=next_row.warranty_enabled,warranty_start_basis=next_row.warranty_start_basis,warranty_fallback_bases=next_row.warranty_fallback_bases,
    warranty_resolutions=next_row.warranty_resolutions,warranty_evidence=next_row.warranty_evidence,warranty_serial=next_row.warranty_serial,warranty_shipping=next_row.warranty_shipping,
    return_enabled=next_row.return_enabled,return_window_days=next_row.return_window_days,return_start_basis=next_row.return_start_basis,return_fallback_bases=next_row.return_fallback_bases,
    return_opened=next_row.return_opened,return_packaging=next_row.return_packaging,return_evidence=next_row.return_evidence,return_shipping=next_row.return_shipping,
    policy_timezone=next_row.policy_timezone,revision=revision+1,updated_by=a.id,updated_at=clock_timestamp()
  where scope_key=p_scope_key returning * into next_row;
  insert into public.admin_activity_logs(admin_user_id,author_name,author_email,author_role,action_key,description,metadata)
    values(a.id,coalesce(a.full_name,a.email),a.email,a.role,'settings.after_sales.policy','Saved after-sales policy.',
      jsonb_build_object('scope',p_scope_key,'section',p_section,'before',to_jsonb(old_row)-array['updated_by','updated_at'],'after',to_jsonb(next_row)-array['updated_by','updated_at']));
  return to_jsonb(next_row)-'updated_by';
end $$;

create function public.after_sales_save_reason(p_admin_id uuid,p_reason jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.admin_users%rowtype; old_row public.after_sales_return_reasons%rowtype; next_row public.after_sales_return_reasons%rowtype; k text; v jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Server authorization required.'; end if;
  select * into a from public.admin_users where id=p_admin_id and is_active;
  if not found or not(a.role='owner' or (coalesce((a.permissions->>'settings.view')::boolean,false) and coalesce((a.permissions->>'settings.edit')::boolean,false))) then raise exception 'Not authorized.'; end if;
  if p_reason is null or jsonb_typeof(p_reason)<>'object' or p_reason->>'key' is null or p_reason->>'revision' is null then raise exception 'Invalid reason.' using errcode='22023'; end if;
  for k,v in select * from jsonb_each(p_reason) loop
    if k not in ('key','label_en','label_ar','is_enabled','sort_order','fault','shipping','opened','evidence','revision')
      or (k='is_enabled' and jsonb_typeof(v)<>'boolean')
      or (k in ('sort_order','revision') and (jsonb_typeof(v)<>'number' or (v#>>'{}')::numeric<>trunc((v#>>'{}')::numeric)))
      or (k not in ('is_enabled','sort_order','revision','shipping','opened','evidence') and jsonb_typeof(v)<>'string')
      or (k in ('shipping','opened','evidence') and jsonb_typeof(v) not in ('string','null')) then raise exception 'Invalid reason field.' using errcode='22023'; end if;
  end loop;
  perform 1 from public.after_sales_policies where scope_key='global' for update;
  select * into old_row from public.after_sales_return_reasons where key=p_reason->>'key' for update;
  if coalesce(old_row.revision,0)<>(p_reason->>'revision')::integer then raise exception 'Stale reason.' using errcode='40001'; end if;
  if old_row.key is null and (select count(*) from public.after_sales_return_reasons)>=50 then raise exception 'Too many return reasons.' using errcode='22023'; end if;
  next_row:=jsonb_populate_record(null::public.after_sales_return_reasons,p_reason);
  insert into public.after_sales_return_reasons(key,label_en,label_ar,is_enabled,sort_order,fault,shipping,opened,evidence,revision)
    values(next_row.key,btrim(next_row.label_en),btrim(next_row.label_ar),next_row.is_enabled,next_row.sort_order,next_row.fault,next_row.shipping,next_row.opened,next_row.evidence,coalesce(old_row.revision,0)+1)
  on conflict(key) do update set label_en=excluded.label_en,label_ar=excluded.label_ar,is_enabled=excluded.is_enabled,sort_order=excluded.sort_order,
    fault=excluded.fault,shipping=excluded.shipping,opened=excluded.opened,evidence=excluded.evidence,revision=excluded.revision,updated_at=clock_timestamp()
  returning * into next_row;
  -- Reason rules/enablement also belong to the purchased version.
  update public.after_sales_policies set revision=revision+1,updated_by=a.id,updated_at=clock_timestamp() where scope_key='global';
  insert into public.admin_activity_logs(admin_user_id,author_name,author_email,author_role,action_key,description,metadata)
    values(a.id,coalesce(a.full_name,a.email),a.email,a.role,'settings.after_sales.reason','Saved return reason.',jsonb_build_object('before',to_jsonb(old_row),'after',to_jsonb(next_row)));
  return to_jsonb(next_row);
end $$;

alter table public.customer_order_items add column after_sales_policy_version_id uuid references public.after_sales_policy_versions(id) on delete restrict;
comment on column public.customer_order_items.after_sales_policy_version_id is 'Immutable effective purchase policy reference; NULL for purchases without trusted policy capture. Never attach current policy to historical rows.';

create function public.after_sales_capture_purchase() returns trigger language plpgsql security definer set search_path='' as $$
declare resolved jsonb; version_row public.after_sales_policy_versions%rowtype;
begin
  new.after_sales_policy_version_id:=null;
  if coalesce(current_setting('app.warranty_purchase_capture',true),'')<>'on' then return new; end if;
  resolved:=public.after_sales_resolve_policy(new.product_id);
  insert into public.after_sales_policy_versions(version_key,policy) values(resolved->>'version_key',resolved->'policy') on conflict(version_key) do nothing;
  select * into version_row from public.after_sales_policy_versions where version_key=resolved->>'version_key';
  if version_row.policy is distinct from resolved->'policy' then raise exception 'Policy revision conflict.'; end if;
  new.after_sales_policy_version_id:=version_row.id;
  return new;
end $$;
create trigger customer_order_items_snapshot_after_sales before insert on public.customer_order_items
for each row execute function public.after_sales_capture_purchase();
create function public.after_sales_guard_purchase() returns trigger language plpgsql set search_path='' as $$
begin
  if new.after_sales_policy_version_id is distinct from old.after_sales_policy_version_id then raise exception 'Purchased after-sales policy is immutable.'; end if;
  return new;
end $$;
create trigger customer_order_items_guard_after_sales before update on public.customer_order_items
for each row execute function public.after_sales_guard_purchase();

-- Extend the existing stock/RLS storefront projection, preserving its column
-- ordering and ERP stock expression. The prior view predates warranty columns.
do $$ declare cols text; begin
  select string_agg(case when a.attname='stock_quantity' then 'public.erp_storefront_stock(''product'',p.id,p.stock_quantity) as stock_quantity'
    else format('p.%I',a.attname) end,',' order by a.attnum) into cols
  from pg_attribute a where a.attrelid='public.products'::regclass and a.attnum>0 and not a.attisdropped;
  execute format('create or replace view public.storefront_products with (security_invoker=true) as select %s from public.products p',cols);
end $$;

create index after_sales_delivery_evidence_idx on public.shipping_webhook_events(shipment_job_id,status_date)
where normalized_state='delivered' and processed_at is not null and source in ('webhook','reconciliation');

-- One calendar implementation. Coverage begins at the real source instant and
-- ends exclusively at local midnight on the calendar anniversary/end date.
create function public.after_sales_period(p_basis text,p_fallback text[],p_dates jsonb,p_value integer,p_unit text,p_timezone text,p_now timestamptz default clock_timestamp())
returns jsonb language plpgsql stable set search_path='' as $$
declare basis text; start_at timestamptz; start_date date; expiry_date date; expiry_at timestamptz;
begin
  if p_basis is null or p_basis not in ('delivery_date','invoice_date','payment_date','order_date') or p_value is null or p_value<1
    or p_unit is null or p_unit not in ('days','months','years') or p_value > (case p_unit when 'days' then 365 when 'months' then 120 when 'years' then 10 end) or p_timezone is null or p_now is null or not isfinite(p_now)
    or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then
    return jsonb_build_object('status','unknown','reason','invalid_period');
  end if;
  foreach basis in array array[p_basis]||coalesce(p_fallback,'{}') loop
    if basis in ('delivery_date','invoice_date','payment_date','order_date') and p_dates->>basis is not null then
      begin start_at:=(p_dates->>basis)::timestamptz;
      exception when invalid_datetime_format or datetime_field_overflow then start_at:=null; end;
      if start_at is not null and isfinite(start_at) then exit; end if;
      start_at:=null;
    end if;
  end loop;
  if start_at is null then return jsonb_build_object('status','unknown','reason',p_basis||'_unavailable'); end if;
  start_date:=(start_at at time zone p_timezone)::date;
  expiry_date:=case p_unit when 'months' then (start_date+make_interval(months=>p_value))::date
    when 'years' then (start_date+make_interval(years=>p_value))::date else start_date+p_value end;
  expiry_at:=expiry_date::timestamp at time zone p_timezone;
  return jsonb_build_object('status',case when p_now<start_at then 'not_started' when p_now>=expiry_at then 'expired' else 'active' end,
    'reason',null,'start_at',start_at,'start_date',start_date,'expiry_date',expiry_date,'expiry_at',expiry_at,
    'timezone',p_timezone,'start_basis',basis,'used_fallback',basis<>p_basis);
end $$;

create function public.after_sales_order_dates(p_order_id uuid,p_now timestamptz default clock_timestamp()) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare o public.customer_orders%rowtype; delivery timestamptz;
begin
  select * into o from public.customer_orders where id=p_order_id;
  -- Read durable normalized delivery evidence. No mapping reinterpretation,
  -- order-status inference, courier lookup, polling or reconciliation call.
  select min(e.status_date) into delivery from public.shipping_order_jobs j
    join public.shipping_webhook_events e on e.shipment_job_id=j.id and e.provider=j.provider
      and e.awb=j.awb and e.order_ref=j.to_ref
    where j.order_id=o.id and e.normalized_state='delivered' and e.processed_at is not null
      and e.source in ('webhook','reconciliation') and e.status_date>=o.created_at and e.status_date<=p_now;
  return jsonb_build_object('order_date',o.created_at,'payment_date',case when o.paid_at>=o.created_at and o.paid_at<=p_now then o.paid_at end,
    'delivery_date',delivery,'invoice_date',null);
end $$;

create function public.after_sales_item_eligibility(p_item_id uuid,p_facts jsonb default '{}',p_now timestamptz default clock_timestamp()) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare item public.customer_order_items%rowtype; o public.customer_orders%rowtype; policy jsonb; dates jsonb; wp jsonb; rp jsonb;
  wstatus text:='unknown'; wreason text:='historical_policy_unknown'; rstatus text:='unknown'; rreason text:='historical_policy_unknown';
  reason_row jsonb; opened text; shipping text; evidence text; k text; v jsonb; serial_known boolean:=false;
begin
  if p_facts is null or jsonb_typeof(p_facts)<>'object' then raise exception 'Invalid eligibility facts.' using errcode='22023'; end if;
  for k,v in select * from jsonb_each(p_facts) loop
    if k not in ('reason_key','opened','packaging','evidence','serial')
      or (k='reason_key' and (jsonb_typeof(v)<>'string' or char_length(v#>>'{}')>64))
      or (k<>'reason_key' and jsonb_typeof(v)<>'boolean') then raise exception 'Invalid eligibility fact.' using errcode='22023'; end if;
  end loop;
  select * into item from public.customer_order_items where id=p_item_id;
  if not found then raise exception 'Order item unavailable.' using errcode='22023'; end if;
  select * into o from public.customer_orders where id=item.order_id;
  select p.policy into policy from public.after_sales_policy_versions p where id=item.after_sales_policy_version_id;
  wp:=jsonb_build_object('status','unknown','reason','historical_policy_unknown'); rp:=wp;
  if policy is not null then
    dates:=public.after_sales_order_dates(item.order_id,p_now);
    wreason:='policy_unconfigured'; rreason:='policy_unconfigured';
    if (policy->>'warranty_configured')::boolean then
      if item.warranty_status='none' then wstatus:='ineligible';wreason:='no_warranty';wp:=jsonb_build_object('status','not_applicable');
      elsif item.warranty_status='included' and item.warranty_duration_value is not null then
        wp:=public.after_sales_period(policy->>'warranty_start_basis',array(select jsonb_array_elements_text(policy->'warranty_fallback_bases')),dates,
          item.warranty_duration_value,item.warranty_duration_unit,policy->>'policy_timezone',p_now);
        wstatus:=case wp->>'status' when 'active' then 'eligible' else wp->>'status' end;
        wreason:=wp->>'reason';
        if not (policy->>'warranty_enabled')::boolean then wstatus:='disabled';wreason:='warranty_disabled';
        elsif jsonb_array_length(policy->'warranty_resolutions')=0 then wstatus:='unknown';wreason:='resolution_unconfigured';
        elsif wstatus='eligible' then
          -- Vendor serial_number exists alongside permanent unit/QR identity.
          -- QR/unit codes are never manufactured into a vendor serial.
          select count(*)>=item.quantity into serial_known from public.commerce_serialized_units u
            where u.customer_order_item_id=item.id and nullif(btrim(u.serial_number),'') is not null;
          if policy->>'warranty_evidence'='required' and not coalesce((p_facts->>'evidence')::boolean,false) then wstatus:='unknown';wreason:='evidence_required';
          elsif policy->>'warranty_serial'='required' and not serial_known and not coalesce((p_facts->>'serial')::boolean,false) then wstatus:='unknown';wreason:='serial_verification_required'; end if;
        end if;
      else wreason:='warranty_information_unavailable'; end if;
    end if;
    if (policy->>'return_configured')::boolean then
      rp:=public.after_sales_period(policy->>'return_start_basis',array(select jsonb_array_elements_text(policy->'return_fallback_bases')),dates,
        (policy->>'return_window_days')::integer,'days',policy->>'policy_timezone',p_now);
      rstatus:=case rp->>'status' when 'active' then 'eligible' else rp->>'status' end;rreason:=rp->>'reason';
      opened:=policy->>'return_opened';shipping:=policy->>'return_shipping';evidence:=policy->>'return_evidence';
      if not (policy->>'return_enabled')::boolean then rstatus:='disabled';rreason:='returns_disabled';
      elsif rstatus='eligible' then
        select x into reason_row from jsonb_array_elements(policy->'return_reasons') x where x->>'key'=p_facts->>'reason_key';
        if reason_row is null then rstatus:='unknown';rreason:='reason_required';
        elsif not (reason_row->>'is_enabled')::boolean then rstatus:='ineligible';rreason:='reason_disabled';
        else
          opened:=coalesce(reason_row->>'opened',opened);shipping:=coalesce(reason_row->>'shipping',shipping);evidence:=coalesce(reason_row->>'evidence',evidence);
          if opened='manual' or opened='reason' then rstatus:='unknown';rreason:='opened_review_required';
          elsif opened='not_allowed' and p_facts->>'opened' is null then rstatus:='unknown';rreason:='opened_information_required';
          elsif opened='not_allowed' and (p_facts->>'opened')::boolean then rstatus:='ineligible';rreason:='opened_not_allowed';
          elsif policy->>'return_packaging'='required' and not coalesce((p_facts->>'packaging')::boolean,false) then rstatus:='unknown';rreason:='packaging_required';
          elsif evidence='required' and not coalesce((p_facts->>'evidence')::boolean,false) then rstatus:='unknown';rreason:='evidence_required'; end if;
        end if;
      end if;
    end if;
    if o.status in ('cancelled','refunded') or o.payment_status='refunded' then wstatus:='ineligible';rstatus:='ineligible';wreason:='order_closed';rreason:='order_closed'; end if;
  end if;
  return jsonb_build_object('warranty',jsonb_build_object('status',wstatus,'reason',wreason,'period',wp,
    'resolutions',policy->'warranty_resolutions','evidence',policy->>'warranty_evidence','serial',policy->>'warranty_serial','shipping',policy->>'warranty_shipping'),
    'returns',jsonb_build_object('status',rstatus,'reason',rreason,'period',rp,'opened',opened,'packaging',policy->>'return_packaging','evidence',evidence,'shipping',shipping,
      'reason_key',reason_row->>'key','fault',reason_row->>'fault'));
end $$;

create function public.after_sales_order_entitlements(p_order_id uuid,p_customer_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare results jsonb;
begin
  if not exists(select 1 from public.customer_orders o join public.customer_profiles c on c.id=o.user_id
    where o.id=p_order_id and o.user_id=p_customer_id and c.is_active) then raise exception 'Order unavailable.' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'after_sales',public.after_sales_item_eligibility(i.id)) order by i.created_at,i.id),'[]') into results
    from public.customer_order_items i where i.order_id=p_order_id;
  return results;
end $$;

-- Keep the existing reset engine and owner guards. Policy configuration and
-- immutable purchase archives survive resets; catalog overrides cascade only
-- when their explicit product/category reset scope is erased.
do $reset$ declare definition text; known text:='array[''admin_users'', ''system_reset_runs'', ''system_reset_attempts'']'; fk text:='and con.confdeltype <> ''n'''; begin
  definition:=pg_get_functiondef('public.system_reset_plan(uuid,text)'::regprocedure);
  if position(known in definition)=0 or position(fk in definition)=0 then raise exception 'Review reset policy integration before migrating.'; end if;
  definition:=replace(definition,known,'array[''admin_users'', ''system_reset_runs'', ''system_reset_attempts'', ''after_sales_policies'', ''after_sales_return_reasons'', ''after_sales_policy_versions'']');
  definition:=replace(definition,fk,'and not (ns.nspname=''public'' and src.relname=''after_sales_policies'' and target.relname in (''products'',''categories'') and con.confdeltype=''c'') '||fk);
  execute definition;
end $reset$;

alter table public.after_sales_policies enable row level security;
alter table public.after_sales_return_reasons enable row level security;
alter table public.after_sales_policy_versions enable row level security;
revoke all on public.after_sales_policies,public.after_sales_return_reasons,public.after_sales_policy_versions from public,anon,authenticated;
grant all on public.after_sales_policies,public.after_sales_return_reasons,public.after_sales_policy_versions to service_role;
do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'after_sales_%' loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
notify pgrst,'reload schema';
commit;
