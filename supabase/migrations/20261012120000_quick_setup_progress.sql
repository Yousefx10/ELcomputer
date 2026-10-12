begin;

-- Nonsecret installation metadata only. Provider settings remain authoritative.
create table public.quick_setup_state (
 singleton boolean primary key default true check(singleton),
 installation_id uuid not null unique default gen_random_uuid(),
 revision bigint not null default 0 check(revision>=0),
 selections jsonb not null default '{}' check(jsonb_typeof(selections)='object' and selections-array['pdc','daftra','vodafone','brevo','paymob','paypal','oauth','live_chat']='{}' and not jsonb_path_exists(selections,'$.* ? (@.type() != "boolean")')),
 updated_at timestamptz not null default clock_timestamp()
);
create table public.quick_setup_revisions (
 domain text primary key check(domain in ('application','infrastructure','branding','contact','policies','payment_methods','paymob','paypal','express_payments','shipping','daftra','vodafone','brevo','automation','authentication','oauth','live_chat')),
 revision bigint not null default 0 check(revision>=0)
);
create table public.quick_setup_events (
 id bigint generated always as identity primary key,
 state_revision bigint not null unique,
 actor_id uuid not null, -- No FK: retained history must survive other-admin deletion.
 action text not null check(action in ('selection','capture','acknowledge')),
 key text not null,
 selected boolean,
 outcome text not null check(outcome in ('selected','excluded','verified','unverified','failed','stale','unavailable','acknowledged','revoked')),
 source text not null check(source in ('owner_selection','existing_check','configuration_snapshot','owner_report')),
 basis_token text check(basis_token ~ '^[0-9a-f]{64}$'),
 basis_revisions jsonb not null default '{}' check(jsonb_typeof(basis_revisions)='object'),
 checked_at timestamptz,
 expires_at timestamptz,
 created_at timestamptz not null default clock_timestamp(),
 check((action='selection' and key in ('pdc','daftra','vodafone','brevo','paymob','paypal','oauth','live_chat') and selected is not null and outcome in ('selected','excluded') and source='owner_selection' and basis_token is null)
    or (action='capture' and key in ('application','infrastructure','branding','contact','policies','payment_methods','paymob','paypal','express_payments','shipping','daftra','vodafone','brevo','automation','authentication','oauth','live_chat') and selected is null and outcome in ('verified','unverified','failed','stale','unavailable') and source in ('existing_check','configuration_snapshot') and basis_token is not null)
    or (action='acknowledge' and key in ('auth','storage','commerce','providers','workers','backup','migration_history') and selected is null and outcome in ('acknowledged','revoked') and source='owner_report' and basis_token is not null))
);
create index quick_setup_events_latest on public.quick_setup_events(action,key,id desc);
create index quick_setup_events_owner_recent on public.quick_setup_events(actor_id,created_at desc);
create index quick_setup_events_daftra_binding on public.quick_setup_events(checked_at,basis_token) where action='capture' and key='daftra' and source='existing_check';
insert into public.quick_setup_state(singleton) values(true);
insert into public.quick_setup_revisions(domain) select unnest(array['application','infrastructure','branding','contact','policies','payment_methods','paymob','paypal','express_payments','shipping','daftra','vodafone','brevo','automation','authentication','oauth','live_chat']);

alter table public.quick_setup_state enable row level security;
alter table public.quick_setup_revisions enable row level security;
alter table public.quick_setup_events enable row level security;
create policy quick_setup_server_boundary on public.quick_setup_state as restrictive for all to anon,authenticated using(false) with check(false);
create policy quick_setup_server_boundary on public.quick_setup_revisions as restrictive for all to anon,authenticated using(false) with check(false);
create policy quick_setup_server_boundary on public.quick_setup_events as restrictive for all to anon,authenticated using(false) with check(false);
revoke all on public.quick_setup_state,public.quick_setup_revisions,public.quick_setup_events from public,anon,authenticated,service_role;
revoke all on sequence public.quick_setup_events_id_seq from public,anon,authenticated,service_role;
grant select on public.quick_setup_state,public.quick_setup_revisions,public.quick_setup_events to service_role;

create function public.quick_setup_guard_write() returns trigger language plpgsql set search_path='' as $$
begin
 if coalesce(current_setting('app.quick_setup_write',true),'')<>'on' then raise exception 'Setup writes require the server command.' using errcode='42501';end if;
 if tg_table_name='quick_setup_events' and tg_op<>'INSERT' then raise exception 'Setup history is append-only.' using errcode='42501';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger quick_setup_write_guard before insert or update or delete on public.quick_setup_state for each row execute function public.quick_setup_guard_write();
create trigger quick_setup_write_guard before insert or update or delete on public.quick_setup_revisions for each row execute function public.quick_setup_guard_write();
create trigger quick_setup_write_guard before insert or update or delete on public.quick_setup_events for each row execute function public.quick_setup_guard_write();

-- One MVCC snapshot: state, generations, latest evidence and bounded history.
create view public.quick_setup_snapshot with(security_invoker=true,security_barrier=true) as
select s.singleton,s.installation_id,s.revision,s.selections,s.updated_at,
 (select jsonb_object_agg(domain,revision order by domain) from public.quick_setup_revisions) as revisions,
 (select coalesce(jsonb_agg(to_jsonb(e) order by e.id desc),'[]') from (select distinct on(action,key) * from public.quick_setup_events order by action,key,id desc) e) as latest,
 (select coalesce(jsonb_agg(to_jsonb(e) order by e.id desc),'[]') from (select * from public.quick_setup_events order by id desc limit 50) e) as history
from public.quick_setup_state s;
revoke all on public.quick_setup_snapshot from public,anon,authenticated,service_role;
grant select on public.quick_setup_snapshot to service_role;

-- Configuration generations prevent ABA reuse, including deletion/reinsertion.
-- No values, plaintext hashes, credentials or provider responses are retained.
create function public.quick_setup_configuration_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare a jsonb; b jsonb; fields text[]; previous text:=current_setting('app.quick_setup_write',true);
begin
 if tg_op='TRUNCATE' then a:=null;b:=null;
 else
  a:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
  b:=case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
  if tg_nargs>2 and coalesce(a->>tg_argv[2],'')<>tg_argv[3] and coalesce(b->>tg_argv[2],'')<>tg_argv[3] then return null;end if;
  if tg_argv[1]='*' then a:=a-array['updated_at','updated_by','next_dispatch_at'];b:=b-array['updated_at','updated_by','next_dispatch_at'];
  elsif tg_argv[1] like 'prefix:%' then
   select coalesce(jsonb_object_agg(k,v),'{}') into a from jsonb_each(a) x(k,v) where starts_with(k,substr(tg_argv[1],8));
   select coalesce(jsonb_object_agg(k,v),'{}') into b from jsonb_each(b) x(k,v) where starts_with(k,substr(tg_argv[1],8));
  else
   fields:=string_to_array(tg_argv[1],',');
   select coalesce(jsonb_object_agg(k,a->k),'{}') into a from unnest(fields) k;
   select coalesce(jsonb_object_agg(k,b->k),'{}') into b from unnest(fields) k;
  end if;
  if tg_op='UPDATE' and a is not distinct from b then return null;end if;
 end if;
 perform set_config('app.quick_setup_write','on',true);
 update public.quick_setup_revisions set revision=revision+1 where domain=tg_argv[0];
 perform set_config('app.quick_setup_write',coalesce(previous,''),true);
 return null;
end $$;

do $$ declare m record;begin
 for m in select * from (values
 ('site_settings','application','key','key','default'),
 ('site_settings','branding','site_name,site_logo_url','key','default'),
 ('site_settings','contact','footer_email,footer_phone,footer_address','key','default'),
 ('site_settings','payment_methods','prefix:payment_','key','default'),
 ('site_settings','paypal','payment_paypal_enabled','key','default'),
 ('site_settings','daftra','erp_mode,erp_state_version,daftra_connection_status,daftra_last_checked_at,daftra_tested_revision','key','default'),
 ('site_settings','authentication','auth_facebook_enabled','key','default'),
 ('site_settings','oauth','auth_facebook_enabled','key','default'),
 ('erp_provider_settings','daftra','*','id','daftra'),
 ('sms_provider_settings','vodafone','*','id','vodafone'),
 ('email_provider_settings','brevo','*','id','brevo'),
 ('shipping_provider_settings','shipping','*','id','pdc'),
 ('commerce_shipping_companies','shipping','*',null,null),
 ('shipping_city_mappings','shipping','*',null,null),
 ('shipping_status_mappings','shipping','*',null,null),
 ('after_sales_policies','policies','*',null,null),
 ('after_sales_return_reasons','policies','*',null,null),
 ('sms_order_event_settings','automation','*',null,null),
 ('sms_templates','automation','*',null,null),
 ('email_templates','automation','*',null,null),
 ('after_sales_communication_settings','automation','*',null,null),
 ('chat_settings','live_chat','*',null,null)
 ) x(t,d,f,k,v) order by t,d loop
  if m.k is null then execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.quick_setup_configuration_changed(%L,%L)','quick_setup_'||m.d,m.t,m.d,m.f);
  else execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.quick_setup_configuration_changed(%L,%L,%L,%L)','quick_setup_'||m.d,m.t,m.d,m.f,m.k,m.v);end if;
  execute format('create trigger %I after truncate on public.%I for each statement execute function public.quick_setup_configuration_changed(%L,%L)','quick_setup_truncate_'||m.d,m.t,m.d,m.f);
 end loop;
end $$;

-- The database also enforces the complete dependency set for each command.
create function public.quick_setup_domains(p_action text,p_key text) returns text[] language sql immutable set search_path='' as $$
 select case
  when p_action='capture' and p_key='paymob' then array['paymob','payment_methods']
  when p_action='capture' and p_key in ('vodafone','brevo') then array[p_key,'automation']
  when p_action='capture' and p_key in ('application','infrastructure','branding','contact','policies','payment_methods','paymob','paypal','express_payments','shipping','daftra','vodafone','brevo','automation','authentication','oauth','live_chat') then array[p_key]
  when p_action='acknowledge' then case p_key
   when 'auth' then array['authentication','oauth']
   when 'storage' then array['application','authentication','infrastructure']
   when 'commerce' then array['application','payment_methods','paymob','shipping','daftra','policies']
   when 'providers' then array['shipping','daftra','vodafone','brevo','paymob','paypal','oauth','live_chat','automation']
   when 'workers' then array['shipping','daftra','vodafone','brevo','automation']
   when 'backup' then array['infrastructure']
   when 'migration_history' then array['application'] end
 end
$$;

create function public.quick_setup_mutate(p_owner uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.quick_setup_state; r record; k text:=p_input->>'key'; action text:=p_input->>'action'; outcome text; source text;
 basis jsonb:=coalesce(p_input->'revisions','{}'); expected text[]; checked timestamptz; expires timestamptz; previous text:=current_setting('app.quick_setup_write',true);
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Server authorization required.' using errcode='42501';end if;
 perform 1 from public.admin_users where id=p_owner and role='owner' and is_active for share;
 if not found then raise exception 'Active owner required.' using errcode='42501';end if;
 if jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>4096 or exists(select 1 from jsonb_object_keys(p_input) keys(name) where keys.name not in ('action','key','revision','selected','acknowledged','basis_token','revisions','outcome','source')) then raise exception 'Invalid setup command.' using errcode='22023';end if;
 select * into strict s from public.quick_setup_state where singleton for update;
 if jsonb_typeof(p_input->'revision') is distinct from 'number' or (p_input->>'revision') !~ '^[0-9]+$' or (p_input->>'revision')::bigint<>s.revision then raise exception 'Setup revision conflict.' using errcode='40001';end if;
 if (select count(*) from public.quick_setup_events where actor_id=p_owner and created_at>clock_timestamp()-interval '1 minute')>=30 then raise exception 'Setup update limit.' using errcode='54000';end if;
 if action='selection' then
  if k not in ('pdc','daftra','vodafone','brevo','paymob','paypal','oauth','live_chat') or jsonb_typeof(p_input->'selected') is distinct from 'boolean' or p_input ? 'basis_token' or basis<>'{}' or p_input ? 'outcome' or p_input ? 'source' or p_input ? 'acknowledged' then raise exception 'Invalid setup selection.' using errcode='22023';end if;
  perform 1 from public.quick_setup_revisions where domain=case k when 'pdc' then 'shipping' else k end for update;
  outcome:=case when (p_input->>'selected')::boolean then 'selected' else 'excluded' end;source:='owner_selection';
 elsif action in ('capture','acknowledge') then
  if jsonb_typeof(basis) is distinct from 'object' or basis='{}' or (p_input->>'basis_token') is null or (p_input->>'basis_token') !~ '^[0-9a-f]{64}$' or p_input ? 'selected' then raise exception 'Invalid setup evidence.' using errcode='22023';end if;
  expected:=public.quick_setup_domains(action,k);
  if expected is null or basis-expected<>'{}' or exists(select 1 from unnest(expected) domain where not basis ? domain) then raise exception 'Incomplete setup dependencies.' using errcode='22023';end if;
  if exists(select 1 from jsonb_each(basis) e where e.key not in (select domain from public.quick_setup_revisions) or jsonb_typeof(e.value)<>'number' or e.value::text !~ '^[0-9]+$') then raise exception 'Invalid setup generations.' using errcode='22023';end if;
  -- Always lock in domain order; configuration triggers use the same order.
  for r in select domain,revision from public.quick_setup_revisions where basis ? domain order by domain for update loop
   if r.revision<>(basis->>r.domain)::bigint then raise exception 'Configuration changed.' using errcode='40001';end if;
  end loop;
  if action='acknowledge' then
   if k not in ('auth','storage','commerce','providers','workers','backup','migration_history') or jsonb_typeof(p_input->'acknowledged') is distinct from 'boolean' or p_input ? 'outcome' or p_input ? 'source' then raise exception 'Invalid setup acknowledgement.' using errcode='22023';end if;
   outcome:=case when (p_input->>'acknowledged')::boolean then 'acknowledged' else 'revoked' end;source:='owner_report';checked:=clock_timestamp();expires:=checked+interval '7 days';
  else
   outcome:=p_input->>'outcome';source:=p_input->>'source';
   if outcome is null or outcome not in ('verified','unverified','failed','stale','unavailable') or source is null or source not in ('existing_check','configuration_snapshot') or p_input ? 'acknowledged' then raise exception 'Invalid setup snapshot.' using errcode='22023';end if;
   if source='existing_check' then
    if k<>'daftra' then raise exception 'Unsupported verification source.' using errcode='22023';end if;
    select daftra_last_checked_at into checked from public.site_settings where key='default';
    if outcome='verified' and not exists(select 1 from public.site_settings settings join public.erp_provider_settings credentials on credentials.id='daftra' and credentials.credential_revision>0 where settings.key='default' and settings.daftra_connection_status='connected' and settings.daftra_tested_revision=credentials.credential_revision and settings.daftra_last_checked_at<=clock_timestamp() and settings.daftra_last_checked_at>clock_timestamp()-interval '24 hours') then raise exception 'Current verified connection evidence required.' using errcode='40001';end if;
    if outcome='verified' and exists(select 1 from public.quick_setup_events prior where prior.action='capture' and prior.key='daftra' and prior.source='existing_check' and prior.checked_at=checked and (prior.basis_token<>p_input->>'basis_token' or prior.outcome='stale')) then outcome:='stale';end if;
    if checked is null then raise exception 'Connection evidence unavailable.' using errcode='40001';end if;
    expires:=checked+interval '24 hours';
   else
    if outcome in ('verified','failed') then raise exception 'Saved configuration cannot verify connectivity.' using errcode='22023';end if;
    checked:=clock_timestamp();expires:=checked+interval '24 hours';
   end if;
  end if;
 else raise exception 'Unsupported setup action.' using errcode='22023';end if;
 perform set_config('app.quick_setup_write','on',true);
 if action='selection' and coalesce((s.selections->>k)::boolean,false)<>(p_input->>'selected')::boolean then
  update public.quick_setup_revisions set revision=revision+1 where domain=case k when 'pdc' then 'shipping' else k end;
 end if;
 update public.quick_setup_state set revision=revision+1,selections=case when action='selection' then selections||jsonb_build_object(k,(p_input->>'selected')::boolean) else selections end,updated_at=clock_timestamp() where singleton returning * into s;
 insert into public.quick_setup_events(state_revision,actor_id,action,key,selected,outcome,source,basis_token,basis_revisions,checked_at,expires_at)
 values(s.revision,p_owner,action,k,case when action='selection' then (p_input->>'selected')::boolean else null end,outcome,source,p_input->>'basis_token',basis,checked,expires);
 insert into public.admin_activity_logs(admin_user_id,author_name,author_email,author_role,action_key,description,metadata)
 select a.id,coalesce(nullif(a.full_name,''),a.email),a.email,a.role,'settings.quick_setup.'||action,'Updated Quick Setup.',jsonb_build_object('key',k,'revision',s.revision,'outcome',outcome,'source',source) from public.admin_users a where a.id=p_owner;
 perform set_config('app.quick_setup_write',coalesce(previous,''),true);
 return jsonb_build_object('revision',s.revision);
end $$;

-- Retain identity, selections and append-only evidence in every reset scope.
-- A completed database reset invalidates affected confirmations, never replays.
create function public.quick_setup_reset_invalidation() returns trigger language plpgsql security definer set search_path='' as $$
declare domains text[]; previous text:=current_setting('app.quick_setup_write',true);
begin
 domains:=case new.scope
  when 'full' then array(select domain from public.quick_setup_revisions order by domain)
  when 'content' then array['application','authentication','branding','contact','daftra','oauth','payment_methods','paypal','infrastructure']
  when 'media' then array['branding','infrastructure']
  when 'orders' then array['payment_methods','shipping','infrastructure']
  when 'commerce' then array['payment_methods','shipping','daftra','infrastructure']
  when 'products' then array['policies','shipping','infrastructure']
  when 'documents' then array['authentication','infrastructure']
  else array['infrastructure'] end;
 perform 1 from public.quick_setup_revisions where domain=any(domains) order by domain for update;
 perform set_config('app.quick_setup_write','on',true);
 update public.quick_setup_revisions set revision=revision+1 where domain=any(domains);
 perform set_config('app.quick_setup_write',coalesce(previous,''),true);return new;
end $$;
create trigger quick_setup_reset_invalidation after insert on public.system_reset_runs for each row execute function public.quick_setup_reset_invalidation();
do $reset$ declare definition text; anchor text:='''after_sales_communications'']';begin
 definition:=pg_get_functiondef('public.system_reset_plan(uuid,text)'::regprocedure);
 if position(anchor in definition)=0 then raise exception 'Review Quick Setup reset retention before migrating.';end if;
 execute replace(definition,anchor,'''after_sales_communications'', ''quick_setup_state'', ''quick_setup_revisions'', ''quick_setup_events'']');
end $reset$;
revoke all on function public.quick_setup_guard_write(),public.quick_setup_configuration_changed(),public.quick_setup_reset_invalidation(),public.quick_setup_domains(text,text),public.quick_setup_mutate(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.quick_setup_mutate(uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
