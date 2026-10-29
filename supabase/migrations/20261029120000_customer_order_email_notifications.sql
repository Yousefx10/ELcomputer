-- 104 candidate: customer order receipts, dormant. No historical capture or sends.
begin;
set local lock_timeout='5s';

create table public.order_email_settings (
 id boolean primary key default true check(id), is_enabled boolean not null default false,
 revision integer not null default 0 check(revision>=0), enabled_since timestamptz,
 updated_by uuid references public.admin_users(id) on delete restrict,
 updated_at timestamptz not null default clock_timestamp()
);
insert into public.order_email_settings(id) values(true);
create table public.order_email_events (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.customer_orders(id) on delete restrict,
 event_type text not null check(event_type in ('order_received','payment_verified')),
 locale text not null check(locale in ('en','ar')), recipient text not null,
 payload jsonb not null, copy_version integer not null default 1 check(copy_version=1),
 setting_revision integer not null, provider_revision integer not null,
 state text not null default 'pending' check(state in ('pending','preparing','queued','suppressed')),
 reason text, email_message_id uuid unique references public.email_messages(id) on delete restrict,
 attempts integer not null default 0 check(attempts between 0 and 3), work_token uuid, started_at timestamptz,
 available_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp()+interval '10 minutes',
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 unique(order_id,event_type), check((state='preparing')=(work_token is not null)),
 check((state='suppressed')=(reason is not null))
);
create index order_email_pending on public.order_email_events(available_at,created_at,id) where state='pending';

create function private.order_email_paid(o public.customer_orders) returns boolean
language sql stable security definer set search_path='' as $$
 select o.payment_method='card' and o.payment_status='paid' and o.amount_paid=o.total_amount
 and o.paid_at is not null and o.status not in ('cancelled','refunded') and o.currency='EGP'
 and exists(select 1 from public.payment_attempts a where a.order_id=o.id and a.provider='paymob'
  and a.method='card' and a.mode='live' and a.status='succeeded' and a.paid_at is not null
  and a.amount_minor=o.total_amount*100 and a.currency=o.currency
  and (select count(*) from public.payment_transactions t where t.attempt_id=a.id and t.provider='paymob' and t.status='succeeded')=1)
 and (select count(*) from public.payment_transactions t join public.payment_attempts a on a.id=t.attempt_id
  where a.order_id=o.id and t.provider='paymob' and t.status='succeeded')=1;
$$;
create function private.order_email_reason(e public.order_email_events) returns text
language plpgsql stable security definer set search_path='' as $$
declare o public.customer_orders;s public.order_email_settings;p public.email_provider_settings;
begin
 select * into s from public.order_email_settings where id;
 if not coalesce(s.is_enabled,false) or s.revision is distinct from e.setting_revision or e.created_at<s.enabled_since then return 'order_email_disabled_or_changed';end if;
 if e.expires_at<=clock_timestamp() then return 'expired';end if;
 select * into p from public.email_provider_settings where id='brevo';
 if not coalesce(public.email_ready(p),false) or p.revision is distinct from e.provider_revision then return 'provider_disabled_or_changed';end if;
 select * into o from public.customer_orders where id=e.order_id;
 if not found or o.user_id is null or o.checkout_cart_id is null or o.is_preorder or o.erp_owner<>'built_in'
  or o.payment_method not in ('card','cash') or o.currency<>'EGP'
  or lower(o.email) is distinct from e.recipient or o.total_amount::text is distinct from e.payload->>'total_amount'
  or o.payment_method is distinct from e.payload->>'payment_method'
  or o.status in ('cancelled','refunded') then return 'order_changed';end if;
 if e.event_type='payment_verified' and private.order_email_paid(o) is distinct from true then return 'payment_unverified';end if;
 if e.event_type='order_received' and o.payment_status<>'pending' then return 'receipt_superseded';end if;
 return null;
end $$;

create function private.capture_order_email() returns trigger
language plpgsql security definer set search_path='' as $$
declare s public.order_email_settings;p public.email_provider_settings;kind text;
begin
 -- Disabled capture creates no sendable backlog and performs no historical scan.
 select * into s from public.order_email_settings where id;
 if not coalesce(s.is_enabled,false) then return new;end if;
 select * into p from public.email_provider_settings where id='brevo';
 if not coalesce(public.email_ready(p),false) then return new;end if;
 if new.user_id is null or new.checkout_cart_id is null or new.is_preorder or new.erp_owner<>'built_in'
  or new.payment_method not in ('card','cash') or new.currency<>'EGP' or new.email is null then return new;end if;
 if tg_op='INSERT' and new.payment_status='pending' then kind:='order_received';
 elsif tg_op='UPDATE' and new.payment_status='paid' and old.payment_status is distinct from new.payment_status
  and private.order_email_paid(new) then kind:='payment_verified';else return new;end if;
 perform set_config('app.order_email_write','on',true);
 insert into public.order_email_events(order_id,event_type,locale,recipient,payload,setting_revision,provider_revision)
 values(new.id,kind,new.sms_locale,lower(new.email),jsonb_build_object('id',new.id,'order_number',new.order_number,
  'payment_method',new.payment_method,'total_amount',new.total_amount::text,'currency',new.currency),s.revision,p.revision)
 on conflict(order_id,event_type) do nothing;
 return new;
exception when others then
 -- Notification storage must never undo a checkout or authoritative settlement.
 -- Preserve a sanitized operational failure; no recipient/body/raw error in logs.
 raise log 'Order email capture failed (SQLSTATE %).',sqlstate;
 return new;
end $$;
create trigger capture_order_email after insert or update of payment_status on public.customer_orders
for each row execute function private.capture_order_email();

create function public.order_email_configure(p_actor uuid,p_revision integer,p_enabled boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.order_email_settings;p public.email_provider_settings;
begin
 perform public.email_assert_staff(p_actor,'email.settings.manage');
 if p_enabled is null then raise exception 'Invalid email setting.' using errcode='22023';end if;
 select * into p from public.email_provider_settings where id='brevo' for update;
 select * into s from public.order_email_settings where id for update;
 if s.revision is distinct from p_revision then raise exception 'Order email settings changed.' using errcode='40001';end if;
 if p_enabled then
  perform public.email_assert_staff(p_actor,'email.transactional.send');
  if public.email_ready(p) is distinct from true then raise exception 'Email provider unavailable.' using errcode='55000';end if;
 end if;
 perform set_config('app.order_email_write','on',true);
 update public.order_email_settings set is_enabled=p_enabled,revision=revision+1,
  enabled_since=case when p_enabled then clock_timestamp() else null end,updated_at=clock_timestamp(),updated_by=p_actor where id returning * into s;
 update public.order_email_events set state='suppressed',reason='configuration_changed',work_token=null,started_at=null,updated_at=clock_timestamp()
  where state in ('pending','preparing');
 perform public.email_audit(p_actor,'email.order.settings',jsonb_build_object('enabled',p_enabled,'revision',s.revision));
 return jsonb_build_object('is_enabled',s.is_enabled,'revision',s.revision);
end $$;

create function public.order_email_take() returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.order_email_events;failure text;
begin
 perform 1 from public.email_provider_settings where id='brevo' for update;
 perform set_config('app.order_email_write','on',true);
 update public.order_email_events set state='pending',work_token=null,started_at=null where id in
  (select id from public.order_email_events where state='preparing' and started_at<clock_timestamp()-interval '2 minutes' order by started_at,id limit 100);
 for e in select * from public.order_email_events where state in ('pending','preparing') order by created_at,id limit 100 for update loop
  failure:=coalesce(private.order_email_reason(e),case when e.attempts>=3 then 'preparation_limit' end);
  if failure is not null then update public.order_email_events set state='suppressed',reason=failure,work_token=null,started_at=null,updated_at=clock_timestamp() where id=e.id;end if;
 end loop;
 select * into e from public.order_email_events where state='pending' and available_at<=clock_timestamp() order by created_at,id for update skip locked limit 1;
 if not found then return null;end if;
 update public.order_email_events set state='preparing',work_token=gen_random_uuid(),started_at=clock_timestamp(),attempts=attempts+1,updated_at=clock_timestamp() where id=e.id returning * into e;
 return to_jsonb(e);
end $$;
create function public.order_email_finish(p_id uuid,p_token uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare e public.order_email_events;
begin
 perform 1 from public.email_provider_settings where id='brevo' for update;
 select * into e from public.order_email_events where id=p_id for update;
 if not found or e.state<>'preparing' or p_token is null or e.work_token is distinct from p_token then return;end if;
 if p_reason is null or p_reason not in ('storage_error','invalid_content','provider_unavailable') then raise exception 'Invalid email result.' using errcode='22023';end if;
 perform set_config('app.order_email_write','on',true);
 if p_reason='storage_error' and e.attempts<3 and e.expires_at>clock_timestamp()+interval '30 seconds' then
  update public.order_email_events set state='pending',work_token=null,started_at=null,available_at=clock_timestamp()+interval '30 seconds',updated_at=clock_timestamp() where id=e.id;
 else update public.order_email_events set state='suppressed',reason=p_reason,work_token=null,started_at=null,updated_at=clock_timestamp() where id=e.id;end if;
end $$;
create function public.order_email_enqueue(p_id uuid,p_token uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.order_email_events;failure text;result jsonb;p public.email_provider_settings;
begin
 select * into p from public.email_provider_settings where id='brevo' for update;
 select * into e from public.order_email_events where id=p_id for update;
 if not found then raise exception 'Unknown order email.' using errcode='22023';end if;
 if e.state='queued' then return jsonb_build_object('id',e.email_message_id,'state','queued','reused',true);end if;
 if e.state<>'preparing' or p_token is null or e.work_token is distinct from p_token or e.started_at<clock_timestamp()-interval '2 minutes' then raise exception 'Order email preparation expired.' using errcode='40001';end if;
 perform set_config('app.order_email_write','on',true);failure:=private.order_email_reason(e);
 if failure is not null then update public.order_email_events set state='suppressed',reason=failure,work_token=null,started_at=null,updated_at=clock_timestamp() where id=e.id;return jsonb_build_object('state','suppressed');end if;
 if p_payload->>'idempotency_key' is distinct from e.id::text or p_payload->>'recipient' is distinct from e.recipient
  or p_payload->>'locale' is distinct from e.locale or p_payload->>'business_reference' is distinct from e.payload->>'order_number'
  or p_payload->>'classification' is distinct from 'transactional' or p_payload->>'source' is distinct from 'service'
  or p_payload->>'category' is distinct from 'orders:'||e.event_type or p_payload->>'sender' is distinct from p.config->>'transactional_sender'
  or p_payload->>'template_key' is not null or p_payload->>'unsubscribe_hash' is not null or p_payload->>'actor_id' is not null
  then raise exception 'Order email context mismatch.' using errcode='22023';end if;
 result:=public.email_command('enqueue',p_payload,null);
 update public.order_email_events set state=case when result->>'state'='suppressed' then 'suppressed' else 'queued' end,
  reason=case when result->>'state'='suppressed' then 'recipient_restricted' end,email_message_id=(result->>'id')::uuid,
  work_token=null,started_at=null,updated_at=clock_timestamp() where id=e.id;
 return result;
end $$;

-- Reuse the final-dispatch extension used by Claims; do not replace its guards.
alter function public.email_command(text,jsonb,uuid) rename to email_command_before_order_emails;
create function public.email_command(p_action text,p_input jsonb default '{}',p_actor uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.order_email_events;failure text;result jsonb;
begin
 if p_action='dispatch' then
  perform 1 from public.email_provider_settings where id='brevo' for update;
  select * into e from public.order_email_events where email_message_id=(p_input->>'id')::uuid;
  if found then
   failure:=private.order_email_reason(e);
   if failure is not null then
    result:=public.email_command_before_order_emails('finish',p_input||jsonb_build_object('state','suppressed','error_category',failure),null);
    return jsonb_build_object('allowed',false,'state',case when result->>'matched'='true' then 'suppressed' else 'uncertain' end);
   end if;
  end if;
 end if;
 return public.email_command_before_order_emails(p_action,p_input,p_actor);
end $$;

create function private.order_email_write_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op in ('DELETE','TRUNCATE') or current_setting('app.order_email_write',true) is distinct from 'on' then raise exception 'Canonical order email operation required.' using errcode='42501';end if;
 if tg_table_name='order_email_events' and tg_op='UPDATE' and
  (to_jsonb(new)-array['state','reason','email_message_id','attempts','work_token','started_at','available_at','updated_at']) is distinct from
  (to_jsonb(old)-array['state','reason','email_message_id','attempts','work_token','started_at','available_at','updated_at']) then raise exception 'Order email identity is immutable.' using errcode='42501';end if;
 return new;
end $$;
do $$ declare t text;f record;begin
 foreach t in array array['order_email_settings','order_email_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to service_role',t);
  execute format('create trigger %I before insert or update or delete on public.%I for each row execute function private.order_email_write_guard()',t||'_guard',t);
  execute format('create trigger %I before truncate on public.%I for each statement execute function private.order_email_write_guard()',t||'_truncate_guard',t);
 end loop;
 for f in select p.oid::regprocedure signature,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where (n.nspname='private' and p.proname in ('order_email_paid','order_email_reason','capture_order_email','order_email_write_guard'))
  or (n.nspname='public' and p.proname in ('order_email_configure','order_email_take','order_email_finish','order_email_enqueue','email_command','email_command_before_order_emails')) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  if f.nspname='public' and f.proname<>'email_command_before_order_emails' then execute format('grant execute on function %s to service_role',f.signature);end if;
 end loop;
end $$;

-- Preserve the installed reset planner and add only this retention blocker.
do $$ declare definition text;signature text;anchor text:='''email_events''';begin
 foreach signature in array array['catalog_private.reset_assert_coverage()','catalog_private.system_reset_plan_legacy(uuid,text)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if position(anchor in definition)=0 then raise exception 'Review order email reset coverage.';end if;
  execute replace(definition,anchor,'''email_events'',''order_email_settings'',''order_email_events''');
 end loop;
end $$;
alter function public.system_reset_plan(uuid,text) rename to system_reset_plan_before_order_emails;
create function public.system_reset_plan(p_owner uuid,p_scope text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;retained bigint;
begin
 result:=public.system_reset_plan_before_order_emails(p_owner,p_scope);
 if p_scope='full' or 'customer_orders'=any(public.system_reset_tables(p_scope)) then
  select (select count(*) from public.order_email_events)+(select count(*) from public.order_email_settings where is_enabled or updated_by is not null) into retained;
  if retained>0 then result:=jsonb_set(result,'{blockers}',coalesce(result->'blockers','[]'::jsonb)||jsonb_build_array(jsonb_build_object('table','order_email_retained_data','count',retained)));end if;
 end if;
 return result;
end $$;
revoke all on function public.system_reset_plan_before_order_emails(uuid,text),public.system_reset_plan(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.system_reset_plan(uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
