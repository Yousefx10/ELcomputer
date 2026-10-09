-- Claims Stage 3 only. No historical capture, activation or provider networking.
begin;
alter function public.default_admin_permissions() rename to default_admin_permissions_before_claim_communications;
create function public.default_admin_permissions() returns jsonb language sql immutable set search_path='' as $$
 select public.default_admin_permissions_before_claim_communications()||jsonb_build_object('claims.communications.view',false,'claims.communications.manage',false);
$$;
alter table public.admin_users alter column permissions set default public.default_admin_permissions();

create table public.after_sales_communication_settings (
 purpose text primary key check(purpose in ('more_information','approved','rejected','pickup_scheduled','received','resolution_decided','resolved')),
 is_enabled boolean not null default false, sms_enabled boolean not null default false, email_enabled boolean not null default false,
 sms_template_en uuid references public.sms_templates(id) on delete restrict, sms_template_ar uuid references public.sms_templates(id) on delete restrict,
 email_template_en text references public.email_templates(key) on delete restrict, email_template_ar text references public.email_templates(key) on delete restrict,
 sms_sender text not null default '',email_sender text not null default '', approvals jsonb not null default '{}',revision integer not null default 0 check(revision>=0),
 capture_started_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),updated_by uuid references public.admin_users(id) on delete restrict
);
insert into public.after_sales_communication_settings(purpose) values('more_information'),('approved'),('rejected'),('pickup_scheduled'),('received'),('resolution_decided'),('resolved');
-- Preparation/linkage only. Delivery, retries and observations use central ledgers.
create table public.after_sales_communications (
 id uuid primary key default gen_random_uuid(),claim_id uuid not null references public.after_sales_claims(id) on delete restrict,
 event_id uuid not null references public.after_sales_claim_events(id) on delete restrict,purpose text not null references public.after_sales_communication_settings(purpose) on delete restrict,
 occurrence_id uuid not null,information_id uuid references public.after_sales_claim_information(id) on delete restrict,shipment_job_id uuid references public.shipping_claim_jobs(id) on delete restrict,
 channel text not null check(channel in ('sms','email')),locale text not null check(locale in ('en','ar')),
 recipient text not null default '',recipient_masked text not null default '',payload jsonb not null check(jsonb_typeof(payload)='object'),
 template_reference text,template_snapshot jsonb,template_fingerprint text,sender text not null default '',setting_revision integer not null,provider_revision integer not null,
 occurred_at timestamptz not null,expires_at timestamptz(3) not null,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 status text not null check(status in ('pending','preparing','queued','suppressed')),reason text check(reason in ('event_disabled','channel_disabled','provider_disabled','provider_not_ready','template_unavailable','configuration_changed','invalid_phone','invalid_email','invalid_template','segment_limit','expired','stale_event','superseded','recipient_restricted','storage_error','preparation_limit','approver_revoked','invalid_source')),
 attempts integer not null default 0 check(attempts between 0 and 3),work_token uuid,started_at timestamptz,available_at timestamptz not null default clock_timestamp(),
 sms_batch_id uuid unique references public.sms_batches(id) on delete restrict,email_message_id uuid unique references public.email_messages(id) on delete restrict,
 unique(purpose,occurrence_id,channel),unique(event_id,channel),
 check((status='suppressed')=(reason is not null)),check((status='preparing')=(work_token is not null)),
 check((channel='sms' and email_message_id is null) or (channel='email' and sms_batch_id is null)),
 check(purpose<>'more_information' or information_id is not null),check(purpose<>'pickup_scheduled' or shipment_job_id is not null)
);
create unique index after_sales_communications_once on public.after_sales_communications(claim_id,purpose,channel) where purpose in ('approved','rejected','received','resolved');
create index after_sales_communications_prepare on public.after_sales_communications(channel,available_at,created_at,id) where status='pending';
create index after_sales_communications_history on public.after_sales_communications(claim_id,created_at desc,id desc);

create function public.after_sales_communication_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op in ('DELETE','TRUNCATE') or current_setting('app.claim_communication_write',true) is distinct from 'on' then raise exception 'Canonical claim communication required.' using errcode='42501';end if;
 if tg_op='UPDATE' and tg_table_name='after_sales_communications' and
  (to_jsonb(new)-array['status','reason','attempts','work_token','started_at','available_at','sms_batch_id','email_message_id','recipient_masked','updated_at']) is distinct from
  (to_jsonb(old)-array['status','reason','attempts','work_token','started_at','available_at','sms_batch_id','email_message_id','recipient_masked','updated_at']) then raise exception 'Claim communication intent is immutable.' using errcode='42501';end if;
 if tg_op='UPDATE' and tg_table_name='after_sales_communications' and ((to_jsonb(old)->>'sms_batch_id' is not null and to_jsonb(new)->>'sms_batch_id' is distinct from to_jsonb(old)->>'sms_batch_id') or (to_jsonb(old)->>'email_message_id' is not null and to_jsonb(new)->>'email_message_id' is distinct from to_jsonb(old)->>'email_message_id')) then raise exception 'Claim communication linkage is immutable.' using errcode='42501';end if;
 return new;
end $$;

create function public.after_sales_communication_template(p_channel text,p_reference text,p_purpose text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare t jsonb;source text;body text;lang text;v text[];allowed text[]:=array['customer_name','claim_reference','claim_type','order_number','product_name','claim_url'];
begin
 if p_channel='sms' then select to_jsonb(s) into t from public.sms_templates s where s.id::text=p_reference;
 elsif p_channel='email' then select to_jsonb(s) into t from public.email_templates s where s.key=p_reference;else return null;end if;
 if t is null or not coalesce((t->>'is_enabled')::boolean,false) or t->>'category' is distinct from 'claims:'||p_purpose or
  coalesce(t->>'code',t->>'key','') !~ ('^claim_'||p_purpose||'(_[a-z0-9]+)*$') or
  (p_channel='sms' and t->>'traffic_type' is distinct from 'notification') or (p_channel='email' and t->>'classification' is distinct from 'transactional') then return null;end if;
 allowed:=allowed||case p_purpose when 'more_information' then array['request_text'] when 'pickup_scheduled' then array['courier_name','awb'] when 'resolution_decided' then array['resolution'] when 'resolved' then array['resolution'] else '{}'::text[] end;
 foreach lang in array array['en','ar'] loop
  body:=t->>case p_channel when 'sms' then 'text_'||lang else 'body_'||lang end;
  source:=coalesce(body,'')||case when p_channel='email' then coalesce(t->>('subject_'||lang),'') else '' end;
  if nullif(btrim(body),'') is null or position('{{claim_reference}}' in source)=0 or position('{{claim_url}}' in body)=0 or
   (p_channel='email' and p_purpose='more_information' and position('{{request_text}}' in body)=0) or
   regexp_replace(source,'\{\{\s*([a-z][a-z0-9_]{0,39})\s*\}\}','','g') ~ '[{}]' then return null;end if;
  for v in select regexp_matches(source,'\{\{\s*([a-z][a-z0-9_]{0,39})\s*\}\}','g') loop if not(v[1]=any(allowed)) then return null;end if;end loop;
 end loop;
 return t;
end $$;
create function public.after_sales_communication_fingerprint(p_template jsonb) returns text language sql immutable set search_path='' as $$
 select encode(sha256(convert_to(p_template::text,'UTF8')),'hex');
$$;

create function public.after_sales_communication_reason(e public.after_sales_communications) returns text language plpgsql stable security definer set search_path='' as $$
declare s public.after_sales_communication_settings;sm public.sms_provider_settings;em public.email_provider_settings;c public.after_sales_claims;t jsonb;a public.admin_users;j public.shipping_claim_jobs;
begin
 if e.status='suppressed' then return e.reason;end if;
 if e.expires_at<=clock_timestamp() then return 'expired';end if;
 select * into s from public.after_sales_communication_settings where purpose=e.purpose;
 if not coalesce(s.is_enabled,false) then return 'event_disabled';end if;
 if not(case e.channel when 'sms' then s.sms_enabled else s.email_enabled end) then return 'channel_disabled';end if;
 if e.setting_revision is distinct from s.revision then return 'configuration_changed';end if;
 select * into a from public.admin_users where id=s.updated_by;
 if not coalesce(a.is_active,false) or not(a.role='owner' or coalesce((a.permissions->>'claims.view')::boolean,false) and coalesce((a.permissions->>'claims.communications.view')::boolean,false) and coalesce((a.permissions->>'claims.communications.manage')::boolean,false)) then return 'approver_revoked';end if;
 select * into c from public.after_sales_claims where id=e.claim_id;
 if not exists(select 1 from public.customer_orders o join public.customer_profiles p on p.id=o.user_id where o.id=c.order_id and o.user_id=c.customer_id and p.is_active) then return 'superseded';end if;
 if c.status='cancelled' or (c.status='rejected' and e.purpose<>'rejected') then return 'superseded';end if;
 if e.purpose='more_information' and not exists(select 1 from public.after_sales_claim_information r where r.id=e.information_id and r.claim_id=c.id and r.response_at is null and c.status='more_information_required') then return 'superseded';end if;
 if e.purpose='resolution_decided' and (c.resolution is distinct from e.payload->>'resolution' or c.status not in ('resolution_in_progress','resolved') or exists(select 1 from public.after_sales_communications n where n.claim_id=c.id and n.purpose='resolution_decided' and n.channel=e.channel and (n.created_at,n.id)>(e.created_at,e.id))) then return 'superseded';end if;
 if e.purpose='pickup_scheduled' then
  select * into j from public.shipping_claim_jobs where id=e.shipment_job_id;
  if j.state<>'created' or j.awb is distinct from e.payload->>'awb' or c.status not in ('pickup_scheduled','in_transit') or exists(select 1 from public.shipping_claim_jobs n where n.claim_id=c.id and (n.created_at,n.id)>(j.created_at,j.id)) then return 'superseded';end if;
 end if;
 if e.channel='sms' then
  select * into sm from public.sms_provider_settings where id='vodafone';
  if not coalesce(sm.is_enabled,false) then return 'provider_disabled';end if;
  if sm.config_revision is distinct from e.provider_revision then return 'configuration_changed';end if;
  if sm.account_id_encrypted is null or sm.password_encrypted is null or sm.hash_secret_encrypted is null or sm.base_url='' or sm.expected_outbound_ip='' or not sm.trusted_ip_confirmed or not sm.activation_confirmed or not sm.hash_protocol_confirmed or (e.sender=any(sm.sender_names)) is distinct from true then return 'provider_not_ready';end if;
 else
  select * into em from public.email_provider_settings where id='brevo';
  if not coalesce((em.config->>'is_enabled')::boolean,false) then return 'provider_disabled';end if;
  if em.revision is distinct from e.provider_revision then return 'configuration_changed';end if;
  if not public.email_ready(em) or not exists(select 1 from jsonb_array_elements(em.config->'approved_senders') x where x->>'email'=e.sender and (x->>'verified')::boolean) then return 'provider_not_ready';end if;
 end if;
 t:=public.after_sales_communication_template(e.channel,e.template_reference,e.purpose);
 if t is null or public.after_sales_communication_fingerprint(t) is distinct from e.template_fingerprint or
  e.template_reference is distinct from (case when e.channel='sms' then (case e.locale when 'ar' then s.sms_template_ar else s.sms_template_en end)::text else case e.locale when 'ar' then s.email_template_ar else s.email_template_en end end) or
  e.template_fingerprint is distinct from s.approvals->>(e.channel||'_'||e.locale) then return 'template_unavailable';end if;
 return null;
end $$;

create function public.after_sales_capture_communication() returns trigger language plpgsql security definer set search_path='' as $$
declare purpose_value text;c public.after_sales_claims;o public.customer_orders;i public.customer_order_items;s public.after_sales_communication_settings;r public.after_sales_claim_information;j public.shipping_claim_jobs;
 sm public.sms_provider_settings;em public.email_provider_settings;intent public.after_sales_communications;channel_value text;reference_value text;t jsonb;occurrence uuid;payload_value jsonb;at_time timestamptz;source_reason text;
begin
 if not new.customer_visible then return new;end if;
 purpose_value:=case when new.event_type='request_information' and new.status='more_information_required' then 'more_information' when new.event_type='approve' and new.status='approved' then 'approved' when new.event_type='reject' and new.status='rejected' then 'rejected'
  when new.event_type='reverse_created' and new.status='pickup_scheduled' then 'pickup_scheduled' when new.event_type in ('receive','reverse_received') and new.status='received' then 'received'
  when new.event_type='select_resolution' and new.status='resolution_in_progress' then 'resolution_decided' when new.event_type='resolve' and new.status='resolved' then 'resolved' end;
 if purpose_value is null then return new;end if;
 select * into s from public.after_sales_communication_settings where purpose=purpose_value;
 if new.created_at<s.capture_started_at then return new;end if;
 select * into c from public.after_sales_claims where id=new.claim_id;select * into o from public.customer_orders where id=c.order_id;select * into i from public.customer_order_items where id=c.item_id;
 occurrence:=new.id;at_time:=new.created_at;
 if purpose_value='more_information' then
  select * into r from public.after_sales_claim_information where claim_id=c.id and response_at is null;
  if r.id is null then return new;end if;occurrence:=r.id;
 elsif purpose_value='pickup_scheduled' or new.event_type='reverse_received' then
  select * into j from public.shipping_claim_jobs where claim_id=c.id order by created_at desc,id desc limit 1;
  if j.id is null or j.awb is null then return new;end if;
  if purpose_value='pickup_scheduled' then if j.state<>'created' then return new;end if;occurrence:=j.id;
  else
   if j.state<>'delivered' or j.normalized_state<>'delivered' or j.provider_status_at is null then return new;end if;at_time:=j.provider_status_at;
  end if;
 elsif purpose_value='resolution_decided' and new.resolution is not distinct from (select e.resolution from public.after_sales_claim_events e where e.claim_id=c.id and e.event_type='select_resolution' and e.id<>new.id order by e.created_at desc,e.id desc limit 1) then return new;
 end if;
 select * into sm from public.sms_provider_settings where id='vodafone';select * into em from public.email_provider_settings where id='brevo';
 payload_value:=jsonb_build_object('customer_name',concat_ws(' ',o.first_name,o.last_name),'claim_reference',c.reference,'claim_type',c.claim_type,'order_number',coalesce(o.order_number,''),'product_name',coalesce(to_jsonb(i)->>'product_title',to_jsonb(i)->>'product_name',''),
  'request_text',case when purpose_value='more_information' then r.prompt else '' end,'courier_name',case when purpose_value='pickup_scheduled' then 'PDC' else '' end,'awb',case when purpose_value='pickup_scheduled' then j.awb else '' end,'resolution',coalesce(new.resolution,''),'claim_url','https://new.elcomputer.net'||case when o.sms_locale='ar' then '/ar' else '' end||'/account/after-sales/'||c.id::text);
 perform set_config('app.claim_communication_write','on',true);
 foreach channel_value in array array['sms','email'] loop
  intent:=null;intent.id:=gen_random_uuid();intent.claim_id:=c.id;intent.purpose:=purpose_value;intent.channel:=channel_value;intent.status:='pending';intent.locale:=coalesce(o.sms_locale,'en');
  reference_value:=case when channel_value='sms' then (case intent.locale when 'ar' then s.sms_template_ar else s.sms_template_en end)::text else case intent.locale when 'ar' then s.email_template_ar else s.email_template_en end end;
  t:=public.after_sales_communication_template(channel_value,reference_value,purpose_value);
  intent.template_reference:=reference_value;intent.template_snapshot:=t;intent.template_fingerprint:=public.after_sales_communication_fingerprint(t);intent.setting_revision:=s.revision;
  intent.provider_revision:=case channel_value when 'sms' then sm.config_revision else em.revision end;
  intent.sender:=case channel_value when 'sms' then coalesce(nullif(s.sms_sender,''),nullif(t->>'sender',''),sm.default_sender,'') else coalesce(nullif(s.email_sender,''),nullif(t->>'sender',''),em.config->>'transactional_sender','') end;
  intent.recipient:=case channel_value when 'sms' then coalesce(o.phone,'') else lower(coalesce(o.email,'')) end;
  intent.payload:=payload_value;intent.information_id:=r.id;intent.shipment_job_id:=j.id;
  intent.expires_at:=least(new.created_at+interval '10 minutes',at_time+interval '10 minutes');
  source_reason:=case when at_time<s.updated_at or at_time>clock_timestamp()+interval '5 minutes' then 'stale_event' end;
  intent.reason:=coalesce(source_reason,public.after_sales_communication_reason(intent));
  if intent.reason is null and intent.recipient='' then intent.reason:=case channel_value when 'sms' then 'invalid_phone' else 'invalid_email' end;end if;
  insert into public.after_sales_communications(id,claim_id,event_id,purpose,occurrence_id,information_id,shipment_job_id,channel,locale,recipient,recipient_masked,payload,template_reference,template_snapshot,template_fingerprint,sender,setting_revision,provider_revision,occurred_at,expires_at,status,reason)
  values(intent.id,c.id,new.id,purpose_value,occurrence,r.id,j.id,channel_value,intent.locale,intent.recipient,case when channel_value='sms' and intent.recipient ~ '[0-9]{3}$' then '••••••'||right(intent.recipient,3) when channel_value='email' and intent.recipient ~ '^[^@]+@[^@]+$' then left(intent.recipient,1)||'•••@'||split_part(intent.recipient,'@',2) else '' end,payload_value,reference_value,t,intent.template_fingerprint,intent.sender,s.revision,intent.provider_revision,at_time,intent.expires_at,case when intent.reason is null then 'pending' else 'suppressed' end,intent.reason) on conflict do nothing;
 end loop;
 -- Deliberately no exception-swallowing: outbox loss rolls back this milestone.
 -- No queue insertion or provider request occurs in the Claim/PDC transaction.
 return new;
end $$;
create trigger after_sales_capture_communication after insert on public.after_sales_claim_events for each row execute function public.after_sales_capture_communication();

create function public.after_sales_communication_configure(p_actor uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.after_sales_communication_settings;t jsonb;v_approvals jsonb:='{}';ch text;lang text;ref text;sm public.sms_provider_settings;em public.email_provider_settings;
begin
 perform public.after_sales_claim_assert_actor(p_actor,'claims.communications.view');perform public.after_sales_claim_assert_actor(p_actor,'claims.communications.manage');
 if p_input is null or jsonb_typeof(p_input)<>'object' or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('purpose','revision','is_enabled','sms_enabled','email_enabled','sms_template_en','sms_template_ar','email_template_en','email_template_ar','sms_sender','email_sender')) then raise exception 'Invalid claim input.' using errcode='22023';end if;
 foreach ch in array array['is_enabled','sms_enabled','email_enabled'] loop if jsonb_typeof(p_input->ch) is distinct from 'boolean' then raise exception 'Invalid claim input.' using errcode='22023';end if;end loop;
 -- Shared lock order with central preparation/dispatch, before settings/intent rows.
 select * into sm from public.sms_provider_settings where id='vodafone' for update;select * into em from public.email_provider_settings where id='brevo' for update;
 select * into s from public.after_sales_communication_settings where purpose=p_input->>'purpose' for update;
 if not found or s.revision is distinct from (p_input->>'revision')::integer then raise exception 'Claim retry conflict.' using errcode='40001';end if;
 foreach ch in array array['sms','email'] loop
  if (p_input->>'is_enabled')::boolean and (p_input->>(ch||'_enabled'))::boolean then
   foreach lang in array array['en','ar'] loop
    ref:=p_input->>(ch||'_template_'||lang);t:=public.after_sales_communication_template(ch,ref,s.purpose);
    if t is null then raise exception 'Invalid claim input.' using errcode='22023';end if;
    v_approvals:=v_approvals||jsonb_build_object(ch||'_'||lang,public.after_sales_communication_fingerprint(t));
    ref:=coalesce(nullif(p_input->>(ch||'_sender'),''),nullif(t->>'sender',''),case ch when 'sms' then sm.default_sender else em.config->>'transactional_sender' end);
    if (ch='sms' and (ref=any(sm.sender_names)) is distinct from true) or (ch='email' and not exists(select 1 from jsonb_array_elements(em.config->'approved_senders') x where x->>'email'=ref and (x->>'verified')::boolean)) then raise exception 'Invalid claim input.' using errcode='22023';end if;
   end loop;
  end if;
 end loop;
 perform set_config('app.claim_communication_write','on',true);
 update public.after_sales_communication_settings set is_enabled=(p_input->>'is_enabled')::boolean,sms_enabled=(p_input->>'sms_enabled')::boolean,email_enabled=(p_input->>'email_enabled')::boolean,
  sms_template_en=nullif(p_input->>'sms_template_en','')::uuid,sms_template_ar=nullif(p_input->>'sms_template_ar','')::uuid,email_template_en=nullif(p_input->>'email_template_en',''),email_template_ar=nullif(p_input->>'email_template_ar',''),sms_sender=coalesce(p_input->>'sms_sender',''),email_sender=coalesce(p_input->>'email_sender',''),approvals=v_approvals,revision=revision+1,updated_at=clock_timestamp(),updated_by=p_actor where purpose=s.purpose returning * into s;
 update public.after_sales_communications set status='suppressed',reason='configuration_changed',work_token=null,started_at=null,updated_at=clock_timestamp() where purpose=s.purpose and (status in ('pending','preparing') or status='queued' and (exists(select 1 from public.sms_batches b where b.id=sms_batch_id and b.status='queued') or exists(select 1 from public.email_messages m where m.id=email_message_id and m.state='queued')));
 perform public.email_audit(p_actor,'claims.communication.settings',jsonb_build_object('purpose',s.purpose,'revision',s.revision,'enabled',s.is_enabled,'sms',s.sms_enabled,'email',s.email_enabled,'sms_template_en',s.sms_template_en,'sms_template_ar',s.sms_template_ar,'email_template_en',s.email_template_en,'email_template_ar',s.email_template_ar));
 return to_jsonb(s)-array['approvals','capture_started_at','updated_by'];
end $$;

create function public.after_sales_communication_take(p_channel text) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.after_sales_communications;failure text;
begin
 if p_channel='sms' then perform 1 from public.sms_provider_settings where id='vodafone' for update;elsif p_channel='email' then perform 1 from public.email_provider_settings where id='brevo' for update;else raise exception 'Invalid claim input.' using errcode='22023';end if;
 perform set_config('app.claim_communication_write','on',true);
 update public.after_sales_communications set status='pending',work_token=null,started_at=null where channel=p_channel and status='preparing' and started_at<clock_timestamp()-interval '2 minutes';
 for e in select * from public.after_sales_communications where channel=p_channel and status in ('pending','preparing') for update loop
  failure:=coalesce(public.after_sales_communication_reason(e),case when e.attempts>=3 then 'preparation_limit' end);
  if failure is not null then update public.after_sales_communications set status='suppressed',reason=failure,work_token=null,started_at=null,updated_at=clock_timestamp() where id=e.id;end if;
 end loop;
 select * into e from public.after_sales_communications where channel=p_channel and status='pending' and available_at<=clock_timestamp() order by created_at,id for update skip locked limit 1;
 if not found then return null;end if;
 update public.after_sales_communications set status='preparing',work_token=gen_random_uuid(),started_at=clock_timestamp(),attempts=attempts+1,updated_at=clock_timestamp() where id=e.id returning * into e;
 return to_jsonb(e);
end $$;

create function public.after_sales_communication_finish(p_id uuid,p_token uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare e public.after_sales_communications;
begin
 select * into e from public.after_sales_communications where id=p_id for update;
 if not found or e.status<>'preparing' or p_token is null or e.work_token is distinct from p_token then return;end if;
 if p_reason not in ('invalid_phone','invalid_email','invalid_template','segment_limit','provider_disabled','provider_not_ready','storage_error') then raise exception 'Invalid claim input.' using errcode='22023';end if;
 perform set_config('app.claim_communication_write','on',true);
 if p_reason='storage_error' and e.attempts<3 and e.expires_at>clock_timestamp()+interval '30 seconds' then update public.after_sales_communications set status='pending',work_token=null,started_at=null,available_at=clock_timestamp()+interval '30 seconds',updated_at=clock_timestamp() where id=e.id;
 else update public.after_sales_communications set status='suppressed',reason=p_reason,work_token=null,started_at=null,updated_at=clock_timestamp() where id=e.id;end if;
end $$;

create function public.after_sales_communication_enqueue(p_id uuid,p_token uuid,p_channel text,p_payload jsonb,p_messages jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.after_sales_communications;result jsonb;failure text;
begin
 if p_channel='sms' then perform 1 from public.sms_provider_settings where id='vodafone' for update;elsif p_channel='email' then perform 1 from public.email_provider_settings where id='brevo' for update;else raise exception 'Invalid claim input.' using errcode='22023';end if;
 select * into e from public.after_sales_communications where id=p_id for update;
 if not found or e.channel is distinct from p_channel then raise exception 'Invalid claim input.' using errcode='22023';end if;
 if e.status='queued' then return case p_channel when 'sms' then jsonb_build_object('id',e.sms_batch_id,'status','queued','reused',true) else jsonb_build_object('id',e.email_message_id,'state','queued','reused',true) end;end if;
 if e.status<>'preparing' or p_token is null or e.work_token is distinct from p_token or e.started_at<clock_timestamp()-interval '2 minutes' then raise exception 'Claim retry conflict.' using errcode='40001';end if;
 perform set_config('app.claim_communication_write','on',true);failure:=public.after_sales_communication_reason(e);
 if failure is not null then update public.after_sales_communications set status='suppressed',reason=failure,work_token=null,started_at=null,updated_at=clock_timestamp() where id=e.id;return case p_channel when 'sms' then jsonb_build_object('status','suppressed') else jsonb_build_object('state','suppressed') end;end if;
 if p_channel='sms' then
  if p_payload->>'traffic_type' is distinct from 'notification' or p_payload->>'idempotency_key' is distinct from 'claim:'||e.id::text or p_payload->>'template_id' is distinct from e.template_reference or p_payload->>'trigger_source' is distinct from 'claim:'||e.purpose or p_payload->>'triggered_by' is not null or (p_payload->>'expires_at')::timestamptz is distinct from e.expires_at or jsonb_typeof(p_messages) is distinct from 'array' or jsonb_array_length(p_messages)<>1 or p_messages->0->>'sender' is distinct from e.sender then raise exception 'Invalid claim input.' using errcode='22023';end if;
  result:=public.sms_enqueue(p_payload,p_messages);
  update public.after_sales_communications set status='queued',sms_batch_id=(result->>'id')::uuid,work_token=null,started_at=null,updated_at=clock_timestamp() where id=e.id;
 else
  if p_payload->>'classification' is distinct from 'transactional' or p_payload->>'source' is distinct from 'service' or p_payload->>'idempotency_key' is distinct from e.id::text or p_payload->>'template_key' is distinct from e.template_reference or p_payload->>'recipient' is distinct from e.recipient or p_payload->>'sender' is distinct from e.sender or p_payload->>'unsubscribe_hash' is not null or p_messages is not null then raise exception 'Invalid claim input.' using errcode='22023';end if;
  result:=public.email_command('enqueue',p_payload,null);
  update public.after_sales_communications set status=case when result->>'state'='suppressed' then 'suppressed' else 'queued' end,reason=case when result->>'state'='suppressed' then 'recipient_restricted' end,email_message_id=(result->>'id')::uuid,work_token=null,started_at=null,updated_at=clock_timestamp() where id=e.id;
 end if;
 return result;
end $$;

-- Extend only linked Claim jobs' final authorization; original implementations retained.
alter function public.sms_check_dispatch(uuid,uuid,integer) rename to sms_check_dispatch_before_claim_communications;
create function public.sms_check_dispatch(p_id uuid,p_token uuid,p_revision integer) returns boolean language plpgsql security definer set search_path='' as $$
declare allowed boolean;
begin
 allowed:=public.sms_check_dispatch_before_claim_communications(p_id,p_token,p_revision);
 if allowed is distinct from true then return allowed;end if;
 return not exists(select 1 from public.after_sales_communications e where e.sms_batch_id=p_id and public.after_sales_communication_reason(e) is not null);
end $$;
alter function public.email_command(text,jsonb,uuid) rename to email_command_before_claim_communications;
create function public.email_command(p_action text,p_input jsonb default '{}',p_actor uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.after_sales_communications;failure text;result jsonb;
begin
 if p_action='dispatch' then
  perform 1 from public.email_provider_settings where id='brevo' for update;
  select * into e from public.after_sales_communications where email_message_id=(p_input->>'id')::uuid;
  if found then
   failure:=public.after_sales_communication_reason(e);
   if failure is not null then
    result:=public.email_command_before_claim_communications('finish',p_input||jsonb_build_object('state','suppressed','error_category',failure),null);
    return jsonb_build_object('allowed',false,'state',case when result->>'matched'='true' then 'suppressed' else 'uncertain' end);
   end if;
  end if;
 end if;
 return public.email_command_before_claim_communications(p_action,p_input,p_actor);
end $$;

create function public.after_sales_communication_history(p_actor uuid,p_claim uuid,p_page integer default 1) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;total integer;
begin
 perform public.after_sales_claim_assert_actor(p_actor,'claims.communications.view');
 if not exists(select 1 from public.after_sales_claims where id=p_claim) then raise exception 'Claim not found.' using errcode='P0002';end if;
 if p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid claim input.' using errcode='22023';end if;
 select count(*) into total from public.after_sales_communications where claim_id=p_claim;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]') into result from (
  select e.id,e.purpose,e.channel,e.template_reference,e.recipient_masked,e.locale,e.sender,e.status,e.reason,e.created_at,e.occurred_at,e.attempts preparation_attempts,e.sms_batch_id,e.email_message_id,
   coalesce(b.status,m.state) queue_state,coalesce(b.attempts,m.attempts) attempts,m.delivery_state,m.accepted_at,b.submitted_at,
   coalesce(b.failure_category,m.error_category) error_category
  from public.after_sales_communications e left join public.sms_batches b on b.id=e.sms_batch_id left join public.email_messages m on m.id=e.email_message_id
  where e.claim_id=p_claim order by e.created_at desc,e.id desc limit 25 offset (p_page-1)*25
 )q;
 return jsonb_build_object('items',result,'total',total,'page',p_page);
end $$;

do $$ declare name text;f record;begin
 foreach name in array array['after_sales_communication_settings','after_sales_communications'] loop
  execute format('alter table public.%I enable row level security',name);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',name);
  execute format('grant select on public.%I to service_role',name);
  execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.after_sales_communication_guard()',name||'_guard',name);
  execute format('create trigger %I before truncate on public.%I for each statement execute function public.after_sales_communication_guard()',name||'_truncate_guard',name);
 end loop;
 for f in select oid::regprocedure signature,proname from pg_proc where pronamespace='public'::regnamespace and (proname like 'after_sales_communication_%' or proname='after_sales_capture_communication' or proname in ('sms_check_dispatch','email_command','sms_check_dispatch_before_claim_communications','email_command_before_claim_communications')) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  if f.proname in ('after_sales_communication_configure','after_sales_communication_take','after_sales_communication_enqueue','after_sales_communication_finish','after_sales_communication_history','sms_check_dispatch','email_command') then execute format('grant execute on function %s to service_role',f.signature);end if;
 end loop;
end $$;
-- Recognize and retain communication controls/intents; no erase or provider replay.
do $$ declare definition text;anchor text:='''email_events'']';finish text:='  return jsonb_build_object(''counts'', v_counts, ''blockers'', v_blockers);';begin
 definition:=pg_get_functiondef('public.system_reset_plan(uuid,text)'::regprocedure);
 if position(anchor in definition)=0 or position(finish in definition)=0 then raise exception 'Review claim communication reset integration.';end if;
 definition:=replace(definition,anchor,'''email_events'', ''after_sales_communication_settings'', ''after_sales_communications'']');
 definition:=replace(definition,finish,$code$
  if p_scope='full' then
   select (select count(*) from public.after_sales_communications)+(select count(*) from public.after_sales_communication_settings where updated_by is not null) into v_count;
   if v_count>0 then v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('table','claim_communications_retained','count',v_count));end if;
  end if;
  return jsonb_build_object('counts', v_counts, 'blockers', v_blockers);
$code$);execute definition;
end $$;
notify pgrst,'reload schema';
commit;
