-- Stage 1 only: purchased-policy claims, private evidence and recorded decisions.
-- No historical claims, provider/notification jobs, money or inventory writes.
begin;

alter function public.default_admin_permissions() rename to default_admin_permissions_before_claims;
create function public.default_admin_permissions() returns jsonb language sql immutable set search_path='' as $$
  select public.default_admin_permissions_before_claims() || jsonb_build_object(
    'claims.view',false,'claims.review',false,'claims.manage',false,'claims.evidence',false,
    'claims.notes',false,'claims.decide',false,'claims.resolution',false);
$$;
alter table public.admin_users alter column permissions set default public.default_admin_permissions();

create table public.after_sales_claims (
  id uuid primary key default gen_random_uuid(), reference text not null unique,
  customer_id uuid not null references public.customer_profiles(id) on delete restrict,
  order_id uuid not null references public.customer_orders(id) on delete restrict,
  item_id uuid not null references public.customer_order_items(id) on delete restrict,
  policy_version_id uuid not null references public.after_sales_policy_versions(id) on delete restrict,
  claim_type text not null check(claim_type in ('return','warranty')),
  quantity integer not null check(quantity between 1 and 99),
  description text not null check(char_length(btrim(description)) between 1 and 4000),
  reason_key text, declarations jsonb not null default '{}' check(jsonb_typeof(declarations)='object'),
  customer_serials text[] not null default '{}', serial_verification text not null default 'not_provided'
    check(serial_verification in ('not_provided','unverified','verified','authoritative')),
  serial_verified_by uuid references public.admin_users(id) on delete restrict,
  serial_verified_at timestamptz, serial_verification_reason text,
  locale text not null check(locale in ('en','ar')),
  submission_key uuid not null, submission jsonb not null check(jsonb_typeof(submission)='object'),
  eligibility_snapshot jsonb not null check(jsonb_typeof(eligibility_snapshot)='object'),
  admission text not null check(admission in ('eligible','manual_review','serial_review')),
  status text not null default 'submitted' check(status in ('submitted','under_review','more_information_required','approved','rejected','pickup_scheduled','in_transit','received','under_inspection','resolution_in_progress','resolved','cancelled')),
  resolution text check(resolution in ('repair','replacement','refund','service_center')),
  decision_text text check(char_length(decision_text)<=4000), resolution_text text check(char_length(resolution_text)<=4000),
  revision integer not null default 1 check(revision>0),
  created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
  unique(customer_id,submission_key), check(reference ~ '^AS-[RW]-[A-F0-9]{16}$'),
  check(cardinality(customer_serials)<=quantity),
  check((claim_type='return' and reason_key is not null and cardinality(customer_serials)=0) or (claim_type='warranty' and reason_key is null)),
  check(status<>'resolved' or (resolution is not null and nullif(btrim(resolution_text),'') is not null))
);
create unique index after_sales_claim_active_item_type on public.after_sales_claims(item_id,claim_type)
  where status not in ('resolved','rejected','cancelled');
create index after_sales_claim_customer_created on public.after_sales_claims(customer_id,created_at desc,id);
create index after_sales_claim_queue on public.after_sales_claims(status,claim_type,created_at desc,id);
create index after_sales_claim_order on public.after_sales_claims(order_id);

create table public.after_sales_claim_events (
  id uuid primary key default gen_random_uuid(), claim_id uuid not null references public.after_sales_claims(id) on delete restrict,
  event_type text not null check(event_type in ('submitted','review','request_information','customer_response','approve','reject','receive','inspect','select_resolution','resolve','cancel','note','verify_serial','evidence_added')),
  actor_id uuid not null, actor_kind text not null check(actor_kind in ('customer','staff')),
  customer_visible boolean not null default true, body text not null default '' check(char_length(body)<=4000),
  status text not null, resolution text, created_at timestamptz not null default clock_timestamp()
);
create index after_sales_claim_event_timeline on public.after_sales_claim_events(claim_id,created_at desc,id desc);

create table public.after_sales_claim_information (
  id uuid primary key default gen_random_uuid(), claim_id uuid not null references public.after_sales_claims(id) on delete restrict,
  requested_by uuid not null references public.admin_users(id) on delete restrict,
  prompt text not null check(char_length(btrim(prompt)) between 1 and 4000), require_evidence boolean not null default false,
  created_at timestamptz not null default clock_timestamp(), response text check(char_length(btrim(response)) between 1 and 4000), response_at timestamptz
);
create unique index after_sales_claim_one_information_request on public.after_sales_claim_information(claim_id) where response_at is null;

create table public.after_sales_claim_evidence (
  id uuid primary key, customer_id uuid not null references public.customer_profiles(id) on delete restrict,
  item_id uuid not null references public.customer_order_items(id) on delete restrict,
  claim_type text not null check(claim_type in ('return','warranty')),
  target_claim_id uuid references public.after_sales_claims(id) on delete restrict,
  request_id uuid references public.after_sales_claim_information(id) on delete restrict,
  claim_id uuid references public.after_sales_claims(id) on delete restrict,
  original_name text not null check(char_length(original_name) between 1 and 180),
  storage_path text not null unique, mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  size_bytes integer not null check(size_bytes between 1 and 5242880), content_sha256 text not null check(content_sha256 ~ '^[a-f0-9]{64}$'),
  is_ready boolean not null default false, created_at timestamptz not null default clock_timestamp(), removed_at timestamptz,
  check(claim_id is null or (is_ready and removed_at is null)),
  check((target_claim_id is null and request_id is null) or (target_claim_id is not null and request_id is not null))
);
create index after_sales_claim_evidence_stage on public.after_sales_claim_evidence(customer_id,item_id,claim_type,created_at) where claim_id is null and removed_at is null;
create index after_sales_claim_evidence_claim on public.after_sales_claim_evidence(claim_id) where claim_id is not null;

create function public.after_sales_claim_guard() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='TRUNCATE' or current_setting('app.after_sales_claim_write',true) is distinct from 'on' then raise exception 'Canonical claim operation required.' using errcode='42501'; end if;
  if tg_op='DELETE' or (tg_table_name='after_sales_claim_events' and tg_op='UPDATE') then raise exception 'Claim history is immutable.' using errcode='42501'; end if;
  if tg_op='UPDATE' then
    if tg_table_name='after_sales_claims' and (to_jsonb(new)-array['status','resolution','decision_text','resolution_text','revision','updated_at','serial_verification','serial_verified_by','serial_verified_at','serial_verification_reason'])
      is distinct from (to_jsonb(old)-array['status','resolution','decision_text','resolution_text','revision','updated_at','serial_verification','serial_verified_by','serial_verified_at','serial_verification_reason']) then raise exception 'Purchased claim context is immutable.' using errcode='42501'; end if;
    if tg_table_name='after_sales_claim_evidence' and ((to_jsonb(old)->>'claim_id') is not null or
      (to_jsonb(new)-array['claim_id','is_ready','removed_at']) is distinct from (to_jsonb(old)-array['claim_id','is_ready','removed_at'])) then raise exception 'Submitted evidence is immutable.' using errcode='42501'; end if;
    if tg_table_name='after_sales_claim_information' and ((to_jsonb(old)->>'response_at') is not null or
      (to_jsonb(new)-array['response','response_at']) is distinct from (to_jsonb(old)-array['response','response_at'])) then raise exception 'Information history is immutable.' using errcode='42501'; end if;
  end if;
  return new;
end $$;
do $$ declare name text; begin
  foreach name in array array['after_sales_claims','after_sales_claim_events','after_sales_claim_information','after_sales_claim_evidence'] loop
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.after_sales_claim_guard()',name||'_guard',name);
    execute format('create trigger %I before truncate on public.%I for each statement execute function public.after_sales_claim_guard()',name||'_truncate_guard',name);
    execute format('alter table public.%I enable row level security',name);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',name);
    execute format('grant select on public.%I to service_role',name);
  end loop;
end $$;

create function public.after_sales_claim_assert_actor(p_actor uuid,p_permission text default null) returns void
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Claim authorization required.' using errcode='42501'; end if;
  if p_permission is null then
    if not exists(select 1 from public.customer_profiles c join auth.users u on u.id=c.id where c.id=p_actor and c.is_active and not u.is_anonymous) then raise exception 'Claim authorization required.' using errcode='42501'; end if;
  elsif not exists(select 1 from public.admin_users a where a.id=p_actor and a.is_active and
    (a.role='owner' or (coalesce((a.permissions->>'claims.view')::boolean,false) and coalesce((a.permissions->>p_permission)::boolean,false)))) then raise exception 'Claim authorization required.' using errcode='42501'; end if;
end $$;

-- Uses only immutable purchased policy and the existing separate helpers.
-- Declarations never become verified serial identity. Evidence is counted by RPCs.
create function public.after_sales_claim_context(p_customer uuid,p_item uuid,p_type text,p_input jsonb default '{}',p_evidence_count integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare i public.customer_order_items%rowtype; o public.customer_orders%rowtype; policy jsonb; facts jsonb; result jsonb; rule jsonb; reason jsonb;
  available integer; base_ok boolean; can_submit boolean:=false; admission text; quantity integer:=1; serials jsonb; serial_known boolean; evidence_mode text; availability text;
begin
  perform public.after_sales_claim_assert_actor(p_customer);
  select item.* into i from public.customer_order_items item join public.customer_orders orders on orders.id=item.order_id where item.id=p_item and orders.user_id=p_customer;
  if not found then raise exception 'Claim item not found.' using errcode='P0002'; end if;
  if p_type is null or p_type not in ('return','warranty') or p_input is null or jsonb_typeof(p_input)<>'object' then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  if exists(select 1 from jsonb_each(p_input) x where
    (x.key in ('opened','packaging') and jsonb_typeof(x.value) not in ('boolean','null')) or
    (x.key='reason_key' and jsonb_typeof(x.value) not in ('string','null')) or
    (x.key='quantity' and (jsonb_typeof(x.value)<>'number' or (x.value#>>'{}')::numeric<>trunc((x.value#>>'{}')::numeric)))) then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  quantity:=coalesce((p_input->>'quantity')::integer,1);
  serials:=coalesce(p_input->'serials','[]'::jsonb);
  if jsonb_typeof(serials)<>'array' or jsonb_array_length(serials)>99 or exists(select 1 from jsonb_array_elements(serials) x where jsonb_typeof(x)<>'string' or char_length(btrim(x#>>'{}')) not between 1 and 120) then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  if jsonb_array_length(serials)<>(select count(distinct x) from jsonb_array_elements_text(serials) x) then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  select * into o from public.customer_orders where id=i.order_id;
  select v.policy into policy from public.after_sales_policy_versions v where v.id=i.after_sales_policy_version_id;
  facts:=jsonb_strip_nulls(jsonb_build_object('reason_key',p_input->>'reason_key','opened',p_input->'opened','packaging',p_input->'packaging','evidence',p_evidence_count>0));
  result:=public.after_sales_item_eligibility(i.id,facts);
  rule:=case p_type when 'return' then result->'returns' else result->'warranty' end;
  select greatest(0,i.quantity-coalesce(sum(c.quantity) filter(where c.status not in ('rejected','cancelled') and (c.status<>'resolved' or c.claim_type='return')),0))::integer into available from public.after_sales_claims c where c.item_id=i.id;
  base_ok:=coalesce((policy->>(case p_type when 'return' then 'return_configured' else 'warranty_configured' end))::boolean,false)
    and coalesce((policy->>(case p_type when 'return' then 'return_enabled' else 'warranty_enabled' end))::boolean,false)
    and rule->'period'->>'status'='active' and o.status not in ('cancelled','refunded') and o.payment_status<>'refunded';
  if p_type='warranty' then base_ok:=base_ok and i.warranty_status='included' and jsonb_array_length(policy->'warranty_resolutions')>0; end if;
  if p_type='return' then base_ok:=base_ok and exists(select 1 from jsonb_array_elements(coalesce(policy->'return_reasons','[]')) r where (r->>'is_enabled')::boolean); end if;
  evidence_mode:=coalesce(rule->>'evidence',policy->>(case p_type when 'return' then 'return_evidence' else 'warranty_evidence' end));
  select count(*)>=i.quantity into serial_known from public.commerce_serialized_units u where u.customer_order_item_id=i.id and nullif(btrim(u.serial_number),'') is not null;
  if coalesce(base_ok,false) and quantity between 1 and least(available,99) and not exists(select 1 from public.after_sales_claims c where c.item_id=i.id and c.claim_type=p_type and c.status not in ('resolved','rejected','cancelled')) then
    if rule->>'status'='eligible' then admission:='eligible'; can_submit:=true;
    elsif p_type='return' and rule->>'reason'='opened_review_required' and p_input->>'opened' is not null then admission:='manual_review';can_submit:=true;
    elsif p_type='warranty' and rule->>'reason'='serial_verification_required' and jsonb_array_length(serials)=quantity then admission:='serial_review';can_submit:=true; end if;
    if evidence_mode='required' and p_evidence_count<1 then can_submit:=false; end if;
    if evidence_mode='disabled' and p_evidence_count>0 then can_submit:=false; end if;
    if p_type='return' and policy->>'return_packaging'='required' and not coalesce((p_input->>'packaging')::boolean,false) then can_submit:=false; end if;
    if p_type='warranty' and policy->>'warranty_serial'='disabled' and jsonb_array_length(serials)>0 then can_submit:=false; end if;
  end if;
  availability:=case when exists(select 1 from public.after_sales_claims c where c.item_id=i.id and c.claim_type=p_type and c.status not in ('resolved','rejected','cancelled')) then 'active_claim'
    when available=0 then 'quantity_reserved' when rule->>'reason'='no_warranty' then 'no_warranty' when rule->>'status'='disabled' then 'disabled'
    when rule->'period'->>'status'='expired' then 'expired' when rule->'period'->>'status'='not_started' or rule->'period'->>'reason' in ('delivery_date_unavailable','invoice_date_unavailable','payment_date_unavailable') then 'pending'
    when p_type='return' and coalesce(base_ok,false)=false and coalesce((policy->>'return_enabled')::boolean,false) and not exists(select 1 from jsonb_array_elements(coalesce(policy->'return_reasons','[]')) r where (r->>'is_enabled')::boolean) then 'no_reasons'
    else 'unknown' end;
  return jsonb_build_object('availability_reason',availability,'item',jsonb_build_object('id',i.id,'product_title',i.product_title,'variant_sku',i.variant_sku,'variant_name',i.variant_name,'quantity',i.quantity,'warranty_status',i.warranty_status,'warranty_duration_value',i.warranty_duration_value,'warranty_duration_unit',i.warranty_duration_unit),
    'order',jsonb_build_object('id',o.id,'order_number',o.order_number,'created_at',o.created_at),'eligibility',rule,
    'can_start',coalesce(base_ok,false) and available>0 and not exists(select 1 from public.after_sales_claims c where c.item_id=i.id and c.claim_type=p_type and c.status not in ('resolved','rejected','cancelled')),
    'can_submit',can_submit,'admission',admission,'available_quantity',least(available,99),'evidence',evidence_mode,
    'serial',policy->>'warranty_serial','serial_authoritative',serial_known,
    'purchased_serials',(select coalesce(jsonb_agg(u.serial_number),'[]') from public.commerce_serialized_units u where u.customer_order_item_id=i.id and nullif(btrim(u.serial_number),'') is not null),
    'reasons',case when p_type='return' then coalesce(policy->'return_reasons','[]') else '[]'::jsonb end);
end $$;

create function public.after_sales_claim_preview(p_customer uuid,p_item uuid,p_type text,p_input jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare ids text[]; files integer;
begin
  perform public.after_sales_claim_assert_actor(p_customer);
  ids:=array(select jsonb_array_elements_text(coalesce(p_input->'attachment_ids','[]')));
  if cardinality(ids)>5 or cardinality(ids)<>(select count(distinct x) from unnest(ids) x) then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  select count(*) into files from public.after_sales_claim_evidence e where e.id::text=any(ids) and e.customer_id=p_customer and e.item_id=p_item and e.claim_type=p_type and e.claim_id is null and e.target_claim_id is null and e.is_ready and e.removed_at is null and e.created_at>clock_timestamp()-interval '24 hours';
  if files<>cardinality(ids) then raise exception 'Claim evidence unavailable.' using errcode='22023'; end if;
  return public.after_sales_claim_context(p_customer,p_item,p_type,p_input,files);
end $$;

create function public.after_sales_claim_emit(p_claim uuid,p_actor uuid,p_kind text,p_event text,p_body text default '',p_visible boolean default true) returns void
language plpgsql security definer set search_path='' as $$
declare c public.after_sales_claims%rowtype; a public.admin_users%rowtype;
begin
  select * into c from public.after_sales_claims where id=p_claim;
  insert into public.after_sales_claim_events(claim_id,actor_id,actor_kind,event_type,body,customer_visible,status,resolution)
    values(c.id,p_actor,p_kind,p_event,coalesce(p_body,''),p_visible,c.status,c.resolution);
  if p_kind='staff' then
    select * into a from public.admin_users where id=p_actor;
    insert into public.admin_activity_logs(admin_user_id,author_name,author_email,author_role,action_key,description,metadata)
      values(a.id,coalesce(a.full_name,a.email),a.email,a.role,'claims.'||p_event,'Updated after-sales claim.',jsonb_build_object('claim_id',c.id,'reference',c.reference,'status',c.status,'resolution',c.resolution));
  end if;
end $$;

create function public.after_sales_claim_create(p_customer uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.customer_order_items%rowtype; c public.after_sales_claims%rowtype; context jsonb; files integer; ids text[]; serials text[]; key uuid; typ text; qty integer;
begin
  perform public.after_sales_claim_assert_actor(p_customer);
  if p_input is null or jsonb_typeof(p_input)<>'object' or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('item_id','claim_type','quantity','description','reason_key','opened','packaging','serials','attachment_ids','idempotency_key','locale')) then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  key:=(p_input->>'idempotency_key')::uuid;typ:=p_input->>'claim_type';qty:=(p_input->>'quantity')::integer;
  if key is null or nullif(btrim(p_input->>'description'),'') is null or char_length(p_input->>'description')>4000 or p_input->>'locale' not in ('en','ar') then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  select item.* into i from public.customer_order_items item join public.customer_orders o on o.id=item.order_id where item.id=(p_input->>'item_id')::uuid and o.user_id=p_customer for update of item;
  if not found then raise exception 'Claim item not found.' using errcode='P0002'; end if;
  select * into c from public.after_sales_claims where customer_id=p_customer and submission_key=key;
  if found then if c.submission is distinct from p_input then raise exception 'Claim retry conflict.' using errcode='40001'; end if;return jsonb_build_object('id',c.id,'reference',c.reference); end if;
  if jsonb_typeof(p_input->'attachment_ids') is distinct from 'array' then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  ids:=array(select jsonb_array_elements_text(p_input->'attachment_ids'));
  if cardinality(ids)>5 or cardinality(ids)<>(select count(distinct x) from unnest(ids) x) then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  select count(*) into files from public.after_sales_claim_evidence e where e.id::text=any(ids) and e.customer_id=p_customer and e.item_id=i.id and e.claim_type=typ and e.claim_id is null and e.target_claim_id is null and e.is_ready and e.removed_at is null and e.created_at>clock_timestamp()-interval '24 hours';
  if files<>cardinality(ids) then raise exception 'Claim evidence unavailable.' using errcode='22023'; end if;
  context:=public.after_sales_claim_context(p_customer,i.id,typ,p_input,files);
  if not coalesce((context->>'can_submit')::boolean,false) then raise exception 'Claim eligibility denied.' using errcode='23514'; end if;
  if typ='return' and (p_input->>'reason_key' is null or jsonb_array_length(coalesce(p_input->'serials','[]'))>0) then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  if typ='warranty' and p_input->>'reason_key' is not null then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  serials:=array(select jsonb_array_elements_text(coalesce(p_input->'serials','[]')));
  perform set_config('app.after_sales_claim_write','on',true);
  c.id:=gen_random_uuid();c.reference:='AS-'||case typ when 'return' then 'R' else 'W' end||'-'||upper(substring(replace(c.id::text,'-','') from 1 for 16));
  insert into public.after_sales_claims(id,reference,customer_id,order_id,item_id,policy_version_id,claim_type,quantity,description,reason_key,declarations,customer_serials,serial_verification,locale,submission_key,submission,eligibility_snapshot,admission)
    values(c.id,c.reference,p_customer,i.order_id,i.id,i.after_sales_policy_version_id,typ,qty,btrim(p_input->>'description'),p_input->>'reason_key',jsonb_strip_nulls(jsonb_build_object('opened',p_input->'opened','packaging',p_input->'packaging')),serials,
      case when typ='warranty' and (context->>'serial_authoritative')::boolean then 'authoritative' when cardinality(serials)>0 then 'unverified' else 'not_provided' end,p_input->>'locale',key,p_input,
      jsonb_build_object('evaluated_at',clock_timestamp(),'eligibility',context->'eligibility','evidence_count',files,'declarations_source','customer','serial_source',case when (context->>'serial_authoritative')::boolean then 'purchased_inventory' when cardinality(serials)>0 then 'customer_unverified' else 'not_provided' end),context->>'admission');
  perform public.after_sales_claim_emit(c.id,p_customer,'customer','submitted');
  update public.after_sales_claim_evidence set claim_id=c.id where id::text=any(ids);
  if files>0 then perform public.after_sales_claim_emit(c.id,p_customer,'customer','evidence_added'); end if;
  perform set_config('app.after_sales_claim_write','off',true);
  return jsonb_build_object('id',c.id,'reference',c.reference);
end $$;

-- The Stage 2 statuses exist, but Stage 1 cannot schedule pickups/transit.
create function public.after_sales_claim_next(p_status text) returns text[] language sql immutable set search_path='' as $$
  select case p_status when 'submitted' then array['under_review','cancelled'] when 'under_review' then array['more_information_required','approved','rejected','cancelled']
    when 'more_information_required' then array['under_review','rejected','cancelled'] when 'approved' then array['received','cancelled']
    when 'received' then array['under_inspection'] when 'under_inspection' then array['resolution_in_progress']
    when 'resolution_in_progress' then array['resolution_in_progress','resolved'] else '{}'::text[] end;
$$;

create function public.after_sales_claim_action_permission(p_action text) returns text language sql immutable set search_path='' as $$
  select case p_action when 'review' then 'claims.review' when 'request_information' then 'claims.review' when 'verify_serial' then 'claims.review'
    when 'approve' then 'claims.decide' when 'reject' then 'claims.decide' when 'receive' then 'claims.manage' when 'inspect' then 'claims.manage' when 'cancel' then 'claims.manage'
    when 'select_resolution' then 'claims.resolution' when 'resolve' then 'claims.resolution' when 'note' then 'claims.notes' end;
$$;
create function public.after_sales_claim_actions(p_status text) returns text[] language sql immutable set search_path='' as $$
  select array['note']||case p_status when 'submitted' then array['review','cancel'] when 'under_review' then array['request_information','verify_serial','approve','reject','cancel']
    when 'more_information_required' then array['reject','cancel'] when 'approved' then array['receive','cancel'] when 'received' then array['inspect']
    when 'under_inspection' then array['select_resolution'] when 'resolution_in_progress' then array['select_resolution','resolve'] else '{}'::text[] end;
$$;

create function public.after_sales_claim_staff_action(p_admin uuid,p_claim uuid,p_revision integer,p_action text,p_input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.after_sales_claims%rowtype; policy jsonb; permission text; next_status text; text_value text; evidence_mode text;
begin
  permission:=public.after_sales_claim_action_permission(p_action);
  if permission is null or p_input is null or jsonb_typeof(p_input)<>'object' or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('text','resolution','require_evidence')) then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  if (p_input ? 'resolution' and p_action<>'select_resolution') or (p_input ? 'require_evidence' and p_action<>'request_information') then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  perform public.after_sales_claim_assert_actor(p_admin,permission);
  perform 1 from public.customer_order_items where id=(select item_id from public.after_sales_claims where id=p_claim) for update;
  select * into c from public.after_sales_claims where id=p_claim for update;
  if not found then raise exception 'Claim not found.' using errcode='P0002'; end if;
  if p_revision is null or c.revision<>p_revision then raise exception 'Claim retry conflict.' using errcode='40001'; end if;
  select v.policy into policy from public.after_sales_policy_versions v where v.id=c.policy_version_id;
  text_value:=btrim(coalesce(p_input->>'text',''));
  if char_length(text_value)>4000 or (p_action not in ('review','inspect') and text_value='') then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  if c.status in ('resolved','rejected','cancelled') and p_action<>'note' then raise exception 'Claim transition denied.' using errcode='23514'; end if;
  next_status:=case p_action when 'review' then 'under_review' when 'request_information' then 'more_information_required' when 'approve' then 'approved' when 'reject' then 'rejected'
    when 'receive' then 'received' when 'inspect' then 'under_inspection' when 'select_resolution' then 'resolution_in_progress' when 'resolve' then 'resolved' when 'cancel' then 'cancelled' else c.status end;
  if p_action not in ('note','verify_serial') and not(next_status=any(public.after_sales_claim_next(c.status))) then raise exception 'Claim transition denied.' using errcode='23514'; end if;
  if p_action='approve' and c.status<>'under_review' then raise exception 'Claim transition denied.' using errcode='23514'; end if;
  if p_action='review' and c.status<>'submitted' then raise exception 'Claim transition denied.' using errcode='23514'; end if;
  if p_action='verify_serial' and (c.claim_type<>'warranty' or c.status<>'under_review' or cardinality(c.customer_serials)<>c.quantity or c.serial_verification<>'unverified') then raise exception 'Claim transition denied.' using errcode='23514'; end if;
  if p_action='approve' and c.claim_type='warranty' and policy->>'warranty_serial'='required' and c.serial_verification not in ('verified','authoritative') then raise exception 'Claim serial review required.' using errcode='23514'; end if;
  if p_action in ('approve','select_resolution') and exists(select 1 from public.customer_orders o where o.id=c.order_id and (o.status in ('cancelled','refunded') or o.payment_status='refunded')) then raise exception 'Claim eligibility denied.' using errcode='23514'; end if;
  if p_action='select_resolution' and (p_input->>'resolution' is null or
    (c.claim_type='return' and p_input->>'resolution'<>'refund') or
    (c.claim_type='warranty' and not coalesce(policy->'warranty_resolutions' ? (p_input->>'resolution'),false))) then raise exception 'Claim resolution denied.' using errcode='23514'; end if;
  perform set_config('app.after_sales_claim_write','on',true);
  if p_action='request_information' then
    evidence_mode:=c.eligibility_snapshot->'eligibility'->>'evidence';
    if p_input ? 'require_evidence' and jsonb_typeof(p_input->'require_evidence')<>'boolean' then raise exception 'Invalid claim input.' using errcode='22023'; end if;
    if coalesce((p_input->>'require_evidence')::boolean,false) and evidence_mode='disabled' then raise exception 'Claim evidence disabled.' using errcode='23514'; end if;
    insert into public.after_sales_claim_information(claim_id,requested_by,prompt,require_evidence) values(c.id,p_admin,text_value,coalesce((p_input->>'require_evidence')::boolean,false));
  end if;
  update public.after_sales_claims set status=next_status,revision=revision+1,updated_at=clock_timestamp(),
    decision_text=case when p_action in ('approve','reject') then text_value else decision_text end,
    resolution=case when p_action='select_resolution' then p_input->>'resolution' else resolution end,
    resolution_text=case when p_action in ('select_resolution','resolve') then text_value else resolution_text end,
    serial_verification=case when p_action='verify_serial' then 'verified' else serial_verification end,
    serial_verified_by=case when p_action='verify_serial' then p_admin else serial_verified_by end,
    serial_verified_at=case when p_action='verify_serial' then clock_timestamp() else serial_verified_at end,
    serial_verification_reason=case when p_action='verify_serial' then text_value else serial_verification_reason end where id=c.id;
  perform public.after_sales_claim_emit(c.id,p_admin,'staff',p_action,text_value,p_action not in ('note','verify_serial'));
  perform set_config('app.after_sales_claim_write','off',true);
  return jsonb_build_object('id',c.id,'status',next_status,'revision',c.revision+1);
end $$;

create function public.after_sales_claim_customer_action(p_customer uuid,p_claim uuid,p_revision integer,p_action text,p_input jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.after_sales_claims%rowtype; r public.after_sales_claim_information%rowtype; ids text[]; files integer; text_value text;
begin
  perform public.after_sales_claim_assert_actor(p_customer);
  perform 1 from public.customer_order_items where id=(select item_id from public.after_sales_claims where id=p_claim and customer_id=p_customer) for update;
  select * into c from public.after_sales_claims where id=p_claim and customer_id=p_customer for update;
  if not found then raise exception 'Claim not found.' using errcode='P0002'; end if;
  if p_revision is null or c.revision<>p_revision then raise exception 'Claim retry conflict.' using errcode='40001'; end if;
  if p_action is null or p_action not in ('respond','cancel') or p_input is null or jsonb_typeof(p_input)<>'object' or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('text','attachment_ids')) then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  text_value:=btrim(coalesce(p_input->>'text',''));if char_length(text_value) not between 1 and 4000 then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  if (p_action='cancel' and c.status not in ('submitted','under_review','more_information_required','approved')) or (p_action='respond' and c.status<>'more_information_required') then raise exception 'Claim transition denied.' using errcode='23514'; end if;
  ids:=array(select jsonb_array_elements_text(coalesce(p_input->'attachment_ids','[]')));
  if cardinality(ids)>5 or cardinality(ids)<>(select count(distinct x) from unnest(ids) x) or (p_action='cancel' and cardinality(ids)>0) then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  if p_action='respond' then
    select * into r from public.after_sales_claim_information where claim_id=c.id and response_at is null for update;
    if not found then raise exception 'Claim transition denied.' using errcode='23514'; end if;
    select count(*) into files from public.after_sales_claim_evidence e where e.id::text=any(ids) and e.customer_id=p_customer and e.target_claim_id=c.id and e.request_id=r.id and e.claim_id is null and e.is_ready and e.removed_at is null and e.created_at>clock_timestamp()-interval '24 hours';
    if files<>cardinality(ids) or (r.require_evidence and files=0) then raise exception 'Claim evidence unavailable.' using errcode='22023'; end if;
  end if;
  perform set_config('app.after_sales_claim_write','on',true);
  if p_action='respond' then
    update public.after_sales_claim_information set response=text_value,response_at=clock_timestamp() where id=r.id;
    update public.after_sales_claim_evidence set claim_id=c.id where id::text=any(ids);
  else
    -- Pending requests retain their prompt; cancellation is recorded in timeline.
    null;
  end if;
  update public.after_sales_claims set status=case p_action when 'respond' then 'under_review' else 'cancelled' end,revision=revision+1,updated_at=clock_timestamp() where id=c.id;
  perform public.after_sales_claim_emit(c.id,p_customer,'customer',case p_action when 'respond' then 'customer_response' else 'cancel' end,text_value);
  if cardinality(ids)>0 then perform public.after_sales_claim_emit(c.id,p_customer,'customer','evidence_added'); end if;
  perform set_config('app.after_sales_claim_write','off',true);
  return jsonb_build_object('id',c.id,'revision',c.revision+1);
end $$;

create function public.after_sales_claim_reserve_evidence(p_customer uuid,p_item uuid,p_type text,p_id uuid,p_reason text,p_target uuid,p_metadata jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare context jsonb; c public.after_sales_claims%rowtype; r public.after_sales_claim_information%rowtype; e public.after_sales_claim_evidence%rowtype; path text; ext text;
begin
  perform public.after_sales_claim_assert_actor(p_customer);
  perform 1 from public.customer_order_items i join public.customer_orders o on o.id=i.order_id where i.id=p_item and o.user_id=p_customer for update of i;
  if not found then raise exception 'Claim item not found.' using errcode='P0002'; end if;
  if p_target is null then
    context:=public.after_sales_claim_context(p_customer,p_item,p_type,jsonb_strip_nulls(jsonb_build_object('reason_key',p_reason)));
    if not (context->>'can_start')::boolean then raise exception 'Claim eligibility denied.' using errcode='23514'; end if;
    if p_type='return' and not exists(select 1 from jsonb_array_elements(context->'reasons') x where x->>'key'=p_reason and (x->>'is_enabled')::boolean) then raise exception 'Claim eligibility denied.' using errcode='23514'; end if;
  else
    select * into c from public.after_sales_claims where id=p_target and customer_id=p_customer and item_id=p_item and claim_type=p_type for update;
    if not found or c.status<>'more_information_required' then raise exception 'Claim transition denied.' using errcode='23514'; end if;
    select * into r from public.after_sales_claim_information where claim_id=c.id and response_at is null;
    if not found then raise exception 'Claim transition denied.' using errcode='23514'; end if;
    context:=jsonb_build_object('evidence',c.eligibility_snapshot->'eligibility'->>'evidence');
    if (select count(*) from public.after_sales_claim_evidence where claim_id=c.id or (target_claim_id=c.id and removed_at is null))>=20 then raise exception 'Claim evidence limit.' using errcode='23514'; end if;
  end if;
  if context->>'evidence' is null or context->>'evidence'='disabled' then raise exception 'Claim evidence disabled.' using errcode='23514'; end if;
  ext:=case p_metadata->>'mime_type' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' when 'application/pdf' then 'pdf' end;
  if ext is null or p_id is null then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  path:=p_customer::text||'/'||p_item::text||'/'||p_id::text||'.'||ext;
  select * into e from public.after_sales_claim_evidence where id=p_id;
  if found then
    if e.customer_id<>p_customer or e.item_id<>p_item or e.claim_type<>p_type or e.target_claim_id is distinct from p_target or e.request_id is distinct from r.id or e.storage_path<>path or e.content_sha256 is distinct from p_metadata->>'content_sha256' or e.original_name is distinct from p_metadata->>'original_name' or e.size_bytes is distinct from (p_metadata->>'size_bytes')::integer or e.removed_at is not null or e.claim_id is not null then raise exception 'Claim retry conflict.' using errcode='40001'; end if;
    return jsonb_build_object('id',e.id,'storage_path',e.storage_path,'ready',e.is_ready);
  end if;
  if (select count(*) from public.after_sales_claim_evidence where customer_id=p_customer and item_id=p_item and claim_type=p_type and claim_id is null and removed_at is null)>=5 then raise exception 'Claim evidence limit.' using errcode='23514'; end if;
  perform set_config('app.after_sales_claim_write','on',true);
  insert into public.after_sales_claim_evidence(id,customer_id,item_id,claim_type,target_claim_id,request_id,original_name,storage_path,mime_type,size_bytes,content_sha256)
    values(p_id,p_customer,p_item,p_type,p_target,r.id,p_metadata->>'original_name',path,p_metadata->>'mime_type',(p_metadata->>'size_bytes')::integer,p_metadata->>'content_sha256');
  perform set_config('app.after_sales_claim_write','off',true);
  return jsonb_build_object('id',p_id,'storage_path',path,'ready',false);
end $$;

create function public.after_sales_claim_finish_evidence(p_customer uuid,p_id uuid,p_remove boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.after_sales_claim_evidence%rowtype;
begin
  perform public.after_sales_claim_assert_actor(p_customer);
  perform 1 from public.customer_order_items where id=(select item_id from public.after_sales_claim_evidence where id=p_id and customer_id=p_customer) for update;
  select * into e from public.after_sales_claim_evidence where id=p_id and customer_id=p_customer for update;
  if not found or e.claim_id is not null or e.removed_at is not null then raise exception 'Claim evidence unavailable.' using errcode='P0002'; end if;
  if not p_remove and e.target_claim_id is not null and not exists(select 1 from public.after_sales_claims c join public.after_sales_claim_information r on r.claim_id=c.id where c.id=e.target_claim_id and c.status='more_information_required' and r.id=e.request_id and r.response_at is null) then raise exception 'Claim transition denied.' using errcode='23514'; end if;
  perform set_config('app.after_sales_claim_write','on',true);
  update public.after_sales_claim_evidence set is_ready=case when p_remove then is_ready else true end,removed_at=case when p_remove then clock_timestamp() else removed_at end where id=e.id;
  perform set_config('app.after_sales_claim_write','off',true);
  return jsonb_build_object('id',e.id,'original_name',e.original_name,'mime_type',e.mime_type,'size_bytes',e.size_bytes,'storage_path',e.storage_path);
end $$;

create function public.after_sales_claim_staged_evidence(p_customer uuid,p_item uuid,p_type text,p_target uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  perform public.after_sales_claim_assert_actor(p_customer);
  if not exists(select 1 from public.customer_order_items i join public.customer_orders o on o.id=i.order_id where i.id=p_item and o.user_id=p_customer) then raise exception 'Claim item not found.' using errcode='P0002'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'original_name',e.original_name,'mime_type',e.mime_type,'size_bytes',e.size_bytes,
    'usable',e.is_ready and e.target_claim_id is not distinct from p_target and e.created_at>clock_timestamp()-interval '24 hours' and
      (p_target is null or exists(select 1 from public.after_sales_claims c join public.after_sales_claim_information r on r.claim_id=c.id where c.id=p_target and r.id=e.request_id and r.response_at is null and c.status='more_information_required'))) order by e.created_at),'[]') into result
    from public.after_sales_claim_evidence e where e.customer_id=p_customer and e.item_id=p_item and e.claim_type=p_type and e.claim_id is null and e.removed_at is null;
  return jsonb_build_object('items',result);
end $$;

create function public.after_sales_claim_read_evidence(p_actor uuid,p_id uuid,p_staff boolean default false) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare e public.after_sales_claim_evidence%rowtype;
begin
  perform public.after_sales_claim_assert_actor(p_actor,case when p_staff then 'claims.evidence' else null end);
  select * into e from public.after_sales_claim_evidence where id=p_id and is_ready and removed_at is null and
    ((not p_staff and customer_id=p_actor) or (p_staff and claim_id is not null));
  if not found then raise exception 'Claim evidence unavailable.' using errcode='P0002'; end if;
  return jsonb_build_object('id',e.id,'original_name',e.original_name,'storage_path',e.storage_path,'mime_type',e.mime_type,'size_bytes',e.size_bytes,'content_sha256',e.content_sha256);
end $$;

create function public.after_sales_claim_items(p_customer uuid,p_page integer default 1,p_order uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare items jsonb; total integer;
begin
  perform public.after_sales_claim_assert_actor(p_customer);
  if p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  select count(*) into total from public.customer_order_items i join public.customer_orders o on o.id=i.order_id where o.user_id=p_customer and (p_order is null or o.id=p_order);
  select coalesce(jsonb_agg(jsonb_build_object('return',public.after_sales_claim_context(p_customer,x.id,'return'),'warranty',public.after_sales_claim_context(p_customer,x.id,'warranty')) order by x.created_at desc,x.id),'[]') into items
    from (select i.id,o.created_at from public.customer_order_items i join public.customer_orders o on o.id=i.order_id where o.user_id=p_customer and (p_order is null or o.id=p_order) order by o.created_at desc,i.id limit 20 offset (p_page-1)*20) x;
  return jsonb_build_object('items',items,'total',total,'page',p_page);
end $$;

create function public.after_sales_claim_list(p_actor uuid,p_staff boolean default false,p_type text default null,p_status text default null,p_search text default '',p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare items jsonb; total integer;
begin
  perform public.after_sales_claim_assert_actor(p_actor,case when p_staff then 'claims.view' else null end);
  if p_page is null or p_page not between 1 and 10000 or char_length(p_search)>100 or (p_type is not null and p_type not in ('return','warranty')) then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  select count(*) into total from public.after_sales_claims c join public.customer_orders o on o.id=c.order_id join public.customer_profiles u on u.id=c.customer_id
    where (p_staff or c.customer_id=p_actor) and (p_type is null or c.claim_type=p_type) and (p_status is null or c.status=p_status)
    and (p_search='' or position(lower(p_search) in lower(c.reference||' '||coalesce(o.order_number,'')||case when p_staff then ' '||coalesce(u.full_name,'')||' '||u.email else '' end))>0);
  select coalesce(jsonb_agg(row order by row->>'created_at' desc,row->>'id'),'[]') into items from (
    select jsonb_build_object('id',c.id,'reference',c.reference,'claim_type',c.claim_type,'status',c.status,'quantity',c.quantity,'created_at',c.created_at,'updated_at',c.updated_at,'product_title',i.product_title,'order_number',o.order_number,'customer_name',case when p_staff then u.full_name else null end) row
    from public.after_sales_claims c join public.customer_orders o on o.id=c.order_id join public.customer_order_items i on i.id=c.item_id join public.customer_profiles u on u.id=c.customer_id
    where (p_staff or c.customer_id=p_actor) and (p_type is null or c.claim_type=p_type) and (p_status is null or c.status=p_status)
    and (p_search='' or position(lower(p_search) in lower(c.reference||' '||coalesce(o.order_number,'')||case when p_staff then ' '||coalesce(u.full_name,'')||' '||u.email else '' end))>0)
    order by c.created_at desc,c.id limit 20 offset (p_page-1)*20) q;
  return jsonb_build_object('items',items,'total',total,'page',p_page);
end $$;

create function public.after_sales_claim_detail(p_actor uuid,p_claim uuid,p_staff boolean default false,p_before uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c public.after_sales_claims%rowtype; item jsonb; events jsonb; attachments jsonb; requests jsonb; row_json jsonb; cursor_time timestamptz; more boolean; policy jsonb;
begin
  perform public.after_sales_claim_assert_actor(p_actor,case when p_staff then 'claims.view' else null end);
  select * into c from public.after_sales_claims where id=p_claim and (p_staff or customer_id=p_actor);
  if not found then raise exception 'Claim not found.' using errcode='P0002'; end if;
  if p_before is not null then
    select created_at into cursor_time from public.after_sales_claim_events where id=p_before and claim_id=c.id and (p_staff or customer_visible);
    if not found then raise exception 'Claim not found.' using errcode='P0002'; end if;
  end if;
  select jsonb_build_object('id',i.id,'product_title',i.product_title,'variant_name',i.variant_name,'variant_sku',i.variant_sku,'variant_code',i.variant_code,'quantity',i.quantity,'warranty_status',i.warranty_status,'warranty_duration_value',i.warranty_duration_value,'warranty_duration_unit',i.warranty_duration_unit) into item from public.customer_order_items i where i.id=c.item_id;
  select coalesce(jsonb_agg(x.row order by x.created_at desc,x.id desc),'[]') into events from (
    select e.id,e.created_at,jsonb_build_object('id',e.id,'event_type',e.event_type,'actor_kind',e.actor_kind,
      'actor_name',case when p_staff then coalesce(a.full_name,a.email,u.full_name) else null end,
      'body',e.body,'customer_visible',e.customer_visible,'status',e.status,'resolution',e.resolution,'created_at',e.created_at) row
    from public.after_sales_claim_events e left join public.admin_users a on a.id=e.actor_id and e.actor_kind='staff' left join public.customer_profiles u on u.id=e.actor_id and e.actor_kind='customer'
    where e.claim_id=c.id and (p_staff or e.customer_visible) and (p_before is null or (e.created_at,e.id)<(cursor_time,p_before)) order by e.created_at desc,e.id desc limit 100) x;
  select count(*)>100 into more from public.after_sales_claim_events e where e.claim_id=c.id and (p_staff or e.customer_visible) and (p_before is null or (e.created_at,e.id)<(cursor_time,p_before));
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'original_name',e.original_name,'mime_type',e.mime_type,'size_bytes',e.size_bytes,'created_at',e.created_at) order by e.created_at),'[]') into attachments from public.after_sales_claim_evidence e where e.claim_id=c.id and e.is_ready and e.removed_at is null
    and (not p_staff or exists(select 1 from public.admin_users a where a.id=p_actor and (a.role='owner' or coalesce((a.permissions->>'claims.evidence')::boolean,false))));
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'prompt',r.prompt,'require_evidence',r.require_evidence,'created_at',r.created_at,'response',r.response,'response_at',r.response_at) order by r.created_at desc),'[]') into requests from (select * from public.after_sales_claim_information where claim_id=c.id order by created_at desc limit 20) r;
  row_json:=jsonb_build_object('id',c.id,'reference',c.reference,'claim_type',c.claim_type,'quantity',c.quantity,'description',c.description,'reason_key',c.reason_key,'declarations',c.declarations,'customer_serials',c.customer_serials,'serial_verification',c.serial_verification,'status',c.status,'resolution',c.resolution,'decision_text',c.decision_text,'resolution_text',c.resolution_text,'revision',c.revision,'created_at',c.created_at,'updated_at',c.updated_at);
  if p_staff then row_json:=row_json||jsonb_build_object('policy_version_id',c.policy_version_id,'eligibility_snapshot',c.eligibility_snapshot,'admission',c.admission,'serial_verification_reason',c.serial_verification_reason); end if;
  select v.policy into policy from public.after_sales_policy_versions v where v.id=c.policy_version_id;
  return jsonb_build_object('claim',row_json,'item',item,
    'purchased_serials',(select coalesce(jsonb_agg(u.serial_number),'[]') from public.commerce_serialized_units u where u.customer_order_item_id=c.item_id and nullif(btrim(u.serial_number),'') is not null),
    'return_reason',(select jsonb_build_object('key',r->>'key','label_en',r->>'label_en','label_ar',r->>'label_ar') from jsonb_array_elements(coalesce(policy->'return_reasons','[]')) r where r->>'key'=c.reason_key),
    'order',(select jsonb_build_object('id',o.id,'order_number',o.order_number,'created_at',o.created_at) from public.customer_orders o where o.id=c.order_id),
    'customer',case when p_staff then (select jsonb_build_object('name',coalesce(nullif(concat_ws(' ',o.first_name,o.last_name),''),u.full_name),'email',coalesce(o.email,u.email),'phone',o.phone) from public.customer_orders o join public.customer_profiles u on u.id=o.user_id where o.id=c.order_id) else null end,
    'dates',case when p_staff then public.after_sales_order_dates(c.order_id) else null end,
    'provenance',case when p_staff then (select jsonb_build_object('version_key',v.version_key,'captured_at',v.created_at) from public.after_sales_policy_versions v where v.id=c.policy_version_id) else null end,
    'allowed_actions',case when p_staff then (select coalesce(jsonb_agg(x.action),'[]') from unnest(public.after_sales_claim_actions(c.status)) x(action) join public.admin_users a on a.id=p_actor
      where (a.role='owner' or coalesce((a.permissions->>public.after_sales_claim_action_permission(x.action))::boolean,false))
      and (x.action<>'verify_serial' or (c.claim_type='warranty' and c.serial_verification='unverified' and cardinality(c.customer_serials)=c.quantity))
      and (x.action<>'approve' or c.claim_type<>'warranty' or policy->>'warranty_serial'<>'required' or c.serial_verification in ('verified','authoritative'))) else '[]'::jsonb end,
    'allowed_resolutions',case when c.claim_type='return' then '["refund"]'::jsonb else policy->'warranty_resolutions' end,
    'logistics_ready',c.status='approved','evidence',c.eligibility_snapshot->'eligibility'->>'evidence','events',events,'has_more_events',more,'attachments',attachments,'information',requests);
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('after-sales-evidence','after-sales-evidence',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf']);
-- Restrict this bucket even if an existing project has a broad permissive rule.
alter table storage.objects enable row level security;
create policy after_sales_evidence_server_boundary on storage.objects as restrictive for all to anon,authenticated
  using(bucket_id<>'after-sales-evidence') with check(bucket_id<>'after-sales-evidence');
-- No browser grants to this bucket. Retrieval uses authorized server proxies.
-- Retain claims/evidence on reset: existing dependency guards block erasing their
-- linked orders/customers. Empty retained tables do not break other reset scopes.
do $reset$ declare definition text; anchor text:='''after_sales_policy_versions'']'; begin
  definition:=pg_get_functiondef('public.system_reset_plan(uuid,text)'::regprocedure);
  if position(anchor in definition)=0 then raise exception 'Review reset claim integration before migrating.'; end if;
  execute replace(definition,anchor,'''after_sales_policy_versions'', ''after_sales_claims'', ''after_sales_claim_events'', ''after_sales_claim_information'', ''after_sales_claim_evidence'']');
end $reset$;
do $$ declare f record; begin
  for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'after_sales_claim_%' loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
    if f.proname not in ('after_sales_claim_guard','after_sales_claim_emit','after_sales_claim_assert_actor','after_sales_claim_next','after_sales_claim_actions','after_sales_claim_action_permission') then execute format('grant execute on function %s to service_role',f.signature); end if;
  end loop;
end $$;
commit;
