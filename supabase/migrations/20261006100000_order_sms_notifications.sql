-- Local implementation only. No historical replay or provider activation.
begin;

alter table public.customer_orders add column sms_locale text not null default 'en'
  check (sms_locale in ('en','ar'));

-- Bodies remain in the central bilingual template table. All automation starts off.
insert into public.sms_templates(code,name,category,text_en,text_ar,traffic_type,variables) values
  ('order_confirmed','Order confirmed','orders','Order {{order_number}} is confirmed. Total: {{order_total}}.','تم تأكيد الطلب {{order_number}}. الإجمالي: {{order_total}}.','notification',array['order_number','order_total']),
  ('order_payment_confirmed','Payment confirmed','orders','Payment received for order {{order_number}}.','تم استلام دفعة الطلب {{order_number}}.','notification',array['order_number']),
  ('order_processing','Order processing','orders','Order {{order_number}} is being prepared.','جارٍ تجهيز الطلب {{order_number}}.','notification',array['order_number']),
  ('order_cancelled','Order cancelled','orders','Order {{order_number}} has been cancelled.','تم إلغاء الطلب {{order_number}}.','notification',array['order_number'])
on conflict(code) do nothing;

create table public.sms_order_event_settings (
  event_type text primary key check (event_type in ('order_confirmed','payment_confirmed','processing','cancelled')),
  is_enabled boolean not null default false,
  template_en_id uuid references public.sms_templates(id) on delete set null,
  template_ar_id uuid references public.sms_templates(id) on delete set null,
  config_revision integer not null default 0,
  updated_by uuid references public.admin_users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.sms_order_event_settings(event_type,template_en_id,template_ar_id)
select v.event_type,t.id,t.id from (values
  ('order_confirmed','order_confirmed'),('payment_confirmed','order_payment_confirmed'),
  ('processing','order_processing'),('cancelled','order_cancelled')
) v(event_type,code) join public.sms_templates t on t.code=v.code;

-- This is a transition intent ledger, not another message queue/provider.
-- Only the central SMS batches/messages/attempts perform delivery.
create table public.sms_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.customer_orders(id) on delete set null,
  order_number text,
  event_type text not null check (event_type in ('order_confirmed','payment_confirmed','processing','cancelled')),
  idempotency_key text unique not null,
  locale text not null check (locale in ('en','ar')),
  payload jsonb not null default '{}'::jsonb,
  template_id uuid references public.sms_templates(id) on delete set null,
  template_text text not null default '', template_updated_at timestamptz,
  sender text not null default '', recipient_masked text,
  event_config_revision integer not null, provider_config_revision integer not null,
  status text not null check (status in ('pending','preparing','queued','suppressed')),
  reason text check (reason in ('provider_disabled','provider_not_ready','event_disabled','configuration_changed',
    'template_unavailable','order_removed','expired','invalid_phone','invalid_template','segment_limit','storage_error','capture_failed')),
  batch_id uuid unique references public.sms_batches(id) on delete set null,
  attempts integer not null default 0,
  lease_token uuid, locked_at timestamptz, available_at timestamptz not null default now(),
  expires_at timestamptz(3) not null default (now()+interval '10 minutes'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(order_id,event_type),
  check ((status='suppressed')=(reason is not null)),
  check ((status='preparing')=(lease_token is not null)),
  check (length(template_text)<=4000)
);
create index sms_order_events_pending on public.sms_order_events(available_at,created_at) where status='pending';
create index sms_order_events_history on public.sms_order_events(created_at desc);

alter table public.sms_order_event_settings enable row level security;
alter table public.sms_order_events enable row level security;
revoke all on public.sms_order_event_settings,public.sms_order_events from public,anon,authenticated;
grant all on public.sms_order_event_settings,public.sms_order_events to service_role;

create function public.sms_order_setting_revision() returns trigger
language plpgsql set search_path='' as $$
begin
  if row(new.is_enabled,new.template_en_id,new.template_ar_id) is distinct from
     row(old.is_enabled,old.template_en_id,old.template_ar_id) then
    new.config_revision:=old.config_revision+1; new.updated_at:=clock_timestamp();
  else new.config_revision:=old.config_revision; new.updated_at:=old.updated_at;
  end if;
  return new;
end $$;
create trigger sms_order_setting_revision before update on public.sms_order_event_settings
for each row execute function public.sms_order_setting_revision();

-- Nuxt supplies a whitelisted transaction locale, never a notification request.
create function public.sms_snapshot_order_locale() returns trigger
language plpgsql set search_path='' as $$
declare value text:=current_setting('app.order_sms_locale',true);
begin
  if value in ('en','ar') then new.sms_locale:=value; end if;
  return new;
end $$;
create trigger sms_snapshot_order_locale before insert on public.customer_orders
for each row execute function public.sms_snapshot_order_locale();
alter function public.commerce_create_customer_order(uuid,jsonb,jsonb,boolean,uuid) rename to commerce_create_customer_order_before_order_sms;
create function public.commerce_create_customer_order(p_user_id uuid,p_order jsonb,p_items jsonb,p_allow_out_of_stock boolean,p_cart_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; previous text:=coalesce(current_setting('app.order_sms_locale',true),'');
begin
  perform set_config('app.order_sms_locale',case when p_order->>'locale'='ar' then 'ar' else 'en' end,true);
  result:=public.commerce_create_customer_order_before_order_sms(p_user_id,p_order,p_items,p_allow_out_of_stock,p_cart_id);
  perform set_config('app.order_sms_locale',previous,true);
  return result;
end $$;
alter function public.commerce_create_preorder(uuid,jsonb,jsonb,uuid) rename to commerce_create_preorder_before_order_sms;
create function public.commerce_create_preorder(p_user_id uuid,p_order jsonb,p_items jsonb,p_cart_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; previous text:=coalesce(current_setting('app.order_sms_locale',true),'');
begin
  perform set_config('app.order_sms_locale',case when p_order->>'locale'='ar' then 'ar' else 'en' end,true);
  result:=public.commerce_create_preorder_before_order_sms(p_user_id,p_order,p_items,p_cart_id);
  perform set_config('app.order_sms_locale',previous,true);
  return result;
end $$;

-- A revision change invalidates old intents even if settings are re-enabled.
create function public.sms_order_event_reason(e public.sms_order_events) returns text
language plpgsql stable security definer set search_path='' as $$
declare config public.sms_provider_settings%rowtype; binding public.sms_order_event_settings%rowtype;
  template public.sms_templates%rowtype;
begin
  if e.order_id is null then return 'order_removed'; end if;
  if e.expires_at<=clock_timestamp() then return 'expired'; end if;
  select * into config from public.sms_provider_settings where id='vodafone';
  if not coalesce(config.is_enabled,false) then return 'provider_disabled'; end if;
  if config.account_id_encrypted is null or config.password_encrypted is null or config.hash_secret_encrypted is null
    or config.base_url='' or config.default_sender<>all(config.sender_names)
    or not config.trusted_ip_confirmed or not config.activation_confirmed or not config.hash_protocol_confirmed
    then return 'provider_not_ready'; end if;
  select * into binding from public.sms_order_event_settings where event_type=e.event_type;
  if not coalesce(binding.is_enabled,false) then return 'event_disabled'; end if;
  if binding.config_revision<>e.event_config_revision or config.config_revision<>e.provider_config_revision then return 'configuration_changed'; end if;
  select * into template from public.sms_templates where id=e.template_id;
  if not coalesce(template.is_enabled,false) or template.traffic_type<>'notification' or e.template_text=''
    or template.updated_at is distinct from e.template_updated_at
    or e.template_id is distinct from (case when e.locale='ar' then binding.template_ar_id else binding.template_en_id end)
    or not (e.sender=any(config.sender_names)) then return 'template_unavailable'; end if;
  return null;
end $$;

create function public.capture_order_sms_events() returns trigger
language plpgsql security definer set search_path='' as $$
declare kind text; kinds text[]:='{}'; config public.sms_provider_settings%rowtype;
  binding public.sms_order_event_settings%rowtype; template public.sms_templates%rowtype;
  intent public.sms_order_events%rowtype; failure text;
begin
  if tg_op='INSERT' then kinds:=array['order_confirmed'];
  else
    if new.payment_status='paid' and old.payment_status is distinct from new.payment_status then kinds:=array_append(kinds,'payment_confirmed'); end if;
    if new.status='processing' and old.status is distinct from new.status then kinds:=array_append(kinds,'processing'); end if;
    if new.status='cancelled' and old.status is distinct from new.status then kinds:=array_append(kinds,'cancelled'); end if;
  end if;
  foreach kind in array kinds loop
    begin
      select * into config from public.sms_provider_settings where id='vodafone';
      select * into binding from public.sms_order_event_settings where event_type=kind;
      select * into template from public.sms_templates where id=case when new.sms_locale='ar' then binding.template_ar_id else binding.template_en_id end;
      intent:=null;
      intent.order_id:=new.id; intent.order_number:=new.order_number; intent.event_type:=kind;
      intent.locale:=new.sms_locale; intent.template_id:=template.id;
      intent.template_text:=coalesce(case when new.sms_locale='ar' then template.text_ar else template.text_en end,'');
      intent.template_updated_at:=template.updated_at; intent.sender:=coalesce(nullif(template.sender,''),config.default_sender,'');
      intent.event_config_revision:=coalesce(binding.config_revision,0); intent.provider_config_revision:=coalesce(config.config_revision,0);
      intent.expires_at:=clock_timestamp()+interval '10 minutes';
      failure:=public.sms_order_event_reason(intent);
      insert into public.sms_order_events(order_id,order_number,event_type,idempotency_key,locale,payload,
        template_id,template_text,template_updated_at,sender,event_config_revision,provider_config_revision,status,reason,expires_at,recipient_masked)
      values(intent.order_id,intent.order_number,kind,'order:'||new.id::text||':'||kind,intent.locale,
        jsonb_build_object('phone',new.phone,'customer_name',concat_ws(' ',new.first_name,new.last_name),
          'order_number',new.order_number,'order_total',new.total_amount::text,'currency',new.currency,
          'order_status',new.status,'payment_method',new.payment_method),
        intent.template_id,intent.template_text,intent.template_updated_at,intent.sender,
        intent.event_config_revision,intent.provider_config_revision,case when failure is null then 'pending' else 'suppressed' end,
        failure,intent.expires_at,case when new.phone ~ '[0-9]{3}$' then '••••••'||right(new.phone,3) else null end)
      on conflict(idempotency_key) do nothing;
    exception when others then
      -- No private payload/error text; communication failure cannot undo commerce.
      raise log 'Order SMS intent capture failed (SQLSTATE %).',sqlstate;
      begin
        insert into public.sms_order_events(order_id,order_number,event_type,idempotency_key,locale,
          event_config_revision,provider_config_revision,status,reason)
        values(new.id,new.order_number,kind,'order:'||new.id::text||':'||kind,new.sms_locale,0,0,'suppressed','capture_failed')
        on conflict(idempotency_key) do nothing;
      exception when others then raise log 'Order SMS suppression audit unavailable (SQLSTATE %).',sqlstate;
      end;
    end;
  end loop;
  return new;
end $$;
create trigger capture_order_sms_events after insert or update of status,payment_status on public.customer_orders
for each row execute function public.capture_order_sms_events();

create function public.sms_claim_order_event() returns public.sms_order_events
language plpgsql security definer set search_path='' as $$
declare intent public.sms_order_events%rowtype;
begin
  -- Same provider-before-job lock order as the central queue.
  perform 1 from public.sms_provider_settings where id='vodafone' for update;
  update public.sms_order_events set status='pending',lease_token=null,locked_at=null
    where status='preparing' and locked_at<clock_timestamp()-interval '2 minutes';
  update public.sms_order_events e set status='suppressed',reason=public.sms_order_event_reason(e),lease_token=null,
    locked_at=null,updated_at=clock_timestamp()
    where status in ('pending','preparing') and public.sms_order_event_reason(e) is not null;
  select * into intent from public.sms_order_events where status='pending' and available_at<=clock_timestamp()
    order by created_at,id limit 1 for update skip locked;
  if not found then return null; end if;
  update public.sms_order_events set status='preparing',lease_token=gen_random_uuid(),locked_at=clock_timestamp(),
    attempts=attempts+1,updated_at=clock_timestamp() where id=intent.id returning * into intent;
  return intent;
end $$;

create function public.sms_enqueue_order_event(p_id uuid,p_token uuid,p_batch jsonb,p_messages jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare intent public.sms_order_events%rowtype; result jsonb; failure text;
begin
  perform 1 from public.sms_provider_settings where id='vodafone' for update;
  select * into intent from public.sms_order_events where id=p_id for update;
  if intent.status='queued' then return jsonb_build_object('id',intent.batch_id,'status','queued','reused',true); end if;
  if not found or intent.status<>'preparing' or intent.lease_token is distinct from p_token
    or intent.locked_at<clock_timestamp()-interval '2 minutes' then raise exception 'Order SMS lease lost'; end if;
  failure:=public.sms_order_event_reason(intent);
  if failure is not null then
    update public.sms_order_events set status='suppressed',reason=failure,lease_token=null,locked_at=null,updated_at=clock_timestamp() where id=p_id;
    return jsonb_build_object('status','suppressed');
  end if;
  if p_batch->>'traffic_type' is distinct from 'notification' or p_batch->>'idempotency_key' is distinct from intent.idempotency_key
    or nullif(p_batch->>'template_id','')::uuid is distinct from intent.template_id
    or (p_batch->>'expires_at')::timestamptz is distinct from intent.expires_at
    or jsonb_array_length(p_messages)<>1 or p_messages->0->>'sender' is distinct from intent.sender
    then raise exception 'Invalid order SMS queue context'; end if;
  result:=public.sms_enqueue(p_batch,p_messages);
  update public.sms_order_events set status='queued',batch_id=(result->>'id')::uuid,
    recipient_masked=left(p_messages->0->>'recipient',4)||'••••••'||right(p_messages->0->>'recipient',3),
    lease_token=null,locked_at=null,updated_at=clock_timestamp() where id=p_id;
  return result;
end $$;

create function public.sms_finish_order_event(p_id uuid,p_token uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare intent public.sms_order_events%rowtype;
begin
  select * into intent from public.sms_order_events where id=p_id for update;
  if not found or intent.status<>'preparing' or intent.lease_token is distinct from p_token then return; end if;
  if p_reason='storage_error' and intent.attempts<3 and intent.expires_at>clock_timestamp()+interval '30 seconds' then
    update public.sms_order_events set status='pending',lease_token=null,locked_at=null,
      available_at=clock_timestamp()+interval '30 seconds',updated_at=clock_timestamp() where id=p_id;
  else
    update public.sms_order_events set status='suppressed',reason=p_reason,lease_token=null,locked_at=null,
      updated_at=clock_timestamp() where id=p_id;
  end if;
end $$;

-- Extend the existing queue authorization only for linked order intents.
-- Manual Notification/Campaign jobs retain the audited foundation behavior.
alter function public.sms_claim() rename to sms_claim_before_order_sms;
create function public.sms_claim() returns public.sms_batches
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.sms_provider_settings where id='vodafone' for update;
  with cancelled as (
    update public.sms_batches b set status='failed',failure_category='order_event_suppressed',updated_at=clock_timestamp()
    from public.sms_order_events e where e.batch_id=b.id and b.status='queued' and public.sms_order_event_reason(e) is not null
    returning b.id
  ) update public.sms_messages set status='failed',failure_category='order_event_suppressed' where batch_id in(select id from cancelled);
  return public.sms_claim_before_order_sms();
end $$;
alter function public.sms_begin_dispatch(uuid,uuid,integer) rename to sms_begin_dispatch_before_order_sms;
create function public.sms_begin_dispatch(p_id uuid,p_token uuid,p_revision integer) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.sms_provider_settings where id='vodafone' for update;
  if exists(select 1 from public.sms_order_events e where e.batch_id=p_id and public.sms_order_event_reason(e) is not null) then
    perform public.sms_finish(p_id,p_token,jsonb_build_object('status','failed','category','order_event_suppressed'));
    return false;
  end if;
  return public.sms_begin_dispatch_before_order_sms(p_id,p_token,p_revision);
end $$;
alter function public.sms_check_dispatch(uuid,uuid,integer) rename to sms_check_dispatch_before_order_sms;
create function public.sms_check_dispatch(p_id uuid,p_token uuid,p_revision integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare authorized boolean;
begin
  authorized:=public.sms_check_dispatch_before_order_sms(p_id,p_token,p_revision);
  if authorized is distinct from true then return authorized; end if;
  return not exists(select 1 from public.sms_order_events e where e.batch_id=p_id and public.sms_order_event_reason(e) is not null);
end $$;

alter function public.system_reset_tables(text) rename to system_reset_tables_before_order_sms;
create function public.system_reset_tables(p_scope text) returns text[] language plpgsql immutable set search_path='' as $$
declare tables text[]:=public.system_reset_tables_before_order_sms(p_scope); pos integer;
begin
  if p_scope='full' then
    pos:=array_position(tables,'sms_attempts');
    tables:=tables[1:pos-1]||array['sms_order_events','sms_order_event_settings']||tables[pos:cardinality(tables)];
  end if;
  return tables;
end $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('sms_order_setting_revision','sms_snapshot_order_locale','sms_order_event_reason',
      'capture_order_sms_events','sms_claim_order_event','sms_enqueue_order_event','sms_finish_order_event',
      'sms_claim','sms_begin_dispatch','sms_check_dispatch','sms_claim_before_order_sms',
      'sms_begin_dispatch_before_order_sms','sms_check_dispatch_before_order_sms','system_reset_tables',
      'system_reset_tables_before_order_sms','commerce_create_customer_order','commerce_create_customer_order_before_order_sms',
      'commerce_create_preorder','commerce_create_preorder_before_order_sms') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    if f.signature::text not like '%before_order_sms%' then
      execute format('grant execute on function %s to service_role',f.signature);
    end if;
  end loop;
end $$;
notify pgrst,'reload schema';
commit;
