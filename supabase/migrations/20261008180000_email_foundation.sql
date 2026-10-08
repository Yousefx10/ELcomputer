-- Email foundation only; disabled, no business producers or historical jobs.
begin;
alter function public.default_admin_permissions() rename to default_admin_permissions_before_email;
create function public.default_admin_permissions() returns jsonb language sql immutable set search_path='' as $$
 select public.default_admin_permissions_before_email() || jsonb_build_object('email.view',false,'email.settings.view',false,'email.settings.manage',false,'email.templates.view',false,'email.templates.manage',false,'email.transactional.send',false,'email.history.view',false,'email.marketing.manage',false);
$$;
alter table public.admin_users alter column permissions set default public.default_admin_permissions();
create table public.email_provider_settings (
 id text primary key check(id='brevo'), config jsonb not null default '{"is_enabled":false,"marketing_enabled":false,"approved_senders":[],"transactional_sender":"","marketing_sender":"","reply_to":"","account_approved":false,"activation_confirmed":false,"webhook_enabled":false,"timeout_ms":10000,"unsubscribe_origin":""}',
 api_key_encrypted text, webhook_token_encrypted text, revision integer not null default 0 check(revision>=0),
 next_dispatch_at timestamptz,
 updated_at timestamptz not null default clock_timestamp(), updated_by uuid references public.admin_users(id) on delete restrict,
 check(jsonb_typeof(config)='object'), check(api_key_encrypted is null or api_key_encrypted like 'v1.%'), check(webhook_token_encrypted is null or webhook_token_encrypted like 'v1.%')
);
insert into public.email_provider_settings(id) values('brevo');
create table public.email_templates (
 key text primary key check(key ~ '^[a-z][a-z0-9_]{1,79}$'), name text not null check(char_length(name) between 1 and 100), category text not null check(char_length(category) between 1 and 50),
 classification text not null check(classification in ('transactional','marketing')), subject_en text not null, subject_ar text not null, body_en text not null, body_ar text not null,
 sender text not null default '', reply_to text not null default '', is_enabled boolean not null default false, version integer not null default 1,
 updated_at timestamptz not null default clock_timestamp(), updated_by uuid not null references public.admin_users(id) on delete restrict,
 check(char_length(subject_en) between 1 and 200 and char_length(subject_ar) between 1 and 200), check(char_length(body_en) between 1 and 20000 and char_length(body_ar) between 1 and 20000)
);
create table public.email_preferences (
 recipient text primary key check(recipient=lower(recipient) and char_length(recipient) between 3 and 254),
 marketing_status text not null default 'unknown' check(marketing_status in ('unknown','subscribed','unsubscribed')),
 consent_at timestamptz, provenance text not null default '', global_reason text check(global_reason in ('hard_bounce','invalid_email','spam','manual')),
 blocked_senders text[] not null default '{}', updated_at timestamptz not null default clock_timestamp(), updated_by uuid references public.admin_users(id) on delete restrict,
 check(marketing_status<>'subscribed' or (consent_at is not null and char_length(provenance)>0))
);
create table public.email_messages (
 id uuid primary key, idempotency_key uuid not null unique, fingerprint text not null check(fingerprint ~ '^[0-9a-f]{64}$'),
 classification text not null check(classification in ('transactional','marketing')), recipient text not null references public.email_preferences(recipient) on delete restrict,
 sender text not null, sender_name text not null, reply_to text not null default '', template_key text references public.email_templates(key) on delete restrict, template_version integer,
 category text not null, locale text not null check(locale in ('en','ar')), subject text not null check(char_length(subject) between 1 and 200), html_body text not null check(octet_length(html_body)<=131072), text_body text not null check(octet_length(text_body)<=65536),
 body_format text not null check(body_format in ('html','text')), source text not null, business_reference text not null default '', actor_id uuid references public.admin_users(id) on delete restrict,
 priority integer not null default 0 check(priority between 0 and 10), config_revision integer not null, correlation text not null unique,
 unsubscribe_hash text unique, unsubscribe_expires_at timestamptz,
 state text not null default 'queued' check(state in ('queued','processing','accepted','failed','uncertain','suppressed')),
 delivery_state text not null default 'unobserved' check(delivery_state in ('unobserved','sent','deferred','delivered','soft_bounce','hard_bounce','blocked','spam','invalid_email','error','unsubscribed')),
 delivery_at timestamptz, opened_at timestamptz, provider_message_id text unique, attempts integer not null default 0, error_category text,
 work_token uuid, started_at timestamptz, dispatched_at timestamptz, next_attempt_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null default clock_timestamp()+interval '10 minutes',
 accepted_at timestamptz, created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 check(classification<>'marketing' or (template_key is not null and unsubscribe_hash is not null)), check(state<>'accepted' or provider_message_id is not null)
);
create index email_queue on public.email_messages(priority desc,created_at) where state='queued';
create index email_history on public.email_messages(created_at desc,id);
create index email_recipient_history on public.email_messages(recipient,created_at desc);
create table public.email_attempts (
 id uuid primary key default gen_random_uuid(), message_id uuid not null references public.email_messages(id) on delete restrict, work_token uuid not null unique,
 attempt_number integer not null, state text not null default 'processing' check(state in ('processing','accepted','failed','uncertain','suppressed','retry')),
 http_status integer check(http_status between 100 and 599), error_category text, provider_message_id text,
 started_at timestamptz not null default clock_timestamp(), finished_at timestamptz, unique(message_id,attempt_number)
);
create table public.email_events (
 event_key text primary key, message_id uuid not null references public.email_messages(id) on delete restrict, provider_message_id text not null,
 event_type text not null check(event_type in ('sent','delivered','deferred','soft_bounce','hard_bounce','spam','invalid_email','blocked','error','unsubscribed','opened')),
 event_at timestamptz not null, received_at timestamptz not null default clock_timestamp()
);
create index email_events_history on public.email_events(message_id,event_at desc);

create function public.email_assert_staff(p_actor uuid,p_permission text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.admin_users a where a.id=p_actor and a.is_active and (a.role='owner' or coalesce((a.permissions->>'email.view')::boolean,false) and coalesce((a.permissions->>p_permission)::boolean,false) and (p_permission<>'email.settings.manage' or coalesce((a.permissions->>'email.settings.view')::boolean,false)) and (p_permission<>'email.templates.manage' or coalesce((a.permissions->>'email.templates.view')::boolean,false)))) then raise exception 'Email permission denied.' using errcode='42501'; end if;
end $$;
create function public.email_audit(p_actor uuid,p_action text,p_metadata jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.admin_activity_logs(admin_user_id,author_name,author_email,author_role,action_key,description,metadata)
 select a.id,coalesce(nullif(a.full_name,''),a.email),a.email,a.role,p_action,'Updated email foundation.',p_metadata from public.admin_users a where a.id=p_actor;
end $$;
create function public.email_ready(s public.email_provider_settings) returns boolean language sql immutable set search_path='' as $$
 select coalesce((s.config->>'is_enabled')::boolean,false) and s.api_key_encrypted is not null and coalesce((s.config->>'account_approved')::boolean,false) and coalesce((s.config->>'activation_confirmed')::boolean,false)
 and exists(select 1 from jsonb_array_elements(s.config->'approved_senders') x where x->>'email'=s.config->>'transactional_sender' and (x->>'verified')::boolean);
$$;
create function public.email_event_rank(p_type text) returns integer language sql immutable set search_path='' as $$
 select coalesce(array_position(array['sent','deferred','soft_bounce','delivered','error','blocked','unsubscribed','hard_bounce','invalid_email','spam'],p_type),0);
$$;
create function public.email_write_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op in ('DELETE','TRUNCATE') or current_setting('app.email_write',true) is distinct from 'on' then raise exception 'Canonical email operation required.' using errcode='42501'; end if;
 if tg_op='UPDATE' then
  if tg_table_name='email_events' then raise exception 'Email events are immutable.' using errcode='42501'; end if;
  if tg_table_name='email_messages' and (to_jsonb(new)-array['state','delivery_state','delivery_at','opened_at','provider_message_id','attempts','error_category','work_token','started_at','dispatched_at','next_attempt_at','accepted_at','updated_at']) is distinct from (to_jsonb(old)-array['state','delivery_state','delivery_at','opened_at','provider_message_id','attempts','error_category','work_token','started_at','dispatched_at','next_attempt_at','accepted_at','updated_at']) then raise exception 'Email intent is immutable.' using errcode='42501'; end if;
  if tg_table_name='email_messages' and to_jsonb(old)->>'provider_message_id' is not null and to_jsonb(new)->>'provider_message_id' is distinct from to_jsonb(old)->>'provider_message_id' then raise exception 'Email provider identity is immutable.' using errcode='42501'; end if;
 end if;
 return new;
end $$;
-- All email writes use a service-role RPC. No browser table grants or policies.
create function public.email_command(p_action text,p_input jsonb default '{}',p_actor uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.email_provider_settings; m public.email_messages; t public.email_templates; pref public.email_preferences; v jsonb; token uuid; reason text; recipient_value text; event_at timestamptz; preference_new boolean; event_project boolean;
begin
 perform set_config('app.email_write','on',true);
 -- Single lock order: provider -> recipient -> message; all final dispatch gates share it.
 select * into s from public.email_provider_settings where id='brevo' for update;
 if not found then raise exception 'Email unavailable.' using errcode='55000'; end if;
 if p_action='settings' then
  perform public.email_assert_staff(p_actor,'email.settings.manage');
  if (p_input->>'revision')::integer is distinct from s.revision then raise exception 'Email revision conflict.' using errcode='40001'; end if;
  update public.email_provider_settings set config=p_input->'config',api_key_encrypted=case when p_input ? 'api_key_encrypted' then p_input->>'api_key_encrypted' else api_key_encrypted end,
   webhook_token_encrypted=case when p_input ? 'webhook_token_encrypted' then p_input->>'webhook_token_encrypted' else webhook_token_encrypted end,revision=revision+1,updated_at=clock_timestamp(),updated_by=p_actor where id='brevo' returning * into s;
  update public.email_messages set state='suppressed',error_category='configuration_changed',updated_at=clock_timestamp() where state='queued';
  perform public.email_audit(p_actor,'email.settings.update',jsonb_build_object('revision',s.revision,'enabled',s.config->'is_enabled','api_key_replaced',p_input ? 'api_key_encrypted','webhook_token_replaced',p_input ? 'webhook_token_encrypted'));
  return to_jsonb(s);
 elsif p_action='template' then
  perform public.email_assert_staff(p_actor,'email.templates.manage');
  select * into t from public.email_templates where key=p_input->>'key' for update;
  if found and (t.version is distinct from (p_input->>'version')::integer or t.classification is distinct from p_input->>'classification') then raise exception 'Email template conflict.' using errcode='40001'; end if;
  insert into public.email_templates(key,name,category,classification,subject_en,subject_ar,body_en,body_ar,sender,reply_to,is_enabled,updated_by)
   values(p_input->>'key',p_input->>'name',p_input->>'category',p_input->>'classification',p_input->>'subject_en',p_input->>'subject_ar',p_input->>'body_en',p_input->>'body_ar',p_input->>'sender',p_input->>'reply_to',(p_input->>'is_enabled')::boolean,p_actor)
   on conflict(key) do update set name=excluded.name,category=excluded.category,subject_en=excluded.subject_en,subject_ar=excluded.subject_ar,body_en=excluded.body_en,body_ar=excluded.body_ar,sender=excluded.sender,reply_to=excluded.reply_to,is_enabled=excluded.is_enabled,version=email_templates.version+1,updated_at=clock_timestamp(),updated_by=p_actor returning * into t;
  perform public.email_audit(p_actor,'email.template.update',jsonb_build_object('key',t.key,'classification',t.classification,'version',t.version)); return to_jsonb(t);
 elsif p_action='preference' then
  perform public.email_assert_staff(p_actor,'email.marketing.manage');
  recipient_value:=p_input->>'recipient';
  insert into public.email_preferences(recipient) values(recipient_value) on conflict do nothing;
  preference_new:=found;
  select * into pref from public.email_preferences where email_preferences.recipient=recipient_value for update;
  if not preference_new and (p_input->>'updated_at')::timestamptz is distinct from pref.updated_at then raise exception 'Email preference conflict.' using errcode='40001'; end if;
  if p_input->>'global_reason' is not null and p_input->>'global_reason'<>'manual' and p_input->>'global_reason' is distinct from pref.global_reason then raise exception 'Invalid delivery restriction.' using errcode='22023'; end if;
  if pref.global_reason is not null and p_input->>'global_reason' is null and not coalesce((p_input->>'clear_safety_confirmed')::boolean,false) then raise exception 'Delivery restriction requires review.' using errcode='22023'; end if;
  update public.email_preferences set marketing_status=p_input->>'marketing_status',consent_at=case when p_input->>'marketing_status'='subscribed' then clock_timestamp() else consent_at end,
   provenance=p_input->>'provenance',global_reason=p_input->>'global_reason',updated_at=clock_timestamp(),updated_by=p_actor where email_preferences.recipient=recipient_value returning * into pref;
  perform public.email_audit(p_actor,'email.preference.update',jsonb_build_object('recipient_fingerprint',encode(sha256(convert_to(recipient_value,'UTF8')),'hex'),'marketing_status',pref.marketing_status,'global_reason',pref.global_reason,'safety_clearance',coalesce((p_input->>'clear_safety_confirmed')::boolean,false)));
  return to_jsonb(pref);
 elsif p_action='enqueue' then
  select * into m from public.email_messages where idempotency_key=(p_input->>'idempotency_key')::uuid;
  if found then
   if m.fingerprint is distinct from p_input->>'fingerprint' then raise exception 'Email idempotency conflict.' using errcode='23505'; end if;
   return jsonb_build_object('id',m.id,'state',m.state,'reused',true);
  end if;
  if not public.email_ready(s) or s.revision is distinct from (p_input->>'config_revision')::integer then raise exception 'Email disabled or unavailable.' using errcode='55000'; end if;
  if p_actor is not null then perform public.email_assert_staff(p_actor,'email.transactional.send'); if p_input->>'classification' is distinct from 'transactional' or p_input->>'source' is distinct from 'dashboard_manual' then raise exception 'Invalid manual classification.' using errcode='22023'; end if;
  elsif p_input->>'source' is distinct from 'service' then raise exception 'Invalid email source.' using errcode='22023'; end if;
  if not exists(select 1 from jsonb_array_elements(s.config->'approved_senders') x where x->>'email'=p_input->>'sender' and (x->>'verified')::boolean) then raise exception 'Sender unavailable.' using errcode='22023'; end if;
  if p_input->>'template_key' is not null then
   select * into t from public.email_templates where key=p_input->>'template_key';
   if not found or not t.is_enabled or t.classification is distinct from p_input->>'classification' or t.version is distinct from (p_input->>'template_version')::integer then raise exception 'Template unavailable.' using errcode='22023'; end if;
  end if;
  if p_actor is not null and (select count(*) from public.email_messages where actor_id=p_actor and created_at>clock_timestamp()-interval '1 minute')>=10 then raise exception 'Email rate limit.' using errcode='54000'; end if;
  recipient_value:=p_input->>'recipient'; insert into public.email_preferences(recipient) values(recipient_value) on conflict do nothing;
  select * into pref from public.email_preferences where email_preferences.recipient=recipient_value for update;
  reason:=case when pref.global_reason is not null then pref.global_reason when p_input->>'sender'=any(pref.blocked_senders) then 'sender_unsubscribed'
   when p_input->>'classification'='marketing' and (pref.marketing_status<>'subscribed' or not coalesce((s.config->>'marketing_enabled')::boolean,false) or s.config->>'marketing_sender'<>p_input->>'sender') then 'marketing_permission' end;
  insert into public.email_messages(id,idempotency_key,fingerprint,classification,recipient,sender,sender_name,reply_to,template_key,template_version,category,locale,subject,html_body,text_body,body_format,source,business_reference,actor_id,priority,config_revision,correlation,unsubscribe_hash,unsubscribe_expires_at,state,error_category)
   values((p_input->>'id')::uuid,(p_input->>'idempotency_key')::uuid,p_input->>'fingerprint',p_input->>'classification',recipient_value,p_input->>'sender',p_input->>'sender_name',p_input->>'reply_to',p_input->>'template_key',(p_input->>'template_version')::integer,p_input->>'category',p_input->>'locale',p_input->>'subject',p_input->>'html_body',p_input->>'text_body',p_input->>'body_format',p_input->>'source',p_input->>'business_reference',p_actor,(p_input->>'priority')::integer,s.revision,p_input->>'correlation',p_input->>'unsubscribe_hash',case when p_input->>'unsubscribe_hash' is not null then clock_timestamp()+interval '180 days' end,case when reason is null then 'queued' else 'suppressed' end,reason) returning * into m;
  perform public.email_audit(p_actor,'email.manual.queued',jsonb_build_object('message_id',m.id,'state',m.state,'classification',m.classification)); return jsonb_build_object('id',m.id,'state',m.state,'reused',false);
 elsif p_action='claim' then
  update public.email_attempts a set state='uncertain',error_category='lease_expired',finished_at=clock_timestamp() from public.email_messages j where a.message_id=j.id and a.work_token=j.work_token and j.state='processing' and j.started_at<clock_timestamp()-interval '2 minutes';
  update public.email_messages set state='uncertain',error_category='lease_expired',updated_at=clock_timestamp() where state='processing' and started_at<clock_timestamp()-interval '2 minutes';
  update public.email_messages set state='suppressed',error_category='authorization_expired',updated_at=clock_timestamp() where state='queued' and (expires_at<=clock_timestamp() or config_revision<>s.revision or not public.email_ready(s));
  update public.email_messages set state='failed',error_category='attempt_limit',updated_at=clock_timestamp() where state='queued' and attempts>=3;
  if not public.email_ready(s) or s.next_dispatch_at>clock_timestamp() then return null; end if;
  select * into m from public.email_messages where state='queued' and next_attempt_at<=clock_timestamp() order by priority desc,created_at for update skip locked limit 1;
  if not found then return null; end if;
  token:=gen_random_uuid(); update public.email_messages set state='processing',work_token=token,started_at=clock_timestamp(),dispatched_at=null,attempts=attempts+1,updated_at=clock_timestamp() where id=m.id returning * into m;
  insert into public.email_attempts(message_id,work_token,attempt_number) values(m.id,token,m.attempts); return to_jsonb(m);
 elsif p_action in ('dispatch','finish','event','unsubscribe') then
  if p_action='event' and (not coalesce((s.config->>'webhook_enabled')::boolean,false) or s.webhook_token_encrypted is null or s.revision is distinct from (p_input->>'config_revision')::integer) then raise exception 'Email webhook authorization expired.' using errcode='42501'; end if;
  if p_action='unsubscribe' then select * into m from public.email_messages where unsubscribe_hash=p_input->>'token_hash' and unsubscribe_expires_at>clock_timestamp() and classification='marketing';
  elsif p_action='event' then
   select * into m from public.email_messages where recipient=p_input->>'recipient' and (provider_message_id=p_input->>'provider_message_id' or (provider_message_id is null and correlation=p_input->>'correlation' and dispatched_at is not null and state in ('processing','uncertain')));
  else select * into m from public.email_messages where id=(p_input->>'id')::uuid; end if;
  if not found then return jsonb_build_object('matched',false); end if;
  select * into pref from public.email_preferences where email_preferences.recipient=m.recipient for update;
  select * into m from public.email_messages where id=m.id for update;
  if p_action='unsubscribe' then
   update public.email_preferences set marketing_status='unsubscribed',provenance='recipient_link',updated_by=null,updated_at=clock_timestamp() where email_preferences.recipient=m.recipient;
   update public.email_messages set state='suppressed',error_category='marketing_unsubscribed',updated_at=clock_timestamp() where email_messages.recipient=m.recipient and classification='marketing' and state='queued'; return jsonb_build_object('matched',true);
  elsif p_action='dispatch' then
   if m.state<>'processing' or m.work_token is distinct from (p_input->>'work_token')::uuid or m.dispatched_at is not null or m.started_at<clock_timestamp()-interval '1 minute' then return jsonb_build_object('allowed',false,'state',m.state); end if;
   reason:=case when not public.email_ready(s) or m.config_revision<>s.revision or m.expires_at<=clock_timestamp() then 'configuration_changed'
    when pref.global_reason is not null then pref.global_reason when m.sender=any(pref.blocked_senders) then 'sender_unsubscribed'
    when m.classification='marketing' and (pref.marketing_status<>'subscribed' or not coalesce((s.config->>'marketing_enabled')::boolean,false) or m.sender<>s.config->>'marketing_sender') then 'marketing_permission'
    when m.actor_id is not null and not exists(select 1 from public.admin_users a where a.id=m.actor_id and a.is_active and (a.role='owner' or coalesce((a.permissions->>'email.view')::boolean,false) and coalesce((a.permissions->>'email.transactional.send')::boolean,false))) then 'staff_permission' end;
   if reason is not null then
    update public.email_messages set state='suppressed',error_category=reason,updated_at=clock_timestamp() where id=m.id;
    update public.email_attempts set state='suppressed',error_category=reason,finished_at=clock_timestamp() where work_token=m.work_token; return jsonb_build_object('allowed',false,'state','suppressed');
   end if;
   if s.next_dispatch_at>clock_timestamp() then
    reason:=case when m.attempts>=3 then 'attempt_limit' else 'dispatch_throttle' end;
    update public.email_messages set state=case when m.attempts>=3 then 'failed' else 'queued' end,error_category=reason,next_attempt_at=s.next_dispatch_at,updated_at=clock_timestamp() where id=m.id returning * into m;
    update public.email_attempts set state=case when m.state='failed' then 'failed' else 'retry' end,error_category=reason,finished_at=clock_timestamp() where work_token=m.work_token;
    return jsonb_build_object('allowed',false,'state',m.state);
   end if;
   update public.email_provider_settings set next_dispatch_at=clock_timestamp()+interval '1 second' where id='brevo';
   update public.email_messages set dispatched_at=clock_timestamp() where id=m.id; return jsonb_build_object('allowed',true);
  elsif p_action='finish' then
   if m.state<>'processing' or m.work_token is distinct from (p_input->>'work_token')::uuid then return jsonb_build_object('matched',false); end if;
   reason:=p_input->>'error_category'; v:=p_input;
   if v->>'state'='retry' and (m.attempts>=3 or m.expires_at<=clock_timestamp()+make_interval(secs=>(v->>'retry_seconds')::integer)) then v:=jsonb_set(v,'{state}','"failed"'); end if;
   if m.provider_message_id is not null and v->>'provider_message_id' is distinct from m.provider_message_id then v:=jsonb_set(v,'{state}','"uncertain"'); reason:='provider_identity_conflict'; end if;
   update public.email_messages set state=case when v->>'state'='retry' then 'queued' else v->>'state' end,error_category=reason,
    provider_message_id=coalesce(provider_message_id,v->>'provider_message_id'),accepted_at=case when v->>'state'='accepted' then clock_timestamp() else accepted_at end,
    next_attempt_at=clock_timestamp()+make_interval(secs=>coalesce((v->>'retry_seconds')::integer,0)),updated_at=clock_timestamp() where id=m.id returning * into m;
   update public.email_attempts set state=v->>'state',http_status=(v->>'http_status')::integer,error_category=reason,provider_message_id=v->>'provider_message_id',finished_at=clock_timestamp() where work_token=m.work_token;
   return jsonb_build_object('matched',true,'state',m.state);
  elsif p_action='event' then
   if m.provider_message_id is not null and m.provider_message_id is distinct from p_input->>'provider_message_id' then return jsonb_build_object('matched',false); end if;
   event_at:=(p_input->>'event_at')::timestamptz;
   if event_at<m.created_at-interval '5 minutes' or event_at>clock_timestamp()+interval '5 minutes' then return jsonb_build_object('matched',false); end if;
   insert into public.email_events(event_key,message_id,provider_message_id,event_type,event_at) values(p_input->>'event_key',m.id,p_input->>'provider_message_id',p_input->>'event_type',event_at) on conflict do nothing;
   if not found then return jsonb_build_object('matched',true,'replayed',true); end if;
   -- Preserve safety facts regardless of delivery projection ordering. Never infer resend.
   if p_input->>'event_type' in ('hard_bounce','spam','invalid_email') then
    update public.email_preferences set global_reason=case when global_reason='spam' then global_reason else p_input->>'event_type' end,provenance='brevo_event',updated_by=null,updated_at=clock_timestamp() where email_preferences.recipient=m.recipient;
   elsif p_input->>'event_type'='unsubscribed' then
    update public.email_preferences set blocked_senders=case when m.sender=any(blocked_senders) then blocked_senders else array_append(blocked_senders,m.sender) end,
     marketing_status=case when m.classification='marketing' then 'unsubscribed' else marketing_status end,provenance='brevo_sender_unsubscribe',updated_by=null,updated_at=clock_timestamp() where email_preferences.recipient=m.recipient;
   end if;
   event_project:=p_input->>'event_type'<>'opened' and (m.delivery_at is null or event_at>m.delivery_at or (event_at=m.delivery_at and public.email_event_rank(p_input->>'event_type')>public.email_event_rank(m.delivery_state)))
    and not (m.delivery_state in ('delivered','hard_bounce','spam','invalid_email','unsubscribed','blocked','error') and p_input->>'event_type' in ('sent','deferred','soft_bounce'));
   update public.email_messages set provider_message_id=coalesce(provider_message_id,p_input->>'provider_message_id'),
    opened_at=case when p_input->>'event_type'='opened' then greatest(opened_at,event_at) else opened_at end,
    delivery_state=case when event_project then p_input->>'event_type' else delivery_state end,
    delivery_at=case when event_project then event_at else delivery_at end,updated_at=clock_timestamp() where id=m.id;
   return jsonb_build_object('matched',true,'replayed',false);
  end if;
 end if;
 raise exception 'Invalid email action.' using errcode='22023';
end $$;
do $$ declare t text; r record; begin
 foreach t in array array['email_provider_settings','email_templates','email_preferences','email_messages','email_attempts','email_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('revoke all on public.%I from service_role',t);
  execute format('grant select on public.%I to service_role',t);
  execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.email_write_guard()',t||'_guard',t);
  execute format('create trigger %I before truncate on public.%I for each statement execute function public.email_write_guard()',t||'_truncate_guard',t);
 end loop;
 for r in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname in ('email_assert_staff','email_audit','email_ready','email_command','email_write_guard','email_event_rank') loop
  execute format('revoke all on function %s from public,anon,authenticated',r.signature);
  execute format('grant execute on function %s to service_role',r.signature);
 end loop;
end $$;

-- Retain private email configuration/history. A full reset requires a separate
-- retention decision once this foundation contains merchant data.
do $reset$ declare definition text; anchor text:='''shipping_claim_jobs'']'; finish text:='  return jsonb_build_object(''counts'', v_counts, ''blockers'', v_blockers);'; begin
 definition:=pg_get_functiondef('public.system_reset_plan(uuid,text)'::regprocedure);
 if position(anchor in definition)=0 or position(finish in definition)=0 then raise exception 'Review email reset integration before migrating.'; end if;
 definition:=replace(definition,anchor,'''shipping_claim_jobs'', ''email_provider_settings'', ''email_templates'', ''email_preferences'', ''email_messages'', ''email_attempts'', ''email_events'']');
 definition:=replace(definition,finish,$code$
  if p_scope='full' then
   select (select count(*) from public.email_messages)+(select count(*) from public.email_preferences)+(select count(*) from public.email_templates)+(select count(*) from public.email_provider_settings where api_key_encrypted is not null or webhook_token_encrypted is not null or updated_by is not null) into v_count;
   if v_count>0 then v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('table','email_retained_data','count',v_count)); end if;
  end if;
  return jsonb_build_object('counts', v_counts, 'blockers', v_blockers);
$code$);
 execute definition;
end $reset$;

commit;
