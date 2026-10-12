-- Requires a verified empty new project; not an upgrade migration.
DO $fresh_target$
BEGIN
 IF current_user <> 'postgres' OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) THEN RAISE EXCEPTION 'Expected non-superuser postgres migration role.'; END IF;
 IF EXISTS(SELECT FROM pg_class WHERE relnamespace='public'::regnamespace) OR EXISTS(SELECT FROM pg_proc WHERE pronamespace='public'::regnamespace) OR EXISTS(SELECT FROM pg_type WHERE typnamespace='public'::regnamespace) THEN RAISE EXCEPTION 'Application schema is occupied.'; END IF;
 IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN RAISE EXCEPTION 'Migration history is occupied or unverified.'; END IF;
 IF EXISTS(SELECT FROM auth.users) OR EXISTS(SELECT FROM storage.buckets) OR EXISTS(SELECT FROM storage.objects) THEN RAISE EXCEPTION 'Auth or Storage target is occupied.'; END IF;
 IF EXISTS(SELECT FROM pg_roles WHERE rolname IN ('anon','authenticated') AND (rolsuper OR rolbypassrls)) THEN RAISE EXCEPTION 'Browser roles must not bypass RLS.'; END IF;
 IF has_schema_privilege('anon','public','CREATE') OR has_schema_privilege('authenticated','public','CREATE') THEN RAISE EXCEPTION 'Browser roles must not create public objects.'; END IF;
 IF current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999 THEN RAISE EXCEPTION 'PostgreSQL 17 capability profile required.'; END IF;
 IF NOT EXISTS(SELECT FROM pg_class WHERE oid='storage.objects'::regclass AND relkind='r' AND relrowsecurity) OR NOT EXISTS(SELECT FROM pg_class WHERE oid='realtime.messages'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'Managed RLS capability missing.'; END IF;
 IF NOT EXISTS(SELECT FROM pg_settings WHERE name='supautils.policy_grants' AND context='sighup') THEN RAISE EXCEPTION 'Actual Supautils policy delegation required.'; END IF;
END $fresh_target$;
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: after_sales_capture_communication(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_capture_communication() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
end $_$;


--
-- Name: after_sales_capture_purchase(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_capture_purchase() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: after_sales_claim_action_permission(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_claim_action_permission(p_action text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select case p_action when 'review' then 'claims.review' when 'request_information' then 'claims.review' when 'verify_serial' then 'claims.review'
    when 'approve' then 'claims.decide' when 'reject' then 'claims.decide' when 'receive' then 'claims.manage' when 'inspect' then 'claims.manage' when 'cancel' then 'claims.manage'
    when 'select_resolution' then 'claims.resolution' when 'resolve' then 'claims.resolution' when 'note' then 'claims.notes' end;
$$;


--
-- Name: after_sales_claim_actions(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_claim_actions(p_status text) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
 select case when p_status in ('pickup_scheduled','in_transit') then array['receive','note'] else public.after_sales_claim_actions_before_reverse(p_status) end;
$$;


--
-- Name: after_sales_claim_actions_before_reverse(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_claim_actions_before_reverse(p_status text) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select array['note']||case p_status when 'submitted' then array['review','cancel'] when 'under_review' then array['request_information','verify_serial','approve','reject','cancel']
    when 'more_information_required' then array['reject','cancel'] when 'approved' then array['receive','cancel'] when 'received' then array['inspect']
    when 'under_inspection' then array['select_resolution'] when 'resolution_in_progress' then array['select_resolution','resolve'] else '{}'::text[] end;
$$;


--
-- Name: after_sales_claim_assert_actor(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_claim_assert_actor(p_actor uuid, p_permission text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Claim authorization required.' using errcode='42501'; end if;
  if p_permission is null then
    if not exists(select 1 from public.customer_profiles c join auth.users u on u.id=c.id where c.id=p_actor and c.is_active and not u.is_anonymous) then raise exception 'Claim authorization required.' using errcode='42501'; end if;
  elsif not exists(select 1 from public.admin_users a where a.id=p_actor and a.is_active and
    (a.role='owner' or (coalesce((a.permissions->>'claims.view')::boolean,false) and coalesce((a.permissions->>p_permission)::boolean,false)))) then raise exception 'Claim authorization required.' using errcode='42501'; end if;
end $$;


--
-- Name: after_sales_claim_context(uuid, uuid, text, jsonb, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_claim_context(p_customer uuid, p_item uuid, p_type text, p_input jsonb DEFAULT '{}'::jsonb, p_evidence_count integer DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: after_sales_claim_create(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_claim_create(p_customer uuid, p_input jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: after_sales_claim_customer_action(uuid, uuid, integer, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_claim_customer_action(p_customer uuid, p_claim uuid, p_revision integer, p_action text, p_input jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    SET statement_timeout TO '4s'
    SET lock_timeout TO '2s'
    AS $$
begin
  perform public.after_sales_claim_assert_actor(p_customer);
  perform 1 from public.customer_order_items where id=(select item_id from public.after_sales_claims where id=p_claim) for update;
  perform 1 from public.after_sales_claims where id=p_claim and customer_id=p_customer for update;
  if not found then raise exception 'Claim not found.' using errcode='P0002'; end if;
  if p_action='cancel' and exists(select 1 from public.shipping_claim_jobs where claim_id=p_claim and state in ('queued','creating','created','uncertain')) then raise exception 'Reverse booking conflict.' using errcode='23514'; end if;
  return public.after_sales_claim_customer_action_before_reverse(p_customer,p_claim,p_revision,p_action,p_input);
end $$;


--
-- Name: after_sales_claim_customer_action_before_reverse(uuid, uuid, integer, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_claim_customer_action_before_reverse(p_customer uuid, p_claim uuid, p_revision integer, p_action text, p_input jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: after_sales_claim_detail(uuid, uuid, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_claim_detail(p_actor uuid, p_claim uuid, p_staff boolean DEFAULT false, p_before uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    SET statement_timeout TO '4s'
    SET lock_timeout TO '2s'
    AS $$
declare result jsonb; active boolean;
begin
  result:=public.after_sales_claim_detail_before_reverse(p_actor,p_claim,p_staff,p_before);
  active:=exists(select 1 from public.shipping_claim_jobs where claim_id=p_claim and state in ('queued','creating','created','uncertain'));
  if active then result:=jsonb_set(result,'{allowed_actions}',coalesce((select jsonb_agg(x) from jsonb_array_elements_text(result->'allowed_actions') x where x not in ('receive','cancel')),'[]')); end if;
  return result||jsonb_build_object('customer_can_cancel',not active);
end $$;


--
-- Name: after_sales_claim_detail_before_reverse(uuid, uuid, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_claim_detail_before_reverse(p_actor uuid, p_claim uuid, p_staff boolean DEFAULT false, p_before uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: after_sales_claim_emit(uuid, uuid, text, text, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_claim_emit(p_claim uuid, p_actor uuid, p_kind text, p_event text, p_body text DEFAULT ''::text, p_visible boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: after_sales_claim_finish_evidence(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_claim_finish_evidence(p_customer uuid, p_id uuid, p_remove boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: after_sales_claim_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_claim_guard() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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


--
-- Name: after_sales_claim_items(uuid, integer, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_claim_items(p_customer uuid, p_page integer DEFAULT 1, p_order uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare items jsonb; total integer;
begin
  perform public.after_sales_claim_assert_actor(p_customer);
  if p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  select count(*) into total from public.customer_order_items i join public.customer_orders o on o.id=i.order_id where o.user_id=p_customer and (p_order is null or o.id=p_order);
  select coalesce(jsonb_agg(jsonb_build_object('return',public.after_sales_claim_context(p_customer,x.id,'return'),'warranty',public.after_sales_claim_context(p_customer,x.id,'warranty')) order by x.created_at desc,x.id),'[]') into items
    from (select i.id,o.created_at from public.customer_order_items i join public.customer_orders o on o.id=i.order_id where o.user_id=p_customer and (p_order is null or o.id=p_order) order by o.created_at desc,i.id limit 20 offset (p_page-1)*20) x;
  return jsonb_build_object('items',items,'total',total,'page',p_page);
end $$;


--
-- Name: after_sales_claim_list(uuid, boolean, text, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_claim_list(p_actor uuid, p_staff boolean DEFAULT false, p_type text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_search text DEFAULT ''::text, p_page integer DEFAULT 1) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: after_sales_claim_next(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_claim_next(p_status text) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
 select case p_status when 'pickup_scheduled' then array['in_transit','received'] when 'in_transit' then array['received'] when 'approved' then array['received','cancelled','pickup_scheduled'] else public.after_sales_claim_next_before_reverse(p_status) end;
$$;


--
-- Name: after_sales_claim_next_before_reverse(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_claim_next_before_reverse(p_status text) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select case p_status when 'submitted' then array['under_review','cancelled'] when 'under_review' then array['more_information_required','approved','rejected','cancelled']
    when 'more_information_required' then array['under_review','rejected','cancelled'] when 'approved' then array['received','cancelled']
    when 'received' then array['under_inspection'] when 'under_inspection' then array['resolution_in_progress']
    when 'resolution_in_progress' then array['resolution_in_progress','resolved'] else '{}'::text[] end;
$$;


--
-- Name: after_sales_claim_preview(uuid, uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_claim_preview(p_customer uuid, p_item uuid, p_type text, p_input jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare ids text[]; files integer;
begin
  perform public.after_sales_claim_assert_actor(p_customer);
  ids:=array(select jsonb_array_elements_text(coalesce(p_input->'attachment_ids','[]')));
  if cardinality(ids)>5 or cardinality(ids)<>(select count(distinct x) from unnest(ids) x) then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  select count(*) into files from public.after_sales_claim_evidence e where e.id::text=any(ids) and e.customer_id=p_customer and e.item_id=p_item and e.claim_type=p_type and e.claim_id is null and e.target_claim_id is null and e.is_ready and e.removed_at is null and e.created_at>clock_timestamp()-interval '24 hours';
  if files<>cardinality(ids) then raise exception 'Claim evidence unavailable.' using errcode='22023'; end if;
  return public.after_sales_claim_context(p_customer,p_item,p_type,p_input,files);
end $$;


--
-- Name: after_sales_claim_read_evidence(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_claim_read_evidence(p_actor uuid, p_id uuid, p_staff boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare e public.after_sales_claim_evidence%rowtype;
begin
  perform public.after_sales_claim_assert_actor(p_actor,case when p_staff then 'claims.evidence' else null end);
  select * into e from public.after_sales_claim_evidence where id=p_id and is_ready and removed_at is null and
    ((not p_staff and customer_id=p_actor) or (p_staff and claim_id is not null));
  if not found then raise exception 'Claim evidence unavailable.' using errcode='P0002'; end if;
  return jsonb_build_object('id',e.id,'original_name',e.original_name,'storage_path',e.storage_path,'mime_type',e.mime_type,'size_bytes',e.size_bytes,'content_sha256',e.content_sha256);
end $$;


--
-- Name: after_sales_claim_reserve_evidence(uuid, uuid, text, uuid, text, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_claim_reserve_evidence(p_customer uuid, p_item uuid, p_type text, p_id uuid, p_reason text, p_target uuid, p_metadata jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: after_sales_claim_staff_action(uuid, uuid, integer, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_claim_staff_action(p_admin uuid, p_claim uuid, p_revision integer, p_action text, p_input jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    SET statement_timeout TO '4s'
    SET lock_timeout TO '2s'
    AS $$
begin
  perform public.after_sales_claim_assert_actor(p_admin,public.after_sales_claim_action_permission(p_action));
  perform 1 from public.customer_order_items where id=(select item_id from public.after_sales_claims where id=p_claim) for update;
  perform 1 from public.after_sales_claims where id=p_claim for update;
  if p_action in ('cancel','receive') and exists(select 1 from public.shipping_claim_jobs where claim_id=p_claim and state in ('queued','creating','created','uncertain')) then raise exception 'Reverse booking conflict.' using errcode='23514'; end if;
  return public.after_sales_claim_staff_action_before_reverse(p_admin,p_claim,p_revision,p_action,p_input);
end $$;


--
-- Name: after_sales_claim_staff_action_before_reverse(uuid, uuid, integer, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_claim_staff_action_before_reverse(p_admin uuid, p_claim uuid, p_revision integer, p_action text, p_input jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: after_sales_claim_staged_evidence(uuid, uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_claim_staged_evidence(p_customer uuid, p_item uuid, p_type text, p_target uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: after_sales_communication_configure(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_communication_configure(p_actor uuid, p_input jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: after_sales_communication_enqueue(uuid, uuid, text, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_communication_enqueue(p_id uuid, p_token uuid, p_channel text, p_payload jsonb, p_messages jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: after_sales_communication_fingerprint(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_communication_fingerprint(p_template jsonb) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
 select encode(sha256(convert_to(p_template::text,'UTF8')),'hex');
$$;


--
-- Name: after_sales_communication_finish(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_communication_finish(p_id uuid, p_token uuid, p_reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare e public.after_sales_communications;
begin
 select * into e from public.after_sales_communications where id=p_id for update;
 if not found or e.status<>'preparing' or p_token is null or e.work_token is distinct from p_token then return;end if;
 if p_reason not in ('invalid_phone','invalid_email','invalid_template','segment_limit','provider_disabled','provider_not_ready','storage_error') then raise exception 'Invalid claim input.' using errcode='22023';end if;
 perform set_config('app.claim_communication_write','on',true);
 if p_reason='storage_error' and e.attempts<3 and e.expires_at>clock_timestamp()+interval '30 seconds' then update public.after_sales_communications set status='pending',work_token=null,started_at=null,available_at=clock_timestamp()+interval '30 seconds',updated_at=clock_timestamp() where id=e.id;
 else update public.after_sales_communications set status='suppressed',reason=p_reason,work_token=null,started_at=null,updated_at=clock_timestamp() where id=e.id;end if;
end $$;


--
-- Name: after_sales_communication_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_communication_guard() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
 if tg_op in ('DELETE','TRUNCATE') or current_setting('app.claim_communication_write',true) is distinct from 'on' then raise exception 'Canonical claim communication required.' using errcode='42501';end if;
 if tg_op='UPDATE' and tg_table_name='after_sales_communications' and
  (to_jsonb(new)-array['status','reason','attempts','work_token','started_at','available_at','sms_batch_id','email_message_id','recipient_masked','updated_at']) is distinct from
  (to_jsonb(old)-array['status','reason','attempts','work_token','started_at','available_at','sms_batch_id','email_message_id','recipient_masked','updated_at']) then raise exception 'Claim communication intent is immutable.' using errcode='42501';end if;
 if tg_op='UPDATE' and tg_table_name='after_sales_communications' and ((to_jsonb(old)->>'sms_batch_id' is not null and to_jsonb(new)->>'sms_batch_id' is distinct from to_jsonb(old)->>'sms_batch_id') or (to_jsonb(old)->>'email_message_id' is not null and to_jsonb(new)->>'email_message_id' is distinct from to_jsonb(old)->>'email_message_id')) then raise exception 'Claim communication linkage is immutable.' using errcode='42501';end if;
 return new;
end $$;


--
-- Name: after_sales_communication_history(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_communication_history(p_actor uuid, p_claim uuid, p_page integer DEFAULT 1) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: after_sales_communications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.after_sales_communications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    claim_id uuid NOT NULL,
    event_id uuid NOT NULL,
    purpose text NOT NULL,
    occurrence_id uuid NOT NULL,
    information_id uuid,
    shipment_job_id uuid,
    channel text NOT NULL,
    locale text NOT NULL,
    recipient text DEFAULT ''::text NOT NULL,
    recipient_masked text DEFAULT ''::text NOT NULL,
    payload jsonb NOT NULL,
    template_reference text,
    template_snapshot jsonb,
    template_fingerprint text,
    sender text DEFAULT ''::text NOT NULL,
    setting_revision integer NOT NULL,
    provider_revision integer NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    expires_at timestamp(3) with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    updated_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    status text NOT NULL,
    reason text,
    attempts integer DEFAULT 0 NOT NULL,
    work_token uuid,
    started_at timestamp with time zone,
    available_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    sms_batch_id uuid,
    email_message_id uuid,
    CONSTRAINT after_sales_communications_attempts_check CHECK (((attempts >= 0) AND (attempts <= 3))),
    CONSTRAINT after_sales_communications_channel_check CHECK ((channel = ANY (ARRAY['sms'::text, 'email'::text]))),
    CONSTRAINT after_sales_communications_check CHECK (((status = 'suppressed'::text) = (reason IS NOT NULL))),
    CONSTRAINT after_sales_communications_check1 CHECK (((status = 'preparing'::text) = (work_token IS NOT NULL))),
    CONSTRAINT after_sales_communications_check2 CHECK ((((channel = 'sms'::text) AND (email_message_id IS NULL)) OR ((channel = 'email'::text) AND (sms_batch_id IS NULL)))),
    CONSTRAINT after_sales_communications_check3 CHECK (((purpose <> 'more_information'::text) OR (information_id IS NOT NULL))),
    CONSTRAINT after_sales_communications_check4 CHECK (((purpose <> 'pickup_scheduled'::text) OR (shipment_job_id IS NOT NULL))),
    CONSTRAINT after_sales_communications_locale_check CHECK ((locale = ANY (ARRAY['en'::text, 'ar'::text]))),
    CONSTRAINT after_sales_communications_payload_check CHECK ((jsonb_typeof(payload) = 'object'::text)),
    CONSTRAINT after_sales_communications_reason_check CHECK ((reason = ANY (ARRAY['event_disabled'::text, 'channel_disabled'::text, 'provider_disabled'::text, 'provider_not_ready'::text, 'template_unavailable'::text, 'configuration_changed'::text, 'invalid_phone'::text, 'invalid_email'::text, 'invalid_template'::text, 'segment_limit'::text, 'expired'::text, 'stale_event'::text, 'superseded'::text, 'recipient_restricted'::text, 'storage_error'::text, 'preparation_limit'::text, 'approver_revoked'::text, 'invalid_source'::text]))),
    CONSTRAINT after_sales_communications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'preparing'::text, 'queued'::text, 'suppressed'::text])))
);


--
-- Name: after_sales_communication_reason(public.after_sales_communications); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_communication_reason(e public.after_sales_communications) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: after_sales_communication_take(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_communication_take(p_channel text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: after_sales_communication_template(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_communication_template(p_channel text, p_reference text, p_purpose text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
end $_$;


--
-- Name: after_sales_guard_policy(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_guard_policy() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new.policy_timezone is not null and not exists(select 1 from pg_catalog.pg_timezone_names where name=new.policy_timezone) then
    raise exception 'Invalid policy timezone.' using errcode='22023';
  end if;
  return new;
end $$;


--
-- Name: after_sales_guard_purchase(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_guard_purchase() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new.after_sales_policy_version_id is distinct from old.after_sales_policy_version_id then raise exception 'Purchased after-sales policy is immutable.'; end if;
  return new;
end $$;


--
-- Name: after_sales_immutable_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_immutable_version() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin raise exception 'Purchased after-sales policy versions are immutable.'; end $$;


--
-- Name: after_sales_item_eligibility(uuid, jsonb, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_item_eligibility(p_item_id uuid, p_facts jsonb DEFAULT '{}'::jsonb, p_now timestamp with time zone DEFAULT clock_timestamp()) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: after_sales_order_dates(uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_order_dates(p_order_id uuid, p_now timestamp with time zone DEFAULT clock_timestamp()) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: after_sales_order_entitlements(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_order_entitlements(p_order_id uuid, p_customer_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare results jsonb;
begin
  if not exists(select 1 from public.customer_orders o join public.customer_profiles c on c.id=o.user_id
    where o.id=p_order_id and o.user_id=p_customer_id and c.is_active) then raise exception 'Order unavailable.' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'after_sales',public.after_sales_item_eligibility(i.id)) order by i.created_at,i.id),'[]') into results
    from public.customer_order_items i where i.order_id=p_order_id;
  return results;
end $$;


--
-- Name: after_sales_period(text, text[], jsonb, integer, text, text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_period(p_basis text, p_fallback text[], p_dates jsonb, p_value integer, p_unit text, p_timezone text, p_now timestamp with time zone DEFAULT clock_timestamp()) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
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


--
-- Name: after_sales_resolve_policy(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_resolve_policy(p_product_id uuid DEFAULT NULL::uuid, p_category_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: after_sales_save_policy(uuid, text, text, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_save_policy(p_admin_id uuid, p_scope_key text, p_section text, p_revision integer, p_values jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
end $_$;


--
-- Name: after_sales_save_reason(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_save_reason(p_admin_id uuid, p_reason jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: after_sales_valid_list(text[], text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.after_sales_valid_list(v text[], allowed text[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select v is null or (v <@ allowed and array_position(v,null) is null
    and cardinality(v)=(select count(distinct x) from unnest(v) x));
$$;


--
-- Name: apply_store_analytics_internal_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_store_analytics_internal_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public.nps_responses
  set is_internal = true
  where user_id = new.user_id
    and is_internal = false;

  update public.store_analytics_sessions
  set is_internal = true
  where user_id = new.user_id
    and is_internal = false;

  update public.customer_profiles
  set is_internal = true
  where id = new.user_id
    and is_internal = false;

  insert into public.store_analytics_internal_carts (cart_id)
  select distinct events.cart_id
  from public.store_analytics_events as events
  join public.store_analytics_sessions as sessions
    on sessions.id = events.session_id
  where events.cart_id is not null
    and (
      events.user_id = new.user_id
      or sessions.user_id = new.user_id
    )
  on conflict (cart_id) do nothing;

  return new;
end;
$$;


--
-- Name: assert_built_in_erp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assert_built_in_erp() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  -- A shared row lock prevents a mode transition during a local transaction.
  perform 1 from public.site_settings where key = 'default' for share;
  if public.get_active_erp_mode() <> 'built_in' then
    raise exception using errcode = '42501', message = 'This operation is managed in Daftra.';
  end if;
end;
$$;


--
-- Name: capture_order_sms_events(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.capture_order_sms_events() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
end $_$;


--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    sku text,
    color_name text,
    color_hex text,
    price numeric(12,2) DEFAULT 0 NOT NULL,
    cost_price numeric(12,2) DEFAULT 0 NOT NULL,
    stock_quantity integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_variants_code_not_blank_check CHECK ((length(btrim(code)) > 0)),
    CONSTRAINT product_variants_color_hex_check CHECK (((color_hex IS NULL) OR (color_hex ~ '^#[0-9A-Fa-f]{6}$'::text))),
    CONSTRAINT product_variants_cost_price_check CHECK ((cost_price >= (0)::numeric)),
    CONSTRAINT product_variants_name_not_blank_check CHECK ((length(btrim(name)) > 0)),
    CONSTRAINT product_variants_price_check CHECK ((price >= (0)::numeric)),
    CONSTRAINT product_variants_stock_quantity_check CHECK ((stock_quantity >= 0))
);


--
-- Name: catalog_staff_product_variants(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalog_staff_product_variants() RETURNS SETOF public.product_variants
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND public.is_active_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Staff catalog access required.' USING ERRCODE='42501';
  END IF;
  -- Existing product_variants_admin_read permits active staff, including inactive variants.
  RETURN QUERY SELECT v.* FROM public.product_variants v;
END $$;


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    price numeric DEFAULT 0 NOT NULL,
    old_price numeric,
    image_url text,
    is_top_seller boolean DEFAULT false,
    is_featured boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    category_id uuid,
    slug text NOT NULL,
    brand_id uuid,
    default_supplier_id uuid,
    primary_warehouse_id uuid,
    long_description text,
    color_name text,
    color_hex text,
    stock_quantity integer DEFAULT 0 NOT NULL,
    cost_price numeric DEFAULT 0 NOT NULL,
    is_published boolean DEFAULT true NOT NULL,
    sku text,
    popularity_score integer DEFAULT 0 NOT NULL,
    average_rating numeric(3,2) DEFAULT 0 NOT NULL,
    is_serialized boolean DEFAULT true NOT NULL,
    selling_mode text DEFAULT 'normal'::text NOT NULL,
    expected_availability_date date,
    availability_message text,
    preorder_active boolean DEFAULT true NOT NULL,
    preorder_starts_at timestamp with time zone,
    preorder_ends_at timestamp with time zone,
    preorder_payment_mode text DEFAULT 'full'::text NOT NULL,
    preorder_deposit_percent numeric(5,2),
    preorder_total_limit integer,
    preorder_customer_limit integer,
    seo_title text,
    seo_description text,
    seo_image_url text,
    warranty_status text DEFAULT 'unknown'::text NOT NULL,
    warranty_duration_value integer,
    warranty_duration_unit text,
    CONSTRAINT products_average_rating_check CHECK (((average_rating >= (0)::numeric) AND (average_rating <= (5)::numeric))),
    CONSTRAINT products_cost_price_check CHECK ((cost_price >= (0)::numeric)),
    CONSTRAINT products_old_price_check CHECK (((old_price IS NULL) OR (old_price >= (0)::numeric))),
    CONSTRAINT products_popularity_score_check CHECK ((popularity_score >= 0)),
    CONSTRAINT products_preorder_dates_check CHECK (((preorder_ends_at IS NULL) OR (preorder_starts_at IS NULL) OR (preorder_ends_at > preorder_starts_at))),
    CONSTRAINT products_preorder_limits_check CHECK ((((preorder_total_limit IS NULL) OR (preorder_total_limit > 0)) AND ((preorder_customer_limit IS NULL) OR (preorder_customer_limit > 0)))),
    CONSTRAINT products_preorder_payment_check CHECK (((preorder_payment_mode = ANY (ARRAY['full'::text, 'deposit'::text])) AND ((preorder_payment_mode <> 'deposit'::text) OR ((preorder_deposit_percent IS NOT NULL) AND (preorder_deposit_percent > (0)::numeric) AND (preorder_deposit_percent < (100)::numeric))))),
    CONSTRAINT products_preorder_price_check CHECK (((selling_mode <> 'preorder'::text) OR (price > (0)::numeric))),
    CONSTRAINT products_price_check CHECK ((price >= (0)::numeric)),
    CONSTRAINT products_selling_mode_check CHECK ((selling_mode = ANY (ARRAY['normal'::text, 'coming_soon'::text, 'preorder'::text]))),
    CONSTRAINT products_stock_quantity_check CHECK ((stock_quantity >= 0)),
    CONSTRAINT products_warranty_terms_check CHECK ((((warranty_status = ANY (ARRAY['unknown'::text, 'none'::text])) AND (warranty_duration_value IS NULL) AND (warranty_duration_unit IS NULL)) OR ((warranty_status = 'included'::text) AND (warranty_duration_value IS NOT NULL) AND (warranty_duration_unit IS NOT NULL) AND (warranty_duration_value >= 1) AND (((warranty_duration_unit = 'months'::text) AND (warranty_duration_value <= 120)) OR ((warranty_duration_unit = 'years'::text) AND (warranty_duration_value <= 10))))))
);


--
-- Name: catalog_staff_products(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalog_staff_products() RETURNS SETOF public.products
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND public.is_active_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Staff catalog access required.' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT p.* FROM public.products p
    WHERE auth.role()='service_role' OR p.is_published
      OR public.has_admin_permission('products.view');
END $$;


--
-- Name: chat_availability_details(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_availability_details(p_at timestamp with time zone) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_settings public.chat_settings%rowtype;
  v_local timestamp;
  v_day text;
  v_clock time;
  v_slot jsonb;
  v_in_hours boolean := false;
  v_agent_count integer := 0;
  v_available boolean := false;
  v_reason text := 'disabled';
begin
  select * into v_settings from public.chat_settings where singleton;
  if not found then
    return pg_catalog.jsonb_build_object('available', false, 'reason', 'disabled',
      'withinHours', false, 'eligibleAgentCount', 0);
  end if;
  v_local := p_at at time zone v_settings.business_timezone;
  v_day := extract(dow from v_local)::integer::text;
  v_clock := v_local::time;
  for v_slot in select value from pg_catalog.jsonb_array_elements(v_settings.weekly_hours -> v_day) loop
    if v_clock >= (v_slot ->> 0)::time and v_clock < (v_slot ->> 1)::time then
      v_in_hours := true;
      exit;
    end if;
  end loop;
  select count(*)::integer into v_agent_count
  from public.chat_agent_availability a join public.admin_users u on u.id = a.admin_id
  where a.declared_state = 'online' and a.lease_expires_at > p_at
    and u.is_active = true and (u.role = 'owner' or (
      coalesce((u.permissions ->> 'support.view')::boolean, false)
      and coalesce((u.permissions ->> 'support.reply')::boolean, false)));

  if not v_settings.is_enabled then v_reason := 'disabled';
  elsif v_settings.availability_override = 'offline' then v_reason := 'forced_offline';
  elsif v_agent_count = 0 then v_reason := 'no_agent';
  elsif v_settings.availability_override = 'online' then
    v_available := true; v_reason := 'forced_online';
  elsif v_in_hours then v_available := true; v_reason := 'within_hours';
  else v_reason := 'outside_hours';
  end if;
  return pg_catalog.jsonb_build_object(
    'available', v_available, 'reason', v_reason, 'withinHours', v_in_hours,
    'eligibleAgentCount', v_agent_count, 'timezone', v_settings.business_timezone,
    'localTime', pg_catalog.to_char(v_local, 'YYYY-MM-DD HH24:MI:SS'));
end;
$$;


--
-- Name: chat_can_receive_topic(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_can_receive_topic(p_topic text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  v_actor uuid := auth.uid();
  v_is_anonymous boolean := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
  v_staff boolean;
  v_id_text text;
  v_id uuid;
begin
  if v_actor is null or p_topic is null then return false; end if;
  select exists (
    select 1 from public.admin_users a where a.id = v_actor and a.is_active = true
      and (a.role = 'owner' or coalesce((a.permissions ->> 'support.view')::boolean, false))
  ) into v_staff;
  if p_topic = 'chat:inbox' then return v_staff; end if;
  if p_topic not like 'chat:public:%' and p_topic not like 'chat:staff:%' then return false; end if;
  v_id_text := pg_catalog.split_part(p_topic, ':', 3);
  if v_id_text !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    or p_topic not in ('chat:public:' || v_id_text, 'chat:staff:' || v_id_text) then
    return false;
  end if;
  v_id := v_id_text::uuid;
  if p_topic = 'chat:staff:' || v_id_text then
    return v_staff and exists (select 1 from public.chat_conversations where id = v_id);
  end if;
  if v_staff then
    return exists (select 1 from public.chat_conversations where id = v_id);
  end if;
  if v_is_anonymous then
    return exists (
      select 1 from public.chat_conversations c
      where c.id = v_id and c.guest_auth_user_id = v_actor and c.customer_id is null
    );
  end if;
  return exists (
    select 1 from public.chat_conversations c
    join public.customer_profiles p on p.id = c.customer_id and p.is_active = true
    where c.id = v_id and c.customer_id = v_actor
  );
end;
$_$;


--
-- Name: chat_complete_attachment(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_complete_attachment(p_attachment_id uuid, p_actor_id uuid, p_content_sha256 text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_attachment public.chat_attachments%rowtype;
  v_chat public.chat_conversations%rowtype;
  v_message public.chat_messages%rowtype;
  v_id uuid;
begin
  select * into v_attachment from public.chat_attachments
    where id = p_attachment_id for update;
  if not found or v_attachment.uploaded_by is distinct from p_actor_id
    or v_attachment.content_sha256 is distinct from p_content_sha256 then
    raise exception 'Chat attachment access denied.' using errcode = '42501';
  end if;
  if v_attachment.is_ready then return v_attachment.id; end if;

  select * into v_chat from public.chat_conversations
    where id = v_attachment.conversation_id for update;
  if not found then
    raise exception 'CHAT_CLOSED' using errcode = 'P0001';
  end if;
  select * into v_message from public.chat_messages
    where id = v_attachment.message_id
      and conversation_id = v_attachment.conversation_id;
  if not found or v_chat.status = 'closed'
    or v_message.sender_id is distinct from p_actor_id then
    raise exception 'CHAT_CLOSED' using errcode = 'P0001';
  end if;

  if v_message.sender_kind = 'customer' then
    if v_chat.customer_id is distinct from p_actor_id or v_message.is_internal
      or not exists (select 1 from public.customer_profiles p
        where p.id = p_actor_id and p.is_active) then
      raise exception 'Chat attachment access denied.' using errcode = '42501';
    end if;
  elsif v_message.sender_kind = 'guest' then
    if v_chat.guest_auth_user_id is distinct from p_actor_id
      or v_chat.customer_id is not null or v_message.is_internal
      or not exists (select 1 from auth.users u
        where u.id = p_actor_id and u.is_anonymous) then
      raise exception 'Chat attachment access denied.' using errcode = '42501';
    end if;
  elsif v_message.sender_kind = 'staff' then
    if v_chat.status <> 'active' or v_chat.assigned_admin_id is distinct from p_actor_id
      or not exists (select 1 from public.admin_users a where a.id = p_actor_id
        and a.is_active and (a.role = 'owner' or (
          coalesce((a.permissions ->> 'support.view')::boolean,false)
          and coalesce((a.permissions ->> 'support.reply')::boolean,false)))) then
      raise exception 'Chat attachment access denied.' using errcode = '42501';
    end if;
  else
    raise exception 'Chat attachment access denied.' using errcode = '42501';
  end if;

  update public.chat_attachments set is_ready = true
    where id = v_attachment.id returning id into v_id;
  return v_id;
end;
$$;


--
-- Name: chat_consume_limit(text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_consume_limit(p_scope text, p_subject_hash text, p_window_seconds integer, p_max integer) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_start timestamptz;
  v_expires timestamptz;
  v_attempts integer;
  v_retry integer;
begin
  if p_scope not in (
      'message','conversation','duplicate','attachment','typing',
      'network_message','network_message_hour','network_conversation',
      'network_conversation_day','network_duplicate','network_attachment',
      'network_attachment_hour','network_typing','network_typing_hour'
    ) or p_subject_hash !~ '^[0-9a-f]{64}$'
    or p_window_seconds not between 1 and 86400 or p_max not between 1 and 1000 then
    raise exception 'Invalid chat limit.' using errcode = '22023';
  end if;
  delete from public.chat_rate_limits where ctid in (
    select ctid from public.chat_rate_limits
    where expires_at < v_now limit 20
  );
  v_start := pg_catalog.to_timestamp(pg_catalog.floor(
    extract(epoch from v_now) / p_window_seconds) * p_window_seconds);
  v_expires := v_start + pg_catalog.make_interval(secs => p_window_seconds);
  insert into public.chat_rate_limits(scope,subject_hash,window_started_at,attempts,expires_at)
  values (p_scope,p_subject_hash,v_start,1,v_expires)
  on conflict (scope,subject_hash,window_started_at) do update
    set attempts = public.chat_rate_limits.attempts + 1
  returning attempts into v_attempts;
  if v_attempts > p_max then
    v_retry := greatest(1,
      pg_catalog.ceil(extract(epoch from v_expires - v_now))::integer);
    raise exception 'CHAT_RATE_LIMIT' using errcode = 'P0001', hint = v_retry::text;
  end if;
end;
$_$;


--
-- Name: chat_consume_network_limits(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_consume_network_limits(p_network_hash text, p_action text, p_content_hash text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
begin
  if p_network_hash !~ '^[0-9a-f]{64}$'
    or p_action not in ('conversation','conversation_message','message','attachment','typing')
    or (p_content_hash is not null and p_content_hash !~ '^[0-9a-f]{64}$') then
    raise exception 'Invalid chat network limit.' using errcode = '22023';
  end if;

  if p_action in ('conversation','conversation_message') then
    perform public.chat_consume_limit('network_conversation',p_network_hash,3600,20);
    perform public.chat_consume_limit('network_conversation_day',p_network_hash,86400,60);
  end if;
  if p_action in ('conversation_message','message') then
    perform public.chat_consume_limit('network_message',p_network_hash,60,60);
    perform public.chat_consume_limit('network_message_hour',p_network_hash,3600,500);
    if p_content_hash is not null then
      perform public.chat_consume_limit('network_duplicate',p_content_hash,600,5);
    end if;
  elsif p_action = 'attachment' then
    perform public.chat_consume_limit('network_attachment',p_network_hash,60,30);
    perform public.chat_consume_limit('network_attachment_hour',p_network_hash,3600,120);
  elsif p_action = 'typing' then
    perform public.chat_consume_limit('network_typing',p_network_hash,60,30);
    perform public.chat_consume_limit('network_typing_hour',p_network_hash,3600,300);
  end if;
end;
$_$;


--
-- Name: chat_consume_network_limits_unless_retry(text, text, text, uuid, text, uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_consume_network_limits_unless_retry(p_network_hash text, p_action text, p_content_hash text, p_actor_id uuid, p_actor_kind text, p_conversation_id uuid, p_creation_key uuid, p_message_key uuid, p_body text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  v_conversation_id uuid;
  v_body text := pg_catalog.btrim(p_body);
begin
  if p_network_hash is null or p_network_hash !~ '^[0-9a-f]{64}$'
    or (p_content_hash is not null and p_content_hash !~ '^[0-9a-f]{64}$')
    or p_action is null or p_action not in ('message','conversation_message')
    or p_actor_id is null or p_actor_kind is null
    or p_actor_kind not in ('customer','guest') or p_message_key is null
    or p_body is null or pg_catalog.char_length(v_body) not between 1 and 10000
    or (p_action = 'message' and (p_conversation_id is null or p_creation_key is not null))
    or (p_action = 'conversation_message' and (p_creation_key is null or p_conversation_id is not null)) then
    raise exception 'Invalid chat retry limit.' using errcode = '22023';
  end if;

  if p_action = 'message' then
    select c.id into v_conversation_id from public.chat_conversations c
    where c.id = p_conversation_id and (
      (p_actor_kind = 'customer' and c.customer_id = p_actor_id)
      or (p_actor_kind = 'guest' and c.guest_auth_user_id = p_actor_id
        and c.customer_id is null));
  else
    select c.id into v_conversation_id from public.chat_conversations c
    where c.creation_key = p_creation_key and (
      (p_actor_kind = 'customer' and c.customer_id = p_actor_id)
      or (p_actor_kind = 'guest' and c.guest_auth_user_id = p_actor_id
        and c.customer_id is null));
  end if;

  if v_conversation_id is not null and exists (
    select 1 from public.chat_messages m
    where m.conversation_id = v_conversation_id and m.sender_id = p_actor_id
      and m.sender_kind = p_actor_kind and m.idempotency_key = p_message_key
      and m.body = v_body and not m.is_internal
  ) then
    return false;
  end if;

  perform public.chat_consume_network_limits(
    p_network_hash,p_action,p_content_hash);
  return true;
end;
$_$;


--
-- Name: chat_create_or_resume(uuid, boolean, text, text, text, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_create_or_resume(p_actor_id uuid, p_is_guest boolean, p_name text, p_email text, p_mobile text, p_order_id uuid, p_creation_key uuid, p_subject_hash text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_id uuid;
  v_rule text;
  v_name text := nullif(pg_catalog.btrim(p_name), '');
  v_email text := nullif(pg_catalog.lower(pg_catalog.btrim(p_email)), '');
  v_mobile text := nullif(pg_catalog.btrim(p_mobile), '');
begin
  if p_actor_id is null or p_creation_key is null or p_is_guest is null then
    raise exception 'Invalid chat identity.' using errcode = '22023';
  end if;
  if p_is_guest then
    if not exists (select 1 from auth.users where id = p_actor_id and is_anonymous = true) then
      raise exception 'Guest identity is unavailable.' using errcode = '42501';
    end if;
    if p_order_id is not null then
      raise exception 'Guest orders require verified account ownership.' using errcode = '42501';
    end if;
  elsif not exists (select 1 from public.customer_profiles p
    join auth.users u on u.id = p.id and u.is_anonymous = false
    where p.id = p_actor_id and p.is_active = true) then
    raise exception 'Customer account is unavailable.' using errcode = '42501';
  end if;
  if p_order_id is not null and not exists (select 1 from public.customer_orders
    where id = p_order_id and user_id = p_actor_id) then
    raise exception 'Chat order does not belong to the customer.' using errcode = '22023';
  end if;
  select id into v_id from public.chat_conversations
    where (p_is_guest and guest_auth_user_id = p_actor_id
      or not p_is_guest and customer_id = p_actor_id)
      and status <> 'closed' limit 1;
  if v_id is not null then return v_id; end if;
  select id into v_id from public.chat_conversations
    where (p_is_guest and guest_auth_user_id = p_actor_id
      or not p_is_guest and customer_id = p_actor_id)
      and creation_key = p_creation_key limit 1;
  if v_id is not null then return v_id; end if;
  select guest_contact_rule into v_rule from public.chat_settings
    where singleton and is_enabled = true;
  if v_rule is null then
    raise exception 'CHAT_DISABLED' using errcode = 'P0001';
  end if;
  if v_name is null or pg_catalog.char_length(v_name) > 160
    or (v_rule in ('email', 'both') and v_email is null)
    or (v_rule in ('mobile', 'both') and v_mobile is null)
    or (v_rule = 'either' and v_email is null and v_mobile is null) then
    raise exception 'Chat contact is incomplete.' using errcode = '22023';
  end if;
  perform public.chat_consume_limit('conversation', p_subject_hash, 3600, 5);
  begin
    insert into public.chat_conversations(customer_id, guest_auth_user_id,
      contact_name, contact_email, contact_mobile, order_id, creation_key)
    values (case when p_is_guest then null else p_actor_id end,
      case when p_is_guest then p_actor_id else null end,
      v_name, v_email, v_mobile, p_order_id, p_creation_key)
    returning id into v_id;
  exception when unique_violation then
    select id into v_id from public.chat_conversations
      where (p_is_guest and guest_auth_user_id = p_actor_id
        or not p_is_guest and customer_id = p_actor_id)
        and (status <> 'closed' or creation_key = p_creation_key)
      order by (status <> 'closed') desc limit 1;
    if v_id is null then raise; end if;
    return v_id;
  end;
  insert into public.chat_events(conversation_id, actor_id, actor_kind, event_type)
  values (v_id, p_actor_id, case when p_is_guest then 'guest' else 'customer' end, 'created');
  return v_id;
end;
$$;


--
-- Name: chat_create_ticket(uuid, uuid, text, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_create_ticket(p_conversation_id uuid, p_staff_id uuid, p_subject text, p_expected_revision bigint) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_chat public.chat_conversations%rowtype;
  v_ticket_id uuid;
  v_ticket_reference bigint;
  v_manage boolean;
  v_reply boolean;
begin
  select a.role = 'owner' or coalesce((a.permissions ->> 'support.manage')::boolean, false),
    a.role = 'owner' or (coalesce((a.permissions ->> 'support.view')::boolean, false)
      and coalesce((a.permissions ->> 'support.reply')::boolean, false))
    into v_manage, v_reply from public.admin_users a
    where a.id = p_staff_id and a.is_active = true;
  if not coalesce(v_reply, false) then
    raise exception 'Support reply access is required.' using errcode = '42501';
  end if;
  select * into v_chat from public.chat_conversations
    where id = p_conversation_id for update;
  if not found then raise exception 'Chat not found.' using errcode = 'P0002'; end if;
  if not coalesce(v_manage, false)
    and v_chat.assigned_admin_id is distinct from p_staff_id then
    raise exception 'CHAT_TICKET_DENIED' using errcode = 'P0001';
  end if;
  if v_chat.ticket_id is not null then return v_chat.ticket_id; end if;
  if not exists (select 1 from public.chat_settings
    where singleton and ticket_conversion_enabled) then
    raise exception 'CHAT_TICKET_DISABLED' using errcode = 'P0001';
  end if;
  if p_expected_revision is null or v_chat.revision <> p_expected_revision then
    raise exception 'CHAT_STALE' using errcode = 'P0001';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_subject, ''))) not between 1 and 160 then
    raise exception 'Ticket subject is invalid.' using errcode = '22023';
  end if;
  if v_chat.contact_email is null and v_chat.contact_mobile is null then
    raise exception 'Ticket contact is unavailable.' using errcode = '22023';
  end if;
  insert into public.support_tickets(customer_id, customer_email, customer_mobile,
    customer_name, order_id, subject, assigned_admin_id, idempotency_key)
  values(v_chat.customer_id, v_chat.contact_email, v_chat.contact_mobile,
    v_chat.contact_name, v_chat.order_id, pg_catalog.btrim(p_subject),
    coalesce(v_chat.assigned_admin_id, p_staff_id), v_chat.id)
  returning id, reference_number into v_ticket_id, v_ticket_reference;
  insert into public.support_ticket_events(ticket_id, actor_id, actor_type,
    event_type, new_value)
  values
    (v_ticket_id, p_staff_id, 'staff', 'created', 'open'),
    (v_ticket_id, p_staff_id, 'staff', 'source_chat', v_chat.id::text);
  update public.chat_conversations set ticket_id = v_ticket_id where id = v_chat.id;
  insert into public.chat_events(conversation_id, actor_id, actor_kind,
    event_type, old_value, new_value)
  values(v_chat.id, p_staff_id, 'staff', 'ticket_created', null,
    pg_catalog.jsonb_build_object('ticket_id', v_ticket_id,
      'ticket_reference', v_ticket_reference));
  return v_ticket_id;
end;
$$;


--
-- Name: chat_event_name(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_event_name(p_admin_id uuid) RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select coalesce(nullif(pg_catalog.btrim(a.full_name), ''), a.email, a.id::text)
  from public.admin_users a where a.id = p_admin_id;
$$;


--
-- Name: chat_guard_conversation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_guard_conversation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if tg_op = 'INSERT' and new.customer_id is null and new.guest_auth_user_id is null then
    raise exception 'Chat identity is required.' using errcode = '22023';
  end if;
  if new.customer_id is not null and not exists (
    select 1 from auth.users u where u.id = new.customer_id and u.is_anonymous = false
  ) then
    raise exception 'Customer identity is unavailable.' using errcode = '22023';
  end if;
  if new.guest_auth_user_id is not null and not exists (
    select 1 from auth.users u where u.id = new.guest_auth_user_id and u.is_anonymous = true
  ) then
    raise exception 'Guest identity is unavailable.' using errcode = '22023';
  end if;
  if new.order_id is not null then
    if tg_op = 'INSERT' then
      if not exists (select 1 from public.customer_orders o
        where o.id = new.order_id and o.user_id = new.customer_id) then
        raise exception 'Chat order does not belong to the customer.' using errcode = '22023';
      end if;
    elsif new.order_id is distinct from old.order_id
      or (new.customer_id is distinct from old.customer_id and new.customer_id is not null) then
      if not exists (select 1 from public.customer_orders o
        where o.id = new.order_id and o.user_id = new.customer_id) then
        raise exception 'Chat order does not belong to the customer.' using errcode = '22023';
      end if;
    end if;
  end if;
  if new.ticket_id is not null then
    if tg_op = 'INSERT' then
      if not exists (select 1 from public.support_tickets t where t.id = new.ticket_id
        and t.customer_id is not distinct from new.customer_id) then
        raise exception 'Chat ticket does not belong to the customer.' using errcode = '22023';
      end if;
    elsif new.ticket_id is distinct from old.ticket_id
      or (new.customer_id is distinct from old.customer_id and new.customer_id is not null
        and old.guest_auth_user_id is null) then
      if not exists (select 1 from public.support_tickets t where t.id = new.ticket_id
        and t.customer_id is not distinct from new.customer_id) then
        raise exception 'Chat ticket does not belong to the customer.' using errcode = '22023';
      end if;
    end if;
  end if;
  if new.assigned_admin_id is not null and not exists (
    select 1 from public.admin_users a where a.id = new.assigned_admin_id and a.is_active = true
      and (a.role = 'owner' or (
        coalesce((a.permissions ->> 'support.view')::boolean, false)
        and coalesce((a.permissions ->> 'support.reply')::boolean, false)))
  ) then
    raise exception 'Chat assignee cannot reply.' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' then
    if old.assigned_admin_id is not null and new.assigned_admin_id is null and new.status = 'active' then
      new.status := 'waiting';
    end if;
    new.revision := old.revision + 1;
    new.updated_at := now();
  end if;
  return new;
end;
$$;


--
-- Name: chat_identify_guest(uuid, uuid, uuid, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_identify_guest(p_conversation_id uuid, p_guest_id uuid, p_customer_id uuid, p_expected_revision bigint) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_chat public.chat_conversations%rowtype;
begin
  select * into v_chat from public.chat_conversations where id = p_conversation_id for update;
  if not found then raise exception 'Chat not found.' using errcode = 'P0002'; end if;
  if p_expected_revision is null or v_chat.revision <> p_expected_revision then
    raise exception 'CHAT_STALE' using errcode = 'P0001';
  end if;
  if v_chat.guest_auth_user_id is distinct from p_guest_id or v_chat.customer_id is not null
    or v_chat.order_id is not null or v_chat.ticket_id is not null
    or not exists (select 1 from auth.users u where u.id = p_guest_id and u.is_anonymous = true)
    or not exists (select 1 from auth.users u join public.customer_profiles p on p.id = u.id
      where u.id = p_customer_id and u.is_anonymous = false and p.is_active = true) then
    raise exception 'CHAT_IDENTIFY_DENIED' using errcode = 'P0001';
  end if;
  if v_chat.status <> 'closed' and exists (
    select 1 from public.chat_conversations c where c.customer_id = p_customer_id
      and c.status <> 'closed'
  ) then raise exception 'CHAT_ACCOUNT_BUSY' using errcode = 'P0001'; end if;
  update public.chat_conversations set customer_id = p_customer_id,
    guest_auth_user_id = null where id = v_chat.id;
  insert into public.chat_events(conversation_id,actor_id,actor_kind,event_type,old_value,new_value)
  values(v_chat.id,p_customer_id,'customer','identified',
    pg_catalog.jsonb_build_object('guest_auth_user_id',p_guest_id),
    pg_catalog.jsonb_build_object('customer_id',p_customer_id));
  return v_chat.id;
exception when unique_violation then
  raise exception 'CHAT_ACCOUNT_BUSY' using errcode = 'P0001';
end;
$$;


--
-- Name: chat_live_available(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_live_available() RETURNS boolean
    LANGUAGE sql
    SET search_path TO ''
    AS $$
  select coalesce((public.chat_availability_details(pg_catalog.clock_timestamp())
    ->> 'available')::boolean, false);
$$;


--
-- Name: chat_mark_read(uuid, uuid, text, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_mark_read(p_conversation_id uuid, p_actor_id uuid, p_actor_kind text, p_sequence bigint) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_conversation public.chat_conversations%rowtype;
  v_read bigint;
begin
  if p_sequence is null or p_sequence < 1 or p_actor_id is null
    or p_actor_kind not in ('customer','guest','staff') then
    raise exception 'Invalid read marker.' using errcode = '22023';
  end if;
  select * into v_conversation from public.chat_conversations
    where id = p_conversation_id;
  if not found then raise exception 'Chat not found.' using errcode = 'P0002'; end if;
  if p_actor_kind = 'customer' then
    if v_conversation.customer_id is distinct from p_actor_id or not exists (
      select 1 from public.customer_profiles p where p.id = p_actor_id and p.is_active) then
      raise exception 'Chat access denied.' using errcode = '42501';
    end if;
  elsif p_actor_kind = 'guest' then
    if v_conversation.guest_auth_user_id is distinct from p_actor_id or not exists (
      select 1 from auth.users u where u.id = p_actor_id and u.is_anonymous) then
      raise exception 'Chat access denied.' using errcode = '42501';
    end if;
  elsif not exists (select 1 from public.admin_users a where a.id = p_actor_id
    and a.is_active and (a.role = 'owner' or
      coalesce((a.permissions ->> 'support.view')::boolean,false))) then
    raise exception 'Chat access denied.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.chat_messages m
    where m.conversation_id = p_conversation_id and m.sequence_number = p_sequence
      and ((p_actor_kind = 'staff' and m.sender_kind in ('customer','guest'))
        or (p_actor_kind in ('customer','guest') and m.sender_kind = 'staff'
          and not m.is_internal))) then
    raise exception 'Read marker must name a visible incoming message.' using errcode = '22023';
  end if;
  insert into public.chat_read_state(conversation_id,actor_id,actor_kind,last_read_sequence)
  values (p_conversation_id,p_actor_id,p_actor_kind,p_sequence)
  on conflict (conversation_id,actor_id) do update
    set last_read_sequence = greatest(public.chat_read_state.last_read_sequence,
      excluded.last_read_sequence), updated_at = now()
    where public.chat_read_state.actor_kind = excluded.actor_kind
  returning last_read_sequence into v_read;
  if v_read is null then raise exception 'Chat access denied.' using errcode = '42501'; end if;
  return v_read;
end;
$$;


--
-- Name: chat_preserve_ticket_order(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_preserve_ticket_order() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if old.ticket_id is not null and new.order_id is distinct from old.order_id then
    raise exception 'CHAT_TICKET_ORDER_LOCKED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;


--
-- Name: chat_request_callback(uuid, uuid, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_request_callback(p_conversation_id uuid, p_actor_id uuid, p_is_guest boolean, p_mobile text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  v_chat public.chat_conversations%rowtype;
  v_mobile text := pg_catalog.btrim(coalesce(p_mobile,''));
  v_actor_kind text := case when p_is_guest then 'guest' else 'customer' end;
begin
  if v_mobile !~ '^\+?[0-9 ()-]{7,30}$' then
    raise exception 'Callback mobile is invalid.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.chat_settings
    where singleton and request_call_enabled) then
    raise exception 'CHAT_CALLBACK_DISABLED' using errcode = 'P0001';
  end if;
  select * into v_chat from public.chat_conversations
    where id = p_conversation_id for update;
  if not found then raise exception 'Chat not found.' using errcode = 'P0002'; end if;
  if (p_is_guest and (v_chat.guest_auth_user_id is distinct from p_actor_id
      or v_chat.customer_id is not null))
    or (not p_is_guest and v_chat.customer_id is distinct from p_actor_id) then
    raise exception 'Callback request access denied.' using errcode = '42501';
  end if;
  if v_chat.callback_status is not null then
    return pg_catalog.jsonb_build_object('status',v_chat.callback_status,
      'mobile',v_chat.callback_mobile,'requestedAt',v_chat.callback_requested_at,
      'updatedAt',v_chat.callback_updated_at);
  end if;
  update public.chat_conversations set callback_status = 'pending',
    callback_mobile = v_mobile, callback_requested_at = pg_catalog.clock_timestamp(),
    callback_updated_at = pg_catalog.clock_timestamp()
  where id = v_chat.id;
  insert into public.chat_events(conversation_id,actor_id,actor_kind,
    event_type,new_value)
  values(v_chat.id,p_actor_id,v_actor_kind,'callback_requested',
    pg_catalog.jsonb_build_object('status','pending','mobile',v_mobile));
  return pg_catalog.jsonb_build_object('status','pending','mobile',v_mobile,
    'requestedAt',pg_catalog.clock_timestamp(),'updatedAt',pg_catalog.clock_timestamp());
end;
$_$;


--
-- Name: chat_reserve_attachment(uuid, uuid, uuid, uuid, text, text, text, text, integer, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_reserve_attachment(p_attachment_id uuid, p_conversation_id uuid, p_message_id uuid, p_actor_id uuid, p_actor_kind text, p_original_name text, p_storage_path text, p_mime_type text, p_size_bytes integer, p_content_sha256 text, p_subject_hash text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  v_chat public.chat_conversations%rowtype;
  v_message public.chat_messages%rowtype;
  v_existing public.chat_attachments%rowtype;
  v_enabled boolean;
  v_mimes text[];
  v_max_bytes integer;
  v_max_count integer;
  v_extension text;
begin
  if p_attachment_id is null or p_actor_id is null
    or p_actor_kind not in ('customer','guest','staff')
    or p_content_sha256 is null or p_content_sha256 !~ '^[0-9a-f]{64}$'
    or p_original_name is null or pg_catalog.char_length(pg_catalog.btrim(p_original_name)) not between 1 and 180 then
    raise exception 'Attachment details are invalid.' using errcode = '22023';
  end if;
  select * into v_chat from public.chat_conversations
    where id = p_conversation_id for update;
  if not found then raise exception 'Chat not found.' using errcode = 'P0002'; end if;
  select * into v_message from public.chat_messages
    where id = p_message_id and conversation_id = p_conversation_id for update;
  if not found then raise exception 'Chat message not found.' using errcode = 'P0002'; end if;
  if v_chat.status = 'closed' then
    raise exception 'CHAT_CLOSED' using errcode = 'P0001';
  end if;
  if p_actor_kind = 'customer' then
    if v_chat.customer_id is distinct from p_actor_id
      or v_message.sender_id is distinct from p_actor_id
      or v_message.sender_kind <> 'customer' or v_message.is_internal
      or not exists (select 1 from public.customer_profiles p
        where p.id = p_actor_id and p.is_active) then
      raise exception 'Chat attachment access denied.' using errcode = '42501';
    end if;
  elsif p_actor_kind = 'guest' then
    if v_chat.guest_auth_user_id is distinct from p_actor_id or v_chat.customer_id is not null
      or v_message.sender_id is distinct from p_actor_id or v_message.sender_kind <> 'guest'
      or v_message.is_internal or not exists (select 1 from auth.users u
        where u.id = p_actor_id and u.is_anonymous) then
      raise exception 'Chat attachment access denied.' using errcode = '42501';
    end if;
  elsif v_chat.status <> 'active' or v_chat.assigned_admin_id is distinct from p_actor_id
    or v_message.sender_id is distinct from p_actor_id or v_message.sender_kind <> 'staff'
    or not exists (select 1 from public.admin_users a where a.id = p_actor_id
      and a.is_active and (a.role = 'owner' or (
        coalesce((a.permissions ->> 'support.view')::boolean,false)
        and coalesce((a.permissions ->> 'support.reply')::boolean,false)))) then
    raise exception 'Chat attachment access denied.' using errcode = '42501';
  end if;

  select attachments_enabled,allowed_attachment_mimes,max_attachment_bytes,
    max_attachments_per_message into v_enabled,v_mimes,v_max_bytes,v_max_count
    from public.chat_settings where singleton;
  if not coalesce(v_enabled,false) then
    raise exception 'CHAT_ATTACHMENTS_DISABLED' using errcode = 'P0001';
  end if;
  if p_mime_type <> all(v_mimes) or p_size_bytes not between 1 and v_max_bytes then
    raise exception 'Attachment type or size is invalid.' using errcode = '22023';
  end if;
  v_extension := case p_mime_type when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png' when 'image/webp' then 'webp'
    when 'application/pdf' then 'pdf' end;
  if v_extension is null or p_storage_path is distinct from
    p_conversation_id::text || '/' || p_message_id::text || '/'
      || p_attachment_id::text || '.' || v_extension then
    raise exception 'Attachment path is invalid.' using errcode = '22023';
  end if;

  select * into v_existing from public.chat_attachments where id = p_attachment_id;
  if found then
    if v_existing.conversation_id = p_conversation_id
      and v_existing.message_id = p_message_id
      and v_existing.uploaded_by = p_actor_id
      and v_existing.original_name = pg_catalog.btrim(p_original_name)
      and v_existing.storage_path = p_storage_path
      and v_existing.mime_type = p_mime_type
      and v_existing.size_bytes = p_size_bytes
      and v_existing.content_sha256 = p_content_sha256 then
      return pg_catalog.jsonb_build_object('id',v_existing.id,'created',false,
        'ready',v_existing.is_ready);
    end if;
    raise exception 'CHAT_ATTACHMENT_KEY_CONFLICT' using errcode = 'P0001';
  end if;
  if (select count(*) from public.chat_attachments where message_id = p_message_id) >= v_max_count then
    raise exception 'CHAT_ATTACHMENT_LIMIT' using errcode = 'P0001';
  end if;
  perform public.chat_consume_limit('attachment',p_subject_hash,60,12);
  insert into public.chat_attachments(id,conversation_id,message_id,uploaded_by,
    original_name,storage_path,mime_type,size_bytes,content_sha256)
  values(p_attachment_id,p_conversation_id,p_message_id,p_actor_id,
    pg_catalog.btrim(p_original_name),p_storage_path,p_mime_type,p_size_bytes,p_content_sha256);
  return pg_catalog.jsonb_build_object('id',p_attachment_id,'created',true,'ready',false);
end;
$_$;


--
-- Name: chat_reset_manifest(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_reset_manifest() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new.scope = 'full' then
    new.manifest := pg_catalog.jsonb_set(new.manifest, '{chat}',
      coalesce((select pg_catalog.jsonb_agg(name)
        from storage.objects where bucket_id = 'chat-attachments'), '[]'::jsonb));
  end if;
  return new;
end;
$$;


--
-- Name: chat_send_message(uuid, uuid, text, text, text, uuid, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_send_message(p_conversation_id uuid, p_sender_id uuid, p_sender_kind text, p_sender_name text, p_body text, p_key uuid, p_subject_hash text, p_internal boolean DEFAULT false) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_conversation public.chat_conversations%rowtype;
  v_existing public.chat_messages%rowtype;
  v_id uuid;
  v_seq bigint;
  v_body text := pg_catalog.btrim(p_body);
  v_normalized_body text;
  v_limit integer;
  v_cooldown integer;
  v_previous timestamptz;
  v_duplicate_count integer;
  v_duplicate_oldest timestamptz;
  v_duplicate_newest timestamptz;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_retry integer;
begin
  if p_key is null or p_sender_id is null or p_sender_kind not in ('customer','guest','staff') then
    raise exception 'Invalid chat submission.' using errcode = '22023';
  end if;
  select * into v_conversation from public.chat_conversations
    where id = p_conversation_id for update;
  if not found then raise exception 'Chat not found.' using errcode = 'P0002'; end if;
  select * into v_existing from public.chat_messages
    where conversation_id = p_conversation_id and sender_id = p_sender_id
      and idempotency_key = p_key;
  if found then
    if v_existing.sender_kind = p_sender_kind and v_existing.body = v_body
      and v_existing.is_internal = p_internal then return v_existing.id; end if;
    raise exception 'CHAT_KEY_CONFLICT' using errcode = 'P0001';
  end if;
  if v_conversation.status = 'closed' then
    raise exception 'CHAT_CLOSED' using errcode = 'P0001';
  end if;
  select max_message_length,customer_send_cooldown_seconds
    into v_limit,v_cooldown from public.chat_settings where singleton;
  if v_limit is null or pg_catalog.char_length(v_body) not between 1 and v_limit then
    raise exception 'Chat message length is invalid.' using errcode = '22023';
  end if;
  if p_sender_kind <> 'staff' then
    if not exists (select 1 from public.chat_settings where singleton and is_enabled) then
      raise exception 'CHAT_DISABLED' using errcode = 'P0001';
    end if;
    select created_at into v_previous from public.chat_messages
      where conversation_id = p_conversation_id and sender_id = p_sender_id
        and sender_kind in ('customer','guest')
      order by sequence_number desc limit 1;
    if v_previous is not null
      and v_previous + pg_catalog.make_interval(secs => v_cooldown) > v_now then
      v_retry := greatest(1,pg_catalog.ceil(extract(epoch from
        v_previous + pg_catalog.make_interval(secs => v_cooldown) - v_now))::integer);
      raise exception 'CHAT_COOLDOWN' using errcode = 'P0001', hint = v_retry::text;
    end if;
    perform public.chat_consume_limit('message',p_subject_hash,60,12);
    v_normalized_body := pg_catalog.lower(pg_catalog.regexp_replace(
      v_body,'[[:space:]]+',' ','g'));
    select count(*)::integer,min(created_at),max(created_at)
      into v_duplicate_count,v_duplicate_oldest,v_duplicate_newest
    from public.chat_messages
    where sender_id = p_sender_id and sender_kind in ('customer','guest')
      and created_at > v_now - interval '10 minutes'
      and pg_catalog.lower(pg_catalog.regexp_replace(
        pg_catalog.btrim(body),'[[:space:]]+',' ','g')) = v_normalized_body;
    if v_duplicate_newest is not null
      and v_duplicate_newest > v_now - interval '15 seconds' then
      v_retry := greatest(1,pg_catalog.ceil(extract(epoch from
        v_duplicate_newest + interval '15 seconds' - v_now))::integer);
      raise exception 'CHAT_DUPLICATE' using errcode = 'P0001', hint = v_retry::text;
    elsif v_duplicate_count >= 3 then
      v_retry := greatest(1,pg_catalog.ceil(extract(epoch from
        v_duplicate_oldest + interval '10 minutes' - v_now))::integer);
      raise exception 'CHAT_DUPLICATE' using errcode = 'P0001', hint = v_retry::text;
    end if;
  end if;
  insert into public.chat_messages(conversation_id,sender_id,sender_kind,
    sender_name,body,is_internal,idempotency_key)
  values (p_conversation_id,p_sender_id,p_sender_kind,
    pg_catalog.btrim(p_sender_name),v_body,p_internal,p_key)
  returning id,sequence_number into v_id,v_seq;
  if not p_internal then
    update public.chat_conversations set
      last_activity_at = now(),
      last_customer_message_seq = case when p_sender_kind <> 'staff' then v_seq
        else last_customer_message_seq end,
      last_staff_message_seq = case when p_sender_kind = 'staff'
        then v_seq else last_staff_message_seq end
      where id = p_conversation_id;
  end if;
  if p_sender_kind = 'staff' and not p_internal then
    insert into public.chat_events(conversation_id,actor_id,actor_kind,
      event_type,related_message_id)
    values (p_conversation_id,p_sender_id,'staff','agent_replied',v_id);
  end if;
  return v_id;
end;
$$;


--
-- Name: chat_set_agent_availability(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_set_agent_availability(p_admin_id uuid, p_state text) RETURNS TABLE(declared_state text, lease_expires_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if p_state not in ('online','away','offline') or not exists (
    select 1 from public.admin_users a where a.id = p_admin_id and a.is_active
      and (a.role = 'owner' or (
        coalesce((a.permissions ->> 'support.view')::boolean,false)
        and coalesce((a.permissions ->> 'support.reply')::boolean,false)))) then
    raise exception 'Chat availability access denied.' using errcode = '42501';
  end if;
  return query
  insert into public.chat_agent_availability(admin_id,declared_state,lease_expires_at,updated_at)
  values (p_admin_id,p_state,
    case when p_state = 'online' then now() + interval '90 seconds' else null end,now())
  on conflict (admin_id) do update set declared_state = excluded.declared_state,
    lease_expires_at = excluded.lease_expires_at,updated_at = now()
  returning public.chat_agent_availability.declared_state,
    public.chat_agent_availability.lease_expires_at;
end;
$$;


--
-- Name: chat_set_callback_status(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_set_callback_status(p_conversation_id uuid, p_staff_id uuid, p_status text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_chat public.chat_conversations%rowtype;
  v_manage boolean;
  v_reply boolean;
begin
  if p_status not in ('completed','cancelled') then
    raise exception 'Callback status is invalid.' using errcode = '22023';
  end if;
  select a.role = 'owner' or coalesce((a.permissions ->> 'support.manage')::boolean,false),
    a.role = 'owner' or (coalesce((a.permissions ->> 'support.view')::boolean,false)
      and coalesce((a.permissions ->> 'support.reply')::boolean,false))
    into v_manage,v_reply from public.admin_users a
    where a.id = p_staff_id and a.is_active;
  if not coalesce(v_reply,false) then
    raise exception 'Support reply access is required.' using errcode = '42501';
  end if;
  select * into v_chat from public.chat_conversations
    where id = p_conversation_id for update;
  if not found then raise exception 'Chat not found.' using errcode = 'P0002'; end if;
  if v_chat.callback_status <> 'pending' then
    raise exception 'CHAT_CALLBACK_NOT_PENDING' using errcode = 'P0001';
  end if;
  if v_chat.assigned_admin_id is not null
    and v_chat.assigned_admin_id is distinct from p_staff_id
    and not coalesce(v_manage,false) then
    raise exception 'CHAT_CALLBACK_DENIED' using errcode = 'P0001';
  end if;
  update public.chat_conversations set callback_status = p_status,
    callback_updated_at = pg_catalog.clock_timestamp()
  where id = v_chat.id;
  insert into public.chat_events(conversation_id,actor_id,actor_kind,
    event_type,old_value,new_value)
  values(v_chat.id,p_staff_id,'staff','callback_updated',
    pg_catalog.jsonb_build_object('status','pending'),
    pg_catalog.jsonb_build_object('status',p_status));
  return v_chat.id;
end;
$$;


--
-- Name: chat_set_intake_mode(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_set_intake_mode() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  new.intake_mode := case when public.chat_live_available() then 'live' else 'offline' end;
  return new;
end;
$$;


--
-- Name: chat_set_order(uuid, uuid, text, uuid, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_set_order(p_conversation_id uuid, p_actor_id uuid, p_actor_kind text, p_order_id uuid, p_expected_revision bigint) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_chat public.chat_conversations%rowtype;
begin
  select * into v_chat from public.chat_conversations where id = p_conversation_id for update;
  if not found then raise exception 'Chat not found.' using errcode = 'P0002'; end if;
  if p_expected_revision is null or v_chat.revision <> p_expected_revision then
    raise exception 'CHAT_STALE' using errcode = 'P0001';
  end if;
  if v_chat.customer_id is null or v_chat.status = 'closed' then
    raise exception 'CHAT_ORDER_DENIED' using errcode = 'P0001';
  end if;
  if p_actor_kind = 'customer' then
    if p_actor_id is distinct from v_chat.customer_id or not exists (
      select 1 from public.customer_profiles p where p.id = p_actor_id and p.is_active = true
    ) then raise exception 'CHAT_ORDER_DENIED' using errcode = 'P0001'; end if;
  elsif p_actor_kind = 'staff' then
    if not exists (select 1 from public.admin_users a where a.id = p_actor_id
      and a.is_active = true and (a.role = 'owner' or
        (coalesce((a.permissions ->> 'support.view')::boolean,false) and
         coalesce((a.permissions ->> 'support.reply')::boolean,false)))
      and (a.role = 'owner' or
        coalesce((a.permissions ->> 'support.manage')::boolean,false) or
        v_chat.assigned_admin_id = p_actor_id)) then
      raise exception 'CHAT_ORDER_DENIED' using errcode = 'P0001';
    end if;
  else
    raise exception 'CHAT_ORDER_DENIED' using errcode = 'P0001';
  end if;
  if p_order_id is not null and not exists (
    select 1 from public.customer_orders o where o.id = p_order_id
      and o.user_id = v_chat.customer_id
  ) then raise exception 'CHAT_ORDER_DENIED' using errcode = 'P0001'; end if;
  if v_chat.order_id is not distinct from p_order_id then return v_chat.id; end if;
  update public.chat_conversations set order_id = p_order_id where id = v_chat.id;
  insert into public.chat_events(conversation_id,actor_id,actor_kind,event_type,old_value,new_value)
  values (v_chat.id,p_actor_id,p_actor_kind,
    case when p_order_id is null then 'order_unlinked' else 'order_linked' end,
    pg_catalog.jsonb_build_object('order_id',v_chat.order_id),
    pg_catalog.jsonb_build_object('order_id',p_order_id));
  return v_chat.id;
end;
$$;


--
-- Name: chat_signal_attachment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_signal_attachment() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_internal boolean;
  v_payload jsonb;
begin
  select is_internal into v_internal from public.chat_messages where id = new.message_id;
  v_payload := pg_catalog.jsonb_build_object('conversationId',new.conversation_id,
    'messageId',new.message_id,'attachmentId',new.id,'kind','attachment');
  perform realtime.send(v_payload,'changed','chat:staff:' || new.conversation_id::text,true);
  if not coalesce(v_internal,true) then
    perform realtime.send(v_payload,'changed','chat:public:' || new.conversation_id::text,true);
  end if;
  return new;
end;
$$;


--
-- Name: chat_signal_conversation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_signal_conversation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_payload jsonb;
begin
  v_payload := pg_catalog.jsonb_build_object('conversationId', new.id,
    'revision', new.revision, 'kind', 'conversation');
  perform realtime.send(v_payload, 'changed', 'chat:inbox', true);
  perform realtime.send(v_payload, 'changed', 'chat:staff:' || new.id::text, true);
  perform realtime.send(v_payload, 'changed', 'chat:public:' || new.id::text, true);
  return new;
end;
$$;


--
-- Name: chat_signal_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_signal_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_payload jsonb;
begin
  v_payload := pg_catalog.jsonb_build_object('conversationId',new.conversation_id,
    'messageId',new.id,'sequence',new.sequence_number,'kind','message');
  perform realtime.send(v_payload,'changed','chat:staff:' || new.conversation_id::text,true);
  if not new.is_internal then
    perform realtime.send(v_payload,'changed','chat:public:' || new.conversation_id::text,true);
    perform realtime.send(pg_catalog.jsonb_build_object(
      'conversationId',new.conversation_id,'sequence',new.sequence_number,
      'kind','message'),'changed','chat:inbox',true);
  end if;
  return new;
end;
$$;


--
-- Name: chat_snapshot_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_snapshot_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_old_id uuid;
  v_new_id uuid;
begin
  if new.actor_kind = 'staff' then
    new.actor_name := coalesce(public.chat_event_name(new.actor_id), new.actor_id::text);
  elsif new.actor_kind in ('customer', 'guest') then
    select c.contact_name into new.actor_name from public.chat_conversations c
      where c.id = new.conversation_id;
  else
    new.actor_name := 'System';
  end if;
  v_old_id := nullif(new.old_value ->> 'assigned_admin_id', '')::uuid;
  v_new_id := nullif(new.new_value ->> 'assigned_admin_id', '')::uuid;
  if v_old_id is not null then
    new.old_assignee_name := coalesce(public.chat_event_name(v_old_id), v_old_id::text);
  end if;
  if v_new_id is not null then
    new.new_assignee_name := coalesce(public.chat_event_name(v_new_id), v_new_id::text);
  end if;
  return new;
end;
$$;


--
-- Name: chat_start_with_message(uuid, boolean, text, text, text, uuid, uuid, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_start_with_message(p_actor_id uuid, p_is_guest boolean, p_name text, p_email text, p_mobile text, p_order_id uuid, p_creation_key uuid, p_subject_hash text, p_body text, p_message_key uuid) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_conversation_id uuid;
  v_message_id uuid;
begin
  v_conversation_id := public.chat_create_or_resume(p_actor_id, p_is_guest,
    p_name, p_email, p_mobile, p_order_id, p_creation_key, p_subject_hash);
  v_message_id := public.chat_send_message(v_conversation_id, p_actor_id,
    case when p_is_guest then 'guest' else 'customer' end,
    p_name, p_body, p_message_key, p_subject_hash, false);
  return pg_catalog.jsonb_build_object('conversationId', v_conversation_id,
    'messageId', v_message_id, 'ticketId', null);
end;
$$;


--
-- Name: chat_submit_resolution_feedback(uuid, uuid, boolean, boolean, smallint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_submit_resolution_feedback(p_conversation_id uuid, p_actor_id uuid, p_is_guest boolean, p_resolved boolean, p_rating smallint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_chat public.chat_conversations%rowtype;
  v_actor_kind text := case when p_is_guest then 'guest' else 'customer' end;
  v_ticket_id uuid;
  v_ticket_reference bigint;
  v_negative boolean;
begin
  if p_resolved is null or p_rating is null or p_rating not between 1 and 5 then
    raise exception 'Resolution feedback is invalid.' using errcode = '22023';
  end if;
  select * into v_chat from public.chat_conversations
    where id = p_conversation_id for update;
  if not found then raise exception 'Chat not found.' using errcode = 'P0002'; end if;
  if (p_is_guest and (v_chat.guest_auth_user_id is distinct from p_actor_id
      or v_chat.customer_id is not null))
    or (not p_is_guest and v_chat.customer_id is distinct from p_actor_id) then
    raise exception 'Chat feedback access denied.' using errcode = '42501';
  end if;
  if v_chat.status <> 'closed' then
    raise exception 'CHAT_FEEDBACK_OPEN' using errcode = 'P0001';
  end if;
  if v_chat.resolution_feedback_at is not null then
    select reference_number into v_ticket_reference from public.support_tickets
      where id = v_chat.ticket_id;
    return pg_catalog.jsonb_build_object('resolved',v_chat.resolution_resolved,
      'rating',v_chat.satisfaction_rating,'ticketId',v_chat.ticket_id,
      'ticketReference',v_ticket_reference,'submittedAt',v_chat.resolution_feedback_at);
  end if;

  v_negative := not p_resolved or p_rating <= 2;
  v_ticket_id := v_chat.ticket_id;
  if v_negative and v_ticket_id is null then
    insert into public.support_tickets(customer_id,customer_email,customer_mobile,
      customer_name,order_id,subject,assigned_admin_id,idempotency_key)
    values(v_chat.customer_id,v_chat.contact_email,v_chat.contact_mobile,
      v_chat.contact_name,v_chat.order_id,
      'Unresolved live chat #' || v_chat.reference_number::text ||
        ' (' || p_rating::text || '/5)',v_chat.assigned_admin_id,v_chat.id)
    returning id,reference_number into v_ticket_id,v_ticket_reference;
    insert into public.support_ticket_events(ticket_id,actor_id,actor_type,
      event_type,new_value)
    values
      (v_ticket_id,null,'system','created','open'),
      (v_ticket_id,null,'system','source_chat',v_chat.id::text);
  elsif v_ticket_id is not null then
    select reference_number into v_ticket_reference from public.support_tickets
      where id = v_ticket_id;
  end if;

  update public.chat_conversations set
    resolution_resolved = p_resolved,
    satisfaction_rating = p_rating,
    resolution_feedback_at = pg_catalog.clock_timestamp(),
    ticket_id = coalesce(ticket_id,v_ticket_id)
  where id = v_chat.id;
  insert into public.chat_events(conversation_id,actor_id,actor_kind,
    event_type,new_value)
  values(v_chat.id,p_actor_id,v_actor_kind,'resolution_feedback',
    pg_catalog.jsonb_build_object('resolved',p_resolved,'rating',p_rating,
      'negative',v_negative,'ticket_id',v_ticket_id));
  if v_negative and v_chat.ticket_id is null then
    insert into public.chat_events(conversation_id,actor_id,actor_kind,
      event_type,new_value)
    values(v_chat.id,null,'system','ticket_created',
      pg_catalog.jsonb_build_object('ticket_id',v_ticket_id,
        'ticket_reference',v_ticket_reference,'resolution_follow_up',true));
  end if;
  return pg_catalog.jsonb_build_object('resolved',p_resolved,'rating',p_rating,
    'ticketId',v_ticket_id,'ticketReference',v_ticket_reference,
    'submittedAt',pg_catalog.clock_timestamp());
end;
$$;


--
-- Name: chat_transition(uuid, uuid, text, uuid, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_transition(p_conversation_id uuid, p_staff_id uuid, p_action text, p_target_id uuid, p_expected_revision bigint) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_conversation public.chat_conversations%rowtype;
  v_manage boolean;
  v_reply boolean;
  v_old jsonb;
begin
  select a.role = 'owner' or coalesce((a.permissions ->> 'support.manage')::boolean,false),
    a.role = 'owner' or (coalesce((a.permissions ->> 'support.view')::boolean,false)
      and coalesce((a.permissions ->> 'support.reply')::boolean,false))
    into v_manage, v_reply from public.admin_users a
    where a.id = p_staff_id and a.is_active = true;
  if not coalesce(v_reply,false) then
    raise exception 'Support reply access is required.' using errcode = '42501';
  end if;
  select * into v_conversation from public.chat_conversations
    where id = p_conversation_id for update;
  if not found then raise exception 'Chat not found.' using errcode = 'P0002'; end if;
  if p_expected_revision is null or v_conversation.revision <> p_expected_revision then
    raise exception 'CHAT_STALE' using errcode = 'P0001';
  end if;
  v_old := pg_catalog.jsonb_build_object('status',v_conversation.status,
    'assigned_admin_id',v_conversation.assigned_admin_id);
  if p_action in ('assign', 'transfer') then
    if not coalesce(v_manage,false) or p_target_id is null then
      raise exception 'CHAT_TRANSITION_DENIED' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.admin_users a where a.id = p_target_id
      and a.is_active = true and (a.role = 'owner' or (
        coalesce((a.permissions ->> 'support.view')::boolean,false)
        and coalesce((a.permissions ->> 'support.reply')::boolean,false)))) then
      raise exception 'CHAT_TARGET_UNAVAILABLE' using errcode = 'P0001';
    end if;
  end if;
  if p_action = 'claim' then
    if v_conversation.status <> 'waiting' or v_conversation.assigned_admin_id is not null then
      raise exception 'CHAT_ALREADY_ASSIGNED' using errcode = 'P0001';
    end if;
    update public.chat_conversations set status = 'active',
      assigned_admin_id = p_staff_id where id = p_conversation_id;
  elsif p_action = 'assign' then
    if v_conversation.status <> 'waiting' or v_conversation.assigned_admin_id is not null then
      raise exception 'CHAT_ALREADY_ASSIGNED' using errcode = 'P0001';
    end if;
    update public.chat_conversations set status = 'active',
      assigned_admin_id = p_target_id where id = p_conversation_id;
  elsif p_action = 'transfer' then
    if v_conversation.status <> 'active'
      or p_target_id = v_conversation.assigned_admin_id
      or not exists (select 1 from public.chat_settings
        where singleton and transfers_enabled) then
      raise exception 'CHAT_TRANSITION_DENIED' using errcode = 'P0001';
    end if;
    update public.chat_conversations set assigned_admin_id = p_target_id
      where id = p_conversation_id;
  elsif p_action = 'close' then
    if v_conversation.status = 'closed' or
      (not v_manage and v_conversation.assigned_admin_id is distinct from p_staff_id) then
      raise exception 'CHAT_TRANSITION_DENIED' using errcode = 'P0001';
    end if;
    update public.chat_conversations set status = 'closed', closed_at = now()
      where id = p_conversation_id;
  elsif p_action = 'reopen' then
    if not v_manage or v_conversation.status <> 'closed'
      or not exists (select 1 from public.chat_settings
        where singleton and reopen_enabled) then
      raise exception 'CHAT_TRANSITION_DENIED' using errcode = 'P0001';
    end if;
    update public.chat_conversations set status = 'waiting',
      assigned_admin_id = null, closed_at = null where id = p_conversation_id;
  else
    raise exception 'Invalid chat transition.' using errcode = '22023';
  end if;
  insert into public.chat_events(conversation_id, actor_id, actor_kind,
    event_type, old_value, new_value)
  select p_conversation_id, p_staff_id, 'staff',
    case p_action when 'claim' then 'claimed' when 'assign' then 'assigned'
      when 'transfer' then 'transferred' when 'close' then 'closed'
      else 'reopened' end,
    v_old, pg_catalog.jsonb_build_object('status', status,
      'assigned_admin_id', assigned_admin_id)
    from public.chat_conversations where id = p_conversation_id;
  return p_conversation_id;
end;
$$;


--
-- Name: chat_unread_summary(uuid, text, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_unread_summary(p_actor_id uuid, p_actor_kind text, p_conversation_ids uuid[]) RETURNS TABLE(conversation_id uuid, last_read_sequence bigint, unread_count bigint)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if p_actor_id is null or p_actor_kind not in ('customer','guest','staff')
    or p_conversation_ids is null or pg_catalog.cardinality(p_conversation_ids) > 50 then
    raise exception 'Unread request is invalid.' using errcode = '22023';
  end if;
  if p_actor_kind = 'staff' and not exists (select 1 from public.admin_users a
    where a.id = p_actor_id and a.is_active and (a.role = 'owner' or
      coalesce((a.permissions ->> 'support.view')::boolean,false))) then
    raise exception 'Chat access denied.' using errcode = '42501';
  end if;
  if p_actor_kind = 'customer' and not exists (select 1 from public.customer_profiles p
    where p.id = p_actor_id and p.is_active) then
    raise exception 'Chat access denied.' using errcode = '42501';
  end if;
  if p_actor_kind = 'guest' and not exists (select 1 from auth.users u
    where u.id = p_actor_id and u.is_anonymous) then
    raise exception 'Chat access denied.' using errcode = '42501';
  end if;
  return query
  select c.id, coalesce(r.last_read_sequence,0)::bigint,
    count(m.id)::bigint
  from (select distinct unnest(p_conversation_ids) as id) requested
  join public.chat_conversations c on c.id = requested.id
  left join public.chat_read_state r on r.conversation_id = c.id
    and r.actor_id = p_actor_id and r.actor_kind = p_actor_kind
  left join public.chat_messages m on m.conversation_id = c.id
    and m.sequence_number > coalesce(r.last_read_sequence,0)
    and ((p_actor_kind = 'staff' and m.sender_kind in ('customer','guest'))
      or (p_actor_kind in ('customer','guest') and m.sender_kind = 'staff'
        and not m.is_internal))
  where p_actor_kind = 'staff'
    or (p_actor_kind = 'customer' and c.customer_id = p_actor_id)
    or (p_actor_kind = 'guest' and c.guest_auth_user_id = p_actor_id
      and c.customer_id is null)
  group by c.id,r.last_read_sequence;
end;
$$;


--
-- Name: chat_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_settings (
    singleton boolean DEFAULT true NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    availability_override text DEFAULT 'auto'::text NOT NULL,
    business_timezone text DEFAULT 'Africa/Cairo'::text NOT NULL,
    weekly_hours jsonb DEFAULT '{"0": [["09:00", "18:00"]], "1": [["09:00", "18:00"]], "2": [["09:00", "18:00"]], "3": [["09:00", "18:00"]], "4": [["09:00", "18:00"]], "5": [], "6": []}'::jsonb NOT NULL,
    welcome_message text DEFAULT 'Hi! How can we help you today?'::text NOT NULL,
    offline_message text DEFAULT 'Support is currently offline. Leave us a message.'::text NOT NULL,
    guest_contact_rule text DEFAULT 'either'::text NOT NULL,
    customer_send_cooldown_seconds smallint DEFAULT 4 NOT NULL,
    max_message_length integer DEFAULT 4000 NOT NULL,
    attachments_enabled boolean DEFAULT true NOT NULL,
    allowed_attachment_mimes text[] DEFAULT ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text, 'application/pdf'::text] NOT NULL,
    max_attachment_bytes integer DEFAULT 5242880 NOT NULL,
    max_attachments_per_message smallint DEFAULT 3 NOT NULL,
    auto_assignment_enabled boolean DEFAULT false NOT NULL,
    sound_notifications_enabled boolean DEFAULT true NOT NULL,
    transfers_enabled boolean DEFAULT true NOT NULL,
    reopen_enabled boolean DEFAULT true NOT NULL,
    offline_behavior text DEFAULT 'conversation'::text NOT NULL,
    ticket_conversion_enabled boolean DEFAULT true NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    request_call_enabled boolean DEFAULT false NOT NULL,
    CONSTRAINT chat_settings_allowed_mimes_check CHECK ((((cardinality(allowed_attachment_mimes) >= 1) AND (cardinality(allowed_attachment_mimes) <= 4)) AND (allowed_attachment_mimes <@ ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text, 'application/pdf'::text]))),
    CONSTRAINT chat_settings_availability_override_check CHECK ((availability_override = ANY (ARRAY['auto'::text, 'online'::text, 'offline'::text]))),
    CONSTRAINT chat_settings_business_timezone_check CHECK (((char_length(business_timezone) >= 3) AND (char_length(business_timezone) <= 64))),
    CONSTRAINT chat_settings_conversation_intake_only CHECK ((offline_behavior = 'conversation'::text)),
    CONSTRAINT chat_settings_customer_send_cooldown_seconds_check CHECK (((customer_send_cooldown_seconds >= 0) AND (customer_send_cooldown_seconds <= 60))),
    CONSTRAINT chat_settings_guest_contact_rule_check CHECK ((guest_contact_rule = ANY (ARRAY['either'::text, 'email'::text, 'mobile'::text, 'both'::text]))),
    CONSTRAINT chat_settings_max_attachment_bytes_check CHECK (((max_attachment_bytes >= 1024) AND (max_attachment_bytes <= 5242880))),
    CONSTRAINT chat_settings_max_attachments_per_message_check CHECK (((max_attachments_per_message >= 0) AND (max_attachments_per_message <= 5))),
    CONSTRAINT chat_settings_max_message_length_check CHECK (((max_message_length >= 100) AND (max_message_length <= 10000))),
    CONSTRAINT chat_settings_offline_behavior_check CHECK ((offline_behavior = ANY (ARRAY['conversation'::text, 'ticket'::text]))),
    CONSTRAINT chat_settings_offline_message_check CHECK (((char_length(offline_message) >= 1) AND (char_length(offline_message) <= 500))),
    CONSTRAINT chat_settings_offline_ticket_check CHECK (((offline_behavior <> 'ticket'::text) OR ticket_conversion_enabled)),
    CONSTRAINT chat_settings_singleton_check CHECK (singleton),
    CONSTRAINT chat_settings_welcome_message_check CHECK (((char_length(welcome_message) >= 1) AND (char_length(welcome_message) <= 500)))
);


--
-- Name: chat_update_settings(uuid, timestamp with time zone, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_update_settings(p_actor_id uuid, p_expected_updated_at timestamp with time zone, p_settings jsonb) RETURNS public.chat_settings
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_actor public.admin_users%rowtype;
  v_settings public.chat_settings%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_changed text[];
  v_keys constant text[] := array[
    'is_enabled','availability_override','business_timezone','weekly_hours',
    'welcome_message','offline_message','guest_contact_rule',
    'customer_send_cooldown_seconds','max_message_length','attachments_enabled',
    'allowed_attachment_mimes','max_attachment_bytes','max_attachments_per_message',
    'transfers_enabled','reopen_enabled','offline_behavior','ticket_conversion_enabled',
    'request_call_enabled'
  ];
begin
  select * into v_actor from public.admin_users where id = p_actor_id and is_active = true;
  if not found or not (v_actor.role = 'owner'
    or coalesce((v_actor.permissions ->> 'settings.edit')::boolean, false)) then
    raise exception 'Live Chat settings access denied.' using errcode = '42501';
  end if;
  if pg_catalog.jsonb_typeof(p_settings) <> 'object'
    or not p_settings ?& v_keys
    or exists (select 1 from pg_catalog.jsonb_object_keys(p_settings) k
      where not k = any(v_keys)) then
    raise exception 'Live Chat settings payload is invalid.' using errcode = '22023';
  end if;
  select * into v_settings from public.chat_settings where singleton for update;
  if not found then raise exception 'Live Chat settings are unavailable.' using errcode = 'P0002'; end if;
  if p_expected_updated_at is null or v_settings.updated_at is distinct from p_expected_updated_at then
    raise exception 'CHAT_SETTINGS_STALE' using errcode = 'P0001';
  end if;
  v_before := to_jsonb(v_settings) - 'singleton' - 'updated_by' - 'updated_at';

  update public.chat_settings set
    is_enabled = (p_settings ->> 'is_enabled')::boolean,
    availability_override = p_settings ->> 'availability_override',
    business_timezone = p_settings ->> 'business_timezone',
    weekly_hours = p_settings -> 'weekly_hours',
    welcome_message = p_settings ->> 'welcome_message',
    offline_message = p_settings ->> 'offline_message',
    guest_contact_rule = p_settings ->> 'guest_contact_rule',
    customer_send_cooldown_seconds = (p_settings ->> 'customer_send_cooldown_seconds')::smallint,
    max_message_length = (p_settings ->> 'max_message_length')::integer,
    attachments_enabled = (p_settings ->> 'attachments_enabled')::boolean,
    allowed_attachment_mimes = array(select pg_catalog.jsonb_array_elements_text(
      p_settings -> 'allowed_attachment_mimes')),
    max_attachment_bytes = (p_settings ->> 'max_attachment_bytes')::integer,
    max_attachments_per_message = (p_settings ->> 'max_attachments_per_message')::smallint,
    transfers_enabled = (p_settings ->> 'transfers_enabled')::boolean,
    reopen_enabled = (p_settings ->> 'reopen_enabled')::boolean,
    offline_behavior = p_settings ->> 'offline_behavior',
    ticket_conversion_enabled = (p_settings ->> 'ticket_conversion_enabled')::boolean,
    request_call_enabled = (p_settings ->> 'request_call_enabled')::boolean,
    updated_by = p_actor_id
  where singleton returning * into v_settings;
  v_after := to_jsonb(v_settings) - 'singleton' - 'updated_by' - 'updated_at';
  select pg_catalog.array_agg(b.key order by b.key) into v_changed
  from pg_catalog.jsonb_each(v_before) b join pg_catalog.jsonb_each(v_after) a using (key)
  where b.value is distinct from a.value;
  if coalesce(pg_catalog.cardinality(v_changed), 0) = 0 then return v_settings; end if;

  insert into public.admin_activity_logs(admin_user_id, author_name, author_email,
    author_role, action_key, description, metadata)
  values(p_actor_id, coalesce(nullif(pg_catalog.btrim(v_actor.full_name), ''), v_actor.email),
    v_actor.email, v_actor.role, 'chat.settings.updated',
    'Updated Live Chat settings: ' || pg_catalog.array_to_string(v_changed, ', '),
    pg_catalog.jsonb_build_object('changed_fields', v_changed,
      'before', v_before, 'after', v_after));
  return v_settings;
end;
$$;


--
-- Name: chat_validate_message_actor(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_validate_message_actor() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_conversation public.chat_conversations%rowtype;
begin
  select * into v_conversation from public.chat_conversations where id = new.conversation_id;
  if not found or new.sender_id is null or v_conversation.status = 'closed' then
    raise exception 'Chat message cannot be saved.' using errcode = '22023';
  end if;
  if (new.sender_kind = 'customer' and (v_conversation.customer_id is distinct from new.sender_id or new.is_internal))
    or (new.sender_kind = 'guest' and (v_conversation.guest_auth_user_id is distinct from new.sender_id or new.is_internal))
    or (new.sender_kind = 'staff' and (
      v_conversation.assigned_admin_id is distinct from new.sender_id
      or v_conversation.status <> 'active')) then
    raise exception 'Chat message actor is invalid.' using errcode = '22023';
  end if;
  if new.sender_kind = 'customer' and not exists (
    select 1 from public.customer_profiles p where p.id = new.sender_id and p.is_active = true
  ) then
    raise exception 'Customer account is unavailable.' using errcode = '22023';
  end if;
  if new.sender_kind = 'guest' and not exists (
    select 1 from auth.users u where u.id = new.sender_id and u.is_anonymous = true
  ) then
    raise exception 'Guest identity is unavailable.' using errcode = '22023';
  end if;
  if new.sender_kind = 'staff' and not exists (
    select 1 from public.admin_users a where a.id = new.sender_id and a.is_active = true
      and (a.role = 'owner' or (
        coalesce((a.permissions ->> 'support.view')::boolean, false)
        and coalesce((a.permissions ->> 'support.reply')::boolean, false)))
  ) then
    raise exception 'Support reply access is required.' using errcode = '22023';
  end if;
  return new;
end;
$$;


--
-- Name: chat_validate_settings(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_validate_settings() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
declare
  v_day integer;
  v_slot jsonb;
  v_start text;
  v_end text;
  v_previous_end text;
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.business_timezone) then
    raise exception 'Invalid chat business timezone.' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(new.weekly_hours) <> 'object'
    or (select count(*) from pg_catalog.jsonb_object_keys(new.weekly_hours)) <> 7 then
    raise exception 'Chat hours must contain seven days.' using errcode = '22023';
  end if;
  for v_day in 0..6 loop
    if pg_catalog.jsonb_typeof(new.weekly_hours -> v_day::text) <> 'array' then
      raise exception 'Chat hours day is invalid.' using errcode = '22023';
    end if;
    if pg_catalog.jsonb_array_length(new.weekly_hours -> v_day::text) > 3 then
      raise exception 'Chat hours have too many intervals.' using errcode = '22023';
    end if;
    v_previous_end := null;
    for v_slot in select value from pg_catalog.jsonb_array_elements(new.weekly_hours -> v_day::text) loop
      if pg_catalog.jsonb_typeof(v_slot) <> 'array'
        or pg_catalog.jsonb_array_length(v_slot) <> 2 then
        raise exception 'Chat hours interval is invalid.' using errcode = '22023';
      end if;
      v_start := v_slot ->> 0;
      v_end := v_slot ->> 1;
      if v_start !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or v_end !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or v_start >= v_end or (v_previous_end is not null and v_start < v_previous_end) then
        raise exception 'Chat hours interval is invalid.' using errcode = '22023';
      end if;
      v_previous_end := v_end;
    end loop;
  end loop;
  new.updated_at := now();
  return new;
end;
$_$;


--
-- Name: erp_sync_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.erp_sync_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text DEFAULT 'daftra'::text NOT NULL,
    operation text NOT NULL,
    local_entity_type text NOT NULL,
    local_id uuid NOT NULL,
    dedupe_key text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 8 NOT NULL,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    locked_at timestamp with time zone,
    completed_at timestamp with time zone,
    last_error text,
    result jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    lease_token uuid,
    sync_run_id uuid,
    CONSTRAINT erp_sync_jobs_attempts_check CHECK ((attempts >= 0)),
    CONSTRAINT erp_sync_jobs_max_attempts_check CHECK (((max_attempts >= 1) AND (max_attempts <= 25))),
    CONSTRAINT erp_sync_jobs_provider_check CHECK ((provider = 'daftra'::text)),
    CONSTRAINT erp_sync_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: claim_daftra_sync_job(uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_daftra_sync_job(p_job_id uuid DEFAULT NULL::uuid, p_operations text[] DEFAULT NULL::text[]) RETURNS SETOF public.erp_sync_jobs
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_token uuid:=gen_random_uuid(); lease public.erp_worker_leases%rowtype;
begin
  perform 1 from public.site_settings where key='default' for share;
  if public.get_active_erp_mode()<>'daftra' then return; end if;
  insert into public.erp_worker_leases(provider) values('daftra') on conflict(provider) do nothing;
  select * into lease from public.erp_worker_leases where provider='daftra' for update;
  if lease.expires_at>clock_timestamp() then return; end if;
  update public.erp_sync_jobs set status='failed',last_error='Worker interrupted. Reconciliation may be required.',locked_at=null,lease_token=null,available_at=clock_timestamp()
    where provider='daftra' and status='processing';
  return query with candidate as (
    select j.id from public.erp_sync_jobs j where j.provider='daftra' and j.status in ('pending','failed')
      and j.attempts<j.max_attempts and j.available_at<=clock_timestamp() and (p_job_id is null or j.id=p_job_id)
      and (p_operations is null or j.operation=any(p_operations))
      order by j.created_at,j.id for update skip locked limit 1
  ) update public.erp_sync_jobs j set status='processing',attempts=j.attempts+1,locked_at=clock_timestamp(),lease_token=v_token,updated_at=clock_timestamp()
    from candidate c where j.id=c.id returning j.*;
  if found then
    update public.erp_worker_leases set token=v_token,expires_at=clock_timestamp()+interval '30 minutes' where provider='daftra';
    update public.erp_sync_runs set status='processing',updated_at=clock_timestamp()
      where id in (select sync_run_id from public.erp_sync_jobs where lease_token=v_token);
  end if;
end;
$$;


--
-- Name: close_order_packing_work_session(uuid, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.close_order_packing_work_session(p_work_session_id uuid, p_admin_user_id uuid, p_author_name text, p_author_email text, p_author_role text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_work_session public.order_packing_work_sessions%rowtype;
  v_packing_session public.order_packing_sessions%rowtype;
  v_order_number text;
  v_scan_count integer := 0;
  v_now timestamptz := clock_timestamp();
  v_description text;
begin
  if coalesce(auth.role()::text, '') <> 'service_role' then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  if p_work_session_id is null or p_admin_user_id is null then
    raise exception 'A work session and admin are required.';
  end if;

  select work_sessions.*
  into v_work_session
  from public.order_packing_work_sessions as work_sessions
  where work_sessions.id = p_work_session_id
    and work_sessions.admin_user_id = p_admin_user_id
  for update;

  if not found then
    raise exception 'Packing session not found.';
  end if;

  if v_work_session.status = 'closed' then
    return jsonb_build_object(
      'work_session_id', v_work_session.id,
      'status', v_work_session.status,
      'already_closed', true
    );
  end if;

  select packing.*
  into v_packing_session
  from public.order_packing_sessions as packing
  where packing.admin_user_id = p_admin_user_id
    and packing.status = 'active'
  order by packing.started_at
  limit 1
  for update;

  if found then
    select orders.order_number
    into v_order_number
    from public.customer_orders as orders
    where orders.id = v_packing_session.order_id;

    select count(*)::integer
    into v_scan_count
    from public.order_packing_scans as scans
    where scans.session_id = v_packing_session.id;

    update public.order_packing_sessions
    set
      status = 'cancelled',
      updated_at = v_now
    where id = v_packing_session.id;
  end if;

  update public.order_packing_work_sessions
  set
    status = 'closed',
    closed_at = v_now,
    updated_at = v_now
  where id = v_work_session.id;

  v_description := case
    when v_packing_session.id is not null then
      'Closed packing session. Order '
        || coalesce(v_order_number, '#' || left(v_packing_session.order_id::text, 8))
        || ' returned to the queue.'
    else 'Closed packing session.'
  end;

  insert into public.admin_activity_logs (
    admin_user_id,
    author_name,
    author_email,
    author_role,
    action_key,
    description,
    metadata,
    created_at
  )
  values (
    p_admin_user_id,
    coalesce(nullif(btrim(p_author_name), ''), 'Admin'),
    coalesce(nullif(lower(btrim(p_author_email)), ''), 'unknown@local.invalid'),
    case when p_author_role = 'owner' then 'owner' else 'admin' end,
    'orders.packing.work_session.close',
    v_description,
    jsonb_build_object(
      'work_session_id', v_work_session.id,
      'packing_session_id', v_packing_session.id,
      'order_id', v_packing_session.order_id,
      'order_number', v_order_number,
      'scan_count', v_scan_count,
      'packing_progress_cleared', v_packing_session.id is not null
    ),
    v_now
  );

  return jsonb_build_object(
    'work_session_id', v_work_session.id,
    'status', 'closed',
    'already_closed', false,
    'released_order_id', v_packing_session.order_id,
    'released_order_number', v_order_number,
    'released_packing_session_id', v_packing_session.id,
    'scan_count', v_scan_count
  );
end;
$$;


--
-- Name: commerce_claim_payment_attempt(uuid, uuid, text, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_claim_payment_attempt(p_order_id uuid, p_user_id uuid, p_mode text, p_integration_id bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_order public.customer_orders%rowtype; v_attempt public.payment_attempts%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Server access required.'; end if;
  if p_mode is distinct from 'test' or p_integration_id is null or p_integration_id <= 0 then raise exception 'Gateway unavailable.'; end if;
  select * into v_order from public.customer_orders where id=p_order_id and user_id=p_user_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.is_preorder or v_order.payment_method is distinct from 'card' or v_order.currency is distinct from 'EGP'
    or v_order.total_amount <= 0 or v_order.payment_status not in ('pending','failed') or v_order.status not in ('pending_payment','on_hold') then
    raise exception 'Order is not payable.';
  end if;
  if not exists (select 1 from public.site_settings where key='default' and payment_card_enabled) then raise exception 'Card unavailable.'; end if;
  select * into v_attempt from public.payment_attempts where order_id=p_order_id and provider='paymob';
  if found then
    if v_attempt.amount_minor <> v_order.total_amount * 100 or v_attempt.currency <> v_order.currency then raise exception 'Order changed.'; end if;
    return jsonb_build_object('created',false,'attempt',to_jsonb(v_attempt));
  end if;
  insert into public.payment_attempts(order_id,mode,integration_id,amount_minor,currency)
    values(p_order_id,p_mode,p_integration_id,(v_order.total_amount * 100)::bigint,v_order.currency) returning * into v_attempt;
  return jsonb_build_object('created',true,'attempt',to_jsonb(v_attempt));
end;
$$;


--
-- Name: commerce_create_builtin_customer_order(uuid, jsonb, jsonb, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_create_builtin_customer_order(p_user_id uuid, p_order jsonb, p_items jsonb, p_allow_out_of_stock boolean, p_cart_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_product public.products%rowtype;
begin
  perform public.assert_built_in_erp();
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'A valid cart is required.';
  end if;
  for v_product in
    select products.* from public.products as products
    where products.id in (
      select (item.value ->> 'product_id')::uuid
      from jsonb_array_elements(p_items) as item(value)
    ) order by products.id for update
  loop
    if v_product.selling_mode <> 'normal' then
      raise exception 'This product is not available for normal checkout.';
    end if;
  end loop;
  return public.commerce_create_normal_customer_order(
    p_user_id, p_order, p_items, p_allow_out_of_stock, p_cart_id
  );
end;
$$;


--
-- Name: commerce_create_builtin_order_return(uuid, uuid, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_create_builtin_order_return(p_order_id uuid, p_warehouse_id uuid, p_reason text, p_notes text, p_items jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_return_id uuid;
  v_item jsonb;
  v_order_item_id uuid;
  v_product_id uuid;
  v_quantity integer;
  v_total_items integer := 0;
  v_previously_returned integer;
  v_order_item public.customer_order_items%rowtype;
  v_product_record public.products%rowtype;
  v_inventory_record public.commerce_warehouse_inventory%rowtype;
  v_next_inventory_quantity integer;
begin
  perform public.assert_built_in_erp();
  if not public.is_active_admin () then
    raise exception 'Not authorized';
  end if;

  if p_order_id is null or not exists (
    select 1
    from public.customer_orders
    where id = p_order_id
  ) then
    raise exception 'A valid customer order is required.';
  end if;

  if p_warehouse_id is null or not exists (
    select 1
    from public.commerce_warehouses
    where id = p_warehouse_id
      and is_active = true
  ) then
    raise exception 'A valid warehouse is required.';
  end if;

  if jsonb_typeof (p_items) <> 'array' or jsonb_array_length (p_items) = 0 then
    raise exception 'At least one returned item is required.';
  end if;

  insert into public.commerce_order_returns (
    order_id,
    warehouse_id,
    reason,
    notes,
    total_items,
    created_by
  )
  values (
    p_order_id,
    p_warehouse_id,
    nullif(trim(p_reason), ''),
    nullif(trim(p_notes), ''),
    0,
    auth.uid ()
  )
  returning id into v_return_id;

  for v_item in
    select value
    from jsonb_array_elements (p_items)
  loop
    v_order_item_id := nullif(v_item ->> 'order_item_id', '')::uuid;
    v_product_id := nullif(v_item ->> 'product_id', '')::uuid;
    v_quantity := coalesce((v_item ->> 'quantity')::integer, 0);

    if v_order_item_id is null or v_quantity <= 0 then
      raise exception 'Every return line requires a valid order item and quantity.';
    end if;

    select *
    into v_order_item
    from public.customer_order_items
    where id = v_order_item_id
      and order_id = p_order_id
    for update;

    if not found then
      raise exception 'One of the selected order items is not valid.';
    end if;

    select coalesce(sum(ri.quantity), 0)
    into v_previously_returned
    from public.commerce_order_return_items ri
    join public.commerce_order_returns r on r.id = ri.order_return_id
    where r.order_id = p_order_id
      and ri.order_item_id = v_order_item_id;

    if (v_previously_returned + v_quantity) > coalesce(v_order_item.quantity, 0) then
      raise exception 'Returned quantity exceeds the remaining order quantity for one of the items.';
    end if;

    insert into public.commerce_order_return_items (
      order_return_id,
      order_item_id,
      product_id,
      quantity,
      unit_price
    )
    values (
      v_return_id,
      v_order_item_id,
      coalesce(v_product_id, v_order_item.product_id),
      v_quantity,
      coalesce(v_order_item.unit_price, 0)
    );

    v_total_items := v_total_items + v_quantity;

    if coalesce(v_product_id, v_order_item.product_id) is not null then
      select *
      into v_product_record
      from public.products
      where id = coalesce(v_product_id, v_order_item.product_id)
      for update;

      if found then
        update public.products
        set stock_quantity = stock_quantity + v_quantity
        where id = v_product_record.id;

        select *
        into v_inventory_record
        from public.commerce_warehouse_inventory
        where warehouse_id = p_warehouse_id
          and product_id = v_product_record.id
        for update;

        if found then
          v_next_inventory_quantity := coalesce(v_inventory_record.quantity, 0) + v_quantity;

          update public.commerce_warehouse_inventory
          set
            quantity = v_next_inventory_quantity,
            updated_at = now()
          where id = v_inventory_record.id;
        else
          v_next_inventory_quantity := v_quantity;

          insert into public.commerce_warehouse_inventory (
            warehouse_id,
            product_id,
            quantity,
            average_cost
          )
          values (
            p_warehouse_id,
            v_product_record.id,
            v_quantity,
            coalesce(v_product_record.cost_price, 0)
          );
        end if;

        insert into public.commerce_inventory_movements (
          warehouse_id,
          product_id,
          movement_type,
          reference_type,
          reference_id,
          quantity_change,
          quantity_after,
          unit_cost,
          notes,
          created_by
        )
        values (
          p_warehouse_id,
          v_product_record.id,
          'return_in',
          'order_return',
          v_return_id,
          v_quantity,
          v_next_inventory_quantity,
          coalesce(v_product_record.cost_price, 0),
          nullif(trim(p_notes), ''),
          auth.uid ()
        );
      end if;
    end if;
  end loop;

  update public.commerce_order_returns
  set
    total_items = v_total_items,
    updated_at = now()
  where id = v_return_id;

  return v_return_id;
end;
$$;


--
-- Name: commerce_create_customer_order(uuid, jsonb, jsonb, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_create_customer_order(p_user_id uuid, p_order jsonb, p_items jsonb, p_allow_out_of_stock boolean, p_cart_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare result jsonb; previous text := coalesce(current_setting('app.warranty_purchase_capture', true), '');
begin
  perform set_config('app.warranty_purchase_capture', 'on', true);
  result := public.commerce_create_customer_order_before_warranty(p_user_id, p_order, p_items, p_allow_out_of_stock, p_cart_id);
  perform set_config('app.warranty_purchase_capture', previous, true);
  return result;
end $$;


--
-- Name: commerce_create_customer_order_before_order_sms(uuid, jsonb, jsonb, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_create_customer_order_before_order_sms(p_user_id uuid, p_order jsonb, p_items jsonb, p_allow_out_of_stock boolean, p_cart_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform 1 from public.site_settings where key='default' for share;
  if public.get_active_erp_mode()='daftra' then
    return public.erp_create_external_customer_order(p_user_id,p_order,p_items,p_allow_out_of_stock,p_cart_id);
  end if;
  return public.commerce_create_builtin_customer_order(p_user_id,p_order,p_items,p_allow_out_of_stock,p_cart_id);
end;
$$;


--
-- Name: commerce_create_customer_order_before_warranty(uuid, jsonb, jsonb, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_create_customer_order_before_warranty(p_user_id uuid, p_order jsonb, p_items jsonb, p_allow_out_of_stock boolean, p_cart_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare result jsonb; previous text:=coalesce(current_setting('app.order_sms_locale',true),'');
begin
  perform set_config('app.order_sms_locale',case when p_order->>'locale'='ar' then 'ar' else 'en' end,true);
  result:=public.commerce_create_customer_order_before_order_sms(p_user_id,p_order,p_items,p_allow_out_of_stock,p_cart_id);
  perform set_config('app.order_sms_locale',previous,true);
  return result;
end $$;


--
-- Name: commerce_create_default_product_variant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_create_default_product_variant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
begin
  if not exists (
    select 1
    from public.product_variants as variants
    where variants.product_id = new.id
      and variants.is_active
  )
  then
    insert into public.product_variants (
      product_id,
      name,
      code,
      color_name,
      color_hex,
      price,
      cost_price,
      stock_quantity,
      is_active
    )
    values (
      new.id,
      coalesce(nullif(btrim(new.color_name), ''), 'Default'),
      coalesce(
        nullif(
          regexp_replace(
            upper(coalesce(new.color_name, '')),
            '[^A-Z0-9_-]',
            '',
            'g'
          ),
          ''
        ),
        'DEFAULT'
      ),
      nullif(btrim(new.color_name), ''),
      case
        when new.color_hex ~ '^#[0-9A-Fa-f]{6}$'
          then new.color_hex
        else null
      end,
      coalesce(new.price, 0),
      0,
      0,
      true
    );
  end if;

  return new;
end;
$_$;


--
-- Name: commerce_create_normal_customer_order(uuid, jsonb, jsonb, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_create_normal_customer_order(p_user_id uuid, p_order jsonb, p_items jsonb, p_allow_out_of_stock boolean, p_cart_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_existing_order public.customer_orders%rowtype;
  v_order public.customer_orders%rowtype;
  v_order_item public.customer_order_items%rowtype;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_coupon public.site_coupons%rowtype;
  v_unit public.commerce_serialized_units%rowtype;
  v_item jsonb;
  v_normalized_items jsonb := '[]'::jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_unit_price numeric(12, 2);
  v_line_total numeric(12, 2);
  v_subtotal numeric(12, 2) := 0;
  v_discount numeric(12, 2) := 0;
  v_total numeric(12, 2) := 0;
  v_coupon_code text;
  v_order_number text;
  v_available_units integer;
  v_assigned_units integer;
  v_total_assigned_units integer := 0;
  v_updated_rows integer;
  v_warehouse_quantity integer;
  v_has_warehouse_inventory boolean;
begin
  perform public.assert_built_in_erp();
  if p_user_id is null or not exists (
    select 1
    from auth.users as users
    where users.id = p_user_id
  ) then
    raise exception 'A valid signed-in customer is required.';
  end if;

  -- A cart retry must return before coupon, inventory, or order writes. The
  -- advisory lock closes the race between two simultaneous requests.
  if p_cart_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        p_user_id::text || ':' || p_cart_id::text,
        0
      )
    );

    select orders.*
    into v_existing_order
    from public.customer_orders as orders
    where orders.user_id = p_user_id
      and orders.checkout_cart_id = p_cart_id
    limit 1;

    if found then
      return jsonb_build_object(
        'order', to_jsonb(v_existing_order),
        'created', false,
        'serialized_units_assigned', 0
      );
    end if;
  end if;

  if p_order is null or jsonb_typeof(p_order) <> 'object' then
    raise exception 'A valid order is required.';
  end if;

  if p_items is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0
  then
    raise exception 'At least one order item is required.';
  end if;

  if jsonb_array_length(p_items) > 100 then
    raise exception 'An order cannot contain more than 100 item lines.';
  end if;

  if nullif(btrim(p_order ->> 'first_name'), '') is null
    or nullif(btrim(p_order ->> 'phone'), '') is null
    or nullif(btrim(p_order ->> 'street_address'), '') is null
    or nullif(btrim(p_order ->> 'city'), '') is null
    or nullif(btrim(p_order ->> 'governorate'), '') is null
  then
    raise exception 'Complete customer and delivery details are required.';
  end if;

  -- Lock products in a deterministic order. Prices, snapshots, and availability
  -- are derived here instead of trusting browser-submitted line totals.
  for v_item in
    select item_rows.value
    from jsonb_array_elements(p_items) as item_rows(value)
    order by
      item_rows.value ->> 'product_id',
      coalesce(item_rows.value ->> 'variant_id', '')
  loop
    v_product_id := nullif(btrim(v_item ->> 'product_id'), '')::uuid;
    v_variant_id := nullif(btrim(v_item ->> 'variant_id'), '')::uuid;
    v_quantity := coalesce((v_item ->> 'quantity')::integer, 0);

    if v_product_id is null or v_quantity < 1 or v_quantity > 99 then
      raise exception 'Every order line requires a valid product and quantity.';
    end if;

    select products.*
    into v_product
    from public.products as products
    where products.id = v_product_id
    for update;

    if not found or not v_product.is_published then
      raise exception 'One or more products are no longer available.';
    end if;

    if v_product.is_serialized then
      if v_variant_id is null then
        raise exception 'A product model is required for serialized inventory.';
      end if;

      if v_product.primary_warehouse_id is null then
        raise exception 'The serialized product does not have a primary warehouse.';
      end if;

      select variants.*
      into v_variant
      from public.product_variants as variants
      where variants.id = v_variant_id
        and variants.product_id = v_product_id
        and variants.is_active
      for update;

      if not found then
        raise exception 'The selected product model is no longer available.';
      end if;

      select count(*)::integer
      into v_available_units
      from public.commerce_serialized_units as units
      where units.product_id = v_product_id
        and units.variant_id = v_variant_id
        and units.warehouse_id = v_product.primary_warehouse_id
        and units.status = 'in_stock';

      if v_available_units < v_quantity then
        raise exception
          'Not enough serialized units are available for one of the selected models.';
      end if;

      -- Variants currently represent color/model identity, while the product
      -- owns the storefront price. This also prevents stale copied prices when
      -- an admin changes the parent product price.
      v_unit_price := round(coalesce(v_product.price, 0)::numeric, 2);
    else
      if v_variant_id is not null then
        raise exception 'Standard products cannot be ordered with a variant.';
      end if;

      if not coalesce(p_allow_out_of_stock, false)
        and v_product.stock_quantity < v_quantity
      then
        raise exception 'One or more products do not have enough stock.';
      end if;

      v_unit_price := round(coalesce(v_product.price, 0)::numeric, 2);
    end if;

    v_line_total := round((v_unit_price * v_quantity)::numeric, 2);
    v_subtotal := round((v_subtotal + v_line_total)::numeric, 2);

    v_normalized_items := v_normalized_items || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product.id,
        'variant_id', case
          when v_product.is_serialized then v_variant.id
          else null
        end,
        'product_title', v_product.title,
        'product_slug', v_product.slug,
        'image_url', v_product.image_url,
        'variant_name', case
          when v_product.is_serialized then v_variant.name
          else null
        end,
        'variant_code', case
          when v_product.is_serialized then v_variant.code
          else null
        end,
        'variant_sku', case
          when v_product.is_serialized then v_variant.sku
          else null
        end,
        'variant_color_name', case
          when v_product.is_serialized then v_variant.color_name
          else null
        end,
        'variant_color_hex', case
          when v_product.is_serialized then v_variant.color_hex
          else null
        end,
        'is_serialized', v_product.is_serialized,
        'primary_warehouse_id', v_product.primary_warehouse_id,
        'unit_cost', coalesce(
          case
            when v_product.is_serialized then v_variant.cost_price
            else v_product.cost_price
          end,
          0
        ),
        'unit_price', v_unit_price,
        'quantity', v_quantity,
        'line_total', v_line_total
      )
    );
  end loop;

  v_coupon_code := upper(nullif(btrim(p_order ->> 'coupon_code'), ''));

  if v_coupon_code is not null then
    select coupons.*
    into v_coupon
    from public.site_coupons as coupons
    where upper(coupons.code) = v_coupon_code
    for update;

    if not found
      or not v_coupon.is_active
      or (v_coupon.starts_at is not null and v_coupon.starts_at > now())
      or (v_coupon.ends_at is not null and v_coupon.ends_at < now())
      or v_subtotal < v_coupon.minimum_order_amount
      or (
        v_coupon.usage_limit is not null
        and v_coupon.usage_count >= v_coupon.usage_limit
      )
    then
      raise exception 'The coupon is no longer valid for this order.';
    end if;

    if v_coupon.discount_type = 'percentage' then
      v_discount := least(
        v_subtotal,
        round(
          (v_subtotal * v_coupon.discount_value / 100)::numeric,
          2
        )
      );
    else
      v_discount := least(
        v_subtotal,
        round(v_coupon.discount_value::numeric, 2)
      );
    end if;
  end if;

  v_total := round(greatest(v_subtotal - v_discount, 0)::numeric, 2);
  v_order_number := coalesce(
    nullif(btrim(p_order ->> 'order_number'), ''),
    'ORD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 18))
  );

  insert into public.customer_orders (
    user_id,
    checkout_cart_id,
    order_number,
    status,
    first_name,
    last_name,
    email,
    phone,
    street_address,
    city,
    governorate,
    shipping_method,
    payment_method,
    subtotal_amount,
    discount_amount,
    coupon_code,
    total_amount,
    currency,
    updated_at
  )
  values (
    p_user_id,
    p_cart_id,
    v_order_number,
    'pending_payment',
    btrim(p_order ->> 'first_name'),
    nullif(btrim(p_order ->> 'last_name'), ''),
    nullif(btrim(p_order ->> 'email'), ''),
    btrim(p_order ->> 'phone'),
    btrim(p_order ->> 'street_address'),
    btrim(p_order ->> 'city'),
    btrim(p_order ->> 'governorate'),
    nullif(btrim(p_order ->> 'shipping_method'), ''),
    nullif(btrim(p_order ->> 'payment_method'), ''),
    v_subtotal,
    v_discount,
    case when v_coupon_code is not null then v_coupon.code else null end,
    v_total,
    coalesce(nullif(btrim(p_order ->> 'currency'), ''), 'EGP'),
    now()
  )
  returning * into v_order;

  perform set_config('app.serialized_inventory_write', 'on', true);

  for v_item in
    select item_rows.value
    from jsonb_array_elements(v_normalized_items) as item_rows(value)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_variant_id := nullif(v_item ->> 'variant_id', '')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    v_unit_price := (v_item ->> 'unit_price')::numeric;
    v_line_total := (v_item ->> 'line_total')::numeric;

    insert into public.customer_order_items (
      order_id,
      product_id,
      variant_id,
      product_title,
      product_slug,
      image_url,
      variant_name,
      variant_code,
      variant_sku,
      variant_color_name,
      variant_color_hex,
      unit_price,
      quantity,
      line_total
    )
    values (
      v_order.id,
      v_product_id,
      v_variant_id,
      v_item ->> 'product_title',
      nullif(v_item ->> 'product_slug', ''),
      nullif(v_item ->> 'image_url', ''),
      nullif(v_item ->> 'variant_name', ''),
      nullif(v_item ->> 'variant_code', ''),
      nullif(v_item ->> 'variant_sku', ''),
      nullif(v_item ->> 'variant_color_name', ''),
      nullif(v_item ->> 'variant_color_hex', ''),
      v_unit_price,
      v_quantity,
      v_line_total
    )
    returning * into v_order_item;

    if (v_item ->> 'is_serialized')::boolean then
      v_assigned_units := 0;

      for v_unit in
        select units.*
        from public.commerce_serialized_units as units
        where units.product_id = v_product_id
          and units.variant_id = v_variant_id
          and units.warehouse_id =
            (v_item ->> 'primary_warehouse_id')::uuid
          and units.status = 'in_stock'
        order by units.created_at, units.id
        limit v_quantity
        for update
      loop
        update public.commerce_serialized_units
        set
          status = 'sold',
          customer_order_id = v_order.id,
          customer_order_item_id = v_order_item.id,
          customer_user_id = p_user_id,
          sold_at = now(),
          returned_at = null,
          updated_at = now()
        where id = v_unit.id;

        insert into public.commerce_serialized_unit_movements (
          unit_id,
          product_id,
          variant_id,
          warehouse_id,
          customer_order_id,
          movement_type,
          from_status,
          to_status,
          notes
        )
        values (
          v_unit.id,
          v_product_id,
          v_variant_id,
          (v_item ->> 'primary_warehouse_id')::uuid,
          v_order.id,
          'sold',
          'in_stock',
          'sold',
          'Assigned during atomic online checkout.'
        );

        v_assigned_units := v_assigned_units + 1;
      end loop;

      if v_assigned_units <> v_quantity then
        raise exception
          'Not enough serialized units remained available during checkout.';
      end if;

      update public.product_variants
      set
        stock_quantity = stock_quantity - v_quantity,
        updated_at = now()
      where id = v_variant_id
        and stock_quantity >= v_quantity;

      get diagnostics v_updated_rows = row_count;
      if v_updated_rows <> 1 then
        raise exception 'Serialized variant stock is inconsistent.';
      end if;

      update public.products
      set stock_quantity = stock_quantity - v_quantity
      where id = v_product_id
        and stock_quantity >= v_quantity;

      get diagnostics v_updated_rows = row_count;
      if v_updated_rows <> 1 then
        raise exception 'Serialized product stock is inconsistent.';
      end if;

      update public.commerce_warehouse_inventory
      set
        quantity = quantity - v_quantity,
        updated_at = now()
      where warehouse_id = (v_item ->> 'primary_warehouse_id')::uuid
        and product_id = v_product_id
        and quantity >= v_quantity
      returning quantity into v_warehouse_quantity;

      if not found then
        raise exception 'Serialized warehouse stock is inconsistent.';
      end if;

      v_total_assigned_units := v_total_assigned_units + v_assigned_units;
    else
      if coalesce(p_allow_out_of_stock, false) then
        update public.products
        set stock_quantity = greatest(stock_quantity - v_quantity, 0)
        where id = v_product_id;
      else
        update public.products
        set stock_quantity = stock_quantity - v_quantity
        where id = v_product_id
          and stock_quantity >= v_quantity;

        get diagnostics v_updated_rows = row_count;
        if v_updated_rows <> 1 then
          raise exception 'One or more products no longer have enough stock.';
        end if;
      end if;

      v_has_warehouse_inventory := false;
      v_warehouse_quantity := null;

      if nullif(v_item ->> 'primary_warehouse_id', '') is not null then
        select true
        into v_has_warehouse_inventory
        from public.commerce_warehouse_inventory as inventory
        where inventory.warehouse_id =
            (v_item ->> 'primary_warehouse_id')::uuid
          and inventory.product_id = v_product_id
        for update;

        if v_has_warehouse_inventory then
          if coalesce(p_allow_out_of_stock, false) then
            update public.commerce_warehouse_inventory
            set
              quantity = greatest(quantity - v_quantity, 0),
              updated_at = now()
            where warehouse_id =
                (v_item ->> 'primary_warehouse_id')::uuid
              and product_id = v_product_id
            returning quantity into v_warehouse_quantity;
          else
            update public.commerce_warehouse_inventory
            set
              quantity = quantity - v_quantity,
              updated_at = now()
            where warehouse_id =
                (v_item ->> 'primary_warehouse_id')::uuid
              and product_id = v_product_id
              and quantity >= v_quantity
            returning quantity into v_warehouse_quantity;

            if not found then
              raise exception 'The primary warehouse does not have enough stock.';
            end if;
          end if;
        elsif coalesce(p_allow_out_of_stock, false) then
          insert into public.commerce_warehouse_inventory (
            warehouse_id,
            product_id,
            quantity,
            average_cost,
            updated_at
          )
          values (
            (v_item ->> 'primary_warehouse_id')::uuid,
            v_product_id,
            0,
            coalesce((v_item ->> 'unit_cost')::numeric, 0),
            now()
          )
          on conflict (warehouse_id, product_id)
          do update
          set updated_at = excluded.updated_at
          returning quantity into v_warehouse_quantity;
        else
          raise exception
            'The primary warehouse inventory row is missing for one of the products.';
        end if;
      end if;
    end if;

    if nullif(v_item ->> 'primary_warehouse_id', '') is not null
      and v_warehouse_quantity is not null
    then
      insert into public.commerce_inventory_movements (
        warehouse_id,
        product_id,
        movement_type,
        reference_type,
        reference_id,
        quantity_change,
        quantity_after,
        unit_cost,
        notes
      )
      values (
        (v_item ->> 'primary_warehouse_id')::uuid,
        v_product_id,
        'sale_out',
        'manual',
        v_order.id,
        -v_quantity,
        v_warehouse_quantity,
        coalesce((v_item ->> 'unit_cost')::numeric, 0),
        'Atomic online checkout.'
      );
    end if;
  end loop;

  if v_coupon_code is not null then
    update public.site_coupons
    set
      usage_count = usage_count + 1,
      updated_at = now()
    where id = v_coupon.id;
  end if;

  return jsonb_build_object(
    'order', to_jsonb(v_order),
    'created', true,
    'serialized_units_assigned', v_total_assigned_units
  );
end;
$$;


--
-- Name: commerce_create_order_return(uuid, uuid, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_create_order_return(p_order_id uuid, p_warehouse_id uuid, p_reason text, p_notes text, p_items jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare rid uuid; row jsonb; item public.customer_order_items%rowtype; qty integer; previous integer; total integer:=0;
begin
  perform 1 from public.site_settings where key='default' for share;
  if public.get_active_erp_mode()='built_in' then
    return public.commerce_create_builtin_order_return(p_order_id,p_warehouse_id,p_reason,p_notes,p_items);
  end if;
  if not public.is_active_admin() then raise exception 'Not authorized'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Valid return items are required.'; end if;
  insert into public.commerce_order_returns(order_id,warehouse_id,reason,notes,created_by,erp_provider,erp_action_status)
    values(p_order_id,p_warehouse_id,p_reason,p_notes,auth.uid(),'daftra','manual_required') returning id into rid;
  for row in select value from jsonb_array_elements(p_items) loop
    qty:=(row->>'quantity')::integer;
    select * into item from public.customer_order_items where id=(row->>'order_item_id')::uuid and order_id=p_order_id for update;
    if not found or qty is null or qty<1 then raise exception 'Invalid return item.'; end if;
    select coalesce(sum(i.quantity),0) into previous from public.commerce_order_return_items i
      join public.commerce_order_returns r on r.id=i.order_return_id where r.order_id=p_order_id and i.order_item_id=item.id;
    if qty+previous>item.quantity then raise exception 'Returned quantity exceeds the order quantity.'; end if;
    insert into public.commerce_order_return_items(order_return_id,order_item_id,product_id,quantity,unit_price)
      values(rid,item.id,item.product_id,qty,item.unit_price);
    total:=total+qty;
  end loop;
  update public.commerce_order_returns set total_items=total where id=rid;
  return rid;
end;
$$;


--
-- Name: commerce_create_preorder(uuid, jsonb, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_create_preorder(p_user_id uuid, p_order jsonb, p_items jsonb, p_cart_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare result jsonb; previous text := coalesce(current_setting('app.warranty_purchase_capture', true), '');
begin
  perform set_config('app.warranty_purchase_capture', 'on', true);
  result := public.commerce_create_preorder_before_warranty(p_user_id, p_order, p_items, p_cart_id);
  perform set_config('app.warranty_purchase_capture', previous, true);
  return result;
end $$;


--
-- Name: commerce_create_preorder_before_order_sms(uuid, jsonb, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_create_preorder_before_order_sms(p_user_id uuid, p_order jsonb, p_items jsonb, p_cart_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_existing public.customer_orders%rowtype;
  v_order public.customer_orders%rowtype;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_item jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_requested integer;
  v_reserved integer;
  v_subtotal numeric(12,2) := 0;
  v_due numeric(12,2) := 0;
  v_line_total numeric(12,2);
  v_line_due numeric(12,2);
begin
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'A valid signed-in customer is required.';
  end if;
  if p_cart_id is null then raise exception 'A valid cart ID is required.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text || ':' || p_cart_id::text, 0));
  select * into v_existing from public.customer_orders
  where user_id = p_user_id and checkout_cart_id = p_cart_id;
  if found then return jsonb_build_object('order', to_jsonb(v_existing), 'created', false); end if;
  if p_order is null or jsonb_typeof(p_order) <> 'object'
    or p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    raise exception 'A valid order and cart are required.';
  end if;
  if nullif(btrim(p_order ->> 'first_name'), '') is null
    or nullif(btrim(p_order ->> 'phone'), '') is null
    or nullif(btrim(p_order ->> 'street_address'), '') is null
    or nullif(btrim(p_order ->> 'city'), '') is null
    or nullif(btrim(p_order ->> 'governorate'), '') is null then
    raise exception 'Complete customer and delivery details are required.';
  end if;
  if nullif(btrim(p_order ->> 'coupon_code'), '') is not null then
    raise exception 'Coupons are not available for preorders.';
  end if;
  if coalesce(p_order ->> 'payment_method', '') not in ('bank_transfer', 'instapay') then
    raise exception 'Choose bank transfer or InstaPay for a preorder.';
  end if;

  -- Lock each product in stable order; both allocation and customer limits are
  -- checked while the same row lock is held for every concurrent checkout.
  for v_product in
    select products.* from public.products as products
    where products.id in (
      select (item.value ->> 'product_id')::uuid
      from jsonb_array_elements(p_items) as item(value)
    ) order by products.id for update
  loop
    if not v_product.is_published or v_product.selling_mode <> 'preorder'
      or not v_product.preorder_active then
      raise exception 'One or more products are not open for preorder.';
    end if;
    if v_product.preorder_starts_at is not null and now() < v_product.preorder_starts_at then
      raise exception 'This preorder has not opened yet.';
    end if;
    if v_product.preorder_ends_at is not null and now() >= v_product.preorder_ends_at then
      raise exception 'This preorder has closed.';
    end if;
    select coalesce(sum((item.value ->> 'quantity')::integer), 0)::integer
      into v_requested from jsonb_array_elements(p_items) as item(value)
      where (item.value ->> 'product_id')::uuid = v_product.id;
    if v_requested < 1 or (v_product.preorder_customer_limit is not null and v_requested > v_product.preorder_customer_limit) then
      raise exception 'This preorder exceeds the customer quantity limit.';
    end if;
    select coalesce(sum(items.quantity), 0)::integer into v_reserved
    from public.customer_order_items as items
    join public.customer_orders as orders on orders.id = items.order_id
    where items.product_id = v_product.id and items.is_preorder
      and orders.status not in ('cancelled', 'refunded');
    if v_product.preorder_total_limit is not null and v_reserved + v_requested > v_product.preorder_total_limit then
      raise exception 'This preorder allocation is sold out.';
    end if;
    if v_product.preorder_customer_limit is not null then
      select coalesce(sum(items.quantity), 0)::integer into v_reserved
      from public.customer_order_items as items
      join public.customer_orders as orders on orders.id = items.order_id
      where items.product_id = v_product.id and items.is_preorder
        and orders.user_id = p_user_id and orders.status not in ('cancelled', 'refunded');
      if v_reserved + v_requested > v_product.preorder_customer_limit then
        raise exception 'This preorder exceeds your quantity limit.';
      end if;
    end if;
  end loop;

  for v_item in select item.value from jsonb_array_elements(p_items) as item(value)
    order by item.value ->> 'product_id', coalesce(item.value ->> 'variant_id', '')
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_variant_id := nullif(v_item ->> 'variant_id', '')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity is null or v_quantity < 1 or v_quantity > 99 then raise exception 'Invalid preorder quantity.'; end if;
    select * into v_product from public.products where id = v_product_id;
    if not found or v_product.selling_mode <> 'preorder' then
      raise exception 'The product is not available for preorder.';
    end if;
    if v_product.is_serialized then
      if v_variant_id is null then raise exception 'Select a product option.'; end if;
      select * into v_variant from public.product_variants
      where id = v_variant_id and product_id = v_product_id and is_active;
      if not found then raise exception 'The selected product option is unavailable.'; end if;
    elsif v_variant_id is not null then
      raise exception 'This product has no selectable option.';
    end if;
    -- Existing catalog variants have no independent sale price. Parent price
    -- is authoritative for the chosen variant, as in normal checkout.
    v_line_total := round(v_product.price::numeric, 2) * v_quantity;
    v_line_due := case when v_product.preorder_payment_mode = 'deposit'
      then round(v_line_total * v_product.preorder_deposit_percent / 100, 2)
      else v_line_total end;
    v_subtotal := v_subtotal + v_line_total;
    v_due := v_due + v_line_due;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id, 'variant_id', v_variant_id,
      'product_title', v_product.title, 'product_slug', v_product.slug,
      'image_url', v_product.image_url,
      'variant_name', case when v_product.is_serialized then v_variant.name else null end,
      'variant_code', case when v_product.is_serialized then v_variant.code else null end,
      'variant_sku', case when v_product.is_serialized then v_variant.sku else null end,
      'variant_color_name', case when v_product.is_serialized then v_variant.color_name else null end,
      'variant_color_hex', case when v_product.is_serialized then v_variant.color_hex else null end,
      'unit_price', round(v_product.price::numeric, 2), 'quantity', v_quantity,
      'line_total', v_line_total, 'initial_amount_due', v_line_due,
      'preorder_payment_mode', v_product.preorder_payment_mode,
      'preorder_deposit_percent', v_product.preorder_deposit_percent,
      'expected_availability_date', v_product.expected_availability_date,
      'availability_message', v_product.availability_message
    ));
  end loop;

  insert into public.customer_orders (
    user_id, checkout_cart_id, order_number, status,
    first_name, last_name, email, phone, street_address, city, governorate,
    shipping_method, payment_method, subtotal_amount, total_amount, currency,
    is_preorder, initial_amount_due, amount_paid, preorder_fulfillment_state, updated_at
  ) values (
    p_user_id, p_cart_id, coalesce(nullif(btrim(p_order ->> 'order_number'), ''),
      'ORD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 18))), 'on_hold',
    btrim(p_order ->> 'first_name'), nullif(btrim(p_order ->> 'last_name'), ''),
    nullif(btrim(p_order ->> 'email'), ''), btrim(p_order ->> 'phone'),
    btrim(p_order ->> 'street_address'), btrim(p_order ->> 'city'),
    btrim(p_order ->> 'governorate'), nullif(btrim(p_order ->> 'shipping_method'), ''),
    p_order ->> 'payment_method', v_subtotal, v_subtotal, 'EGP',
    true, v_due, 0, 'awaiting_stock', now()
  ) returning * into v_order;

  for v_item in select value from jsonb_array_elements(v_lines)
  loop
    insert into public.customer_order_items (
      order_id, product_id, variant_id, product_title, product_slug, image_url,
      variant_name, variant_code, variant_sku, variant_color_name, variant_color_hex,
      unit_price, quantity, line_total, is_preorder, preorder_payment_mode,
      preorder_deposit_percent, expected_availability_date, availability_message,
      initial_amount_due
    ) values (
      v_order.id, (v_item ->> 'product_id')::uuid,
      nullif(v_item ->> 'variant_id', '')::uuid,
      v_item ->> 'product_title', v_item ->> 'product_slug', v_item ->> 'image_url',
      v_item ->> 'variant_name', v_item ->> 'variant_code', v_item ->> 'variant_sku',
      v_item ->> 'variant_color_name', v_item ->> 'variant_color_hex',
      (v_item ->> 'unit_price')::numeric, (v_item ->> 'quantity')::integer,
      (v_item ->> 'line_total')::numeric, true, v_item ->> 'preorder_payment_mode',
      nullif(v_item ->> 'preorder_deposit_percent', '')::numeric,
      nullif(v_item ->> 'expected_availability_date', '')::date,
      v_item ->> 'availability_message', (v_item ->> 'initial_amount_due')::numeric
    );
  end loop;
  return jsonb_build_object('order', to_jsonb(v_order), 'created', true);
end;
$$;


--
-- Name: commerce_create_preorder_before_warranty(uuid, jsonb, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_create_preorder_before_warranty(p_user_id uuid, p_order jsonb, p_items jsonb, p_cart_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare result jsonb; previous text:=coalesce(current_setting('app.order_sms_locale',true),'');
begin
  perform set_config('app.order_sms_locale',case when p_order->>'locale'='ar' then 'ar' else 'en' end,true);
  result:=public.commerce_create_preorder_before_order_sms(p_user_id,p_order,p_items,p_cart_id);
  perform set_config('app.order_sms_locale',previous,true);
  return result;
end $$;


--
-- Name: commerce_create_procurement_order(uuid, uuid, text, text, numeric, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_create_procurement_order(p_supplier_id uuid, p_warehouse_id uuid, p_invoice_number text, p_notes text, p_paid_amount numeric, p_items jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_admin_id uuid := auth.uid();
  v_existing_order public.commerce_procurement_orders%rowtype;
  v_procurement_id uuid;
  v_procurement_item_id uuid;
  v_batch_id uuid;
  v_item jsonb;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_inventory public.commerce_warehouse_inventory%rowtype;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_unit_cost numeric(12, 2);
  v_line_total numeric(12, 2);
  v_total_cost numeric(12, 2) := 0;
  v_next_product_quantity integer;
  v_next_variant_quantity integer;
  v_next_warehouse_quantity integer;
  v_next_product_cost numeric(12, 2);
  v_next_variant_cost numeric(12, 2);
  v_next_warehouse_cost numeric(12, 2);
  v_inventory_exists boolean;
  v_invoice_number text;
  v_receipt_key text;
  v_payload_hash text;
  v_total_received_units bigint;
begin
  perform public.assert_built_in_erp();
  if not public.is_active_admin() then
    raise exception 'Not authorized';
  end if;

  if p_supplier_id is null or not exists (
    select 1
    from public.commerce_crm_accounts as accounts
    where accounts.id = p_supplier_id
      and accounts.account_type = 'supplier'
      and accounts.is_active
  ) then
    raise exception 'A valid active supplier is required.';
  end if;

  if p_warehouse_id is null or not exists (
    select 1
    from public.commerce_warehouses as warehouses
    where warehouses.id = p_warehouse_id
      and warehouses.is_active
  ) then
    raise exception 'A valid active warehouse is required.';
  end if;

  v_invoice_number := nullif(btrim(p_invoice_number), '');

  if v_invoice_number is null then
    raise exception
      'An invoice or procurement reference is required to prevent duplicate receipts.';
  end if;

  if char_length(v_invoice_number) > 160 then
    raise exception 'The invoice or procurement reference cannot exceed 160 characters.';
  end if;

  if p_items is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0
  then
    raise exception 'At least one procurement item is required.';
  end if;

  if jsonb_array_length(p_items) > 100 then
    raise exception 'A procurement order cannot contain more than 100 lines.';
  end if;

  if lower(coalesce(p_paid_amount, 0)::text) in (
    'nan',
    'infinity',
    '-infinity'
  ) or coalesce(p_paid_amount, 0) < 0 then
    raise exception 'Paid amount must be a finite, non-negative number.';
  end if;

  select coalesce(
    sum(
      greatest(
        coalesce((rows.value ->> 'quantity')::bigint, 0),
        0
      )
    ),
    0
  )
  into v_total_received_units
  from jsonb_array_elements(p_items) as rows(value);

  if v_total_received_units > 10000 then
    raise exception
      'A procurement order cannot receive more than 10,000 physical units.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as rows(value)
    group by
      rows.value ->> 'product_id',
      rows.value ->> 'variant_id'
    having count(*) > 1
  ) then
    raise exception
      'The same product variant cannot be repeated on one procurement order.';
  end if;

  v_receipt_key := lower(p_supplier_id::text) || ':' || lower(v_invoice_number);
  v_payload_hash := md5(
    jsonb_build_object(
      'supplier_id', p_supplier_id,
      'warehouse_id', p_warehouse_id,
      'invoice_number', lower(v_invoice_number),
      'notes', nullif(btrim(p_notes), ''),
      'paid_amount', round(coalesce(p_paid_amount, 0), 2),
      'items', p_items
    )::text
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_receipt_key, 0)
  );

  select orders.*
  into v_existing_order
  from public.commerce_procurement_orders as orders
  where orders.receipt_key = v_receipt_key
  limit 1;

  if found then
    if v_existing_order.receipt_payload_hash = v_payload_hash then
      return v_existing_order.id;
    end if;

    raise exception
      'This supplier invoice/reference was already received with different details.';
  end if;

  if exists (
    select 1
    from public.commerce_procurement_orders as orders
    where orders.supplier_id = p_supplier_id
      and lower(btrim(orders.invoice_number)) = lower(v_invoice_number)
      and orders.receipt_key is null
  ) then
    raise exception
      'This supplier invoice/reference already exists in procurement history.';
  end if;

  insert into public.commerce_procurement_orders (
    supplier_id,
    warehouse_id,
    invoice_number,
    notes,
    total_cost,
    paid_amount,
    receipt_key,
    receipt_payload_hash,
    created_by
  )
  values (
    p_supplier_id,
    p_warehouse_id,
    v_invoice_number,
    nullif(btrim(p_notes), ''),
    0,
    0,
    v_receipt_key,
    v_payload_hash,
    v_admin_id
  )
  returning id into v_procurement_id;

  perform set_config('app.serialized_inventory_write', 'on', true);

  for v_item in
    select rows.value
    from jsonb_array_elements(p_items) as rows(value)
    order by
      rows.value ->> 'product_id',
      rows.value ->> 'variant_id'
  loop
    v_product_id := nullif(btrim(v_item ->> 'product_id'), '')::uuid;
    v_variant_id := nullif(btrim(v_item ->> 'variant_id'), '')::uuid;
    v_quantity := coalesce((v_item ->> 'quantity')::integer, 0);
    v_unit_cost := round(coalesce((v_item ->> 'unit_cost')::numeric, 0), 2);

    if v_product_id is null
      or v_variant_id is null
      or v_quantity < 1
      or v_quantity > 1000
      or lower(v_unit_cost::text) in ('nan', 'infinity', '-infinity')
      or v_unit_cost < 0
    then
      raise exception
        'Every procurement line requires a product, variant, quantity from 1 to 1,000, and non-negative unit cost.';
    end if;

    select products.*
    into v_product
    from public.products as products
    where products.id = v_product_id
    for update;

    if not found then
      raise exception 'One of the selected products no longer exists.';
    end if;

    if not v_product.is_serialized then
      raise exception
        'This legacy product has untracked aggregate stock. Reconcile it before receiving new physical items.';
    end if;

    if v_product.primary_warehouse_id is null
      or v_product.primary_warehouse_id <> p_warehouse_id
    then
      raise exception
        'Every product must be received into its configured primary warehouse.';
    end if;

    select variants.*
    into v_variant
    from public.product_variants as variants
    where variants.id = v_variant_id
      and variants.product_id = v_product_id
      and variants.is_active
    for update;

    if not found then
      raise exception
        'One of the selected variants is inactive or does not belong to its product.';
    end if;

    v_line_total := round((v_quantity * v_unit_cost)::numeric, 2);
    v_total_cost := round((v_total_cost + v_line_total)::numeric, 2);

    insert into public.commerce_procurement_items (
      procurement_order_id,
      product_id,
      variant_id,
      quantity,
      received_quantity,
      unit_cost,
      line_total
    )
    values (
      v_procurement_id,
      v_product_id,
      v_variant_id,
      v_quantity,
      v_quantity,
      v_unit_cost,
      v_line_total
    )
    returning id into v_procurement_item_id;

    v_batch_id := gen_random_uuid();

    insert into public.commerce_serialized_inventory_batches (
      id,
      product_id,
      warehouse_id,
      procurement_order_id,
      procurement_item_id,
      created_count,
      variant_count,
      notes,
      created_by
    )
    values (
      v_batch_id,
      v_product_id,
      p_warehouse_id,
      v_procurement_id,
      v_procurement_item_id,
      v_quantity,
      1,
      nullif(btrim(p_notes), ''),
      v_admin_id
    );

    with unit_numbers as materialized (
      select nextval(
        'public.commerce_serialized_unit_code_seq'::regclass
      ) as unit_number
      from generate_series(1, v_quantity)
    ),
    inserted_units as (
      insert into public.commerce_serialized_units (
        batch_id,
        unit_code,
        product_id,
        variant_id,
        warehouse_id,
        status,
        unit_cost,
        procurement_order_id,
        procurement_item_id,
        created_by
      )
      select
        v_batch_id,
        format(
          'ELC-%s-%s-%s',
          coalesce(
            nullif(
              regexp_replace(
                upper(coalesce(v_product.sku, '')),
                '[^A-Z0-9_-]',
                '',
                'g'
              ),
              ''
            ),
            upper(substr(replace(v_product.id::text, '-', ''), 1, 8))
          ),
          regexp_replace(upper(v_variant.code), '[^A-Z0-9_-]', '', 'g'),
          lpad(unit_numbers.unit_number::text, 10, '0')
        ),
        v_product_id,
        v_variant_id,
        p_warehouse_id,
        'in_stock',
        v_unit_cost,
        v_procurement_id,
        v_procurement_item_id,
        v_admin_id
      from unit_numbers
      returning id
    )
      insert into public.commerce_serialized_unit_movements (
        unit_id,
        product_id,
        variant_id,
        warehouse_id,
        procurement_order_id,
        procurement_item_id,
        actor_admin_id,
        movement_type,
        from_status,
        to_status,
        notes
      )
      select
        inserted_units.id,
        v_product_id,
        v_variant_id,
        p_warehouse_id,
        v_procurement_id,
        v_procurement_item_id,
        v_admin_id,
        'received',
        null,
        'in_stock',
        concat_ws(
          ' — ',
          'Received through Procurement ' || v_invoice_number,
          nullif(btrim(p_notes), '')
        )
      from inserted_units;

    v_next_variant_quantity :=
      coalesce(v_variant.stock_quantity, 0) + v_quantity;
    v_next_variant_cost := round(
      (
        (
          coalesce(v_variant.cost_price, 0)
          * greatest(coalesce(v_variant.stock_quantity, 0), 0)
        )
        + (v_unit_cost * v_quantity)
      ) / v_next_variant_quantity,
      2
    );

    update public.product_variants
    set
      stock_quantity = v_next_variant_quantity,
      cost_price = v_next_variant_cost,
      updated_at = now()
    where id = v_variant_id;

    v_next_product_quantity :=
      coalesce(v_product.stock_quantity, 0) + v_quantity;
    v_next_product_cost := round(
      (
        (
          coalesce(v_product.cost_price, 0)
          * greatest(coalesce(v_product.stock_quantity, 0), 0)
        )
        + (v_unit_cost * v_quantity)
      ) / v_next_product_quantity,
      2
    );

    update public.products
    set
      stock_quantity = v_next_product_quantity,
      cost_price = v_next_product_cost
    where id = v_product_id;

    select inventory.*
    into v_inventory
    from public.commerce_warehouse_inventory as inventory
    where inventory.warehouse_id = p_warehouse_id
      and inventory.product_id = v_product_id
    for update;

    v_inventory_exists := found;

    if v_inventory_exists then
      v_next_warehouse_quantity :=
        coalesce(v_inventory.quantity, 0) + v_quantity;
      v_next_warehouse_cost := round(
        (
          (
            coalesce(v_inventory.average_cost, 0)
            * greatest(coalesce(v_inventory.quantity, 0), 0)
          )
          + (v_unit_cost * v_quantity)
        ) / v_next_warehouse_quantity,
        2
      );

      update public.commerce_warehouse_inventory
      set
        quantity = v_next_warehouse_quantity,
        average_cost = v_next_warehouse_cost,
        updated_at = now()
      where id = v_inventory.id;
    else
      v_next_warehouse_quantity := v_quantity;
      v_next_warehouse_cost := v_unit_cost;

      insert into public.commerce_warehouse_inventory (
        warehouse_id,
        product_id,
        quantity,
        average_cost,
        updated_at
      )
      values (
        p_warehouse_id,
        v_product_id,
        v_quantity,
        v_unit_cost,
        now()
      );
    end if;

    insert into public.commerce_inventory_movements (
      warehouse_id,
      product_id,
      movement_type,
      reference_type,
      reference_id,
      quantity_change,
      quantity_after,
      unit_cost,
      notes,
      created_by
    )
    values (
      p_warehouse_id,
      v_product_id,
      'procurement',
      'procurement_order',
      v_procurement_id,
      v_quantity,
      v_next_warehouse_quantity,
      v_unit_cost,
      concat_ws(
        ' — ',
        v_variant.name,
        nullif(btrim(p_notes), '')
      ),
      v_admin_id
    );
  end loop;

  if round(coalesce(p_paid_amount, 0), 2) > v_total_cost then
    raise exception 'Paid amount cannot be greater than the procurement total.';
  end if;

  update public.commerce_procurement_orders
  set
    total_cost = v_total_cost,
    paid_amount = round(coalesce(p_paid_amount, 0), 2),
    updated_at = now()
  where id = v_procurement_id;

  return v_procurement_id;
end;
$$;


--
-- Name: commerce_create_sales_order(uuid, uuid, text, text, numeric, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_create_sales_order(p_customer_id uuid, p_warehouse_id uuid, p_order_number text, p_notes text, p_paid_amount numeric, p_items jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_sales_order_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_unit_price numeric (12, 2);
  v_line_total numeric (12, 2);
  v_total_amount numeric (12, 2) := 0;
  v_product_record public.products%rowtype;
  v_inventory_record public.commerce_warehouse_inventory%rowtype;
  v_next_product_stock integer;
  v_next_inventory_quantity integer;
begin
  perform public.assert_built_in_erp();
  if not public.is_active_admin () then
    raise exception 'Not authorized';
  end if;

  if p_customer_id is null or not exists (
    select 1
    from public.commerce_crm_accounts
    where id = p_customer_id
      and account_type = 'customer'
      and is_active = true
  ) then
    raise exception 'A valid CRM customer is required.';
  end if;

  if p_warehouse_id is null or not exists (
    select 1
    from public.commerce_warehouses
    where id = p_warehouse_id
      and is_active = true
  ) then
    raise exception 'A valid warehouse is required.';
  end if;

  if jsonb_typeof (p_items) <> 'array' or jsonb_array_length (p_items) = 0 then
    raise exception 'At least one sales item is required.';
  end if;

  if coalesce(p_paid_amount, 0) < 0 then
    raise exception 'Paid amount cannot be negative.';
  end if;

  insert into public.commerce_sales_orders (
    customer_id,
    warehouse_id,
    order_number,
    notes,
    total_amount,
    paid_amount,
    created_by
  )
  values (
    p_customer_id,
    p_warehouse_id,
    nullif(trim(p_order_number), ''),
    nullif(trim(p_notes), ''),
    0,
    0,
    auth.uid ()
  )
  returning id into v_sales_order_id;

  for v_item in
    select value
    from jsonb_array_elements (p_items)
  loop
    v_product_id := nullif(v_item ->> 'product_id', '')::uuid;
    v_quantity := coalesce((v_item ->> 'quantity')::integer, 0);
    v_unit_price := round(coalesce((v_item ->> 'unit_price')::numeric, 0), 2);

    if v_product_id is null or v_quantity <= 0 or v_unit_price < 0 then
      raise exception 'Every sales line requires a valid product, quantity, and price.';
    end if;

    select *
    into v_product_record
    from public.products
    where id = v_product_id
    for update;

    if not found then
      raise exception 'One of the selected products no longer exists.';
    end if;

    select *
    into v_inventory_record
    from public.commerce_warehouse_inventory
    where warehouse_id = p_warehouse_id
      and product_id = v_product_id
    for update;

    if not found or coalesce(v_inventory_record.quantity, 0) < v_quantity then
      raise exception 'Insufficient warehouse stock for %.', v_product_record.title;
    end if;

    if coalesce(v_product_record.stock_quantity, 0) < v_quantity then
      raise exception 'Insufficient product stock for %.', v_product_record.title;
    end if;

    v_line_total := round((v_quantity * v_unit_price)::numeric, 2);
    v_total_amount := round((v_total_amount + v_line_total)::numeric, 2);
    v_next_product_stock := coalesce(v_product_record.stock_quantity, 0) - v_quantity;
    v_next_inventory_quantity := coalesce(v_inventory_record.quantity, 0) - v_quantity;

    update public.products
    set stock_quantity = v_next_product_stock
    where id = v_product_id;

    update public.commerce_warehouse_inventory
    set
      quantity = v_next_inventory_quantity,
      updated_at = now()
    where id = v_inventory_record.id;

    insert into public.commerce_sales_items (
      sales_order_id,
      product_id,
      quantity,
      unit_price,
      line_total
    )
    values (
      v_sales_order_id,
      v_product_id,
      v_quantity,
      v_unit_price,
      v_line_total
    );

    insert into public.commerce_inventory_movements (
      warehouse_id,
      product_id,
      movement_type,
      reference_type,
      reference_id,
      quantity_change,
      quantity_after,
      unit_cost,
      notes,
      created_by
    )
    values (
      p_warehouse_id,
      v_product_id,
      'sale_out',
      'sales_order',
      v_sales_order_id,
      -v_quantity,
      v_next_inventory_quantity,
      coalesce(v_inventory_record.average_cost, 0),
      nullif(trim(p_notes), ''),
      auth.uid ()
    );
  end loop;

  if round(coalesce(p_paid_amount, 0), 2) > v_total_amount then
    raise exception 'Paid amount cannot be greater than the sales total.';
  end if;

  update public.commerce_sales_orders
  set
    total_amount = v_total_amount,
    paid_amount = round(coalesce(p_paid_amount, 0), 2),
    updated_at = now()
  where id = v_sales_order_id;

  return v_sales_order_id;
end;
$$;


--
-- Name: commerce_crm_get_activity_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_crm_get_activity_stats() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'calls',
    count(*) filter (where activity_type = 'call'),
    'raisedCases',
    count(*) filter (
      where activity_type = 'case'
        and status = 'raised'
    ),
    'closedCases',
    count(*) filter (
      where activity_type = 'case'
        and status = 'closed'
    )
  )
  from public.commerce_crm_activities;
$$;


--
-- Name: commerce_define_product_variants(uuid, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_define_product_variants(p_product_id uuid, p_variants jsonb, p_admin_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_input jsonb;
  v_variant_id uuid;
  v_variant_name text;
  v_variant_code text;
  v_variant_sku text;
  v_color_name text;
  v_color_hex text;
  v_submitted_ids uuid[] := array[]::uuid[];
  v_resolved_inputs jsonb := '[]'::jsonb;
begin
  if p_admin_id is null or not exists (
    select 1
    from public.admin_users as admins
    where admins.id = p_admin_id
      and admins.is_active
      and (
        admins.role = 'owner'
        or coalesce((admins.permissions ->> 'products.add')::boolean, false)
        or coalesce((admins.permissions ->> 'products.edit')::boolean, false)
      )
  ) then
    raise exception 'Not authorized to define product variants.';
  end if;

  select products.*
  into v_product
  from public.products as products
  where products.id = p_product_id
  for update;

  if not found then
    raise exception 'A valid product is required.';
  end if;

  if not v_product.is_serialized then
    raise exception
      'Legacy aggregate-stock products must be reconciled before variants can be defined.';
  end if;

  if p_variants is null
    or jsonb_typeof(p_variants) <> 'array'
    or jsonb_array_length(p_variants) = 0
  then
    raise exception 'At least one active product variant is required.';
  end if;

  if jsonb_array_length(p_variants) > 100 then
    raise exception 'A product cannot have more than 100 variants.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_variants) as rows(value)
    where rows.value ? 'quantity'
      or rows.value ? 'stock_quantity'
  ) then
    raise exception
      'Variant quantities cannot be defined in the catalog; receive physical items through Procurement.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_variants) as rows(value)
    group by lower(btrim(coalesce(rows.value ->> 'code', '')))
    having count(*) > 1
  ) then
    raise exception 'Every variant code must be unique within the product.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_variants) as rows(value)
    where nullif(btrim(rows.value ->> 'sku'), '') is not null
    group by lower(btrim(rows.value ->> 'sku'))
    having count(*) > 1
  ) then
    raise exception 'Every variant SKU must be unique.';
  end if;

  -- Lock the complete variant set so omission/deactivation cannot race with a
  -- receipt that is selecting one of these references.
  perform variants.id
  from public.product_variants as variants
  where variants.product_id = p_product_id
  order by variants.id
  for update;

  -- Resolve and validate every reference before changing any active state.
  -- Existing rows are identified explicitly by UUID, or by their currently
  -- active code when a new catalog payload has no UUID yet.
  for v_input in
    select rows.value
    from jsonb_array_elements(p_variants) as rows(value)
  loop
    v_variant_id := nullif(btrim(v_input ->> 'id'), '')::uuid;
    v_variant_name := btrim(coalesce(v_input ->> 'name', ''));
    v_variant_code := upper(btrim(coalesce(v_input ->> 'code', '')));
    v_variant_sku := nullif(btrim(v_input ->> 'sku'), '');
    v_color_name := nullif(btrim(v_input ->> 'color_name'), '');
    v_color_hex := nullif(btrim(v_input ->> 'color_hex'), '');

    if v_variant_name = '' or v_variant_code = '' then
      raise exception 'Every variant requires a name and code.';
    end if;

    if v_variant_code !~ '^[A-Z0-9_-]+$' then
      raise exception
        'Variant codes may only contain letters, numbers, underscores, and hyphens.';
    end if;

    if v_color_hex is not null
      and v_color_hex !~ '^#[0-9A-Fa-f]{6}$'
    then
      raise exception 'Variant colors must use a six-digit hex value.';
    end if;

    if v_variant_id is not null then
      select variants.*
      into v_variant
      from public.product_variants as variants
      where variants.id = v_variant_id
        and variants.product_id = p_product_id;

      if not found then
        raise exception 'One of the selected variants does not belong to this product.';
      end if;
    else
      select variants.*
      into v_variant
      from public.product_variants as variants
      where variants.product_id = p_product_id
        and variants.is_active
        and lower(variants.code) = lower(v_variant_code);

      if found then
        v_variant_id := v_variant.id;
      end if;
    end if;

    if v_variant_id is not null then
      if v_variant_id = any(v_submitted_ids) then
        raise exception 'The same variant reference cannot be submitted twice.';
      end if;

      v_submitted_ids := array_append(v_submitted_ids, v_variant_id);
    end if;

    v_resolved_inputs := v_resolved_inputs || jsonb_build_array(
      jsonb_build_object(
        'id', v_variant_id,
        'name', v_variant_name,
        'code', v_variant_code,
        'sku', v_variant_sku,
        'color_name', v_color_name,
        'color_hex', v_color_hex
      )
    );
  end loop;

  if exists (
    select 1
    from public.product_variants as variants
    where variants.product_id = p_product_id
      and variants.is_active
      and not (variants.id = any(v_submitted_ids))
      and exists (
        select 1
        from public.commerce_serialized_units as units
        where units.variant_id = variants.id
      )
  ) then
    raise exception
      'A variant with physical item history cannot be removed from the active catalog.';
  end if;

  -- Two-phase replacement: first make the old reference set inactive, then
  -- apply the final submitted set. The active-only unique indexes make code/SKU
  -- swaps and reuse from an omitted historical variant safe and atomic.
  update public.product_variants
  set
    is_active = false,
    updated_at = now()
  where product_id = p_product_id
    and is_active;

  for v_input in
    select rows.value
    from jsonb_array_elements(v_resolved_inputs) as rows(value)
  loop
    v_variant_id := nullif(btrim(v_input ->> 'id'), '')::uuid;
    v_variant_name := v_input ->> 'name';
    v_variant_code := v_input ->> 'code';
    v_variant_sku := nullif(v_input ->> 'sku', '');
    v_color_name := nullif(v_input ->> 'color_name', '');
    v_color_hex := nullif(v_input ->> 'color_hex', '');

    if v_variant_id is not null then
      update public.product_variants
      set
        name = v_variant_name,
        code = v_variant_code,
        sku = v_variant_sku,
        color_name = v_color_name,
        color_hex = v_color_hex,
        is_active = true,
        updated_at = now()
      where id = v_variant_id
        and product_id = p_product_id
      returning * into v_variant;
    else
      insert into public.product_variants (
        product_id,
        name,
        code,
        sku,
        color_name,
        color_hex,
        price,
        cost_price,
        stock_quantity,
        is_active
      )
      values (
        p_product_id,
        v_variant_name,
        v_variant_code,
        v_variant_sku,
        v_color_name,
        v_color_hex,
        coalesce(v_product.price, 0),
        0,
        0,
        true
      )
      returning * into v_variant;
    end if;
  end loop;

  if not exists (
    select 1
    from public.product_variants as variants
    where variants.product_id = p_product_id
      and variants.is_active
  ) then
    raise exception 'At least one active product variant is required.';
  end if;

  return jsonb_build_object(
    'product_id', p_product_id,
    'active_variant_count', (
      select count(*)::integer
      from public.product_variants as variants
      where variants.product_id = p_product_id
        and variants.is_active
    )
  );
end;
$_$;


--
-- Name: commerce_get_crm_account_summary(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_get_crm_account_summary(p_account_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_account_type text;
  v_order_count bigint := 0;
  v_total_amount numeric (12, 2) := 0;
  v_paid_amount numeric (12, 2) := 0;
begin
  if not public.is_active_admin () then
    raise exception 'Not authorized';
  end if;

  select account_type
  into v_account_type
  from public.commerce_crm_accounts
  where id = p_account_id;

  if not found then
    raise exception 'CRM account not found.';
  end if;

  if v_account_type = 'supplier' then
    select
      count(*),
      coalesce(sum(total_cost), 0),
      coalesce(sum(paid_amount), 0)
    into
      v_order_count,
      v_total_amount,
      v_paid_amount
    from public.commerce_procurement_orders
    where supplier_id = p_account_id;
  else
    select
      count(*),
      coalesce(sum(total_amount), 0),
      coalesce(sum(paid_amount), 0)
    into
      v_order_count,
      v_total_amount,
      v_paid_amount
    from public.commerce_sales_orders
    where customer_id = p_account_id;
  end if;

  return jsonb_build_object(
    'order_count', v_order_count,
    'total_amount', v_total_amount,
    'paid_amount', v_paid_amount,
    'settlement_due', greatest(v_total_amount - v_paid_amount, 0)
  );
end;
$$;


--
-- Name: commerce_guard_inventory_cost_projection(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_guard_inventory_cost_projection() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_is_serialized boolean;
begin
  if current_setting('app.serialized_inventory_write', true) = 'on' then
    return new;
  end if;

  if tg_table_name = 'products' then
    if (
      tg_op = 'INSERT'
      and coalesce(new.cost_price, 0) <> 0
    ) or (
      tg_op = 'UPDATE'
      and new.cost_price is distinct from old.cost_price
    ) then
      raise exception
        'Product cost is calculated from Procurement receipts and cannot be edited in the catalog.';
    end if;

    return new;
  end if;

  if tg_table_name = 'product_variants' then
    if (
      tg_op = 'INSERT'
      and coalesce(new.cost_price, 0) <> 0
    ) or (
      tg_op = 'UPDATE'
      and new.cost_price is distinct from old.cost_price
    ) then
      raise exception
        'Variant cost is calculated from Procurement receipts and cannot be edited in the catalog.';
    end if;

    return new;
  end if;

  select products.is_serialized
  into v_is_serialized
  from public.products as products
  where products.id = new.product_id;

  if coalesce(v_is_serialized, false)
    and (
      (
        tg_op = 'INSERT'
        and coalesce(new.average_cost, 0) <> 0
      )
      or (
        tg_op = 'UPDATE'
        and new.average_cost is distinct from old.average_cost
      )
    )
  then
    raise exception
      'Warehouse average cost is calculated from Procurement receipts.';
  end if;

  return new;
end;
$$;


--
-- Name: commerce_guard_item_warranty(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_guard_item_warranty() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if row(new.warranty_status, new.warranty_duration_value, new.warranty_duration_unit,
      new.warranty_start_basis, new.warranty_snapshot_at)
    is distinct from row(old.warranty_status, old.warranty_duration_value, old.warranty_duration_unit,
      old.warranty_start_basis, old.warranty_snapshot_at) then
    raise exception 'Purchased warranty terms are immutable.';
  end if;
  -- Prevent rebinding an entitlement to another purchase/product/variant.
  -- Existing ON DELETE SET NULL catalog FKs must still detach deleted records;
  -- the purchased terms and identity text remain on the order item.
  if new.id is distinct from old.id or new.order_id is distinct from old.order_id
    or (new.product_id is distinct from old.product_id and new.product_id is not null)
    or (new.variant_id is distinct from old.variant_id and new.variant_id is not null) then
    raise exception 'Purchased warranty identity cannot be reassigned.';
  end if;
  return new;
end $$;


--
-- Name: commerce_guard_received_procurement_order(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_guard_received_procurement_order() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if current_setting('app.serialized_inventory_write', true) = 'on' then
    return new;
  end if;

  if exists (
    select 1
    from public.commerce_procurement_items as items
    where items.procurement_order_id = old.id
      and items.received_quantity > 0
  )
    and (
      new.supplier_id is distinct from old.supplier_id
      or new.warehouse_id is distinct from old.warehouse_id
      or new.invoice_number is distinct from old.invoice_number
      or new.total_cost is distinct from old.total_cost
      or new.receipt_key is distinct from old.receipt_key
      or new.receipt_payload_hash is distinct from old.receipt_payload_hash
    )
  then
    raise exception
      'A received procurement order cannot change its supplier, warehouse, reference, or received total.';
  end if;

  return new;
end;
$$;


--
-- Name: commerce_guard_serialized_procurement_item(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_guard_serialized_procurement_item() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_product_id uuid;
  v_is_serialized boolean;
begin
  if current_setting('app.serialized_inventory_write', true) = 'on' then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  v_product_id := case
    when tg_op = 'DELETE' then old.product_id
    else new.product_id
  end;

  select products.is_serialized
  into v_is_serialized
  from public.products as products
  where products.id = v_product_id;

  if tg_op in ('INSERT', 'UPDATE') and v_is_serialized then
    raise exception
      'Create or change tracked procurement lines only through the Procurement order function.';
  end if;

  if tg_op in ('UPDATE', 'DELETE')
    and old.received_quantity > 0
  then
    raise exception
      'A received procurement line is immutable because physical unit IDs were generated from it.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;


--
-- Name: commerce_keep_image_variant_active(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_keep_image_variant_active() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if exists (
    select 1
    from public.product_images as images
    where images.variant_id = new.id
  )
    and not exists (
      select 1
      from public.product_variants as variants
      where variants.id = new.id
        and variants.is_active
    )
  then
    raise exception
      'Move or delete this variant''s extra images before deactivating it.';
  end if;

  return null;
end;
$$;


--
-- Name: commerce_preorder_availability(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_preorder_availability(p_product_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_product public.products%rowtype; v_reserved integer;
begin
  select * into v_product from public.products
  where id = p_product_id and is_published and selling_mode = 'preorder';
  if not found then return null; end if;
  select coalesce(sum(items.quantity), 0)::integer into v_reserved
  from public.customer_order_items as items
  join public.customer_orders as orders on orders.id = items.order_id
  where items.product_id = p_product_id and items.is_preorder
    and orders.status not in ('cancelled', 'refunded');
  return jsonb_build_object(
    'available', v_product.preorder_active
      and (v_product.preorder_starts_at is null or now() >= v_product.preorder_starts_at)
      and (v_product.preorder_ends_at is null or now() < v_product.preorder_ends_at)
      and (v_product.preorder_total_limit is null or v_reserved < v_product.preorder_total_limit),
    'remaining', case when v_product.preorder_total_limit is null then null
      else greatest(v_product.preorder_total_limit - v_reserved, 0) end,
    'server_time', now()
  );
end;
$$;


--
-- Name: commerce_reconcile_payment_transaction(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_reconcile_payment_transaction(p_transaction jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare v_attempt public.payment_attempts%rowtype; v_order public.customer_orders%rowtype;
  v_existing public.payment_transactions%rowtype; v_status text := p_transaction->>'status';
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Server access required.'; end if;
  if v_status is null or v_status not in ('pending','succeeded','failed') or coalesce(p_transaction->>'mode','') not in ('test','live')
    or coalesce(p_transaction->>'transaction_id','') !~ '^[0-9]{1,18}$' then raise exception 'Invalid transaction.'; end if;
  -- Resolve from HMAC-covered Paymob order ID, never unsigned merchant_order_id/extras.
  select * into v_attempt from public.payment_attempts where provider='paymob' and provider_order_id=p_transaction->>'provider_order_id';
  if not found then raise exception 'Provider order not persisted yet.' using errcode='40001'; end if;
  -- Consistent order-before-attempt locking also serializes cancellation/amount changes.
  select * into v_order from public.customer_orders where id=v_attempt.order_id for update;
  select * into v_attempt from public.payment_attempts where id=v_attempt.id for update;
  if v_attempt.mode is distinct from p_transaction->>'mode' or v_attempt.integration_id is distinct from (p_transaction->>'integration_id')::bigint
    or v_attempt.amount_minor is distinct from (p_transaction->>'amount_minor')::bigint or v_attempt.currency is distinct from p_transaction->>'currency'
    or v_order.total_amount * 100 <> v_attempt.amount_minor or v_order.currency <> v_attempt.currency
    or v_order.payment_method <> 'card' or v_order.is_preorder then raise exception 'Payment context mismatch.'; end if;
  select * into v_existing from public.payment_transactions where provider='paymob' and transaction_id=p_transaction->>'transaction_id';
  if found and v_existing.attempt_id <> v_attempt.id then raise exception 'Transaction belongs to another payment.'; end if;
  insert into public.payment_transactions(attempt_id,provider,transaction_id,status)
    values(v_attempt.id,'paymob',p_transaction->>'transaction_id',v_status)
    on conflict(provider,transaction_id) do update set
      status=case when payment_transactions.status='succeeded' then 'succeeded'
        when excluded.status='pending' and payment_transactions.status='failed' then 'failed' else excluded.status end,
      updated_at=case when payment_transactions.status=excluded.status then payment_transactions.updated_at else now() end
    where payment_transactions.attempt_id=excluded.attempt_id;
  if not found then raise exception 'Transaction belongs to another payment.'; end if;
  if v_attempt.status='succeeded' then return; end if;
  if v_status='pending' and v_attempt.status in ('failed','cancelled','expired') then return; end if;
  update public.payment_attempts set status=v_status,updated_at=now(),
    paid_at=case when v_status='succeeded' then coalesce(paid_at,now()) else paid_at end,
    client_secret=case when v_status='succeeded' then null else client_secret end
    where id=v_attempt.id and status is distinct from v_status;
  -- Dormant LIVE settlement path. Foundation initiation/configuration cannot create live attempts.
  -- Tests exercise this only with isolated database fixtures, never Paymob/network credentials.
  if v_attempt.mode='live' then
    if v_order.status in ('cancelled','refunded') or v_order.payment_status='refunded' then
      update public.payment_attempts set error_code='order_requires_review' where id=v_attempt.id;
      return;
    end if;
    if v_status='succeeded' and v_order.payment_status<>'paid' then
      update public.customer_orders set payment_status='paid',paid_at=coalesce(paid_at,now()),
        amount_paid=total_amount,status=case when status='pending_payment' then 'processing' else status end,updated_at=now()
        where id=v_order.id;
    elsif v_status='failed' and v_order.payment_status='pending' then
      update public.customer_orders set payment_status='failed',updated_at=now() where id=v_order.id;
    end if;
  end if;
  -- TEST signals NEVER mark commerce orders paid, move status or trigger shipping/fulfillment.
end;
$_$;


--
-- Name: commerce_record_preorder_payment(uuid, uuid, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_record_preorder_payment(p_order_id uuid, p_admin_id uuid, p_amount numeric, p_reference text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_order public.customer_orders%rowtype; v_amount numeric(12,2);
begin
  if not exists (select 1 from public.admin_users as admins
    where admins.id = p_admin_id and admins.is_active
      and (admins.role = 'owner' or coalesce((admins.permissions ->> 'dashboard.orders')::boolean, false))) then
    raise exception 'Order permission is required.';
  end if;
  select * into v_order from public.customer_orders where id = p_order_id for update;
  if not found or not v_order.is_preorder then raise exception 'Preorder not found.'; end if;
  if v_order.status in ('cancelled', 'refunded') then raise exception 'Cancelled preorders cannot receive a payment.'; end if;
  if p_amount is null or p_amount <= 0 or round(p_amount, 2) <> p_amount
    or p_amount > v_order.total_amount - v_order.amount_paid then
    raise exception 'Payment amount must be positive and within the outstanding balance.';
  end if;
  if char_length(btrim(coalesce(p_reference, ''))) not between 3 and 120 then
    raise exception 'A verified payment reference is required.';
  end if;
  v_amount := p_amount;
  insert into public.preorder_payments (order_id, amount, reference, method, verified_by)
  values (p_order_id, v_amount, btrim(p_reference), v_order.payment_method, p_admin_id);
  update public.customer_orders set
    amount_paid = amount_paid + v_amount,
    payment_status = case when amount_paid + v_amount = total_amount then 'paid' else 'partially_paid' end,
    paid_at = case when amount_paid + v_amount = total_amount then now() else null end,
    updated_at = now()
  where id = p_order_id returning * into v_order;
  return to_jsonb(v_order);
end;
$$;


--
-- Name: commerce_reject_serialized_movement_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_reject_serialized_movement_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  raise exception
    'Serialized inventory movement history is immutable and cannot be changed.';
end;
$$;


--
-- Name: commerce_reject_serialized_stock_write(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_reject_serialized_stock_write() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_product_id uuid;
  v_is_serialized boolean;
  v_old_is_serialized boolean;
begin
  if current_setting('app.serialized_inventory_write', true) = 'on' then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  if tg_table_name = 'products' then
    if tg_op = 'INSERT' and not new.is_serialized then
      raise exception
        'Every new product must use individual item IDs and QR tracking.';
    end if;

    if tg_op = 'INSERT' and new.stock_quantity <> 0 then
      raise exception
        'A product must start at zero stock; receive every physical item through Procurement.';
    end if;

    if tg_op = 'INSERT'
      and (
        new.primary_warehouse_id is null
        or not exists (
          select 1
          from public.commerce_warehouses as warehouses
          where warehouses.id = new.primary_warehouse_id
            and warehouses.is_active
        )
      )
    then
      raise exception
        'Every new tracked product requires an active primary warehouse reference.';
    end if;

    if tg_op = 'UPDATE'
      and new.is_serialized is distinct from old.is_serialized
    then
      raise exception
        'Inventory tracking mode cannot be changed after a product is created.';
    end if;

    if tg_op = 'UPDATE'
      and old.is_serialized
      and new.primary_warehouse_id is distinct from old.primary_warehouse_id
      and new.primary_warehouse_id is not null
      and not exists (
        select 1
        from public.commerce_warehouses as warehouses
        where warehouses.id = new.primary_warehouse_id
          and warehouses.is_active
      )
    then
      raise exception
        'A tracked product requires an active primary warehouse reference.';
    end if;

    if tg_op = 'UPDATE'
      and old.is_serialized
      and new.primary_warehouse_id is distinct from old.primary_warehouse_id
      and (
        coalesce(old.stock_quantity, 0) <> 0
        or exists (
          select 1
          from public.commerce_serialized_units as units
          where units.product_id = old.id
        )
      )
    then
      raise exception
        'A tracked product warehouse can only change before its first physical item exists.';
    end if;

    if tg_op = 'UPDATE'
      and old.is_serialized
      and new.stock_quantity is distinct from old.stock_quantity
    then
      raise exception
        'Product stock is a projection of individually tracked units; use Procurement.';
    end if;

    return new;
  end if;

  if tg_table_name = 'product_variants' then
    v_product_id := new.product_id;

    select products.is_serialized
    into v_is_serialized
    from public.products as products
    where products.id = v_product_id;

    if v_is_serialized
      and (
        (tg_op = 'INSERT' and new.stock_quantity <> 0)
        or (
          tg_op = 'UPDATE'
          and new.stock_quantity is distinct from old.stock_quantity
        )
      )
    then
      raise exception
        'Variant stock is a projection of individually tracked units; use Procurement.';
    end if;

    return new;
  end if;

  v_product_id := case
    when tg_op = 'DELETE' then old.product_id
    else new.product_id
  end;

  select products.is_serialized
  into v_is_serialized
  from public.products as products
  where products.id = v_product_id;

  if tg_op = 'DELETE' then
    if v_is_serialized then
      raise exception
        'A tracked warehouse balance cannot be deleted; move exact units through inventory workflows.';
    end if;

    return old;
  end if;

  if tg_op = 'UPDATE' then
    select products.is_serialized
    into v_old_is_serialized
    from public.products as products
    where products.id = old.product_id;
  end if;

  if (
      v_is_serialized
      or coalesce(v_old_is_serialized, false)
    )
    and (
      (tg_op = 'INSERT' and new.quantity <> 0)
      or (
        tg_op = 'UPDATE'
        and (
          new.product_id is distinct from old.product_id
          or new.warehouse_id is distinct from old.warehouse_id
          or new.quantity is distinct from old.quantity
          or new.average_cost is distinct from old.average_cost
        )
      )
    )
  then
    raise exception
      'Warehouse stock is a projection of individually tracked units; use Procurement.';
  end if;

  return new;
end;
$$;


--
-- Name: commerce_release_preorder(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_release_preorder(p_order_id uuid, p_admin_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_order public.customer_orders%rowtype;
  v_item public.customer_order_items%rowtype;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_unit public.commerce_serialized_units%rowtype;
  v_assigned integer;
  v_updated integer;
  v_warehouse_quantity integer;
begin
  perform public.assert_built_in_erp();
  if not exists (select 1 from public.admin_users as admins
    where admins.id = p_admin_id and admins.is_active
      and (admins.role = 'owner' or coalesce((admins.permissions ->> 'dashboard.orders')::boolean, false))) then
    raise exception 'Order permission is required.';
  end if;
  select * into v_order from public.customer_orders where id = p_order_id for update;
  if not found or not v_order.is_preorder then raise exception 'Preorder not found.'; end if;
  if v_order.preorder_fulfillment_state = 'ready' then return to_jsonb(v_order); end if;
  if v_order.status <> 'on_hold' then raise exception 'Only active preorders can be released.'; end if;
  if v_order.amount_paid <> v_order.total_amount or v_order.payment_status <> 'paid' then
    raise exception 'Full verified payment is required before fulfillment.';
  end if;
  perform set_config('app.serialized_inventory_write', 'on', true);
  for v_item in select * from public.customer_order_items
    where order_id = p_order_id order by product_id, variant_id, id
  loop
    select * into v_product from public.products where id = v_item.product_id for update;
    if not found then raise exception 'The preorder product no longer exists.'; end if;
    if v_product.is_serialized then
      if v_item.variant_id is null or v_product.primary_warehouse_id is null then
        raise exception 'A product option and warehouse are required for release.';
      end if;
      select * into v_variant from public.product_variants where id = v_item.variant_id
        and product_id = v_product.id for update;
      if not found then raise exception 'The original product option no longer exists.'; end if;
      v_assigned := 0;
      for v_unit in select * from public.commerce_serialized_units
        where product_id = v_product.id and variant_id = v_variant.id
          and warehouse_id = v_product.primary_warehouse_id and status = 'in_stock'
        order by created_at, id limit v_item.quantity for update
      loop
        update public.commerce_serialized_units set
          status='sold', customer_order_id=p_order_id, customer_order_item_id=v_item.id,
          customer_user_id=v_order.user_id, sold_at=now(), returned_at=null, updated_at=now()
        where id=v_unit.id;
        insert into public.commerce_serialized_unit_movements (
          unit_id, product_id, variant_id, warehouse_id, customer_order_id,
          movement_type, from_status, to_status, notes
        ) values (
          v_unit.id, v_product.id, v_variant.id, v_product.primary_warehouse_id,
          p_order_id, 'sold', 'in_stock', 'sold', 'Assigned on preorder release.'
        );
        v_assigned := v_assigned + 1;
      end loop;
      if v_assigned <> v_item.quantity then raise exception 'Not enough serialized units have arrived.'; end if;
      update public.product_variants set stock_quantity=stock_quantity-v_item.quantity, updated_at=now()
        where id=v_variant.id and stock_quantity>=v_item.quantity;
      get diagnostics v_updated = row_count;
      if v_updated <> 1 then raise exception 'Serialized variant stock is inconsistent.'; end if;
    end if;
    update public.products set stock_quantity=stock_quantity-v_item.quantity
      where id=v_product.id and stock_quantity>=v_item.quantity;
    get diagnostics v_updated = row_count;
    if v_updated <> 1 then raise exception 'Physical product stock has not arrived.'; end if;
    if v_product.primary_warehouse_id is not null then
      update public.commerce_warehouse_inventory set
        quantity=quantity-v_item.quantity, updated_at=now()
      where warehouse_id=v_product.primary_warehouse_id and product_id=v_product.id
        and quantity>=v_item.quantity returning quantity into v_warehouse_quantity;
      if not found then raise exception 'Primary warehouse stock has not arrived.'; end if;
      insert into public.commerce_inventory_movements (
        warehouse_id, product_id, movement_type, reference_type, reference_id,
        quantity_change, quantity_after, unit_cost, notes
      ) values (
        v_product.primary_warehouse_id, v_product.id, 'sale_out', 'manual', p_order_id,
        -v_item.quantity, v_warehouse_quantity,
        coalesce(case when v_product.is_serialized then v_variant.cost_price else v_product.cost_price end,0),
        'Physical stock assigned on preorder release.'
      );
    end if;
  end loop;
  update public.customer_orders set preorder_fulfillment_state='ready', status='processing', updated_at=now()
    where id=p_order_id returning * into v_order;
  return to_jsonb(v_order);
end;
$$;


--
-- Name: commerce_require_active_product_variant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_require_active_product_variant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_primary_product_id uuid;
  v_product_id uuid;
  v_other_product_id uuid;
begin
  v_primary_product_id := case
    when tg_op = 'DELETE' then old.product_id
    else new.product_id
  end;

  if tg_op = 'UPDATE'
    and old.product_id is distinct from new.product_id
  then
    v_other_product_id := old.product_id;
  end if;

  -- Serialize every variant-set mutation through its parent product. Without
  -- this lock, two concurrent transactions could each deactivate a different
  -- active variant and both observe the other's uncommitted row as active.
  for v_product_id in
    select candidate_ids.product_id
    from unnest(array[v_primary_product_id, v_other_product_id]) as candidate_ids(product_id)
    where candidate_ids.product_id is not null
    group by candidate_ids.product_id
    order by candidate_ids.product_id
  loop
    perform products.id
    from public.products as products
    where products.id = v_product_id
    for update;

    if found and not exists (
      select 1
      from public.product_variants as variants
      where variants.product_id = v_product_id
        and variants.is_active
    ) then
      raise exception
        'Every product requires at least one active variant.';
    end if;
  end loop;

  return null;
end;
$$;


--
-- Name: commerce_return_serialized_unit(uuid, uuid, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_return_serialized_unit(p_unit_id uuid, p_warehouse_id uuid, p_reason text, p_notes text DEFAULT NULL::text, p_admin_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_unit public.commerce_serialized_units%rowtype;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_order_item public.customer_order_items%rowtype;
  v_return_id uuid;
  v_warehouse_quantity integer;
begin
  perform public.assert_built_in_erp();
  if p_admin_id is null or not exists (
    select 1
    from public.admin_users as admins
    where admins.id = p_admin_id
      and admins.is_active
      and (
        admins.role = 'owner'
        or coalesce((admins.permissions ->> 'products.edit')::boolean, false)
      )
  ) then
    raise exception 'Not authorized to return serialized inventory.';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'A return reason is required.';
  end if;

  if p_warehouse_id is null or not exists (
    select 1
    from public.commerce_warehouses as warehouses
    where warehouses.id = p_warehouse_id
      and warehouses.is_active
  ) then
    raise exception 'A valid active warehouse is required.';
  end if;

  select units.*
  into v_unit
  from public.commerce_serialized_units as units
  where units.id = p_unit_id;

  if not found then
    raise exception 'The serialized inventory item was not found.';
  end if;

  select products.*
  into v_product
  from public.products as products
  where products.id = v_unit.product_id
  for update;

  if v_product.primary_warehouse_id is null
    or p_warehouse_id <> v_product.primary_warehouse_id
  then
    raise exception
      'Serialized returns must be received into the product primary warehouse.';
  end if;

  select variants.*
  into v_variant
  from public.product_variants as variants
  where variants.id = v_unit.variant_id
    and variants.product_id = v_unit.product_id
  for update;

  select units.*
  into v_unit
  from public.commerce_serialized_units as units
  where units.id = p_unit_id
  for update;

  if v_unit.status <> 'sold' then
    raise exception 'Only a currently sold physical item can be returned.';
  end if;

  if v_unit.customer_order_id is null
    or v_unit.customer_order_item_id is null
  then
    raise exception 'This sold item is not linked to a customer order.';
  end if;

  select items.*
  into v_order_item
  from public.customer_order_items as items
  where items.id = v_unit.customer_order_item_id
    and items.order_id = v_unit.customer_order_id
    and items.product_id = v_unit.product_id
  for update;

  if not found then
    raise exception 'The linked customer order item is invalid.';
  end if;

  perform set_config('app.serialized_inventory_write', 'on', true);

  insert into public.commerce_order_returns (
    order_id,
    warehouse_id,
    reason,
    notes,
    total_items,
    created_by
  )
  values (
    v_unit.customer_order_id,
    p_warehouse_id,
    btrim(p_reason),
    nullif(btrim(p_notes), ''),
    1,
    p_admin_id
  )
  returning id into v_return_id;

  insert into public.commerce_order_return_items (
    order_return_id,
    order_item_id,
    product_id,
    variant_id,
    serialized_unit_id,
    quantity,
    unit_price
  )
  values (
    v_return_id,
    v_unit.customer_order_item_id,
    v_unit.product_id,
    v_unit.variant_id,
    v_unit.id,
    1,
    coalesce(v_order_item.unit_price, 0)
  );

  update public.commerce_serialized_units
  set
    warehouse_id = p_warehouse_id,
    status = 'in_stock',
    returned_at = now(),
    updated_at = now()
  where id = v_unit.id;

  update public.product_variants
  set
    stock_quantity = stock_quantity + 1,
    updated_at = now()
  where id = v_unit.variant_id;

  update public.products
  set stock_quantity = stock_quantity + 1
  where id = v_unit.product_id;

  insert into public.commerce_warehouse_inventory (
    warehouse_id,
    product_id,
    quantity,
    average_cost,
    updated_at
  )
  values (
    p_warehouse_id,
    v_unit.product_id,
    1,
    coalesce(v_unit.unit_cost, v_product.cost_price, 0),
    now()
  )
  on conflict (warehouse_id, product_id)
  do update
  set
    quantity = commerce_warehouse_inventory.quantity + 1,
    updated_at = now()
  returning quantity into v_warehouse_quantity;

  insert into public.commerce_serialized_unit_movements (
    unit_id,
    product_id,
    variant_id,
    warehouse_id,
    customer_order_id,
    order_return_id,
    actor_admin_id,
    movement_type,
    from_status,
    to_status,
    notes
  )
  values (
    v_unit.id,
    v_unit.product_id,
    v_unit.variant_id,
    p_warehouse_id,
    v_unit.customer_order_id,
    v_return_id,
    p_admin_id,
    'returned',
    'sold',
    'in_stock',
    concat_ws(
      ' — ',
      btrim(p_reason),
      nullif(btrim(p_notes), '')
    )
  );

  insert into public.commerce_inventory_movements (
    warehouse_id,
    product_id,
    movement_type,
    reference_type,
    reference_id,
    quantity_change,
    quantity_after,
    unit_cost,
    notes,
    created_by
  )
  values (
    p_warehouse_id,
    v_unit.product_id,
    'return_in',
    'order_return',
    v_return_id,
    1,
    v_warehouse_quantity,
    coalesce(v_unit.unit_cost, v_product.cost_price, 0),
    concat_ws(
      ' — ',
      btrim(p_reason),
      nullif(btrim(p_notes), '')
    ),
    p_admin_id
  );

  return jsonb_build_object(
    'item_id', v_unit.id,
    'status', 'in_stock',
    'return_id', v_return_id
  );
end;
$$;


--
-- Name: commerce_snapshot_item_warranty(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_snapshot_item_warranty() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare terms public.products%rowtype;
begin
  -- Discard supplied terms even for a trusted insert. Only the authoritative
  -- checkout wrappers open a transaction-local capture scope. Appending an
  -- item to an old order/importing history must not copy today's product terms.
  new.warranty_status := null;
  new.warranty_duration_value := null;
  new.warranty_duration_unit := null;
  new.warranty_start_basis := null;
  new.warranty_snapshot_at := null;
  if coalesce(current_setting('app.warranty_purchase_capture', true), '') <> 'on' then
    return new;
  end if;

  -- Both canonical transactions already lock products in deterministic order.
  -- Reuse those locks; FOR SHARE also protects any future scoped insertion.
  select * into terms from public.products where id = new.product_id for share;
  if not found then raise exception 'A catalog product is required for a warranty snapshot.'; end if;
  new.warranty_status := terms.warranty_status;
  new.warranty_duration_value := terms.warranty_duration_value;
  new.warranty_duration_unit := terms.warranty_duration_unit;
  new.warranty_start_basis := case when terms.warranty_status = 'included' then 'unresolved' else null end;
  new.warranty_snapshot_at := pg_catalog.statement_timestamp();
  return new;
end $$;


--
-- Name: commerce_store_payment_intention(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_store_payment_intention(p_attempt_id uuid, p_intention_id text, p_provider_order_id text, p_client_secret text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Server access required.'; end if;
  if p_intention_id is null or length(p_intention_id)>160 or p_intention_id not like 'pi_test_%'
    or p_provider_order_id is null or p_provider_order_id !~ '^[0-9]{1,18}$'
    or p_client_secret is null or p_client_secret not like 'egy_csk_test_%' then raise exception 'Invalid intention.'; end if;
  update public.payment_attempts set intention_id=p_intention_id,provider_order_id=p_provider_order_id,
    client_secret=p_client_secret,status='pending',error_code=null,updated_at=now()
    where id=p_attempt_id and mode='test' and status='initiated' and intention_id is null;
  if not found then raise exception 'Intention already recorded.'; end if;
end;
$_$;


--
-- Name: commerce_transfer_inventory(uuid, uuid, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_transfer_inventory(p_from_warehouse_id uuid, p_to_warehouse_id uuid, p_reference_number text, p_notes text, p_items jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_transfer_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_source_inventory public.commerce_warehouse_inventory%rowtype;
  v_target_inventory public.commerce_warehouse_inventory%rowtype;
  v_target_next_quantity integer;
  v_target_next_average_cost numeric (12, 2);
begin
  perform public.assert_built_in_erp();
  if not public.is_active_admin () then
    raise exception 'Not authorized';
  end if;

  if p_from_warehouse_id is null or p_to_warehouse_id is null or p_from_warehouse_id = p_to_warehouse_id then
    raise exception 'Two different warehouses are required.';
  end if;

  if not exists (
    select 1
    from public.commerce_warehouses
    where id = p_from_warehouse_id
      and is_active = true
  ) then
    raise exception 'The source warehouse is not valid.';
  end if;

  if not exists (
    select 1
    from public.commerce_warehouses
    where id = p_to_warehouse_id
      and is_active = true
  ) then
    raise exception 'The destination warehouse is not valid.';
  end if;

  if jsonb_typeof (p_items) <> 'array' or jsonb_array_length (p_items) = 0 then
    raise exception 'At least one transfer item is required.';
  end if;

  insert into public.commerce_warehouse_transfers (
    from_warehouse_id,
    to_warehouse_id,
    reference_number,
    notes,
    created_by
  )
  values (
    p_from_warehouse_id,
    p_to_warehouse_id,
    nullif(trim(p_reference_number), ''),
    nullif(trim(p_notes), ''),
    auth.uid ()
  )
  returning id into v_transfer_id;

  for v_item in
    select value
    from jsonb_array_elements (p_items)
  loop
    v_product_id := nullif(v_item ->> 'product_id', '')::uuid;
    v_quantity := coalesce((v_item ->> 'quantity')::integer, 0);

    if v_product_id is null or v_quantity <= 0 then
      raise exception 'Every transfer line requires a valid product and quantity.';
    end if;

    select *
    into v_source_inventory
    from public.commerce_warehouse_inventory
    where warehouse_id = p_from_warehouse_id
      and product_id = v_product_id
    for update;

    if not found or coalesce(v_source_inventory.quantity, 0) < v_quantity then
      raise exception 'The source warehouse does not have enough stock for one of the selected products.';
    end if;

    update public.commerce_warehouse_inventory
    set
      quantity = quantity - v_quantity,
      updated_at = now()
    where id = v_source_inventory.id
    returning * into v_source_inventory;

    select *
    into v_target_inventory
    from public.commerce_warehouse_inventory
    where warehouse_id = p_to_warehouse_id
      and product_id = v_product_id
    for update;

    if found then
      v_target_next_quantity := coalesce(v_target_inventory.quantity, 0) + v_quantity;
      v_target_next_average_cost := case
        when v_target_next_quantity > 0 then round((
          (
            coalesce(v_target_inventory.average_cost, 0) * greatest(coalesce(v_target_inventory.quantity, 0), 0)
          ) + (coalesce(v_source_inventory.average_cost, 0) * v_quantity)
        ) / v_target_next_quantity, 2)
        else coalesce(v_source_inventory.average_cost, 0)
      end;

      update public.commerce_warehouse_inventory
      set
        quantity = v_target_next_quantity,
        average_cost = v_target_next_average_cost,
        updated_at = now()
      where id = v_target_inventory.id
      returning * into v_target_inventory;
    else
      insert into public.commerce_warehouse_inventory (
        warehouse_id,
        product_id,
        quantity,
        average_cost
      )
      values (
        p_to_warehouse_id,
        v_product_id,
        v_quantity,
        coalesce(v_source_inventory.average_cost, 0)
      )
      returning * into v_target_inventory;
    end if;

    insert into public.commerce_warehouse_transfer_items (
      transfer_id,
      product_id,
      quantity
    )
    values (
      v_transfer_id,
      v_product_id,
      v_quantity
    );

    insert into public.commerce_inventory_movements (
      warehouse_id,
      product_id,
      movement_type,
      reference_type,
      reference_id,
      quantity_change,
      quantity_after,
      unit_cost,
      notes,
      created_by
    )
    values (
      p_from_warehouse_id,
      v_product_id,
      'transfer_out',
      'warehouse_transfer',
      v_transfer_id,
      -v_quantity,
      v_source_inventory.quantity,
      coalesce(v_source_inventory.average_cost, 0),
      nullif(trim(p_notes), ''),
      auth.uid ()
    );

    insert into public.commerce_inventory_movements (
      warehouse_id,
      product_id,
      movement_type,
      reference_type,
      reference_id,
      quantity_change,
      quantity_after,
      unit_cost,
      notes,
      created_by
    )
    values (
      p_to_warehouse_id,
      v_product_id,
      'transfer_in',
      'warehouse_transfer',
      v_transfer_id,
      v_quantity,
      v_target_inventory.quantity,
      coalesce(v_target_inventory.average_cost, 0),
      nullif(trim(p_notes), ''),
      auth.uid ()
    );
  end loop;

  return v_transfer_id;
end;
$$;


--
-- Name: commerce_validate_order_return_item(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_validate_order_return_item() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_order_product_id uuid;
  v_is_serialized boolean;
begin
  if new.order_item_id is null then
    raise exception 'A valid customer order item is required for every return.';
  end if;

  select items.product_id
  into v_order_product_id
  from public.customer_order_items as items
  where items.id = new.order_item_id;

  if not found or v_order_product_id is null then
    raise exception 'The selected customer order item is invalid.';
  end if;

  if new.product_id is null then
    new.product_id := v_order_product_id;
  elsif new.product_id <> v_order_product_id then
    raise exception
      'The supplied product does not match the selected customer order item.';
  end if;

  select products.is_serialized
  into v_is_serialized
  from public.products as products
  where products.id = v_order_product_id;

  if v_is_serialized and new.serialized_unit_id is null then
    raise exception
      'Use the serialized inventory scanner to return this exact physical item.';
  end if;

  return new;
end;
$$;


--
-- Name: commerce_validate_product_image_variant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commerce_validate_product_image_variant() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_variant public.product_variants%rowtype;
begin
  if new.variant_id is null then
    raise exception 'Select a variant for every extra product image.';
  end if;

  select variants.*
  into v_variant
  from public.product_variants as variants
  where variants.id = new.variant_id
  for share;

  if not found
    or v_variant.product_id <> new.product_id
  then
    raise exception
      'The selected image variant does not belong to this product.';
  end if;

  if not v_variant.is_active then
    raise exception
      'Extra images can only be assigned to an active product variant.';
  end if;

  return new;
end;
$$;


--
-- Name: complete_order_packing_session(uuid, uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_order_packing_session(p_session_id uuid, p_admin_user_id uuid, p_next_order_status text DEFAULT 'ready_to_deliver'::text, p_message_subject text DEFAULT NULL::text, p_message_body text DEFAULT NULL::text, p_sender_name text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_session public.order_packing_sessions%rowtype;
  v_order public.customer_orders%rowtype;
  v_now timestamptz := clock_timestamp();
  v_message_id uuid;
  v_required_quantity integer;
  v_scanned_quantity integer;
  v_subject text;
  v_body text := nullif(btrim(p_message_body), '');
  v_sender_name text := coalesce(nullif(btrim(p_sender_name), ''), 'Store team');
begin
  if coalesce(auth.role()::text, '') <> 'service_role' then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  if p_session_id is null or p_admin_user_id is null then
    raise exception 'A packing session and processor are required.';
  end if;

  if p_next_order_status is null
    or p_next_order_status not in (
    'ready_to_deliver',
    'being_shipped',
    'out_for_delivery',
    'on_hold'
    )
  then
    raise exception 'The selected completed order status is not valid.';
  end if;

  if v_body is not null and length(v_body) > 2000 then
    raise exception 'The purchaser message cannot exceed 2000 characters.';
  end if;

  select sessions.*
  into v_session
  from public.order_packing_sessions as sessions
  where sessions.id = p_session_id
  for update;

  if not found then
    raise exception 'Packing session not found.';
  end if;

  if v_session.admin_user_id is distinct from p_admin_user_id then
    raise exception 'Only the admin who claimed this order can complete it.';
  end if;

  if not exists (
    select 1
    from public.admin_users as admins
    where admins.id = p_admin_user_id
      and admins.is_active
      and (
        admins.role = 'owner'
        or coalesce(
          (admins.permissions ->> 'dashboard.orders')::boolean,
          false
        )
      )
  ) then
    raise exception 'This admin can no longer process orders.';
  end if;

  select orders.*
  into v_order
  from public.customer_orders as orders
  where orders.id = v_session.order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  if v_session.status = 'completed' then
    select messages.id
    into v_message_id
    from public.customer_order_messages as messages
    where messages.packing_session_id = v_session.id
    limit 1;

    return jsonb_build_object(
      'session_id', v_session.id,
      'order_id', v_session.order_id,
      'order_status', v_order.status,
      'message_id', v_message_id,
      'already_completed', true
    );
  end if;

  if v_session.status <> 'active' then
    raise exception 'This packing session is no longer active.';
  end if;

  if v_order.status not in ('pending_payment', 'processing') then
    raise exception 'The order status changed while it was being packed.';
  end if;

  -- Stabilize every assigned physical unit while its final scan state is
  -- validated so an inventory return cannot race this completion transaction.
  perform assigned_units.id
  from public.commerce_serialized_units as assigned_units
  where assigned_units.customer_order_id = v_order.id
  order by assigned_units.id
  for update;

  if not exists (
    select 1
    from public.customer_order_items as order_items
    where order_items.order_id = v_order.id
  ) then
    raise exception 'This order has no items to confirm.';
  end if;

  if exists (
    select 1
    from public.customer_order_items as order_items
    left join lateral (
      select count(*)::integer as scan_count
      from public.order_packing_scans as scans
      where scans.session_id = v_session.id
        and scans.order_item_id = order_items.id
    ) as scan_totals on true
    where order_items.order_id = v_order.id
      and coalesce(scan_totals.scan_count, 0) <> order_items.quantity
  ) then
    raise exception 'Every requested item must be scanned before completing this order.';
  end if;

  select count(*)::integer
  into v_scanned_quantity
  from public.order_packing_scans as scans
  where scans.session_id = v_session.id;

  select coalesce(sum(order_items.quantity), 0)::integer
  into v_required_quantity
  from public.customer_order_items as order_items
  where order_items.order_id = v_order.id;

  if v_scanned_quantity <> v_required_quantity then
    raise exception 'The scanned quantity does not match the requested order quantity.';
  end if;

  if exists (
    select 1
    from public.customer_order_items as order_items
    left join public.products as products
      on products.id = order_items.product_id
    where order_items.order_id = v_order.id
      and (
        order_items.variant_id is not null
        or coalesce(products.is_serialized, false)
        or exists (
          select 1
          from public.commerce_serialized_units as assigned_units
          where assigned_units.customer_order_item_id = order_items.id
            and assigned_units.customer_order_id = v_order.id
        )
      )
      and (
        (
          select count(*)
          from public.commerce_serialized_units as assigned_units
          where assigned_units.customer_order_item_id = order_items.id
            and assigned_units.customer_order_id = v_order.id
            and assigned_units.status = 'sold'
        ) <> order_items.quantity
        or (
          select count(*)
          from public.order_packing_scans as scans
          join public.commerce_serialized_units as assigned_units
            on assigned_units.id = scans.serialized_unit_id
          where scans.session_id = v_session.id
            and scans.order_item_id = order_items.id
            and assigned_units.customer_order_item_id = order_items.id
            and assigned_units.customer_order_id = v_order.id
            and assigned_units.status = 'sold'
        ) <> order_items.quantity
      )
  ) then
    raise exception 'Every serialized item must still be assigned, sold, and scanned for this order.';
  end if;

  if v_body is not null and v_order.user_id is null then
    raise exception 'This guest order does not have a customer account inbox.';
  end if;

  update public.customer_orders
  set
    status = p_next_order_status,
    packing_completed_at = v_now,
    updated_at = v_now
  where id = v_order.id;

  update public.order_packing_sessions
  set
    status = 'completed',
    completed_at = v_now,
    completed_order_status = p_next_order_status,
    updated_at = v_now
  where id = v_session.id;

  if v_body is not null then
    v_subject := coalesce(
      nullif(btrim(p_message_subject), ''),
      'Order ' || coalesce(v_order.order_number, '#' || left(v_order.id::text, 8)) || ' update'
    );

    if length(v_subject) > 200 then
      raise exception 'The purchaser message subject cannot exceed 200 characters.';
    end if;

    insert into public.customer_order_messages (
      user_id,
      order_id,
      packing_session_id,
      sender_admin_user_id,
      sender_name,
      subject,
      body
    )
    values (
      v_order.user_id,
      v_order.id,
      v_session.id,
      p_admin_user_id,
      v_sender_name,
      v_subject,
      v_body
    )
    returning id into v_message_id;
  end if;

  return jsonb_build_object(
    'session_id', v_session.id,
    'order_id', v_order.id,
    'order_status', p_next_order_status,
    'message_id', v_message_id,
    'required_quantity', v_required_quantity,
    'scanned_quantity', v_scanned_quantity,
    'already_completed', false
  );
end;
$$;


--
-- Name: dashboard_get_analysis_chart(date, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dashboard_get_analysis_chart(p_start_date date, p_end_date date, p_bucket text DEFAULT 'day'::text) RETURNS TABLE(period_start date, orders bigint, sales numeric, return_units numeric, coupons bigint, stock numeric, revenue numeric, expenses numeric)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_bucket text := case when lower(coalesce(p_bucket, 'day')) = 'month' then 'month' else 'day' end;
  v_start_timestamp timestamp with time zone;
  v_end_timestamp timestamp with time zone;
begin
  if not public.has_admin_permission ('dashboard.analysis') then
    raise exception 'Not authorized';
  end if;

  if p_start_date is null or p_end_date is null then
    raise exception 'Start and end dates are required.';
  end if;

  if p_end_date < p_start_date then
    raise exception 'End date must be on or after the start date.';
  end if;

  if (p_end_date - p_start_date) > 1095 then
    raise exception 'Analysis date ranges cannot exceed three years.';
  end if;

  v_start_timestamp := p_start_date::timestamp at time zone 'Africa/Cairo';
  v_end_timestamp := (p_end_date + 1)::timestamp at time zone 'Africa/Cairo';

  return query
  with buckets as (
    select generated_bucket::date as bucket_date
    from generate_series(
      case
        when v_bucket = 'month' then date_trunc('month', p_start_date::timestamp)
        else p_start_date::timestamp
      end,
      case
        when v_bucket = 'month' then date_trunc('month', p_end_date::timestamp)
        else p_end_date::timestamp
      end,
      case
        when v_bucket = 'month' then interval '1 month'
        else interval '1 day'
      end
    ) as series(generated_bucket)
  ),
  online_orders as (
    select
      case
        when v_bucket = 'month' then date_trunc('month', orders.created_at at time zone 'Africa/Cairo')::date
        else (orders.created_at at time zone 'Africa/Cairo')::date
      end as bucket_date,
      count(*)::bigint as order_count,
      coalesce(sum(orders.total_amount) filter (where orders.status not in ('cancelled', 'refunded')), 0)::numeric as revenue_amount
    from public.customer_orders as orders
    where orders.created_at >= v_start_timestamp
      and orders.created_at < v_end_timestamp
    group by 1
  ),
  manual_orders as (
    select
      case
        when v_bucket = 'month' then date_trunc('month', sales.created_at at time zone 'Africa/Cairo')::date
        else (sales.created_at at time zone 'Africa/Cairo')::date
      end as bucket_date,
      count(*)::bigint as order_count,
      coalesce(sum(sales.total_amount), 0)::numeric as revenue_amount
    from public.commerce_sales_orders as sales
    where sales.created_at >= v_start_timestamp
      and sales.created_at < v_end_timestamp
    group by 1
  ),
  order_metrics as (
    select
      combined.bucket_date,
      sum(combined.order_count)::bigint as order_count,
      sum(combined.revenue_amount)::numeric as revenue_amount
    from (
      select * from online_orders
      union all
      select * from manual_orders
    ) as combined
    group by combined.bucket_date
  ),
  online_sales as (
    select
      case
        when v_bucket = 'month' then date_trunc('month', orders.created_at at time zone 'Africa/Cairo')::date
        else (orders.created_at at time zone 'Africa/Cairo')::date
      end as bucket_date,
      coalesce(sum(items.quantity), 0)::numeric as units
    from public.customer_order_items as items
    join public.customer_orders as orders
      on orders.id = items.order_id
    where orders.created_at >= v_start_timestamp
      and orders.created_at < v_end_timestamp
      and orders.status not in ('cancelled', 'refunded')
    group by 1
  ),
  manual_sales as (
    select
      case
        when v_bucket = 'month' then date_trunc('month', sales.created_at at time zone 'Africa/Cairo')::date
        else (sales.created_at at time zone 'Africa/Cairo')::date
      end as bucket_date,
      coalesce(sum(items.quantity), 0)::numeric as units
    from public.commerce_sales_items as items
    join public.commerce_sales_orders as sales
      on sales.id = items.sales_order_id
    where sales.created_at >= v_start_timestamp
      and sales.created_at < v_end_timestamp
    group by 1
  ),
  sales_metrics as (
    select combined.bucket_date, sum(combined.units)::numeric as units
    from (
      select * from online_sales
      union all
      select * from manual_sales
    ) as combined
    group by combined.bucket_date
  ),
  return_metrics as (
    select
      case
        when v_bucket = 'month' then date_trunc('month', return_orders.created_at at time zone 'Africa/Cairo')::date
        else (return_orders.created_at at time zone 'Africa/Cairo')::date
      end as bucket_date,
      coalesce(sum(return_orders.total_items), 0)::numeric as units
    from public.commerce_order_returns as return_orders
    where return_orders.created_at >= v_start_timestamp
      and return_orders.created_at < v_end_timestamp
    group by 1
  ),
  coupon_metrics as (
    select
      case
        when v_bucket = 'month' then date_trunc('month', orders.created_at at time zone 'Africa/Cairo')::date
        else (orders.created_at at time zone 'Africa/Cairo')::date
      end as bucket_date,
      count(*)::bigint as uses
    from public.customer_orders as orders
    where orders.created_at >= v_start_timestamp
      and orders.created_at < v_end_timestamp
      and nullif(trim(orders.coupon_code), '') is not null
    group by 1
  ),
  stock_metrics as (
    select
      case
        when v_bucket = 'month' then date_trunc('month', movements.created_at at time zone 'Africa/Cairo')::date
        else (movements.created_at at time zone 'Africa/Cairo')::date
      end as bucket_date,
      coalesce(sum(movements.quantity_change), 0)::numeric as quantity_change
    from public.commerce_inventory_movements as movements
    where movements.created_at >= v_start_timestamp
      and movements.created_at < v_end_timestamp
    group by 1
  ),
  expense_metrics as (
    select
      case
        when v_bucket = 'month' then date_trunc('month', transactions.paid_at::timestamp)::date
        else transactions.paid_at
      end as bucket_date,
      coalesce(sum(transactions.amount), 0)::numeric as amount
    from public.treasury_transactions as transactions
    where transactions.paid_at >= p_start_date
      and transactions.paid_at <= p_end_date
      and transactions.transaction_type in ('supplier_payment', 'salary_payment')
    group by 1
  )
  select
    buckets.bucket_date,
    coalesce(order_metrics.order_count, 0)::bigint,
    coalesce(sales_metrics.units, 0)::numeric,
    coalesce(return_metrics.units, 0)::numeric,
    coalesce(coupon_metrics.uses, 0)::bigint,
    coalesce(stock_metrics.quantity_change, 0)::numeric,
    coalesce(order_metrics.revenue_amount, 0)::numeric,
    coalesce(expense_metrics.amount, 0)::numeric
  from buckets
  left join order_metrics on order_metrics.bucket_date = buckets.bucket_date
  left join sales_metrics on sales_metrics.bucket_date = buckets.bucket_date
  left join return_metrics on return_metrics.bucket_date = buckets.bucket_date
  left join coupon_metrics on coupon_metrics.bucket_date = buckets.bucket_date
  left join stock_metrics on stock_metrics.bucket_date = buckets.bucket_date
  left join expense_metrics on expense_metrics.bucket_date = buckets.bucket_date
  order by buckets.bucket_date;
end;
$$;


--
-- Name: dashboard_get_analysis_overview(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dashboard_get_analysis_overview() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_today date := (now() at time zone 'Africa/Cairo')::date;
  v_week_start date;
  v_month_start date;
  v_result jsonb;
begin
  if not public.has_admin_permission ('dashboard.analysis') then
    raise exception 'Not authorized';
  end if;

  v_week_start := date_trunc('week', v_today::timestamp)::date;
  v_month_start := date_trunc('month', v_today::timestamp)::date;

  with periods as (
    select
      'today'::text as period_key,
      v_today as current_start,
      v_today + 1 as current_end,
      v_today - 1 as previous_start,
      v_today as previous_end
    union all
    select
      'weekly',
      v_week_start,
      v_week_start + 7,
      v_week_start - 7,
      v_week_start
    union all
    select
      'monthly',
      v_month_start,
      (v_month_start + interval '1 month')::date,
      (v_month_start - interval '1 month')::date,
      v_month_start
  ),
  order_events as (
    select
      (orders.created_at at time zone 'Africa/Cairo')::date as event_date,
      orders.total_amount::numeric as amount,
      orders.status not in ('cancelled', 'refunded') as revenue_eligible
    from public.customer_orders as orders

    union all

    select
      (sales.created_at at time zone 'Africa/Cairo')::date,
      sales.total_amount::numeric,
      true
    from public.commerce_sales_orders as sales
  ),
  sales_events as (
    select
      (orders.created_at at time zone 'Africa/Cairo')::date as event_date,
      items.quantity::numeric as units
    from public.customer_order_items as items
    join public.customer_orders as orders
      on orders.id = items.order_id
    where orders.status not in ('cancelled', 'refunded')

    union all

    select
      (sales.created_at at time zone 'Africa/Cairo')::date,
      items.quantity::numeric
    from public.commerce_sales_items as items
    join public.commerce_sales_orders as sales
      on sales.id = items.sales_order_id
  )
  select jsonb_object_agg(
    periods.period_key,
    jsonb_build_object(
      'current', jsonb_build_object(
        'orders', (
          select count(*)
          from order_events
          where event_date >= periods.current_start
            and event_date < periods.current_end
        ),
        'sales', (
          select coalesce(sum(units), 0)
          from sales_events
          where event_date >= periods.current_start
            and event_date < periods.current_end
        ),
        'revenue', (
          select coalesce(sum(amount), 0)
          from order_events
          where event_date >= periods.current_start
            and event_date < periods.current_end
            and revenue_eligible
        )
      ),
      'previous', jsonb_build_object(
        'orders', (
          select count(*)
          from order_events
          where event_date >= periods.previous_start
            and event_date < periods.previous_end
        ),
        'sales', (
          select coalesce(sum(units), 0)
          from sales_events
          where event_date >= periods.previous_start
            and event_date < periods.previous_end
        ),
        'revenue', (
          select coalesce(sum(amount), 0)
          from order_events
          where event_date >= periods.previous_start
            and event_date < periods.previous_end
            and revenue_eligible
        )
      )
    )
  )
  into v_result
  from periods;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;


--
-- Name: default_admin_permissions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.default_admin_permissions() RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
 select public.default_admin_permissions_before_claim_communications()||jsonb_build_object('claims.communications.view',false,'claims.communications.manage',false);
$$;


--
-- Name: default_admin_permissions_before_claim_communications(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.default_admin_permissions_before_claim_communications() RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
 select public.default_admin_permissions_before_email() || jsonb_build_object('email.view',false,'email.settings.view',false,'email.settings.manage',false,'email.templates.view',false,'email.templates.manage',false,'email.transactional.send',false,'email.history.view',false,'email.marketing.manage',false);
$$;


--
-- Name: default_admin_permissions_before_claims(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.default_admin_permissions_before_claims() RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    AS $$
  select jsonb_build_object(
    'dashboard.view',false,'dashboard.analysis',false,'dashboard.orders',false,
    'products.view',false,'products.add',false,'products.edit',false,
    'categories.view',false,'categories.add',false,'categories.edit',false,
    'brands.view',false,'brands.add',false,'brands.edit',false,'reviews.view',false,'reviews.delete',false,
    'settings.view',false,'settings.edit',false,'settings.coupons',false,'users.view',false,'hr.view',false,'hr.edit',false,
    'treasury.view',false,'treasury.edit',false,'documents.view',false,'documents.manage',false,
    'pages.view',false,'pages.edit',false,'help.view',false,'help.edit',false,
    'support.view',false,'support.reply',false,'support.manage',false,
    'sms.view',false,'sms.settings.view',false,'sms.settings.manage',false,'sms.templates.view',false,
    'sms.templates.manage',false,'sms.history.view',false,'sms.notification.send',false,'sms.campaign.send',false
  );
$$;


--
-- Name: default_admin_permissions_before_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.default_admin_permissions_before_email() RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select public.default_admin_permissions_before_reverse() || jsonb_build_object('claims.logistics.view',false,'claims.logistics.create',false,'claims.logistics.retry',false,'claims.logistics.diagnostics',false);
$$;


--
-- Name: default_admin_permissions_before_reverse(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.default_admin_permissions_before_reverse() RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select public.default_admin_permissions_before_claims() || jsonb_build_object(
    'claims.view',false,'claims.review',false,'claims.manage',false,'claims.evidence',false,
    'claims.notes',false,'claims.decide',false,'claims.resolution',false);
$$;


--
-- Name: document_set_item_tags(text, uuid, uuid[], uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.document_set_item_tags(p_item_type text, p_item_id uuid, p_tag_ids uuid[], p_admin_user_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if p_item_type = 'file' then
    delete from public.document_file_tags where document_id = p_item_id;
    insert into public.document_file_tags (document_id, tag_id, added_by)
    select p_item_id, tag_id, p_admin_user_id from unnest(p_tag_ids) as tag_id;
  elsif p_item_type = 'folder' then
    delete from public.document_folder_tags where folder_id = p_item_id;
    insert into public.document_folder_tags (folder_id, tag_id, added_by)
    select p_item_id, tag_id, p_admin_user_id from unnest(p_tag_ids) as tag_id;
  else
    raise exception 'Unsupported document item type.' using errcode = '22023';
  end if;
end;
$$;


--
-- Name: email_assert_staff(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.email_assert_staff(p_actor uuid, p_permission text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
 if not exists(select 1 from public.admin_users a where a.id=p_actor and a.is_active and (a.role='owner' or coalesce((a.permissions->>'email.view')::boolean,false) and coalesce((a.permissions->>p_permission)::boolean,false) and (p_permission<>'email.settings.manage' or coalesce((a.permissions->>'email.settings.view')::boolean,false)) and (p_permission<>'email.templates.manage' or coalesce((a.permissions->>'email.templates.view')::boolean,false)))) then raise exception 'Email permission denied.' using errcode='42501'; end if;
end $$;


--
-- Name: email_audit(uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.email_audit(p_actor uuid, p_action text, p_metadata jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
 insert into public.admin_activity_logs(admin_user_id,author_name,author_email,author_role,action_key,description,metadata)
 select a.id,coalesce(nullif(a.full_name,''),a.email),a.email,a.role,p_action,'Updated email foundation.',p_metadata from public.admin_users a where a.id=p_actor;
end $$;


--
-- Name: email_command(text, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.email_command(p_action text, p_input jsonb DEFAULT '{}'::jsonb, p_actor uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: email_command_before_claim_communications(text, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.email_command_before_claim_communications(p_action text, p_input jsonb DEFAULT '{}'::jsonb, p_actor uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: email_event_rank(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.email_event_rank(p_type text) RETURNS integer
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
 select coalesce(array_position(array['sent','deferred','soft_bounce','delivered','error','blocked','unsubscribed','hard_bounce','invalid_email','spam'],p_type),0);
$$;


--
-- Name: email_provider_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_provider_settings (
    id text NOT NULL,
    config jsonb DEFAULT '{"reply_to": "", "is_enabled": false, "timeout_ms": 10000, "webhook_enabled": false, "account_approved": false, "approved_senders": [], "marketing_sender": "", "marketing_enabled": false, "unsubscribe_origin": "", "activation_confirmed": false, "transactional_sender": ""}'::jsonb NOT NULL,
    api_key_encrypted text,
    webhook_token_encrypted text,
    revision integer DEFAULT 0 NOT NULL,
    next_dispatch_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    updated_by uuid,
    CONSTRAINT email_provider_settings_api_key_encrypted_check CHECK (((api_key_encrypted IS NULL) OR (api_key_encrypted ~~ 'v1.%'::text))),
    CONSTRAINT email_provider_settings_config_check CHECK ((jsonb_typeof(config) = 'object'::text)),
    CONSTRAINT email_provider_settings_id_check CHECK ((id = 'brevo'::text)),
    CONSTRAINT email_provider_settings_revision_check CHECK ((revision >= 0)),
    CONSTRAINT email_provider_settings_webhook_token_encrypted_check CHECK (((webhook_token_encrypted IS NULL) OR (webhook_token_encrypted ~~ 'v1.%'::text)))
);


--
-- Name: email_ready(public.email_provider_settings); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.email_ready(s public.email_provider_settings) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
 select coalesce((s.config->>'is_enabled')::boolean,false) and s.api_key_encrypted is not null and coalesce((s.config->>'account_approved')::boolean,false) and coalesce((s.config->>'activation_confirmed')::boolean,false)
 and exists(select 1 from jsonb_array_elements(s.config->'approved_senders') x where x->>'email'=s.config->>'transactional_sender' and (x->>'verified')::boolean);
$$;


--
-- Name: email_write_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.email_write_guard() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
 if tg_op in ('DELETE','TRUNCATE') or current_setting('app.email_write',true) is distinct from 'on' then raise exception 'Canonical email operation required.' using errcode='42501'; end if;
 if tg_op='UPDATE' then
  if tg_table_name='email_events' then raise exception 'Email events are immutable.' using errcode='42501'; end if;
  if tg_table_name='email_messages' and (to_jsonb(new)-array['state','delivery_state','delivery_at','opened_at','provider_message_id','attempts','error_category','work_token','started_at','dispatched_at','next_attempt_at','accepted_at','updated_at']) is distinct from (to_jsonb(old)-array['state','delivery_state','delivery_at','opened_at','provider_message_id','attempts','error_category','work_token','started_at','dispatched_at','next_attempt_at','accepted_at','updated_at']) then raise exception 'Email intent is immutable.' using errcode='42501'; end if;
  if tg_table_name='email_messages' and to_jsonb(old)->>'provider_message_id' is not null and to_jsonb(new)->>'provider_message_id' is distinct from to_jsonb(old)->>'provider_message_id' then raise exception 'Email provider identity is immutable.' using errcode='42501'; end if;
 end if;
 return new;
end $$;


--
-- Name: enforce_commerce_crm_activity_transition(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_commerce_crm_activity_transition() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  -- Preserve activity history when an admin account is removed. The foreign
  -- keys may only clear their attribution columns; no activity data can change.
  if new.id is not distinct from old.id
    and new.crm_account_id is not distinct from old.crm_account_id
    and new.activity_type is not distinct from old.activity_type
    and new.status is not distinct from old.status
    and new.subject is not distinct from old.subject
    and new.notes is not distinct from old.notes
    and new.priority is not distinct from old.priority
    and new.occurred_at is not distinct from old.occurred_at
    and new.closed_at is not distinct from old.closed_at
    and new.resolution is not distinct from old.resolution
    and new.created_at is not distinct from old.created_at
    and new.updated_at is not distinct from old.updated_at
    and (
      new.created_by is not distinct from old.created_by
      or (old.created_by is not null and new.created_by is null)
    )
    and (
      new.closed_by is not distinct from old.closed_by
      or (old.closed_by is not null and new.closed_by is null)
    )
    and (
      new.created_by is distinct from old.created_by
      or new.closed_by is distinct from old.closed_by
    ) then
    new.updated_at := old.updated_at;
    return new;
  end if;

  if old.activity_type <> 'case'
    or old.status <> 'raised'
    or new.activity_type <> 'case'
    or new.status <> 'closed' then
    raise exception using
      errcode = 'P0001',
      message = 'CRM activities are immutable except when closing a raised case.';
  end if;

  if new.id is distinct from old.id
    or new.crm_account_id is distinct from old.crm_account_id
    or new.subject is distinct from old.subject
    or new.notes is distinct from old.notes
    or new.priority is distinct from old.priority
    or new.occurred_at is distinct from old.occurred_at
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = 'P0001',
      message = 'A raised case cannot be rewritten while it is being closed.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: enforce_customer_profile_internal_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_customer_profile_internal_identity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended(
      'store-analytics-internal-user:' || new.id::text,
      0
    )
  );

  new.is_internal := exists (
    select 1
    from public.store_analytics_internal_users as internal_users
    where internal_users.user_id = new.id
  );

  return new;
end;
$$;


--
-- Name: enforce_nps_response_cooldown(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_nps_response_cooldown() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
begin
  -- Derive this again here so correctness does not depend on the ordering of
  -- multiple BEFORE INSERT triggers.
  if new.user_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(
        'store-analytics-internal-user:' || new.user_id::text,
        0
      )
    );
  end if;

  new.is_internal := exists (
    select 1
    from public.store_analytics_internal_users as internal_users
    where internal_users.user_id = new.user_id
  );

  if new.is_internal then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('visitor:' || new.visitor_id::text, 0)
  );

  if new.user_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended('user:' || new.user_id::text, 0)
    );
  end if;

  if exists (
    select 1
    from public.nps_responses as responses
    where responses.response_id <> new.response_id
      and responses.is_internal = false
      and responses.created_at >= now() - interval '90 days'
      and (
        (
          new.user_id is not null
          and (
            responses.user_id = new.user_id
            or responses.visitor_id = new.visitor_id
          )
        )
        or (
          new.user_id is null
          and responses.user_id is null
          and responses.visitor_id = new.visitor_id
        )
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'NPS response cooldown is active.';
  end if;

  return new;
end;
$$;


--
-- Name: enforce_nps_response_internal_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_nps_response_internal_identity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.user_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(
        'store-analytics-internal-user:' || new.user_id::text,
        0
      )
    );
  end if;

  if tg_op = 'UPDATE' and old.is_internal then
    new.is_internal := true;
    return new;
  end if;

  new.is_internal := exists (
    select 1
    from public.store_analytics_internal_users as internal_users
    where internal_users.user_id = new.user_id
  );

  return new;
end;
$$;


--
-- Name: enforce_product_review_account_eligibility(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_product_review_account_eligibility() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_account_created_at timestamp with time zone;
begin
  select users.created_at
  into v_account_created_at
  from auth.users as users
  where users.id = new.user_id;

  if v_account_created_at is null then
    raise exception using
      errcode = 'P0001',
      message = 'PRODUCT_REVIEW_ACCOUNT_NOT_FOUND';
  end if;

  if v_account_created_at > pg_catalog.statement_timestamp() - interval '1 hour' then
    perform orders.id
    from public.customer_orders as orders
    where orders.user_id = new.user_id
      and orders.status in ('completed', 'delivered')
    limit 1
    for share;

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'PRODUCT_REVIEW_ACCOUNT_TOO_NEW';
    end if;
  end if;

  return new;
end;
$$;


--
-- Name: enforce_store_analytics_session_internal_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_store_analytics_session_internal_identity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.user_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(
        'store-analytics-internal-user:' || new.user_id::text,
        0
      )
    );
  end if;

  if tg_op = 'UPDATE' and old.is_internal then
    new.is_internal := true;
    return new;
  end if;

  new.is_internal := exists (
    select 1
    from public.store_analytics_internal_users as internal_users
    where internal_users.user_id = new.user_id
  );

  return new;
end;
$$;


--
-- Name: enqueue_daftra_order_sync(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enqueue_daftra_order_sync() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if public.get_active_erp_mode()<>'daftra' or new.erp_owner<>'daftra' or new.is_preorder then return new; end if;
  if tg_op='UPDATE' and new.status is not distinct from old.status then return new; end if;
  insert into public.erp_sync_jobs(operation,local_entity_type,local_id,dedupe_key,payload)
  values('order.export','customer_order',new.id,'daftra:order:'||new.id::text||':status:'||new.status,jsonb_build_object('order_status',new.status))
  on conflict(dedupe_key) do nothing;
  return new;
end;
$$;


--
-- Name: erp_apply_inventory_cache(jsonb, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.erp_apply_inventory_cache(p_rows jsonb, p_fetched_at timestamp with time zone) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare r jsonb; count_rows integer:=0; product uuid;
begin
  perform 1 from public.site_settings where key='default' for share;
  if public.get_active_erp_mode()<>'daftra' then raise exception 'Daftra is not active.'; end if;
  for r in select value from jsonb_array_elements(p_rows) order by value->>'product_id',value->>'local_id' loop
    product:=(r->>'product_id')::uuid;
    perform 1 from public.products where id=product for update;
    if not found then raise exception 'The mapped product no longer exists.'; end if;
    if r->>'local_entity_type'='product' and (r->>'local_id')::uuid<>product then raise exception 'Invalid product mapping.'; end if;
    if r->>'local_entity_type'='product_variant' and not exists(select 1 from public.product_variants where id=(r->>'local_id')::uuid and product_id=product) then raise exception 'Invalid variant mapping.'; end if;
    insert into public.erp_inventory_cache(local_entity_type,local_id,product_id,external_id,quantity,cost,fetched_at)
    values(r->>'local_entity_type',(r->>'local_id')::uuid,product,r->>'external_id',(r->>'quantity')::integer,(r->>'cost')::numeric,p_fetched_at)
    on conflict(local_entity_type,local_id) do update set external_id=excluded.external_id,quantity=excluded.quantity,cost=excluded.cost,fetched_at=excluded.fetched_at
      where public.erp_inventory_cache.fetched_at<=excluded.fetched_at;
    insert into public.erp_entity_links(provider,local_entity_type,local_id,external_entity_type,external_id,external_number,metadata,last_synced_at,updated_at)
      values('daftra',r->>'local_entity_type',(r->>'local_id')::uuid,'product',r->>'external_id',r->>'code','{"source":"inventory-import"}',clock_timestamp(),clock_timestamp())
      on conflict(provider,local_entity_type,local_id) do update set last_synced_at=excluded.last_synced_at,updated_at=excluded.updated_at
        where public.erp_entity_links.external_id=excluded.external_id;
    if not found then raise exception 'ERP item mapping conflicts with an existing link.'; end if;
    -- Clear only after processed invoice stock transactions were verified,
    -- followed by this later authoritative product-balance fetch.
    delete from public.erp_stock_reservations reservations using public.customer_order_items items,public.erp_entity_links links
      where reservations.order_item_id=items.id and items.order_id=links.local_id
        and links.provider='daftra' and links.local_entity_type='customer_order'
        and links.metadata->>'daftraDraft'='false' and (links.metadata->>'stockVerifiedAt')::timestamptz<p_fetched_at
        and reservations.local_entity_type=r->>'local_entity_type' and reservations.local_id=(r->>'local_id')::uuid;
    count_rows:=count_rows+1;
  end loop;
  return count_rows;
end;
$$;


--
-- Name: erp_change_mode(uuid, text, bigint, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.erp_change_mode(p_admin_id uuid, p_mode text, p_expected_version bigint, p_choice text, p_review_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare s public.site_settings%rowtype; run public.erp_sync_runs%rowtype; a public.admin_users%rowtype; job_id uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Server authorization required.'; end if;
  select * into a from public.admin_users where id=p_admin_id and is_active;
  if not found or not (a.role='owner' or coalesce((a.permissions->>'settings.edit')::boolean,false)) then raise exception 'Not authorized'; end if;
  select * into s from public.site_settings where key='default' for update;
  if not found or s.erp_state_version<>p_expected_version then raise exception 'ERP settings changed. Reload and review again.'; end if;
  if p_mode not in ('built_in','daftra') or p_choice not in ('switch_only','synchronize','without_import') then raise exception 'Choose a valid ERP transition.'; end if;
  if p_mode=s.erp_mode then return jsonb_build_object('mode',s.erp_mode); end if;
  if exists(select 1 from public.erp_worker_leases where expires_at>clock_timestamp()) then raise exception 'Wait for the current ERP job to finish.'; end if;
  if p_mode='daftra' then
    if p_choice not in ('switch_only','synchronize') then raise exception 'Choose a Daftra activation option.'; end if;
    if s.daftra_connection_status<>'connected' or s.daftra_tested_revision is distinct from coalesce((select credential_revision from public.erp_provider_settings where id='daftra'),0) then raise exception 'Test the saved Daftra credentials before activation.'; end if;
    if p_choice='synchronize' then
      select * into run from public.erp_sync_runs where id=p_review_id for update;
      if not found or run.status<>'review' or run.actor_id is distinct from p_admin_id or run.state_version<>s.erp_state_version
        or run.created_at<clock_timestamp()-interval '30 minutes' or run.manifest->>'operation' is distinct from 'inventory.import' then raise exception 'A current synchronization review is required.'; end if;
      update public.erp_sync_runs set status='queued',updated_at=clock_timestamp() where id=run.id;
      insert into public.erp_sync_jobs(operation,local_entity_type,local_id,dedupe_key,payload,sync_run_id)
        values('inventory.import','sync_run',run.id,'daftra:run:'||run.id,jsonb_build_object('direction','daftra_to_elcomputer'),run.id) returning id into job_id;
    end if;
  elsif p_choice<>'without_import' then raise exception 'Switch back without import is required.'; end if;
  update public.site_settings set erp_mode=p_mode,erp_state_version=erp_state_version+1,updated_at=clock_timestamp() where key='default';
  insert into public.admin_activity_logs(admin_user_id,author_name,author_email,author_role,action_key,description,metadata)
    values(a.id,coalesce(a.full_name,a.email),a.email,a.role,'settings.erp.mode-update',
      'Changed the active ERP provider.',jsonb_build_object('previousMode',s.erp_mode,'mode',p_mode,'choice',p_choice,'syncRunId',run.id));
  return jsonb_build_object('mode',p_mode,'syncRunId',run.id,'jobId',job_id);
end;
$$;


--
-- Name: erp_create_external_customer_order(uuid, jsonb, jsonb, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.erp_create_external_customer_order(p_user_id uuid, p_order jsonb, p_items jsonb, p_allow_out_of_stock boolean, p_cart_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_existing_order public.customer_orders%rowtype;
  v_order public.customer_orders%rowtype;
  v_order_item public.customer_order_items%rowtype;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_coupon public.site_coupons%rowtype;
  v_unit public.commerce_serialized_units%rowtype;
  v_item jsonb;
  v_normalized_items jsonb := '[]'::jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_unit_price numeric(12, 2);
  v_line_total numeric(12, 2);
  v_subtotal numeric(12, 2) := 0;
  v_discount numeric(12, 2) := 0;
  v_total numeric(12, 2) := 0;
  v_coupon_code text;
  v_order_number text;
  v_available_units integer;
  v_assigned_units integer;
  v_total_assigned_units integer := 0;
  v_updated_rows integer;
  v_warehouse_quantity integer;
  v_has_warehouse_inventory boolean;
begin
  perform 1 from public.site_settings where key='default' for share;
  if public.get_active_erp_mode()<>'daftra' then raise exception 'Daftra is not active.'; end if;
  if auth.role() is distinct from 'service_role' then raise exception 'Server authorization required.'; end if;
  if p_user_id is null or not exists (
    select 1
    from auth.users as users
    where users.id = p_user_id
  ) then
    raise exception 'A valid signed-in customer is required.';
  end if;

  -- A cart retry must return before coupon, inventory, or order writes. The
  -- advisory lock closes the race between two simultaneous requests.
  if p_cart_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        p_user_id::text || ':' || p_cart_id::text,
        0
      )
    );

    select orders.*
    into v_existing_order
    from public.customer_orders as orders
    where orders.user_id = p_user_id
      and orders.checkout_cart_id = p_cart_id
    limit 1;

    if found then
      return jsonb_build_object(
        'order', to_jsonb(v_existing_order),
        'created', false,
        'serialized_units_assigned', 0
      );
    end if;
  end if;

  if p_order is null or jsonb_typeof(p_order) <> 'object' then
    raise exception 'A valid order is required.';
  end if;

  if p_items is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0
  then
    raise exception 'At least one order item is required.';
  end if;

  if jsonb_array_length(p_items) > 100 then
    raise exception 'An order cannot contain more than 100 item lines.';
  end if;

  if nullif(btrim(p_order ->> 'first_name'), '') is null
    or nullif(btrim(p_order ->> 'phone'), '') is null
    or nullif(btrim(p_order ->> 'street_address'), '') is null
    or nullif(btrim(p_order ->> 'city'), '') is null
    or nullif(btrim(p_order ->> 'governorate'), '') is null
  then
    raise exception 'Complete customer and delivery details are required.';
  end if;

  -- Lock products in a deterministic order. Prices, snapshots, and availability
  -- are derived here instead of trusting browser-submitted line totals.
  for v_item in
    select item_rows.value
    from jsonb_array_elements(p_items) as item_rows(value)
    order by
      item_rows.value ->> 'product_id',
      coalesce(item_rows.value ->> 'variant_id', '')
  loop
    v_product_id := nullif(btrim(v_item ->> 'product_id'), '')::uuid;
    v_variant_id := nullif(btrim(v_item ->> 'variant_id'), '')::uuid;
    v_quantity := coalesce((v_item ->> 'quantity')::integer, 0);

    if v_product_id is null or v_quantity < 1 or v_quantity > 99 then
      raise exception 'Every order line requires a valid product and quantity.';
    end if;

    select products.*
    into v_product
    from public.products as products
    where products.id = v_product_id
    for update;

    if not found or not v_product.is_published or v_product.selling_mode <> 'normal' then
      raise exception 'One or more products are no longer available.';
    end if;

    if public.erp_storefront_stock(case when v_product.is_serialized then 'product_variant' else 'product' end,
      coalesce(v_variant_id,v_product_id),0)<v_quantity
      and (v_product.is_serialized or not coalesce(p_allow_out_of_stock,false)) then
      raise exception 'Not enough cached Daftra stock is available.';
    end if;
    if v_product.is_serialized then
      if v_variant_id is null then
        raise exception 'A product model is required for serialized inventory.';
      end if;

      if v_product.primary_warehouse_id is null then
        raise exception 'The serialized product does not have a primary warehouse.';
      end if;

      select variants.*
      into v_variant
      from public.product_variants as variants
      where variants.id = v_variant_id
        and variants.product_id = v_product_id
        and variants.is_active
      for update;

      if not found then
        raise exception 'The selected product model is no longer available.';
      end if;

      select count(*)::integer
      into v_available_units
      from public.commerce_serialized_units as units
      where units.product_id = v_product_id
        and units.variant_id = v_variant_id
        and units.warehouse_id = v_product.primary_warehouse_id
        and units.status = 'in_stock';

      if v_available_units < v_quantity then
        raise exception
          'Not enough serialized units are available for one of the selected models.';
      end if;

      -- Variants currently represent color/model identity, while the product
      -- owns the storefront price. This also prevents stale copied prices when
      -- an admin changes the parent product price.
      v_unit_price := round(coalesce(v_product.price, 0)::numeric, 2);
    else
      if v_variant_id is not null then
        raise exception 'Standard products cannot be ordered with a variant.';
      end if;

      if not coalesce(p_allow_out_of_stock, false)
        and public.erp_storefront_stock('product',v_product.id,0) < v_quantity
      then
        raise exception 'One or more products do not have enough stock.';
      end if;

      v_unit_price := round(coalesce(v_product.price, 0)::numeric, 2);
    end if;

    v_line_total := round((v_unit_price * v_quantity)::numeric, 2);
    v_subtotal := round((v_subtotal + v_line_total)::numeric, 2);

    v_normalized_items := v_normalized_items || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product.id,
        'variant_id', case
          when v_product.is_serialized then v_variant.id
          else null
        end,
        'product_title', v_product.title,
        'product_slug', v_product.slug,
        'image_url', v_product.image_url,
        'variant_name', case
          when v_product.is_serialized then v_variant.name
          else null
        end,
        'variant_code', case
          when v_product.is_serialized then v_variant.code
          else null
        end,
        'variant_sku', case
          when v_product.is_serialized then v_variant.sku
          else null
        end,
        'variant_color_name', case
          when v_product.is_serialized then v_variant.color_name
          else null
        end,
        'variant_color_hex', case
          when v_product.is_serialized then v_variant.color_hex
          else null
        end,
        'is_serialized', v_product.is_serialized,
        'primary_warehouse_id', v_product.primary_warehouse_id,
        'unit_cost', coalesce(
          case
            when v_product.is_serialized then v_variant.cost_price
            else v_product.cost_price
          end,
          0
        ),
        'unit_price', v_unit_price,
        'quantity', v_quantity,
        'line_total', v_line_total
      )
    );
  end loop;

  v_coupon_code := upper(nullif(btrim(p_order ->> 'coupon_code'), ''));

  if v_coupon_code is not null then
    select coupons.*
    into v_coupon
    from public.site_coupons as coupons
    where upper(coupons.code) = v_coupon_code
    for update;

    if not found
      or not v_coupon.is_active
      or (v_coupon.starts_at is not null and v_coupon.starts_at > now())
      or (v_coupon.ends_at is not null and v_coupon.ends_at < now())
      or v_subtotal < v_coupon.minimum_order_amount
      or (
        v_coupon.usage_limit is not null
        and v_coupon.usage_count >= v_coupon.usage_limit
      )
    then
      raise exception 'The coupon is no longer valid for this order.';
    end if;

    if v_coupon.discount_type = 'percentage' then
      v_discount := least(
        v_subtotal,
        round(
          (v_subtotal * v_coupon.discount_value / 100)::numeric,
          2
        )
      );
    else
      v_discount := least(
        v_subtotal,
        round(v_coupon.discount_value::numeric, 2)
      );
    end if;
  end if;

  v_total := round(greatest(v_subtotal - v_discount, 0)::numeric, 2);
  v_order_number := coalesce(
    nullif(btrim(p_order ->> 'order_number'), ''),
    'ORD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 18))
  );

  insert into public.customer_orders (
    user_id,
    checkout_cart_id,
    order_number,
    status,
    first_name,
    last_name,
    email,
    phone,
    street_address,
    city,
    governorate,
    shipping_method,
    payment_method,
    subtotal_amount,
    discount_amount,
    coupon_code,
    total_amount,
    currency,
    updated_at
  )
  values (
    p_user_id,
    p_cart_id,
    v_order_number,
    'pending_payment',
    btrim(p_order ->> 'first_name'),
    nullif(btrim(p_order ->> 'last_name'), ''),
    nullif(btrim(p_order ->> 'email'), ''),
    btrim(p_order ->> 'phone'),
    btrim(p_order ->> 'street_address'),
    btrim(p_order ->> 'city'),
    btrim(p_order ->> 'governorate'),
    nullif(btrim(p_order ->> 'shipping_method'), ''),
    nullif(btrim(p_order ->> 'payment_method'), ''),
    v_subtotal,
    v_discount,
    case when v_coupon_code is not null then v_coupon.code else null end,
    v_total,
    coalesce(nullif(btrim(p_order ->> 'currency'), ''), 'EGP'),
    now()
  )
  returning * into v_order;

  perform set_config('app.erp_fulfilment_write','on',true);

  for v_item in
    select item_rows.value
    from jsonb_array_elements(v_normalized_items) as item_rows(value)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_variant_id := nullif(v_item ->> 'variant_id', '')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    v_unit_price := (v_item ->> 'unit_price')::numeric;
    v_line_total := (v_item ->> 'line_total')::numeric;
    if public.erp_storefront_stock(case when v_variant_id is not null then 'product_variant' else 'product' end,
      coalesce(v_variant_id,v_product_id),0)<v_quantity
      and (v_variant_id is not null or not coalesce(p_allow_out_of_stock,false)) then
      raise exception 'Not enough cached Daftra stock remained available.';
    end if;

    insert into public.customer_order_items (
      order_id,
      product_id,
      variant_id,
      product_title,
      product_slug,
      image_url,
      variant_name,
      variant_code,
      variant_sku,
      variant_color_name,
      variant_color_hex,
      unit_price,
      quantity,
      line_total
    )
    values (
      v_order.id,
      v_product_id,
      v_variant_id,
      v_item ->> 'product_title',
      nullif(v_item ->> 'product_slug', ''),
      nullif(v_item ->> 'image_url', ''),
      nullif(v_item ->> 'variant_name', ''),
      nullif(v_item ->> 'variant_code', ''),
      nullif(v_item ->> 'variant_sku', ''),
      nullif(v_item ->> 'variant_color_name', ''),
      nullif(v_item ->> 'variant_color_hex', ''),
      v_unit_price,
      v_quantity,
      v_line_total
    )
    returning * into v_order_item;

    if (v_item ->> 'is_serialized')::boolean then
      v_assigned_units := 0;

      for v_unit in
        select units.*
        from public.commerce_serialized_units as units
        where units.product_id = v_product_id
          and units.variant_id = v_variant_id
          and units.warehouse_id =
            (v_item ->> 'primary_warehouse_id')::uuid
          and units.status = 'in_stock'
        order by units.created_at, units.id
        limit v_quantity
        for update
      loop
        update public.commerce_serialized_units
        set
          status = 'sold',
          customer_order_id = v_order.id,
          customer_order_item_id = v_order_item.id,
          customer_user_id = p_user_id,
          sold_at = now(),
          returned_at = null,
          updated_at = now()
        where id = v_unit.id;

        insert into public.commerce_serialized_unit_movements (
          unit_id,
          product_id,
          variant_id,
          warehouse_id,
          customer_order_id,
          movement_type,
          from_status,
          to_status,
          notes
        )
        values (
          v_unit.id,
          v_product_id,
          v_variant_id,
          (v_item ->> 'primary_warehouse_id')::uuid,
          v_order.id,
          'sold',
          'in_stock',
          'sold',
          'Assigned during atomic online checkout.'
        );

        v_assigned_units := v_assigned_units + 1;
      end loop;

      if v_assigned_units <> v_quantity then
        raise exception
          'Not enough serialized units remained available during checkout.';
      end if;

      v_total_assigned_units := v_total_assigned_units + v_assigned_units;
    end if;
    -- Platform reservations leave all built-in balances and costing untouched.
    if public.erp_storefront_stock(case when v_variant_id is not null then 'product_variant' else 'product' end,
      coalesce(v_variant_id,v_product_id),0)<v_quantity and v_variant_id is null and not coalesce(p_allow_out_of_stock,false) then
      raise exception 'Not enough cached Daftra stock remained available.';
    end if;
    insert into public.erp_stock_reservations(order_item_id,local_entity_type,local_id,quantity)
      values(v_order_item.id,case when v_variant_id is not null then 'product_variant' else 'product' end,
        coalesce(v_variant_id,v_product_id),v_quantity);
  end loop;
  perform set_config('app.erp_fulfilment_write','off',true);

  if v_coupon_code is not null then
    update public.site_coupons
    set
      usage_count = usage_count + 1,
      updated_at = now()
    where id = v_coupon.id;
  end if;

  return jsonb_build_object(
    'order', to_jsonb(v_order),
    'created', true,
    'serialized_units_assigned', v_total_assigned_units
  );
end;
$$;


--
-- Name: erp_finalize_inventory_cache(text[], timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.erp_finalize_inventory_cache(p_external_ids text[], p_fetched_at timestamp with time zone) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if public.get_active_erp_mode()<>'daftra' then raise exception 'Daftra is not active.'; end if;
  update public.erp_inventory_cache set quantity=0,fetched_at=p_fetched_at
    where not (external_id=any(p_external_ids)) and fetched_at<=p_fetched_at;
end;
$$;


--
-- Name: erp_finish_daftra_job(uuid, uuid, boolean, jsonb, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.erp_finish_daftra_job(p_job_id uuid, p_token uuid, p_success boolean, p_result jsonb, p_error text, p_delay integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare job public.erp_sync_jobs%rowtype;
begin
  select * into job from public.erp_sync_jobs where id=p_job_id for update;
  if not found or job.status<>'processing' or job.lease_token is distinct from p_token then raise exception 'ERP worker lease was lost.'; end if;
  update public.erp_sync_jobs set status=case when p_success then 'completed' else 'failed' end,
    result=coalesce(p_result,'{}'),last_error=case when p_success then null else p_error end,
    available_at=clock_timestamp()+make_interval(secs=>greatest(0,least(coalesce(p_delay,60),3600))),
    completed_at=case when p_success then clock_timestamp() else null end,locked_at=null,lease_token=null,updated_at=clock_timestamp() where id=p_job_id;
  update public.erp_worker_leases set token=null,expires_at=null where provider='daftra' and token=p_token;
  if job.sync_run_id is not null then update public.erp_sync_runs set status=case when p_success then 'completed' else 'failed' end,
    result=coalesce(p_result,'{}'),last_error=case when p_success then null else p_error end,updated_at=clock_timestamp() where id=job.sync_run_id; end if;
end;
$$;


--
-- Name: erp_guard_catalog_inventory(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.erp_guard_catalog_inventory() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if public.get_active_erp_mode() <> 'daftra' then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    raise exception using errcode='42501', message='ERP inventory records are retained while Daftra is active.';
  end if;
  if tg_op = 'INSERT' then
    if new.stock_quantity <> 0 or coalesce(new.cost_price,0) <> 0 then
      raise exception using errcode='42501', message='Inventory quantity and cost are managed in Daftra.';
    end if;
  elsif new.stock_quantity is distinct from old.stock_quantity or new.cost_price is distinct from old.cost_price
    or (tg_table_name='products' and to_jsonb(new)->'is_serialized' is distinct from to_jsonb(old)->'is_serialized')
    or (tg_table_name='product_variants' and to_jsonb(new)->'product_id' is distinct from to_jsonb(old)->'product_id')
    or (tg_table_name = 'products' and (to_jsonb(new)->'primary_warehouse_id' is distinct from to_jsonb(old)->'primary_warehouse_id'
      or to_jsonb(new)->'default_supplier_id' is distinct from to_jsonb(old)->'default_supplier_id')) then
    raise exception using errcode='42501', message='Inventory quantity, cost and warehouse are managed in Daftra.';
  end if;
  return new;
end;
$$;


--
-- Name: erp_guard_local_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.erp_guard_local_mutation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform public.assert_built_in_erp();
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;


--
-- Name: erp_guard_physical_units(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.erp_guard_physical_units() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if public.get_active_erp_mode()='daftra' then
    if auth.role()='service_role' and current_setting('app.erp_fulfilment_write',true)='on' then
      if tg_table_name='commerce_serialized_unit_movements' and tg_op='INSERT' then return new; end if;
      if tg_table_name='commerce_serialized_units' and tg_op='UPDATE'
        and (to_jsonb(new) - array['status','customer_order_id','customer_order_item_id','customer_user_id','sold_at','returned_at','updated_at'])
          = (to_jsonb(old) - array['status','customer_order_id','customer_order_item_id','customer_user_id','sold_at','returned_at','updated_at']) then return new; end if;
    end if;
    raise exception using errcode='42501', message='Serialized ERP operations require manual Daftra completion.';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;


--
-- Name: erp_guard_provider_state(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.erp_guard_provider_state() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if auth.role() is distinct from 'service_role' and (
    (tg_op='UPDATE' and (new.erp_mode is distinct from old.erp_mode
      or new.daftra_connection_status is distinct from old.daftra_connection_status
      or new.daftra_last_checked_at is distinct from old.daftra_last_checked_at
      or new.daftra_connected_at is distinct from old.daftra_connected_at
      or new.daftra_connection_error is distinct from old.daftra_connection_error
      or new.daftra_tested_revision is distinct from old.daftra_tested_revision
      or new.erp_state_version is distinct from old.erp_state_version))
    or (tg_op='INSERT' and (new.erp_mode <> 'built_in' or new.daftra_connection_status <> 'disconnected'))
    or tg_op='DELETE'
  ) then raise exception using errcode='42501', message='Use the ERP settings API.'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;


--
-- Name: erp_guard_return_state(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.erp_guard_return_state() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if tg_op='INSERT' then
    new.erp_provider:=public.get_active_erp_mode();
    new.erp_action_status:=case when new.erp_provider='daftra' then 'manual_required' else 'completed' end;
  elsif old.erp_provider='daftra' then
    if tg_op='DELETE' or new.erp_provider is distinct from old.erp_provider
      or new.erp_action_status is distinct from old.erp_action_status then
      raise exception 'Complete external returns manually in Daftra.';
    end if;
  elsif public.get_active_erp_mode()='daftra' then
    raise exception 'Built-in return history is retained while Daftra is active.';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;


--
-- Name: erp_guard_supplier(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.erp_guard_supplier() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if (case when tg_op='DELETE' then old.account_type else new.account_type end)='supplier'
    or (tg_op='UPDATE' and old.account_type='supplier') then perform public.assert_built_in_erp(); end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;


--
-- Name: erp_queue_inventory_refresh(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.erp_queue_inventory_refresh() RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare job_id uuid;
begin
  perform 1 from public.site_settings where key='default' for share;
  if public.get_active_erp_mode()<>'daftra' then raise exception 'Daftra is not active.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('daftra:inventory',0));
  select id into job_id from public.erp_sync_jobs where operation='inventory.import'
    and (status in ('pending','processing') or status='failed' and attempts<max_attempts) order by created_at limit 1;
  if found then return job_id; end if;
  -- At most one refresh per five minutes across manual and scheduled requests.
  select id into job_id from public.erp_sync_jobs where operation='inventory.import'
    and created_at>clock_timestamp()-interval '5 minutes' order by created_at desc limit 1;
  if found then return job_id; end if;
  insert into public.erp_sync_jobs(operation,local_entity_type,local_id,dedupe_key,payload)
    values('inventory.import','inventory',gen_random_uuid(),'daftra:inventory:'||gen_random_uuid(),'{"direction":"daftra_to_elcomputer"}') returning id into job_id;
  return job_id;
end;
$$;


--
-- Name: erp_record_daftra_test(bigint, boolean, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.erp_record_daftra_test(p_revision bigint, p_success boolean, p_checked_at timestamp with time zone) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform 1 from public.site_settings where key='default' for update;
  if coalesce((select credential_revision from public.erp_provider_settings where id='daftra'),0)<>p_revision then raise exception 'Credentials changed. Test the connection again.'; end if;
  update public.site_settings set daftra_connection_status=case when p_success then 'connected' else 'error' end,
    daftra_last_checked_at=p_checked_at,daftra_connected_at=case when p_success then p_checked_at else null end,
    daftra_connection_error=case when p_success then null else 'Daftra connection test failed.' end,
    daftra_tested_revision=p_revision,erp_state_version=erp_state_version+1,updated_at=clock_timestamp() where key='default';
end;
$$;


--
-- Name: erp_record_external_unit_return(uuid, uuid, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.erp_record_external_unit_return(p_unit_id uuid, p_warehouse_id uuid, p_reason text, p_notes text, p_admin_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare u public.commerce_serialized_units%rowtype; rid uuid;
begin
  perform 1 from public.site_settings where key='default' for share;
  if public.get_active_erp_mode()<>'daftra' or not exists(select 1 from public.admin_users a where a.id=p_admin_id and a.is_active and (a.role='owner' or coalesce((a.permissions->>'products.edit')::boolean,false))) then raise exception 'Not authorized'; end if;
  select * into u from public.commerce_serialized_units where id=p_unit_id for update;
  if not found or u.status<>'sold' or u.customer_order_item_id is null then raise exception 'A sold website item is required.'; end if;
  select i.order_return_id into rid from public.commerce_order_return_items i where i.serialized_unit_id=p_unit_id;
  if found then return rid; end if;
  insert into public.commerce_order_returns(order_id,warehouse_id,reason,notes,total_items,created_by,erp_provider,erp_action_status)
    values(u.customer_order_id,p_warehouse_id,p_reason,p_notes,1,p_admin_id,'daftra','manual_required') returning id into rid;
  insert into public.commerce_order_return_items(order_return_id,order_item_id,product_id,quantity,unit_price,serialized_unit_id)
    select rid,u.customer_order_item_id,u.product_id,1,i.unit_price,u.id from public.customer_order_items i where i.id=u.customer_order_item_id;
  return rid;
end;
$$;


--
-- Name: erp_retry_daftra_job(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.erp_retry_daftra_job(p_job_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if public.get_active_erp_mode()<>'daftra' then raise exception 'Daftra is not active.'; end if;
  update public.erp_sync_jobs set status='pending',attempts=0,available_at=clock_timestamp(),last_error=null,updated_at=clock_timestamp()
    where id=p_job_id and provider='daftra' and status='failed';
  if not found then raise exception 'Only failed jobs can be retried.'; end if;
  return p_job_id;
end;
$$;


--
-- Name: erp_save_daftra_credentials(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.erp_save_daftra_credentials(p_admin_id uuid, p_url text, p_key text, p_client text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare old_url text;
begin
  if auth.role() is distinct from 'service_role' or not exists(select 1 from public.admin_users a where a.id=p_admin_id and a.is_active and (a.role='owner' or coalesce((a.permissions->>'settings.edit')::boolean,false))) then raise exception 'Not authorized'; end if;
  perform 1 from public.site_settings where key='default' for update;
  if exists(select 1 from public.erp_worker_leases where expires_at>clock_timestamp()) then raise exception 'Wait for the current ERP job to finish.'; end if;
  select account_url into old_url from public.erp_provider_settings where id='daftra';
  if old_url is distinct from p_url and old_url is not null and (exists(select 1 from public.erp_entity_links) or exists(select 1 from public.erp_remote_writes)) then raise exception 'Account changes require manual mapping reconciliation.'; end if;
  insert into public.erp_provider_settings(id,account_url,api_key_encrypted,client_id_encrypted,updated_by,updated_at)
  values('daftra',p_url,p_key,p_client,p_admin_id,clock_timestamp())
  on conflict(id) do update set account_url=excluded.account_url,api_key_encrypted=excluded.api_key_encrypted,
    client_id_encrypted=excluded.client_id_encrypted,credential_revision=public.erp_provider_settings.credential_revision+1,updated_by=p_admin_id,updated_at=excluded.updated_at;
  update public.site_settings set daftra_connection_status='disconnected',daftra_last_checked_at=null,
    daftra_connected_at=null,daftra_connection_error=null,daftra_tested_revision=null,erp_state_version=erp_state_version+1,updated_at=clock_timestamp() where key='default';
end;
$$;


--
-- Name: erp_stamp_order_owner(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.erp_stamp_order_owner() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if tg_op='INSERT' then new.erp_owner:=public.get_active_erp_mode();
  elsif new.erp_owner is distinct from old.erp_owner then raise exception 'The order ERP owner cannot change.'; end if;
  return new;
end;
$$;


--
-- Name: erp_storefront_stock(text, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.erp_storefront_stock(p_type text, p_id uuid, p_fallback integer) RETURNS integer
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare q integer; physical integer; product uuid;
  can_read_private boolean:=coalesce(auth.role()='service_role',false) or coalesce(public.has_admin_permission('products.view'),false);
begin
  if public.get_active_erp_mode()<>'daftra' then return p_fallback; end if;
  select c.quantity-coalesce((select sum(r.quantity)::integer from public.erp_stock_reservations r
    where r.local_entity_type=c.local_entity_type and r.local_id=c.local_id),0),c.product_id
  into q,product from public.erp_inventory_cache c where c.local_entity_type=p_type and c.local_id=p_id;
  if q is null and p_type='product' and exists(select 1 from public.products where id=p_id and is_serialized and (is_published or can_read_private)) then
    select coalesce(sum(public.erp_storefront_stock('product_variant',v.id,0)),0)::integer into q
      from public.product_variants v where v.product_id=p_id and v.is_active;
    return q;
  end if;
  if q is null then return 0; end if;
  if not exists(select 1 from public.products p where p.id=product and (p.is_published or can_read_private)) then return 0; end if;
  if p_type='product_variant' and not exists(select 1 from public.product_variants v
    where v.id=p_id and v.product_id=product and v.is_active) then return 0; end if;
  if exists(select 1 from public.products p where p.id=product and p.is_serialized) then
    select count(*)::integer into physical from public.commerce_serialized_units u
      join public.products p on p.id=u.product_id
      where u.product_id=product and u.status='in_stock' and u.warehouse_id=p.primary_warehouse_id
        and (p_type='product' or u.variant_id=p_id);
    q:=least(q,physical);
  end if;
  return greatest(q,0);
end;
$$;


--
-- Name: erp_validate_worker_lease(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.erp_validate_worker_lease(p_token uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if public.get_active_erp_mode()<>'daftra' or not exists(select 1 from public.erp_worker_leases
    where provider='daftra' and token=p_token and expires_at>clock_timestamp()+interval '20 seconds') then
    raise exception 'ERP worker lease was lost.';
  end if;
end;
$$;


--
-- Name: get_active_erp_mode(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_active_erp_mode() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select coalesce((select erp_mode from public.site_settings where key = 'default'), 'built_in');
$$;


--
-- Name: guard_card_order_progress(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_card_order_progress() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if exists (select 1 from public.payment_attempts where order_id=old.id)
    and (new.total_amount is distinct from old.total_amount or new.currency is distinct from old.currency
      or new.user_id is distinct from old.user_id or new.payment_method is distinct from old.payment_method
      or new.is_preorder is distinct from old.is_preorder) then
    raise exception 'Gateway order financial context cannot change.';
  end if;
  if new.payment_method='card' then
    if exists (select 1 from public.payment_attempts where order_id=new.id and mode='test')
      and (new.payment_status='paid' or new.status not in ('pending_payment','on_hold','cancelled')) then
      raise exception 'Test gateway payments cannot fulfill commerce orders.';
    end if;
    -- Preserve unrelated edits to historical orders and the existing refund lifecycle.
    -- Reject new fulfillment transitions; a historical status is not payment proof.
    if new.payment_status<>'paid' and new.status not in ('pending_payment','on_hold','cancelled','refunded')
      and (new.status is distinct from old.status or new.payment_status is distinct from old.payment_status
        or new.payment_method is distinct from old.payment_method) then
      raise exception 'Card payment must be confirmed before fulfillment.';
    end if;
  end if;
  return new;
end;
$$;


--
-- Name: guard_customer_profile_protected_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_customer_profile_protected_fields() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Anonymous chat guests cannot create customer profiles.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if new.wallet_balance is distinct from 0::numeric or new.is_active is distinct from true then
      raise exception 'Customer account fields cannot be changed.' using errcode = '42501';
    end if;
  elsif new.wallet_balance is distinct from old.wallet_balance
    or new.is_active is distinct from old.is_active then
    raise exception 'Customer account fields cannot be changed.' using errcode = '42501';
  end if;
  return new;
end;
$$;


--
-- Name: guard_order_packing_scan_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_order_packing_scan_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Packing scan history is immutable.';
  end if;

  if old.scanned_by is not null
    and new.scanned_by is null
    and (
      new.id,
      new.session_id,
      new.order_item_id,
      new.serialized_unit_id,
      new.scanned_code,
      new.scan_type,
      new.created_at
    ) is not distinct from (
      old.id,
      old.session_id,
      old.order_item_id,
      old.serialized_unit_id,
      old.scanned_code,
      old.scan_type,
      old.created_at
    )
  then
    return new;
  end if;

  raise exception 'Packing scan history is immutable.';
end;
$$;


--
-- Name: guard_order_packing_session_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_order_packing_session_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'active'
      or exists (
        select 1
        from public.order_packing_scans as scans
        where scans.session_id = old.id
      )
    then
      raise exception 'Packing session history cannot be deleted.';
    end if;

    return old;
  end if;

  if new.id is distinct from old.id
    or new.order_id is distinct from old.order_id
    or new.processor_name is distinct from old.processor_name
    or new.processor_email is distinct from old.processor_email
    or new.started_at is distinct from old.started_at
    or new.created_at is distinct from old.created_at
    or (
      new.admin_user_id is distinct from old.admin_user_id
      and new.admin_user_id is not null
    )
  then
    raise exception 'Packing session identity and processor history are immutable.';
  end if;

  if old.status = 'active'
    and old.admin_user_id is not null
    and new.admin_user_id is null
  then
    new.status := 'cancelled';
    new.completed_at := null;
    new.completed_order_status := null;
    new.updated_at := clock_timestamp();
  end if;

  if old.status in ('completed', 'cancelled')
    and (
      new.status is distinct from old.status
      or new.completed_at is distinct from old.completed_at
      or new.completed_order_status is distinct from old.completed_order_status
    )
  then
    raise exception 'A closed packing session cannot be changed.';
  end if;

  if old.status = 'active'
    and new.status not in ('active', 'completed', 'cancelled')
  then
    raise exception 'The packing session status transition is not valid.';
  end if;

  return new;
end;
$$;


--
-- Name: guard_unpaid_card_packing(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_unpaid_card_packing() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_order public.customer_orders%rowtype;
begin
  select * into v_order from public.customer_orders where id=new.order_id for update;
  if v_order.payment_method='card' and (v_order.payment_status<>'paid' or exists (
    select 1 from public.payment_attempts where order_id=v_order.id and mode='test')) then
    raise exception 'A verified live card payment is required before packing.';
  end if;
  return new;
end;
$$;


--
-- Name: handle_new_customer_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_customer_profile() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if new.is_anonymous = true then return new; end if;
  insert into public.customer_profiles (id, email, full_name, avatar_url)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name', pg_catalog.split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  ) on conflict (id) do nothing;
  return new;
end;
$$;


--
-- Name: has_admin_permission(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_admin_permission(permission_key text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.admin_users
    where id = auth.uid ()
      and is_active = true
      and (
        role = 'owner'
        or coalesce((permissions ->> permission_key)::boolean, false)
      )
  );
$$;


--
-- Name: is_active_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_active_admin() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.admin_users
    where id = auth.uid ()
      and is_active = true
  );
$$;


--
-- Name: is_owner(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_owner() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists (
    select 1
    from public.admin_users
    where id = auth.uid ()
      and is_active = true
      and role = 'owner'
  );
$$;


--
-- Name: maintain_order_problem_hold(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.maintain_order_problem_hold() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_message public.customer_order_messages%rowtype;
  v_session_status text;
begin
  if new.status <> 'on_hold' then
    new.awaiting_customer_message_id := null;
    return new;
  end if;

  -- A normal/manual transition into on-hold must not inherit an old request.
  -- The problem RPC supplies a newly inserted, distinct pointer in the same
  -- transaction and therefore passes through to the validation below.
  if tg_op = 'UPDATE'
    and old.status is distinct from 'on_hold'
    and new.awaiting_customer_message_id is not distinct from
      old.awaiting_customer_message_id
  then
    new.awaiting_customer_message_id := null;
    return new;
  end if;

  if new.awaiting_customer_message_id is null then
    return new;
  end if;

  select messages.*
  into v_message
  from public.customer_order_messages as messages
  where messages.id = new.awaiting_customer_message_id;

  if not found
    or v_message.order_id is distinct from new.id
    or v_message.user_id is distinct from new.user_id
    or v_message.sender_type <> 'admin'
    or v_message.message_kind <> 'packing_problem'
    or v_message.reply_to_message_id is not null
    or v_message.replied_at is not null
  then
    raise exception 'The current customer-response request is not valid for this order.';
  end if;

  select sessions.status
  into v_session_status
  from public.order_packing_sessions as sessions
  where sessions.id = v_message.packing_session_id
    and sessions.order_id = new.id;

  if not found or v_session_status <> 'cancelled' then
    raise exception 'The order problem must close its packing session before waiting for a reply.';
  end if;

  return new;
end;
$$;


--
-- Name: mark_admin_as_store_analytics_internal(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_admin_as_store_analytics_internal() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.store_analytics_internal_users (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;


--
-- Name: preorder_add_initial_payment_fee(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preorder_add_initial_payment_fee() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new.is_preorder then
    new.initial_amount_due := new.initial_amount_due + new.payment_fee_amount;
  end if;
  return new;
end;
$$;


--
-- Name: preorder_guard_fulfillment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preorder_guard_fulfillment() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new.is_preorder and new.preorder_fulfillment_state = 'awaiting_stock'
    and new.status not in ('on_hold', 'cancelled', 'refunded') then
    raise exception 'Preorder is awaiting stock and cannot be fulfilled.';
  end if;
  return new;
end;
$$;


--
-- Name: preorder_guard_packing(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preorder_guard_packing() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if exists (select 1 from public.customer_orders as orders
    where orders.id = new.order_id and orders.is_preorder
      and orders.preorder_fulfillment_state <> 'ready') then
    raise exception 'Preorder is awaiting physical stock and cannot be packed.';
  end if;
  return new;
end;
$$;


--
-- Name: preorder_guard_shipping_job(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preorder_guard_shipping_job() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if exists (select 1 from public.customer_orders as orders
    where orders.id = new.order_id and orders.is_preorder
      and orders.preorder_fulfillment_state <> 'ready') then
    raise exception 'Preorder is awaiting physical stock and cannot be shipped.';
  end if;
  return new;
end;
$$;


--
-- Name: prevent_store_analytics_ledger_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_store_analytics_ledger_mutation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  raise exception using
    errcode = '55000',
    message = 'Store analytics exclusion ledgers are append-only.';
end;
$$;


--
-- Name: queue_eligible_paid_orders_for_shipping(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.queue_eligible_paid_orders_for_shipping() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare queued_count integer := 0;
begin
  if not exists (select 1 from public.shipping_provider_settings as settings
    where settings.id = 'pdc' and settings.is_enabled and settings.auto_create_labels) then return 0; end if;
  insert into public.shipping_order_jobs (order_id, provider, state, to_ref, next_attempt_at, updated_at)
  select orders.id, 'pdc', 'queued', coalesce(nullif(btrim(orders.order_number), ''), orders.id::text), now(), now()
  from public.customer_orders as orders
  where (not orders.is_preorder or orders.preorder_fulfillment_state = 'ready')
    and orders.payment_status = 'paid'
    and orders.shipping_review_status in ('not_required', 'approved')
  on conflict (order_id) do update set
    state = case when shipping_order_jobs.state in ('blocked', 'failed') then 'queued' else shipping_order_jobs.state end,
    next_attempt_at = case when shipping_order_jobs.state in ('blocked', 'failed') then now() else shipping_order_jobs.next_attempt_at end,
    updated_at = now();
  get diagnostics queued_count = row_count;
  return queued_count;
end;
$$;


--
-- Name: queue_paid_order_for_shipping(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.queue_paid_order_for_shipping() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if (new.is_preorder and new.preorder_fulfillment_state <> 'ready') or new.payment_status <> 'paid'
    or new.shipping_review_status not in ('not_required', 'approved') then return new; end if;
  if not exists (select 1 from public.shipping_provider_settings as settings
    where settings.id = 'pdc' and settings.is_enabled and settings.auto_create_labels) then return new; end if;
  insert into public.shipping_order_jobs (order_id, provider, state, to_ref, next_attempt_at, updated_at)
  values (new.id, 'pdc', 'queued', coalesce(nullif(btrim(new.order_number), ''), new.id::text), now(), now())
  on conflict (order_id) do update set
    state = case when shipping_order_jobs.state in ('blocked', 'failed') then 'queued' else shipping_order_jobs.state end,
    next_attempt_at = case when shipping_order_jobs.state in ('blocked', 'failed') then now() else shipping_order_jobs.next_attempt_at end,
    updated_at = now();
  return new;
end;
$$;


--
-- Name: quick_setup_configuration_changed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.quick_setup_configuration_changed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: quick_setup_domains(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.quick_setup_domains(p_action text, p_key text) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
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


--
-- Name: quick_setup_guard_write(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.quick_setup_guard_write() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
 if coalesce(current_setting('app.quick_setup_write',true),'')<>'on' then raise exception 'Setup writes require the server command.' using errcode='42501';end if;
 if tg_table_name='quick_setup_events' and tg_op<>'INSERT' then raise exception 'Setup history is append-only.' using errcode='42501';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;


--
-- Name: quick_setup_mutate(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.quick_setup_mutate(p_owner uuid, p_input jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
end $_$;


--
-- Name: quick_setup_reset_invalidation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.quick_setup_reset_invalidation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: reply_to_order_message(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reply_to_order_message(p_message_id uuid, p_user_id uuid, p_body text, p_sender_name text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_parent public.customer_order_messages%rowtype;
  v_reply public.customer_order_messages%rowtype;
  v_order public.customer_orders%rowtype;
  v_customer public.customer_profiles%rowtype;
  v_session_status text;
  v_now timestamptz := clock_timestamp();
  v_body text := nullif(btrim(p_body), '');
  v_sender_name text;
  v_subject text;
begin
  if coalesce(auth.role()::text, '') <> 'service_role' then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  if p_message_id is null or p_user_id is null then
    raise exception 'A message and customer are required.';
  end if;

  if v_body is null then
    raise exception 'Write a reply to the order problem.';
  end if;

  if length(v_body) > 2000 then
    raise exception 'The customer reply cannot exceed 2000 characters.';
  end if;

  select messages.*
  into v_parent
  from public.customer_order_messages as messages
  where messages.id = p_message_id
  for update;

  if not found then
    raise exception 'Order message not found.';
  end if;

  if v_parent.user_id is distinct from p_user_id then
    raise exception 'This order message does not belong to the customer.';
  end if;

  if v_parent.sender_type <> 'admin'
    or v_parent.message_kind <> 'packing_problem'
    or v_parent.reply_to_message_id is not null
    or v_parent.order_id is null
  then
    raise exception 'Only an order problem message can receive this reply.';
  end if;

  select orders.*
  into v_order
  from public.customer_orders as orders
  where orders.id = v_parent.order_id
    and orders.user_id = p_user_id
  for update;

  if not found then
    raise exception 'The customer does not own the order linked to this message.';
  end if;

  select messages.*
  into v_reply
  from public.customer_order_messages as messages
  where messages.reply_to_message_id = v_parent.id
    and messages.sender_type = 'customer'
  limit 1;

  if found then
    select sessions.status
    into v_session_status
    from public.order_packing_sessions as sessions
    where sessions.id = v_parent.packing_session_id;

    return jsonb_build_object(
      'message_id', v_reply.id,
      'reply_to_message_id', v_parent.id,
      'order_id', v_order.id,
      'order_status', v_order.status,
      'session_id', v_parent.packing_session_id,
      'session_status', v_session_status,
      'order_resumed', v_order.status = 'processing',
      'already_replied', true
    );
  end if;

  if v_order.status <> 'on_hold'
    or v_order.awaiting_customer_message_id is distinct from v_parent.id
  then
    raise exception 'This is not the current order problem awaiting a customer reply.';
  end if;

  select sessions.status
  into v_session_status
  from public.order_packing_sessions as sessions
  where sessions.id = v_parent.packing_session_id
    and sessions.order_id = v_order.id;

  if not found or v_session_status <> 'cancelled' then
    raise exception 'The packing session for this order problem is not closed.';
  end if;

  select profiles.*
  into v_customer
  from public.customer_profiles as profiles
  where profiles.id = p_user_id;

  v_sender_name := left(
    coalesce(
      nullif(btrim(v_customer.full_name), ''),
      nullif(btrim(v_customer.email), ''),
      nullif(btrim(p_sender_name), ''),
      'Customer'
    ),
    160
  );
  v_subject := left('Re: ' || v_parent.subject, 200);

  insert into public.customer_order_messages (
    user_id,
    order_id,
    packing_session_id,
    sender_admin_user_id,
    sender_customer_user_id,
    sender_type,
    message_kind,
    reply_to_message_id,
    sender_name,
    subject,
    body,
    read_at,
    created_at
  )
  values (
    p_user_id,
    v_order.id,
    null,
    null,
    p_user_id,
    'customer',
    'customer_reply',
    v_parent.id,
    v_sender_name,
    v_subject,
    v_body,
    v_now,
    v_now
  )
  returning * into v_reply;

  update public.customer_order_messages
  set
    read_at = coalesce(read_at, v_now),
    replied_at = v_now
  where id = v_parent.id;

  update public.customer_orders
  set
    status = 'processing',
    awaiting_customer_message_id = null,
    updated_at = v_now
  where id = v_order.id
    and status = 'on_hold'
    and awaiting_customer_message_id = v_parent.id;

  if not found then
    raise exception 'The current order problem changed before the reply was saved.';
  end if;

  return jsonb_build_object(
    'message_id', v_reply.id,
    'reply_to_message_id', v_parent.id,
    'order_id', v_order.id,
    'order_status', 'processing',
    'session_id', v_parent.packing_session_id,
    'session_status', v_session_status,
    'order_resumed', true,
    'already_replied', false
  );
end;
$$;


--
-- Name: report_order_packing_problem(uuid, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.report_order_packing_problem(p_session_id uuid, p_admin_user_id uuid, p_subject text, p_body text, p_sender_name text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_session public.order_packing_sessions%rowtype;
  v_order public.customer_orders%rowtype;
  v_admin public.admin_users%rowtype;
  v_message public.customer_order_messages%rowtype;
  v_now timestamptz := clock_timestamp();
  v_subject text := nullif(btrim(p_subject), '');
  v_body text := nullif(btrim(p_body), '');
  v_sender_name text;
begin
  if coalesce(auth.role()::text, '') <> 'service_role' then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  if p_session_id is null or p_admin_user_id is null then
    raise exception 'A packing session and processor are required.';
  end if;

  if v_body is null then
    raise exception 'Describe the order problem for the purchaser.';
  end if;

  if length(v_body) > 2000 then
    raise exception 'The order problem message cannot exceed 2000 characters.';
  end if;

  if v_subject is not null and length(v_subject) > 200 then
    raise exception 'The order problem subject cannot exceed 200 characters.';
  end if;

  select sessions.*
  into v_session
  from public.order_packing_sessions as sessions
  where sessions.id = p_session_id
  for update;

  if not found then
    raise exception 'Packing session not found.';
  end if;

  if v_session.admin_user_id is distinct from p_admin_user_id then
    raise exception 'Only the admin who claimed this order can report its problem.';
  end if;

  select admins.*
  into v_admin
  from public.admin_users as admins
  where admins.id = p_admin_user_id;

  if not found
    or not coalesce(v_admin.is_active, false)
    or (
      v_admin.role <> 'owner'
      and not coalesce(
        (v_admin.permissions ->> 'dashboard.orders')::boolean,
        false
      )
    )
  then
    raise exception 'This admin can no longer process orders.';
  end if;

  v_sender_name := left(
    coalesce(
      nullif(btrim(v_admin.full_name), ''),
      nullif(btrim(v_admin.email), ''),
      nullif(btrim(p_sender_name), ''),
      'Store team'
    ),
    160
  );

  select orders.*
  into v_order
  from public.customer_orders as orders
  where orders.id = v_session.order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  select messages.*
  into v_message
  from public.customer_order_messages as messages
  where messages.packing_session_id = v_session.id
    and messages.message_kind = 'packing_problem'
  limit 1;

  if found then
    return jsonb_build_object(
      'message_id', v_message.id,
      'order_id', v_order.id,
      'order_status', v_order.status,
      'session_id', v_session.id,
      'session_status', v_session.status,
      'awaiting_customer_message_id',
        v_order.awaiting_customer_message_id,
      'already_reported', true
    );
  end if;

  if v_session.status <> 'active' then
    raise exception 'This packing session is no longer active.';
  end if;

  if v_order.status not in ('pending_payment', 'processing') then
    raise exception 'The order status changed before its problem could be reported.';
  end if;

  if v_order.packing_completed_at is not null then
    raise exception 'A completed packing order cannot be placed on a problem hold.';
  end if;

  if v_order.user_id is null then
    raise exception 'This guest order does not have a customer account inbox.';
  end if;

  v_subject := coalesce(
    v_subject,
    'Problem with order '
      || coalesce(v_order.order_number, '#' || left(v_order.id::text, 8))
  );

  update public.order_packing_sessions
  set
    status = 'cancelled',
    completed_at = null,
    completed_order_status = null,
    updated_at = v_now
  where id = v_session.id;

  insert into public.customer_order_messages (
    user_id,
    order_id,
    packing_session_id,
    sender_admin_user_id,
    sender_customer_user_id,
    sender_type,
    message_kind,
    reply_to_message_id,
    sender_name,
    subject,
    body,
    read_at,
    created_at
  )
  values (
    v_order.user_id,
    v_order.id,
    v_session.id,
    p_admin_user_id,
    null,
    'admin',
    'packing_problem',
    null,
    v_sender_name,
    v_subject,
    v_body,
    null,
    v_now
  )
  returning * into v_message;

  update public.customer_orders
  set
    status = 'on_hold',
    awaiting_customer_message_id = v_message.id,
    updated_at = v_now
  where id = v_order.id;

  return jsonb_build_object(
    'message_id', v_message.id,
    'order_id', v_order.id,
    'order_status', 'on_hold',
    'session_id', v_session.id,
    'session_status', 'cancelled',
    'awaiting_customer_message_id', v_message.id,
    'already_reported', false
  );
end;
$$;


--
-- Name: require_order_packing_video(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.require_order_packing_video() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_video public.order_packing_videos%rowtype;
begin
  if old.status <> 'completed' and new.status = 'completed' then
    select videos.*
    into v_video
    from public.order_packing_videos as videos
    where videos.packing_session_id = new.id
      and videos.order_id = new.order_id
      and videos.recorded_by = new.admin_user_id
      and videos.work_session_id = new.work_session_id
      and videos.status = 'ready';

    if not found then
      raise exception 'Upload the packing video before completing this order.';
    end if;

    if exists (
      select 1
      from public.order_packing_scans as scans
      where scans.session_id = new.id
        and (
          scans.created_at < v_video.recording_started_at
          or scans.created_at > v_video.recording_ended_at
        )
    ) then
      raise exception 'The packing video must cover every item scan.';
    end if;
  end if;

  return new;
end;
$$;


--
-- Name: require_order_packing_work_session(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.require_order_packing_work_session() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_work_session public.order_packing_work_sessions%rowtype;
begin
  if new.status <> 'active' then
    return new;
  end if;

  if new.work_session_id is null then
    raise exception 'Start a packing session before choosing an order.';
  end if;

  select work_sessions.*
  into v_work_session
  from public.order_packing_work_sessions as work_sessions
  where work_sessions.id = new.work_session_id;

  if not found or v_work_session.status <> 'active' then
    raise exception 'Your packing session is closed. Start a new session.';
  end if;

  if v_work_session.admin_user_id is distinct from new.admin_user_id then
    raise exception 'This packing session belongs to another operator.';
  end if;

  return new;
end;
$$;


--
-- Name: serialize_store_analytics_internal_user_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.serialize_store_analytics_internal_user_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended('store-analytics-internal-user:' || new.user_id::text, 0)
  );

  return new;
end;
$$;


--
-- Name: shipping_can_receive_topic(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shipping_can_receive_topic(p_topic text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (select 1 from public.customer_orders o
    join public.customer_profiles p on p.id=o.user_id and p.is_active=true
    join auth.users u on u.id=o.user_id and u.is_anonymous=false
    where o.user_id=auth.uid() and p_topic='shipping:order:' || o.id::text);
$$;


--
-- Name: shipping_claim_dispatch(uuid, uuid, boolean, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shipping_claim_dispatch(p_job uuid, p_token uuid, p_ready boolean, p_configuration jsonb DEFAULT NULL::jsonb) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    SET statement_timeout TO '4s'
    SET lock_timeout TO '2s'
    AS $$
declare j public.shipping_claim_jobs%rowtype; c public.after_sales_claims%rowtype; s public.shipping_provider_settings%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required.' using errcode='42501'; end if;
  perform 1 from public.customer_order_items where id=(select item_id from public.after_sales_claims where id=(select claim_id from public.shipping_claim_jobs where id=p_job)) for update;
  select * into c from public.after_sales_claims where id=(select claim_id from public.shipping_claim_jobs where id=p_job) for update;
  select * into j from public.shipping_claim_jobs where id=p_job for update;
  select * into s from public.shipping_provider_settings where id='pdc' for share;
  if not found or j.state<>'creating' or p_token is null or p_token is distinct from j.work_token then return false; end if;
  if p_ready is distinct from true or not s.is_enabled or not s.reverse_enabled or md5(to_jsonb(s)::text)<>j.settings_fingerprint or (p_configuration is not null and (to_jsonb(s) @> p_configuration) is distinct from true) or j.expires_at<=clock_timestamp() or c.status not in ('approved','pickup_scheduled','in_transit') or
    exists(select 1 from public.customer_orders o join public.customer_profiles p on p.id=o.user_id where o.id=c.order_id and (not p.is_active or o.status in ('cancelled','refunded') or o.payment_status='refunded')) or
    not exists(select 1 from public.admin_users a where a.id=j.initiated_by and a.is_active and (a.role='owner' or (coalesce((a.permissions->>'claims.view')::boolean,false) and coalesce((a.permissions->>'claims.logistics.view')::boolean,false) and coalesce((a.permissions->>'claims.logistics.create')::boolean,false)))) then
    perform set_config('app.reverse_write','on',true);
    update public.shipping_claim_jobs set state='failed',diagnostic='configuration_changed',updated_at=clock_timestamp() where id=j.id;
    perform public.shipping_claim_emit(j.id,'reverse_failed','worker','',true);
    return false;
  end if;
  return true;
end $$;


--
-- Name: shipping_claim_emit(uuid, text, text, text, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shipping_claim_emit(p_job uuid, p_event text, p_kind text DEFAULT 'staff'::text, p_body text DEFAULT ''::text, p_visible boolean DEFAULT true, p_actor uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    SET statement_timeout TO '4s'
    SET lock_timeout TO '2s'
    AS $$
declare j public.shipping_claim_jobs%rowtype; a public.admin_users%rowtype; actor_id uuid;
begin
  select * into j from public.shipping_claim_jobs where id=p_job;
  actor_id:=coalesce(p_actor,j.initiated_by);
  perform set_config('app.after_sales_claim_write','on',true);
  perform public.after_sales_claim_emit(j.claim_id,actor_id,p_kind,p_event,p_body,p_visible);
  perform set_config('app.after_sales_claim_write','off',true);
  if p_kind<>'staff' then
    select * into a from public.admin_users where id=actor_id;
    insert into public.admin_activity_logs(admin_user_id,author_name,author_email,author_role,action_key,description,metadata)
    values(a.id,coalesce(a.full_name,a.email),a.email,a.role,'claims.'||p_event,'Updated claim reverse logistics.',jsonb_build_object('claim_id',j.claim_id,'job_id',j.id,'state',j.state,'awb',j.awb,'source',p_kind,'diagnostic',j.diagnostic));
  end if;
end $$;


--
-- Name: shipping_claim_event_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shipping_claim_event_guard() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if tg_op='TRUNCATE' then
    if exists(select 1 from public.shipping_webhook_events where claim_shipment_job_id is not null) then raise exception 'Reverse history is retained.' using errcode='42501'; end if;
    return null;
  end if;
  if (tg_op<>'INSERT' and old.claim_shipment_job_id is not null) or (tg_op<>'DELETE' and new.claim_shipment_job_id is not null) then
    if tg_op='DELETE' or current_setting('app.reverse_write',true) is distinct from 'on' then raise exception 'Canonical reverse event required.' using errcode='42501'; end if;
    if tg_op='UPDATE' and (old.claim_shipment_job_id is null or old.status_date is not null or new.status_date is null or
      (to_jsonb(new)-array['status_date','source','provider_status_name','reason_name']) is distinct from (to_jsonb(old)-array['status_date','source','provider_status_name','reason_name'])) then raise exception 'Reverse history is immutable.' using errcode='42501'; end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;


--
-- Name: shipping_claim_finish(uuid, uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shipping_claim_finish(p_job uuid, p_token uuid, p_state text, p_ref text DEFAULT NULL::text, p_awb text DEFAULT NULL::text, p_code text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    SET statement_timeout TO '4s'
    SET lock_timeout TO '2s'
    AS $_$
declare j public.shipping_claim_jobs%rowtype; c public.after_sales_claims%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required.' using errcode='42501'; end if;
  perform 1 from public.customer_order_items where id=(select item_id from public.after_sales_claims where id=(select claim_id from public.shipping_claim_jobs where id=p_job)) for update;
  select * into c from public.after_sales_claims where id=(select claim_id from public.shipping_claim_jobs where id=p_job) for update;
  select * into j from public.shipping_claim_jobs where id=p_job for update;
  if not found then raise exception 'Shipment not found.' using errcode='P0002'; end if;
  if j.state='created' and j.to_ref=p_ref and j.awb=p_awb then return jsonb_build_object('id',j.id,'idempotent',true); end if;
  if p_token is null or p_token is distinct from j.work_token or j.state not in ('creating','uncertain') or p_state not in ('created','failed','uncertain') then raise exception 'Reverse booking conflict.' using errcode='23514'; end if;
  if p_state='created' and (p_ref is distinct from j.to_ref or p_awb is null or p_awb !~ '^[A-Za-z0-9][A-Za-z0-9-]{0,99}$') then raise exception 'Reverse response mismatch.' using errcode='23514'; end if;
  if p_state<>'created' and coalesce(p_code,'') not in ('timeout','invalid_response','ref_mismatch','provider_rejected','provider_unavailable','awb_conflict','interrupted') then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  perform set_config('app.reverse_write','on',true);
  update public.shipping_claim_jobs set state=p_state,awb=case when p_state='created' then p_awb else awb end,diagnostic=case when p_state='created' then null else p_code end,updated_at=clock_timestamp() where id=j.id;
  if p_state='created' and c.status in ('approved','pickup_scheduled','in_transit') then
    perform set_config('app.after_sales_claim_write','on',true);
    update public.after_sales_claims set status='pickup_scheduled',revision=revision+1,updated_at=clock_timestamp() where id=c.id;
  end if;
  perform public.shipping_claim_emit(j.id,case p_state when 'created' then 'reverse_created' when 'failed' then 'reverse_failed' else 'reverse_uncertain' end,'worker','',true);
  perform set_config('app.reverse_write','off',true);
  return jsonb_build_object('id',j.id,'state',p_state);
end $_$;


--
-- Name: shipping_claim_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shipping_claim_guard() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if tg_op='TRUNCATE' or tg_op='DELETE' or current_setting('app.reverse_write',true) is distinct from 'on' then raise exception 'Canonical reverse operation required.' using errcode='42501'; end if;
  if tg_op='UPDATE' and (to_jsonb(new)-array['state','awb','diagnostic','work_token','started_at','normalized_state','provider_status_id','provider_status_at','provider_observed_at','reconciliation_attempted_at','label_state','label_token','label_started_at','label_storage_path','label_requested_by','updated_at']) is distinct from
    (to_jsonb(old)-array['state','awb','diagnostic','work_token','started_at','normalized_state','provider_status_id','provider_status_at','provider_observed_at','reconciliation_attempted_at','label_state','label_token','label_started_at','label_storage_path','label_requested_by','updated_at']) then raise exception 'Reverse snapshot is immutable.' using errcode='42501'; end if;
  if tg_op='UPDATE' and old.awb is not null and new.awb is distinct from old.awb then raise exception 'Reverse AWB is immutable.' using errcode='42501'; end if;
  return new;
end $$;


--
-- Name: shipping_claim_label_finish(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shipping_claim_label_finish(p_job uuid, p_token uuid, p_success boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    SET statement_timeout TO '4s'
    SET lock_timeout TO '2s'
    AS $$
declare j public.shipping_claim_jobs%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required.' using errcode='42501'; end if;
  perform 1 from public.customer_order_items where id=(select item_id from public.after_sales_claims where id=(select claim_id from public.shipping_claim_jobs where id=p_job)) for update;
  perform 1 from public.after_sales_claims where id=(select claim_id from public.shipping_claim_jobs where id=p_job) for update;
  select * into j from public.shipping_claim_jobs where id=p_job for update;
  if not found or p_token is null or p_token is distinct from j.label_token or j.label_state<>'creating' then raise exception 'Reverse booking conflict.' using errcode='23514'; end if;
  perform set_config('app.reverse_write','on',true);
  update public.shipping_claim_jobs set label_state=case when p_success then 'ready' else 'failed' end,
    label_storage_path=case when p_success then 'claims/'||j.claim_id::text||'/'||j.id::text||'.pdf' end,updated_at=clock_timestamp() where id=j.id;
  perform public.shipping_claim_emit(j.id,case when p_success then 'reverse_label' else 'reverse_label_failed' end,'worker','',false,j.label_requested_by);
end $$;


--
-- Name: shipping_claim_label_take(boolean, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shipping_claim_label_take(p_ready boolean, p_limit integer DEFAULT 10, p_configuration jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    SET statement_timeout TO '4s'
    SET lock_timeout TO '2s'
    AS $$
declare j public.shipping_claim_jobs%rowtype; s public.shipping_provider_settings%rowtype; token uuid; result jsonb:='[]';
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required.' using errcode='42501'; end if;
  select * into s from public.shipping_provider_settings where id='pdc';
  perform set_config('app.reverse_write','on',true);
  for j in select * from public.shipping_claim_jobs where label_state='queued' or (label_state='creating' and label_started_at<clock_timestamp()-interval '2 minutes') order by created_at limit least(greatest(coalesce(p_limit,10),1),25) loop
    perform 1 from public.customer_order_items where id=(select item_id from public.after_sales_claims where id=j.claim_id) for update;
    perform 1 from public.after_sales_claims where id=j.claim_id for update;
    select * into j from public.shipping_claim_jobs where id=j.id for update;
    if j.label_state not in ('queued','creating') or (j.label_state='creating' and j.label_started_at>=clock_timestamp()-interval '2 minutes') then continue; end if;
    if p_ready is distinct from true or not s.is_enabled or not s.reverse_enabled or (p_configuration is not null and (to_jsonb(s) @> p_configuration) is distinct from true) or j.provider_identity<>jsonb_build_object('company_id',s.company_id,'base_url',s.base_url,'api_mode',s.api_mode) or j.label_state='creating' or
      not exists(select 1 from public.admin_users a where a.id=j.label_requested_by and a.is_active and (a.role='owner' or (coalesce((a.permissions->>'claims.view')::boolean,false) and coalesce((a.permissions->>'claims.logistics.view')::boolean,false) and coalesce((a.permissions->>'claims.logistics.create')::boolean,false)))) then
      update public.shipping_claim_jobs set label_state='failed',updated_at=clock_timestamp() where id=j.id;
      perform public.shipping_claim_emit(j.id,'reverse_label_failed','worker','',false,j.label_requested_by); continue;
    end if;
    token:=gen_random_uuid(); update public.shipping_claim_jobs set label_state='creating',label_token=token,label_started_at=clock_timestamp(),updated_at=clock_timestamp() where id=j.id;
    result:=result||jsonb_build_array(jsonb_build_object('id',j.id,'claim_id',j.claim_id,'awb',j.awb,'token',token));
  end loop;
  return result;
end $$;


--
-- Name: shipping_claim_operation(uuid, uuid, uuid, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shipping_claim_operation(p_admin uuid, p_claim uuid, p_job uuid, p_action text, p_ready boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    SET statement_timeout TO '4s'
    SET lock_timeout TO '2s'
    AS $$
declare j public.shipping_claim_jobs%rowtype;
begin
  perform public.after_sales_claim_assert_actor(p_admin,'claims.logistics.view');
  perform public.after_sales_claim_assert_actor(p_admin,case when p_action='label' then 'claims.logistics.create' else 'claims.logistics.retry' end);
  if p_action is null or p_action not in ('refresh','recover','label') then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  perform 1 from public.customer_order_items where id=(select item_id from public.after_sales_claims where id=p_claim) for update;
  perform 1 from public.after_sales_claims where id=p_claim for update;
  select * into j from public.shipping_claim_jobs where id=p_job and claim_id=p_claim for update;
  if not found then raise exception 'Shipment not found.' using errcode='P0002'; end if;
  if p_ready is distinct from true or not exists(select 1 from public.shipping_provider_settings s where s.id='pdc' and s.is_enabled and s.reverse_enabled and jsonb_build_object('company_id',s.company_id,'base_url',s.base_url,'api_mode',s.api_mode)=j.provider_identity) then raise exception 'Reverse provider not ready.' using errcode='23514'; end if;
  if (p_action='recover' and j.state<>'uncertain') or (p_action in ('refresh','label') and j.awb is null) then raise exception 'Reverse booking conflict.' using errcode='23514'; end if;
  perform set_config('app.reverse_write','on',true);
  if p_action='label' then
    if j.label_state in ('queued','creating','ready') then return jsonb_build_object('queued',j.label_state<>'ready'); end if;
    update public.shipping_claim_jobs set label_state='queued',label_requested_by=p_admin,updated_at=clock_timestamp() where id=j.id;
    perform public.shipping_claim_emit(j.id,'reverse_label','staff','',false,p_admin);
    return jsonb_build_object('queued',true);
  end if;
  if j.reconciliation_attempted_at>clock_timestamp()-interval '5 minutes' then raise exception 'Reverse refresh throttled.' using errcode='23514'; end if;
  update public.shipping_claim_jobs set reconciliation_attempted_at=clock_timestamp() where id=j.id;
  perform public.shipping_claim_emit(j.id,'reverse_tracking','staff','',false,p_admin);
  return jsonb_build_object('id',j.id,'ref',j.to_ref,'awb',j.awb,'token',j.work_token,'observed_at',clock_timestamp());
end $$;


--
-- Name: shipping_claim_pdc_lookup(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shipping_claim_pdc_lookup() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    SET statement_timeout TO '4s'
    SET lock_timeout TO '2s'
    AS $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required'; end if;
  update public.shipping_provider_settings set lookup_attempted_at=clock_timestamp()
    where id='pdc' and (lookup_attempted_at is null or lookup_attempted_at <= clock_timestamp()-interval '1 minute');
  return found;
end;
$$;


--
-- Name: shipping_claim_pdc_refresh(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shipping_claim_pdc_refresh(p_order_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    SET statement_timeout TO '4s'
    SET lock_timeout TO '2s'
    AS $$
declare v_job public.shipping_order_jobs%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required'; end if;
  select * into v_job from public.shipping_order_jobs where order_id=p_order_id and provider='pdc' for update;
  if not found or v_job.awb is null then return jsonb_build_object('error','no_shipment'); end if;
  if v_job.reconciliation_attempted_at > clock_timestamp()-interval '5 minutes' then return jsonb_build_object('error','throttled'); end if;
  update public.shipping_order_jobs set reconciliation_attempted_at=clock_timestamp() where id=v_job.id;
  return jsonb_build_object('awb',v_job.awb,'ref',v_job.to_ref,'observed_at',clock_timestamp());
end;
$$;


--
-- Name: shipping_claim_read_label(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shipping_claim_read_label(p_admin uuid, p_claim uuid, p_job uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    SET statement_timeout TO '4s'
    SET lock_timeout TO '2s'
    AS $$
declare j public.shipping_claim_jobs%rowtype;
begin
  perform public.after_sales_claim_assert_actor(p_admin,'claims.logistics.view');
  select * into j from public.shipping_claim_jobs where id=p_job and claim_id=p_claim and label_state='ready';
  if not found then raise exception 'Shipment not found.' using errcode='P0002'; end if;
  return jsonb_build_object('path',j.label_storage_path,'awb',j.awb);
end $$;


--
-- Name: shipping_claim_schedule(uuid, uuid, integer, uuid, jsonb, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shipping_claim_schedule(p_admin uuid, p_claim uuid, p_revision integer, p_key uuid, p_input jsonb, p_ready boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    SET statement_timeout TO '4s'
    SET lock_timeout TO '2s'
    AS $_$
declare c public.after_sales_claims%rowtype; s public.shipping_provider_settings%rowtype; m public.shipping_city_mappings%rowtype; policy jsonb; old_job public.shipping_claim_jobs%rowtype;
  j public.shipping_claim_jobs%rowtype; pickup jsonb; dest jsonb; new_job_id uuid:=gen_random_uuid(); previous uuid; handling text; reason text;
begin
  perform public.after_sales_claim_assert_actor(p_admin,'claims.logistics.create');
  perform public.after_sales_claim_assert_actor(p_admin,'claims.logistics.view');
  if p_key is null or p_input is null or jsonb_typeof(p_input)<>'object' or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('pickup','handling_resolution','reason','return_required','previous_job_id')) then raise exception 'Invalid claim input.' using errcode='22023'; end if;
  perform 1 from public.customer_order_items where id=(select item_id from public.after_sales_claims where id=p_claim) for update;
  select * into c from public.after_sales_claims where id=p_claim for update;
  if not found then raise exception 'Claim not found.' using errcode='P0002'; end if;
  select * into j from public.shipping_claim_jobs where submission_key=p_key;
  if found then
    if j.claim_id<>p_claim or j.initiated_by<>p_admin or j.submission<>p_input then raise exception 'Claim retry conflict.' using errcode='40001'; end if;
    return jsonb_build_object('id',j.id,'state',j.state,'to_ref',j.to_ref,'idempotent',true);
  end if;
  if p_revision is null or c.revision<>p_revision then raise exception 'Claim retry conflict.' using errcode='40001'; end if;
  previous:=nullif(p_input->>'previous_job_id','')::uuid;
  select * into old_job from public.shipping_claim_jobs where claim_id=c.id order by created_at desc,id desc limit 1;
  if found then
    perform public.after_sales_claim_assert_actor(p_admin,'claims.logistics.retry');
    if previous is distinct from old_job.id or old_job.state not in ('failed','cancelled','returned') then raise exception 'Reverse booking conflict.' using errcode='23514'; end if;
  elsif previous is not null then raise exception 'Reverse booking conflict.' using errcode='23514'; end if;
  if c.status<>'approved' and not(previous is not null and c.status in ('pickup_scheduled','in_transit')) then raise exception 'Claim transition denied.' using errcode='23514'; end if;
  if exists(select 1 from public.shipping_claim_jobs where claim_id=c.id and state in ('queued','creating','created','uncertain')) then raise exception 'Reverse booking conflict.' using errcode='23514'; end if;
  if exists(select 1 from public.customer_orders o join public.customer_profiles p on p.id=o.user_id where o.id=c.order_id and (o.user_id<>c.customer_id or not p.is_active or o.status in ('cancelled','refunded') or o.payment_status='refunded')) then raise exception 'Claim eligibility denied.' using errcode='23514'; end if;
  select v.policy into policy from public.after_sales_policy_versions v where v.id=c.policy_version_id;
  handling:=p_input->>'handling_resolution'; reason:=btrim(coalesce(p_input->>'reason',''));
  if p_input->'return_required' is distinct from 'true'::jsonb or char_length(reason) not between 1 and 1000 or handling is null or handling='service_center' or c.resolution='service_center' or
    (c.claim_type='return' and (handling<>'refund' or not coalesce((policy->>'return_enabled')::boolean,false))) or
    (c.claim_type='warranty' and (not coalesce((policy->>'warranty_enabled')::boolean,false) or not coalesce(policy->'warranty_resolutions' ? handling,false))) then raise exception 'Reverse item return required.' using errcode='23514'; end if;
  pickup:=p_input->'pickup';
  if pickup is null or jsonb_typeof(pickup)<>'object' or exists(select 1 from jsonb_object_keys(pickup) k where k not in ('name','phone','address','city_mapping_id')) or
    jsonb_typeof(pickup->'name')<>'string' or char_length(btrim(coalesce(pickup->>'name',''))) not between 1 and 100 or
    jsonb_typeof(pickup->'address')<>'string' or char_length(btrim(coalesce(pickup->>'address',''))) not between 1 and 1000 or
    coalesce(pickup->>'phone','') !~ '^01[0-9]{9}$' or pickup->>'city_mapping_id' is null then raise exception 'Invalid pickup details.' using errcode='22023'; end if;
  select * into m from public.shipping_city_mappings where id=(pickup->>'city_mapping_id')::uuid and provider='pdc';
  if not found then raise exception 'Reverse city mapping required.' using errcode='23514'; end if;
  select * into s from public.shipping_provider_settings where id='pdc' for share;
  if p_ready is distinct from true or not s.is_enabled or not s.reverse_enabled or s.reverse_shipment_type_id is distinct from 3 or s.access_token_encrypted is null or s.webhook_secret_encrypted is null or
    s.origin_city_id is null or nullif(btrim(s.origin_address),'') is null or coalesce(s.origin_phone,'') !~ '^01[0-9]{9}$' or nullif(btrim(s.origin_contact_name),'') is null then raise exception 'Reverse provider not ready.' using errcode='23514'; end if;
  if exists(select 1 from public.shipping_order_jobs where to_ref='ASREV-'||replace(new_job_id::text,'-','')) then raise exception 'Courier identity conflict.' using errcode='23505'; end if;
  pickup:=jsonb_build_object('name',btrim(pickup->>'name'),'phone',pickup->>'phone','address',btrim(pickup->>'address'),'city_mapping_id',m.id,'city',m.city,'governorate',m.governorate,'provider_city_id',m.provider_city_id);
  dest:=jsonb_build_object('name',s.origin_contact_name,'phone',s.origin_phone,'address',s.origin_address,'provider_city_id',s.origin_city_id);
  perform set_config('app.reverse_write','on',true);
  insert into public.shipping_claim_jobs(id,claim_id,initiated_by,submission_key,submission,previous_job_id,to_ref,quantity,pickup,destination,handling_resolution,confirmation_reason,settings_fingerprint,provider_identity,shipment_payload)
  values(new_job_id,c.id,p_admin,p_key,p_input,previous,'ASREV-'||replace(new_job_id::text,'-',''),c.quantity,pickup,dest,handling,reason,md5(to_jsonb(s)::text),jsonb_build_object('company_id',s.company_id,'base_url',s.base_url,'api_mode',s.api_mode),
    jsonb_build_object('allMustValid',true,'hasAWBs',false,'extraParams','{}'::jsonb,'shipments',jsonb_build_array(jsonb_build_object(
      'fromCityID',m.provider_city_id,'fromAddress',pickup->>'address','fromPhone',pickup->>'phone','fromContactPerson',pickup->>'name',
      'toCityID',s.origin_city_id,'toAddress',s.origin_address,'toPhone',s.origin_phone,'toConsigneeName',s.origin_contact_name,
      'toRef','ASREV-'||replace(new_job_id::text,'-',''),'productID',s.product_id,'shipmentTypeID',s.reverse_shipment_type_id,'weight',s.default_weight_kg,'pieces',c.quantity,'cod',0,'refuseCOD',0))));
  perform set_config('app.after_sales_claim_write','on',true);
  update public.after_sales_claims set revision=revision+1,updated_at=clock_timestamp() where id=c.id;
  perform public.shipping_claim_emit(new_job_id,'reverse_queued','staff','',true);
  perform set_config('app.reverse_write','off',true);
  return jsonb_build_object('id',new_job_id,'state','queued','to_ref','ASREV-'||replace(new_job_id::text,'-',''));
end $_$;


--
-- Name: shipping_claim_take(boolean, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shipping_claim_take(p_ready boolean, p_limit integer DEFAULT 10) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    SET statement_timeout TO '4s'
    SET lock_timeout TO '2s'
    AS $$
declare j public.shipping_claim_jobs%rowtype; c public.after_sales_claims%rowtype; s public.shipping_provider_settings%rowtype; result jsonb:='[]'; token uuid; code text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required.' using errcode='42501'; end if;
  select * into s from public.shipping_provider_settings where id='pdc';
  for j in select * from public.shipping_claim_jobs where state='queued' or (state='creating' and started_at<clock_timestamp()-interval '2 minutes') order by created_at limit least(greatest(coalesce(p_limit,10),1),25) loop
    -- Same item -> claim -> job lock order as customer/staff Claims actions.
    perform 1 from public.customer_order_items where id=(select item_id from public.after_sales_claims where id=j.claim_id) for update;
    select * into c from public.after_sales_claims where id=j.claim_id for update;
    select * into j from public.shipping_claim_jobs where id=j.id for update;
    if j.state not in ('queued','creating') then continue; end if;
    perform set_config('app.reverse_write','on',true);
    if j.state='creating' then
      if j.started_at>=clock_timestamp()-interval '2 minutes' then continue; end if;
      update public.shipping_claim_jobs set state='uncertain',diagnostic='interrupted',updated_at=clock_timestamp() where id=j.id;
      perform public.shipping_claim_emit(j.id,'reverse_uncertain','worker','',true); continue;
    end if;
    code:=case when p_ready is distinct from true or not s.is_enabled or not s.reverse_enabled then 'provider_not_ready'
      when j.settings_fingerprint<>md5(to_jsonb(s)::text) then 'configuration_changed' when j.expires_at<=clock_timestamp() then 'expired'
      when c.status not in ('approved','pickup_scheduled','in_transit') then 'claim_changed'
      when not exists(select 1 from public.admin_users a where a.id=j.initiated_by and a.is_active and (a.role='owner' or (coalesce((a.permissions->>'claims.view')::boolean,false) and coalesce((a.permissions->>'claims.logistics.create')::boolean,false)))) then 'permission_changed' end;
    if code is not null then
      update public.shipping_claim_jobs set state='failed',diagnostic=code,updated_at=clock_timestamp() where id=j.id;
      perform public.shipping_claim_emit(j.id,'reverse_failed','worker','',true); continue;
    end if;
    token:=gen_random_uuid();
    update public.shipping_claim_jobs set state='creating',work_token=token,started_at=clock_timestamp(),updated_at=clock_timestamp() where id=j.id;
    result:=result||jsonb_build_array(jsonb_build_object('id',j.id,'token',token,'to_ref',j.to_ref,'payload',j.shipment_payload));
  end loop;
  perform set_config('app.reverse_write','off',true);
  return result;
end $$;


--
-- Name: shipping_claim_view(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shipping_claim_view(p_actor uuid, p_claim uuid, p_staff boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    SET statement_timeout TO '4s'
    SET lock_timeout TO '2s'
    AS $$
declare c public.after_sales_claims%rowtype; o public.customer_orders%rowtype; a public.admin_users%rowtype; policy jsonb; jobs jsonb; history jsonb; cities jsonb:='[]'; prefill jsonb; operational boolean:=false; has_diagnostics boolean:=false; can_book boolean:=false;
begin
  perform public.after_sales_claim_assert_actor(p_actor,case when p_staff then 'claims.view' end);
  select * into c from public.after_sales_claims where id=p_claim and (p_staff or customer_id=p_actor);
  if not found then raise exception 'Claim not found.' using errcode='P0002'; end if;
  if p_staff then
    select * into a from public.admin_users where id=p_actor;
    operational:=a.role='owner' or coalesce((a.permissions->>'claims.logistics.view')::boolean,false);
    has_diagnostics:=operational and (a.role='owner' or coalesce((a.permissions->>'claims.logistics.diagnostics')::boolean,false));
    can_book:=operational and (a.role='owner' or coalesce((a.permissions->>'claims.logistics.create')::boolean,false));
  end if;
  select v.policy into policy from public.after_sales_policy_versions v where v.id=c.policy_version_id;
  select coalesce(jsonb_agg(value order by created_at desc,id desc),'[]') into jobs from (
    select j.id,j.created_at,jsonb_build_object('id',j.id,'to_ref',j.to_ref,'state',j.state,'awb',j.awb,'quantity',j.quantity,'normalized_state',j.normalized_state,
      'status_date',j.provider_status_at,'created_at',j.created_at,'pickup',case when not p_staff or operational then j.pickup-array['provider_city_id','city_mapping_id'] else null end,
      'label_ready',operational and j.label_state='ready','label_state',case when operational then j.label_state else null end,
      'diagnostic',case when has_diagnostics then j.diagnostic else null end,'previous_job_id',case when operational then j.previous_job_id else null end,
      'handling_resolution',case when operational then j.handling_resolution else null end,'confirmation_reason',case when operational then j.confirmation_reason else null end,
      'can_recover',operational and j.state='uncertain','can_refresh',operational and j.awb is not null,'can_label',can_book and j.awb is not null and j.state in ('created','delivered','cancelled','returned') and j.label_state not in ('queued','creating')) value
    from public.shipping_claim_jobs j where j.claim_id=c.id order by j.created_at desc,j.id desc limit 10
  ) x;
  select coalesce(jsonb_agg(value order by sort_at desc,id desc),'[]') into history from (
    select e.id,coalesce(e.status_date,e.received_at) sort_at,jsonb_build_object('id',e.id,'job_id',e.claim_shipment_job_id,'state',e.normalized_state,'status_date',e.status_date,'observed_at',e.received_at,'source',e.source,
      'provider_status_id',case when has_diagnostics then e.provider_status_id else null end,'provider_label',case when has_diagnostics then e.provider_status_name else null end,'provider_reason',case when has_diagnostics then e.reason_name else null end) value
    from public.shipping_webhook_events e join public.shipping_claim_jobs j on j.id=e.claim_shipment_job_id where j.claim_id=c.id order by coalesce(e.status_date,e.received_at) desc,e.id desc limit 200
  ) x;
  if can_book then
    select * into o from public.customer_orders where id=c.order_id;
    select jsonb_build_object('name',btrim(coalesce(o.first_name,'')||' '||coalesce(o.last_name,'')),'phone',o.phone,'address',o.street_address,
      'city_mapping_id',(select m.id from public.shipping_city_mappings m where m.provider='pdc' and lower(btrim(m.governorate))=lower(btrim(o.governorate)) and (lower(btrim(m.city))=lower(btrim(o.city)) or lower(btrim(m.city_arabic))=lower(btrim(o.city))) limit 1)) into prefill;
    select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'city',m.city,'city_arabic',m.city_arabic,'governorate',m.governorate) order by m.governorate,m.city),'[]') into cities from public.shipping_city_mappings m where m.provider='pdc';
  end if;
  return jsonb_build_object('jobs',jobs,'events',history,'cities',cities,'prefill',prefill,'operational',operational,'diagnostics',has_diagnostics,
    'active',exists(select 1 from public.shipping_claim_jobs where claim_id=c.id and state in ('queued','creating','created','uncertain')),
    'can_book',can_book and c.status in ('approved','pickup_scheduled','in_transit') and c.resolution is distinct from 'service_center' and
      not exists(select 1 from public.shipping_claim_jobs where claim_id=c.id and state in ('queued','creating','created','uncertain','delivered')),
    'can_retry',operational and (a.role='owner' or coalesce((a.permissions->>'claims.logistics.retry')::boolean,false)),
    'handling_resolutions',case when c.claim_type='return' then '["refund"]'::jsonb else coalesce((select jsonb_agg(x) from jsonb_array_elements_text(policy->'warranty_resolutions') x where x<>'service_center'),'[]') end);
end $$;


--
-- Name: shipping_pdc_identity_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shipping_pdc_identity_guard() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if tg_table_name='shipping_order_jobs' and new.to_ref ~ '^ASREV-' and (tg_op='INSERT' or new.to_ref is distinct from old.to_ref) then raise exception 'Reserved reverse reference.' using errcode='23514'; end if;
  if new.awb is not null and (tg_op='INSERT' or new.awb is distinct from old.awb) then
    perform pg_advisory_xact_lock(hashtextextended('pdc:awb:'||new.awb,0));
    if (tg_table_name='shipping_order_jobs' and exists(select 1 from public.shipping_claim_jobs where awb=new.awb)) or
       (tg_table_name='shipping_claim_jobs' and exists(select 1 from public.shipping_order_jobs where provider='pdc' and awb=new.awb)) then raise exception 'Courier identity conflict.' using errcode='23505'; end if;
  end if;
  return new;
end $$;


--
-- Name: shipping_record_claim_pdc_event(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shipping_record_claim_pdc_event(p_update jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    SET statement_timeout TO '4s'
    SET lock_timeout TO '2s'
    AS $$
declare j public.shipping_claim_jobs%rowtype; c public.after_sales_claims%rowtype; e public.shipping_webhook_events%rowtype;
  sid integer:=(p_update->>'status_id')::integer; at_time timestamptz:=(p_update->>'status_date')::timestamptz;
  observed timestamptz:=coalesce((p_update->>'observed_at')::timestamptz,clock_timestamp()); source_value text:=p_update->>'source';
  state_value text; stale boolean; enriched boolean:=false; next_status text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required.' using errcode='42501'; end if;
  if source_value is null or source_value not in ('webhook','reconciliation') or nullif(p_update->>'event_key','') is null or (source_value='webhook' and (sid is null or sid<=0 or at_time is null)) then raise exception 'Invalid courier event.'; end if;
  select * into j from public.shipping_claim_jobs where to_ref=p_update->>'ref';
  if not found then return jsonb_build_object('error','unknown_ref'); end if;
  perform 1 from public.customer_order_items where id=(select item_id from public.after_sales_claims where id=j.claim_id) for update;
  select * into c from public.after_sales_claims where id=j.claim_id for update;
  select * into j from public.shipping_claim_jobs where id=j.id for update;
  if j.awb is null or j.awb is distinct from p_update->>'awb' then return jsonb_build_object('error','awb_mismatch'); end if;
  perform set_config('app.reverse_write','on',true);
  select * into e from public.shipping_webhook_events where claim_shipment_job_id=j.id and processed_at is not null and
    ((sid is not null and provider_status_id=sid) or event_key=p_update->>'event_key') order by received_at,id limit 1;
  if found then
    if source_value<>'webhook' or e.source<>'reconciliation' or e.status_date is not null then return jsonb_build_object('received',true,'duplicate',true); end if;
    update public.shipping_webhook_events set status_date=at_time,source='webhook',provider_status_name=nullif(p_update->>'status_name',''),reason_name=nullif(p_update->>'reason','') where id=e.id;
    enriched:=true; state_value:=e.normalized_state;
  else
    state_value:=public.shipping_resolve_pdc_state(sid,p_update->>'status_name');
    insert into public.shipping_webhook_events(provider,event_key,awb,order_ref,provider_status_id,provider_status_name,status_date,reason_name,payload,processed_at,claim_shipment_job_id,normalized_state,source)
      values('pdc',p_update->>'event_key',j.awb,j.to_ref,sid,nullif(p_update->>'status_name',''),at_time,nullif(p_update->>'reason',''),'{}',clock_timestamp(),j.id,state_value,source_value) returning * into e;
  end if;
  stale:=coalesce(at_time,observed)<=coalesce(j.provider_status_at,j.provider_observed_at,'-infinity'::timestamptz) or
    (source_value='reconciliation' and observed<=coalesce(j.provider_observed_at,'-infinity'::timestamptz)) or j.state in ('delivered','cancelled','returned');
  -- A dated callback may enrich the current undated observation once. A newer
  -- different observation prevents the old enrichment from taking precedence.
  if enriched and j.provider_status_at is null and j.provider_status_id is not distinct from sid and j.normalized_state=state_value and j.state='created' then stale:=false; end if;
  if not stale then
    perform set_config('app.reverse_write','on',true);
    update public.shipping_claim_jobs set normalized_state=state_value,provider_status_id=sid,provider_status_at=at_time,provider_observed_at=observed,
      state=case when at_time is not null and state_value in ('delivered','cancelled','returned') then state_value else state end,updated_at=clock_timestamp() where id=j.id;
    if at_time is not null and at_time>=j.created_at and not exists(select 1 from public.shipping_claim_jobs newer where newer.claim_id=c.id and (newer.created_at,newer.id)>(j.created_at,j.id)) then
      next_status:=case when state_value='delivered' and c.status in ('pickup_scheduled','in_transit') then 'received'
        when state_value in ('picked_up','in_transit','arrived_at_hub','out_for_delivery') and c.status='pickup_scheduled' then 'in_transit' end;
      if next_status is not null then
        perform set_config('app.after_sales_claim_write','on',true);
        update public.after_sales_claims set status=next_status,revision=revision+1,updated_at=clock_timestamp() where id=c.id;
      end if;
    end if;
    -- No raw labels/reasons/body are put in customer timeline or generic audit.
    if at_time is not null then perform public.shipping_claim_emit(j.id,case when next_status='received' then 'reverse_received' else 'reverse_tracking' end,'provider','',true); end if;
  end if;
  return jsonb_build_object('received',true,'duplicate',enriched,'enriched',enriched,'stale',stale);
end $$;


--
-- Name: shipping_record_pdc_event(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shipping_record_pdc_event(p_update jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    SET statement_timeout TO '4s'
    SET lock_timeout TO '2s'
    AS $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required.' using errcode='42501'; end if;
  if exists(select 1 from public.shipping_claim_jobs where to_ref=p_update->>'ref') then
    if exists(select 1 from public.shipping_order_jobs where provider='pdc' and to_ref=p_update->>'ref') then return jsonb_build_object('error','identity_conflict'); end if;
    return public.shipping_record_claim_pdc_event(p_update);
  end if;
  return public.shipping_record_pdc_event_outbound(p_update);
end $$;


--
-- Name: shipping_record_pdc_event_before_sms(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shipping_record_pdc_event_before_sms(p_update jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    SET statement_timeout TO '4s'
    SET lock_timeout TO '2s'
    AS $$
declare
  v_job public.shipping_order_jobs%rowtype;
  v_event public.shipping_webhook_events%rowtype;
  v_id integer := (p_update->>'status_id')::integer;
  v_date timestamptz := (p_update->>'status_date')::timestamptz;
  v_source text := p_update->>'source';
  v_observed timestamptz := coalesce((p_update->>'observed_at')::timestamptz,clock_timestamp());
  v_state text;
  v_stale boolean;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required'; end if;
  if v_source not in ('webhook','reconciliation') or nullif(p_update->>'awb','') is null
    or nullif(p_update->>'ref','') is null or nullif(p_update->>'event_key','') is null
    or (v_source='webhook' and (v_id is null or v_id <= 0 or v_date is null)) then raise exception 'Invalid courier event'; end if;
  select * into v_job from public.shipping_order_jobs
    where provider='pdc' and to_ref=p_update->>'ref' for update;
  if not found then return jsonb_build_object('error','unknown_ref'); end if;
  if v_job.awb is null or v_job.awb <> p_update->>'awb' then return jsonb_build_object('error','awb_mismatch'); end if;

  -- Include successfully processed legacy rows. Unprocessed legacy failures do not swallow retries.
  select * into v_event from public.shipping_webhook_events
    where provider='pdc' and awb=v_job.awb and order_ref=v_job.to_ref and processed_at is not null
      and ((v_id is not null and provider_status_id=v_id) or event_key=p_update->>'event_key')
    order by received_at,id limit 1;
  if found then
    -- An API observation with this numeric ID may precede the real dated callback.
    -- Enrich the same canonical record once; never manufacture another event.
    if v_source='webhook' and v_event.source='reconciliation' and v_event.status_date is null then
      update public.shipping_webhook_events set status_date=v_date,source='webhook',
        provider_status_name=nullif(p_update->>'status_name',''),reason_name=nullif(p_update->>'reason','') where id=v_event.id;
      if v_job.provider_status_id=v_id and v_job.provider_status_source='reconciliation' and v_job.provider_status_at is null then
        update public.shipping_order_jobs set provider_status_at=v_date,provider_status_source='webhook',
          provider_status_name=nullif(p_update->>'status_name',''),provider_reason_name=nullif(p_update->>'reason',''),
          provider_status_observed_at=v_observed,updated_at=clock_timestamp() where id=v_job.id;
      end if;
      perform realtime.send(jsonb_build_object('changed',true),'changed','shipping:order:' || v_job.order_id::text,true);
      return jsonb_build_object('received',true,'duplicate',true,'enriched',true);
    end if;
    return jsonb_build_object('received',true,'duplicate',true);
  end if;

  v_state := public.shipping_resolve_pdc_state(v_id,p_update->>'status_name');
  insert into public.shipping_webhook_events(provider,event_key,awb,order_ref,provider_status_id,provider_status_name,
    status_date,reason_name,payload,processed_at,shipment_job_id,normalized_state,source)
  values ('pdc',p_update->>'event_key',v_job.awb,v_job.to_ref,v_id,nullif(p_update->>'status_name',''),
    v_date,nullif(p_update->>'reason',''),'{}'::jsonb,clock_timestamp(),v_job.id,v_state,v_source)
  returning * into v_event;

  -- Equal timestamps do not choose arbitrary status precedence. A snapshot started before
  -- a callback arrived cannot replace that callback, even if its API response arrives later.
  v_stale := coalesce(v_date,v_observed) <= coalesce(v_job.provider_status_at,v_job.provider_status_observed_at,'-infinity'::timestamptz)
    or (v_source='reconciliation' and v_observed <= coalesce(v_job.provider_status_observed_at,'-infinity'::timestamptz));
  if not v_stale then
    update public.shipping_order_jobs set provider_status_id=v_id,provider_status_name=nullif(p_update->>'status_name',''),
      provider_status_at=v_date,provider_reason_name=nullif(p_update->>'reason',''),normalized_state=v_state,
      provider_status_source=v_source,provider_status_observed_at=v_observed,updated_at=clock_timestamp() where id=v_job.id;
  end if;
  -- No order/payment/stock/fulfillment transitions occur here.
  perform realtime.send(jsonb_build_object('changed',true),'changed','shipping:order:' || v_job.order_id::text,true);
  return jsonb_build_object('received',true,'stale',v_stale);
end;
$$;


--
-- Name: shipping_record_pdc_event_outbound(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shipping_record_pdc_event_outbound(p_update jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    SET statement_timeout TO '4s'
    SET lock_timeout TO '2s'
    AS $_$
declare before_job public.shipping_order_jobs%rowtype; job public.shipping_order_jobs%rowtype;
  tracking public.shipping_webhook_events%rowtype; order_row public.customer_orders%rowtype;
  config public.sms_provider_settings%rowtype; binding public.sms_order_event_settings%rowtype;
  template public.sms_templates%rowtype; intent public.sms_order_events%rowtype;
  result jsonb; kind text; failure text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required'; end if;
  select * into before_job from public.shipping_order_jobs where provider='pdc' and to_ref=p_update->>'ref' for update;
  result:=public.shipping_record_pdc_event_before_sms(p_update);
  if result->>'received' is distinct from 'true' or result->>'duplicate'='true' or result->>'stale'='true' then return result; end if;

  -- This subtransaction isolates communication failures from trusted tracking.
  begin
    select * into job from public.shipping_order_jobs where id=before_job.id;
    if job.normalized_state is not distinct from before_job.normalized_state
      or job.normalized_state is not distinct from public.shipping_resolve_pdc_state(before_job.provider_status_id,before_job.provider_status_name)
      then return result; end if;
    kind:=case job.normalized_state when 'out_for_delivery' then 'pdc_out_for_delivery'
      when 'delivery_attempted' then 'pdc_delivery_exception' when 'delivered' then 'pdc_delivered' end;
    if kind is null then return result; end if;
    -- Never send another delivery attempt/milestone after observed delivery,
    -- even when a later provider event has a newer but contradictory timestamp.
    if kind<>'pdc_delivered' and exists(select 1 from public.shipping_webhook_events
      where provider='pdc' and order_ref=job.to_ref and shipment_job_id=job.id and awb=job.awb
        and normalized_state='delivered' and processed_at is not null)
      then return result; end if;
    select * into tracking from public.shipping_webhook_events where provider='pdc'
      and shipment_job_id=job.id and event_key=p_update->>'event_key' and processed_at is not null;
    select * into binding from public.sms_order_event_settings where event_type=kind;
    -- Do not replay a newly received observation of a pre-feature dated event.
    if tracking.status_date is not null and tracking.status_date<binding.capture_started_at then return result; end if;
    select * into order_row from public.customer_orders where id=job.order_id;
    select * into config from public.sms_provider_settings where id='vodafone';
    select * into template from public.sms_templates where id=case when order_row.sms_locale='ar' then binding.template_ar_id else binding.template_en_id end;
    intent.order_id:=job.order_id; intent.order_number:=order_row.order_number; intent.event_type:=kind;
    intent.shipment_job_id:=job.id; intent.shipment_awb:=job.awb; intent.tracking_event_id:=tracking.id;
    intent.provider_event_at:=tracking.status_date; intent.locale:=coalesce(order_row.sms_locale,'en');
    intent.template_id:=template.id; intent.template_text:=coalesce(case when intent.locale='ar' then template.text_ar else template.text_en end,'');
    intent.template_updated_at:=template.updated_at; intent.sender:=coalesce(nullif(template.sender,''),config.default_sender,'');
    intent.event_config_revision:=coalesce(binding.config_revision,0); intent.provider_config_revision:=coalesce(config.config_revision,0);
    intent.expires_at:=least(clock_timestamp()+interval '10 minutes',coalesce(tracking.status_date+interval '10 minutes',clock_timestamp()+interval '10 minutes'));
    failure:=public.sms_order_event_reason(intent);
    insert into public.sms_order_events(order_id,order_number,event_type,idempotency_key,locale,payload,
      shipment_job_id,shipment_awb,tracking_event_id,provider_event_at,template_id,template_text,template_updated_at,
      sender,event_config_revision,provider_config_revision,status,reason,expires_at,recipient_masked)
    values(intent.order_id,intent.order_number,kind,'pdc:'||job.id::text||':'||job.awb||':'||kind,intent.locale,
      jsonb_build_object('phone',order_row.phone,'customer_name',concat_ws(' ',order_row.first_name,order_row.last_name),
        'order_number',order_row.order_number,'awb',job.awb,'courier_name','PDC'),
      job.id,job.awb,tracking.id,tracking.status_date,intent.template_id,intent.template_text,intent.template_updated_at,
      intent.sender,intent.event_config_revision,intent.provider_config_revision,case when failure is null then 'pending' else 'suppressed' end,
      failure,intent.expires_at,case when order_row.phone ~ '[0-9]{3}$' then '••••••'||right(order_row.phone,3) else null end)
    on conflict(idempotency_key) do nothing;
  exception when query_canceled or others then
    -- No courier/customer/credential/error text, and no historical replay.
    raise log 'PDC SMS intent capture failed (SQLSTATE %).',sqlstate;
    begin
      if kind is not null then
        insert into public.sms_order_events(order_id,order_number,event_type,idempotency_key,locale,
          shipment_job_id,shipment_awb,tracking_event_id,provider_event_at,event_config_revision,provider_config_revision,status,reason)
        values(job.order_id,order_row.order_number,kind,'pdc:'||job.id::text||':'||job.awb||':'||kind,coalesce(order_row.sms_locale,'en'),
          job.id,job.awb,tracking.id,tracking.status_date,0,0,'suppressed','capture_failed')
        on conflict(idempotency_key) do nothing;
      end if;
    exception when query_canceled or others then raise log 'PDC SMS suppression audit unavailable (SQLSTATE %).',sqlstate;
    end;
  end;
  return result;
end $_$;


--
-- Name: shipping_resolve_pdc_state(integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shipping_resolve_pdc_state(p_id integer, p_name text) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_state text; v_count integer;
begin
  if p_id is not null then
    select normalized_state into v_state from public.shipping_status_mappings where provider='pdc' and provider_status_id=p_id;
    return coalesce(v_state,'unknown');
  end if;
  select count(distinct normalized_state), min(normalized_state) into v_count,v_state
  from public.shipping_status_mappings m where m.provider='pdc'
    and (lower(btrim(m.provider_label))=lower(btrim(p_name)) or exists (
      select 1 from unnest(m.provider_aliases) a where lower(btrim(a))=lower(btrim(p_name))));
  return case when v_count=1 then v_state else 'unknown' end;
end;
$$;


--
-- Name: shipping_valid_state(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shipping_valid_state(p_state text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select p_state = any(array['registered','picked_up','in_transit','arrived_at_hub','out_for_delivery','delivered',
    'delivery_attempted','delayed','rescheduled','held','returning','returned','cancelled','lost','damaged','partial_delivery','unknown']);
$$;


--
-- Name: sms_begin_dispatch(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sms_begin_dispatch(p_id uuid, p_token uuid, p_revision integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform 1 from public.sms_provider_settings where id='vodafone' for update;
  if exists(select 1 from public.sms_order_events e where e.batch_id=p_id and public.sms_order_event_reason(e) is not null) then
    perform public.sms_finish(p_id,p_token,jsonb_build_object('status','failed','category','order_event_suppressed'));
    return false;
  end if;
  return public.sms_begin_dispatch_before_order_sms(p_id,p_token,p_revision);
end $$;


--
-- Name: sms_begin_dispatch_before_order_sms(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sms_begin_dispatch_before_order_sms(p_id uuid, p_token uuid, p_revision integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare config public.sms_provider_settings%rowtype; job public.sms_batches%rowtype;
begin
  select * into config from public.sms_provider_settings where id='vodafone' for update;
  select * into job from public.sms_batches where id=p_id for update;
  if job.status<>'processing' or job.lease_token is distinct from p_token or job.dispatch_started_at is not null then raise exception 'SMS lease lost'; end if;
  if not config.is_enabled or config.config_revision<>p_revision then
    update public.sms_batches set status='queued',lease_token=null,locked_at=null,updated_at=clock_timestamp() where id=p_id;
    update public.sms_messages set status='queued' where batch_id=p_id;
    return false;
  end if;
  if job.expires_at<=clock_timestamp() then
    update public.sms_batches set status='failed',failure_category='expired',lease_token=null,updated_at=clock_timestamp() where id=p_id;
    update public.sms_messages set status='failed',failure_category='expired' where batch_id=p_id;
    return false;
  end if;
  update public.sms_batches set attempts=attempts+1,dispatch_started_at=clock_timestamp() where id=p_id returning * into job;
  insert into public.sms_attempts(batch_id,attempt_number,external_trx_id,status) values(p_id,job.attempts,job.external_trx_id,'processing');
  return true;
end $$;


--
-- Name: sms_check_dispatch(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sms_check_dispatch(p_id uuid, p_token uuid, p_revision integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare allowed boolean;
begin
 allowed:=public.sms_check_dispatch_before_claim_communications(p_id,p_token,p_revision);
 if allowed is distinct from true then return allowed;end if;
 return not exists(select 1 from public.after_sales_communications e where e.sms_batch_id=p_id and public.after_sales_communication_reason(e) is not null);
end $$;


--
-- Name: sms_check_dispatch_before_claim_communications(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sms_check_dispatch_before_claim_communications(p_id uuid, p_token uuid, p_revision integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare authorized boolean;
begin
  authorized:=public.sms_check_dispatch_before_order_sms(p_id,p_token,p_revision);
  if authorized is distinct from true then return authorized; end if;
  return not exists(select 1 from public.sms_order_events e where e.batch_id=p_id and public.sms_order_event_reason(e) is not null);
end $$;


--
-- Name: sms_check_dispatch_before_order_sms(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sms_check_dispatch_before_order_sms(p_id uuid, p_token uuid, p_revision integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare config public.sms_provider_settings%rowtype; job public.sms_batches%rowtype;
begin
  select * into config from public.sms_provider_settings where id='vodafone' for update;
  select * into job from public.sms_batches where id=p_id for update;
  if not found or job.status<>'processing' or job.lease_token is distinct from p_token or job.dispatch_started_at is null then return null; end if;
  return config.is_enabled and config.config_revision=p_revision
    and job.locked_at>clock_timestamp()-interval '2 minutes'
    and (job.expires_at is null or job.expires_at>clock_timestamp());
end $$;


--
-- Name: sms_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text DEFAULT 'vodafone'::text NOT NULL,
    idempotency_key text NOT NULL,
    fingerprint text NOT NULL,
    external_trx_id text DEFAULT ('ELC-'::text || (gen_random_uuid())::text) NOT NULL,
    traffic_type text NOT NULL,
    template_id uuid,
    triggered_by uuid,
    trigger_source text NOT NULL,
    priority integer DEFAULT 10 NOT NULL,
    expires_at timestamp with time zone,
    status text DEFAULT 'queued'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    lease_token uuid,
    locked_at timestamp with time zone,
    dispatch_started_at timestamp with time zone,
    result_status text,
    error_code integer,
    failure_category text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    submitted_at timestamp with time zone,
    CONSTRAINT sms_batches_fingerprint_check CHECK ((fingerprint ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT sms_batches_idempotency_key_check CHECK (((length(idempotency_key) >= 1) AND (length(idempotency_key) <= 200))),
    CONSTRAINT sms_batches_priority_check CHECK (((priority >= 0) AND (priority <= 100))),
    CONSTRAINT sms_batches_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'submitted'::text, 'partial'::text, 'failed'::text, 'uncertain'::text]))),
    CONSTRAINT sms_batches_traffic_type_check CHECK ((traffic_type = ANY (ARRAY['notification'::text, 'campaign'::text]))),
    CONSTRAINT sms_batches_trigger_source_check CHECK (((length(trigger_source) >= 1) AND (length(trigger_source) <= 80)))
);


--
-- Name: sms_claim(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sms_claim() RETURNS public.sms_batches
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform 1 from public.sms_provider_settings where id='vodafone' for update;
  with cancelled as (
    update public.sms_batches b set status='failed',failure_category='order_event_suppressed',updated_at=clock_timestamp()
    from public.sms_order_events e where e.batch_id=b.id and b.status='queued' and public.sms_order_event_reason(e) is not null
    returning b.id
  ) update public.sms_messages set status='failed',failure_category='order_event_suppressed' where batch_id in(select id from cancelled);
  return public.sms_claim_before_order_sms();
end $$;


--
-- Name: sms_claim_before_order_sms(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sms_claim_before_order_sms() RETURNS public.sms_batches
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare config public.sms_provider_settings%rowtype; job public.sms_batches%rowtype;
begin
  select * into config from public.sms_provider_settings where id='vodafone' for update;
  with stale as (
    update public.sms_batches set status='uncertain',failure_category='worker_interrupted',updated_at=clock_timestamp(),lease_token=null
    where status='processing' and locked_at<clock_timestamp()-interval '2 minutes' returning id
  ) update public.sms_messages set status='uncertain',failure_category='worker_interrupted' where batch_id in(select id from stale);
  update public.sms_attempts a set status='uncertain',failure_category='worker_interrupted',finished_at=clock_timestamp()
    from public.sms_batches b where a.batch_id=b.id and b.status='uncertain' and a.status='processing';
  with expired as (
    update public.sms_batches set status='failed',failure_category='expired',updated_at=clock_timestamp()
    where status='queued' and expires_at<=clock_timestamp() returning id
  ) update public.sms_messages set status='failed',failure_category='expired' where batch_id in(select id from expired);
  if not config.is_enabled or config.next_request_at>clock_timestamp() or exists(select 1 from public.sms_batches where status='processing') then return null; end if;
  select * into job from public.sms_batches where status='queued' and available_at<=clock_timestamp()
    order by priority desc,created_at,id limit 1 for update skip locked;
  if not found then return null; end if;
  update public.sms_batches set status='processing',locked_at=clock_timestamp(),lease_token=gen_random_uuid(),updated_at=clock_timestamp()
    where id=job.id returning * into job;
  update public.sms_messages set status='processing' where batch_id=job.id;
  update public.sms_provider_settings set next_request_at=clock_timestamp()+config.request_interval_ms*interval '1 millisecond' where id='vodafone';
  return job;
end $$;


--
-- Name: sms_order_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_order_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    order_number text,
    event_type text NOT NULL,
    idempotency_key text NOT NULL,
    locale text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    template_id uuid,
    template_text text DEFAULT ''::text NOT NULL,
    template_updated_at timestamp with time zone,
    sender text DEFAULT ''::text NOT NULL,
    recipient_masked text,
    event_config_revision integer NOT NULL,
    provider_config_revision integer NOT NULL,
    status text NOT NULL,
    reason text,
    batch_id uuid,
    attempts integer DEFAULT 0 NOT NULL,
    lease_token uuid,
    locked_at timestamp with time zone,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp(3) with time zone DEFAULT (now() + '00:10:00'::interval) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    shipment_job_id uuid,
    shipment_awb text,
    tracking_event_id uuid,
    provider_event_at timestamp with time zone,
    CONSTRAINT sms_order_events_check CHECK (((status = 'suppressed'::text) = (reason IS NOT NULL))),
    CONSTRAINT sms_order_events_check1 CHECK (((status = 'preparing'::text) = (lease_token IS NOT NULL))),
    CONSTRAINT sms_order_events_event_type_check CHECK ((event_type = ANY (ARRAY['order_confirmed'::text, 'payment_confirmed'::text, 'processing'::text, 'cancelled'::text, 'pdc_out_for_delivery'::text, 'pdc_delivery_exception'::text, 'pdc_delivered'::text]))),
    CONSTRAINT sms_order_events_locale_check CHECK ((locale = ANY (ARRAY['en'::text, 'ar'::text]))),
    CONSTRAINT sms_order_events_reason_check CHECK ((reason = ANY (ARRAY['provider_disabled'::text, 'provider_not_ready'::text, 'event_disabled'::text, 'configuration_changed'::text, 'template_unavailable'::text, 'order_removed'::text, 'expired'::text, 'invalid_phone'::text, 'invalid_template'::text, 'segment_limit'::text, 'storage_error'::text, 'capture_failed'::text, 'shipment_changed'::text, 'event_time_unknown'::text, 'stale_event'::text]))),
    CONSTRAINT sms_order_events_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'preparing'::text, 'queued'::text, 'suppressed'::text]))),
    CONSTRAINT sms_order_events_template_text_check CHECK ((length(template_text) <= 4000))
);


--
-- Name: sms_claim_order_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sms_claim_order_event() RETURNS public.sms_order_events
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: sms_enqueue(jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sms_enqueue(p_batch jsonb, p_messages jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare existing public.sms_batches%rowtype; config public.sms_provider_settings%rowtype;
  batch public.sms_batches%rowtype; actor uuid := nullif(p_batch->>'triggered_by','')::uuid;
  msg jsonb; n integer := jsonb_array_length(p_messages); i integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_batch->>'idempotency_key',0));
  select * into existing from public.sms_batches where idempotency_key=p_batch->>'idempotency_key';
  if found then
    if existing.fingerprint <> p_batch->>'fingerprint' then raise exception 'SMS idempotency conflict'; end if;
    return jsonb_build_object('id',existing.id,'status',existing.status,'external_trx_id',existing.external_trx_id,'reused',true);
  end if;
  select * into config from public.sms_provider_settings where id='vodafone' for update;
  if not config.is_enabled then raise exception 'SMS provider disabled'; end if;
  if n < 1 or n > config.batch_size or (p_batch->>'traffic_type'='notification' and n<>1) then raise exception 'Invalid SMS batch'; end if;
  if (p_batch->>'expires_at')::timestamptz <= clock_timestamp() then raise exception 'SMS expiry is in the past'; end if;
  if actor is not null and (select count(*) from public.sms_batches where triggered_by=actor and created_at>clock_timestamp()-interval '1 minute')>=10 then raise exception 'SMS rate limit'; end if;
  if actor is not null and p_batch->>'traffic_type'='campaign' and exists(select 1 from public.sms_batches where triggered_by=actor and traffic_type='campaign' and created_at>clock_timestamp()-interval '1 minute') then raise exception 'SMS campaign rate limit'; end if;
  insert into public.sms_batches(idempotency_key,fingerprint,traffic_type,template_id,triggered_by,trigger_source,priority,expires_at)
    values(p_batch->>'idempotency_key',p_batch->>'fingerprint',p_batch->>'traffic_type',nullif(p_batch->>'template_id','')::uuid,
      actor,p_batch->>'trigger_source',coalesce((p_batch->>'priority')::integer,10),(p_batch->>'expires_at')::timestamptz) returning * into batch;
  for msg in select value from jsonb_array_elements(p_messages) loop
    if not ((msg->>'sender') = any(config.sender_names)) then raise exception 'Invalid SMS sender'; end if;
    insert into public.sms_messages(batch_id,position,recipient,body,sender,encoding,units,segments)
      values(batch.id,i,msg->>'recipient',msg->>'body',msg->>'sender',msg->>'encoding',(msg->>'units')::integer,(msg->>'segments')::integer);
    i := i+1;
  end loop;
  return jsonb_build_object('id',batch.id,'status',batch.status,'external_trx_id',batch.external_trx_id,'reused',false);
end $$;


--
-- Name: sms_enqueue_order_event(uuid, uuid, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sms_enqueue_order_event(p_id uuid, p_token uuid, p_batch jsonb, p_messages jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: sms_finish(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sms_finish(p_id uuid, p_token uuid, p_result jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare job public.sms_batches%rowtype; state text:=p_result->>'status'; msg jsonb; i integer:=0; max_retry integer;
begin
  select * into job from public.sms_batches where id=p_id for update;
  if job.status<>'processing' or job.lease_token is distinct from p_token then raise exception 'SMS lease lost'; end if;
  if state='preflight_failed' then
    select preflight_retry_limit into max_retry from public.sms_provider_settings where id='vodafone';
    state:=case when job.attempts<=max_retry and (job.expires_at is null or job.expires_at>clock_timestamp()+interval '30 seconds') then 'queued' else 'failed' end;
  elsif state not in ('submitted','partial','failed','uncertain') then raise exception 'Invalid SMS result'; end if;
  if p_result->'messages' is not null and jsonb_array_length(p_result->'messages')<>(select count(*) from public.sms_messages where batch_id=p_id) then raise exception 'Invalid SMS result count'; end if;
  update public.sms_batches set status=state,result_status=p_result->>'result_status',error_code=(p_result->>'error_code')::integer,
    failure_category=p_result->>'category',updated_at=clock_timestamp(),submitted_at=case when state in ('submitted','partial') then clock_timestamp() end,
    available_at=case when state='queued' then clock_timestamp()+interval '30 seconds' else available_at end,
    lease_token=null,locked_at=null,dispatch_started_at=case when state='queued' then null else dispatch_started_at end where id=p_id;
  update public.sms_attempts set status=p_result->>'status',result_status=p_result->>'result_status',error_code=(p_result->>'error_code')::integer,
    failure_category=p_result->>'category',finished_at=clock_timestamp() where batch_id=p_id and attempt_number=job.attempts;
  if p_result->'messages' is null then
    update public.sms_messages set status=state,failure_category=p_result->>'category' where batch_id=p_id;
  else
    for msg in select value from jsonb_array_elements(p_result->'messages') loop
      update public.sms_messages set status=msg->>'status',provider_status=msg->>'provider_status',error_code=(msg->>'error_code')::integer,
        failure_category=msg->>'category',submitted_at=case when msg->>'status'='submitted' then clock_timestamp() end where batch_id=p_id and position=i;
      i:=i+1;
    end loop;
  end if;
end $$;


--
-- Name: sms_finish_order_event(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sms_finish_order_event(p_id uuid, p_token uuid, p_reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: sms_order_event_reason(public.sms_order_events); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sms_order_event_reason(e public.sms_order_events) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare failure text; job public.shipping_order_jobs%rowtype; expected text;
  binding public.sms_order_event_settings%rowtype; provider_updated timestamptz;
begin
  failure:=public.sms_order_event_reason_before_pdc_sms(e);
  if failure is not null or e.event_type not like 'pdc_%' then return failure; end if;
  select * into job from public.shipping_order_jobs where id=e.shipment_job_id;
  expected:=case e.event_type when 'pdc_out_for_delivery' then 'out_for_delivery'
    when 'pdc_delivery_exception' then 'delivery_attempted' when 'pdc_delivered' then 'delivered' end;
  if job.id is null or job.provider<>'pdc' or job.order_id is distinct from e.order_id
    or job.awb is distinct from e.shipment_awb or job.normalized_state is distinct from expected
    or public.shipping_resolve_pdc_state(job.provider_status_id,job.provider_status_name) is distinct from expected
    or not exists(select 1 from public.shipping_webhook_events t where t.id=e.tracking_event_id
      and t.shipment_job_id=job.id and t.awb=e.shipment_awb and t.order_ref=job.to_ref and t.processed_at is not null)
    then return 'shipment_changed'; end if;
  if e.provider_event_at is null then return 'event_time_unknown'; end if;
  select * into binding from public.sms_order_event_settings where event_type=e.event_type;
  select updated_at into provider_updated from public.sms_provider_settings where id='vodafone';
  if e.provider_event_at<greatest(binding.capture_started_at,binding.updated_at,provider_updated)
    or e.provider_event_at>clock_timestamp()+interval '5 minutes' then return 'stale_event'; end if;
  return null;
end $$;


--
-- Name: sms_order_event_reason_before_pdc_sms(public.sms_order_events); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sms_order_event_reason_before_pdc_sms(e public.sms_order_events) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: sms_order_setting_revision(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sms_order_setting_revision() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if row(new.is_enabled,new.template_en_id,new.template_ar_id) is distinct from
     row(old.is_enabled,old.template_en_id,old.template_ar_id) then
    new.config_revision:=old.config_revision+1; new.updated_at:=clock_timestamp();
  else new.config_revision:=old.config_revision; new.updated_at:=old.updated_at;
  end if;
  return new;
end $$;


--
-- Name: sms_snapshot_order_locale(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sms_snapshot_order_locale() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare value text:=current_setting('app.order_sms_locale',true);
begin
  if value in ('en','ar') then new.sms_locale:=value; end if;
  return new;
end $$;


--
-- Name: snapshot_customer_order_item_product_sku(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.snapshot_customer_order_item_product_sku() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if new.product_id is not null
    and nullif(btrim(new.product_sku), '') is null
  then
    select products.sku
    into new.product_sku
    from public.products as products
    where products.id = new.product_id;
  end if;

  new.product_sku := nullif(btrim(new.product_sku), '');
  return new;
end;
$$;


--
-- Name: store_analytics_get_customer_behavior(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.store_analytics_get_customer_behavior(p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_result jsonb;
begin
  if p_user_id is null or exists (
    select 1
    from public.store_analytics_internal_users as internal_users
    where internal_users.user_id = p_user_id
  ) then
    return jsonb_build_object(
      'available', false,
      'visits', 0,
      'returningVisits', 0,
      'productViews', 0,
      'totalProductDwellSeconds', 0,
      'averageProductDwellSeconds', 0,
      'addToCartEvents', 0,
      'checkoutStarts', 0,
      'lastSeenAt', null,
      'products', '[]'::jsonb
    );
  end if;

  with session_summary as (
    select
      count(*)::bigint as visits,
      greatest(count(*) - 1, 0)::bigint as returning_visits,
      max(last_seen_at) as last_seen_at
    from public.store_analytics_sessions
    where user_id = p_user_id
      and is_internal = false
  ),
  event_summary as (
    select
      count(*) filter (where events.event_name = 'product_view')::bigint as product_views,
      coalesce(
        sum(events.duration_ms) filter (
          where events.event_name = 'product_dwell'
        ),
        0
      )::bigint as total_product_dwell_ms,
      count(*) filter (
        where events.event_name = 'add_to_cart'
      )::bigint as add_to_cart_events,
      count(*) filter (
        where events.event_name = 'checkout_started'
      )::bigint as checkout_starts,
      max(events.occurred_at) as last_seen_at
    from public.store_analytics_events as events
    join public.store_analytics_sessions as sessions
      on sessions.id = events.session_id
    where events.user_id = p_user_id
      and sessions.is_internal = false
  ),
  product_engagement as (
    select
      events.product_id,
      count(*) filter (
        where events.event_name = 'product_view'
      )::bigint as view_count,
      coalesce(
        sum(events.duration_ms) filter (
          where events.event_name = 'product_dwell'
        ),
        0
      )::bigint as dwell_ms,
      max(events.occurred_at) as last_viewed_at
    from public.store_analytics_events as events
    join public.store_analytics_sessions as sessions
      on sessions.id = events.session_id
    where events.user_id = p_user_id
      and sessions.is_internal = false
      and events.product_id is not null
      and events.event_name in ('product_view', 'product_dwell')
    group by events.product_id
  ),
  top_products as (
    select
      products.title,
      products.slug,
      engagement.view_count,
      round((engagement.dwell_ms::numeric / 1000.0), 1) as dwell_seconds,
      engagement.last_viewed_at
    from product_engagement as engagement
    join public.products as products
      on products.id = engagement.product_id
    order by
      engagement.view_count desc,
      engagement.dwell_ms desc,
      engagement.last_viewed_at desc
    limit 5
  )
  select jsonb_build_object(
    'available', true,
    'visits', sessions.visits,
    'returningVisits', sessions.returning_visits,
    'productViews', events.product_views,
    'totalProductDwellSeconds',
      round((events.total_product_dwell_ms::numeric / 1000.0), 1),
    'averageProductDwellSeconds',
      case
        when events.product_views = 0 then 0
        else round(
          (
            events.total_product_dwell_ms::numeric
            / events.product_views::numeric
            / 1000.0
          ),
          1
        )
      end,
    'addToCartEvents', events.add_to_cart_events,
    'checkoutStarts', events.checkout_starts,
    'lastSeenAt', case
      when sessions.last_seen_at is null then events.last_seen_at
      when events.last_seen_at is null then sessions.last_seen_at
      else greatest(sessions.last_seen_at, events.last_seen_at)
    end,
    'products', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'title', top_products.title,
            'slug', top_products.slug,
            'viewCount', top_products.view_count,
            'dwellSeconds', top_products.dwell_seconds,
            'lastViewedAt', top_products.last_viewed_at
          )
          order by
            top_products.view_count desc,
            top_products.dwell_seconds desc,
            top_products.last_viewed_at desc
        )
        from top_products
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from session_summary as sessions
  cross join event_summary as events;

  return v_result;
end;
$$;


--
-- Name: store_analytics_get_live_visitors(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.store_analytics_get_live_visitors(p_active_seconds integer DEFAULT 180) RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select count(distinct visitor_id)::bigint
  from public.store_analytics_sessions
  where is_internal = false
    and last_seen_at >= now() - (
      greatest(
        60,
        least(coalesce(p_active_seconds, 180), 600)
      ) * interval '1 second'
    );
$$;


--
-- Name: store_analytics_get_snapshot(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.store_analytics_get_snapshot(p_window_days integer DEFAULT 30) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_window_days integer := greatest(1, least(coalesce(p_window_days, 30), 365));
  v_window_start timestamp with time zone;
  v_nps_total bigint := 0;
  v_nps_promoters bigint := 0;
  v_nps_passives bigint := 0;
  v_nps_detractors bigint := 0;
  v_nps_score integer;
  v_total_visits bigint := 0;
  v_returning_visits bigint := 0;
  v_unique_visitors bigint := 0;
  v_mature_carts bigint := 0;
  v_abandoned_carts bigint := 0;
  v_purchasing_customers bigint := 0;
  v_repeat_customers bigint := 0;
  v_page_views bigint := 0;
  v_product_views bigint := 0;
  v_unique_product_viewers bigint := 0;
  v_avg_product_dwell_seconds numeric := 0;
  v_add_to_cart_events bigint := 0;
  v_checkout_starts bigint := 0;
  v_orders_created bigint := 0;
begin
  v_window_start := now() - make_interval(days => v_window_days);

  select
    count(*)::bigint,
    count(*) filter (where score >= 9)::bigint,
    count(*) filter (where score between 7 and 8)::bigint,
    count(*) filter (where score <= 6)::bigint
  into
    v_nps_total,
    v_nps_promoters,
    v_nps_passives,
    v_nps_detractors
  from public.nps_responses
  where created_at >= now() - interval '90 days'
    and is_internal = false;

  v_nps_score := case
    when v_nps_total = 0 then null
    else round(
      (
        (v_nps_promoters::numeric / v_nps_total::numeric)
        - (v_nps_detractors::numeric / v_nps_total::numeric)
      ) * 100
    )::integer
  end;

  with window_sessions as (
    select
      sessions.id,
      sessions.visitor_id,
      sessions.started_at,
      exists (
        select 1
        from public.store_analytics_sessions as previous_sessions
        where previous_sessions.visitor_id = sessions.visitor_id
          and previous_sessions.is_internal = false
          and (
            previous_sessions.started_at < sessions.started_at
            or (
              previous_sessions.started_at = sessions.started_at
              and previous_sessions.id < sessions.id
            )
          )
      ) as is_returning
    from public.store_analytics_sessions as sessions
    where sessions.started_at >= v_window_start
      and sessions.is_internal = false
  )
  select
    count(*)::bigint,
    count(*) filter (where is_returning)::bigint,
    count(distinct visitor_id)::bigint
  into
    v_total_visits,
    v_returning_visits,
    v_unique_visitors
  from window_sessions;

  with candidate_carts as (
    select distinct events.cart_id
    from public.store_analytics_events as events
    join public.store_analytics_sessions as sessions
      on sessions.id = events.session_id
    where events.event_name = 'add_to_cart'
      and events.occurred_at >= v_window_start
      and events.cart_id is not null
      and sessions.is_internal = false
      and not exists (
        select 1
        from public.store_analytics_internal_carts as internal_carts
        where internal_carts.cart_id = events.cart_id
      )
      and not exists (
        select 1
        from public.store_analytics_events as earlier_events
        join public.store_analytics_sessions as earlier_sessions
          on earlier_sessions.id = earlier_events.session_id
        where earlier_events.cart_id = events.cart_id
          and earlier_events.event_name = 'add_to_cart'
          and earlier_events.occurred_at < v_window_start
          and earlier_sessions.is_internal = false
      )
  ),
  cart_activity as (
    select
      events.cart_id,
      min(events.occurred_at) filter (
        where events.event_name = 'add_to_cart'
      ) as started_at,
      max(events.occurred_at) as last_activity_at,
      bool_or(events.event_name = 'order_created') as has_order
    from public.store_analytics_events as events
    join candidate_carts
      on candidate_carts.cart_id = events.cart_id
    join public.store_analytics_sessions as sessions
      on sessions.id = events.session_id
    where sessions.is_internal = false
    group by events.cart_id
  ),
  mature_carts as (
    select cart_id, has_order
    from cart_activity
    where started_at >= v_window_start
      and (
        has_order
        or last_activity_at <= now() - interval '24 hours'
      )
  )
  select
    count(*)::bigint,
    count(*) filter (where not has_order)::bigint
  into
    v_mature_carts,
    v_abandoned_carts
  from mature_carts;

  with fulfilled_orders as (
    select orders.user_id, count(*)::bigint as fulfilled_count
    from public.customer_orders as orders
    where orders.status in ('completed', 'delivered')
      and not exists (
        select 1
        from public.store_analytics_internal_users as internal_users
        where internal_users.user_id = orders.user_id
      )
    group by orders.user_id
  )
  select
    count(*)::bigint,
    count(*) filter (where fulfilled_count >= 2)::bigint
  into
    v_purchasing_customers,
    v_repeat_customers
  from fulfilled_orders;

  select
    count(*) filter (where events.event_name = 'page_view')::bigint,
    count(*) filter (where events.event_name = 'product_view')::bigint,
    count(distinct events.visitor_id) filter (
      where events.event_name = 'product_view'
    )::bigint,
    coalesce(
      round(
        (
          sum(events.duration_ms) filter (
            where events.event_name = 'product_dwell'
          )
        )::numeric
        / nullif(
          count(*) filter (
            where events.event_name = 'product_view'
          ),
          0
        )::numeric
        / 1000.0,
        2
      ),
      0
    ),
    count(*) filter (where events.event_name = 'add_to_cart')::bigint,
    count(*) filter (where events.event_name = 'checkout_started')::bigint,
    count(*) filter (where events.event_name = 'order_created')::bigint
  into
    v_page_views,
    v_product_views,
    v_unique_product_viewers,
    v_avg_product_dwell_seconds,
    v_add_to_cart_events,
    v_checkout_starts,
    v_orders_created
  from public.store_analytics_events as events
  join public.store_analytics_sessions as sessions
    on sessions.id = events.session_id
  where events.occurred_at >= v_window_start
    and sessions.is_internal = false;

  return jsonb_build_object(
    'nps', jsonb_build_object(
      'score', v_nps_score,
      'total', v_nps_total,
      'promoters', v_nps_promoters,
      'passives', v_nps_passives,
      'detractors', v_nps_detractors
    ),
    'kpis', jsonb_build_object(
      'returningVisitorRate', case
        when v_total_visits = 0 then 0
        else round((v_returning_visits::numeric / v_total_visits::numeric) * 100, 2)
      end,
      'totalVisits', v_total_visits,
      'returningVisits', v_returning_visits,
      'uniqueVisitors', v_unique_visitors,
      'cartAbandonmentRate', case
        when v_mature_carts = 0 then 0
        else round((v_abandoned_carts::numeric / v_mature_carts::numeric) * 100, 2)
      end,
      'matureCarts', v_mature_carts,
      'abandonedCarts', v_abandoned_carts,
      'repeatPurchaseRate', case
        when v_purchasing_customers = 0 then 0
        else round((v_repeat_customers::numeric / v_purchasing_customers::numeric) * 100, 2)
      end,
      'purchasingCustomers', v_purchasing_customers,
      'repeatCustomers', v_repeat_customers
    ),
    'activity', jsonb_build_object(
      'pageViews', v_page_views,
      'productViews', v_product_views,
      'uniqueProductViewers', v_unique_product_viewers,
      'avgProductDwellSeconds', v_avg_product_dwell_seconds,
      'addToCartEvents', v_add_to_cart_events,
      'checkoutStarts', v_checkout_starts,
      'ordersCreated', v_orders_created
    )
  );
end;
$$;


--
-- Name: store_analytics_is_internal_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.store_analytics_is_internal_user(p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    p_user_id is not null
    and exists (
      select 1
      from public.store_analytics_internal_users as internal_users
      where internal_users.user_id = p_user_id
    );
$$;


--
-- Name: store_analytics_mark_internal_cart(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.store_analytics_mark_internal_cart(p_cart_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if p_cart_id is null then
    return false;
  end if;

  insert into public.store_analytics_internal_carts (cart_id)
  values (p_cart_id)
  on conflict (cart_id) do nothing;

  return true;
end;
$$;


--
-- Name: store_analytics_mark_internal_session_carts(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.store_analytics_mark_internal_session_carts(p_session_id uuid, p_visitor_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_inserted integer := 0;
begin
  if p_session_id is null or p_visitor_id is null then
    return 0;
  end if;

  if not exists (
    select 1
    from public.store_analytics_sessions as sessions
    where sessions.id = p_session_id
      and sessions.visitor_id = p_visitor_id
      and sessions.is_internal = true
  ) then
    return 0;
  end if;

  insert into public.store_analytics_internal_carts (cart_id)
  select distinct events.cart_id
  from public.store_analytics_events as events
  where events.session_id = p_session_id
    and events.visitor_id = p_visitor_id
    and events.cart_id is not null
  on conflict (cart_id) do nothing;

  get diagnostics v_inserted = row_count;

  return v_inserted;
end;
$$;


--
-- Name: storefront_prepare_order_payment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.storefront_prepare_order_payment() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_settings public.site_settings%rowtype;
  v_method text := lower(btrim(coalesce(new.payment_method, '')));
  v_enabled boolean := false;
  v_fee numeric(12, 2) := 0;
begin
  select settings.*
  into v_settings
  from public.site_settings as settings
  where settings.key = 'default';

  if not found then
    if v_method in ('', 'cash') then
      new.payment_method := 'cash';
      new.payment_fee_amount := 0;
      new.payment_proof_status := 'not_required';
      return new;
    end if;

    raise exception 'Store payment settings are unavailable.';
  end if;

  -- Keep the currently deployed checkout compatible while the new two-step
  -- frontend is rolled out. The new server route requires an explicit method.
  if v_method = '' then
    v_method := 'cash';
  end if;

  case v_method
    when 'card' then
      v_enabled := v_settings.payment_card_enabled;
      v_fee := v_settings.payment_card_fee;
    when 'bank_transfer' then
      v_enabled := v_settings.payment_bank_transfer_enabled;
      v_fee := v_settings.payment_bank_transfer_fee;
    when 'instapay' then
      v_enabled := v_settings.payment_instapay_enabled;
      v_fee := v_settings.payment_instapay_fee;
    when 'paypal' then
      v_enabled := v_settings.payment_paypal_enabled;
      v_fee := v_settings.payment_paypal_fee;
    when 'cash' then
      v_enabled := v_settings.payment_cash_enabled;
      v_fee := v_settings.payment_cash_fee;
    else
      raise exception 'Choose a valid payment method.';
  end case;

  if not coalesce(v_enabled, false) then
    raise exception 'The selected payment method is not available.';
  end if;

  new.payment_method := v_method;
  new.payment_fee_amount := round(greatest(coalesce(v_fee, 0), 0)::numeric, 2);
  new.total_amount := round((coalesce(new.total_amount, 0) + new.payment_fee_amount)::numeric, 2);
  new.payment_proof_status := case
    when v_method in ('bank_transfer', 'instapay') then 'pending_upload'
    else 'not_required'
  end;

  return new;
end;
$$;


--
-- Name: support_add_message(uuid, uuid, text, text, text, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.support_add_message(p_ticket_id uuid, p_sender_id uuid, p_sender_type text, p_sender_name text, p_body text, p_internal boolean, p_idempotency_key uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_ticket public.support_tickets%rowtype;
  v_message_id uuid;
begin
  select * into v_ticket from public.support_tickets where id = p_ticket_id for update;
  if not found then raise exception 'Ticket not found.' using errcode = '22023'; end if;

  if p_sender_type = 'customer' then
    if v_ticket.customer_id is distinct from p_sender_id or p_internal then
      raise exception 'Ticket is unavailable.' using errcode = '22023';
    end if;
    if v_ticket.status in ('resolved', 'closed') then
      raise exception 'Reopen the ticket before replying.' using errcode = '22023';
    end if;
    if not exists (select 1 from public.customer_profiles where id = p_sender_id and is_active = true) then
      raise exception 'Customer account is unavailable.' using errcode = '22023';
    end if;
  elsif p_sender_type = 'staff' then
    if not exists (
      select 1 from public.admin_users a where a.id = p_sender_id and a.is_active = true
        and (a.role = 'owner' or coalesce((a.permissions ->> 'support.reply')::boolean, false))
    ) then raise exception 'Support access is required.' using errcode = '22023'; end if;
    if v_ticket.status = 'closed' and not p_internal then
      raise exception 'Reopen the ticket before replying.' using errcode = '22023';
    end if;
  else
    raise exception 'Invalid sender.' using errcode = '22023';
  end if;

  insert into public.support_ticket_messages (ticket_id, sender_id, sender_type, sender_name, body, is_internal, idempotency_key)
  values (p_ticket_id, p_sender_id, p_sender_type, p_sender_name, p_body, p_internal, p_idempotency_key)
  on conflict (ticket_id, sender_id, idempotency_key) do nothing returning id into v_message_id;
  if v_message_id is null then
    select id into v_message_id from public.support_ticket_messages
    where ticket_id = p_ticket_id and sender_id = p_sender_id and idempotency_key = p_idempotency_key;
    return v_message_id;
  end if;

  if not p_internal then
    perform set_config('app.support_actor_id', p_sender_id::text, true);
    perform set_config('app.support_actor_type', p_sender_type, true);
    update public.support_tickets set
      last_reply_at = now(),
      status = case when p_sender_type = 'customer' then 'waiting_for_support' else 'waiting_for_customer' end,
      closed_at = null
    where id = p_ticket_id;
  end if;
  return v_message_id;
end;
$$;


--
-- Name: support_create_ticket(uuid, uuid, uuid, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.support_create_ticket(p_customer_id uuid, p_order_id uuid, p_category_id uuid, p_subject text, p_body text, p_idempotency_key uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_ticket_id uuid;
  v_email text;
  v_name text;
begin
  select email, coalesce(nullif(full_name, ''), email) into v_email, v_name
  from public.customer_profiles where id = p_customer_id and is_active = true;
  if v_email is null then raise exception 'Customer account is unavailable.' using errcode = '22023'; end if;
  if p_order_id is not null and not exists (
    select 1 from public.customer_orders where id = p_order_id and user_id = p_customer_id
  ) then raise exception 'Order is unavailable.' using errcode = '22023'; end if;
  if p_category_id is not null and not exists (
    select 1 from public.help_categories where id = p_category_id and is_active = true
  ) then raise exception 'Category is unavailable.' using errcode = '22023'; end if;

  insert into public.support_tickets (customer_id, customer_email, customer_name, order_id, category_id, subject, idempotency_key)
  values (p_customer_id, v_email, left(v_name, 160), p_order_id, p_category_id, p_subject, p_idempotency_key)
  on conflict (customer_id, idempotency_key) where customer_id is not null do nothing
  returning id into v_ticket_id;

  if v_ticket_id is null then
    select id into v_ticket_id from public.support_tickets
    where customer_id = p_customer_id and idempotency_key = p_idempotency_key;
    return v_ticket_id;
  end if;

  insert into public.support_ticket_messages (ticket_id, sender_id, sender_type, sender_name, body, idempotency_key)
  values (v_ticket_id, p_customer_id, 'customer', left(v_name, 160), p_body, p_idempotency_key);
  insert into public.support_ticket_events (ticket_id, actor_id, actor_type, event_type, new_value)
  values (v_ticket_id, p_customer_id, 'customer', 'created', 'open');
  return v_ticket_id;
end;
$$;


--
-- Name: support_customer_unread_counts(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.support_customer_unread_counts(p_customer_id uuid, p_ticket_ids uuid[]) RETURNS TABLE(ticket_id uuid, unread_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select t.id, count(m.id)
  from public.support_tickets t
  join public.support_ticket_messages m on m.ticket_id = t.id
  where t.customer_id = p_customer_id
    and t.id = any(p_ticket_ids)
    and m.sender_type = 'staff'
    and m.is_internal = false
    and m.customer_read_at is null
  group by t.id;
$$;


--
-- Name: support_customer_unread_ticket_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.support_customer_unread_ticket_count(p_customer_id uuid) RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select count(distinct t.id)
  from public.support_tickets t
  join public.support_ticket_messages m on m.ticket_id = t.id
  where t.customer_id = p_customer_id
    and m.sender_type = 'staff'
    and m.is_internal = false
    and m.customer_read_at is null;
$$;


--
-- Name: support_reset_manifest(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.support_reset_manifest() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new.scope = 'full' then
    new.manifest := jsonb_set(
      new.manifest,
      '{support}',
      coalesce((select jsonb_agg(name) from storage.objects where bucket_id = 'support-attachments'), '[]'::jsonb)
    );
  end if;
  return new;
end;
$$;


--
-- Name: support_ticket_audit_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.support_ticket_audit_update() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_actor uuid := nullif(current_setting('app.support_actor_id', true), '')::uuid;
  v_actor_type text := coalesce(nullif(current_setting('app.support_actor_type', true), ''), 'system');
begin
  if old.status is distinct from new.status then
    insert into public.support_ticket_events (ticket_id, actor_id, actor_type, event_type, old_value, new_value)
    values (new.id, v_actor, v_actor_type, 'status', old.status, new.status);
  end if;
  if old.priority is distinct from new.priority then
    insert into public.support_ticket_events (ticket_id, actor_id, actor_type, event_type, old_value, new_value)
    values (new.id, v_actor, v_actor_type, 'priority', old.priority, new.priority);
  end if;
  if old.assigned_admin_id is distinct from new.assigned_admin_id then
    insert into public.support_ticket_events (ticket_id, actor_id, actor_type, event_type, old_value, new_value)
    values (new.id, v_actor, v_actor_type, 'assignment', old.assigned_admin_id::text, new.assigned_admin_id::text);
  end if;
  return new;
end;
$$;


--
-- Name: support_ticket_before_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.support_ticket_before_update() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if (new.customer_id is distinct from old.customer_id and not (old.customer_id is not null and new.customer_id is null))
    or new.customer_email is distinct from old.customer_email
    or new.customer_name is distinct from old.customer_name
    or (new.order_id is distinct from old.order_id and not (old.order_id is not null and new.order_id is null))
    or new.idempotency_key is distinct from old.idempotency_key then
    raise exception 'Ticket ownership and order cannot be changed.' using errcode = '22023';
  end if;

  if new.assigned_admin_id is not null and new.assigned_admin_id is distinct from old.assigned_admin_id
    and not exists (
      select 1 from public.admin_users a
      where a.id = new.assigned_admin_id and a.is_active = true
        and (a.role = 'owner' or coalesce((a.permissions ->> 'support.reply')::boolean, false))
    ) then
    raise exception 'Assignee cannot access support tickets.' using errcode = '22023';
  end if;

  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: support_ticket_snapshot_actor(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.support_ticket_snapshot_actor() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if new.actor_name is not null then return new; end if;
  if new.actor_type = 'staff' then
    select coalesce(nullif(pg_catalog.btrim(a.full_name), ''), a.email, a.id::text)
      into new.actor_name from public.admin_users a where a.id = new.actor_id;
  elsif new.actor_type = 'customer' then
    select coalesce(nullif(pg_catalog.btrim(p.full_name), ''), p.email, p.id::text)
      into new.actor_name from public.customer_profiles p where p.id = new.actor_id;
  else
    new.actor_name := 'System';
  end if;
  new.actor_name := coalesce(new.actor_name, new.actor_id::text, 'System');
  return new;
end;
$$;


--
-- Name: support_touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.support_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: support_update_ticket(uuid, uuid, text, text, text, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.support_update_ticket(p_ticket_id uuid, p_actor_id uuid, p_actor_type text, p_status text, p_priority text, p_assignee_id uuid, p_change_assignment boolean) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_ticket public.support_tickets%rowtype;
  v_can_manage boolean;
begin
  select * into v_ticket from public.support_tickets where id = p_ticket_id for update;
  if not found then raise exception 'Ticket not found.' using errcode = '22023'; end if;

  if p_actor_type = 'customer' then
    if v_ticket.customer_id is distinct from p_actor_id
      or p_priority is not null or p_change_assignment then
      raise exception 'Ticket is unavailable.' using errcode = '22023';
    end if;
    if p_status = 'closed' and v_ticket.status not in ('closed', 'resolved') then
      null;
    elsif p_status = 'open' and v_ticket.status in ('closed', 'resolved')
      and v_ticket.updated_at >= now() - interval '7 days' then
      null;
    else
      raise exception 'This status change is not available.' using errcode = '22023';
    end if;
  elsif p_actor_type = 'staff' then
    select a.role = 'owner' or coalesce((a.permissions ->> 'support.manage')::boolean, false)
    into v_can_manage from public.admin_users a where a.id = p_actor_id and a.is_active = true;
    if not coalesce(v_can_manage, false) then
      raise exception 'Support management access is required.' using errcode = '22023';
    end if;
    if p_status is not null and p_status not in ('open', 'in_progress', 'waiting_for_customer', 'waiting_for_support', 'resolved', 'closed') then
      raise exception 'Invalid status.' using errcode = '22023';
    end if;
    if p_priority is not null and p_priority not in ('low', 'normal', 'high', 'urgent') then
      raise exception 'Invalid priority.' using errcode = '22023';
    end if;
  else
    raise exception 'Invalid actor.' using errcode = '22023';
  end if;

  perform set_config('app.support_actor_id', p_actor_id::text, true);
  perform set_config('app.support_actor_type', p_actor_type, true);
  update public.support_tickets set
    status = coalesce(p_status, status),
    priority = coalesce(p_priority, priority),
    assigned_admin_id = case when p_change_assignment then p_assignee_id else assigned_admin_id end,
    closed_at = case when coalesce(p_status, status) = 'closed' then coalesce(closed_at, now()) else null end
  where id = p_ticket_id;
  return p_ticket_id;
end;
$$;


--
-- Name: sync_product_average_rating(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_product_average_rating() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_product_id uuid;
begin
  if tg_op = 'DELETE' then
    v_product_id := old.product_id;
  else
    v_product_id := new.product_id;
  end if;

  update public.products
  set average_rating = coalesce((
    select round(avg(reviews.rating)::numeric, 2)
    from public.product_reviews as reviews
    where reviews.product_id = v_product_id
  ), 0)
  where id = v_product_id;

  if tg_op = 'UPDATE' then
    if old.product_id is distinct from new.product_id then
      update public.products
      set average_rating = coalesce((
        select round(avg(reviews.rating)::numeric, 2)
        from public.product_reviews as reviews
        where reviews.product_id = old.product_id
      ), 0)
      where id = old.product_id;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;


--
-- Name: system_reset_assert_owner(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.system_reset_assert_owner(p_owner uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Server authorization required.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.admin_users where id = p_owner and role = 'owner' and is_active) then
    raise exception 'Active owner access required.' using errcode = '42501';
  end if;
end;
$$;


--
-- Name: system_reset_begin(uuid, text, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.system_reset_begin(p_owner uuid, p_scope text, p_id uuid, p_media_files jsonb DEFAULT '[]'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    SET lock_timeout TO '10s'
    SET statement_timeout TO '120s'
    AS $_$
declare
  v_tables text[] := public.system_reset_tables(p_scope);
  v_remaining text[];
  v_table text;
  v_trigger record;
  v_triggers jsonb := '[]';
  v_restore jsonb;
  v_plan jsonb;
  v_actor jsonb;
  v_run public.system_reset_runs%rowtype;
  v_manifest jsonb := jsonb_build_object('media', p_media_files, 'documents', '[]'::jsonb, 'users', '[]'::jsonb);
  v_column record;
begin
  if p_scope in ('products','commerce','content','full') then perform public.assert_built_in_erp(); end if;
  perform public.system_reset_assert_owner(p_owner);
  if not pg_try_advisory_xact_lock(hashtextextended('elcomputer-system-reset', 0)) then
    raise exception 'Another reset is running.';
  end if;
  select * into v_run from public.system_reset_runs where id = p_id for update;
  if found then
    if v_run.owner_id <> p_owner or v_run.scope <> p_scope then raise exception 'Reset request does not match.'; end if;
    return to_jsonb(v_run);
  end if;
  if exists (select 1 from public.system_reset_runs where status = 'cleanup_pending') then
    raise exception 'Finish the pending reset before starting another.';
  end if;
  -- Exclusive locks prevent concurrent changes between the dependency check and deletion.
  for v_table in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname <> all(array['system_reset_runs', 'system_reset_attempts']) order by c.relname
  loop
    execute format('lock table public.%I in access exclusive mode', v_table);
  end loop;

  if p_scope='full' and exists(select 1 from public.sms_batches where status='processing') then
    raise exception 'Wait for the SMS worker to finish before resetting.';
  end if;
  v_plan := public.system_reset_plan(p_owner, p_scope);
  if jsonb_array_length(v_plan->'blockers') > 0 then
    raise exception 'Linked records prevent this reset. Review the affected data first.';
  end if;
  select jsonb_build_object('name', coalesce(nullif(full_name, ''), email), 'email', email) into v_actor
    from public.admin_users where id = p_owner;
  if p_scope in ('documents', 'full') and to_regclass('storage.objects') is not null then
    select jsonb_set(v_manifest, '{documents}', coalesce(jsonb_agg(name), '[]')) into v_manifest
      from storage.objects where bucket_id = 'admin-documents';
  end if;
  if p_scope = 'full' then
    select jsonb_set(v_manifest, '{users}', coalesce(jsonb_agg(id), '[]')) into v_manifest from auth.users where id <> p_owner;
  end if;
  insert into public.system_reset_runs (id, owner_id, scope, status, actor, summary, manifest)
    values (p_id, p_owner, p_scope, 'cleanup_pending', v_actor, v_plan->'counts', v_manifest);
  -- Flush deferred constraint events before changing trigger state. Keep FK checks immediate.
  set constraints all immediate;
  -- Only application triggers are suspended, inside this transaction. FK constraints stay active.
  -- Their original enabled/replica/always states are restored before commit, or rolled back on error.
  for v_trigger in
    select t.tgname, t.tgenabled, c.relname from pg_trigger t join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not t.tgisinternal and t.tgenabled <> 'D'
      and c.relname = any(v_tables || case when p_scope = 'media' then array['products', 'product_variants', 'product_images', 'categories', 'brands', 'site_settings', 'site_hero_banners', 'site_offer_cards', 'customer_order_items'] else array[]::text[] end)
  loop
    v_triggers := v_triggers || jsonb_build_array(to_jsonb(v_trigger));
    execute format('alter table public.%I disable trigger %I', v_trigger.relname, v_trigger.tgname);
  end loop;
  if 'customer_orders' = any(v_tables) and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'customer_orders' and column_name = 'awaiting_customer_message_id') then
    update public.customer_orders set awaiting_customer_message_id = null;
  end if;
  if p_scope in ('orders', 'commerce') and to_regclass('public.erp_sync_jobs') is not null then
    execute 'delete from public.erp_sync_jobs where local_entity_type = $1' using 'customer_order';
  end if;
  if p_scope in ('orders', 'commerce') and to_regclass('public.erp_entity_links') is not null then
    execute 'delete from public.erp_entity_links where local_entity_type = $1' using 'customer_order';
  end if;
  if p_scope = 'products' and to_regclass('public.erp_entity_links') is not null then
    execute 'delete from public.erp_entity_links where local_entity_type = any($1)' using array['product', 'product_variant']::text[];
  end if;
  select array_agg(t) into v_remaining from unnest(v_tables) t where to_regclass(format('public.%I', t)) is not null;
  while cardinality(v_remaining) > 0 loop
    select candidate into v_table from unnest(v_remaining) candidate
    where not exists (
      select 1 from pg_constraint fk join pg_class child on child.oid = fk.conrelid
      where fk.contype = 'f' and fk.confrelid = to_regclass(format('public.%I', candidate))
        and child.relname = any(v_remaining) and fk.conrelid <> fk.confrelid
        and fk.conname <> 'customer_orders_awaiting_customer_message_fkey'
    ) limit 1;
    if v_table is null then raise exception 'Unresolved reset dependency. No data was erased.'; end if;
    execute format('delete from public.%I', v_table);
    v_remaining := array_remove(v_remaining, v_table);
  end loop;
  if p_scope = 'commerce' then
    perform set_config('app.serialized_inventory_write', 'on', true);
    update public.products set stock_quantity = 0, cost_price = 0;
    if to_regclass('public.product_variants') is not null then
      update public.product_variants set stock_quantity = 0, cost_price = 0;
    end if;
  end if;
  if p_scope = 'media' then
    for v_column in select table_name, column_name from information_schema.columns
      where table_schema = 'public' and data_type in ('text', 'character varying')
        and table_name = any(array['products', 'product_variants', 'product_images', 'categories', 'brands', 'site_settings', 'site_hero_banners', 'site_offer_cards', 'customer_order_items'])
        and column_name = any(array['image_url', 'logo_url', 'site_logo_url', 'banner_ad_1_image_url', 'banner_ad_2_image_url'])
    loop
      execute format('update public.%I set %I = %L where %I like %L', v_column.table_name, v_column.column_name, '', v_column.column_name, '/uploads/%');
    end loop;
  end if;
  if p_scope = 'full' then
    delete from public.admin_users where id <> p_owner;
    delete from public.system_reset_runs where id <> p_id;
    delete from public.system_reset_attempts where owner_id <> p_owner;
    if to_regclass('public.store_analytics_internal_users') is not null then
      insert into public.store_analytics_internal_users(user_id) values (p_owner) on conflict do nothing;
    end if;
    if to_regclass('public.commerce_serialized_unit_code_seq') is not null then
      alter sequence public.commerce_serialized_unit_code_seq restart with 1;
    end if;
  end if;
  for v_restore in select value from jsonb_array_elements(v_triggers) loop
    execute format('alter table public.%I enable %s trigger %I', v_restore->>'relname',
      case v_restore->>'tgenabled' when 'A' then 'always' when 'R' then 'replica' else '' end, v_restore->>'tgname');
  end loop;
  select * into v_run from public.system_reset_runs where id = p_id;
  return to_jsonb(v_run);
end;
$_$;


--
-- Name: system_reset_check_attempt(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.system_reset_check_attempt(p_owner uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_count integer;
begin
  perform public.system_reset_assert_owner(p_owner);
  insert into public.system_reset_attempts as attempts (owner_id, window_started_at, attempts)
  values (p_owner, clock_timestamp(), 1)
  on conflict (owner_id) do update set
    attempts = case when attempts.window_started_at < clock_timestamp() - interval '15 minutes' then 1 else attempts.attempts + 1 end,
    window_started_at = case when attempts.window_started_at < clock_timestamp() - interval '15 minutes' then clock_timestamp() else attempts.window_started_at end
  returning attempts into v_count;
  return v_count <= 5;
end;
$$;


--
-- Name: system_reset_finish(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.system_reset_finish(p_owner uuid, p_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_run public.system_reset_runs%rowtype;
begin
  perform public.system_reset_assert_owner(p_owner);
  select * into v_run from public.system_reset_runs where id = p_id and owner_id = p_owner for update;
  if not found then raise exception 'Reset request not found.'; end if;
  if v_run.status <> 'completed' then
    -- This is intentionally inserted AFTER all database, file and account cleanup.
    insert into public.admin_activity_logs (admin_user_id, author_name, author_email, author_role, action_key, description, metadata, created_at)
      values (p_owner, v_run.actor->>'name', v_run.actor->>'email', 'owner', 'settings.system_reset.completed',
        format('%s completed the %s reset.', v_run.actor->>'name', v_run.scope),
        jsonb_build_object('reset_id', p_id, 'scope', v_run.scope, 'records', v_run.summary), clock_timestamp());
    update public.system_reset_runs set status = 'completed', completed_at = clock_timestamp(), manifest = '{}' where id = p_id returning * into v_run;
  end if;
  return jsonb_build_object('id', v_run.id, 'scope', v_run.scope, 'status', v_run.status, 'completed_at', v_run.completed_at);
end;
$$;


--
-- Name: system_reset_plan(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.system_reset_plan(p_owner uuid, p_scope text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_tables text[] := public.system_reset_tables(p_scope);
  v_table text;
  v_count bigint;
  v_counts jsonb := '{}';
  v_blockers jsonb := '[]';
  v_fk record;
  v_predicate text;
  v_unknown text[];
begin
  perform public.system_reset_assert_owner(p_owner);
  if p_scope = 'full' then
    select array_agg(c.relname) into v_unknown
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and not c.relname = any(v_tables || array['admin_users', 'system_reset_runs', 'system_reset_attempts', 'after_sales_policies', 'after_sales_return_reasons', 'after_sales_policy_versions', 'after_sales_claims', 'after_sales_claim_events', 'after_sales_claim_information', 'after_sales_claim_evidence', 'shipping_claim_jobs', 'email_provider_settings', 'email_templates', 'email_preferences', 'email_messages', 'email_attempts', 'email_events', 'after_sales_communication_settings', 'after_sales_communications', 'quick_setup_state', 'quick_setup_revisions', 'quick_setup_events']);
    if cardinality(v_unknown) > 0 then
      raise exception 'Unrecognized tables found. Update the reset scope before continuing.' using errcode = 'P0001';
    end if;
  end if;
  foreach v_table in array v_tables loop
    if to_regclass(format('public.%I', v_table)) is not null then
      execute format('select count(*) from public.%I', v_table) into v_count;
      v_counts := v_counts || jsonb_build_object(v_table, v_count);
    end if;
  end loop;
  -- Never silently cascade into data outside the selected scope.
  for v_fk in
    select con.*, src.relname as source_name, ns.nspname as source_schema
    from pg_constraint con
    join pg_class target on target.oid = con.confrelid
    join pg_namespace tn on tn.oid = target.relnamespace
    join pg_class src on src.oid = con.conrelid
    join pg_namespace ns on ns.oid = src.relnamespace
    where con.contype = 'f' and tn.nspname = 'public' and target.relname = any(v_tables)
      and not (ns.nspname = 'public' and src.relname = any(v_tables))
      and not (ns.nspname='public' and src.relname='after_sales_policies' and target.relname in ('products','categories') and con.confdeltype='c') and con.confdeltype <> 'n'
  loop
    select string_agg(format('%I is not null', a.attname), ' and ') into v_predicate
    from pg_attribute a where a.attrelid = v_fk.conrelid and a.attnum = any(v_fk.conkey);
    execute format('select count(*) from %I.%I where %s', v_fk.source_schema, v_fk.source_name, v_predicate) into v_count;
    if v_count > 0 then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('table', v_fk.source_name, 'count', v_count));
    end if;
  end loop;
  if p_scope = 'full' then
    select count(*) into v_count from auth.users where id <> p_owner;
    v_counts := v_counts || jsonb_build_object('other_user_accounts', v_count);
  end if;

  if p_scope='full' then
   select (select count(*) from public.email_messages)+(select count(*) from public.email_preferences)+(select count(*) from public.email_templates)+(select count(*) from public.email_provider_settings where api_key_encrypted is not null or webhook_token_encrypted is not null or updated_by is not null) into v_count;
   if v_count>0 then v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('table','email_retained_data','count',v_count)); end if;
  end if;

  if p_scope='full' then
   select (select count(*) from public.after_sales_communications)+(select count(*) from public.after_sales_communication_settings where updated_by is not null) into v_count;
   if v_count>0 then v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('table','claim_communications_retained','count',v_count));end if;
  end if;
  return jsonb_build_object('counts', v_counts, 'blockers', v_blockers);


end;
$$;


--
-- Name: system_reset_tables(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.system_reset_tables(p_scope text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
declare tables text[]:=public.system_reset_tables_before_order_sms(p_scope); pos integer;
begin
  if p_scope='full' then
    pos:=array_position(tables,'sms_attempts');
    tables:=tables[1:pos-1]||array['sms_order_events','sms_order_event_settings']||tables[pos:cardinality(tables)];
  end if;
  return tables;
end $$;


--
-- Name: system_reset_tables_before_chat(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.system_reset_tables_before_chat(p_scope text) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select case p_scope
    when 'content' then array['help_articles', 'help_categories']::text[] || public.system_reset_tables_before_support(p_scope)
    when 'full' then array[
      'support_ticket_attachments', 'support_ticket_events', 'support_ticket_messages',
      'support_tickets', 'help_articles', 'help_categories'
    ]::text[] || public.system_reset_tables_before_support(p_scope)
    else public.system_reset_tables_before_support(p_scope)
  end;
$$;


--
-- Name: system_reset_tables_before_erp_ownership(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.system_reset_tables_before_erp_ownership(p_scope text) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  with base as (select public.system_reset_tables_before_preorders(p_scope) as tables)
  select case when p_scope in ('orders', 'commerce', 'full') then
    tables[1:array_position(tables, 'customer_orders')]
    || array['preorder_payments']::text[]
    || tables[array_position(tables, 'customer_orders') + 1:cardinality(tables)]
  else tables end from base;
$$;


--
-- Name: system_reset_tables_before_order_sms(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.system_reset_tables_before_order_sms(p_scope text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
declare tables text[]:=public.system_reset_tables_before_sms(p_scope); pos integer;
begin
  if p_scope='full' then
    pos:=array_position(tables,'product_features');
    tables:=tables[1:pos-1]||array['sms_attempts','sms_messages','sms_batches','sms_templates','sms_provider_settings']||tables[pos:cardinality(tables)];
  end if;
  return tables;
end $$;


--
-- Name: system_reset_tables_before_paymob(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.system_reset_tables_before_paymob(p_scope text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
declare tables text[]:=public.system_reset_tables_before_erp_ownership(p_scope); pos integer;
begin
  if p_scope='full' then
    pos:=array_position(tables,'erp_provider_settings');
    tables:=tables[1:pos]||array['erp_sync_runs','erp_worker_leases','erp_remote_writes']||tables[pos+1:cardinality(tables)];
  end if;
  if p_scope in ('orders','commerce','full') then
    pos:=array_position(tables,'shipping_webhook_events');
    tables:=tables[1:pos-1]||array['erp_stock_reservations']||tables[pos:cardinality(tables)];
  end if;
  if p_scope in ('products','commerce','full') then
    pos:=array_position(tables,'commerce_serialized_unit_movements');
    tables:=tables[1:pos-1]||array['erp_inventory_cache']||tables[pos:cardinality(tables)];
  end if;
  return tables;
end;
$$;


--
-- Name: system_reset_tables_before_preorders(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.system_reset_tables_before_preorders(p_scope text) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select case when p_scope in ('products', 'full') then
    public.system_reset_tables_before_specifications(p_scope) ||
      array['product_features', 'category_specification_templates', 'specification_definitions']::text[]
  else public.system_reset_tables_before_specifications(p_scope) end;
$$;


--
-- Name: system_reset_tables_before_sms(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.system_reset_tables_before_sms(p_scope text) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  with base as (select public.system_reset_tables_before_paymob(p_scope) as tables),
    ordered as (select tables, array_position(tables,'erp_stock_reservations') as pos from base)
  select case when p_scope in ('orders','commerce','full') then
    tables[1:pos-1] || array['payment_transactions','payment_attempts']::text[] || tables[pos:cardinality(tables)]
    else tables end from ordered;
$$;


--
-- Name: system_reset_tables_before_specifications(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.system_reset_tables_before_specifications(p_scope text) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select case p_scope when 'full' then array[
    'chat_attachments', 'chat_read_state', 'chat_events', 'chat_messages',
    'chat_agent_availability', 'chat_rate_limits', 'chat_conversations', 'chat_settings'
  ]::text[] || public.system_reset_tables_before_chat(p_scope)
  else public.system_reset_tables_before_chat(p_scope) end;
$$;


--
-- Name: system_reset_tables_before_support(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.system_reset_tables_before_support(p_scope text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
begin
  case p_scope
    when 'products' then return array['commerce_serialized_unit_movements', 'commerce_serialized_units', 'commerce_serialized_inventory_batches', 'commerce_inventory_movements', 'commerce_warehouse_transfer_items', 'commerce_warehouse_transfers', 'commerce_warehouse_inventory', 'product_reviews', 'product_specifications', 'product_images', 'product_variants', 'products', 'brands', 'categories']::text[];
    when 'orders' then return array['shipping_webhook_events', 'shipping_order_jobs', 'customer_order_messages', 'order_packing_scans', 'order_packing_videos', 'order_packing_sessions', 'order_packing_work_sessions', 'commerce_order_return_items', 'commerce_order_returns', 'customer_order_items', 'customer_orders']::text[];
    when 'commerce' then return array['shipping_webhook_events', 'shipping_order_jobs', 'customer_order_messages', 'order_packing_scans', 'order_packing_videos', 'order_packing_sessions', 'order_packing_work_sessions', 'commerce_order_return_items', 'commerce_order_returns', 'customer_order_items', 'customer_orders', 'commerce_serialized_unit_movements', 'commerce_serialized_units', 'commerce_serialized_inventory_batches', 'commerce_inventory_movements', 'commerce_warehouse_transfer_items', 'commerce_warehouse_transfers', 'commerce_warehouse_inventory', 'treasury_transactions', 'commerce_sales_items', 'commerce_sales_orders', 'commerce_procurement_items', 'commerce_procurement_orders']::text[];
    when 'documents' then return array['document_file_tags', 'document_folder_tags', 'document_tags', 'document_quick_access', 'document_recent_items', 'document_folder_permissions', 'documents', 'document_folders']::text[];
    when 'media' then return array[]::text[];
    when 'content' then return array['site_pages', 'site_hero_banners', 'site_top_bar_messages', 'site_offer_cards', 'site_links', 'site_settings']::text[];
    when 'analytics' then return array['store_analytics_events', 'store_analytics_sessions', 'nps_responses']::text[];
    when 'full' then return array['erp_sync_jobs', 'erp_entity_links', 'erp_provider_settings', 'shipping_webhook_events', 'shipping_order_jobs', 'customer_order_messages', 'order_packing_scans', 'order_packing_videos', 'order_packing_sessions', 'order_packing_work_sessions', 'commerce_order_return_items', 'commerce_order_returns', 'customer_order_items', 'customer_orders', 'commerce_serialized_unit_movements', 'commerce_serialized_units', 'commerce_serialized_inventory_batches', 'commerce_inventory_movements', 'commerce_warehouse_transfer_items', 'commerce_warehouse_transfers', 'commerce_warehouse_inventory', 'treasury_transactions', 'commerce_sales_items', 'commerce_sales_orders', 'commerce_procurement_items', 'commerce_procurement_orders', 'product_reviews', 'product_specifications', 'product_images', 'product_variants', 'products', 'brands', 'categories', 'document_file_tags', 'document_folder_tags', 'document_tags', 'document_quick_access', 'document_recent_items', 'document_folder_permissions', 'documents', 'document_folders', 'site_pages', 'site_hero_banners', 'site_top_bar_messages', 'site_offer_cards', 'site_links', 'site_settings', 'store_analytics_events', 'store_analytics_sessions', 'nps_responses', 'commerce_crm_activities', 'commerce_crm_accounts', 'commerce_shipping_companies', 'commerce_warehouses', 'hr_employees', 'site_coupons', 'customer_profiles', 'shipping_city_mappings', 'shipping_status_mappings', 'shipping_provider_settings', 'store_analytics_internal_carts', 'store_analytics_internal_users', 'admin_activity_logs']::text[];
    else raise exception 'Unsupported reset option.' using errcode = '22023';
  end case;
end;
$$;


--
-- Name: treasury_get_outstanding_customer_invoices(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.treasury_get_outstanding_customer_invoices() RETURNS TABLE(id uuid, invoice_number text, account_name text, total_amount numeric, paid_amount numeric, due_amount numeric, created_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.has_admin_permission ('treasury.view') then
    raise exception 'Not authorized';
  end if;

  return query
  select
    sale.id,
    sale.order_number,
    customer.name,
    sale.total_amount,
    sale.paid_amount,
    sale.total_amount - sale.paid_amount,
    sale.created_at
  from public.commerce_sales_orders as sale
  join public.commerce_crm_accounts as customer
    on customer.id = sale.customer_id
  where sale.paid_amount < sale.total_amount
  order by sale.created_at desc;
end;
$$;


--
-- Name: treasury_get_outstanding_supplier_invoices(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.treasury_get_outstanding_supplier_invoices() RETURNS TABLE(id uuid, invoice_number text, account_name text, total_amount numeric, paid_amount numeric, due_amount numeric, created_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.has_admin_permission ('treasury.view') then
    raise exception 'Not authorized';
  end if;

  return query
  select
    procurement.id,
    procurement.invoice_number,
    supplier.name,
    procurement.total_cost,
    procurement.paid_amount,
    procurement.total_cost - procurement.paid_amount,
    procurement.created_at
  from public.commerce_procurement_orders as procurement
  join public.commerce_crm_accounts as supplier
    on supplier.id = procurement.supplier_id
  where procurement.paid_amount < procurement.total_cost
  order by procurement.created_at desc;
end;
$$;


--
-- Name: treasury_record_customer_receipt(uuid, numeric, date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.treasury_record_customer_receipt(p_sales_order_id uuid, p_amount numeric, p_paid_at date, p_reference_number text, p_notes text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_transaction_id uuid;
  v_total numeric (12, 2);
  v_paid numeric (12, 2);
  v_amount numeric (12, 2);
  v_customer_name text;
begin
  perform public.assert_built_in_erp();
  if not public.has_admin_permission ('treasury.edit') then
    raise exception 'Not authorized';
  end if;

  v_amount := round(coalesce(p_amount, 0), 2);

  if v_amount <= 0 then
    raise exception 'Receipt amount must be greater than zero.';
  end if;

  select sale.total_amount, sale.paid_amount, customer.name
  into v_total, v_paid, v_customer_name
  from public.commerce_sales_orders as sale
  join public.commerce_crm_accounts as customer
    on customer.id = sale.customer_id
  where sale.id = p_sales_order_id
  for update of sale;

  if not found then
    raise exception 'Sales invoice not found.';
  end if;

  if v_amount > (v_total - v_paid) then
    raise exception 'Receipt exceeds the outstanding customer balance.';
  end if;

  update public.commerce_sales_orders
  set
    paid_amount = paid_amount + v_amount,
    updated_at = now()
  where id = p_sales_order_id;

  insert into public.treasury_transactions (
    transaction_type,
    amount,
    party_name,
    sales_order_id,
    reference_number,
    notes,
    paid_at,
    created_by
  )
  values (
    'customer_receipt',
    v_amount,
    v_customer_name,
    p_sales_order_id,
    nullif(trim(p_reference_number), ''),
    nullif(trim(p_notes), ''),
    coalesce(p_paid_at, current_date),
    auth.uid ()
  )
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;


--
-- Name: treasury_record_salary_payment(uuid, numeric, date, date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.treasury_record_salary_payment(p_employee_id uuid, p_amount numeric, p_salary_period date, p_paid_at date, p_reference_number text, p_notes text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_transaction_id uuid;
  v_amount numeric (12, 2);
  v_employee_name text;
  v_salary_period date;
begin
  perform public.assert_built_in_erp();
  if not public.has_admin_permission ('treasury.edit') then
    raise exception 'Not authorized';
  end if;

  v_amount := round(coalesce(p_amount, 0), 2);

  if v_amount <= 0 then
    raise exception 'Salary amount must be greater than zero.';
  end if;

  if p_salary_period is null then
    raise exception 'Salary period is required.';
  end if;

  select trim(concat(first_name, ' ', coalesce(last_name, '')))
  into v_employee_name
  from public.hr_employees
  where id = p_employee_id;

  if not found then
    raise exception 'Employee not found.';
  end if;

  v_salary_period := date_trunc('month', p_salary_period)::date;

  insert into public.treasury_transactions (
    transaction_type,
    amount,
    party_name,
    employee_id,
    salary_period,
    reference_number,
    notes,
    paid_at,
    created_by
  )
  values (
    'salary_payment',
    v_amount,
    v_employee_name,
    p_employee_id,
    v_salary_period,
    nullif(trim(p_reference_number), ''),
    nullif(trim(p_notes), ''),
    coalesce(p_paid_at, current_date),
    auth.uid ()
  )
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;


--
-- Name: treasury_record_supplier_payment(uuid, numeric, date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.treasury_record_supplier_payment(p_procurement_order_id uuid, p_amount numeric, p_paid_at date, p_reference_number text, p_notes text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_transaction_id uuid;
  v_total numeric (12, 2);
  v_paid numeric (12, 2);
  v_amount numeric (12, 2);
  v_supplier_name text;
begin
  perform public.assert_built_in_erp();
  if not public.has_admin_permission ('treasury.edit') then
    raise exception 'Not authorized';
  end if;

  v_amount := round(coalesce(p_amount, 0), 2);

  if v_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;

  select procurement.total_cost, procurement.paid_amount, supplier.name
  into v_total, v_paid, v_supplier_name
  from public.commerce_procurement_orders as procurement
  join public.commerce_crm_accounts as supplier
    on supplier.id = procurement.supplier_id
  where procurement.id = p_procurement_order_id
  for update of procurement;

  if not found then
    raise exception 'Procurement invoice not found.';
  end if;

  if v_amount > (v_total - v_paid) then
    raise exception 'Payment exceeds the outstanding supplier balance.';
  end if;

  update public.commerce_procurement_orders
  set
    paid_amount = paid_amount + v_amount,
    updated_at = now()
  where id = p_procurement_order_id;

  insert into public.treasury_transactions (
    transaction_type,
    amount,
    party_name,
    procurement_order_id,
    reference_number,
    notes,
    paid_at,
    created_by
  )
  values (
    'supplier_payment',
    v_amount,
    v_supplier_name,
    p_procurement_order_id,
    nullif(trim(p_reference_number), ''),
    nullif(trim(p_notes), ''),
    coalesce(p_paid_at, current_date),
    auth.uid ()
  )
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;


--
-- Name: validate_customer_order_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_customer_order_message() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_order_user_id uuid;
  v_session_order_id uuid;
  v_parent public.customer_order_messages%rowtype;
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
      or new.user_id is distinct from old.user_id
      or new.order_id is distinct from old.order_id
      or new.packing_session_id is distinct from old.packing_session_id
      or new.sender_type is distinct from old.sender_type
      or new.message_kind is distinct from old.message_kind
      or new.reply_to_message_id is distinct from old.reply_to_message_id
      or new.sender_name is distinct from old.sender_name
      or new.subject is distinct from old.subject
      or new.body is distinct from old.body
      or new.created_at is distinct from old.created_at
      or (
        new.sender_admin_user_id is distinct from old.sender_admin_user_id
        and not (
          old.sender_admin_user_id is not null
          and new.sender_admin_user_id is null
        )
      )
      or (
        new.sender_customer_user_id is distinct from old.sender_customer_user_id
        and not (
          old.sender_customer_user_id is not null
          and new.sender_customer_user_id is null
        )
      )
    then
      raise exception 'Order message sender, conversation, and content are immutable.';
    end if;
  end if;

  if new.order_id is not null then
    select orders.user_id
    into v_order_user_id
    from public.customer_orders as orders
    where orders.id = new.order_id;

    if not found or v_order_user_id is distinct from new.user_id then
      raise exception 'The message recipient does not own the selected order.';
    end if;
  end if;

  if new.packing_session_id is not null then
    select sessions.order_id
    into v_session_order_id
    from public.order_packing_sessions as sessions
    where sessions.id = new.packing_session_id;

    if not found
      or new.order_id is null
      or v_session_order_id is distinct from new.order_id
    then
      raise exception 'The message packing session does not match its order.';
    end if;
  end if;

  if new.reply_to_message_id is not null then
    select messages.*
    into v_parent
    from public.customer_order_messages as messages
    where messages.id = new.reply_to_message_id;

    if not found
      or v_parent.user_id is distinct from new.user_id
      or v_parent.order_id is distinct from new.order_id
      or v_parent.sender_type <> 'admin'
      or v_parent.message_kind <> 'packing_problem'
      or v_parent.reply_to_message_id is not null
    then
      raise exception 'Customer replies must target the matching order problem message.';
    end if;
  end if;

  if new.sender_type = 'admin' then
    if tg_op = 'INSERT' and new.sender_admin_user_id is null then
      raise exception 'An admin sender is required for this order message.';
    end if;

    if new.sender_customer_user_id is not null
      or new.message_kind not in ('order_update', 'packing_problem')
      or new.reply_to_message_id is not null
    then
      raise exception 'The admin order message sender is not valid.';
    end if;
  elsif new.sender_type = 'customer' then
    if new.sender_admin_user_id is not null
      or new.sender_customer_user_id is distinct from new.user_id
      or new.message_kind <> 'customer_reply'
      or new.reply_to_message_id is null
      or new.packing_session_id is not null
    then
      raise exception 'The customer order reply sender is not valid.';
    end if;

    new.read_at := coalesce(new.read_at, clock_timestamp());
  else
    raise exception 'The order message sender type is not valid.';
  end if;

  if new.message_kind = 'packing_problem'
    and new.packing_session_id is null
  then
    raise exception 'A packing problem must identify its packing session.';
  end if;

  new.sender_name := btrim(new.sender_name);
  new.subject := btrim(new.subject);
  new.body := btrim(new.body);
  return new;
end;
$$;


--
-- Name: validate_order_packing_scan(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_order_packing_scan() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_session public.order_packing_sessions%rowtype;
  v_order_item public.customer_order_items%rowtype;
  v_serialized_unit public.commerce_serialized_units%rowtype;
  v_existing_scan_count integer;
  v_item_has_serialized_units boolean;
  v_item_is_serialized boolean;
begin
  select sessions.*
  into v_session
  from public.order_packing_sessions as sessions
  where sessions.id = new.session_id
  for update;

  if not found then
    raise exception 'Packing session not found.';
  end if;

  if v_session.status <> 'active' then
    raise exception 'This packing session is no longer active.';
  end if;

  if new.scanned_by is null
    or v_session.admin_user_id is distinct from new.scanned_by
  then
    raise exception 'Only the admin who claimed this order can scan its items.';
  end if;

  select order_items.*
  into v_order_item
  from public.customer_order_items as order_items
  where order_items.id = new.order_item_id
    and order_items.order_id = v_session.order_id;

  if not found then
    raise exception 'The scanned item does not belong to this order.';
  end if;

  select exists (
    select 1
    from public.commerce_serialized_units as serialized_units
    where serialized_units.customer_order_item_id = v_order_item.id
      and serialized_units.customer_order_id = v_session.order_id
  )
  into v_item_has_serialized_units;

  select (
    v_order_item.variant_id is not null
    or coalesce(products.is_serialized, false)
    or v_item_has_serialized_units
  )
  into v_item_is_serialized
  from (select 1) as singleton
  left join public.products as products
    on products.id = v_order_item.product_id;

  if new.serialized_unit_id is not null then
    select serialized_units.*
    into v_serialized_unit
    from public.commerce_serialized_units as serialized_units
    where serialized_units.id = new.serialized_unit_id
    for share;

    if not found
      or v_serialized_unit.customer_order_id is distinct from v_session.order_id
      or v_serialized_unit.customer_order_item_id is distinct from v_order_item.id
    then
      raise exception 'This serialized unit is not assigned to the selected order item.';
    end if;

    if v_serialized_unit.status <> 'sold' then
      raise exception 'This serialized unit is not available for packing.';
    end if;

    if lower(btrim(new.scanned_code)) not in (
      lower(v_serialized_unit.id::text),
      lower(v_serialized_unit.qr_token::text),
      lower(btrim(v_serialized_unit.unit_code)),
      lower(btrim(coalesce(v_serialized_unit.serial_number, '')))
    ) then
      raise exception 'The scanned code does not match this serialized unit.';
    end if;

    new.scan_type := 'serialized';
  elsif v_item_is_serialized then
    raise exception 'Scan the exact assigned unit code or QR for this item.';
  else
    if lower(btrim(new.scanned_code)) not in (
      lower(btrim(coalesce(v_order_item.product_sku, ''))),
      lower(btrim(coalesce(v_order_item.variant_sku, ''))),
      lower(btrim(coalesce(v_order_item.variant_code, '')))
    ) then
      raise exception 'The scanned SKU or code does not match this order item.';
    end if;

    new.scan_type := 'sku';
  end if;

  select count(*)::integer
  into v_existing_scan_count
  from public.order_packing_scans as scans
  where scans.session_id = new.session_id
    and scans.order_item_id = new.order_item_id
    and (tg_op = 'INSERT' or scans.id <> new.id);

  if v_existing_scan_count >= v_order_item.quantity then
    raise exception 'The requested quantity for this item is already complete.';
  end if;

  new.scanned_code := btrim(new.scanned_code);
  return new;
end;
$$;


--
-- Name: validate_order_packing_session_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_order_packing_session_insert() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_admin public.admin_users%rowtype;
begin
  if new.admin_user_id is null then
    raise exception 'An active order-processing admin is required.';
  end if;

  select admins.*
  into v_admin
  from public.admin_users as admins
  where admins.id = new.admin_user_id;

  if not found
    or not coalesce(v_admin.is_active, false)
    or (
      v_admin.role <> 'owner'
      and not coalesce(
        (v_admin.permissions ->> 'dashboard.orders')::boolean,
        false
      )
    )
  then
    raise exception 'This admin cannot process orders.';
  end if;

  if new.status <> 'active' then
    raise exception 'A new packing session must start as active.';
  end if;

  new.processor_name := coalesce(
    nullif(btrim(v_admin.full_name), ''),
    nullif(btrim(v_admin.email), ''),
    'Admin'
  );
  new.processor_email := nullif(lower(btrim(v_admin.email)), '');
  new.started_at := coalesce(new.started_at, now());
  new.completed_at := null;
  new.completed_order_status := null;
  new.created_at := coalesce(new.created_at, now());
  new.updated_at := coalesce(new.updated_at, now());
  return new;
end;
$$;


--
-- Name: validate_order_packing_work_session(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_order_packing_work_session() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
      or new.admin_user_id is distinct from old.admin_user_id
      or new.operator_name is distinct from old.operator_name
      or new.operator_email is distinct from old.operator_email
      or new.started_at is distinct from old.started_at
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Packing work session identity is immutable.';
    end if;

    if old.status = 'closed' then
      raise exception 'A closed packing work session cannot be changed.';
    end if;

    if old.status = 'active' and new.status not in ('active', 'closed') then
      raise exception 'The packing work session status is not valid.';
    end if;

    if new.status = 'closed' and exists (
      select 1
      from public.order_packing_sessions as packing
      where packing.admin_user_id = old.admin_user_id
        and packing.status = 'active'
    ) then
      raise exception 'Release or complete the active order before closing this session.';
    end if;
  end if;

  return new;
end;
$$;


--
-- Name: admin_activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_user_id uuid,
    author_name text NOT NULL,
    author_email text NOT NULL,
    author_role text DEFAULT 'admin'::text NOT NULL,
    action_key text,
    description text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT admin_activity_logs_author_role_check CHECK ((author_role = ANY (ARRAY['owner'::text, 'admin'::text])))
);


--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_users (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    role text DEFAULT 'admin'::text NOT NULL,
    permissions jsonb DEFAULT public.default_admin_permissions() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT admin_users_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text])))
);


--
-- Name: after_sales_claim_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.after_sales_claim_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    claim_id uuid NOT NULL,
    event_type text NOT NULL,
    actor_id uuid NOT NULL,
    actor_kind text NOT NULL,
    customer_visible boolean DEFAULT true NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    status text NOT NULL,
    resolution text,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT after_sales_claim_events_actor_kind_check CHECK ((actor_kind = ANY (ARRAY['customer'::text, 'staff'::text, 'provider'::text, 'worker'::text]))),
    CONSTRAINT after_sales_claim_events_body_check CHECK ((char_length(body) <= 4000)),
    CONSTRAINT after_sales_claim_events_event_type_check CHECK ((event_type = ANY (ARRAY['submitted'::text, 'review'::text, 'request_information'::text, 'customer_response'::text, 'approve'::text, 'reject'::text, 'receive'::text, 'inspect'::text, 'select_resolution'::text, 'resolve'::text, 'cancel'::text, 'note'::text, 'verify_serial'::text, 'evidence_added'::text, 'reverse_queued'::text, 'reverse_created'::text, 'reverse_failed'::text, 'reverse_uncertain'::text, 'reverse_tracking'::text, 'reverse_received'::text, 'reverse_label'::text, 'reverse_label_failed'::text])))
);


--
-- Name: after_sales_claim_evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.after_sales_claim_evidence (
    id uuid NOT NULL,
    customer_id uuid NOT NULL,
    item_id uuid NOT NULL,
    claim_type text NOT NULL,
    target_claim_id uuid,
    request_id uuid,
    claim_id uuid,
    original_name text NOT NULL,
    storage_path text NOT NULL,
    mime_type text NOT NULL,
    size_bytes integer NOT NULL,
    content_sha256 text NOT NULL,
    is_ready boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    removed_at timestamp with time zone,
    CONSTRAINT after_sales_claim_evidence_check CHECK (((claim_id IS NULL) OR (is_ready AND (removed_at IS NULL)))),
    CONSTRAINT after_sales_claim_evidence_check1 CHECK ((((target_claim_id IS NULL) AND (request_id IS NULL)) OR ((target_claim_id IS NOT NULL) AND (request_id IS NOT NULL)))),
    CONSTRAINT after_sales_claim_evidence_claim_type_check CHECK ((claim_type = ANY (ARRAY['return'::text, 'warranty'::text]))),
    CONSTRAINT after_sales_claim_evidence_content_sha256_check CHECK ((content_sha256 ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT after_sales_claim_evidence_mime_type_check CHECK ((mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text, 'application/pdf'::text]))),
    CONSTRAINT after_sales_claim_evidence_original_name_check CHECK (((char_length(original_name) >= 1) AND (char_length(original_name) <= 180))),
    CONSTRAINT after_sales_claim_evidence_size_bytes_check CHECK (((size_bytes >= 1) AND (size_bytes <= 5242880)))
);


--
-- Name: after_sales_claim_information; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.after_sales_claim_information (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    claim_id uuid NOT NULL,
    requested_by uuid NOT NULL,
    prompt text NOT NULL,
    require_evidence boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    response text,
    response_at timestamp with time zone,
    CONSTRAINT after_sales_claim_information_prompt_check CHECK (((char_length(btrim(prompt)) >= 1) AND (char_length(btrim(prompt)) <= 4000))),
    CONSTRAINT after_sales_claim_information_response_check CHECK (((char_length(btrim(response)) >= 1) AND (char_length(btrim(response)) <= 4000)))
);


--
-- Name: after_sales_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.after_sales_claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reference text NOT NULL,
    customer_id uuid NOT NULL,
    order_id uuid NOT NULL,
    item_id uuid NOT NULL,
    policy_version_id uuid NOT NULL,
    claim_type text NOT NULL,
    quantity integer NOT NULL,
    description text NOT NULL,
    reason_key text,
    declarations jsonb DEFAULT '{}'::jsonb NOT NULL,
    customer_serials text[] DEFAULT '{}'::text[] NOT NULL,
    serial_verification text DEFAULT 'not_provided'::text NOT NULL,
    serial_verified_by uuid,
    serial_verified_at timestamp with time zone,
    serial_verification_reason text,
    locale text NOT NULL,
    submission_key uuid NOT NULL,
    submission jsonb NOT NULL,
    eligibility_snapshot jsonb NOT NULL,
    admission text NOT NULL,
    status text DEFAULT 'submitted'::text NOT NULL,
    resolution text,
    decision_text text,
    resolution_text text,
    revision integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    updated_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT after_sales_claims_admission_check CHECK ((admission = ANY (ARRAY['eligible'::text, 'manual_review'::text, 'serial_review'::text]))),
    CONSTRAINT after_sales_claims_check CHECK ((cardinality(customer_serials) <= quantity)),
    CONSTRAINT after_sales_claims_check1 CHECK ((((claim_type = 'return'::text) AND (reason_key IS NOT NULL) AND (cardinality(customer_serials) = 0)) OR ((claim_type = 'warranty'::text) AND (reason_key IS NULL)))),
    CONSTRAINT after_sales_claims_check2 CHECK (((status <> 'resolved'::text) OR ((resolution IS NOT NULL) AND (NULLIF(btrim(resolution_text), ''::text) IS NOT NULL)))),
    CONSTRAINT after_sales_claims_claim_type_check CHECK ((claim_type = ANY (ARRAY['return'::text, 'warranty'::text]))),
    CONSTRAINT after_sales_claims_decision_text_check CHECK ((char_length(decision_text) <= 4000)),
    CONSTRAINT after_sales_claims_declarations_check CHECK ((jsonb_typeof(declarations) = 'object'::text)),
    CONSTRAINT after_sales_claims_description_check CHECK (((char_length(btrim(description)) >= 1) AND (char_length(btrim(description)) <= 4000))),
    CONSTRAINT after_sales_claims_eligibility_snapshot_check CHECK ((jsonb_typeof(eligibility_snapshot) = 'object'::text)),
    CONSTRAINT after_sales_claims_locale_check CHECK ((locale = ANY (ARRAY['en'::text, 'ar'::text]))),
    CONSTRAINT after_sales_claims_quantity_check CHECK (((quantity >= 1) AND (quantity <= 99))),
    CONSTRAINT after_sales_claims_reference_check CHECK ((reference ~ '^AS-[RW]-[A-F0-9]{16}$'::text)),
    CONSTRAINT after_sales_claims_resolution_check CHECK ((resolution = ANY (ARRAY['repair'::text, 'replacement'::text, 'refund'::text, 'service_center'::text]))),
    CONSTRAINT after_sales_claims_resolution_text_check CHECK ((char_length(resolution_text) <= 4000)),
    CONSTRAINT after_sales_claims_revision_check CHECK ((revision > 0)),
    CONSTRAINT after_sales_claims_serial_verification_check CHECK ((serial_verification = ANY (ARRAY['not_provided'::text, 'unverified'::text, 'verified'::text, 'authoritative'::text]))),
    CONSTRAINT after_sales_claims_status_check CHECK ((status = ANY (ARRAY['submitted'::text, 'under_review'::text, 'more_information_required'::text, 'approved'::text, 'rejected'::text, 'pickup_scheduled'::text, 'in_transit'::text, 'received'::text, 'under_inspection'::text, 'resolution_in_progress'::text, 'resolved'::text, 'cancelled'::text]))),
    CONSTRAINT after_sales_claims_submission_check CHECK ((jsonb_typeof(submission) = 'object'::text))
);


--
-- Name: after_sales_communication_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.after_sales_communication_settings (
    purpose text NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    sms_enabled boolean DEFAULT false NOT NULL,
    email_enabled boolean DEFAULT false NOT NULL,
    sms_template_en uuid,
    sms_template_ar uuid,
    email_template_en text,
    email_template_ar text,
    sms_sender text DEFAULT ''::text NOT NULL,
    email_sender text DEFAULT ''::text NOT NULL,
    approvals jsonb DEFAULT '{}'::jsonb NOT NULL,
    revision integer DEFAULT 0 NOT NULL,
    capture_started_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    updated_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    updated_by uuid,
    CONSTRAINT after_sales_communication_settings_purpose_check CHECK ((purpose = ANY (ARRAY['more_information'::text, 'approved'::text, 'rejected'::text, 'pickup_scheduled'::text, 'received'::text, 'resolution_decided'::text, 'resolved'::text]))),
    CONSTRAINT after_sales_communication_settings_revision_check CHECK ((revision >= 0))
);


--
-- Name: after_sales_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.after_sales_policies (
    scope_key text NOT NULL,
    category_id uuid,
    product_id uuid,
    revision integer DEFAULT 0 NOT NULL,
    warranty_configured boolean,
    return_configured boolean,
    warranty_enabled boolean,
    warranty_start_basis text,
    warranty_fallback_bases text[],
    warranty_resolutions text[],
    warranty_evidence text,
    warranty_serial text,
    warranty_shipping text,
    return_enabled boolean,
    return_window_days integer,
    return_start_basis text,
    return_fallback_bases text[],
    return_opened text,
    return_packaging text,
    return_evidence text,
    return_shipping text,
    policy_timezone text,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT after_sales_global_complete CHECK (((scope_key <> 'global'::text) OR ((warranty_configured IS NOT NULL) AND (return_configured IS NOT NULL) AND (warranty_enabled IS NOT NULL) AND (warranty_start_basis IS NOT NULL) AND (warranty_fallback_bases IS NOT NULL) AND (warranty_resolutions IS NOT NULL) AND (warranty_evidence IS NOT NULL) AND (warranty_serial IS NOT NULL) AND (warranty_shipping IS NOT NULL) AND (return_enabled IS NOT NULL) AND (return_window_days IS NOT NULL) AND (return_start_basis IS NOT NULL) AND (return_fallback_bases IS NOT NULL) AND (return_opened IS NOT NULL) AND (return_packaging IS NOT NULL) AND (return_evidence IS NOT NULL) AND (return_shipping IS NOT NULL) AND (policy_timezone IS NOT NULL)))),
    CONSTRAINT after_sales_policies_return_evidence_check CHECK ((return_evidence = ANY (ARRAY['disabled'::text, 'optional'::text, 'required'::text]))),
    CONSTRAINT after_sales_policies_return_fallback_bases_check CHECK (public.after_sales_valid_list(return_fallback_bases, ARRAY['delivery_date'::text, 'invoice_date'::text, 'payment_date'::text, 'order_date'::text])),
    CONSTRAINT after_sales_policies_return_opened_check CHECK ((return_opened = ANY (ARRAY['allowed'::text, 'not_allowed'::text, 'reason'::text, 'manual'::text]))),
    CONSTRAINT after_sales_policies_return_packaging_check CHECK ((return_packaging = ANY (ARRAY['not_required'::text, 'preferred'::text, 'required'::text]))),
    CONSTRAINT after_sales_policies_return_shipping_check CHECK ((return_shipping = ANY (ARRAY['elcomputer'::text, 'customer'::text, 'reason'::text, 'manual'::text]))),
    CONSTRAINT after_sales_policies_return_start_basis_check CHECK ((return_start_basis = ANY (ARRAY['delivery_date'::text, 'invoice_date'::text, 'payment_date'::text, 'order_date'::text]))),
    CONSTRAINT after_sales_policies_return_window_days_check CHECK (((return_window_days >= 1) AND (return_window_days <= 365))),
    CONSTRAINT after_sales_policies_revision_check CHECK ((revision >= 0)),
    CONSTRAINT after_sales_policies_warranty_evidence_check CHECK ((warranty_evidence = ANY (ARRAY['disabled'::text, 'optional'::text, 'required'::text]))),
    CONSTRAINT after_sales_policies_warranty_fallback_bases_check CHECK (public.after_sales_valid_list(warranty_fallback_bases, ARRAY['delivery_date'::text, 'invoice_date'::text, 'payment_date'::text, 'order_date'::text])),
    CONSTRAINT after_sales_policies_warranty_resolutions_check CHECK (public.after_sales_valid_list(warranty_resolutions, ARRAY['repair'::text, 'replacement'::text, 'refund'::text, 'service_center'::text])),
    CONSTRAINT after_sales_policies_warranty_serial_check CHECK ((warranty_serial = ANY (ARRAY['disabled'::text, 'optional'::text, 'required'::text]))),
    CONSTRAINT after_sales_policies_warranty_shipping_check CHECK ((warranty_shipping = ANY (ARRAY['elcomputer'::text, 'customer'::text, 'reason'::text, 'manual'::text]))),
    CONSTRAINT after_sales_policies_warranty_start_basis_check CHECK ((warranty_start_basis = ANY (ARRAY['delivery_date'::text, 'invoice_date'::text, 'payment_date'::text, 'order_date'::text]))),
    CONSTRAINT after_sales_scope_check CHECK ((((scope_key = 'global'::text) AND (category_id IS NULL) AND (product_id IS NULL)) OR ((category_id IS NOT NULL) AND (product_id IS NULL) AND (scope_key = ('category:'::text || (category_id)::text))) OR ((product_id IS NOT NULL) AND (category_id IS NULL) AND (scope_key = ('product:'::text || (product_id)::text))))),
    CONSTRAINT after_sales_scoped_configuration CHECK (((scope_key = 'global'::text) OR ((warranty_configured IS NULL) AND (return_configured IS NULL))))
);


--
-- Name: after_sales_policy_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.after_sales_policy_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    version_key text NOT NULL,
    policy jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT after_sales_policy_versions_policy_check CHECK ((jsonb_typeof(policy) = 'object'::text))
);


--
-- Name: after_sales_return_reasons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.after_sales_return_reasons (
    key text NOT NULL,
    label_en text NOT NULL,
    label_ar text NOT NULL,
    is_enabled boolean NOT NULL,
    sort_order integer NOT NULL,
    fault text NOT NULL,
    shipping text,
    opened text,
    evidence text,
    revision integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT after_sales_return_reasons_evidence_check CHECK ((evidence = ANY (ARRAY['disabled'::text, 'optional'::text, 'required'::text]))),
    CONSTRAINT after_sales_return_reasons_fault_check CHECK ((fault = ANY (ARRAY['customer'::text, 'seller'::text, 'neutral'::text]))),
    CONSTRAINT after_sales_return_reasons_key_check CHECK ((key ~ '^[a-z][a-z0-9_]{0,63}$'::text)),
    CONSTRAINT after_sales_return_reasons_label_ar_check CHECK (((char_length(btrim(label_ar)) >= 1) AND (char_length(btrim(label_ar)) <= 160))),
    CONSTRAINT after_sales_return_reasons_label_en_check CHECK (((char_length(btrim(label_en)) >= 1) AND (char_length(btrim(label_en)) <= 160))),
    CONSTRAINT after_sales_return_reasons_opened_check CHECK ((opened = ANY (ARRAY['allowed'::text, 'not_allowed'::text, 'manual'::text]))),
    CONSTRAINT after_sales_return_reasons_revision_check CHECK ((revision >= 1)),
    CONSTRAINT after_sales_return_reasons_shipping_check CHECK ((shipping = ANY (ARRAY['elcomputer'::text, 'customer'::text, 'manual'::text]))),
    CONSTRAINT after_sales_return_reasons_sort_order_check CHECK (((sort_order >= 0) AND (sort_order <= 10000)))
);


--
-- Name: brands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    logo_url text,
    created_at timestamp with time zone DEFAULT now(),
    seo_title text,
    seo_description text,
    seo_image_url text,
    brand_page jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT brands_page_document_check CHECK (((jsonb_typeof(brand_page) = 'object'::text) AND (octet_length((brand_page)::text) <= 150000) AND ((NOT (brand_page ? 'rows'::text)) OR
CASE
    WHEN (jsonb_typeof((brand_page -> 'rows'::text)) = 'array'::text) THEN (jsonb_array_length((brand_page -> 'rows'::text)) <= 30)
    ELSE false
END)))
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    image_url text,
    created_at timestamp with time zone DEFAULT now(),
    seo_title text,
    seo_description text,
    seo_image_url text,
    name_ar text
);


--
-- Name: category_specification_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category_specification_templates (
    category_id uuid NOT NULL,
    definition_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    highlight_default boolean DEFAULT false NOT NULL
);


--
-- Name: chat_agent_availability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_agent_availability (
    admin_id uuid NOT NULL,
    declared_state text DEFAULT 'offline'::text NOT NULL,
    lease_expires_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_agent_availability_declared_state_check CHECK ((declared_state = ANY (ARRAY['online'::text, 'away'::text, 'offline'::text]))),
    CONSTRAINT chat_agent_availability_online_check CHECK (((declared_state <> 'online'::text) OR (lease_expires_at IS NOT NULL)))
);


--
-- Name: chat_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    message_id uuid NOT NULL,
    uploaded_by uuid,
    original_name text NOT NULL,
    storage_path text NOT NULL,
    mime_type text NOT NULL,
    size_bytes integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    content_sha256 text,
    is_ready boolean DEFAULT false NOT NULL,
    CONSTRAINT chat_attachments_hash_check CHECK (((content_sha256 IS NULL) OR (content_sha256 ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT chat_attachments_mime_type_check CHECK ((mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text, 'application/pdf'::text]))),
    CONSTRAINT chat_attachments_original_name_check CHECK (((char_length(btrim(original_name)) >= 1) AND (char_length(btrim(original_name)) <= 180))),
    CONSTRAINT chat_attachments_size_bytes_check CHECK (((size_bytes >= 1) AND (size_bytes <= 5242880))),
    CONSTRAINT chat_attachments_storage_path_check CHECK (((char_length(storage_path) >= 1) AND (char_length(storage_path) <= 500)))
);


--
-- Name: chat_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reference_number bigint NOT NULL,
    customer_id uuid,
    guest_auth_user_id uuid,
    contact_name text NOT NULL,
    contact_email text,
    contact_mobile text,
    status text DEFAULT 'waiting'::text NOT NULL,
    intake_mode text DEFAULT 'live'::text NOT NULL,
    assigned_admin_id uuid,
    order_id uuid,
    ticket_id uuid,
    creation_key uuid NOT NULL,
    revision bigint DEFAULT 0 NOT NULL,
    last_customer_message_seq bigint DEFAULT 0 NOT NULL,
    last_staff_message_seq bigint DEFAULT 0 NOT NULL,
    last_activity_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    resolution_resolved boolean,
    satisfaction_rating smallint,
    resolution_feedback_at timestamp with time zone,
    callback_status text,
    callback_mobile text,
    callback_requested_at timestamp with time zone,
    callback_updated_at timestamp with time zone,
    CONSTRAINT chat_conversations_active_check CHECK (((status <> 'active'::text) OR (assigned_admin_id IS NOT NULL))),
    CONSTRAINT chat_conversations_callback_check CHECK ((((callback_status IS NULL) AND (callback_mobile IS NULL) AND (callback_requested_at IS NULL) AND (callback_updated_at IS NULL)) OR ((callback_status IS NOT NULL) AND (callback_mobile IS NOT NULL) AND (callback_requested_at IS NOT NULL) AND (callback_updated_at IS NOT NULL)))),
    CONSTRAINT chat_conversations_callback_mobile_check CHECK (((callback_mobile IS NULL) OR (callback_mobile ~ '^\+?[0-9 ()-]{7,30}$'::text))),
    CONSTRAINT chat_conversations_callback_status_check CHECK (((callback_status IS NULL) OR (callback_status = ANY (ARRAY['pending'::text, 'completed'::text, 'cancelled'::text])))),
    CONSTRAINT chat_conversations_closed_check CHECK (((status = 'closed'::text) = (closed_at IS NOT NULL))),
    CONSTRAINT chat_conversations_contact_check CHECK (((contact_email IS NOT NULL) OR (contact_mobile IS NOT NULL))),
    CONSTRAINT chat_conversations_email_check CHECK (((contact_email IS NULL) OR (((char_length(contact_email) >= 3) AND (char_length(contact_email) <= 320)) AND (contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'::text)))),
    CONSTRAINT chat_conversations_identity_check CHECK (((customer_id IS NULL) OR (guest_auth_user_id IS NULL))),
    CONSTRAINT chat_conversations_intake_mode_check CHECK ((intake_mode = ANY (ARRAY['live'::text, 'offline'::text]))),
    CONSTRAINT chat_conversations_last_customer_message_seq_check CHECK ((last_customer_message_seq >= 0)),
    CONSTRAINT chat_conversations_last_staff_message_seq_check CHECK ((last_staff_message_seq >= 0)),
    CONSTRAINT chat_conversations_mobile_check CHECK (((contact_mobile IS NULL) OR (((char_length(contact_mobile) >= 7) AND (char_length(contact_mobile) <= 30)) AND (contact_mobile ~ '^\+?[0-9 ()-]+$'::text)))),
    CONSTRAINT chat_conversations_name_check CHECK (((char_length(btrim(contact_name)) >= 1) AND (char_length(btrim(contact_name)) <= 160))),
    CONSTRAINT chat_conversations_rating_check CHECK (((satisfaction_rating IS NULL) OR ((satisfaction_rating >= 1) AND (satisfaction_rating <= 5)))),
    CONSTRAINT chat_conversations_resolution_check CHECK ((((resolution_resolved IS NULL) AND (satisfaction_rating IS NULL) AND (resolution_feedback_at IS NULL)) OR ((resolution_resolved IS NOT NULL) AND (satisfaction_rating IS NOT NULL) AND (resolution_feedback_at IS NOT NULL)))),
    CONSTRAINT chat_conversations_revision_check CHECK ((revision >= 0)),
    CONSTRAINT chat_conversations_status_check CHECK ((status = ANY (ARRAY['waiting'::text, 'active'::text, 'closed'::text])))
);


--
-- Name: chat_conversations_reference_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.chat_conversations ALTER COLUMN reference_number ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.chat_conversations_reference_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: chat_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    actor_id uuid,
    actor_kind text NOT NULL,
    event_type text NOT NULL,
    old_value jsonb,
    new_value jsonb,
    related_message_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_name text,
    old_assignee_name text,
    new_assignee_name text,
    CONSTRAINT chat_events_actor_kind_check CHECK ((actor_kind = ANY (ARRAY['customer'::text, 'guest'::text, 'staff'::text, 'system'::text]))),
    CONSTRAINT chat_events_event_type_check CHECK ((event_type = ANY (ARRAY['created'::text, 'identified'::text, 'claimed'::text, 'assigned'::text, 'transferred'::text, 'agent_replied'::text, 'status_changed'::text, 'order_linked'::text, 'order_unlinked'::text, 'ticket_created'::text, 'closed'::text, 'reopened'::text, 'resolution_feedback'::text, 'callback_requested'::text, 'callback_updated'::text])))
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sequence_number bigint NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid,
    sender_kind text NOT NULL,
    sender_name text NOT NULL,
    body text NOT NULL,
    is_internal boolean DEFAULT false NOT NULL,
    idempotency_key uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_messages_body_check CHECK (((char_length(btrim(body)) >= 1) AND (char_length(btrim(body)) <= 10000))),
    CONSTRAINT chat_messages_internal_check CHECK (((NOT is_internal) OR (sender_kind = 'staff'::text))),
    CONSTRAINT chat_messages_sender_kind_check CHECK ((sender_kind = ANY (ARRAY['customer'::text, 'guest'::text, 'staff'::text]))),
    CONSTRAINT chat_messages_sender_name_check CHECK (((char_length(btrim(sender_name)) >= 1) AND (char_length(btrim(sender_name)) <= 160)))
);


--
-- Name: chat_messages_sequence_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.chat_messages ALTER COLUMN sequence_number ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.chat_messages_sequence_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: chat_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_rate_limits (
    scope text NOT NULL,
    subject_hash text NOT NULL,
    window_started_at timestamp with time zone NOT NULL,
    attempts integer DEFAULT 1 NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT chat_rate_limits_attempts_check CHECK ((attempts >= 0)),
    CONSTRAINT chat_rate_limits_expiry_check CHECK ((expires_at > window_started_at)),
    CONSTRAINT chat_rate_limits_scope_check CHECK ((scope = ANY (ARRAY['message'::text, 'conversation'::text, 'duplicate'::text, 'attachment'::text, 'typing'::text, 'network_message'::text, 'network_message_hour'::text, 'network_conversation'::text, 'network_conversation_day'::text, 'network_duplicate'::text, 'network_attachment'::text, 'network_attachment_hour'::text, 'network_typing'::text, 'network_typing_hour'::text]))),
    CONSTRAINT chat_rate_limits_subject_hash_check CHECK ((subject_hash ~ '^[0-9a-f]{64}$'::text))
);


--
-- Name: chat_read_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_read_state (
    conversation_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    actor_kind text NOT NULL,
    last_read_sequence bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_read_state_actor_kind_check CHECK ((actor_kind = ANY (ARRAY['customer'::text, 'guest'::text, 'staff'::text]))),
    CONSTRAINT chat_read_state_last_read_sequence_check CHECK ((last_read_sequence >= 0))
);


--
-- Name: commerce_crm_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_crm_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_type text NOT NULL,
    entity_type text DEFAULT 'company'::text NOT NULL,
    name text NOT NULL,
    code text,
    email text,
    phone text,
    tax_number text,
    address_line_1 text,
    city text,
    country text,
    notes text,
    primary_contact_name text,
    primary_contact_role text,
    primary_contact_email text,
    primary_contact_phone text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT commerce_crm_accounts_account_type_check CHECK ((account_type = ANY (ARRAY['supplier'::text, 'customer'::text]))),
    CONSTRAINT commerce_crm_accounts_entity_type_check CHECK ((entity_type = ANY (ARRAY['company'::text, 'person'::text])))
);


--
-- Name: commerce_crm_activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_crm_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    crm_account_id uuid NOT NULL,
    activity_type text NOT NULL,
    status text NOT NULL,
    subject text NOT NULL,
    notes text,
    priority text,
    occurred_at timestamp with time zone NOT NULL,
    closed_at timestamp with time zone,
    effective_at timestamp with time zone GENERATED ALWAYS AS (COALESCE(closed_at, occurred_at)) STORED,
    resolution text,
    created_by uuid,
    closed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT commerce_crm_activities_lifecycle_check CHECK ((((activity_type = 'call'::text) AND (status = 'completed'::text) AND (priority IS NULL) AND (closed_at IS NULL) AND (closed_by IS NULL) AND (resolution IS NULL)) OR ((activity_type = 'case'::text) AND (priority IS NOT NULL) AND (((status = 'raised'::text) AND (closed_at IS NULL) AND (closed_by IS NULL) AND (resolution IS NULL)) OR ((status = 'closed'::text) AND (closed_at IS NOT NULL) AND (closed_at >= occurred_at)))))),
    CONSTRAINT commerce_crm_activities_notes_check CHECK (((notes IS NULL) OR ((char_length(btrim(notes)) >= 1) AND (char_length(btrim(notes)) <= 5000)))),
    CONSTRAINT commerce_crm_activities_priority_check CHECK (((priority IS NULL) OR (priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])))),
    CONSTRAINT commerce_crm_activities_resolution_check CHECK (((resolution IS NULL) OR ((char_length(btrim(resolution)) >= 1) AND (char_length(btrim(resolution)) <= 5000)))),
    CONSTRAINT commerce_crm_activities_status_check CHECK ((status = ANY (ARRAY['completed'::text, 'raised'::text, 'closed'::text]))),
    CONSTRAINT commerce_crm_activities_subject_check CHECK (((char_length(btrim(subject)) >= 1) AND (char_length(btrim(subject)) <= 200))),
    CONSTRAINT commerce_crm_activities_type_check CHECK ((activity_type = ANY (ARRAY['call'::text, 'case'::text])))
);


--
-- Name: commerce_inventory_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_inventory_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    warehouse_id uuid NOT NULL,
    product_id uuid NOT NULL,
    movement_type text NOT NULL,
    reference_type text,
    reference_id uuid,
    quantity_change integer NOT NULL,
    quantity_after integer NOT NULL,
    unit_cost numeric(12,2),
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT commerce_inventory_movements_movement_type_check CHECK ((movement_type = ANY (ARRAY['procurement'::text, 'sale_out'::text, 'transfer_in'::text, 'transfer_out'::text, 'return_in'::text, 'adjustment'::text]))),
    CONSTRAINT commerce_inventory_movements_reference_type_check CHECK (((reference_type IS NULL) OR (reference_type = ANY (ARRAY['procurement_order'::text, 'sales_order'::text, 'warehouse_transfer'::text, 'order_return'::text, 'manual'::text]))))
);


--
-- Name: commerce_order_return_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_order_return_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_return_id uuid NOT NULL,
    order_item_id uuid,
    product_id uuid,
    quantity integer NOT NULL,
    unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    variant_id uuid,
    serialized_unit_id uuid,
    CONSTRAINT commerce_order_return_items_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT commerce_order_return_items_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: commerce_order_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_order_returns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    reason text,
    notes text,
    total_items integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    erp_provider text DEFAULT 'built_in'::text NOT NULL,
    erp_action_status text DEFAULT 'completed'::text NOT NULL,
    CONSTRAINT commerce_order_returns_erp_action_status_check CHECK ((erp_action_status = ANY (ARRAY['completed'::text, 'manual_required'::text]))),
    CONSTRAINT commerce_order_returns_erp_provider_check CHECK ((erp_provider = ANY (ARRAY['built_in'::text, 'daftra'::text]))),
    CONSTRAINT commerce_order_returns_total_items_check CHECK ((total_items >= 0))
);


--
-- Name: commerce_procurement_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_procurement_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    procurement_order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer NOT NULL,
    unit_cost numeric(12,2) DEFAULT 0 NOT NULL,
    line_total numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    variant_id uuid,
    received_quantity integer DEFAULT 0 NOT NULL,
    CONSTRAINT commerce_procurement_items_line_total_check CHECK ((line_total >= (0)::numeric)),
    CONSTRAINT commerce_procurement_items_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT commerce_procurement_items_received_quantity_check CHECK (((received_quantity >= 0) AND (received_quantity <= quantity))),
    CONSTRAINT commerce_procurement_items_unit_cost_check CHECK ((unit_cost >= (0)::numeric))
);


--
-- Name: commerce_procurement_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_procurement_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    invoice_number text,
    notes text,
    total_cost numeric(12,2) DEFAULT 0 NOT NULL,
    paid_amount numeric(12,2) DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    receipt_key text,
    receipt_payload_hash text,
    CONSTRAINT commerce_procurement_orders_paid_amount_check CHECK (((paid_amount >= (0)::numeric) AND (paid_amount <= total_cost))),
    CONSTRAINT commerce_procurement_orders_total_cost_check CHECK ((total_cost >= (0)::numeric))
);


--
-- Name: commerce_sales_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_sales_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sales_order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    line_total numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT commerce_sales_items_line_total_check CHECK ((line_total >= (0)::numeric)),
    CONSTRAINT commerce_sales_items_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT commerce_sales_items_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: commerce_sales_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_sales_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    order_number text,
    notes text,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    paid_amount numeric(12,2) DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT commerce_sales_orders_paid_amount_check CHECK (((paid_amount >= (0)::numeric) AND (paid_amount <= total_amount))),
    CONSTRAINT commerce_sales_orders_total_amount_check CHECK ((total_amount >= (0)::numeric))
);


--
-- Name: commerce_serialized_inventory_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_serialized_inventory_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    procurement_order_id uuid,
    procurement_item_id uuid,
    created_count integer DEFAULT 0 NOT NULL,
    variant_count integer DEFAULT 0 NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT commerce_serialized_batches_created_count_check CHECK ((created_count >= 0)),
    CONSTRAINT commerce_serialized_batches_variant_count_check CHECK ((variant_count >= 0))
);


--
-- Name: commerce_serialized_unit_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.commerce_serialized_unit_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 50;


--
-- Name: commerce_serialized_unit_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_serialized_unit_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    unit_id uuid NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    procurement_order_id uuid,
    procurement_item_id uuid,
    customer_order_id uuid,
    order_return_id uuid,
    actor_admin_id uuid,
    movement_type text NOT NULL,
    from_status text,
    to_status text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT commerce_serialized_movements_from_status_check CHECK (((from_status IS NULL) OR (from_status = ANY (ARRAY['in_stock'::text, 'sold'::text, 'damaged'::text, 'lost'::text])))),
    CONSTRAINT commerce_serialized_movements_to_status_check CHECK ((to_status = ANY (ARRAY['in_stock'::text, 'sold'::text, 'damaged'::text, 'lost'::text]))),
    CONSTRAINT commerce_serialized_movements_type_check CHECK ((movement_type = ANY (ARRAY['received'::text, 'sold'::text, 'returned'::text, 'damaged'::text, 'lost'::text, 'adjusted'::text])))
);


--
-- Name: commerce_serialized_units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_serialized_units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid,
    unit_code text NOT NULL,
    serial_number text,
    qr_token uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    status text DEFAULT 'in_stock'::text NOT NULL,
    unit_cost numeric(12,2) DEFAULT 0 NOT NULL,
    procurement_order_id uuid,
    procurement_item_id uuid,
    customer_order_id uuid,
    customer_order_item_id uuid,
    customer_user_id uuid,
    sold_at timestamp with time zone,
    returned_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT commerce_serialized_units_sold_link_check CHECK (((status <> 'sold'::text) OR ((customer_order_id IS NOT NULL) AND (customer_order_item_id IS NOT NULL) AND (sold_at IS NOT NULL)))),
    CONSTRAINT commerce_serialized_units_status_check CHECK ((status = ANY (ARRAY['in_stock'::text, 'sold'::text, 'damaged'::text, 'lost'::text]))),
    CONSTRAINT commerce_serialized_units_unit_code_not_blank_check CHECK ((length(btrim(unit_code)) > 0)),
    CONSTRAINT commerce_serialized_units_unit_cost_check CHECK ((unit_cost >= (0)::numeric))
);


--
-- Name: commerce_shipping_companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_shipping_companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    code text,
    shipping_cost numeric(12,2) DEFAULT 0 NOT NULL,
    return_cost numeric(12,2) DEFAULT 0 NOT NULL,
    client_shipping_price numeric(12,2) DEFAULT 0 NOT NULL,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT commerce_shipping_companies_client_shipping_price_check CHECK ((client_shipping_price >= (0)::numeric)),
    CONSTRAINT commerce_shipping_companies_return_cost_check CHECK ((return_cost >= (0)::numeric)),
    CONSTRAINT commerce_shipping_companies_shipping_cost_check CHECK ((shipping_cost >= (0)::numeric))
);


--
-- Name: commerce_warehouse_inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_warehouse_inventory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    warehouse_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    average_cost numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT commerce_warehouse_inventory_average_cost_check CHECK ((average_cost >= (0)::numeric)),
    CONSTRAINT commerce_warehouse_inventory_quantity_check CHECK ((quantity >= 0))
);


--
-- Name: commerce_warehouse_transfer_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_warehouse_transfer_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transfer_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT commerce_warehouse_transfer_items_quantity_check CHECK ((quantity > 0))
);


--
-- Name: commerce_warehouse_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_warehouse_transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_warehouse_id uuid NOT NULL,
    to_warehouse_id uuid NOT NULL,
    reference_number text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT commerce_warehouse_transfers_distinct_warehouses_check CHECK ((from_warehouse_id <> to_warehouse_id))
);


--
-- Name: commerce_warehouses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commerce_warehouses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    code text,
    address_line_1 text,
    city text,
    country text,
    contact_name text,
    contact_phone text,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: customer_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid,
    product_title text NOT NULL,
    product_slug text,
    image_url text,
    unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    line_total numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    variant_id uuid,
    variant_name text,
    variant_code text,
    variant_sku text,
    variant_color_name text,
    variant_color_hex text,
    product_sku text,
    is_preorder boolean DEFAULT false NOT NULL,
    preorder_payment_mode text,
    preorder_deposit_percent numeric(5,2),
    expected_availability_date date,
    availability_message text,
    initial_amount_due numeric(12,2),
    warranty_status text,
    warranty_duration_value integer,
    warranty_duration_unit text,
    warranty_start_basis text,
    warranty_snapshot_at timestamp with time zone,
    after_sales_policy_version_id uuid,
    CONSTRAINT customer_order_items_line_total_check CHECK ((line_total >= (0)::numeric)),
    CONSTRAINT customer_order_items_preorder_snapshot_check CHECK (((NOT is_preorder) OR ((preorder_payment_mode IS NOT NULL) AND (preorder_payment_mode = ANY (ARRAY['full'::text, 'deposit'::text])) AND (initial_amount_due IS NOT NULL) AND (initial_amount_due >= (0)::numeric) AND (initial_amount_due <= line_total) AND ((preorder_payment_mode <> 'deposit'::text) OR ((preorder_deposit_percent IS NOT NULL) AND (preorder_deposit_percent > (0)::numeric) AND (preorder_deposit_percent < (100)::numeric)))))),
    CONSTRAINT customer_order_items_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT customer_order_items_unit_price_check CHECK ((unit_price >= (0)::numeric)),
    CONSTRAINT customer_order_items_warranty_terms_check CHECK ((((warranty_snapshot_at IS NULL) AND (warranty_status IS NULL) AND (warranty_duration_value IS NULL) AND (warranty_duration_unit IS NULL) AND (warranty_start_basis IS NULL)) OR ((warranty_snapshot_at IS NOT NULL) AND (warranty_status IS NOT NULL) AND (((warranty_status = ANY (ARRAY['unknown'::text, 'none'::text])) AND (warranty_duration_value IS NULL) AND (warranty_duration_unit IS NULL) AND (warranty_start_basis IS NULL)) OR ((warranty_status = 'included'::text) AND (warranty_duration_value IS NOT NULL) AND (warranty_duration_unit IS NOT NULL) AND (warranty_start_basis IS NOT NULL) AND (warranty_start_basis = 'unresolved'::text) AND (warranty_duration_value >= 1) AND (((warranty_duration_unit = 'months'::text) AND (warranty_duration_value <= 120)) OR ((warranty_duration_unit = 'years'::text) AND (warranty_duration_value <= 10))))))))
);


--
-- Name: customer_order_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_order_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    order_id uuid,
    packing_session_id uuid,
    sender_admin_user_id uuid,
    sender_name text NOT NULL,
    subject text DEFAULT 'Order update'::text NOT NULL,
    body text NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sender_type text DEFAULT 'admin'::text NOT NULL,
    message_kind text DEFAULT 'order_update'::text NOT NULL,
    sender_customer_user_id uuid,
    reply_to_message_id uuid,
    replied_at timestamp with time zone,
    admin_read_at timestamp with time zone,
    CONSTRAINT customer_order_messages_body_check CHECK (((length(btrim(body)) >= 1) AND (length(btrim(body)) <= 2000))),
    CONSTRAINT customer_order_messages_kind_check CHECK ((message_kind = ANY (ARRAY['order_update'::text, 'packing_problem'::text, 'customer_reply'::text]))),
    CONSTRAINT customer_order_messages_problem_session_check CHECK (((message_kind <> 'packing_problem'::text) OR (packing_session_id IS NOT NULL))),
    CONSTRAINT customer_order_messages_sender_name_check CHECK (((length(btrim(sender_name)) >= 1) AND (length(btrim(sender_name)) <= 160))),
    CONSTRAINT customer_order_messages_sender_shape_check CHECK ((((sender_type = 'admin'::text) AND (message_kind = ANY (ARRAY['order_update'::text, 'packing_problem'::text])) AND (sender_customer_user_id IS NULL) AND (reply_to_message_id IS NULL)) OR ((sender_type = 'customer'::text) AND (message_kind = 'customer_reply'::text) AND (sender_admin_user_id IS NULL) AND (reply_to_message_id IS NOT NULL) AND ((sender_customer_user_id IS NULL) OR (sender_customer_user_id = user_id))))),
    CONSTRAINT customer_order_messages_sender_type_check CHECK ((sender_type = ANY (ARRAY['admin'::text, 'customer'::text]))),
    CONSTRAINT customer_order_messages_subject_check CHECK (((length(btrim(subject)) >= 1) AND (length(btrim(subject)) <= 200)))
);


--
-- Name: customer_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    order_number text,
    status text DEFAULT 'pending_payment'::text NOT NULL,
    first_name text NOT NULL,
    last_name text,
    email text,
    phone text NOT NULL,
    street_address text NOT NULL,
    city text NOT NULL,
    governorate text NOT NULL,
    shipping_method text,
    payment_method text,
    subtotal_amount numeric(12,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(12,2) DEFAULT 0 NOT NULL,
    coupon_code text,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'EGP'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    payment_status text DEFAULT 'pending'::text NOT NULL,
    paid_at timestamp with time zone,
    shipping_review_status text DEFAULT 'not_required'::text NOT NULL,
    checkout_cart_id uuid,
    packing_completed_at timestamp with time zone,
    awaiting_customer_message_id uuid,
    payment_fee_amount numeric(12,2) DEFAULT 0 NOT NULL,
    payment_proof_status text DEFAULT 'not_required'::text NOT NULL,
    payment_proof_file_name text,
    payment_proof_uploaded_at timestamp with time zone,
    payment_proof_reviewed_at timestamp with time zone,
    is_preorder boolean DEFAULT false NOT NULL,
    initial_amount_due numeric(12,2) DEFAULT 0 NOT NULL,
    amount_paid numeric(12,2) DEFAULT 0 NOT NULL,
    preorder_fulfillment_state text DEFAULT 'not_applicable'::text NOT NULL,
    erp_owner text DEFAULT 'built_in'::text NOT NULL,
    sms_locale text DEFAULT 'en'::text NOT NULL,
    CONSTRAINT customer_orders_discount_amount_check CHECK ((discount_amount >= (0)::numeric)),
    CONSTRAINT customer_orders_erp_owner_check CHECK ((erp_owner = ANY (ARRAY['built_in'::text, 'daftra'::text]))),
    CONSTRAINT customer_orders_payment_fee_amount_check CHECK ((payment_fee_amount >= (0)::numeric)),
    CONSTRAINT customer_orders_payment_proof_status_check CHECK ((payment_proof_status = ANY (ARRAY['not_required'::text, 'pending_upload'::text, 'under_review'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT customer_orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'partially_paid'::text, 'paid'::text, 'failed'::text, 'refunded'::text]))),
    CONSTRAINT customer_orders_preorder_fulfillment_check CHECK (((preorder_fulfillment_state = ANY (ARRAY['not_applicable'::text, 'awaiting_stock'::text, 'ready'::text])) AND
CASE
    WHEN is_preorder THEN (preorder_fulfillment_state = ANY (ARRAY['awaiting_stock'::text, 'ready'::text]))
    ELSE (preorder_fulfillment_state = 'not_applicable'::text)
END)),
    CONSTRAINT customer_orders_preorder_money_check CHECK (((initial_amount_due >= (0)::numeric) AND (amount_paid >= (0)::numeric) AND (amount_paid <= total_amount) AND ((NOT is_preorder) OR (initial_amount_due <= total_amount)))),
    CONSTRAINT customer_orders_shipping_review_status_check CHECK ((shipping_review_status = ANY (ARRAY['not_required'::text, 'required'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT customer_orders_sms_locale_check CHECK ((sms_locale = ANY (ARRAY['en'::text, 'ar'::text]))),
    CONSTRAINT customer_orders_status_check CHECK ((status = ANY (ARRAY['pending_payment'::text, 'processing'::text, 'ready_to_deliver'::text, 'being_shipped'::text, 'out_for_delivery'::text, 'on_hold'::text, 'completed'::text, 'refunded'::text, 'cancelled'::text, 'in_progress'::text, 'delivered'::text]))),
    CONSTRAINT customer_orders_subtotal_amount_check CHECK ((subtotal_amount >= (0)::numeric)),
    CONSTRAINT customer_orders_total_amount_check CHECK ((total_amount >= (0)::numeric))
);


--
-- Name: customer_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    avatar_url text,
    phone text,
    address_line_1 text,
    address_line_2 text,
    city text,
    state text,
    country text,
    is_active boolean DEFAULT true NOT NULL,
    wallet_balance numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_internal boolean DEFAULT false NOT NULL,
    CONSTRAINT customer_profiles_wallet_balance_check CHECK ((wallet_balance >= (0)::numeric))
);


--
-- Name: document_file_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_file_tags (
    document_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    added_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_folder_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_folder_permissions (
    folder_id uuid NOT NULL,
    admin_user_id uuid NOT NULL,
    access_level text DEFAULT 'viewer'::text NOT NULL,
    granted_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_folder_permissions_access_check CHECK ((access_level = ANY (ARRAY['viewer'::text, 'editor'::text])))
);


--
-- Name: document_folder_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_folder_tags (
    folder_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    added_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_folders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parent_id uuid,
    name text NOT NULL,
    is_restricted boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_folders_name_check CHECK ((((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 120)) AND (name !~ '[/\\]'::text) AND (btrim(name) <> ALL (ARRAY['.'::text, '..'::text]))))
);


--
-- Name: document_quick_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_quick_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_user_id uuid NOT NULL,
    folder_id uuid,
    document_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_quick_access_one_item_check CHECK ((num_nonnulls(folder_id, document_id) = 1))
);


--
-- Name: document_recent_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_recent_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_user_id uuid NOT NULL,
    document_id uuid NOT NULL,
    last_opened_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    color text DEFAULT 'blue'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_tags_color_check CHECK ((color = ANY (ARRAY['blue'::text, 'violet'::text, 'emerald'::text, 'amber'::text, 'rose'::text, 'slate'::text]))),
    CONSTRAINT document_tags_name_check CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 32)))
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    folder_id uuid,
    name text NOT NULL,
    storage_path text NOT NULL,
    mime_type text DEFAULT 'application/octet-stream'::text NOT NULL,
    size_bytes bigint DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT documents_name_check CHECK ((((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 240)) AND (name !~ '[/\\]'::text) AND (btrim(name) <> ALL (ARRAY['.'::text, '..'::text])))),
    CONSTRAINT documents_size_check CHECK ((size_bytes >= 0))
);


--
-- Name: email_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    work_token uuid NOT NULL,
    attempt_number integer NOT NULL,
    state text DEFAULT 'processing'::text NOT NULL,
    http_status integer,
    error_category text,
    provider_message_id text,
    started_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    finished_at timestamp with time zone,
    CONSTRAINT email_attempts_http_status_check CHECK (((http_status >= 100) AND (http_status <= 599))),
    CONSTRAINT email_attempts_state_check CHECK ((state = ANY (ARRAY['processing'::text, 'accepted'::text, 'failed'::text, 'uncertain'::text, 'suppressed'::text, 'retry'::text])))
);


--
-- Name: email_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_events (
    event_key text NOT NULL,
    message_id uuid NOT NULL,
    provider_message_id text NOT NULL,
    event_type text NOT NULL,
    event_at timestamp with time zone NOT NULL,
    received_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT email_events_event_type_check CHECK ((event_type = ANY (ARRAY['sent'::text, 'delivered'::text, 'deferred'::text, 'soft_bounce'::text, 'hard_bounce'::text, 'spam'::text, 'invalid_email'::text, 'blocked'::text, 'error'::text, 'unsubscribed'::text, 'opened'::text])))
);


--
-- Name: email_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_messages (
    id uuid NOT NULL,
    idempotency_key uuid NOT NULL,
    fingerprint text NOT NULL,
    classification text NOT NULL,
    recipient text NOT NULL,
    sender text NOT NULL,
    sender_name text NOT NULL,
    reply_to text DEFAULT ''::text NOT NULL,
    template_key text,
    template_version integer,
    category text NOT NULL,
    locale text NOT NULL,
    subject text NOT NULL,
    html_body text NOT NULL,
    text_body text NOT NULL,
    body_format text NOT NULL,
    source text NOT NULL,
    business_reference text DEFAULT ''::text NOT NULL,
    actor_id uuid,
    priority integer DEFAULT 0 NOT NULL,
    config_revision integer NOT NULL,
    correlation text NOT NULL,
    unsubscribe_hash text,
    unsubscribe_expires_at timestamp with time zone,
    state text DEFAULT 'queued'::text NOT NULL,
    delivery_state text DEFAULT 'unobserved'::text NOT NULL,
    delivery_at timestamp with time zone,
    opened_at timestamp with time zone,
    provider_message_id text,
    attempts integer DEFAULT 0 NOT NULL,
    error_category text,
    work_token uuid,
    started_at timestamp with time zone,
    dispatched_at timestamp with time zone,
    next_attempt_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    expires_at timestamp with time zone DEFAULT (clock_timestamp() + '00:10:00'::interval) NOT NULL,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    updated_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT email_messages_body_format_check CHECK ((body_format = ANY (ARRAY['html'::text, 'text'::text]))),
    CONSTRAINT email_messages_check CHECK (((classification <> 'marketing'::text) OR ((template_key IS NOT NULL) AND (unsubscribe_hash IS NOT NULL)))),
    CONSTRAINT email_messages_check1 CHECK (((state <> 'accepted'::text) OR (provider_message_id IS NOT NULL))),
    CONSTRAINT email_messages_classification_check CHECK ((classification = ANY (ARRAY['transactional'::text, 'marketing'::text]))),
    CONSTRAINT email_messages_delivery_state_check CHECK ((delivery_state = ANY (ARRAY['unobserved'::text, 'sent'::text, 'deferred'::text, 'delivered'::text, 'soft_bounce'::text, 'hard_bounce'::text, 'blocked'::text, 'spam'::text, 'invalid_email'::text, 'error'::text, 'unsubscribed'::text]))),
    CONSTRAINT email_messages_fingerprint_check CHECK ((fingerprint ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT email_messages_html_body_check CHECK ((octet_length(html_body) <= 131072)),
    CONSTRAINT email_messages_locale_check CHECK ((locale = ANY (ARRAY['en'::text, 'ar'::text]))),
    CONSTRAINT email_messages_priority_check CHECK (((priority >= 0) AND (priority <= 10))),
    CONSTRAINT email_messages_state_check CHECK ((state = ANY (ARRAY['queued'::text, 'processing'::text, 'accepted'::text, 'failed'::text, 'uncertain'::text, 'suppressed'::text]))),
    CONSTRAINT email_messages_subject_check CHECK (((char_length(subject) >= 1) AND (char_length(subject) <= 200))),
    CONSTRAINT email_messages_text_body_check CHECK ((octet_length(text_body) <= 65536))
);


--
-- Name: email_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_preferences (
    recipient text NOT NULL,
    marketing_status text DEFAULT 'unknown'::text NOT NULL,
    consent_at timestamp with time zone,
    provenance text DEFAULT ''::text NOT NULL,
    global_reason text,
    blocked_senders text[] DEFAULT '{}'::text[] NOT NULL,
    updated_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    updated_by uuid,
    CONSTRAINT email_preferences_check CHECK (((marketing_status <> 'subscribed'::text) OR ((consent_at IS NOT NULL) AND (char_length(provenance) > 0)))),
    CONSTRAINT email_preferences_global_reason_check CHECK ((global_reason = ANY (ARRAY['hard_bounce'::text, 'invalid_email'::text, 'spam'::text, 'manual'::text]))),
    CONSTRAINT email_preferences_marketing_status_check CHECK ((marketing_status = ANY (ARRAY['unknown'::text, 'subscribed'::text, 'unsubscribed'::text]))),
    CONSTRAINT email_preferences_recipient_check CHECK (((recipient = lower(recipient)) AND ((char_length(recipient) >= 3) AND (char_length(recipient) <= 254))))
);


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_templates (
    key text NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    classification text NOT NULL,
    subject_en text NOT NULL,
    subject_ar text NOT NULL,
    body_en text NOT NULL,
    body_ar text NOT NULL,
    sender text DEFAULT ''::text NOT NULL,
    reply_to text DEFAULT ''::text NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    updated_by uuid NOT NULL,
    CONSTRAINT email_templates_category_check CHECK (((char_length(category) >= 1) AND (char_length(category) <= 50))),
    CONSTRAINT email_templates_check CHECK ((((char_length(subject_en) >= 1) AND (char_length(subject_en) <= 200)) AND ((char_length(subject_ar) >= 1) AND (char_length(subject_ar) <= 200)))),
    CONSTRAINT email_templates_check1 CHECK ((((char_length(body_en) >= 1) AND (char_length(body_en) <= 20000)) AND ((char_length(body_ar) >= 1) AND (char_length(body_ar) <= 20000)))),
    CONSTRAINT email_templates_classification_check CHECK ((classification = ANY (ARRAY['transactional'::text, 'marketing'::text]))),
    CONSTRAINT email_templates_key_check CHECK ((key ~ '^[a-z][a-z0-9_]{1,79}$'::text)),
    CONSTRAINT email_templates_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100)))
);


--
-- Name: erp_entity_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.erp_entity_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text DEFAULT 'daftra'::text NOT NULL,
    local_entity_type text NOT NULL,
    local_id uuid NOT NULL,
    external_entity_type text NOT NULL,
    external_id text NOT NULL,
    external_number text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_synced_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT erp_entity_links_provider_check CHECK ((provider = 'daftra'::text))
);


--
-- Name: erp_inventory_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.erp_inventory_cache (
    local_entity_type text NOT NULL,
    local_id uuid NOT NULL,
    product_id uuid NOT NULL,
    external_id text NOT NULL,
    quantity integer NOT NULL,
    cost numeric(12,2) NOT NULL,
    fetched_at timestamp with time zone NOT NULL,
    CONSTRAINT erp_inventory_cache_cost_check CHECK ((cost >= (0)::numeric)),
    CONSTRAINT erp_inventory_cache_local_entity_type_check CHECK ((local_entity_type = ANY (ARRAY['product'::text, 'product_variant'::text]))),
    CONSTRAINT erp_inventory_cache_quantity_check CHECK ((quantity >= 0))
);


--
-- Name: erp_provider_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.erp_provider_settings (
    id text NOT NULL,
    account_url text NOT NULL,
    api_key_encrypted text NOT NULL,
    client_id_encrypted text,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    credential_revision bigint DEFAULT 1 NOT NULL,
    CONSTRAINT erp_provider_settings_account_url_check CHECK ((account_url ~ '^https://[^/]+$'::text)),
    CONSTRAINT erp_provider_settings_id_check CHECK ((id = 'daftra'::text))
);


--
-- Name: erp_remote_writes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.erp_remote_writes (
    operation text NOT NULL,
    local_id uuid NOT NULL,
    state text NOT NULL,
    external_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT erp_remote_writes_state_check CHECK ((state = ANY (ARRAY['submitted'::text, 'confirmed'::text])))
);


--
-- Name: erp_stock_reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.erp_stock_reservations (
    order_item_id uuid NOT NULL,
    local_entity_type text NOT NULL,
    local_id uuid NOT NULL,
    quantity integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT erp_stock_reservations_quantity_check CHECK ((quantity > 0))
);


--
-- Name: erp_sync_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.erp_sync_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text DEFAULT 'daftra'::text NOT NULL,
    status text DEFAULT 'review'::text NOT NULL,
    manifest jsonb NOT NULL,
    state_version bigint NOT NULL,
    actor_id uuid,
    result jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT erp_sync_runs_provider_check CHECK ((provider = 'daftra'::text)),
    CONSTRAINT erp_sync_runs_status_check CHECK ((status = ANY (ARRAY['review'::text, 'queued'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: erp_worker_leases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.erp_worker_leases (
    provider text NOT NULL,
    token uuid,
    expires_at timestamp with time zone,
    CONSTRAINT erp_worker_leases_provider_check CHECK ((provider = 'daftra'::text))
);


--
-- Name: help_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.help_articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    summary text DEFAULT ''::text NOT NULL,
    content_markdown text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    is_featured boolean DEFAULT false NOT NULL,
    sort_position integer DEFAULT 0 NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    search_vector tsvector GENERATED ALWAYS AS (((setweight(to_tsvector('simple'::regconfig, COALESCE(title, ''::text)), 'A'::"char") || setweight(to_tsvector('simple'::regconfig, COALESCE(summary, ''::text)), 'B'::"char")) || setweight(to_tsvector('simple'::regconfig, COALESCE(content_markdown, ''::text)), 'C'::"char"))) STORED,
    CONSTRAINT help_articles_content_check CHECK ((char_length(content_markdown) <= 100000)),
    CONSTRAINT help_articles_slug_check CHECK (((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND (char_length(slug) <= 160))),
    CONSTRAINT help_articles_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]))),
    CONSTRAINT help_articles_summary_check CHECK ((char_length(summary) <= 500)),
    CONSTRAINT help_articles_title_check CHECK (((char_length(btrim(title)) >= 1) AND (char_length(btrim(title)) <= 160)))
);


--
-- Name: help_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.help_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    sort_position integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT help_categories_description_check CHECK ((char_length(description) <= 300)),
    CONSTRAINT help_categories_name_check CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 80))),
    CONSTRAINT help_categories_slug_check CHECK (((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND (char_length(slug) <= 80)))
);


--
-- Name: hr_employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_code text,
    first_name text NOT NULL,
    last_name text,
    email text,
    phone text,
    address text,
    "position" text NOT NULL,
    department text,
    hire_date date,
    employment_status text DEFAULT 'active'::text NOT NULL,
    salary_amount numeric(12,2) DEFAULT 0 NOT NULL,
    salary_frequency text DEFAULT 'monthly'::text NOT NULL,
    salary_notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hr_employees_salary_amount_check CHECK ((salary_amount >= (0)::numeric)),
    CONSTRAINT hr_employees_salary_frequency_check CHECK ((salary_frequency = ANY (ARRAY['monthly'::text, 'weekly'::text, 'daily'::text, 'hourly'::text]))),
    CONSTRAINT hr_employees_status_check CHECK ((employment_status = ANY (ARRAY['active'::text, 'on_leave'::text, 'inactive'::text, 'terminated'::text])))
);


--
-- Name: nps_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nps_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    response_id uuid NOT NULL,
    user_id uuid,
    visitor_id uuid NOT NULL,
    score smallint NOT NULL,
    feedback text,
    source text DEFAULT 'store'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_internal boolean DEFAULT false NOT NULL,
    CONSTRAINT nps_responses_feedback_length_check CHECK (((feedback IS NULL) OR ((char_length(btrim(feedback)) >= 1) AND (char_length(btrim(feedback)) <= 999)))),
    CONSTRAINT nps_responses_score_check CHECK (((score >= 0) AND (score <= 10))),
    CONSTRAINT nps_responses_source_check CHECK ((source ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$'::text))
);


--
-- Name: order_packing_scans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_packing_scans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    order_item_id uuid NOT NULL,
    serialized_unit_id uuid,
    scanned_code text NOT NULL,
    scan_type text DEFAULT 'sku'::text NOT NULL,
    scanned_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_packing_scans_code_check CHECK (((length(btrim(scanned_code)) >= 1) AND (length(btrim(scanned_code)) <= 500))),
    CONSTRAINT order_packing_scans_type_check CHECK ((scan_type = ANY (ARRAY['sku'::text, 'serialized'::text])))
);


--
-- Name: order_packing_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_packing_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    admin_user_id uuid,
    processor_name text NOT NULL,
    processor_email text,
    status text DEFAULT 'active'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    completed_order_status text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    work_session_id uuid,
    CONSTRAINT order_packing_sessions_completed_status_check CHECK (((completed_order_status IS NULL) OR (completed_order_status = ANY (ARRAY['ready_to_deliver'::text, 'being_shipped'::text, 'out_for_delivery'::text, 'on_hold'::text])))),
    CONSTRAINT order_packing_sessions_completion_check CHECK ((((status = 'completed'::text) AND (completed_at IS NOT NULL) AND (completed_order_status IS NOT NULL)) OR ((status <> 'completed'::text) AND (completed_at IS NULL) AND (completed_order_status IS NULL)))),
    CONSTRAINT order_packing_sessions_processor_email_check CHECK (((processor_email IS NULL) OR (length(btrim(processor_email)) <= 320))),
    CONSTRAINT order_packing_sessions_processor_name_check CHECK (((length(btrim(processor_name)) >= 1) AND (length(btrim(processor_name)) <= 160))),
    CONSTRAINT order_packing_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: order_packing_videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_packing_videos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    packing_session_id uuid NOT NULL,
    work_session_id uuid NOT NULL,
    order_id uuid NOT NULL,
    recorded_by uuid NOT NULL,
    storage_path text NOT NULL,
    file_name text NOT NULL,
    mime_type text NOT NULL,
    size_bytes bigint,
    duration_seconds numeric(12,3),
    status text DEFAULT 'uploading'::text NOT NULL,
    recording_started_at timestamp with time zone NOT NULL,
    recording_ended_at timestamp with time zone NOT NULL,
    uploaded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_packing_videos_duration_check CHECK (((duration_seconds IS NULL) OR (duration_seconds >= (0)::numeric))),
    CONSTRAINT order_packing_videos_file_name_check CHECK (((length(btrim(file_name)) >= 1) AND (length(btrim(file_name)) <= 240))),
    CONSTRAINT order_packing_videos_mime_check CHECK ((mime_type = ANY (ARRAY['video/webm'::text, 'video/mp4'::text, 'video/quicktime'::text]))),
    CONSTRAINT order_packing_videos_ready_check CHECK (((status <> 'ready'::text) OR ((size_bytes IS NOT NULL) AND (uploaded_at IS NOT NULL)))),
    CONSTRAINT order_packing_videos_size_check CHECK (((size_bytes IS NULL) OR ((size_bytes >= 1) AND (size_bytes <= 524288000)))),
    CONSTRAINT order_packing_videos_status_check CHECK ((status = ANY (ARRAY['uploading'::text, 'ready'::text, 'failed'::text]))),
    CONSTRAINT order_packing_videos_storage_path_check CHECK (((length(btrim(storage_path)) >= 1) AND (length(btrim(storage_path)) <= 500))),
    CONSTRAINT order_packing_videos_time_check CHECK ((recording_ended_at >= recording_started_at))
);


--
-- Name: order_packing_work_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_packing_work_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_user_id uuid NOT NULL,
    operator_name text NOT NULL,
    operator_email text,
    camera_label text,
    status text DEFAULT 'active'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_packing_work_sessions_camera_label_check CHECK (((camera_label IS NULL) OR (length(btrim(camera_label)) <= 300))),
    CONSTRAINT order_packing_work_sessions_closed_check CHECK ((((status = 'active'::text) AND (closed_at IS NULL)) OR ((status = 'closed'::text) AND (closed_at IS NOT NULL)))),
    CONSTRAINT order_packing_work_sessions_operator_email_check CHECK (((operator_email IS NULL) OR (length(btrim(operator_email)) <= 320))),
    CONSTRAINT order_packing_work_sessions_operator_name_check CHECK (((length(btrim(operator_name)) >= 1) AND (length(btrim(operator_name)) <= 160))),
    CONSTRAINT order_packing_work_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'closed'::text])))
);


--
-- Name: payment_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    provider text DEFAULT 'paymob'::text NOT NULL,
    method text DEFAULT 'card'::text NOT NULL,
    mode text NOT NULL,
    integration_id bigint NOT NULL,
    amount_minor bigint NOT NULL,
    currency text NOT NULL,
    status text DEFAULT 'initiated'::text NOT NULL,
    intention_id text,
    provider_order_id text,
    client_secret text,
    error_code text,
    expires_at timestamp with time zone DEFAULT (now() + '00:30:00'::interval) NOT NULL,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_attempts_amount_minor_check CHECK ((amount_minor > 0)),
    CONSTRAINT payment_attempts_client_secret_check CHECK ((length(client_secret) <= 512)),
    CONSTRAINT payment_attempts_currency_check CHECK ((currency = 'EGP'::text)),
    CONSTRAINT payment_attempts_error_code_check CHECK ((length(error_code) <= 80)),
    CONSTRAINT payment_attempts_integration_id_check CHECK ((integration_id > 0)),
    CONSTRAINT payment_attempts_method_check CHECK ((method = 'card'::text)),
    CONSTRAINT payment_attempts_mode_check CHECK ((mode = ANY (ARRAY['test'::text, 'live'::text]))),
    CONSTRAINT payment_attempts_provider_check CHECK ((provider = 'paymob'::text)),
    CONSTRAINT payment_attempts_status_check CHECK ((status = ANY (ARRAY['initiated'::text, 'pending'::text, 'succeeded'::text, 'failed'::text, 'cancelled'::text, 'expired'::text])))
);


--
-- Name: payment_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    attempt_id uuid NOT NULL,
    provider text NOT NULL,
    transaction_id text NOT NULL,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_transactions_provider_check CHECK ((provider = 'paymob'::text)),
    CONSTRAINT payment_transactions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'succeeded'::text, 'failed'::text])))
);


--
-- Name: preorder_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.preorder_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    reference text NOT NULL,
    method text NOT NULL,
    verified_by uuid NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT preorder_payments_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT preorder_payments_method_check CHECK ((method = ANY (ARRAY['bank_transfer'::text, 'instapay'::text]))),
    CONSTRAINT preorder_payments_reference_check CHECK (((char_length(btrim(reference)) >= 3) AND (char_length(btrim(reference)) <= 120)))
);


--
-- Name: product_features; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_features (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    body text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_features_body_check CHECK (((char_length(btrim(body)) >= 1) AND (char_length(btrim(body)) <= 500)))
);


--
-- Name: product_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    image_url text NOT NULL,
    alt_text text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    variant_id uuid
);


--
-- Name: product_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    user_id uuid NOT NULL,
    rating smallint NOT NULL,
    review_text text NOT NULL,
    display_full_name boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT product_reviews_text_length_check CHECK (((char_length(btrim(review_text)) >= 1) AND (char_length(btrim(review_text)) <= 999)))
);


--
-- Name: product_specifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_specifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    label text NOT NULL,
    value text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    definition_id uuid,
    is_highlight boolean DEFAULT false NOT NULL
);


--
-- Name: quick_setup_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quick_setup_events (
    id bigint NOT NULL,
    state_revision bigint NOT NULL,
    actor_id uuid NOT NULL,
    action text NOT NULL,
    key text NOT NULL,
    selected boolean,
    outcome text NOT NULL,
    source text NOT NULL,
    basis_token text,
    basis_revisions jsonb DEFAULT '{}'::jsonb NOT NULL,
    checked_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT quick_setup_events_action_check CHECK ((action = ANY (ARRAY['selection'::text, 'capture'::text, 'acknowledge'::text]))),
    CONSTRAINT quick_setup_events_basis_revisions_check CHECK ((jsonb_typeof(basis_revisions) = 'object'::text)),
    CONSTRAINT quick_setup_events_basis_token_check CHECK ((basis_token ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT quick_setup_events_check CHECK ((((action = 'selection'::text) AND (key = ANY (ARRAY['pdc'::text, 'daftra'::text, 'vodafone'::text, 'brevo'::text, 'paymob'::text, 'paypal'::text, 'oauth'::text, 'live_chat'::text])) AND (selected IS NOT NULL) AND (outcome = ANY (ARRAY['selected'::text, 'excluded'::text])) AND (source = 'owner_selection'::text) AND (basis_token IS NULL)) OR ((action = 'capture'::text) AND (key = ANY (ARRAY['application'::text, 'infrastructure'::text, 'branding'::text, 'contact'::text, 'policies'::text, 'payment_methods'::text, 'paymob'::text, 'paypal'::text, 'express_payments'::text, 'shipping'::text, 'daftra'::text, 'vodafone'::text, 'brevo'::text, 'automation'::text, 'authentication'::text, 'oauth'::text, 'live_chat'::text])) AND (selected IS NULL) AND (outcome = ANY (ARRAY['verified'::text, 'unverified'::text, 'failed'::text, 'stale'::text, 'unavailable'::text])) AND (source = ANY (ARRAY['existing_check'::text, 'configuration_snapshot'::text])) AND (basis_token IS NOT NULL)) OR ((action = 'acknowledge'::text) AND (key = ANY (ARRAY['auth'::text, 'storage'::text, 'commerce'::text, 'providers'::text, 'workers'::text, 'backup'::text, 'migration_history'::text])) AND (selected IS NULL) AND (outcome = ANY (ARRAY['acknowledged'::text, 'revoked'::text])) AND (source = 'owner_report'::text) AND (basis_token IS NOT NULL)))),
    CONSTRAINT quick_setup_events_outcome_check CHECK ((outcome = ANY (ARRAY['selected'::text, 'excluded'::text, 'verified'::text, 'unverified'::text, 'failed'::text, 'stale'::text, 'unavailable'::text, 'acknowledged'::text, 'revoked'::text]))),
    CONSTRAINT quick_setup_events_source_check CHECK ((source = ANY (ARRAY['owner_selection'::text, 'existing_check'::text, 'configuration_snapshot'::text, 'owner_report'::text])))
);


--
-- Name: quick_setup_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.quick_setup_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.quick_setup_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: quick_setup_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quick_setup_revisions (
    domain text NOT NULL,
    revision bigint DEFAULT 0 NOT NULL,
    CONSTRAINT quick_setup_revisions_domain_check CHECK ((domain = ANY (ARRAY['application'::text, 'infrastructure'::text, 'branding'::text, 'contact'::text, 'policies'::text, 'payment_methods'::text, 'paymob'::text, 'paypal'::text, 'express_payments'::text, 'shipping'::text, 'daftra'::text, 'vodafone'::text, 'brevo'::text, 'automation'::text, 'authentication'::text, 'oauth'::text, 'live_chat'::text]))),
    CONSTRAINT quick_setup_revisions_revision_check CHECK ((revision >= 0))
);


--
-- Name: quick_setup_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quick_setup_state (
    singleton boolean DEFAULT true NOT NULL,
    installation_id uuid DEFAULT gen_random_uuid() NOT NULL,
    revision bigint DEFAULT 0 NOT NULL,
    selections jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT quick_setup_state_revision_check CHECK ((revision >= 0)),
    CONSTRAINT quick_setup_state_selections_check CHECK (((jsonb_typeof(selections) = 'object'::text) AND ((selections - ARRAY['pdc'::text, 'daftra'::text, 'vodafone'::text, 'brevo'::text, 'paymob'::text, 'paypal'::text, 'oauth'::text, 'live_chat'::text]) = '{}'::jsonb) AND (NOT jsonb_path_exists(selections, '$.*?(@.type() != "boolean")'::jsonpath)))),
    CONSTRAINT quick_setup_state_singleton_check CHECK (singleton)
);


--
-- Name: quick_setup_snapshot; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.quick_setup_snapshot WITH (security_invoker='true', security_barrier='true') AS
 SELECT singleton,
    installation_id,
    revision,
    selections,
    updated_at,
    ( SELECT jsonb_object_agg(quick_setup_revisions.domain, quick_setup_revisions.revision ORDER BY quick_setup_revisions.domain) AS jsonb_object_agg
           FROM public.quick_setup_revisions) AS revisions,
    ( SELECT COALESCE(jsonb_agg(to_jsonb(e.*) ORDER BY e.id DESC), '[]'::jsonb) AS "coalesce"
           FROM ( SELECT DISTINCT ON (quick_setup_events.action, quick_setup_events.key) quick_setup_events.id,
                    quick_setup_events.state_revision,
                    quick_setup_events.actor_id,
                    quick_setup_events.action,
                    quick_setup_events.key,
                    quick_setup_events.selected,
                    quick_setup_events.outcome,
                    quick_setup_events.source,
                    quick_setup_events.basis_token,
                    quick_setup_events.basis_revisions,
                    quick_setup_events.checked_at,
                    quick_setup_events.expires_at,
                    quick_setup_events.created_at
                   FROM public.quick_setup_events
                  ORDER BY quick_setup_events.action, quick_setup_events.key, quick_setup_events.id DESC) e) AS latest,
    ( SELECT COALESCE(jsonb_agg(to_jsonb(e.*) ORDER BY e.id DESC), '[]'::jsonb) AS "coalesce"
           FROM ( SELECT quick_setup_events.id,
                    quick_setup_events.state_revision,
                    quick_setup_events.actor_id,
                    quick_setup_events.action,
                    quick_setup_events.key,
                    quick_setup_events.selected,
                    quick_setup_events.outcome,
                    quick_setup_events.source,
                    quick_setup_events.basis_token,
                    quick_setup_events.basis_revisions,
                    quick_setup_events.checked_at,
                    quick_setup_events.expires_at,
                    quick_setup_events.created_at
                   FROM public.quick_setup_events
                  ORDER BY quick_setup_events.id DESC
                 LIMIT 50) e) AS history
   FROM public.quick_setup_state s;


--
-- Name: shipping_city_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_city_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text DEFAULT 'pdc'::text NOT NULL,
    provider_city_id integer NOT NULL,
    governorate text NOT NULL,
    city text NOT NULL,
    city_arabic text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shipping_city_mappings_city_id_check CHECK ((provider_city_id > 0)),
    CONSTRAINT shipping_city_mappings_provider_check CHECK ((provider = 'pdc'::text))
);


--
-- Name: shipping_claim_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_claim_jobs (
    id uuid NOT NULL,
    claim_id uuid NOT NULL,
    initiated_by uuid NOT NULL,
    submission_key uuid NOT NULL,
    submission jsonb NOT NULL,
    previous_job_id uuid,
    to_ref text NOT NULL,
    quantity integer NOT NULL,
    pickup jsonb NOT NULL,
    destination jsonb NOT NULL,
    handling_resolution text NOT NULL,
    confirmation_reason text NOT NULL,
    settings_fingerprint text NOT NULL,
    provider_identity jsonb NOT NULL,
    shipment_payload jsonb NOT NULL,
    state text DEFAULT 'queued'::text NOT NULL,
    awb text,
    diagnostic text,
    work_token uuid,
    started_at timestamp with time zone,
    expires_at timestamp with time zone DEFAULT (clock_timestamp() + '00:10:00'::interval) NOT NULL,
    normalized_state text DEFAULT 'unknown'::text NOT NULL,
    provider_status_id integer,
    provider_status_at timestamp with time zone,
    provider_observed_at timestamp with time zone,
    reconciliation_attempted_at timestamp with time zone,
    label_state text DEFAULT 'not_requested'::text NOT NULL,
    label_token uuid,
    label_started_at timestamp with time zone,
    label_storage_path text,
    label_requested_by uuid,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    updated_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT shipping_claim_jobs_awb_check CHECK ((awb ~ '^[A-Za-z0-9][A-Za-z0-9-]{0,99}$'::text)),
    CONSTRAINT shipping_claim_jobs_check CHECK (((state <> ALL (ARRAY['created'::text, 'cancelled'::text, 'returned'::text, 'delivered'::text])) OR (awb IS NOT NULL))),
    CONSTRAINT shipping_claim_jobs_confirmation_reason_check CHECK (((char_length(btrim(confirmation_reason)) >= 1) AND (char_length(btrim(confirmation_reason)) <= 1000))),
    CONSTRAINT shipping_claim_jobs_destination_check CHECK ((jsonb_typeof(destination) = 'object'::text)),
    CONSTRAINT shipping_claim_jobs_handling_resolution_check CHECK ((handling_resolution = ANY (ARRAY['repair'::text, 'replacement'::text, 'refund'::text]))),
    CONSTRAINT shipping_claim_jobs_label_state_check CHECK ((label_state = ANY (ARRAY['not_requested'::text, 'queued'::text, 'creating'::text, 'ready'::text, 'failed'::text]))),
    CONSTRAINT shipping_claim_jobs_normalized_state_check CHECK (public.shipping_valid_state(normalized_state)),
    CONSTRAINT shipping_claim_jobs_pickup_check CHECK ((jsonb_typeof(pickup) = 'object'::text)),
    CONSTRAINT shipping_claim_jobs_quantity_check CHECK (((quantity >= 1) AND (quantity <= 99))),
    CONSTRAINT shipping_claim_jobs_state_check CHECK ((state = ANY (ARRAY['queued'::text, 'creating'::text, 'created'::text, 'failed'::text, 'uncertain'::text, 'cancelled'::text, 'returned'::text, 'delivered'::text]))),
    CONSTRAINT shipping_claim_jobs_to_ref_check CHECK ((to_ref ~ '^ASREV-[a-f0-9]{32}$'::text))
);


--
-- Name: shipping_order_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_order_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    provider text DEFAULT 'pdc'::text NOT NULL,
    state text DEFAULT 'queued'::text NOT NULL,
    to_ref text NOT NULL,
    awb text,
    provider_status_id integer,
    provider_status_name text,
    provider_status_at timestamp with time zone,
    provider_reason_name text,
    label_storage_path text,
    request_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    response_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    last_error text,
    next_attempt_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    normalized_state text DEFAULT 'unknown'::text NOT NULL,
    provider_status_source text DEFAULT 'legacy'::text NOT NULL,
    provider_status_observed_at timestamp with time zone,
    reconciliation_attempted_at timestamp with time zone,
    CONSTRAINT shipping_order_jobs_attempt_check CHECK ((attempt_count >= 0)),
    CONSTRAINT shipping_order_jobs_normalized_state_check CHECK (public.shipping_valid_state(normalized_state)),
    CONSTRAINT shipping_order_jobs_provider_check CHECK ((provider = 'pdc'::text)),
    CONSTRAINT shipping_order_jobs_provider_status_source_check CHECK ((provider_status_source = ANY (ARRAY['legacy'::text, 'webhook'::text, 'reconciliation'::text]))),
    CONSTRAINT shipping_order_jobs_state_check CHECK ((state = ANY (ARRAY['queued'::text, 'blocked'::text, 'submitting'::text, 'label_pending'::text, 'ready'::text, 'failed'::text])))
);


--
-- Name: shipping_provider_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_provider_settings (
    id text NOT NULL,
    display_name text NOT NULL,
    base_url text NOT NULL,
    company_id text NOT NULL,
    product_id integer NOT NULL,
    origin_city_id integer,
    origin_address text,
    origin_phone text,
    origin_contact_name text,
    default_weight_kg numeric(8,3) DEFAULT 1 NOT NULL,
    shipment_type_id integer DEFAULT 1 NOT NULL,
    label_template_id integer DEFAULT 1 NOT NULL,
    allow_open_shipment boolean DEFAULT false NOT NULL,
    all_must_valid boolean DEFAULT true NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    auto_create_labels boolean DEFAULT false NOT NULL,
    access_token_encrypted text,
    webhook_secret_encrypted text,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    api_mode text DEFAULT 'production'::text NOT NULL,
    status_timezone text DEFAULT 'Africa/Cairo'::text NOT NULL,
    cities_cache jsonb DEFAULT '[]'::jsonb NOT NULL,
    products_cache jsonb DEFAULT '[]'::jsonb NOT NULL,
    cities_synced_at timestamp with time zone,
    products_synced_at timestamp with time zone,
    lookup_attempted_at timestamp with time zone,
    reverse_enabled boolean DEFAULT false NOT NULL,
    reverse_shipment_type_id integer,
    CONSTRAINT shipping_provider_settings_api_mode_check CHECK ((api_mode = ANY (ARRAY['production'::text, 'test'::text]))),
    CONSTRAINT shipping_provider_settings_base_url_check CHECK ((((api_mode = 'production'::text) AND (base_url = 'https://clientsapi.pdc-eg.com/api/ClientUsers/V6/'::text)) OR ((api_mode = 'test'::text) AND (base_url = 'https://clientsapi-test.pdc-eg.com/api/ClientUsers/V6/'::text)))),
    CONSTRAINT shipping_provider_settings_cities_cache_check CHECK ((jsonb_typeof(cities_cache) = 'array'::text)),
    CONSTRAINT shipping_provider_settings_id_check CHECK ((id = 'pdc'::text)),
    CONSTRAINT shipping_provider_settings_product_check CHECK ((product_id > 0)),
    CONSTRAINT shipping_provider_settings_products_cache_check CHECK ((jsonb_typeof(products_cache) = 'array'::text)),
    CONSTRAINT shipping_provider_settings_reverse_shipment_type_id_check CHECK ((reverse_shipment_type_id = 3)),
    CONSTRAINT shipping_provider_settings_shipment_type_check CHECK ((shipment_type_id = ANY (ARRAY[1, 3, 5]))),
    CONSTRAINT shipping_provider_settings_template_check CHECK ((label_template_id > 0)),
    CONSTRAINT shipping_provider_settings_weight_check CHECK ((default_weight_kg > (0)::numeric))
);


--
-- Name: shipping_status_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_status_mappings (
    provider text DEFAULT 'pdc'::text NOT NULL,
    provider_status_id integer NOT NULL,
    provider_label text NOT NULL,
    order_status text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    normalized_state text DEFAULT 'unknown'::text NOT NULL,
    provider_aliases text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT shipping_status_mappings_normalized_state_check CHECK (public.shipping_valid_state(normalized_state)),
    CONSTRAINT shipping_status_mappings_order_status_check CHECK (((order_status IS NULL) OR (order_status = ANY (ARRAY['processing'::text, 'being_shipped'::text, 'out_for_delivery'::text, 'on_hold'::text, 'delivered'::text, 'cancelled'::text])))),
    CONSTRAINT shipping_status_mappings_provider_check CHECK ((provider = 'pdc'::text))
);


--
-- Name: shipping_webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text DEFAULT 'pdc'::text NOT NULL,
    event_key text NOT NULL,
    awb text NOT NULL,
    order_ref text NOT NULL,
    provider_status_id integer,
    provider_status_name text,
    status_date timestamp with time zone,
    reason_name text,
    payload jsonb NOT NULL,
    processed_at timestamp with time zone,
    processing_error text,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    shipment_job_id uuid,
    normalized_state text DEFAULT 'unknown'::text NOT NULL,
    source text DEFAULT 'legacy'::text NOT NULL,
    claim_shipment_job_id uuid,
    CONSTRAINT shipping_event_one_purpose CHECK (((shipment_job_id IS NULL) OR (claim_shipment_job_id IS NULL))),
    CONSTRAINT shipping_webhook_events_normalized_state_check CHECK (public.shipping_valid_state(normalized_state)),
    CONSTRAINT shipping_webhook_events_provider_check CHECK ((provider = 'pdc'::text)),
    CONSTRAINT shipping_webhook_events_source_check CHECK ((source = ANY (ARRAY['legacy'::text, 'webhook'::text, 'reconciliation'::text])))
);


--
-- Name: site_coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_coupons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    description text,
    discount_type text DEFAULT 'fixed'::text NOT NULL,
    discount_value numeric(12,2) DEFAULT 0 NOT NULL,
    minimum_order_amount numeric(12,2) DEFAULT 0 NOT NULL,
    usage_limit integer,
    usage_count integer DEFAULT 0 NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT site_coupons_discount_type_check CHECK ((discount_type = ANY (ARRAY['fixed'::text, 'percentage'::text]))),
    CONSTRAINT site_coupons_discount_value_check CHECK ((discount_value >= (0)::numeric)),
    CONSTRAINT site_coupons_minimum_order_amount_check CHECK ((minimum_order_amount >= (0)::numeric)),
    CONSTRAINT site_coupons_usage_count_check CHECK ((usage_count >= 0)),
    CONSTRAINT site_coupons_usage_limit_check CHECK (((usage_limit IS NULL) OR (usage_limit > 0)))
);


--
-- Name: site_hero_banners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_hero_banners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    image_url text NOT NULL,
    link_url text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: site_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    location text NOT NULL,
    section_title text,
    label text NOT NULL,
    url text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT site_links_location_check CHECK ((location = ANY (ARRAY['header'::text, 'footer'::text])))
);


--
-- Name: site_offer_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_offer_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    eyebrow_text text,
    title text NOT NULL,
    image_url text NOT NULL,
    target_type text DEFAULT 'search'::text NOT NULL,
    search_query text,
    product_slug text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT site_offer_cards_target_type_check CHECK ((target_type = ANY (ARRAY['search'::text, 'product'::text])))
);


--
-- Name: site_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    path text NOT NULL,
    content_markdown text DEFAULT ''::text NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    show_in_navbar boolean DEFAULT false NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    text_direction text DEFAULT 'auto'::text NOT NULL,
    seo_title text,
    seo_description text,
    seo_image_url text,
    seo_noindex boolean DEFAULT false NOT NULL,
    CONSTRAINT site_pages_content_size_check CHECK ((char_length(content_markdown) <= 100000)),
    CONSTRAINT site_pages_path_check CHECK ((((char_length(path) >= 1) AND (char_length(path) <= 160)) AND (path = lower(path)) AND (path ~ '^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*$'::text))),
    CONSTRAINT site_pages_text_direction_check CHECK ((text_direction = ANY (ARRAY['auto'::text, 'ltr'::text, 'rtl'::text]))),
    CONSTRAINT site_pages_title_check CHECK (((char_length(btrim(title)) >= 1) AND (char_length(btrim(title)) <= 120)))
);


--
-- Name: site_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text DEFAULT 'default'::text NOT NULL,
    site_name text DEFAULT 'ELcomputer'::text NOT NULL,
    site_logo_url text,
    site_background_color text DEFAULT '#f3f4f6'::text,
    landing_page_title text DEFAULT 'ELcomputer'::text,
    allow_out_of_stock_purchases boolean DEFAULT false NOT NULL,
    homepage_reviews_enabled boolean DEFAULT true NOT NULL,
    homepage_reviews_view_all_enabled boolean DEFAULT true NOT NULL,
    hero_enabled boolean DEFAULT true NOT NULL,
    hero_rotation_seconds integer DEFAULT 5 NOT NULL,
    top_bar_rotation_seconds integer DEFAULT 3 NOT NULL,
    banner_ad_1_enabled boolean DEFAULT true NOT NULL,
    banner_ad_1_image_url text,
    banner_ad_1_link_url text,
    banner_ad_2_enabled boolean DEFAULT true NOT NULL,
    banner_ad_2_image_url text,
    banner_ad_2_link_url text,
    footer_cta_title text DEFAULT 'What are you waiting for?'::text,
    footer_cta_subtitle text DEFAULT 'Purchase your fav gear'::text,
    footer_cta_button_label text DEFAULT 'Shop Now'::text,
    footer_cta_button_url text DEFAULT '/'::text,
    footer_email text,
    footer_phone text,
    footer_address text,
    copyright_text text DEFAULT '© 2026 All rights reserved by ELCOMPUTER'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    dashboard_layout text DEFAULT 'standard'::text NOT NULL,
    erp_mode text DEFAULT 'built_in'::text NOT NULL,
    daftra_connection_status text DEFAULT 'disconnected'::text NOT NULL,
    daftra_last_checked_at timestamp with time zone,
    daftra_connected_at timestamp with time zone,
    daftra_connection_error text,
    account_dashboard_style text DEFAULT 'modern'::text NOT NULL,
    footer_style text DEFAULT 'classic'::text NOT NULL,
    footer_modern_card_image_url text,
    footer_modern_card_title text DEFAULT 'Need help choosing?'::text,
    footer_modern_card_text text DEFAULT 'Our team can help you find the right setup.'::text,
    footer_modern_card_button_label text DEFAULT 'Contact us'::text,
    footer_modern_card_button_url text DEFAULT '/help'::text,
    footer_modern_community_image_url text,
    footer_modern_community_text text DEFAULT 'Join our Slack'::text,
    footer_modern_community_url text,
    footer_modern_banner_image_url text,
    footer_modern_banner_alt text,
    footer_modern_banner_url text,
    footer_modern_bottom_left_text text DEFAULT 'Legal'::text,
    footer_modern_bottom_left_url text,
    footer_modern_bottom_center_text text DEFAULT '© 2026 All rights reserved by ELCOMPUTER'::text,
    footer_modern_bottom_right_title text,
    footer_modern_bottom_right_text text,
    payment_card_enabled boolean DEFAULT false NOT NULL,
    payment_card_fee numeric(12,2) DEFAULT 0 NOT NULL,
    payment_bank_transfer_enabled boolean DEFAULT false NOT NULL,
    payment_bank_transfer_fee numeric(12,2) DEFAULT 0 NOT NULL,
    payment_bank_transfer_instructions text,
    payment_instapay_enabled boolean DEFAULT false NOT NULL,
    payment_instapay_fee numeric(12,2) DEFAULT 0 NOT NULL,
    payment_instapay_instructions text,
    payment_paypal_enabled boolean DEFAULT false NOT NULL,
    payment_paypal_fee numeric(12,2) DEFAULT 0 NOT NULL,
    payment_cash_enabled boolean DEFAULT true NOT NULL,
    payment_cash_fee numeric(12,2) DEFAULT 0 NOT NULL,
    site_logo_light_url text,
    site_logo_dark_url text,
    site_theme_default text DEFAULT 'system'::text NOT NULL,
    auth_page_layout text DEFAULT 'split'::text NOT NULL,
    auth_image_light_url text,
    auth_image_dark_url text,
    auth_image_position text DEFAULT 'center'::text NOT NULL,
    auth_show_visual_text boolean DEFAULT true NOT NULL,
    auth_visual_eyebrow text,
    auth_visual_headline text,
    auth_visual_supporting_text text,
    auth_login_heading text,
    auth_login_supporting_text text,
    auth_signup_heading text,
    auth_signup_supporting_text text,
    auth_facebook_enabled boolean DEFAULT false NOT NULL,
    seo_site_title text,
    seo_default_description text,
    seo_social_image_url text,
    seo_site_url text,
    erp_state_version bigint DEFAULT 0 NOT NULL,
    daftra_tested_revision bigint,
    CONSTRAINT site_settings_account_dashboard_style_check CHECK ((account_dashboard_style = ANY (ARRAY['classic'::text, 'modern'::text]))),
    CONSTRAINT site_settings_auth_image_position_check CHECK ((auth_image_position = ANY (ARRAY['left'::text, 'center'::text, 'right'::text]))),
    CONSTRAINT site_settings_auth_page_layout_check CHECK ((auth_page_layout = ANY (ARRAY['split'::text, 'centered'::text, 'reversed'::text]))),
    CONSTRAINT site_settings_daftra_connection_status_check CHECK ((daftra_connection_status = ANY (ARRAY['disconnected'::text, 'connected'::text, 'error'::text]))),
    CONSTRAINT site_settings_dashboard_layout_check CHECK ((dashboard_layout = ANY (ARRAY['standard'::text, 'detailed'::text]))),
    CONSTRAINT site_settings_erp_mode_check CHECK ((erp_mode = ANY (ARRAY['built_in'::text, 'daftra'::text]))),
    CONSTRAINT site_settings_footer_style_check CHECK ((footer_style = ANY (ARRAY['classic'::text, 'modern'::text]))),
    CONSTRAINT site_settings_hero_rotation_seconds_check CHECK ((hero_rotation_seconds >= 1)),
    CONSTRAINT site_settings_payment_fees_check CHECK (((payment_card_fee >= (0)::numeric) AND (payment_bank_transfer_fee >= (0)::numeric) AND (payment_instapay_fee >= (0)::numeric) AND (payment_paypal_fee >= (0)::numeric) AND (payment_cash_fee >= (0)::numeric))),
    CONSTRAINT site_settings_site_theme_default_check CHECK ((site_theme_default = ANY (ARRAY['system'::text, 'light'::text, 'dark'::text]))),
    CONSTRAINT site_settings_top_bar_rotation_seconds_check CHECK ((top_bar_rotation_seconds >= 1))
);


--
-- Name: site_top_bar_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_top_bar_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    text text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: sms_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    attempt_number integer NOT NULL,
    external_trx_id text NOT NULL,
    status text NOT NULL,
    result_status text,
    error_code integer,
    failure_category text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    CONSTRAINT sms_attempts_attempt_number_check CHECK ((attempt_number > 0)),
    CONSTRAINT sms_attempts_status_check CHECK ((status = ANY (ARRAY['processing'::text, 'submitted'::text, 'partial'::text, 'failed'::text, 'uncertain'::text, 'preflight_failed'::text])))
);


--
-- Name: sms_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    "position" integer NOT NULL,
    recipient text NOT NULL,
    body text NOT NULL,
    sender text NOT NULL,
    encoding text NOT NULL,
    units integer NOT NULL,
    segments integer NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    provider_status text,
    error_code integer,
    failure_category text,
    submitted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sms_messages_body_check CHECK (((length(body) >= 1) AND (length(body) <= 4000))),
    CONSTRAINT sms_messages_encoding_check CHECK ((encoding = ANY (ARRAY['gsm7'::text, 'utf16'::text]))),
    CONSTRAINT sms_messages_position_check CHECK (("position" >= 0)),
    CONSTRAINT sms_messages_provider_status_check CHECK ((provider_status = ANY (ARRAY['SUBMITTED'::text, 'FAILED_TO_SUBMITTED'::text, 'SUSPENDED'::text, 'INVALID'::text]))),
    CONSTRAINT sms_messages_recipient_check CHECK ((recipient ~ '^\+[1-9][0-9]{5,14}$'::text)),
    CONSTRAINT sms_messages_segments_check CHECK ((segments > 0)),
    CONSTRAINT sms_messages_sender_check CHECK (((length(sender) >= 1) AND (length(sender) <= 50))),
    CONSTRAINT sms_messages_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'submitted'::text, 'failed'::text, 'uncertain'::text]))),
    CONSTRAINT sms_messages_units_check CHECK ((units > 0))
);


--
-- Name: sms_order_event_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_order_event_settings (
    event_type text NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    template_en_id uuid,
    template_ar_id uuid,
    config_revision integer DEFAULT 0 NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    capture_started_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT sms_order_event_settings_event_type_check CHECK ((event_type = ANY (ARRAY['order_confirmed'::text, 'payment_confirmed'::text, 'processing'::text, 'cancelled'::text, 'pdc_out_for_delivery'::text, 'pdc_delivery_exception'::text, 'pdc_delivered'::text])))
);


--
-- Name: sms_provider_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_provider_settings (
    id text NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    api_mode text DEFAULT 'production'::text NOT NULL,
    base_url text DEFAULT ''::text NOT NULL,
    port integer,
    account_id_encrypted text,
    password_encrypted text,
    hash_secret_encrypted text,
    notification_path text DEFAULT '/web2sms/sms/submit/Notification'::text NOT NULL,
    campaign_path text DEFAULT '/web2sms/sms/submit'::text NOT NULL,
    sender_names text[] DEFAULT '{}'::text[] NOT NULL,
    default_sender text DEFAULT ''::text NOT NULL,
    expected_outbound_ip text DEFAULT ''::text NOT NULL,
    trusted_ip_confirmed boolean DEFAULT false NOT NULL,
    activation_confirmed boolean DEFAULT false NOT NULL,
    hash_protocol_confirmed boolean DEFAULT false NOT NULL,
    activation_notes text DEFAULT ''::text NOT NULL,
    timeout_ms integer DEFAULT 10000 NOT NULL,
    preflight_retry_limit integer DEFAULT 2 NOT NULL,
    batch_size integer DEFAULT 50 NOT NULL,
    request_interval_ms integer DEFAULT 1000 NOT NULL,
    default_country text DEFAULT 'EG'::text NOT NULL,
    allow_international boolean DEFAULT false NOT NULL,
    config_revision integer DEFAULT 0 NOT NULL,
    next_request_at timestamp with time zone,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sms_provider_settings_api_mode_check CHECK ((api_mode = 'production'::text)),
    CONSTRAINT sms_provider_settings_batch_size_check CHECK (((batch_size >= 1) AND (batch_size <= 200))),
    CONSTRAINT sms_provider_settings_check CHECK (((campaign_path ~ '^/[a-zA-Z0-9/_-]{1,199}$'::text) AND (campaign_path !~ '//'::text) AND (campaign_path ~ '/sms/submit$'::text) AND (notification_path = (campaign_path || '/Notification'::text)) AND (length(notification_path) <= 200))),
    CONSTRAINT sms_provider_settings_check1 CHECK (((NOT is_enabled) OR ((base_url <> ''::text) AND (account_id_encrypted IS NOT NULL) AND (password_encrypted IS NOT NULL) AND (hash_secret_encrypted IS NOT NULL) AND (default_sender = ANY (sender_names)) AND (expected_outbound_ip <> ''::text) AND trusted_ip_confirmed AND activation_confirmed AND hash_protocol_confirmed))),
    CONSTRAINT sms_provider_settings_default_country_check CHECK ((default_country = ANY (ARRAY['EG'::text, 'explicit'::text]))),
    CONSTRAINT sms_provider_settings_id_check CHECK ((id = 'vodafone'::text)),
    CONSTRAINT sms_provider_settings_port_check CHECK (((port >= 1) AND (port <= 65535))),
    CONSTRAINT sms_provider_settings_preflight_retry_limit_check CHECK (((preflight_retry_limit >= 0) AND (preflight_retry_limit <= 3))),
    CONSTRAINT sms_provider_settings_request_interval_ms_check CHECK (((request_interval_ms >= 500) AND (request_interval_ms <= 60000))),
    CONSTRAINT sms_provider_settings_timeout_ms_check CHECK (((timeout_ms >= 1000) AND (timeout_ms <= 30000)))
);


--
-- Name: sms_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    category text DEFAULT 'manual'::text NOT NULL,
    text_en text DEFAULT ''::text NOT NULL,
    text_ar text DEFAULT ''::text NOT NULL,
    traffic_type text NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    sender text DEFAULT ''::text NOT NULL,
    variables text[] DEFAULT '{}'::text[] NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sms_templates_category_check CHECK (((length(category) >= 1) AND (length(category) <= 50))),
    CONSTRAINT sms_templates_check CHECK (((length(text_en) > 0) OR (length(text_ar) > 0))),
    CONSTRAINT sms_templates_code_check CHECK ((code ~ '^[a-z][a-z0-9_]{1,79}$'::text)),
    CONSTRAINT sms_templates_name_check CHECK (((length(name) >= 1) AND (length(name) <= 100))),
    CONSTRAINT sms_templates_text_ar_check CHECK ((length(text_ar) <= 4000)),
    CONSTRAINT sms_templates_text_en_check CHECK ((length(text_en) <= 4000)),
    CONSTRAINT sms_templates_traffic_type_check CHECK ((traffic_type = ANY (ARRAY['notification'::text, 'campaign'::text])))
);


--
-- Name: specification_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.specification_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    group_name text DEFAULT ''::text NOT NULL,
    aliases text[] DEFAULT '{}'::text[] NOT NULL,
    help_text text DEFAULT ''::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    default_highlight boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT specification_definitions_alias_count_check CHECK ((cardinality(aliases) <= 20)),
    CONSTRAINT specification_definitions_group_check CHECK ((char_length(group_name) <= 80)),
    CONSTRAINT specification_definitions_help_check CHECK ((char_length(help_text) <= 300)),
    CONSTRAINT specification_definitions_key_check CHECK (((key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND (char_length(key) <= 100))),
    CONSTRAINT specification_definitions_name_check CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 100)))
);


--
-- Name: store_analytics_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_analytics_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    session_id uuid NOT NULL,
    visitor_id uuid NOT NULL,
    user_id uuid,
    event_name text NOT NULL,
    path text,
    product_id uuid,
    cart_id uuid,
    order_id uuid,
    quantity integer,
    resulting_quantity integer,
    duration_ms integer,
    source text,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT store_analytics_events_cart_check CHECK (((event_name <> ALL (ARRAY['add_to_cart'::text, 'remove_from_cart'::text, 'cart_quantity_changed'::text, 'cart_cleared'::text, 'checkout_started'::text])) OR (cart_id IS NOT NULL))),
    CONSTRAINT store_analytics_events_duration_check CHECK (((duration_ms IS NULL) OR ((duration_ms >= 0) AND (duration_ms <= 1800000)))),
    CONSTRAINT store_analytics_events_name_check CHECK ((event_name = ANY (ARRAY['page_view'::text, 'product_view'::text, 'product_dwell'::text, 'add_to_cart'::text, 'remove_from_cart'::text, 'cart_quantity_changed'::text, 'cart_cleared'::text, 'checkout_started'::text, 'order_created'::text]))),
    CONSTRAINT store_analytics_events_order_check CHECK (((event_name <> 'order_created'::text) OR (order_id IS NOT NULL))),
    CONSTRAINT store_analytics_events_path_check CHECK (((path IS NULL) OR ((char_length(path) >= 1) AND (char_length(path) <= 500) AND ("left"(path, 1) = '/'::text) AND (POSITION(('?'::text) IN (path)) = 0) AND (POSITION(('#'::text) IN (path)) = 0)))),
    CONSTRAINT store_analytics_events_product_check CHECK (((event_name <> ALL (ARRAY['product_view'::text, 'product_dwell'::text, 'add_to_cart'::text, 'remove_from_cart'::text, 'cart_quantity_changed'::text])) OR (product_id IS NOT NULL))),
    CONSTRAINT store_analytics_events_quantity_check CHECK (((quantity IS NULL) OR ((quantity >= 1) AND (quantity <= 999)))),
    CONSTRAINT store_analytics_events_resulting_quantity_check CHECK (((resulting_quantity IS NULL) OR ((resulting_quantity >= 0) AND (resulting_quantity <= 999)))),
    CONSTRAINT store_analytics_events_source_check CHECK (((source IS NULL) OR (source ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$'::text)))
);


--
-- Name: store_analytics_internal_carts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_analytics_internal_carts (
    cart_id uuid NOT NULL,
    marked_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: store_analytics_internal_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_analytics_internal_users (
    user_id uuid NOT NULL,
    marked_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: store_analytics_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_analytics_sessions (
    id uuid NOT NULL,
    visitor_id uuid NOT NULL,
    user_id uuid,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    is_internal boolean DEFAULT false NOT NULL,
    CONSTRAINT store_analytics_sessions_time_check CHECK ((last_seen_at >= started_at))
);


--
-- Name: storefront_product_variants; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.storefront_product_variants WITH (security_invoker='true') AS
 SELECT id,
    product_id,
    name,
    code,
    sku,
    color_name,
    color_hex,
    price,
    public.erp_storefront_stock('product_variant'::text, id, stock_quantity) AS stock_quantity,
    is_active,
    created_at,
    updated_at
   FROM public.product_variants p;


--
-- Name: storefront_products; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.storefront_products WITH (security_invoker='true') AS
 SELECT id,
    title,
    description,
    price,
    old_price,
    image_url,
    is_top_seller,
    is_featured,
    created_at,
    category_id,
    slug,
    brand_id,
    long_description,
    color_name,
    color_hex,
    public.erp_storefront_stock('product'::text, id, stock_quantity) AS stock_quantity,
    is_published,
    sku,
    popularity_score,
    average_rating,
    is_serialized,
    selling_mode,
    expected_availability_date,
    availability_message,
    preorder_active,
    preorder_starts_at,
    preorder_ends_at,
    preorder_payment_mode,
    preorder_deposit_percent,
    preorder_total_limit,
    preorder_customer_limit,
    seo_title,
    seo_description,
    seo_image_url,
    warranty_status,
    warranty_duration_value,
    warranty_duration_unit
   FROM public.products p;


--
-- Name: support_ticket_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_ticket_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    message_id uuid NOT NULL,
    uploaded_by uuid,
    original_name text NOT NULL,
    storage_path text NOT NULL,
    mime_type text NOT NULL,
    size_bytes integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT support_ticket_attachments_mime_check CHECK ((mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text, 'application/pdf'::text, 'text/plain'::text]))),
    CONSTRAINT support_ticket_attachments_name_check CHECK (((char_length(btrim(original_name)) >= 1) AND (char_length(btrim(original_name)) <= 180))),
    CONSTRAINT support_ticket_attachments_size_check CHECK (((size_bytes >= 1) AND (size_bytes <= 5242880)))
);


--
-- Name: support_ticket_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_ticket_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    actor_id uuid,
    actor_type text NOT NULL,
    event_type text NOT NULL,
    old_value text,
    new_value text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_name text,
    CONSTRAINT support_ticket_events_actor_check CHECK ((actor_type = ANY (ARRAY['customer'::text, 'staff'::text, 'system'::text]))),
    CONSTRAINT support_ticket_events_type_check CHECK ((event_type = ANY (ARRAY['created'::text, 'status'::text, 'priority'::text, 'assignment'::text, 'source_chat'::text])))
);


--
-- Name: support_ticket_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_ticket_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    sender_id uuid,
    sender_type text NOT NULL,
    sender_name text NOT NULL,
    body text NOT NULL,
    is_internal boolean DEFAULT false NOT NULL,
    idempotency_key uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    customer_read_at timestamp with time zone,
    CONSTRAINT support_ticket_messages_body_check CHECK (((char_length(btrim(body)) >= 1) AND (char_length(btrim(body)) <= 10000))),
    CONSTRAINT support_ticket_messages_name_check CHECK (((char_length(btrim(sender_name)) >= 1) AND (char_length(btrim(sender_name)) <= 160))),
    CONSTRAINT support_ticket_messages_note_check CHECK (((NOT is_internal) OR (sender_type = 'staff'::text))),
    CONSTRAINT support_ticket_messages_type_check CHECK ((sender_type = ANY (ARRAY['customer'::text, 'staff'::text])))
);


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reference_number bigint NOT NULL,
    customer_id uuid,
    customer_email text,
    customer_name text DEFAULT ''::text NOT NULL,
    order_id uuid,
    category_id uuid,
    subject text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    assigned_admin_id uuid,
    idempotency_key uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_reply_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    customer_mobile text,
    CONSTRAINT support_tickets_closed_at_check CHECK (((status = 'closed'::text) = (closed_at IS NOT NULL))),
    CONSTRAINT support_tickets_contact_check CHECK (((customer_email IS NOT NULL) OR (customer_mobile IS NOT NULL))),
    CONSTRAINT support_tickets_email_check CHECK (((customer_email IS NULL) OR ((char_length(btrim(customer_email)) >= 3) AND (char_length(btrim(customer_email)) <= 320)))),
    CONSTRAINT support_tickets_mobile_check CHECK (((customer_mobile IS NULL) OR (customer_mobile ~ '^\+?[0-9 ()-]{7,30}$'::text))),
    CONSTRAINT support_tickets_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT support_tickets_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'waiting_for_customer'::text, 'waiting_for_support'::text, 'resolved'::text, 'closed'::text]))),
    CONSTRAINT support_tickets_subject_check CHECK (((char_length(btrim(subject)) >= 1) AND (char_length(btrim(subject)) <= 160)))
);


--
-- Name: support_tickets_reference_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.support_tickets ALTER COLUMN reference_number ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.support_tickets_reference_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: system_reset_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_reset_attempts (
    owner_id uuid NOT NULL,
    window_started_at timestamp with time zone NOT NULL,
    attempts integer NOT NULL
);


--
-- Name: system_reset_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_reset_runs (
    id uuid NOT NULL,
    owner_id uuid NOT NULL,
    scope text NOT NULL,
    status text NOT NULL,
    actor jsonb NOT NULL,
    summary jsonb NOT NULL,
    manifest jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT system_reset_runs_status_check CHECK ((status = ANY (ARRAY['cleanup_pending'::text, 'completed'::text])))
);


--
-- Name: treasury_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treasury_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_type text NOT NULL,
    amount numeric(12,2) NOT NULL,
    party_name text NOT NULL,
    procurement_order_id uuid,
    sales_order_id uuid,
    employee_id uuid,
    salary_period date,
    reference_number text,
    notes text,
    paid_at date DEFAULT CURRENT_DATE NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT treasury_transactions_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT treasury_transactions_reference_check CHECK ((((transaction_type = 'supplier_payment'::text) AND (procurement_order_id IS NOT NULL) AND (sales_order_id IS NULL) AND (employee_id IS NULL) AND (salary_period IS NULL)) OR ((transaction_type = 'customer_receipt'::text) AND (procurement_order_id IS NULL) AND (sales_order_id IS NOT NULL) AND (employee_id IS NULL) AND (salary_period IS NULL)) OR ((transaction_type = 'salary_payment'::text) AND (procurement_order_id IS NULL) AND (sales_order_id IS NULL) AND (employee_id IS NOT NULL) AND (salary_period IS NOT NULL)))),
    CONSTRAINT treasury_transactions_type_check CHECK ((transaction_type = ANY (ARRAY['supplier_payment'::text, 'customer_receipt'::text, 'salary_payment'::text])))
);


--
-- Name: admin_activity_logs admin_activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_activity_logs
    ADD CONSTRAINT admin_activity_logs_pkey PRIMARY KEY (id);


--
-- Name: admin_users admin_users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_email_key UNIQUE (email);


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);


--
-- Name: after_sales_claim_events after_sales_claim_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_claim_events
    ADD CONSTRAINT after_sales_claim_events_pkey PRIMARY KEY (id);


--
-- Name: after_sales_claim_evidence after_sales_claim_evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_claim_evidence
    ADD CONSTRAINT after_sales_claim_evidence_pkey PRIMARY KEY (id);


--
-- Name: after_sales_claim_evidence after_sales_claim_evidence_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_claim_evidence
    ADD CONSTRAINT after_sales_claim_evidence_storage_path_key UNIQUE (storage_path);


--
-- Name: after_sales_claim_information after_sales_claim_information_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_claim_information
    ADD CONSTRAINT after_sales_claim_information_pkey PRIMARY KEY (id);


--
-- Name: after_sales_claims after_sales_claims_customer_id_submission_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_claims
    ADD CONSTRAINT after_sales_claims_customer_id_submission_key_key UNIQUE (customer_id, submission_key);


--
-- Name: after_sales_claims after_sales_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_claims
    ADD CONSTRAINT after_sales_claims_pkey PRIMARY KEY (id);


--
-- Name: after_sales_claims after_sales_claims_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_claims
    ADD CONSTRAINT after_sales_claims_reference_key UNIQUE (reference);


--
-- Name: after_sales_communication_settings after_sales_communication_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_communication_settings
    ADD CONSTRAINT after_sales_communication_settings_pkey PRIMARY KEY (purpose);


--
-- Name: after_sales_communications after_sales_communications_email_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_communications
    ADD CONSTRAINT after_sales_communications_email_message_id_key UNIQUE (email_message_id);


--
-- Name: after_sales_communications after_sales_communications_event_id_channel_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_communications
    ADD CONSTRAINT after_sales_communications_event_id_channel_key UNIQUE (event_id, channel);


--
-- Name: after_sales_communications after_sales_communications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_communications
    ADD CONSTRAINT after_sales_communications_pkey PRIMARY KEY (id);


--
-- Name: after_sales_communications after_sales_communications_purpose_occurrence_id_channel_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_communications
    ADD CONSTRAINT after_sales_communications_purpose_occurrence_id_channel_key UNIQUE (purpose, occurrence_id, channel);


--
-- Name: after_sales_communications after_sales_communications_sms_batch_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_communications
    ADD CONSTRAINT after_sales_communications_sms_batch_id_key UNIQUE (sms_batch_id);


--
-- Name: after_sales_policies after_sales_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_policies
    ADD CONSTRAINT after_sales_policies_pkey PRIMARY KEY (scope_key);


--
-- Name: after_sales_policy_versions after_sales_policy_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_policy_versions
    ADD CONSTRAINT after_sales_policy_versions_pkey PRIMARY KEY (id);


--
-- Name: after_sales_policy_versions after_sales_policy_versions_version_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_policy_versions
    ADD CONSTRAINT after_sales_policy_versions_version_key_key UNIQUE (version_key);


--
-- Name: after_sales_return_reasons after_sales_return_reasons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_return_reasons
    ADD CONSTRAINT after_sales_return_reasons_pkey PRIMARY KEY (key);


--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- Name: category_specification_templates category_specification_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_specification_templates
    ADD CONSTRAINT category_specification_templates_pkey PRIMARY KEY (category_id, definition_id);


--
-- Name: chat_agent_availability chat_agent_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_agent_availability
    ADD CONSTRAINT chat_agent_availability_pkey PRIMARY KEY (admin_id);


--
-- Name: chat_attachments chat_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_attachments
    ADD CONSTRAINT chat_attachments_pkey PRIMARY KEY (id);


--
-- Name: chat_attachments chat_attachments_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_attachments
    ADD CONSTRAINT chat_attachments_storage_path_key UNIQUE (storage_path);


--
-- Name: chat_conversations chat_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_pkey PRIMARY KEY (id);


--
-- Name: chat_conversations chat_conversations_reference_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_reference_number_key UNIQUE (reference_number);


--
-- Name: chat_conversations chat_conversations_ticket_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_ticket_id_key UNIQUE (ticket_id);


--
-- Name: chat_events chat_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_events
    ADD CONSTRAINT chat_events_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_id_conversation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_id_conversation_id_key UNIQUE (id, conversation_id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_sequence_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_sequence_number_key UNIQUE (sequence_number);


--
-- Name: chat_rate_limits chat_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_rate_limits
    ADD CONSTRAINT chat_rate_limits_pkey PRIMARY KEY (scope, subject_hash, window_started_at);


--
-- Name: chat_read_state chat_read_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_read_state
    ADD CONSTRAINT chat_read_state_pkey PRIMARY KEY (conversation_id, actor_id);


--
-- Name: chat_settings chat_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_settings
    ADD CONSTRAINT chat_settings_pkey PRIMARY KEY (singleton);


--
-- Name: commerce_crm_accounts commerce_crm_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_crm_accounts
    ADD CONSTRAINT commerce_crm_accounts_pkey PRIMARY KEY (id);


--
-- Name: commerce_crm_activities commerce_crm_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_crm_activities
    ADD CONSTRAINT commerce_crm_activities_pkey PRIMARY KEY (id);


--
-- Name: commerce_inventory_movements commerce_inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_inventory_movements
    ADD CONSTRAINT commerce_inventory_movements_pkey PRIMARY KEY (id);


--
-- Name: commerce_order_return_items commerce_order_return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_order_return_items
    ADD CONSTRAINT commerce_order_return_items_pkey PRIMARY KEY (id);


--
-- Name: commerce_order_returns commerce_order_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_order_returns
    ADD CONSTRAINT commerce_order_returns_pkey PRIMARY KEY (id);


--
-- Name: commerce_procurement_items commerce_procurement_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_procurement_items
    ADD CONSTRAINT commerce_procurement_items_pkey PRIMARY KEY (id);


--
-- Name: commerce_procurement_orders commerce_procurement_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_procurement_orders
    ADD CONSTRAINT commerce_procurement_orders_pkey PRIMARY KEY (id);


--
-- Name: commerce_sales_items commerce_sales_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_sales_items
    ADD CONSTRAINT commerce_sales_items_pkey PRIMARY KEY (id);


--
-- Name: commerce_sales_orders commerce_sales_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_sales_orders
    ADD CONSTRAINT commerce_sales_orders_pkey PRIMARY KEY (id);


--
-- Name: commerce_serialized_inventory_batches commerce_serialized_inventory_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_serialized_inventory_batches
    ADD CONSTRAINT commerce_serialized_inventory_batches_pkey PRIMARY KEY (id);


--
-- Name: commerce_serialized_unit_movements commerce_serialized_unit_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_serialized_unit_movements
    ADD CONSTRAINT commerce_serialized_unit_movements_pkey PRIMARY KEY (id);


--
-- Name: commerce_serialized_units commerce_serialized_units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_serialized_units
    ADD CONSTRAINT commerce_serialized_units_pkey PRIMARY KEY (id);


--
-- Name: commerce_shipping_companies commerce_shipping_companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_shipping_companies
    ADD CONSTRAINT commerce_shipping_companies_pkey PRIMARY KEY (id);


--
-- Name: commerce_warehouse_inventory commerce_warehouse_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_warehouse_inventory
    ADD CONSTRAINT commerce_warehouse_inventory_pkey PRIMARY KEY (id);


--
-- Name: commerce_warehouse_inventory commerce_warehouse_inventory_warehouse_product_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_warehouse_inventory
    ADD CONSTRAINT commerce_warehouse_inventory_warehouse_product_key UNIQUE (warehouse_id, product_id);


--
-- Name: commerce_warehouse_transfer_items commerce_warehouse_transfer_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_warehouse_transfer_items
    ADD CONSTRAINT commerce_warehouse_transfer_items_pkey PRIMARY KEY (id);


--
-- Name: commerce_warehouse_transfers commerce_warehouse_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_warehouse_transfers
    ADD CONSTRAINT commerce_warehouse_transfers_pkey PRIMARY KEY (id);


--
-- Name: commerce_warehouses commerce_warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_warehouses
    ADD CONSTRAINT commerce_warehouses_pkey PRIMARY KEY (id);


--
-- Name: customer_order_items customer_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_order_items
    ADD CONSTRAINT customer_order_items_pkey PRIMARY KEY (id);


--
-- Name: customer_order_messages customer_order_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_order_messages
    ADD CONSTRAINT customer_order_messages_pkey PRIMARY KEY (id);


--
-- Name: customer_orders customer_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_orders
    ADD CONSTRAINT customer_orders_pkey PRIMARY KEY (id);


--
-- Name: customer_profiles customer_profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_profiles
    ADD CONSTRAINT customer_profiles_email_key UNIQUE (email);


--
-- Name: customer_profiles customer_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_profiles
    ADD CONSTRAINT customer_profiles_pkey PRIMARY KEY (id);


--
-- Name: document_file_tags document_file_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_file_tags
    ADD CONSTRAINT document_file_tags_pkey PRIMARY KEY (document_id, tag_id);


--
-- Name: document_folder_permissions document_folder_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_folder_permissions
    ADD CONSTRAINT document_folder_permissions_pkey PRIMARY KEY (folder_id, admin_user_id);


--
-- Name: document_folder_tags document_folder_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_folder_tags
    ADD CONSTRAINT document_folder_tags_pkey PRIMARY KEY (folder_id, tag_id);


--
-- Name: document_folders document_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_folders
    ADD CONSTRAINT document_folders_pkey PRIMARY KEY (id);


--
-- Name: document_quick_access document_quick_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_quick_access
    ADD CONSTRAINT document_quick_access_pkey PRIMARY KEY (id);


--
-- Name: document_recent_items document_recent_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_recent_items
    ADD CONSTRAINT document_recent_items_pkey PRIMARY KEY (id);


--
-- Name: document_tags document_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tags
    ADD CONSTRAINT document_tags_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: documents documents_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_storage_path_key UNIQUE (storage_path);


--
-- Name: email_attempts email_attempts_message_id_attempt_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_attempts
    ADD CONSTRAINT email_attempts_message_id_attempt_number_key UNIQUE (message_id, attempt_number);


--
-- Name: email_attempts email_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_attempts
    ADD CONSTRAINT email_attempts_pkey PRIMARY KEY (id);


--
-- Name: email_attempts email_attempts_work_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_attempts
    ADD CONSTRAINT email_attempts_work_token_key UNIQUE (work_token);


--
-- Name: email_events email_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_events
    ADD CONSTRAINT email_events_pkey PRIMARY KEY (event_key);


--
-- Name: email_messages email_messages_correlation_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_messages
    ADD CONSTRAINT email_messages_correlation_key UNIQUE (correlation);


--
-- Name: email_messages email_messages_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_messages
    ADD CONSTRAINT email_messages_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: email_messages email_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_messages
    ADD CONSTRAINT email_messages_pkey PRIMARY KEY (id);


--
-- Name: email_messages email_messages_provider_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_messages
    ADD CONSTRAINT email_messages_provider_message_id_key UNIQUE (provider_message_id);


--
-- Name: email_messages email_messages_unsubscribe_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_messages
    ADD CONSTRAINT email_messages_unsubscribe_hash_key UNIQUE (unsubscribe_hash);


--
-- Name: email_preferences email_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_preferences
    ADD CONSTRAINT email_preferences_pkey PRIMARY KEY (recipient);


--
-- Name: email_provider_settings email_provider_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_provider_settings
    ADD CONSTRAINT email_provider_settings_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (key);


--
-- Name: erp_entity_links erp_entity_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_entity_links
    ADD CONSTRAINT erp_entity_links_pkey PRIMARY KEY (id);


--
-- Name: erp_inventory_cache erp_inventory_cache_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_inventory_cache
    ADD CONSTRAINT erp_inventory_cache_external_id_key UNIQUE (external_id);


--
-- Name: erp_inventory_cache erp_inventory_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_inventory_cache
    ADD CONSTRAINT erp_inventory_cache_pkey PRIMARY KEY (local_entity_type, local_id);


--
-- Name: erp_provider_settings erp_provider_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_provider_settings
    ADD CONSTRAINT erp_provider_settings_pkey PRIMARY KEY (id);


--
-- Name: erp_remote_writes erp_remote_writes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_remote_writes
    ADD CONSTRAINT erp_remote_writes_pkey PRIMARY KEY (operation, local_id);


--
-- Name: erp_stock_reservations erp_stock_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_stock_reservations
    ADD CONSTRAINT erp_stock_reservations_pkey PRIMARY KEY (order_item_id);


--
-- Name: erp_sync_jobs erp_sync_jobs_dedupe_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_sync_jobs
    ADD CONSTRAINT erp_sync_jobs_dedupe_key_key UNIQUE (dedupe_key);


--
-- Name: erp_sync_jobs erp_sync_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_sync_jobs
    ADD CONSTRAINT erp_sync_jobs_pkey PRIMARY KEY (id);


--
-- Name: erp_sync_runs erp_sync_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_sync_runs
    ADD CONSTRAINT erp_sync_runs_pkey PRIMARY KEY (id);


--
-- Name: erp_worker_leases erp_worker_leases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_worker_leases
    ADD CONSTRAINT erp_worker_leases_pkey PRIMARY KEY (provider);


--
-- Name: help_articles help_articles_category_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_articles
    ADD CONSTRAINT help_articles_category_id_slug_key UNIQUE (category_id, slug);


--
-- Name: help_articles help_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_articles
    ADD CONSTRAINT help_articles_pkey PRIMARY KEY (id);


--
-- Name: help_categories help_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_categories
    ADD CONSTRAINT help_categories_pkey PRIMARY KEY (id);


--
-- Name: help_categories help_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_categories
    ADD CONSTRAINT help_categories_slug_key UNIQUE (slug);


--
-- Name: hr_employees hr_employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employees
    ADD CONSTRAINT hr_employees_pkey PRIMARY KEY (id);


--
-- Name: nps_responses nps_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nps_responses
    ADD CONSTRAINT nps_responses_pkey PRIMARY KEY (id);


--
-- Name: nps_responses nps_responses_response_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nps_responses
    ADD CONSTRAINT nps_responses_response_id_key UNIQUE (response_id);


--
-- Name: order_packing_scans order_packing_scans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_packing_scans
    ADD CONSTRAINT order_packing_scans_pkey PRIMARY KEY (id);


--
-- Name: order_packing_sessions order_packing_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_packing_sessions
    ADD CONSTRAINT order_packing_sessions_pkey PRIMARY KEY (id);


--
-- Name: order_packing_videos order_packing_videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_packing_videos
    ADD CONSTRAINT order_packing_videos_pkey PRIMARY KEY (id);


--
-- Name: order_packing_videos order_packing_videos_session_uidx; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_packing_videos
    ADD CONSTRAINT order_packing_videos_session_uidx UNIQUE (packing_session_id);


--
-- Name: order_packing_videos order_packing_videos_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_packing_videos
    ADD CONSTRAINT order_packing_videos_storage_path_key UNIQUE (storage_path);


--
-- Name: order_packing_work_sessions order_packing_work_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_packing_work_sessions
    ADD CONSTRAINT order_packing_work_sessions_pkey PRIMARY KEY (id);


--
-- Name: payment_attempts payment_attempts_intention_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_attempts
    ADD CONSTRAINT payment_attempts_intention_id_key UNIQUE (intention_id);


--
-- Name: payment_attempts payment_attempts_order_id_provider_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_attempts
    ADD CONSTRAINT payment_attempts_order_id_provider_key UNIQUE (order_id, provider);


--
-- Name: payment_attempts payment_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_attempts
    ADD CONSTRAINT payment_attempts_pkey PRIMARY KEY (id);


--
-- Name: payment_attempts payment_attempts_provider_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_attempts
    ADD CONSTRAINT payment_attempts_provider_order_id_key UNIQUE (provider_order_id);


--
-- Name: payment_transactions payment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);


--
-- Name: payment_transactions payment_transactions_provider_transaction_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_provider_transaction_id_key UNIQUE (provider, transaction_id);


--
-- Name: preorder_payments preorder_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preorder_payments
    ADD CONSTRAINT preorder_payments_pkey PRIMARY KEY (id);


--
-- Name: product_features product_features_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_features
    ADD CONSTRAINT product_features_pkey PRIMARY KEY (id);


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);


--
-- Name: product_images product_images_variant_required_check; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.product_images
    ADD CONSTRAINT product_images_variant_required_check CHECK ((variant_id IS NOT NULL)) NOT VALID;


--
-- Name: product_reviews product_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_pkey PRIMARY KEY (id);


--
-- Name: product_reviews product_reviews_product_user_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_product_user_key UNIQUE (product_id, user_id);


--
-- Name: product_specifications product_specifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_specifications
    ADD CONSTRAINT product_specifications_pkey PRIMARY KEY (id);


--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: quick_setup_events quick_setup_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quick_setup_events
    ADD CONSTRAINT quick_setup_events_pkey PRIMARY KEY (id);


--
-- Name: quick_setup_events quick_setup_events_state_revision_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quick_setup_events
    ADD CONSTRAINT quick_setup_events_state_revision_key UNIQUE (state_revision);


--
-- Name: quick_setup_revisions quick_setup_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quick_setup_revisions
    ADD CONSTRAINT quick_setup_revisions_pkey PRIMARY KEY (domain);


--
-- Name: quick_setup_state quick_setup_state_installation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quick_setup_state
    ADD CONSTRAINT quick_setup_state_installation_id_key UNIQUE (installation_id);


--
-- Name: quick_setup_state quick_setup_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quick_setup_state
    ADD CONSTRAINT quick_setup_state_pkey PRIMARY KEY (singleton);


--
-- Name: shipping_city_mappings shipping_city_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_city_mappings
    ADD CONSTRAINT shipping_city_mappings_pkey PRIMARY KEY (id);


--
-- Name: shipping_claim_jobs shipping_claim_jobs_awb_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_claim_jobs
    ADD CONSTRAINT shipping_claim_jobs_awb_key UNIQUE (awb);


--
-- Name: shipping_claim_jobs shipping_claim_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_claim_jobs
    ADD CONSTRAINT shipping_claim_jobs_pkey PRIMARY KEY (id);


--
-- Name: shipping_claim_jobs shipping_claim_jobs_submission_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_claim_jobs
    ADD CONSTRAINT shipping_claim_jobs_submission_key_key UNIQUE (submission_key);


--
-- Name: shipping_claim_jobs shipping_claim_jobs_to_ref_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_claim_jobs
    ADD CONSTRAINT shipping_claim_jobs_to_ref_key UNIQUE (to_ref);


--
-- Name: shipping_order_jobs shipping_order_jobs_awb_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_jobs
    ADD CONSTRAINT shipping_order_jobs_awb_key UNIQUE (awb);


--
-- Name: shipping_order_jobs shipping_order_jobs_order_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_jobs
    ADD CONSTRAINT shipping_order_jobs_order_key UNIQUE (order_id);


--
-- Name: shipping_order_jobs shipping_order_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_jobs
    ADD CONSTRAINT shipping_order_jobs_pkey PRIMARY KEY (id);


--
-- Name: shipping_order_jobs shipping_order_jobs_ref_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_jobs
    ADD CONSTRAINT shipping_order_jobs_ref_key UNIQUE (to_ref);


--
-- Name: shipping_provider_settings shipping_provider_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_provider_settings
    ADD CONSTRAINT shipping_provider_settings_pkey PRIMARY KEY (id);


--
-- Name: shipping_status_mappings shipping_status_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_status_mappings
    ADD CONSTRAINT shipping_status_mappings_pkey PRIMARY KEY (provider, provider_status_id);


--
-- Name: shipping_webhook_events shipping_webhook_events_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_webhook_events
    ADD CONSTRAINT shipping_webhook_events_key UNIQUE (provider, event_key);


--
-- Name: shipping_webhook_events shipping_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_webhook_events
    ADD CONSTRAINT shipping_webhook_events_pkey PRIMARY KEY (id);


--
-- Name: site_coupons site_coupons_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_coupons
    ADD CONSTRAINT site_coupons_code_key UNIQUE (code);


--
-- Name: site_coupons site_coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_coupons
    ADD CONSTRAINT site_coupons_pkey PRIMARY KEY (id);


--
-- Name: site_hero_banners site_hero_banners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_hero_banners
    ADD CONSTRAINT site_hero_banners_pkey PRIMARY KEY (id);


--
-- Name: site_links site_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_links
    ADD CONSTRAINT site_links_pkey PRIMARY KEY (id);


--
-- Name: site_offer_cards site_offer_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_offer_cards
    ADD CONSTRAINT site_offer_cards_pkey PRIMARY KEY (id);


--
-- Name: site_pages site_pages_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_pages
    ADD CONSTRAINT site_pages_path_key UNIQUE (path);


--
-- Name: site_pages site_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_pages
    ADD CONSTRAINT site_pages_pkey PRIMARY KEY (id);


--
-- Name: site_settings site_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_key_key UNIQUE (key);


--
-- Name: site_settings site_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_pkey PRIMARY KEY (id);


--
-- Name: site_top_bar_messages site_top_bar_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_top_bar_messages
    ADD CONSTRAINT site_top_bar_messages_pkey PRIMARY KEY (id);


--
-- Name: sms_attempts sms_attempts_batch_id_attempt_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_attempts
    ADD CONSTRAINT sms_attempts_batch_id_attempt_number_key UNIQUE (batch_id, attempt_number);


--
-- Name: sms_attempts sms_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_attempts
    ADD CONSTRAINT sms_attempts_pkey PRIMARY KEY (id);


--
-- Name: sms_batches sms_batches_external_trx_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_batches
    ADD CONSTRAINT sms_batches_external_trx_id_key UNIQUE (external_trx_id);


--
-- Name: sms_batches sms_batches_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_batches
    ADD CONSTRAINT sms_batches_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: sms_batches sms_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_batches
    ADD CONSTRAINT sms_batches_pkey PRIMARY KEY (id);


--
-- Name: sms_messages sms_messages_batch_id_position_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_messages
    ADD CONSTRAINT sms_messages_batch_id_position_key UNIQUE (batch_id, "position");


--
-- Name: sms_messages sms_messages_batch_id_recipient_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_messages
    ADD CONSTRAINT sms_messages_batch_id_recipient_key UNIQUE (batch_id, recipient);


--
-- Name: sms_messages sms_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_messages
    ADD CONSTRAINT sms_messages_pkey PRIMARY KEY (id);


--
-- Name: sms_order_event_settings sms_order_event_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_order_event_settings
    ADD CONSTRAINT sms_order_event_settings_pkey PRIMARY KEY (event_type);


--
-- Name: sms_order_events sms_order_events_batch_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_order_events
    ADD CONSTRAINT sms_order_events_batch_id_key UNIQUE (batch_id);


--
-- Name: sms_order_events sms_order_events_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_order_events
    ADD CONSTRAINT sms_order_events_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: sms_order_events sms_order_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_order_events
    ADD CONSTRAINT sms_order_events_pkey PRIMARY KEY (id);


--
-- Name: sms_provider_settings sms_provider_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_provider_settings
    ADD CONSTRAINT sms_provider_settings_pkey PRIMARY KEY (id);


--
-- Name: sms_templates sms_templates_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_templates
    ADD CONSTRAINT sms_templates_code_key UNIQUE (code);


--
-- Name: sms_templates sms_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_templates
    ADD CONSTRAINT sms_templates_pkey PRIMARY KEY (id);


--
-- Name: specification_definitions specification_definitions_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specification_definitions
    ADD CONSTRAINT specification_definitions_key_key UNIQUE (key);


--
-- Name: specification_definitions specification_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specification_definitions
    ADD CONSTRAINT specification_definitions_pkey PRIMARY KEY (id);


--
-- Name: store_analytics_events store_analytics_events_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_analytics_events
    ADD CONSTRAINT store_analytics_events_event_id_key UNIQUE (event_id);


--
-- Name: store_analytics_events store_analytics_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_analytics_events
    ADD CONSTRAINT store_analytics_events_pkey PRIMARY KEY (id);


--
-- Name: store_analytics_internal_carts store_analytics_internal_carts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_analytics_internal_carts
    ADD CONSTRAINT store_analytics_internal_carts_pkey PRIMARY KEY (cart_id);


--
-- Name: store_analytics_internal_users store_analytics_internal_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_analytics_internal_users
    ADD CONSTRAINT store_analytics_internal_users_pkey PRIMARY KEY (user_id);


--
-- Name: store_analytics_sessions store_analytics_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_analytics_sessions
    ADD CONSTRAINT store_analytics_sessions_pkey PRIMARY KEY (id);


--
-- Name: support_ticket_attachments support_ticket_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_attachments
    ADD CONSTRAINT support_ticket_attachments_pkey PRIMARY KEY (id);


--
-- Name: support_ticket_attachments support_ticket_attachments_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_attachments
    ADD CONSTRAINT support_ticket_attachments_storage_path_key UNIQUE (storage_path);


--
-- Name: support_ticket_events support_ticket_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_events
    ADD CONSTRAINT support_ticket_events_pkey PRIMARY KEY (id);


--
-- Name: support_ticket_messages support_ticket_messages_id_ticket_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_messages
    ADD CONSTRAINT support_ticket_messages_id_ticket_id_key UNIQUE (id, ticket_id);


--
-- Name: support_ticket_messages support_ticket_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_messages
    ADD CONSTRAINT support_ticket_messages_pkey PRIMARY KEY (id);


--
-- Name: support_ticket_messages support_ticket_messages_ticket_id_sender_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_messages
    ADD CONSTRAINT support_ticket_messages_ticket_id_sender_id_idempotency_key_key UNIQUE (ticket_id, sender_id, idempotency_key);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_reference_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_reference_number_key UNIQUE (reference_number);


--
-- Name: system_reset_attempts system_reset_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_reset_attempts
    ADD CONSTRAINT system_reset_attempts_pkey PRIMARY KEY (owner_id);


--
-- Name: system_reset_runs system_reset_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_reset_runs
    ADD CONSTRAINT system_reset_runs_pkey PRIMARY KEY (id);


--
-- Name: treasury_transactions treasury_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transactions
    ADD CONSTRAINT treasury_transactions_pkey PRIMARY KEY (id);


--
-- Name: admin_activity_logs_author_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_activity_logs_author_email_idx ON public.admin_activity_logs USING btree (author_email, created_at DESC);


--
-- Name: admin_activity_logs_author_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_activity_logs_author_idx ON public.admin_activity_logs USING btree (admin_user_id, created_at DESC);


--
-- Name: admin_activity_logs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_activity_logs_created_at_idx ON public.admin_activity_logs USING btree (created_at DESC);


--
-- Name: admin_users_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_users_created_at_idx ON public.admin_users USING btree (created_at DESC);


--
-- Name: admin_users_role_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_users_role_active_idx ON public.admin_users USING btree (role, is_active);


--
-- Name: after_sales_claim_active_item_type; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX after_sales_claim_active_item_type ON public.after_sales_claims USING btree (item_id, claim_type) WHERE (status <> ALL (ARRAY['resolved'::text, 'rejected'::text, 'cancelled'::text]));


--
-- Name: after_sales_claim_customer_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX after_sales_claim_customer_created ON public.after_sales_claims USING btree (customer_id, created_at DESC, id);


--
-- Name: after_sales_claim_event_timeline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX after_sales_claim_event_timeline ON public.after_sales_claim_events USING btree (claim_id, created_at DESC, id DESC);


--
-- Name: after_sales_claim_evidence_claim; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX after_sales_claim_evidence_claim ON public.after_sales_claim_evidence USING btree (claim_id) WHERE (claim_id IS NOT NULL);


--
-- Name: after_sales_claim_evidence_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX after_sales_claim_evidence_stage ON public.after_sales_claim_evidence USING btree (customer_id, item_id, claim_type, created_at) WHERE ((claim_id IS NULL) AND (removed_at IS NULL));


--
-- Name: after_sales_claim_one_information_request; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX after_sales_claim_one_information_request ON public.after_sales_claim_information USING btree (claim_id) WHERE (response_at IS NULL);


--
-- Name: after_sales_claim_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX after_sales_claim_order ON public.after_sales_claims USING btree (order_id);


--
-- Name: after_sales_claim_queue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX after_sales_claim_queue ON public.after_sales_claims USING btree (status, claim_type, created_at DESC, id);


--
-- Name: after_sales_communications_history; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX after_sales_communications_history ON public.after_sales_communications USING btree (claim_id, created_at DESC, id DESC);


--
-- Name: after_sales_communications_once; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX after_sales_communications_once ON public.after_sales_communications USING btree (claim_id, purpose, channel) WHERE (purpose = ANY (ARRAY['approved'::text, 'rejected'::text, 'received'::text, 'resolved'::text]));


--
-- Name: after_sales_communications_prepare; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX after_sales_communications_prepare ON public.after_sales_communications USING btree (channel, available_at, created_at, id) WHERE (status = 'pending'::text);


--
-- Name: after_sales_delivery_evidence_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX after_sales_delivery_evidence_idx ON public.shipping_webhook_events USING btree (shipment_job_id, status_date) WHERE ((normalized_state = 'delivered'::text) AND (processed_at IS NOT NULL) AND (source = ANY (ARRAY['webhook'::text, 'reconciliation'::text])));


--
-- Name: brands_slug_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX brands_slug_uidx ON public.brands USING btree (slug);


--
-- Name: category_specification_templates_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX category_specification_templates_order_idx ON public.category_specification_templates USING btree (category_id, sort_order, definition_id);


--
-- Name: chat_agent_availability_online_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_agent_availability_online_idx ON public.chat_agent_availability USING btree (lease_expires_at) WHERE (declared_state = 'online'::text);


--
-- Name: chat_attachments_message_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_attachments_message_idx ON public.chat_attachments USING btree (message_id, created_at);


--
-- Name: chat_attachments_ready_message_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_attachments_ready_message_idx ON public.chat_attachments USING btree (message_id, created_at) WHERE is_ready;


--
-- Name: chat_attachments_thread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_attachments_thread_idx ON public.chat_attachments USING btree (conversation_id, created_at);


--
-- Name: chat_conversations_assignee_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_conversations_assignee_idx ON public.chat_conversations USING btree (assigned_admin_id, status, last_activity_at DESC) WHERE (assigned_admin_id IS NOT NULL);


--
-- Name: chat_conversations_customer_creation_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX chat_conversations_customer_creation_uidx ON public.chat_conversations USING btree (customer_id, creation_key) WHERE (customer_id IS NOT NULL);


--
-- Name: chat_conversations_customer_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_conversations_customer_history_idx ON public.chat_conversations USING btree (customer_id, created_at DESC, id) WHERE (customer_id IS NOT NULL);


--
-- Name: chat_conversations_guest_creation_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX chat_conversations_guest_creation_uidx ON public.chat_conversations USING btree (guest_auth_user_id, creation_key) WHERE (guest_auth_user_id IS NOT NULL);


--
-- Name: chat_conversations_guest_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_conversations_guest_history_idx ON public.chat_conversations USING btree (guest_auth_user_id, created_at DESC, id) WHERE (guest_auth_user_id IS NOT NULL);


--
-- Name: chat_conversations_offline_activity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_conversations_offline_activity_idx ON public.chat_conversations USING btree (last_activity_at DESC, id) WHERE ((intake_mode = 'offline'::text) AND (status <> 'closed'::text));


--
-- Name: chat_conversations_open_assignee_activity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_conversations_open_assignee_activity_idx ON public.chat_conversations USING btree (assigned_admin_id, last_activity_at DESC, id) WHERE (status <> 'closed'::text);


--
-- Name: chat_conversations_open_customer_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX chat_conversations_open_customer_uidx ON public.chat_conversations USING btree (customer_id) WHERE ((customer_id IS NOT NULL) AND (status <> 'closed'::text));


--
-- Name: chat_conversations_open_guest_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX chat_conversations_open_guest_uidx ON public.chat_conversations USING btree (guest_auth_user_id) WHERE ((guest_auth_user_id IS NOT NULL) AND (status <> 'closed'::text));


--
-- Name: chat_conversations_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_conversations_order_idx ON public.chat_conversations USING btree (order_id) WHERE (order_id IS NOT NULL);


--
-- Name: chat_conversations_pending_callback_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_conversations_pending_callback_idx ON public.chat_conversations USING btree (callback_requested_at DESC, id) WHERE (callback_status = 'pending'::text);


--
-- Name: chat_conversations_queue_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_conversations_queue_idx ON public.chat_conversations USING btree (status, intake_mode, last_activity_at DESC, id);


--
-- Name: chat_conversations_status_activity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_conversations_status_activity_idx ON public.chat_conversations USING btree (status, last_activity_at DESC, id);


--
-- Name: chat_conversations_unassigned_activity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_conversations_unassigned_activity_idx ON public.chat_conversations USING btree (last_activity_at DESC, id) WHERE ((assigned_admin_id IS NULL) AND (status <> 'closed'::text));


--
-- Name: chat_events_thread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_events_thread_idx ON public.chat_events USING btree (conversation_id, created_at, id);


--
-- Name: chat_messages_customer_unread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_messages_customer_unread_idx ON public.chat_messages USING btree (conversation_id, sequence_number) WHERE ((sender_kind = 'staff'::text) AND (is_internal = false));


--
-- Name: chat_messages_idempotency_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX chat_messages_idempotency_idx ON public.chat_messages USING btree (conversation_id, sender_id, idempotency_key);


--
-- Name: chat_messages_sender_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_messages_sender_recent_idx ON public.chat_messages USING btree (sender_id, created_at DESC) WHERE (sender_kind = ANY (ARRAY['customer'::text, 'guest'::text]));


--
-- Name: chat_messages_staff_unread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_messages_staff_unread_idx ON public.chat_messages USING btree (conversation_id, sequence_number) WHERE (sender_kind = ANY (ARRAY['customer'::text, 'guest'::text]));


--
-- Name: chat_messages_thread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_messages_thread_idx ON public.chat_messages USING btree (conversation_id, sequence_number DESC);


--
-- Name: chat_rate_limits_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_rate_limits_expiry_idx ON public.chat_rate_limits USING btree (expires_at);


--
-- Name: chat_read_state_actor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_read_state_actor_idx ON public.chat_read_state USING btree (actor_id, updated_at DESC);


--
-- Name: commerce_crm_accounts_code_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX commerce_crm_accounts_code_uidx ON public.commerce_crm_accounts USING btree (code) WHERE (code IS NOT NULL);


--
-- Name: commerce_crm_accounts_entity_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_crm_accounts_entity_name_idx ON public.commerce_crm_accounts USING btree (entity_type, name, id);


--
-- Name: commerce_crm_accounts_type_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_crm_accounts_type_name_idx ON public.commerce_crm_accounts USING btree (account_type, name);


--
-- Name: commerce_crm_activities_account_effective_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_crm_activities_account_effective_idx ON public.commerce_crm_activities USING btree (crm_account_id, effective_at DESC, id DESC);


--
-- Name: commerce_crm_activities_effective_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_crm_activities_effective_idx ON public.commerce_crm_activities USING btree (effective_at DESC, id DESC);


--
-- Name: commerce_crm_activities_occurred_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_crm_activities_occurred_idx ON public.commerce_crm_activities USING btree (occurred_at DESC, id DESC);


--
-- Name: commerce_crm_activities_open_cases_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_crm_activities_open_cases_idx ON public.commerce_crm_activities USING btree (crm_account_id, occurred_at DESC, id DESC) WHERE ((activity_type = 'case'::text) AND (status = 'raised'::text));


--
-- Name: commerce_crm_activities_type_status_effective_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_crm_activities_type_status_effective_idx ON public.commerce_crm_activities USING btree (activity_type, status, effective_at DESC, id DESC);


--
-- Name: commerce_inventory_movements_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_inventory_movements_created_at_idx ON public.commerce_inventory_movements USING btree (created_at DESC);


--
-- Name: commerce_inventory_movements_product_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_inventory_movements_product_created_idx ON public.commerce_inventory_movements USING btree (product_id, created_at DESC);


--
-- Name: commerce_inventory_movements_warehouse_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_inventory_movements_warehouse_created_idx ON public.commerce_inventory_movements USING btree (warehouse_id, created_at DESC);


--
-- Name: commerce_order_return_items_return_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_order_return_items_return_idx ON public.commerce_order_return_items USING btree (order_return_id, created_at);


--
-- Name: commerce_order_return_items_serialized_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_order_return_items_serialized_unit_idx ON public.commerce_order_return_items USING btree (serialized_unit_id) WHERE (serialized_unit_id IS NOT NULL);


--
-- Name: commerce_order_returns_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_order_returns_created_at_idx ON public.commerce_order_returns USING btree (created_at DESC);


--
-- Name: commerce_order_returns_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_order_returns_order_idx ON public.commerce_order_returns USING btree (order_id, created_at DESC);


--
-- Name: commerce_procurement_items_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_procurement_items_order_idx ON public.commerce_procurement_items USING btree (procurement_order_id, created_at);


--
-- Name: commerce_procurement_items_variant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_procurement_items_variant_idx ON public.commerce_procurement_items USING btree (variant_id, created_at) WHERE (variant_id IS NOT NULL);


--
-- Name: commerce_procurement_orders_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_procurement_orders_created_at_idx ON public.commerce_procurement_orders USING btree (created_at DESC);


--
-- Name: commerce_procurement_orders_receipt_key_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX commerce_procurement_orders_receipt_key_uidx ON public.commerce_procurement_orders USING btree (receipt_key) WHERE (receipt_key IS NOT NULL);


--
-- Name: commerce_sales_items_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_sales_items_order_idx ON public.commerce_sales_items USING btree (sales_order_id, created_at);


--
-- Name: commerce_sales_orders_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_sales_orders_created_at_idx ON public.commerce_sales_orders USING btree (created_at DESC);


--
-- Name: commerce_sales_orders_customer_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_sales_orders_customer_created_idx ON public.commerce_sales_orders USING btree (customer_id, created_at DESC);


--
-- Name: commerce_sales_orders_order_number_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX commerce_sales_orders_order_number_uidx ON public.commerce_sales_orders USING btree (order_number) WHERE (order_number IS NOT NULL);


--
-- Name: commerce_serialized_batches_procurement_item_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX commerce_serialized_batches_procurement_item_uidx ON public.commerce_serialized_inventory_batches USING btree (procurement_item_id) WHERE (procurement_item_id IS NOT NULL);


--
-- Name: commerce_serialized_batches_product_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_serialized_batches_product_created_idx ON public.commerce_serialized_inventory_batches USING btree (product_id, created_at DESC);


--
-- Name: commerce_serialized_movements_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_serialized_movements_order_idx ON public.commerce_serialized_unit_movements USING btree (customer_order_id, created_at DESC) WHERE (customer_order_id IS NOT NULL);


--
-- Name: commerce_serialized_movements_procurement_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_serialized_movements_procurement_item_idx ON public.commerce_serialized_unit_movements USING btree (procurement_item_id, created_at DESC) WHERE (procurement_item_id IS NOT NULL);


--
-- Name: commerce_serialized_movements_unit_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_serialized_movements_unit_created_idx ON public.commerce_serialized_unit_movements USING btree (unit_id, created_at DESC);


--
-- Name: commerce_serialized_units_code_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX commerce_serialized_units_code_uidx ON public.commerce_serialized_units USING btree (upper(unit_code));


--
-- Name: commerce_serialized_units_order_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_serialized_units_order_item_idx ON public.commerce_serialized_units USING btree (customer_order_item_id) WHERE (customer_order_item_id IS NOT NULL);


--
-- Name: commerce_serialized_units_procurement_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_serialized_units_procurement_item_idx ON public.commerce_serialized_units USING btree (procurement_item_id, created_at) WHERE (procurement_item_id IS NOT NULL);


--
-- Name: commerce_serialized_units_qr_token_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX commerce_serialized_units_qr_token_uidx ON public.commerce_serialized_units USING btree (qr_token);


--
-- Name: commerce_serialized_units_serial_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX commerce_serialized_units_serial_uidx ON public.commerce_serialized_units USING btree (lower(serial_number)) WHERE ((serial_number IS NOT NULL) AND (btrim(serial_number) <> ''::text));


--
-- Name: commerce_serialized_units_stock_lookup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_serialized_units_stock_lookup_idx ON public.commerce_serialized_units USING btree (product_id, variant_id, warehouse_id, status, created_at, id);


--
-- Name: commerce_shipping_companies_active_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_shipping_companies_active_name_idx ON public.commerce_shipping_companies USING btree (is_active, name);


--
-- Name: commerce_shipping_companies_code_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX commerce_shipping_companies_code_uidx ON public.commerce_shipping_companies USING btree (code) WHERE (code IS NOT NULL);


--
-- Name: commerce_warehouse_inventory_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_warehouse_inventory_product_idx ON public.commerce_warehouse_inventory USING btree (product_id, updated_at DESC);


--
-- Name: commerce_warehouse_transfer_items_transfer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_warehouse_transfer_items_transfer_idx ON public.commerce_warehouse_transfer_items USING btree (transfer_id, created_at);


--
-- Name: commerce_warehouse_transfers_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_warehouse_transfers_created_at_idx ON public.commerce_warehouse_transfers USING btree (created_at DESC);


--
-- Name: commerce_warehouses_active_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commerce_warehouses_active_name_idx ON public.commerce_warehouses USING btree (is_active, name);


--
-- Name: commerce_warehouses_code_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX commerce_warehouses_code_uidx ON public.commerce_warehouses USING btree (code) WHERE (code IS NOT NULL);


--
-- Name: customer_order_items_order_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_order_items_order_id_idx ON public.customer_order_items USING btree (order_id, created_at);


--
-- Name: customer_order_items_preorder_allocation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_order_items_preorder_allocation_idx ON public.customer_order_items USING btree (product_id, order_id) WHERE is_preorder;


--
-- Name: customer_order_items_variant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_order_items_variant_id_idx ON public.customer_order_items USING btree (variant_id);


--
-- Name: customer_order_messages_customer_reply_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customer_order_messages_customer_reply_uidx ON public.customer_order_messages USING btree (reply_to_message_id) WHERE ((sender_type = 'customer'::text) AND (reply_to_message_id IS NOT NULL));


--
-- Name: customer_order_messages_order_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_order_messages_order_created_idx ON public.customer_order_messages USING btree (order_id, created_at, id) WHERE (order_id IS NOT NULL);


--
-- Name: customer_order_messages_packing_session_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customer_order_messages_packing_session_uidx ON public.customer_order_messages USING btree (packing_session_id) WHERE (packing_session_id IS NOT NULL);


--
-- Name: customer_order_messages_reply_to_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_order_messages_reply_to_idx ON public.customer_order_messages USING btree (reply_to_message_id, created_at, id) WHERE (reply_to_message_id IS NOT NULL);


--
-- Name: customer_order_messages_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_order_messages_user_created_idx ON public.customer_order_messages USING btree (user_id, created_at DESC);


--
-- Name: customer_order_messages_user_unread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_order_messages_user_unread_idx ON public.customer_order_messages USING btree (user_id, created_at DESC) WHERE (read_at IS NULL);


--
-- Name: customer_orders_awaiting_customer_message_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_orders_awaiting_customer_message_idx ON public.customer_orders USING btree (awaiting_customer_message_id) WHERE (awaiting_customer_message_id IS NOT NULL);


--
-- Name: customer_orders_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_orders_created_at_idx ON public.customer_orders USING btree (created_at DESC);


--
-- Name: customer_orders_order_number_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customer_orders_order_number_uidx ON public.customer_orders USING btree (order_number) WHERE (order_number IS NOT NULL);


--
-- Name: customer_orders_packing_queue_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_orders_packing_queue_idx ON public.customer_orders USING btree (status, created_at, id) WHERE ((status = ANY (ARRAY['pending_payment'::text, 'processing'::text])) AND (packing_completed_at IS NULL));


--
-- Name: customer_orders_user_checkout_cart_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customer_orders_user_checkout_cart_uidx ON public.customer_orders USING btree (user_id, checkout_cart_id) WHERE (checkout_cart_id IS NOT NULL);


--
-- Name: customer_orders_user_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_orders_user_created_at_idx ON public.customer_orders USING btree (user_id, created_at DESC);


--
-- Name: customer_orders_user_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_orders_user_status_idx ON public.customer_orders USING btree (user_id, status);


--
-- Name: customer_profiles_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_profiles_created_at_idx ON public.customer_profiles USING btree (created_at DESC);


--
-- Name: customer_profiles_external_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_profiles_external_active_idx ON public.customer_profiles USING btree (is_active) WHERE (is_internal = false);


--
-- Name: customer_profiles_external_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_profiles_external_created_idx ON public.customer_profiles USING btree (created_at DESC) WHERE (is_internal = false);


--
-- Name: customer_profiles_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_profiles_is_active_idx ON public.customer_profiles USING btree (is_active);


--
-- Name: document_file_tags_tag_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_file_tags_tag_idx ON public.document_file_tags USING btree (tag_id, document_id);


--
-- Name: document_folder_permissions_admin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_folder_permissions_admin_idx ON public.document_folder_permissions USING btree (admin_user_id, folder_id);


--
-- Name: document_folder_tags_tag_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_folder_tags_tag_idx ON public.document_folder_tags USING btree (tag_id, folder_id);


--
-- Name: document_folders_parent_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_folders_parent_name_idx ON public.document_folders USING btree (parent_id, name);


--
-- Name: document_folders_parent_name_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX document_folders_parent_name_uidx ON public.document_folders USING btree (parent_id, lower(name)) WHERE (parent_id IS NOT NULL);


--
-- Name: document_folders_root_name_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX document_folders_root_name_uidx ON public.document_folders USING btree (lower(name)) WHERE (parent_id IS NULL);


--
-- Name: document_quick_access_document_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX document_quick_access_document_uidx ON public.document_quick_access USING btree (admin_user_id, document_id) WHERE (document_id IS NOT NULL);


--
-- Name: document_quick_access_folder_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX document_quick_access_folder_uidx ON public.document_quick_access USING btree (admin_user_id, folder_id) WHERE (folder_id IS NOT NULL);


--
-- Name: document_quick_access_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_quick_access_user_created_idx ON public.document_quick_access USING btree (admin_user_id, created_at DESC);


--
-- Name: document_recent_items_user_document_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX document_recent_items_user_document_uidx ON public.document_recent_items USING btree (admin_user_id, document_id);


--
-- Name: document_recent_items_user_opened_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_recent_items_user_opened_idx ON public.document_recent_items USING btree (admin_user_id, last_opened_at DESC);


--
-- Name: document_tags_name_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX document_tags_name_uidx ON public.document_tags USING btree (lower(btrim(name)));


--
-- Name: documents_folder_updated_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX documents_folder_updated_idx ON public.documents USING btree (folder_id, updated_at DESC);


--
-- Name: email_events_history; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_events_history ON public.email_events USING btree (message_id, event_at DESC);


--
-- Name: email_history; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_history ON public.email_messages USING btree (created_at DESC, id);


--
-- Name: email_queue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_queue ON public.email_messages USING btree (priority DESC, created_at) WHERE (state = 'queued'::text);


--
-- Name: email_recipient_history; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_recipient_history ON public.email_messages USING btree (recipient, created_at DESC);


--
-- Name: erp_entity_links_external_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX erp_entity_links_external_uidx ON public.erp_entity_links USING btree (provider, external_entity_type, external_id);


--
-- Name: erp_entity_links_local_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX erp_entity_links_local_uidx ON public.erp_entity_links USING btree (provider, local_entity_type, local_id);


--
-- Name: erp_entity_links_synced_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX erp_entity_links_synced_idx ON public.erp_entity_links USING btree (last_synced_at DESC);


--
-- Name: erp_stock_reservations_local_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX erp_stock_reservations_local_idx ON public.erp_stock_reservations USING btree (local_entity_type, local_id);


--
-- Name: erp_sync_jobs_local_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX erp_sync_jobs_local_idx ON public.erp_sync_jobs USING btree (local_entity_type, local_id, created_at DESC);


--
-- Name: erp_sync_jobs_queue_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX erp_sync_jobs_queue_idx ON public.erp_sync_jobs USING btree (status, available_at, created_at);


--
-- Name: help_articles_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX help_articles_category_idx ON public.help_articles USING btree (category_id, status, sort_position);


--
-- Name: help_articles_public_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX help_articles_public_idx ON public.help_articles USING btree (status, is_featured DESC, sort_position, published_at DESC);


--
-- Name: help_articles_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX help_articles_search_idx ON public.help_articles USING gin (search_vector);


--
-- Name: help_categories_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX help_categories_order_idx ON public.help_categories USING btree (is_active, sort_position, name);


--
-- Name: hr_employees_code_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX hr_employees_code_uidx ON public.hr_employees USING btree (employee_code) WHERE (employee_code IS NOT NULL);


--
-- Name: hr_employees_status_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_employees_status_name_idx ON public.hr_employees USING btree (employment_status, first_name, last_name);


--
-- Name: nps_responses_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nps_responses_created_at_idx ON public.nps_responses USING btree (created_at DESC);


--
-- Name: nps_responses_external_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nps_responses_external_created_idx ON public.nps_responses USING btree (created_at DESC) WHERE (is_internal = false);


--
-- Name: nps_responses_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nps_responses_user_created_idx ON public.nps_responses USING btree (user_id, created_at DESC) WHERE (user_id IS NOT NULL);


--
-- Name: nps_responses_visitor_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nps_responses_visitor_created_idx ON public.nps_responses USING btree (visitor_id, created_at DESC);


--
-- Name: order_packing_scans_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_packing_scans_item_idx ON public.order_packing_scans USING btree (order_item_id, session_id);


--
-- Name: order_packing_scans_session_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_packing_scans_session_created_idx ON public.order_packing_scans USING btree (session_id, created_at, id);


--
-- Name: order_packing_scans_session_unit_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX order_packing_scans_session_unit_uidx ON public.order_packing_scans USING btree (session_id, serialized_unit_id) WHERE (serialized_unit_id IS NOT NULL);


--
-- Name: order_packing_sessions_active_admin_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX order_packing_sessions_active_admin_uidx ON public.order_packing_sessions USING btree (admin_user_id) WHERE ((status = 'active'::text) AND (admin_user_id IS NOT NULL));


--
-- Name: order_packing_sessions_admin_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_packing_sessions_admin_created_idx ON public.order_packing_sessions USING btree (admin_user_id, created_at DESC);


--
-- Name: order_packing_sessions_open_order_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX order_packing_sessions_open_order_uidx ON public.order_packing_sessions USING btree (order_id) WHERE (status = ANY (ARRAY['active'::text, 'completed'::text]));


--
-- Name: order_packing_sessions_order_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_packing_sessions_order_created_idx ON public.order_packing_sessions USING btree (order_id, created_at DESC);


--
-- Name: order_packing_sessions_work_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_packing_sessions_work_session_idx ON public.order_packing_sessions USING btree (work_session_id, created_at DESC);


--
-- Name: order_packing_videos_order_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_packing_videos_order_created_idx ON public.order_packing_videos USING btree (order_id, created_at DESC);


--
-- Name: order_packing_work_sessions_active_admin_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX order_packing_work_sessions_active_admin_uidx ON public.order_packing_work_sessions USING btree (admin_user_id) WHERE (status = 'active'::text);


--
-- Name: order_packing_work_sessions_admin_started_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_packing_work_sessions_admin_started_idx ON public.order_packing_work_sessions USING btree (admin_user_id, started_at DESC);


--
-- Name: payment_transactions_attempt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_transactions_attempt_idx ON public.payment_transactions USING btree (attempt_id);


--
-- Name: preorder_payments_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX preorder_payments_order_idx ON public.preorder_payments USING btree (order_id, recorded_at);


--
-- Name: preorder_payments_reference_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX preorder_payments_reference_uidx ON public.preorder_payments USING btree (order_id, lower(reference));


--
-- Name: product_features_product_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_features_product_order_idx ON public.product_features USING btree (product_id, sort_order, created_at);


--
-- Name: product_images_product_id_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_images_product_id_sort_idx ON public.product_images USING btree (product_id, sort_order);


--
-- Name: product_images_variant_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_images_variant_sort_idx ON public.product_images USING btree (variant_id, sort_order, created_at);


--
-- Name: product_reviews_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_reviews_created_at_idx ON public.product_reviews USING btree (created_at DESC);


--
-- Name: product_reviews_product_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_reviews_product_created_idx ON public.product_reviews USING btree (product_id, created_at DESC);


--
-- Name: product_reviews_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_reviews_user_created_idx ON public.product_reviews USING btree (user_id, created_at DESC);


--
-- Name: product_specifications_product_definition_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_specifications_product_definition_idx ON public.product_specifications USING btree (product_id, definition_id) WHERE (definition_id IS NOT NULL);


--
-- Name: product_specifications_product_id_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_specifications_product_id_sort_idx ON public.product_specifications USING btree (product_id, sort_order);


--
-- Name: product_variants_product_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_variants_product_active_idx ON public.product_variants USING btree (product_id, is_active, created_at);


--
-- Name: product_variants_product_code_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_variants_product_code_uidx ON public.product_variants USING btree (product_id, lower(code)) WHERE is_active;


--
-- Name: product_variants_product_id_id_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_variants_product_id_id_uidx ON public.product_variants USING btree (product_id, id);


--
-- Name: product_variants_sku_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_variants_sku_uidx ON public.product_variants USING btree (lower(sku)) WHERE (is_active AND (sku IS NOT NULL) AND (btrim(sku) <> ''::text));


--
-- Name: products_average_rating_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_average_rating_idx ON public.products USING btree (average_rating DESC);


--
-- Name: products_brand_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_brand_id_idx ON public.products USING btree (brand_id);


--
-- Name: products_category_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_category_id_idx ON public.products USING btree (category_id);


--
-- Name: products_default_supplier_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_default_supplier_id_idx ON public.products USING btree (default_supplier_id);


--
-- Name: products_is_published_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_is_published_idx ON public.products USING btree (is_published);


--
-- Name: products_popularity_score_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_popularity_score_idx ON public.products USING btree (popularity_score DESC);


--
-- Name: products_primary_warehouse_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_primary_warehouse_id_idx ON public.products USING btree (primary_warehouse_id);


--
-- Name: products_sku_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX products_sku_uidx ON public.products USING btree (sku) WHERE (sku IS NOT NULL);


--
-- Name: products_slug_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX products_slug_uidx ON public.products USING btree (slug);


--
-- Name: quick_setup_events_daftra_binding; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quick_setup_events_daftra_binding ON public.quick_setup_events USING btree (checked_at, basis_token) WHERE ((action = 'capture'::text) AND (key = 'daftra'::text) AND (source = 'existing_check'::text));


--
-- Name: quick_setup_events_latest; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quick_setup_events_latest ON public.quick_setup_events USING btree (action, key, id DESC);


--
-- Name: quick_setup_events_owner_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quick_setup_events_owner_recent ON public.quick_setup_events USING btree (actor_id, created_at DESC);


--
-- Name: shipping_city_mappings_name_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX shipping_city_mappings_name_uidx ON public.shipping_city_mappings USING btree (provider, lower(governorate), lower(city));


--
-- Name: shipping_city_mappings_provider_city_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX shipping_city_mappings_provider_city_uidx ON public.shipping_city_mappings USING btree (provider, provider_city_id);


--
-- Name: shipping_claim_event_history; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shipping_claim_event_history ON public.shipping_webhook_events USING btree (claim_shipment_job_id, status_date, received_at);


--
-- Name: shipping_claim_history; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shipping_claim_history ON public.shipping_claim_jobs USING btree (claim_id, created_at DESC, id);


--
-- Name: shipping_claim_one_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX shipping_claim_one_active ON public.shipping_claim_jobs USING btree (claim_id) WHERE (state = ANY (ARRAY['queued'::text, 'creating'::text, 'created'::text, 'uncertain'::text]));


--
-- Name: shipping_claim_queue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shipping_claim_queue ON public.shipping_claim_jobs USING btree (state, created_at);


--
-- Name: shipping_events_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shipping_events_history_idx ON public.shipping_webhook_events USING btree (provider, order_ref, awb, status_date, received_at) WHERE (processed_at IS NOT NULL);


--
-- Name: shipping_events_pdc_status_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX shipping_events_pdc_status_uidx ON public.shipping_webhook_events USING btree (provider, awb, provider_status_id) WHERE ((source <> 'legacy'::text) AND (provider_status_id IS NOT NULL));


--
-- Name: shipping_order_jobs_queue_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shipping_order_jobs_queue_idx ON public.shipping_order_jobs USING btree (state, next_attempt_at, created_at);


--
-- Name: shipping_webhook_events_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shipping_webhook_events_order_idx ON public.shipping_webhook_events USING btree (order_ref, received_at DESC);


--
-- Name: site_coupons_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX site_coupons_is_active_idx ON public.site_coupons USING btree (is_active, code);


--
-- Name: site_hero_banners_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX site_hero_banners_sort_idx ON public.site_hero_banners USING btree (sort_order, created_at);


--
-- Name: site_links_location_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX site_links_location_sort_idx ON public.site_links USING btree (location, section_title, sort_order, created_at);


--
-- Name: site_offer_cards_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX site_offer_cards_sort_idx ON public.site_offer_cards USING btree (sort_order, created_at);


--
-- Name: site_pages_public_nav_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX site_pages_public_nav_idx ON public.site_pages USING btree (is_published, show_in_navbar, created_at);


--
-- Name: site_pages_updated_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX site_pages_updated_idx ON public.site_pages USING btree (updated_at DESC);


--
-- Name: site_top_bar_messages_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX site_top_bar_messages_sort_idx ON public.site_top_bar_messages USING btree (sort_order, created_at);


--
-- Name: sms_attempts_batch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_attempts_batch ON public.sms_attempts USING btree (batch_id);


--
-- Name: sms_batches_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_batches_actor ON public.sms_batches USING btree (triggered_by, created_at DESC);


--
-- Name: sms_batches_history; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_batches_history ON public.sms_batches USING btree (created_at DESC);


--
-- Name: sms_batches_queue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_batches_queue ON public.sms_batches USING btree (priority DESC, available_at, created_at) WHERE (status = 'queued'::text);


--
-- Name: sms_messages_batch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_messages_batch ON public.sms_messages USING btree (batch_id);


--
-- Name: sms_order_events_history; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_order_events_history ON public.sms_order_events USING btree (created_at DESC);


--
-- Name: sms_order_events_order_identity; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sms_order_events_order_identity ON public.sms_order_events USING btree (order_id, event_type) WHERE (event_type = ANY (ARRAY['order_confirmed'::text, 'payment_confirmed'::text, 'processing'::text, 'cancelled'::text]));


--
-- Name: sms_order_events_order_link; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_order_events_order_link ON public.sms_order_events USING btree (order_id);


--
-- Name: sms_order_events_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_order_events_pending ON public.sms_order_events USING btree (available_at, created_at) WHERE (status = 'pending'::text);


--
-- Name: sms_order_events_shipment_identity; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sms_order_events_shipment_identity ON public.sms_order_events USING btree (shipment_job_id, shipment_awb, event_type) WHERE (shipment_job_id IS NOT NULL);


--
-- Name: sms_order_events_tracking_link; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sms_order_events_tracking_link ON public.sms_order_events USING btree (tracking_event_id) WHERE (tracking_event_id IS NOT NULL);


--
-- Name: specification_definitions_active_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX specification_definitions_active_order_idx ON public.specification_definitions USING btree (is_active, sort_order, name);


--
-- Name: specification_definitions_normalized_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX specification_definitions_normalized_name_idx ON public.specification_definitions USING btree (lower(btrim(name)));


--
-- Name: store_analytics_events_cart_occurred_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX store_analytics_events_cart_occurred_idx ON public.store_analytics_events USING btree (cart_id, occurred_at) WHERE (cart_id IS NOT NULL);


--
-- Name: store_analytics_events_name_occurred_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX store_analytics_events_name_occurred_idx ON public.store_analytics_events USING btree (event_name, occurred_at DESC);


--
-- Name: store_analytics_events_occurred_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX store_analytics_events_occurred_session_idx ON public.store_analytics_events USING btree (occurred_at DESC, session_id);


--
-- Name: store_analytics_events_order_created_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX store_analytics_events_order_created_uidx ON public.store_analytics_events USING btree (order_id) WHERE ((event_name = 'order_created'::text) AND (order_id IS NOT NULL));


--
-- Name: store_analytics_events_product_occurred_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX store_analytics_events_product_occurred_idx ON public.store_analytics_events USING btree (product_id, occurred_at DESC) WHERE (product_id IS NOT NULL);


--
-- Name: store_analytics_events_session_occurred_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX store_analytics_events_session_occurred_idx ON public.store_analytics_events USING btree (session_id, occurred_at DESC);


--
-- Name: store_analytics_events_user_occurred_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX store_analytics_events_user_occurred_idx ON public.store_analytics_events USING btree (user_id, occurred_at DESC) WHERE (user_id IS NOT NULL);


--
-- Name: store_analytics_events_visitor_occurred_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX store_analytics_events_visitor_occurred_idx ON public.store_analytics_events USING btree (visitor_id, occurred_at DESC);


--
-- Name: store_analytics_sessions_external_last_seen_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX store_analytics_sessions_external_last_seen_idx ON public.store_analytics_sessions USING btree (last_seen_at DESC, visitor_id) WHERE (is_internal = false);


--
-- Name: store_analytics_sessions_external_started_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX store_analytics_sessions_external_started_idx ON public.store_analytics_sessions USING btree (started_at DESC) WHERE (is_internal = false);


--
-- Name: store_analytics_sessions_external_visitor_started_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX store_analytics_sessions_external_visitor_started_idx ON public.store_analytics_sessions USING btree (visitor_id, started_at, id) WHERE (is_internal = false);


--
-- Name: store_analytics_sessions_started_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX store_analytics_sessions_started_idx ON public.store_analytics_sessions USING btree (started_at DESC);


--
-- Name: store_analytics_sessions_user_started_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX store_analytics_sessions_user_started_idx ON public.store_analytics_sessions USING btree (user_id, started_at DESC) WHERE (user_id IS NOT NULL);


--
-- Name: store_analytics_sessions_visitor_started_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX store_analytics_sessions_visitor_started_idx ON public.store_analytics_sessions USING btree (visitor_id, started_at DESC);


--
-- Name: support_ticket_attachments_message_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_ticket_attachments_message_idx ON public.support_ticket_attachments USING btree (message_id, created_at);


--
-- Name: support_ticket_attachments_ticket_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_ticket_attachments_ticket_idx ON public.support_ticket_attachments USING btree (ticket_id, created_at);


--
-- Name: support_ticket_events_thread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_ticket_events_thread_idx ON public.support_ticket_events USING btree (ticket_id, created_at, id);


--
-- Name: support_ticket_messages_customer_unread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_ticket_messages_customer_unread_idx ON public.support_ticket_messages USING btree (ticket_id, created_at) WHERE ((sender_type = 'staff'::text) AND (is_internal = false) AND (customer_read_at IS NULL));


--
-- Name: support_ticket_messages_thread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_ticket_messages_thread_idx ON public.support_ticket_messages USING btree (ticket_id, created_at, id);


--
-- Name: support_tickets_assignee_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_tickets_assignee_idx ON public.support_tickets USING btree (assigned_admin_id, status, updated_at DESC);


--
-- Name: support_tickets_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_tickets_category_idx ON public.support_tickets USING btree (category_id, updated_at DESC);


--
-- Name: support_tickets_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_tickets_customer_idx ON public.support_tickets USING btree (customer_id, updated_at DESC);


--
-- Name: support_tickets_idempotency_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX support_tickets_idempotency_idx ON public.support_tickets USING btree (customer_id, idempotency_key) WHERE (customer_id IS NOT NULL);


--
-- Name: support_tickets_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_tickets_order_idx ON public.support_tickets USING btree (order_id) WHERE (order_id IS NOT NULL);


--
-- Name: support_tickets_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_tickets_status_idx ON public.support_tickets USING btree (status, updated_at DESC);


--
-- Name: system_reset_one_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX system_reset_one_pending ON public.system_reset_runs USING btree ((true)) WHERE (status = 'cleanup_pending'::text);


--
-- Name: treasury_transactions_employee_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX treasury_transactions_employee_idx ON public.treasury_transactions USING btree (employee_id, salary_period DESC) WHERE (employee_id IS NOT NULL);


--
-- Name: treasury_transactions_paid_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX treasury_transactions_paid_at_idx ON public.treasury_transactions USING btree (paid_at DESC, created_at DESC);


--
-- Name: treasury_transactions_procurement_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX treasury_transactions_procurement_idx ON public.treasury_transactions USING btree (procurement_order_id, created_at DESC) WHERE (procurement_order_id IS NOT NULL);


--
-- Name: treasury_transactions_sales_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX treasury_transactions_sales_idx ON public.treasury_transactions USING btree (sales_order_id, created_at DESC) WHERE (sales_order_id IS NOT NULL);


--
-- Name: product_variants a_erp_inventory_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER a_erp_inventory_guard BEFORE INSERT OR DELETE OR UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.erp_guard_catalog_inventory();


--
-- Name: products a_erp_inventory_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER a_erp_inventory_guard BEFORE INSERT OR DELETE OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.erp_guard_catalog_inventory();


--
-- Name: customer_orders a_erp_order_owner; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER a_erp_order_owner BEFORE INSERT OR UPDATE ON public.customer_orders FOR EACH ROW EXECUTE FUNCTION public.erp_stamp_order_owner();


--
-- Name: commerce_serialized_unit_movements a_erp_owner_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER a_erp_owner_guard BEFORE INSERT ON public.commerce_serialized_unit_movements FOR EACH ROW EXECUTE FUNCTION public.erp_guard_physical_units();


--
-- Name: commerce_serialized_units a_erp_owner_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER a_erp_owner_guard BEFORE INSERT OR DELETE OR UPDATE ON public.commerce_serialized_units FOR EACH ROW EXECUTE FUNCTION public.erp_guard_physical_units();


--
-- Name: customer_orders a_guard_card_order_progress; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER a_guard_card_order_progress BEFORE UPDATE ON public.customer_orders FOR EACH ROW EXECUTE FUNCTION public.guard_card_order_progress();


--
-- Name: order_packing_sessions a_guard_unpaid_card_packing; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER a_guard_unpaid_card_packing BEFORE INSERT ON public.order_packing_sessions FOR EACH ROW EXECUTE FUNCTION public.guard_unpaid_card_packing();


--
-- Name: nps_responses a_nps_responses_enforce_internal_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER a_nps_responses_enforce_internal_identity BEFORE INSERT OR UPDATE ON public.nps_responses FOR EACH ROW EXECUTE FUNCTION public.enforce_nps_response_internal_identity();


--
-- Name: admin_users admin_users_mark_store_analytics_internal; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER admin_users_mark_store_analytics_internal AFTER INSERT ON public.admin_users FOR EACH ROW EXECUTE FUNCTION public.mark_admin_as_store_analytics_internal();


--
-- Name: after_sales_claim_events after_sales_capture_communication; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER after_sales_capture_communication AFTER INSERT ON public.after_sales_claim_events FOR EACH ROW EXECUTE FUNCTION public.after_sales_capture_communication();


--
-- Name: after_sales_claim_events after_sales_claim_events_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER after_sales_claim_events_guard BEFORE INSERT OR DELETE OR UPDATE ON public.after_sales_claim_events FOR EACH ROW EXECUTE FUNCTION public.after_sales_claim_guard();


--
-- Name: after_sales_claim_events after_sales_claim_events_truncate_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER after_sales_claim_events_truncate_guard BEFORE TRUNCATE ON public.after_sales_claim_events FOR EACH STATEMENT EXECUTE FUNCTION public.after_sales_claim_guard();


--
-- Name: after_sales_claim_evidence after_sales_claim_evidence_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER after_sales_claim_evidence_guard BEFORE INSERT OR DELETE OR UPDATE ON public.after_sales_claim_evidence FOR EACH ROW EXECUTE FUNCTION public.after_sales_claim_guard();


--
-- Name: after_sales_claim_evidence after_sales_claim_evidence_truncate_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER after_sales_claim_evidence_truncate_guard BEFORE TRUNCATE ON public.after_sales_claim_evidence FOR EACH STATEMENT EXECUTE FUNCTION public.after_sales_claim_guard();


--
-- Name: after_sales_claim_information after_sales_claim_information_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER after_sales_claim_information_guard BEFORE INSERT OR DELETE OR UPDATE ON public.after_sales_claim_information FOR EACH ROW EXECUTE FUNCTION public.after_sales_claim_guard();


--
-- Name: after_sales_claim_information after_sales_claim_information_truncate_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER after_sales_claim_information_truncate_guard BEFORE TRUNCATE ON public.after_sales_claim_information FOR EACH STATEMENT EXECUTE FUNCTION public.after_sales_claim_guard();


--
-- Name: after_sales_claims after_sales_claims_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER after_sales_claims_guard BEFORE INSERT OR DELETE OR UPDATE ON public.after_sales_claims FOR EACH ROW EXECUTE FUNCTION public.after_sales_claim_guard();


--
-- Name: after_sales_claims after_sales_claims_truncate_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER after_sales_claims_truncate_guard BEFORE TRUNCATE ON public.after_sales_claims FOR EACH STATEMENT EXECUTE FUNCTION public.after_sales_claim_guard();


--
-- Name: after_sales_communication_settings after_sales_communication_settings_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER after_sales_communication_settings_guard BEFORE INSERT OR DELETE OR UPDATE ON public.after_sales_communication_settings FOR EACH ROW EXECUTE FUNCTION public.after_sales_communication_guard();


--
-- Name: after_sales_communication_settings after_sales_communication_settings_truncate_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER after_sales_communication_settings_truncate_guard BEFORE TRUNCATE ON public.after_sales_communication_settings FOR EACH STATEMENT EXECUTE FUNCTION public.after_sales_communication_guard();


--
-- Name: after_sales_communications after_sales_communications_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER after_sales_communications_guard BEFORE INSERT OR DELETE OR UPDATE ON public.after_sales_communications FOR EACH ROW EXECUTE FUNCTION public.after_sales_communication_guard();


--
-- Name: after_sales_communications after_sales_communications_truncate_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER after_sales_communications_truncate_guard BEFORE TRUNCATE ON public.after_sales_communications FOR EACH STATEMENT EXECUTE FUNCTION public.after_sales_communication_guard();


--
-- Name: after_sales_policies after_sales_policy_validation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER after_sales_policy_validation BEFORE INSERT OR UPDATE ON public.after_sales_policies FOR EACH ROW EXECUTE FUNCTION public.after_sales_guard_policy();


--
-- Name: after_sales_policy_versions after_sales_versions_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER after_sales_versions_immutable BEFORE DELETE OR UPDATE ON public.after_sales_policy_versions FOR EACH ROW EXECUTE FUNCTION public.after_sales_immutable_version();


--
-- Name: after_sales_policy_versions after_sales_versions_immutable_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER after_sales_versions_immutable_truncate BEFORE TRUNCATE ON public.after_sales_policy_versions FOR EACH STATEMENT EXECUTE FUNCTION public.after_sales_immutable_version();


--
-- Name: customer_orders capture_order_sms_events; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER capture_order_sms_events AFTER INSERT OR UPDATE OF status, payment_status ON public.customer_orders FOR EACH ROW EXECUTE FUNCTION public.capture_order_sms_events();


--
-- Name: chat_conversations chat_conversations_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER chat_conversations_guard BEFORE INSERT OR UPDATE ON public.chat_conversations FOR EACH ROW EXECUTE FUNCTION public.chat_guard_conversation();


--
-- Name: chat_events chat_events_snapshot; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER chat_events_snapshot BEFORE INSERT ON public.chat_events FOR EACH ROW EXECUTE FUNCTION public.chat_snapshot_event();


--
-- Name: chat_messages chat_messages_validate_actor; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER chat_messages_validate_actor BEFORE INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.chat_validate_message_actor();


--
-- Name: chat_conversations chat_preserve_ticket_order; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER chat_preserve_ticket_order BEFORE UPDATE OF order_id ON public.chat_conversations FOR EACH ROW EXECUTE FUNCTION public.chat_preserve_ticket_order();


--
-- Name: system_reset_runs chat_reset_manifest; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER chat_reset_manifest BEFORE INSERT ON public.system_reset_runs FOR EACH ROW EXECUTE FUNCTION public.chat_reset_manifest();


--
-- Name: chat_conversations chat_set_intake_mode; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER chat_set_intake_mode BEFORE INSERT ON public.chat_conversations FOR EACH ROW EXECUTE FUNCTION public.chat_set_intake_mode();


--
-- Name: chat_settings chat_settings_validate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER chat_settings_validate BEFORE INSERT OR UPDATE ON public.chat_settings FOR EACH ROW EXECUTE FUNCTION public.chat_validate_settings();


--
-- Name: chat_attachments chat_signal_attachment_ready; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER chat_signal_attachment_ready AFTER UPDATE OF is_ready ON public.chat_attachments FOR EACH ROW WHEN (((old.is_ready = false) AND (new.is_ready = true))) EXECUTE FUNCTION public.chat_signal_attachment();


--
-- Name: chat_conversations chat_signal_conversation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER chat_signal_conversation AFTER INSERT OR UPDATE OF customer_id, guest_auth_user_id, contact_name, contact_email, contact_mobile, status, intake_mode, assigned_admin_id, order_id, ticket_id, closed_at, resolution_resolved, satisfaction_rating, resolution_feedback_at, callback_status, callback_mobile, callback_requested_at ON public.chat_conversations FOR EACH ROW EXECUTE FUNCTION public.chat_signal_conversation();


--
-- Name: chat_messages chat_signal_message; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER chat_signal_message AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.chat_signal_message();


--
-- Name: commerce_crm_activities commerce_crm_activities_enforce_transition; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER commerce_crm_activities_enforce_transition BEFORE UPDATE ON public.commerce_crm_activities FOR EACH ROW EXECUTE FUNCTION public.enforce_commerce_crm_activity_transition();


--
-- Name: commerce_order_return_items commerce_order_return_items_validate_product; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER commerce_order_return_items_validate_product BEFORE INSERT OR UPDATE ON public.commerce_order_return_items FOR EACH ROW EXECUTE FUNCTION public.commerce_validate_order_return_item();


--
-- Name: commerce_procurement_items commerce_procurement_items_guard_serialized_receipt; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER commerce_procurement_items_guard_serialized_receipt BEFORE INSERT OR DELETE OR UPDATE ON public.commerce_procurement_items FOR EACH ROW EXECUTE FUNCTION public.commerce_guard_serialized_procurement_item();


--
-- Name: commerce_procurement_orders commerce_procurement_orders_guard_received_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER commerce_procurement_orders_guard_received_identity BEFORE UPDATE ON public.commerce_procurement_orders FOR EACH ROW EXECUTE FUNCTION public.commerce_guard_received_procurement_order();


--
-- Name: commerce_serialized_unit_movements commerce_serialized_movements_immutable_rows; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER commerce_serialized_movements_immutable_rows BEFORE DELETE OR UPDATE ON public.commerce_serialized_unit_movements FOR EACH ROW EXECUTE FUNCTION public.commerce_reject_serialized_movement_mutation();


--
-- Name: commerce_serialized_unit_movements commerce_serialized_movements_immutable_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER commerce_serialized_movements_immutable_truncate BEFORE TRUNCATE ON public.commerce_serialized_unit_movements FOR EACH STATEMENT EXECUTE FUNCTION public.commerce_reject_serialized_movement_mutation();


--
-- Name: commerce_warehouse_inventory commerce_warehouse_inventory_guard_serialized_stock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER commerce_warehouse_inventory_guard_serialized_stock BEFORE INSERT OR DELETE OR UPDATE ON public.commerce_warehouse_inventory FOR EACH ROW EXECUTE FUNCTION public.commerce_reject_serialized_stock_write();


--
-- Name: customer_order_items customer_order_items_guard_after_sales; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customer_order_items_guard_after_sales BEFORE UPDATE ON public.customer_order_items FOR EACH ROW EXECUTE FUNCTION public.after_sales_guard_purchase();


--
-- Name: customer_order_items customer_order_items_guard_warranty; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customer_order_items_guard_warranty BEFORE UPDATE ON public.customer_order_items FOR EACH ROW EXECUTE FUNCTION public.commerce_guard_item_warranty();


--
-- Name: customer_order_items customer_order_items_snapshot_after_sales; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customer_order_items_snapshot_after_sales BEFORE INSERT ON public.customer_order_items FOR EACH ROW EXECUTE FUNCTION public.after_sales_capture_purchase();


--
-- Name: customer_order_items customer_order_items_snapshot_product_sku; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customer_order_items_snapshot_product_sku BEFORE INSERT OR UPDATE OF product_id, product_sku ON public.customer_order_items FOR EACH ROW EXECUTE FUNCTION public.snapshot_customer_order_item_product_sku();


--
-- Name: customer_order_items customer_order_items_snapshot_warranty; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customer_order_items_snapshot_warranty BEFORE INSERT ON public.customer_order_items FOR EACH ROW EXECUTE FUNCTION public.commerce_snapshot_item_warranty();


--
-- Name: customer_order_messages customer_order_messages_validate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customer_order_messages_validate BEFORE INSERT OR UPDATE ON public.customer_order_messages FOR EACH ROW EXECUTE FUNCTION public.validate_customer_order_message();


--
-- Name: customer_orders customer_orders_enqueue_daftra_sync; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customer_orders_enqueue_daftra_sync AFTER INSERT OR UPDATE OF status ON public.customer_orders FOR EACH ROW EXECUTE FUNCTION public.enqueue_daftra_order_sync();


--
-- Name: customer_orders customer_orders_maintain_problem_hold; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customer_orders_maintain_problem_hold BEFORE INSERT OR UPDATE OF status, awaiting_customer_message_id ON public.customer_orders FOR EACH ROW EXECUTE FUNCTION public.maintain_order_problem_hold();


--
-- Name: customer_orders customer_orders_preorder_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customer_orders_preorder_guard BEFORE INSERT OR UPDATE ON public.customer_orders FOR EACH ROW EXECUTE FUNCTION public.preorder_guard_fulfillment();


--
-- Name: customer_orders customer_orders_prepare_payment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customer_orders_prepare_payment BEFORE INSERT ON public.customer_orders FOR EACH ROW EXECUTE FUNCTION public.storefront_prepare_order_payment();


--
-- Name: customer_orders customer_orders_queue_paid_shipping_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customer_orders_queue_paid_shipping_insert AFTER INSERT ON public.customer_orders FOR EACH ROW EXECUTE FUNCTION public.queue_paid_order_for_shipping();


--
-- Name: customer_orders customer_orders_queue_paid_shipping_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customer_orders_queue_paid_shipping_update AFTER UPDATE OF payment_status, shipping_review_status, order_number, first_name, last_name, phone, street_address, city, governorate, preorder_fulfillment_state ON public.customer_orders FOR EACH ROW EXECUTE FUNCTION public.queue_paid_order_for_shipping();


--
-- Name: customer_orders customer_orders_z_preorder_initial_fee; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customer_orders_z_preorder_initial_fee BEFORE INSERT ON public.customer_orders FOR EACH ROW EXECUTE FUNCTION public.preorder_add_initial_payment_fee();


--
-- Name: customer_profiles customer_profiles_enforce_internal_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customer_profiles_enforce_internal_identity BEFORE INSERT OR UPDATE ON public.customer_profiles FOR EACH ROW EXECUTE FUNCTION public.enforce_customer_profile_internal_identity();


--
-- Name: customer_profiles customer_profiles_guard_protected_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customer_profiles_guard_protected_fields BEFORE INSERT OR UPDATE ON public.customer_profiles FOR EACH ROW EXECUTE FUNCTION public.guard_customer_profile_protected_fields();


--
-- Name: email_attempts email_attempts_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER email_attempts_guard BEFORE INSERT OR DELETE OR UPDATE ON public.email_attempts FOR EACH ROW EXECUTE FUNCTION public.email_write_guard();


--
-- Name: email_attempts email_attempts_truncate_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER email_attempts_truncate_guard BEFORE TRUNCATE ON public.email_attempts FOR EACH STATEMENT EXECUTE FUNCTION public.email_write_guard();


--
-- Name: email_events email_events_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER email_events_guard BEFORE INSERT OR DELETE OR UPDATE ON public.email_events FOR EACH ROW EXECUTE FUNCTION public.email_write_guard();


--
-- Name: email_events email_events_truncate_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER email_events_truncate_guard BEFORE TRUNCATE ON public.email_events FOR EACH STATEMENT EXECUTE FUNCTION public.email_write_guard();


--
-- Name: email_messages email_messages_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER email_messages_guard BEFORE INSERT OR DELETE OR UPDATE ON public.email_messages FOR EACH ROW EXECUTE FUNCTION public.email_write_guard();


--
-- Name: email_messages email_messages_truncate_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER email_messages_truncate_guard BEFORE TRUNCATE ON public.email_messages FOR EACH STATEMENT EXECUTE FUNCTION public.email_write_guard();


--
-- Name: email_preferences email_preferences_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER email_preferences_guard BEFORE INSERT OR DELETE OR UPDATE ON public.email_preferences FOR EACH ROW EXECUTE FUNCTION public.email_write_guard();


--
-- Name: email_preferences email_preferences_truncate_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER email_preferences_truncate_guard BEFORE TRUNCATE ON public.email_preferences FOR EACH STATEMENT EXECUTE FUNCTION public.email_write_guard();


--
-- Name: email_provider_settings email_provider_settings_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER email_provider_settings_guard BEFORE INSERT OR DELETE OR UPDATE ON public.email_provider_settings FOR EACH ROW EXECUTE FUNCTION public.email_write_guard();


--
-- Name: email_provider_settings email_provider_settings_truncate_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER email_provider_settings_truncate_guard BEFORE TRUNCATE ON public.email_provider_settings FOR EACH STATEMENT EXECUTE FUNCTION public.email_write_guard();


--
-- Name: email_templates email_templates_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER email_templates_guard BEFORE INSERT OR DELETE OR UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.email_write_guard();


--
-- Name: email_templates email_templates_truncate_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER email_templates_truncate_guard BEFORE TRUNCATE ON public.email_templates FOR EACH STATEMENT EXECUTE FUNCTION public.email_write_guard();


--
-- Name: commerce_crm_accounts erp_owner_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_owner_guard BEFORE INSERT OR DELETE OR UPDATE ON public.commerce_crm_accounts FOR EACH ROW EXECUTE FUNCTION public.erp_guard_supplier();


--
-- Name: commerce_inventory_movements erp_owner_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_owner_guard BEFORE INSERT OR DELETE OR UPDATE ON public.commerce_inventory_movements FOR EACH ROW EXECUTE FUNCTION public.erp_guard_local_mutation();


--
-- Name: commerce_procurement_items erp_owner_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_owner_guard BEFORE INSERT OR DELETE OR UPDATE ON public.commerce_procurement_items FOR EACH ROW EXECUTE FUNCTION public.erp_guard_local_mutation();


--
-- Name: commerce_procurement_orders erp_owner_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_owner_guard BEFORE INSERT OR DELETE OR UPDATE ON public.commerce_procurement_orders FOR EACH ROW EXECUTE FUNCTION public.erp_guard_local_mutation();


--
-- Name: commerce_sales_items erp_owner_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_owner_guard BEFORE INSERT OR DELETE OR UPDATE ON public.commerce_sales_items FOR EACH ROW EXECUTE FUNCTION public.erp_guard_local_mutation();


--
-- Name: commerce_sales_orders erp_owner_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_owner_guard BEFORE INSERT OR DELETE OR UPDATE ON public.commerce_sales_orders FOR EACH ROW EXECUTE FUNCTION public.erp_guard_local_mutation();


--
-- Name: commerce_serialized_inventory_batches erp_owner_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_owner_guard BEFORE INSERT OR DELETE OR UPDATE ON public.commerce_serialized_inventory_batches FOR EACH ROW EXECUTE FUNCTION public.erp_guard_local_mutation();


--
-- Name: commerce_warehouse_inventory erp_owner_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_owner_guard BEFORE INSERT OR DELETE OR UPDATE ON public.commerce_warehouse_inventory FOR EACH ROW EXECUTE FUNCTION public.erp_guard_local_mutation();


--
-- Name: commerce_warehouse_transfer_items erp_owner_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_owner_guard BEFORE INSERT OR DELETE OR UPDATE ON public.commerce_warehouse_transfer_items FOR EACH ROW EXECUTE FUNCTION public.erp_guard_local_mutation();


--
-- Name: commerce_warehouse_transfers erp_owner_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_owner_guard BEFORE INSERT OR DELETE OR UPDATE ON public.commerce_warehouse_transfers FOR EACH ROW EXECUTE FUNCTION public.erp_guard_local_mutation();


--
-- Name: commerce_warehouses erp_owner_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_owner_guard BEFORE INSERT OR DELETE OR UPDATE ON public.commerce_warehouses FOR EACH ROW EXECUTE FUNCTION public.erp_guard_local_mutation();


--
-- Name: hr_employees erp_owner_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_owner_guard BEFORE INSERT OR DELETE OR UPDATE ON public.hr_employees FOR EACH ROW EXECUTE FUNCTION public.erp_guard_local_mutation();


--
-- Name: treasury_transactions erp_owner_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_owner_guard BEFORE INSERT OR DELETE OR UPDATE ON public.treasury_transactions FOR EACH ROW EXECUTE FUNCTION public.erp_guard_local_mutation();


--
-- Name: commerce_inventory_movements erp_owner_truncate_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_owner_truncate_guard BEFORE TRUNCATE ON public.commerce_inventory_movements FOR EACH STATEMENT EXECUTE FUNCTION public.erp_guard_local_mutation();


--
-- Name: commerce_procurement_items erp_owner_truncate_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_owner_truncate_guard BEFORE TRUNCATE ON public.commerce_procurement_items FOR EACH STATEMENT EXECUTE FUNCTION public.erp_guard_local_mutation();


--
-- Name: commerce_procurement_orders erp_owner_truncate_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_owner_truncate_guard BEFORE TRUNCATE ON public.commerce_procurement_orders FOR EACH STATEMENT EXECUTE FUNCTION public.erp_guard_local_mutation();


--
-- Name: commerce_sales_items erp_owner_truncate_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_owner_truncate_guard BEFORE TRUNCATE ON public.commerce_sales_items FOR EACH STATEMENT EXECUTE FUNCTION public.erp_guard_local_mutation();


--
-- Name: commerce_sales_orders erp_owner_truncate_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_owner_truncate_guard BEFORE TRUNCATE ON public.commerce_sales_orders FOR EACH STATEMENT EXECUTE FUNCTION public.erp_guard_local_mutation();


--
-- Name: commerce_serialized_inventory_batches erp_owner_truncate_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_owner_truncate_guard BEFORE TRUNCATE ON public.commerce_serialized_inventory_batches FOR EACH STATEMENT EXECUTE FUNCTION public.erp_guard_local_mutation();


--
-- Name: commerce_warehouse_inventory erp_owner_truncate_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_owner_truncate_guard BEFORE TRUNCATE ON public.commerce_warehouse_inventory FOR EACH STATEMENT EXECUTE FUNCTION public.erp_guard_local_mutation();


--
-- Name: commerce_warehouse_transfer_items erp_owner_truncate_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_owner_truncate_guard BEFORE TRUNCATE ON public.commerce_warehouse_transfer_items FOR EACH STATEMENT EXECUTE FUNCTION public.erp_guard_local_mutation();


--
-- Name: commerce_warehouse_transfers erp_owner_truncate_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_owner_truncate_guard BEFORE TRUNCATE ON public.commerce_warehouse_transfers FOR EACH STATEMENT EXECUTE FUNCTION public.erp_guard_local_mutation();


--
-- Name: commerce_warehouses erp_owner_truncate_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_owner_truncate_guard BEFORE TRUNCATE ON public.commerce_warehouses FOR EACH STATEMENT EXECUTE FUNCTION public.erp_guard_local_mutation();


--
-- Name: hr_employees erp_owner_truncate_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_owner_truncate_guard BEFORE TRUNCATE ON public.hr_employees FOR EACH STATEMENT EXECUTE FUNCTION public.erp_guard_local_mutation();


--
-- Name: treasury_transactions erp_owner_truncate_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_owner_truncate_guard BEFORE TRUNCATE ON public.treasury_transactions FOR EACH STATEMENT EXECUTE FUNCTION public.erp_guard_local_mutation();


--
-- Name: commerce_order_returns erp_return_state_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_return_state_guard BEFORE INSERT OR DELETE OR UPDATE ON public.commerce_order_returns FOR EACH ROW EXECUTE FUNCTION public.erp_guard_return_state();


--
-- Name: site_settings erp_state_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_state_guard BEFORE INSERT OR DELETE OR UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.erp_guard_provider_state();


--
-- Name: site_settings erp_state_truncate_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER erp_state_truncate_guard BEFORE TRUNCATE ON public.site_settings FOR EACH STATEMENT EXECUTE FUNCTION public.erp_guard_local_mutation();


--
-- Name: help_articles help_articles_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER help_articles_touch BEFORE UPDATE ON public.help_articles FOR EACH ROW EXECUTE FUNCTION public.support_touch_updated_at();


--
-- Name: help_categories help_categories_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER help_categories_touch BEFORE UPDATE ON public.help_categories FOR EACH ROW EXECUTE FUNCTION public.support_touch_updated_at();


--
-- Name: nps_responses nps_responses_enforce_cooldown; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER nps_responses_enforce_cooldown BEFORE INSERT ON public.nps_responses FOR EACH ROW EXECUTE FUNCTION public.enforce_nps_response_cooldown();


--
-- Name: order_packing_scans order_packing_scans_guard_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER order_packing_scans_guard_mutation BEFORE DELETE OR UPDATE ON public.order_packing_scans FOR EACH ROW EXECUTE FUNCTION public.guard_order_packing_scan_mutation();


--
-- Name: order_packing_scans order_packing_scans_validate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER order_packing_scans_validate BEFORE INSERT ON public.order_packing_scans FOR EACH ROW EXECUTE FUNCTION public.validate_order_packing_scan();


--
-- Name: order_packing_sessions order_packing_sessions_guard_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER order_packing_sessions_guard_mutation BEFORE DELETE OR UPDATE ON public.order_packing_sessions FOR EACH ROW EXECUTE FUNCTION public.guard_order_packing_session_mutation();


--
-- Name: order_packing_sessions order_packing_sessions_preorder_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER order_packing_sessions_preorder_guard BEFORE INSERT ON public.order_packing_sessions FOR EACH ROW EXECUTE FUNCTION public.preorder_guard_packing();


--
-- Name: order_packing_sessions order_packing_sessions_require_video; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER order_packing_sessions_require_video BEFORE UPDATE OF status ON public.order_packing_sessions FOR EACH ROW EXECUTE FUNCTION public.require_order_packing_video();


--
-- Name: order_packing_sessions order_packing_sessions_require_work_session; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER order_packing_sessions_require_work_session BEFORE INSERT OR UPDATE OF work_session_id, status ON public.order_packing_sessions FOR EACH ROW EXECUTE FUNCTION public.require_order_packing_work_session();


--
-- Name: order_packing_sessions order_packing_sessions_validate_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER order_packing_sessions_validate_insert BEFORE INSERT ON public.order_packing_sessions FOR EACH ROW EXECUTE FUNCTION public.validate_order_packing_session_insert();


--
-- Name: order_packing_work_sessions order_packing_work_sessions_validate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER order_packing_work_sessions_validate BEFORE DELETE OR UPDATE ON public.order_packing_work_sessions FOR EACH ROW EXECUTE FUNCTION public.validate_order_packing_work_session();


--
-- Name: product_images product_images_validate_variant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER product_images_validate_variant BEFORE INSERT OR UPDATE ON public.product_images FOR EACH ROW EXECUTE FUNCTION public.commerce_validate_product_image_variant();


--
-- Name: product_reviews product_reviews_enforce_account_eligibility; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER product_reviews_enforce_account_eligibility BEFORE INSERT ON public.product_reviews FOR EACH ROW EXECUTE FUNCTION public.enforce_product_review_account_eligibility();


--
-- Name: product_reviews product_reviews_sync_average_rating; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER product_reviews_sync_average_rating AFTER INSERT OR DELETE OR UPDATE OF rating, product_id ON public.product_reviews FOR EACH ROW EXECUTE FUNCTION public.sync_product_average_rating();


--
-- Name: product_variants product_variants_guard_inventory_cost_projection; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER product_variants_guard_inventory_cost_projection BEFORE INSERT OR UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.commerce_guard_inventory_cost_projection();


--
-- Name: product_variants product_variants_guard_serialized_stock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER product_variants_guard_serialized_stock BEFORE INSERT OR UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.commerce_reject_serialized_stock_write();


--
-- Name: product_variants product_variants_keep_image_reference_active; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER product_variants_keep_image_reference_active AFTER UPDATE OF is_active ON public.product_variants DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.commerce_keep_image_variant_active();


--
-- Name: product_variants product_variants_require_active_reference; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER product_variants_require_active_reference AFTER INSERT OR DELETE OR UPDATE ON public.product_variants DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.commerce_require_active_product_variant();


--
-- Name: products products_create_default_variant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER products_create_default_variant AFTER INSERT ON public.products FOR EACH ROW EXECUTE FUNCTION public.commerce_create_default_product_variant();


--
-- Name: products products_guard_inventory_cost_projection; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER products_guard_inventory_cost_projection BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.commerce_guard_inventory_cost_projection();


--
-- Name: products products_guard_serialized_stock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER products_guard_serialized_stock BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.commerce_reject_serialized_stock_write();


--
-- Name: site_settings quick_setup_application; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_application AFTER INSERT OR DELETE OR UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.quick_setup_configuration_changed('application', 'key', 'key', 'default');


--
-- Name: site_settings quick_setup_authentication; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_authentication AFTER INSERT OR DELETE OR UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.quick_setup_configuration_changed('authentication', 'auth_facebook_enabled', 'key', 'default');


--
-- Name: after_sales_communication_settings quick_setup_automation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_automation AFTER INSERT OR DELETE OR UPDATE ON public.after_sales_communication_settings FOR EACH ROW EXECUTE FUNCTION public.quick_setup_configuration_changed('automation', '*');


--
-- Name: email_templates quick_setup_automation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_automation AFTER INSERT OR DELETE OR UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.quick_setup_configuration_changed('automation', '*');


--
-- Name: sms_order_event_settings quick_setup_automation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_automation AFTER INSERT OR DELETE OR UPDATE ON public.sms_order_event_settings FOR EACH ROW EXECUTE FUNCTION public.quick_setup_configuration_changed('automation', '*');


--
-- Name: sms_templates quick_setup_automation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_automation AFTER INSERT OR DELETE OR UPDATE ON public.sms_templates FOR EACH ROW EXECUTE FUNCTION public.quick_setup_configuration_changed('automation', '*');


--
-- Name: site_settings quick_setup_branding; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_branding AFTER INSERT OR DELETE OR UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.quick_setup_configuration_changed('branding', 'site_name,site_logo_url', 'key', 'default');


--
-- Name: email_provider_settings quick_setup_brevo; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_brevo AFTER INSERT OR DELETE OR UPDATE ON public.email_provider_settings FOR EACH ROW EXECUTE FUNCTION public.quick_setup_configuration_changed('brevo', '*', 'id', 'brevo');


--
-- Name: site_settings quick_setup_contact; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_contact AFTER INSERT OR DELETE OR UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.quick_setup_configuration_changed('contact', 'footer_email,footer_phone,footer_address', 'key', 'default');


--
-- Name: erp_provider_settings quick_setup_daftra; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_daftra AFTER INSERT OR DELETE OR UPDATE ON public.erp_provider_settings FOR EACH ROW EXECUTE FUNCTION public.quick_setup_configuration_changed('daftra', '*', 'id', 'daftra');


--
-- Name: site_settings quick_setup_daftra; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_daftra AFTER INSERT OR DELETE OR UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.quick_setup_configuration_changed('daftra', 'erp_mode,erp_state_version,daftra_connection_status,daftra_last_checked_at,daftra_tested_revision', 'key', 'default');


--
-- Name: chat_settings quick_setup_live_chat; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_live_chat AFTER INSERT OR DELETE OR UPDATE ON public.chat_settings FOR EACH ROW EXECUTE FUNCTION public.quick_setup_configuration_changed('live_chat', '*');


--
-- Name: site_settings quick_setup_oauth; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_oauth AFTER INSERT OR DELETE OR UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.quick_setup_configuration_changed('oauth', 'auth_facebook_enabled', 'key', 'default');


--
-- Name: site_settings quick_setup_payment_methods; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_payment_methods AFTER INSERT OR DELETE OR UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.quick_setup_configuration_changed('payment_methods', 'prefix:payment_', 'key', 'default');


--
-- Name: site_settings quick_setup_paypal; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_paypal AFTER INSERT OR DELETE OR UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.quick_setup_configuration_changed('paypal', 'payment_paypal_enabled', 'key', 'default');


--
-- Name: after_sales_policies quick_setup_policies; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_policies AFTER INSERT OR DELETE OR UPDATE ON public.after_sales_policies FOR EACH ROW EXECUTE FUNCTION public.quick_setup_configuration_changed('policies', '*');


--
-- Name: after_sales_return_reasons quick_setup_policies; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_policies AFTER INSERT OR DELETE OR UPDATE ON public.after_sales_return_reasons FOR EACH ROW EXECUTE FUNCTION public.quick_setup_configuration_changed('policies', '*');


--
-- Name: system_reset_runs quick_setup_reset_invalidation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_reset_invalidation AFTER INSERT ON public.system_reset_runs FOR EACH ROW EXECUTE FUNCTION public.quick_setup_reset_invalidation();


--
-- Name: commerce_shipping_companies quick_setup_shipping; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_shipping AFTER INSERT OR DELETE OR UPDATE ON public.commerce_shipping_companies FOR EACH ROW EXECUTE FUNCTION public.quick_setup_configuration_changed('shipping', '*');


--
-- Name: shipping_city_mappings quick_setup_shipping; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_shipping AFTER INSERT OR DELETE OR UPDATE ON public.shipping_city_mappings FOR EACH ROW EXECUTE FUNCTION public.quick_setup_configuration_changed('shipping', '*');


--
-- Name: shipping_provider_settings quick_setup_shipping; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_shipping AFTER INSERT OR DELETE OR UPDATE ON public.shipping_provider_settings FOR EACH ROW EXECUTE FUNCTION public.quick_setup_configuration_changed('shipping', '*', 'id', 'pdc');


--
-- Name: shipping_status_mappings quick_setup_shipping; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_shipping AFTER INSERT OR DELETE OR UPDATE ON public.shipping_status_mappings FOR EACH ROW EXECUTE FUNCTION public.quick_setup_configuration_changed('shipping', '*');


--
-- Name: site_settings quick_setup_truncate_application; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_truncate_application AFTER TRUNCATE ON public.site_settings FOR EACH STATEMENT EXECUTE FUNCTION public.quick_setup_configuration_changed('application', 'key');


--
-- Name: site_settings quick_setup_truncate_authentication; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_truncate_authentication AFTER TRUNCATE ON public.site_settings FOR EACH STATEMENT EXECUTE FUNCTION public.quick_setup_configuration_changed('authentication', 'auth_facebook_enabled');


--
-- Name: after_sales_communication_settings quick_setup_truncate_automation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_truncate_automation AFTER TRUNCATE ON public.after_sales_communication_settings FOR EACH STATEMENT EXECUTE FUNCTION public.quick_setup_configuration_changed('automation', '*');


--
-- Name: email_templates quick_setup_truncate_automation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_truncate_automation AFTER TRUNCATE ON public.email_templates FOR EACH STATEMENT EXECUTE FUNCTION public.quick_setup_configuration_changed('automation', '*');


--
-- Name: sms_order_event_settings quick_setup_truncate_automation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_truncate_automation AFTER TRUNCATE ON public.sms_order_event_settings FOR EACH STATEMENT EXECUTE FUNCTION public.quick_setup_configuration_changed('automation', '*');


--
-- Name: sms_templates quick_setup_truncate_automation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_truncate_automation AFTER TRUNCATE ON public.sms_templates FOR EACH STATEMENT EXECUTE FUNCTION public.quick_setup_configuration_changed('automation', '*');


--
-- Name: site_settings quick_setup_truncate_branding; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_truncate_branding AFTER TRUNCATE ON public.site_settings FOR EACH STATEMENT EXECUTE FUNCTION public.quick_setup_configuration_changed('branding', 'site_name,site_logo_url');


--
-- Name: email_provider_settings quick_setup_truncate_brevo; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_truncate_brevo AFTER TRUNCATE ON public.email_provider_settings FOR EACH STATEMENT EXECUTE FUNCTION public.quick_setup_configuration_changed('brevo', '*');


--
-- Name: site_settings quick_setup_truncate_contact; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_truncate_contact AFTER TRUNCATE ON public.site_settings FOR EACH STATEMENT EXECUTE FUNCTION public.quick_setup_configuration_changed('contact', 'footer_email,footer_phone,footer_address');


--
-- Name: erp_provider_settings quick_setup_truncate_daftra; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_truncate_daftra AFTER TRUNCATE ON public.erp_provider_settings FOR EACH STATEMENT EXECUTE FUNCTION public.quick_setup_configuration_changed('daftra', '*');


--
-- Name: site_settings quick_setup_truncate_daftra; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_truncate_daftra AFTER TRUNCATE ON public.site_settings FOR EACH STATEMENT EXECUTE FUNCTION public.quick_setup_configuration_changed('daftra', 'erp_mode,erp_state_version,daftra_connection_status,daftra_last_checked_at,daftra_tested_revision');


--
-- Name: chat_settings quick_setup_truncate_live_chat; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_truncate_live_chat AFTER TRUNCATE ON public.chat_settings FOR EACH STATEMENT EXECUTE FUNCTION public.quick_setup_configuration_changed('live_chat', '*');


--
-- Name: site_settings quick_setup_truncate_oauth; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_truncate_oauth AFTER TRUNCATE ON public.site_settings FOR EACH STATEMENT EXECUTE FUNCTION public.quick_setup_configuration_changed('oauth', 'auth_facebook_enabled');


--
-- Name: site_settings quick_setup_truncate_payment_methods; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_truncate_payment_methods AFTER TRUNCATE ON public.site_settings FOR EACH STATEMENT EXECUTE FUNCTION public.quick_setup_configuration_changed('payment_methods', 'prefix:payment_');


--
-- Name: site_settings quick_setup_truncate_paypal; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_truncate_paypal AFTER TRUNCATE ON public.site_settings FOR EACH STATEMENT EXECUTE FUNCTION public.quick_setup_configuration_changed('paypal', 'payment_paypal_enabled');


--
-- Name: after_sales_policies quick_setup_truncate_policies; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_truncate_policies AFTER TRUNCATE ON public.after_sales_policies FOR EACH STATEMENT EXECUTE FUNCTION public.quick_setup_configuration_changed('policies', '*');


--
-- Name: after_sales_return_reasons quick_setup_truncate_policies; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_truncate_policies AFTER TRUNCATE ON public.after_sales_return_reasons FOR EACH STATEMENT EXECUTE FUNCTION public.quick_setup_configuration_changed('policies', '*');


--
-- Name: commerce_shipping_companies quick_setup_truncate_shipping; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_truncate_shipping AFTER TRUNCATE ON public.commerce_shipping_companies FOR EACH STATEMENT EXECUTE FUNCTION public.quick_setup_configuration_changed('shipping', '*');


--
-- Name: shipping_city_mappings quick_setup_truncate_shipping; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_truncate_shipping AFTER TRUNCATE ON public.shipping_city_mappings FOR EACH STATEMENT EXECUTE FUNCTION public.quick_setup_configuration_changed('shipping', '*');


--
-- Name: shipping_provider_settings quick_setup_truncate_shipping; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_truncate_shipping AFTER TRUNCATE ON public.shipping_provider_settings FOR EACH STATEMENT EXECUTE FUNCTION public.quick_setup_configuration_changed('shipping', '*');


--
-- Name: shipping_status_mappings quick_setup_truncate_shipping; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_truncate_shipping AFTER TRUNCATE ON public.shipping_status_mappings FOR EACH STATEMENT EXECUTE FUNCTION public.quick_setup_configuration_changed('shipping', '*');


--
-- Name: sms_provider_settings quick_setup_truncate_vodafone; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_truncate_vodafone AFTER TRUNCATE ON public.sms_provider_settings FOR EACH STATEMENT EXECUTE FUNCTION public.quick_setup_configuration_changed('vodafone', '*');


--
-- Name: sms_provider_settings quick_setup_vodafone; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_vodafone AFTER INSERT OR DELETE OR UPDATE ON public.sms_provider_settings FOR EACH ROW EXECUTE FUNCTION public.quick_setup_configuration_changed('vodafone', '*', 'id', 'vodafone');


--
-- Name: quick_setup_events quick_setup_write_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_write_guard BEFORE INSERT OR DELETE OR UPDATE ON public.quick_setup_events FOR EACH ROW EXECUTE FUNCTION public.quick_setup_guard_write();


--
-- Name: quick_setup_revisions quick_setup_write_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_write_guard BEFORE INSERT OR DELETE OR UPDATE ON public.quick_setup_revisions FOR EACH ROW EXECUTE FUNCTION public.quick_setup_guard_write();


--
-- Name: quick_setup_state quick_setup_write_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER quick_setup_write_guard BEFORE INSERT OR DELETE OR UPDATE ON public.quick_setup_state FOR EACH ROW EXECUTE FUNCTION public.quick_setup_guard_write();


--
-- Name: shipping_webhook_events shipping_claim_event_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER shipping_claim_event_guard BEFORE INSERT OR DELETE OR UPDATE ON public.shipping_webhook_events FOR EACH ROW EXECUTE FUNCTION public.shipping_claim_event_guard();


--
-- Name: shipping_webhook_events shipping_claim_event_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER shipping_claim_event_truncate BEFORE TRUNCATE ON public.shipping_webhook_events FOR EACH STATEMENT EXECUTE FUNCTION public.shipping_claim_event_guard();


--
-- Name: shipping_claim_jobs shipping_claim_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER shipping_claim_guard BEFORE INSERT OR DELETE OR UPDATE ON public.shipping_claim_jobs FOR EACH ROW EXECUTE FUNCTION public.shipping_claim_guard();


--
-- Name: shipping_claim_jobs shipping_claim_identity_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER shipping_claim_identity_guard BEFORE INSERT OR UPDATE OF awb ON public.shipping_claim_jobs FOR EACH ROW EXECUTE FUNCTION public.shipping_pdc_identity_guard();


--
-- Name: shipping_claim_jobs shipping_claim_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER shipping_claim_truncate BEFORE TRUNCATE ON public.shipping_claim_jobs FOR EACH STATEMENT EXECUTE FUNCTION public.shipping_claim_guard();


--
-- Name: shipping_order_jobs shipping_order_jobs_preorder_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER shipping_order_jobs_preorder_guard BEFORE INSERT OR UPDATE ON public.shipping_order_jobs FOR EACH ROW EXECUTE FUNCTION public.preorder_guard_shipping_job();


--
-- Name: shipping_order_jobs shipping_order_purpose_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER shipping_order_purpose_guard BEFORE INSERT OR UPDATE OF to_ref, awb ON public.shipping_order_jobs FOR EACH ROW EXECUTE FUNCTION public.shipping_pdc_identity_guard();


--
-- Name: sms_order_event_settings sms_order_setting_revision; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sms_order_setting_revision BEFORE UPDATE ON public.sms_order_event_settings FOR EACH ROW EXECUTE FUNCTION public.sms_order_setting_revision();


--
-- Name: customer_orders sms_snapshot_order_locale; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sms_snapshot_order_locale BEFORE INSERT ON public.customer_orders FOR EACH ROW EXECUTE FUNCTION public.sms_snapshot_order_locale();


--
-- Name: store_analytics_internal_carts store_analytics_internal_carts_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER store_analytics_internal_carts_immutable BEFORE DELETE OR UPDATE ON public.store_analytics_internal_carts FOR EACH ROW EXECUTE FUNCTION public.prevent_store_analytics_ledger_mutation();


--
-- Name: store_analytics_internal_users store_analytics_internal_user_apply; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER store_analytics_internal_user_apply AFTER INSERT ON public.store_analytics_internal_users FOR EACH ROW EXECUTE FUNCTION public.apply_store_analytics_internal_user();


--
-- Name: store_analytics_internal_users store_analytics_internal_users_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER store_analytics_internal_users_immutable BEFORE DELETE OR UPDATE ON public.store_analytics_internal_users FOR EACH ROW EXECUTE FUNCTION public.prevent_store_analytics_ledger_mutation();


--
-- Name: store_analytics_internal_users store_analytics_internal_users_serialize_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER store_analytics_internal_users_serialize_insert BEFORE INSERT ON public.store_analytics_internal_users FOR EACH ROW EXECUTE FUNCTION public.serialize_store_analytics_internal_user_insert();


--
-- Name: store_analytics_sessions store_analytics_sessions_enforce_internal_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER store_analytics_sessions_enforce_internal_identity BEFORE INSERT OR UPDATE OF user_id, is_internal ON public.store_analytics_sessions FOR EACH ROW EXECUTE FUNCTION public.enforce_store_analytics_session_internal_identity();


--
-- Name: system_reset_runs support_reset_manifest; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER support_reset_manifest BEFORE INSERT ON public.system_reset_runs FOR EACH ROW EXECUTE FUNCTION public.support_reset_manifest();


--
-- Name: support_tickets support_ticket_audit_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER support_ticket_audit_update AFTER UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.support_ticket_audit_update();


--
-- Name: support_tickets support_ticket_before_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER support_ticket_before_update BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.support_ticket_before_update();


--
-- Name: support_ticket_events support_ticket_events_snapshot; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER support_ticket_events_snapshot BEFORE INSERT ON public.support_ticket_events FOR EACH ROW EXECUTE FUNCTION public.support_ticket_snapshot_actor();


--
-- Name: commerce_warehouse_inventory warehouse_inventory_guard_cost_projection; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER warehouse_inventory_guard_cost_projection BEFORE INSERT OR UPDATE ON public.commerce_warehouse_inventory FOR EACH ROW EXECUTE FUNCTION public.commerce_guard_inventory_cost_projection();


--
-- Name: admin_activity_logs admin_activity_logs_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_activity_logs
    ADD CONSTRAINT admin_activity_logs_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: admin_users admin_users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: after_sales_claim_events after_sales_claim_events_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_claim_events
    ADD CONSTRAINT after_sales_claim_events_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.after_sales_claims(id) ON DELETE RESTRICT;


--
-- Name: after_sales_claim_evidence after_sales_claim_evidence_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_claim_evidence
    ADD CONSTRAINT after_sales_claim_evidence_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.after_sales_claims(id) ON DELETE RESTRICT;


--
-- Name: after_sales_claim_evidence after_sales_claim_evidence_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_claim_evidence
    ADD CONSTRAINT after_sales_claim_evidence_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer_profiles(id) ON DELETE RESTRICT;


--
-- Name: after_sales_claim_evidence after_sales_claim_evidence_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_claim_evidence
    ADD CONSTRAINT after_sales_claim_evidence_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.customer_order_items(id) ON DELETE RESTRICT;


--
-- Name: after_sales_claim_evidence after_sales_claim_evidence_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_claim_evidence
    ADD CONSTRAINT after_sales_claim_evidence_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.after_sales_claim_information(id) ON DELETE RESTRICT;


--
-- Name: after_sales_claim_evidence after_sales_claim_evidence_target_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_claim_evidence
    ADD CONSTRAINT after_sales_claim_evidence_target_claim_id_fkey FOREIGN KEY (target_claim_id) REFERENCES public.after_sales_claims(id) ON DELETE RESTRICT;


--
-- Name: after_sales_claim_information after_sales_claim_information_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_claim_information
    ADD CONSTRAINT after_sales_claim_information_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.after_sales_claims(id) ON DELETE RESTRICT;


--
-- Name: after_sales_claim_information after_sales_claim_information_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_claim_information
    ADD CONSTRAINT after_sales_claim_information_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.admin_users(id) ON DELETE RESTRICT;


--
-- Name: after_sales_claims after_sales_claims_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_claims
    ADD CONSTRAINT after_sales_claims_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer_profiles(id) ON DELETE RESTRICT;


--
-- Name: after_sales_claims after_sales_claims_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_claims
    ADD CONSTRAINT after_sales_claims_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.customer_order_items(id) ON DELETE RESTRICT;


--
-- Name: after_sales_claims after_sales_claims_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_claims
    ADD CONSTRAINT after_sales_claims_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.customer_orders(id) ON DELETE RESTRICT;


--
-- Name: after_sales_claims after_sales_claims_policy_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_claims
    ADD CONSTRAINT after_sales_claims_policy_version_id_fkey FOREIGN KEY (policy_version_id) REFERENCES public.after_sales_policy_versions(id) ON DELETE RESTRICT;


--
-- Name: after_sales_claims after_sales_claims_serial_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_claims
    ADD CONSTRAINT after_sales_claims_serial_verified_by_fkey FOREIGN KEY (serial_verified_by) REFERENCES public.admin_users(id) ON DELETE RESTRICT;


--
-- Name: after_sales_communication_settings after_sales_communication_settings_email_template_ar_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_communication_settings
    ADD CONSTRAINT after_sales_communication_settings_email_template_ar_fkey FOREIGN KEY (email_template_ar) REFERENCES public.email_templates(key) ON DELETE RESTRICT;


--
-- Name: after_sales_communication_settings after_sales_communication_settings_email_template_en_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_communication_settings
    ADD CONSTRAINT after_sales_communication_settings_email_template_en_fkey FOREIGN KEY (email_template_en) REFERENCES public.email_templates(key) ON DELETE RESTRICT;


--
-- Name: after_sales_communication_settings after_sales_communication_settings_sms_template_ar_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_communication_settings
    ADD CONSTRAINT after_sales_communication_settings_sms_template_ar_fkey FOREIGN KEY (sms_template_ar) REFERENCES public.sms_templates(id) ON DELETE RESTRICT;


--
-- Name: after_sales_communication_settings after_sales_communication_settings_sms_template_en_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_communication_settings
    ADD CONSTRAINT after_sales_communication_settings_sms_template_en_fkey FOREIGN KEY (sms_template_en) REFERENCES public.sms_templates(id) ON DELETE RESTRICT;


--
-- Name: after_sales_communication_settings after_sales_communication_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_communication_settings
    ADD CONSTRAINT after_sales_communication_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.admin_users(id) ON DELETE RESTRICT;


--
-- Name: after_sales_communications after_sales_communications_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_communications
    ADD CONSTRAINT after_sales_communications_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.after_sales_claims(id) ON DELETE RESTRICT;


--
-- Name: after_sales_communications after_sales_communications_email_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_communications
    ADD CONSTRAINT after_sales_communications_email_message_id_fkey FOREIGN KEY (email_message_id) REFERENCES public.email_messages(id) ON DELETE RESTRICT;


--
-- Name: after_sales_communications after_sales_communications_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_communications
    ADD CONSTRAINT after_sales_communications_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.after_sales_claim_events(id) ON DELETE RESTRICT;


--
-- Name: after_sales_communications after_sales_communications_information_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_communications
    ADD CONSTRAINT after_sales_communications_information_id_fkey FOREIGN KEY (information_id) REFERENCES public.after_sales_claim_information(id) ON DELETE RESTRICT;


--
-- Name: after_sales_communications after_sales_communications_purpose_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_communications
    ADD CONSTRAINT after_sales_communications_purpose_fkey FOREIGN KEY (purpose) REFERENCES public.after_sales_communication_settings(purpose) ON DELETE RESTRICT;


--
-- Name: after_sales_communications after_sales_communications_shipment_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_communications
    ADD CONSTRAINT after_sales_communications_shipment_job_id_fkey FOREIGN KEY (shipment_job_id) REFERENCES public.shipping_claim_jobs(id) ON DELETE RESTRICT;


--
-- Name: after_sales_communications after_sales_communications_sms_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_communications
    ADD CONSTRAINT after_sales_communications_sms_batch_id_fkey FOREIGN KEY (sms_batch_id) REFERENCES public.sms_batches(id) ON DELETE RESTRICT;


--
-- Name: after_sales_policies after_sales_policies_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_policies
    ADD CONSTRAINT after_sales_policies_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: after_sales_policies after_sales_policies_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_policies
    ADD CONSTRAINT after_sales_policies_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: after_sales_policies after_sales_policies_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.after_sales_policies
    ADD CONSTRAINT after_sales_policies_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: category_specification_templates category_specification_templates_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_specification_templates
    ADD CONSTRAINT category_specification_templates_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: category_specification_templates category_specification_templates_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_specification_templates
    ADD CONSTRAINT category_specification_templates_definition_id_fkey FOREIGN KEY (definition_id) REFERENCES public.specification_definitions(id) ON DELETE CASCADE;


--
-- Name: chat_agent_availability chat_agent_availability_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_agent_availability
    ADD CONSTRAINT chat_agent_availability_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admin_users(id) ON DELETE CASCADE;


--
-- Name: chat_attachments chat_attachments_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_attachments
    ADD CONSTRAINT chat_attachments_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.chat_conversations(id) ON DELETE CASCADE;


--
-- Name: chat_attachments chat_attachments_message_id_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_attachments
    ADD CONSTRAINT chat_attachments_message_id_conversation_id_fkey FOREIGN KEY (message_id, conversation_id) REFERENCES public.chat_messages(id, conversation_id) ON DELETE CASCADE;


--
-- Name: chat_attachments chat_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_attachments
    ADD CONSTRAINT chat_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: chat_conversations chat_conversations_assigned_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_assigned_admin_id_fkey FOREIGN KEY (assigned_admin_id) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: chat_conversations chat_conversations_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: chat_conversations chat_conversations_guest_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_guest_auth_user_id_fkey FOREIGN KEY (guest_auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: chat_conversations chat_conversations_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.customer_orders(id) ON DELETE SET NULL;


--
-- Name: chat_conversations chat_conversations_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE SET NULL;


--
-- Name: chat_events chat_events_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_events
    ADD CONSTRAINT chat_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: chat_events chat_events_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_events
    ADD CONSTRAINT chat_events_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.chat_conversations(id) ON DELETE CASCADE;


--
-- Name: chat_events chat_events_related_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_events
    ADD CONSTRAINT chat_events_related_message_id_fkey FOREIGN KEY (related_message_id) REFERENCES public.chat_messages(id) ON DELETE SET NULL;


--
-- Name: chat_messages chat_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.chat_conversations(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: chat_read_state chat_read_state_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_read_state
    ADD CONSTRAINT chat_read_state_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chat_read_state chat_read_state_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_read_state
    ADD CONSTRAINT chat_read_state_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.chat_conversations(id) ON DELETE CASCADE;


--
-- Name: chat_settings chat_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_settings
    ADD CONSTRAINT chat_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: commerce_crm_activities commerce_crm_activities_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_crm_activities
    ADD CONSTRAINT commerce_crm_activities_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: commerce_crm_activities commerce_crm_activities_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_crm_activities
    ADD CONSTRAINT commerce_crm_activities_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: commerce_crm_activities commerce_crm_activities_crm_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_crm_activities
    ADD CONSTRAINT commerce_crm_activities_crm_account_id_fkey FOREIGN KEY (crm_account_id) REFERENCES public.commerce_crm_accounts(id) ON DELETE RESTRICT;


--
-- Name: commerce_inventory_movements commerce_inventory_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_inventory_movements
    ADD CONSTRAINT commerce_inventory_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: commerce_inventory_movements commerce_inventory_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_inventory_movements
    ADD CONSTRAINT commerce_inventory_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: commerce_inventory_movements commerce_inventory_movements_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_inventory_movements
    ADD CONSTRAINT commerce_inventory_movements_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.commerce_warehouses(id) ON DELETE CASCADE;


--
-- Name: commerce_order_return_items commerce_order_return_items_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_order_return_items
    ADD CONSTRAINT commerce_order_return_items_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.customer_order_items(id) ON DELETE SET NULL;


--
-- Name: commerce_order_return_items commerce_order_return_items_order_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_order_return_items
    ADD CONSTRAINT commerce_order_return_items_order_return_id_fkey FOREIGN KEY (order_return_id) REFERENCES public.commerce_order_returns(id) ON DELETE CASCADE;


--
-- Name: commerce_order_return_items commerce_order_return_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_order_return_items
    ADD CONSTRAINT commerce_order_return_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: commerce_order_return_items commerce_order_return_items_serialized_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_order_return_items
    ADD CONSTRAINT commerce_order_return_items_serialized_unit_id_fkey FOREIGN KEY (serialized_unit_id) REFERENCES public.commerce_serialized_units(id) ON DELETE RESTRICT;


--
-- Name: commerce_order_return_items commerce_order_return_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_order_return_items
    ADD CONSTRAINT commerce_order_return_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;


--
-- Name: commerce_order_returns commerce_order_returns_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_order_returns
    ADD CONSTRAINT commerce_order_returns_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: commerce_order_returns commerce_order_returns_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_order_returns
    ADD CONSTRAINT commerce_order_returns_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.customer_orders(id) ON DELETE RESTRICT;


--
-- Name: commerce_order_returns commerce_order_returns_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_order_returns
    ADD CONSTRAINT commerce_order_returns_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.commerce_warehouses(id) ON DELETE RESTRICT;


--
-- Name: commerce_procurement_items commerce_procurement_items_procurement_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_procurement_items
    ADD CONSTRAINT commerce_procurement_items_procurement_order_id_fkey FOREIGN KEY (procurement_order_id) REFERENCES public.commerce_procurement_orders(id) ON DELETE CASCADE;


--
-- Name: commerce_procurement_items commerce_procurement_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_procurement_items
    ADD CONSTRAINT commerce_procurement_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: commerce_procurement_items commerce_procurement_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_procurement_items
    ADD CONSTRAINT commerce_procurement_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE RESTRICT;


--
-- Name: commerce_procurement_orders commerce_procurement_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_procurement_orders
    ADD CONSTRAINT commerce_procurement_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: commerce_procurement_orders commerce_procurement_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_procurement_orders
    ADD CONSTRAINT commerce_procurement_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.commerce_crm_accounts(id) ON DELETE RESTRICT;


--
-- Name: commerce_procurement_orders commerce_procurement_orders_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_procurement_orders
    ADD CONSTRAINT commerce_procurement_orders_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.commerce_warehouses(id) ON DELETE RESTRICT;


--
-- Name: commerce_sales_items commerce_sales_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_sales_items
    ADD CONSTRAINT commerce_sales_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: commerce_sales_items commerce_sales_items_sales_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_sales_items
    ADD CONSTRAINT commerce_sales_items_sales_order_id_fkey FOREIGN KEY (sales_order_id) REFERENCES public.commerce_sales_orders(id) ON DELETE CASCADE;


--
-- Name: commerce_sales_orders commerce_sales_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_sales_orders
    ADD CONSTRAINT commerce_sales_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: commerce_sales_orders commerce_sales_orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_sales_orders
    ADD CONSTRAINT commerce_sales_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.commerce_crm_accounts(id) ON DELETE RESTRICT;


--
-- Name: commerce_sales_orders commerce_sales_orders_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_sales_orders
    ADD CONSTRAINT commerce_sales_orders_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.commerce_warehouses(id) ON DELETE RESTRICT;


--
-- Name: commerce_serialized_inventory_batches commerce_serialized_inventory_batches_procurement_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_serialized_inventory_batches
    ADD CONSTRAINT commerce_serialized_inventory_batches_procurement_item_id_fkey FOREIGN KEY (procurement_item_id) REFERENCES public.commerce_procurement_items(id) ON DELETE RESTRICT;


--
-- Name: commerce_serialized_inventory_batches commerce_serialized_inventory_batches_procurement_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_serialized_inventory_batches
    ADD CONSTRAINT commerce_serialized_inventory_batches_procurement_order_id_fkey FOREIGN KEY (procurement_order_id) REFERENCES public.commerce_procurement_orders(id) ON DELETE RESTRICT;


--
-- Name: commerce_serialized_inventory_batches commerce_serialized_inventory_batches_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_serialized_inventory_batches
    ADD CONSTRAINT commerce_serialized_inventory_batches_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: commerce_serialized_inventory_batches commerce_serialized_inventory_batches_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_serialized_inventory_batches
    ADD CONSTRAINT commerce_serialized_inventory_batches_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.commerce_warehouses(id) ON DELETE RESTRICT;


--
-- Name: commerce_serialized_unit_movements commerce_serialized_unit_movements_customer_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_serialized_unit_movements
    ADD CONSTRAINT commerce_serialized_unit_movements_customer_order_id_fkey FOREIGN KEY (customer_order_id) REFERENCES public.customer_orders(id) ON DELETE RESTRICT;


--
-- Name: commerce_serialized_unit_movements commerce_serialized_unit_movements_order_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_serialized_unit_movements
    ADD CONSTRAINT commerce_serialized_unit_movements_order_return_id_fkey FOREIGN KEY (order_return_id) REFERENCES public.commerce_order_returns(id) ON DELETE RESTRICT;


--
-- Name: commerce_serialized_unit_movements commerce_serialized_unit_movements_procurement_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_serialized_unit_movements
    ADD CONSTRAINT commerce_serialized_unit_movements_procurement_item_id_fkey FOREIGN KEY (procurement_item_id) REFERENCES public.commerce_procurement_items(id) ON DELETE RESTRICT;


--
-- Name: commerce_serialized_unit_movements commerce_serialized_unit_movements_procurement_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_serialized_unit_movements
    ADD CONSTRAINT commerce_serialized_unit_movements_procurement_order_id_fkey FOREIGN KEY (procurement_order_id) REFERENCES public.commerce_procurement_orders(id) ON DELETE RESTRICT;


--
-- Name: commerce_serialized_unit_movements commerce_serialized_unit_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_serialized_unit_movements
    ADD CONSTRAINT commerce_serialized_unit_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: commerce_serialized_unit_movements commerce_serialized_unit_movements_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_serialized_unit_movements
    ADD CONSTRAINT commerce_serialized_unit_movements_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.commerce_serialized_units(id) ON DELETE RESTRICT;


--
-- Name: commerce_serialized_unit_movements commerce_serialized_unit_movements_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_serialized_unit_movements
    ADD CONSTRAINT commerce_serialized_unit_movements_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE RESTRICT;


--
-- Name: commerce_serialized_unit_movements commerce_serialized_unit_movements_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_serialized_unit_movements
    ADD CONSTRAINT commerce_serialized_unit_movements_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.commerce_warehouses(id) ON DELETE RESTRICT;


--
-- Name: commerce_serialized_units commerce_serialized_units_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_serialized_units
    ADD CONSTRAINT commerce_serialized_units_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.commerce_serialized_inventory_batches(id) ON DELETE RESTRICT;


--
-- Name: commerce_serialized_units commerce_serialized_units_customer_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_serialized_units
    ADD CONSTRAINT commerce_serialized_units_customer_order_id_fkey FOREIGN KEY (customer_order_id) REFERENCES public.customer_orders(id) ON DELETE RESTRICT;


--
-- Name: commerce_serialized_units commerce_serialized_units_customer_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_serialized_units
    ADD CONSTRAINT commerce_serialized_units_customer_order_item_id_fkey FOREIGN KEY (customer_order_item_id) REFERENCES public.customer_order_items(id) ON DELETE RESTRICT;


--
-- Name: commerce_serialized_units commerce_serialized_units_customer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_serialized_units
    ADD CONSTRAINT commerce_serialized_units_customer_user_id_fkey FOREIGN KEY (customer_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: commerce_serialized_units commerce_serialized_units_procurement_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_serialized_units
    ADD CONSTRAINT commerce_serialized_units_procurement_item_id_fkey FOREIGN KEY (procurement_item_id) REFERENCES public.commerce_procurement_items(id) ON DELETE RESTRICT;


--
-- Name: commerce_serialized_units commerce_serialized_units_procurement_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_serialized_units
    ADD CONSTRAINT commerce_serialized_units_procurement_order_id_fkey FOREIGN KEY (procurement_order_id) REFERENCES public.commerce_procurement_orders(id) ON DELETE RESTRICT;


--
-- Name: commerce_serialized_units commerce_serialized_units_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_serialized_units
    ADD CONSTRAINT commerce_serialized_units_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: commerce_serialized_units commerce_serialized_units_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_serialized_units
    ADD CONSTRAINT commerce_serialized_units_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE RESTRICT;


--
-- Name: commerce_serialized_units commerce_serialized_units_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_serialized_units
    ADD CONSTRAINT commerce_serialized_units_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.commerce_warehouses(id) ON DELETE RESTRICT;


--
-- Name: commerce_warehouse_inventory commerce_warehouse_inventory_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_warehouse_inventory
    ADD CONSTRAINT commerce_warehouse_inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: commerce_warehouse_inventory commerce_warehouse_inventory_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_warehouse_inventory
    ADD CONSTRAINT commerce_warehouse_inventory_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.commerce_warehouses(id) ON DELETE CASCADE;


--
-- Name: commerce_warehouse_transfer_items commerce_warehouse_transfer_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_warehouse_transfer_items
    ADD CONSTRAINT commerce_warehouse_transfer_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: commerce_warehouse_transfer_items commerce_warehouse_transfer_items_transfer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_warehouse_transfer_items
    ADD CONSTRAINT commerce_warehouse_transfer_items_transfer_id_fkey FOREIGN KEY (transfer_id) REFERENCES public.commerce_warehouse_transfers(id) ON DELETE CASCADE;


--
-- Name: commerce_warehouse_transfers commerce_warehouse_transfers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_warehouse_transfers
    ADD CONSTRAINT commerce_warehouse_transfers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: commerce_warehouse_transfers commerce_warehouse_transfers_from_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_warehouse_transfers
    ADD CONSTRAINT commerce_warehouse_transfers_from_warehouse_id_fkey FOREIGN KEY (from_warehouse_id) REFERENCES public.commerce_warehouses(id) ON DELETE RESTRICT;


--
-- Name: commerce_warehouse_transfers commerce_warehouse_transfers_to_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commerce_warehouse_transfers
    ADD CONSTRAINT commerce_warehouse_transfers_to_warehouse_id_fkey FOREIGN KEY (to_warehouse_id) REFERENCES public.commerce_warehouses(id) ON DELETE RESTRICT;


--
-- Name: customer_order_items customer_order_items_after_sales_policy_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_order_items
    ADD CONSTRAINT customer_order_items_after_sales_policy_version_id_fkey FOREIGN KEY (after_sales_policy_version_id) REFERENCES public.after_sales_policy_versions(id) ON DELETE RESTRICT;


--
-- Name: customer_order_items customer_order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_order_items
    ADD CONSTRAINT customer_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.customer_orders(id) ON DELETE CASCADE;


--
-- Name: customer_order_items customer_order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_order_items
    ADD CONSTRAINT customer_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: customer_order_items customer_order_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_order_items
    ADD CONSTRAINT customer_order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;


--
-- Name: customer_order_messages customer_order_messages_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_order_messages
    ADD CONSTRAINT customer_order_messages_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.customer_orders(id) ON DELETE RESTRICT;


--
-- Name: customer_order_messages customer_order_messages_packing_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_order_messages
    ADD CONSTRAINT customer_order_messages_packing_session_id_fkey FOREIGN KEY (packing_session_id) REFERENCES public.order_packing_sessions(id) ON DELETE RESTRICT;


--
-- Name: customer_order_messages customer_order_messages_reply_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_order_messages
    ADD CONSTRAINT customer_order_messages_reply_to_fkey FOREIGN KEY (reply_to_message_id) REFERENCES public.customer_order_messages(id) ON DELETE RESTRICT;


--
-- Name: customer_order_messages customer_order_messages_sender_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_order_messages
    ADD CONSTRAINT customer_order_messages_sender_admin_user_id_fkey FOREIGN KEY (sender_admin_user_id) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: customer_order_messages customer_order_messages_sender_customer_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_order_messages
    ADD CONSTRAINT customer_order_messages_sender_customer_fkey FOREIGN KEY (sender_customer_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: customer_order_messages customer_order_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_order_messages
    ADD CONSTRAINT customer_order_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: customer_orders customer_orders_awaiting_customer_message_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_orders
    ADD CONSTRAINT customer_orders_awaiting_customer_message_fkey FOREIGN KEY (awaiting_customer_message_id) REFERENCES public.customer_order_messages(id) ON DELETE SET NULL;


--
-- Name: customer_orders customer_orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_orders
    ADD CONSTRAINT customer_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: customer_profiles customer_profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_profiles
    ADD CONSTRAINT customer_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: document_file_tags document_file_tags_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_file_tags
    ADD CONSTRAINT document_file_tags_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: document_file_tags document_file_tags_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_file_tags
    ADD CONSTRAINT document_file_tags_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_file_tags document_file_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_file_tags
    ADD CONSTRAINT document_file_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.document_tags(id) ON DELETE CASCADE;


--
-- Name: document_folder_permissions document_folder_permissions_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_folder_permissions
    ADD CONSTRAINT document_folder_permissions_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.admin_users(id) ON DELETE CASCADE;


--
-- Name: document_folder_permissions document_folder_permissions_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_folder_permissions
    ADD CONSTRAINT document_folder_permissions_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.document_folders(id) ON DELETE CASCADE;


--
-- Name: document_folder_permissions document_folder_permissions_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_folder_permissions
    ADD CONSTRAINT document_folder_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: document_folder_tags document_folder_tags_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_folder_tags
    ADD CONSTRAINT document_folder_tags_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: document_folder_tags document_folder_tags_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_folder_tags
    ADD CONSTRAINT document_folder_tags_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.document_folders(id) ON DELETE CASCADE;


--
-- Name: document_folder_tags document_folder_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_folder_tags
    ADD CONSTRAINT document_folder_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.document_tags(id) ON DELETE CASCADE;


--
-- Name: document_folders document_folders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_folders
    ADD CONSTRAINT document_folders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: document_folders document_folders_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_folders
    ADD CONSTRAINT document_folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.document_folders(id) ON DELETE CASCADE;


--
-- Name: document_quick_access document_quick_access_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_quick_access
    ADD CONSTRAINT document_quick_access_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.admin_users(id) ON DELETE CASCADE;


--
-- Name: document_quick_access document_quick_access_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_quick_access
    ADD CONSTRAINT document_quick_access_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_quick_access document_quick_access_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_quick_access
    ADD CONSTRAINT document_quick_access_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.document_folders(id) ON DELETE CASCADE;


--
-- Name: document_recent_items document_recent_items_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_recent_items
    ADD CONSTRAINT document_recent_items_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.admin_users(id) ON DELETE CASCADE;


--
-- Name: document_recent_items document_recent_items_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_recent_items
    ADD CONSTRAINT document_recent_items_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_tags document_tags_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_tags
    ADD CONSTRAINT document_tags_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: documents documents_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: documents documents_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.document_folders(id) ON DELETE CASCADE;


--
-- Name: email_attempts email_attempts_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_attempts
    ADD CONSTRAINT email_attempts_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.email_messages(id) ON DELETE RESTRICT;


--
-- Name: email_events email_events_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_events
    ADD CONSTRAINT email_events_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.email_messages(id) ON DELETE RESTRICT;


--
-- Name: email_messages email_messages_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_messages
    ADD CONSTRAINT email_messages_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.admin_users(id) ON DELETE RESTRICT;


--
-- Name: email_messages email_messages_recipient_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_messages
    ADD CONSTRAINT email_messages_recipient_fkey FOREIGN KEY (recipient) REFERENCES public.email_preferences(recipient) ON DELETE RESTRICT;


--
-- Name: email_messages email_messages_template_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_messages
    ADD CONSTRAINT email_messages_template_key_fkey FOREIGN KEY (template_key) REFERENCES public.email_templates(key) ON DELETE RESTRICT;


--
-- Name: email_preferences email_preferences_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_preferences
    ADD CONSTRAINT email_preferences_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.admin_users(id) ON DELETE RESTRICT;


--
-- Name: email_provider_settings email_provider_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_provider_settings
    ADD CONSTRAINT email_provider_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.admin_users(id) ON DELETE RESTRICT;


--
-- Name: email_templates email_templates_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.admin_users(id) ON DELETE RESTRICT;


--
-- Name: erp_inventory_cache erp_inventory_cache_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_inventory_cache
    ADD CONSTRAINT erp_inventory_cache_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: erp_provider_settings erp_provider_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_provider_settings
    ADD CONSTRAINT erp_provider_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: erp_stock_reservations erp_stock_reservations_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_stock_reservations
    ADD CONSTRAINT erp_stock_reservations_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.customer_order_items(id) ON DELETE CASCADE;


--
-- Name: erp_sync_jobs erp_sync_jobs_sync_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_sync_jobs
    ADD CONSTRAINT erp_sync_jobs_sync_run_id_fkey FOREIGN KEY (sync_run_id) REFERENCES public.erp_sync_runs(id);


--
-- Name: erp_sync_runs erp_sync_runs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.erp_sync_runs
    ADD CONSTRAINT erp_sync_runs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: help_articles help_articles_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_articles
    ADD CONSTRAINT help_articles_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.help_categories(id) ON DELETE RESTRICT;


--
-- Name: help_articles help_articles_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_articles
    ADD CONSTRAINT help_articles_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: help_articles help_articles_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_articles
    ADD CONSTRAINT help_articles_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: hr_employees hr_employees_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employees
    ADD CONSTRAINT hr_employees_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: nps_responses nps_responses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nps_responses
    ADD CONSTRAINT nps_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: order_packing_scans order_packing_scans_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_packing_scans
    ADD CONSTRAINT order_packing_scans_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.customer_order_items(id) ON DELETE RESTRICT;


--
-- Name: order_packing_scans order_packing_scans_scanned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_packing_scans
    ADD CONSTRAINT order_packing_scans_scanned_by_fkey FOREIGN KEY (scanned_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: order_packing_scans order_packing_scans_serialized_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_packing_scans
    ADD CONSTRAINT order_packing_scans_serialized_unit_id_fkey FOREIGN KEY (serialized_unit_id) REFERENCES public.commerce_serialized_units(id) ON DELETE RESTRICT;


--
-- Name: order_packing_scans order_packing_scans_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_packing_scans
    ADD CONSTRAINT order_packing_scans_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.order_packing_sessions(id) ON DELETE CASCADE;


--
-- Name: order_packing_sessions order_packing_sessions_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_packing_sessions
    ADD CONSTRAINT order_packing_sessions_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: order_packing_sessions order_packing_sessions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_packing_sessions
    ADD CONSTRAINT order_packing_sessions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.customer_orders(id) ON DELETE RESTRICT;


--
-- Name: order_packing_sessions order_packing_sessions_work_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_packing_sessions
    ADD CONSTRAINT order_packing_sessions_work_session_id_fkey FOREIGN KEY (work_session_id) REFERENCES public.order_packing_work_sessions(id) ON DELETE RESTRICT;


--
-- Name: order_packing_videos order_packing_videos_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_packing_videos
    ADD CONSTRAINT order_packing_videos_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.customer_orders(id) ON DELETE RESTRICT;


--
-- Name: order_packing_videos order_packing_videos_packing_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_packing_videos
    ADD CONSTRAINT order_packing_videos_packing_session_id_fkey FOREIGN KEY (packing_session_id) REFERENCES public.order_packing_sessions(id) ON DELETE RESTRICT;


--
-- Name: order_packing_videos order_packing_videos_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_packing_videos
    ADD CONSTRAINT order_packing_videos_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.admin_users(id) ON DELETE RESTRICT;


--
-- Name: order_packing_videos order_packing_videos_work_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_packing_videos
    ADD CONSTRAINT order_packing_videos_work_session_id_fkey FOREIGN KEY (work_session_id) REFERENCES public.order_packing_work_sessions(id) ON DELETE RESTRICT;


--
-- Name: order_packing_work_sessions order_packing_work_sessions_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_packing_work_sessions
    ADD CONSTRAINT order_packing_work_sessions_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.admin_users(id) ON DELETE RESTRICT;


--
-- Name: payment_attempts payment_attempts_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_attempts
    ADD CONSTRAINT payment_attempts_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.customer_orders(id) ON DELETE RESTRICT;


--
-- Name: payment_transactions payment_transactions_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.payment_attempts(id) ON DELETE RESTRICT;


--
-- Name: preorder_payments preorder_payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preorder_payments
    ADD CONSTRAINT preorder_payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.customer_orders(id) ON DELETE RESTRICT;


--
-- Name: preorder_payments preorder_payments_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preorder_payments
    ADD CONSTRAINT preorder_payments_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.admin_users(id) ON DELETE RESTRICT;


--
-- Name: product_features product_features_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_features
    ADD CONSTRAINT product_features_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_images product_images_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_images product_images_product_variant_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_product_variant_fkey FOREIGN KEY (product_id, variant_id) REFERENCES public.product_variants(product_id, id) ON DELETE RESTRICT;


--
-- Name: product_reviews product_reviews_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_reviews product_reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.customer_profiles(id) ON DELETE CASCADE;


--
-- Name: product_specifications product_specifications_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_specifications
    ADD CONSTRAINT product_specifications_definition_id_fkey FOREIGN KEY (definition_id) REFERENCES public.specification_definitions(id) ON DELETE SET NULL;


--
-- Name: product_specifications product_specifications_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_specifications
    ADD CONSTRAINT product_specifications_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_variants product_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE RESTRICT;


--
-- Name: products products_default_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_default_supplier_id_fkey FOREIGN KEY (default_supplier_id) REFERENCES public.commerce_crm_accounts(id) ON DELETE SET NULL;


--
-- Name: products products_primary_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_primary_warehouse_id_fkey FOREIGN KEY (primary_warehouse_id) REFERENCES public.commerce_warehouses(id) ON DELETE SET NULL;


--
-- Name: shipping_claim_jobs shipping_claim_jobs_claim_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_claim_jobs
    ADD CONSTRAINT shipping_claim_jobs_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.after_sales_claims(id) ON DELETE RESTRICT;


--
-- Name: shipping_claim_jobs shipping_claim_jobs_initiated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_claim_jobs
    ADD CONSTRAINT shipping_claim_jobs_initiated_by_fkey FOREIGN KEY (initiated_by) REFERENCES public.admin_users(id) ON DELETE RESTRICT;


--
-- Name: shipping_claim_jobs shipping_claim_jobs_label_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_claim_jobs
    ADD CONSTRAINT shipping_claim_jobs_label_requested_by_fkey FOREIGN KEY (label_requested_by) REFERENCES public.admin_users(id) ON DELETE RESTRICT;


--
-- Name: shipping_claim_jobs shipping_claim_jobs_previous_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_claim_jobs
    ADD CONSTRAINT shipping_claim_jobs_previous_job_id_fkey FOREIGN KEY (previous_job_id) REFERENCES public.shipping_claim_jobs(id) ON DELETE RESTRICT;


--
-- Name: shipping_order_jobs shipping_order_jobs_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_order_jobs
    ADD CONSTRAINT shipping_order_jobs_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.customer_orders(id) ON DELETE CASCADE;


--
-- Name: shipping_provider_settings shipping_provider_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_provider_settings
    ADD CONSTRAINT shipping_provider_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: shipping_webhook_events shipping_webhook_events_claim_shipment_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_webhook_events
    ADD CONSTRAINT shipping_webhook_events_claim_shipment_job_id_fkey FOREIGN KEY (claim_shipment_job_id) REFERENCES public.shipping_claim_jobs(id) ON DELETE RESTRICT;


--
-- Name: shipping_webhook_events shipping_webhook_events_shipment_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_webhook_events
    ADD CONSTRAINT shipping_webhook_events_shipment_job_id_fkey FOREIGN KEY (shipment_job_id) REFERENCES public.shipping_order_jobs(id) ON DELETE CASCADE;


--
-- Name: site_pages site_pages_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_pages
    ADD CONSTRAINT site_pages_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: site_pages site_pages_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_pages
    ADD CONSTRAINT site_pages_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: sms_attempts sms_attempts_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_attempts
    ADD CONSTRAINT sms_attempts_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.sms_batches(id) ON DELETE CASCADE;


--
-- Name: sms_batches sms_batches_provider_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_batches
    ADD CONSTRAINT sms_batches_provider_fkey FOREIGN KEY (provider) REFERENCES public.sms_provider_settings(id);


--
-- Name: sms_batches sms_batches_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_batches
    ADD CONSTRAINT sms_batches_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.sms_templates(id);


--
-- Name: sms_batches sms_batches_triggered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_batches
    ADD CONSTRAINT sms_batches_triggered_by_fkey FOREIGN KEY (triggered_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: sms_messages sms_messages_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_messages
    ADD CONSTRAINT sms_messages_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.sms_batches(id) ON DELETE CASCADE;


--
-- Name: sms_order_event_settings sms_order_event_settings_template_ar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_order_event_settings
    ADD CONSTRAINT sms_order_event_settings_template_ar_id_fkey FOREIGN KEY (template_ar_id) REFERENCES public.sms_templates(id) ON DELETE SET NULL;


--
-- Name: sms_order_event_settings sms_order_event_settings_template_en_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_order_event_settings
    ADD CONSTRAINT sms_order_event_settings_template_en_id_fkey FOREIGN KEY (template_en_id) REFERENCES public.sms_templates(id) ON DELETE SET NULL;


--
-- Name: sms_order_event_settings sms_order_event_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_order_event_settings
    ADD CONSTRAINT sms_order_event_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: sms_order_events sms_order_events_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_order_events
    ADD CONSTRAINT sms_order_events_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.sms_batches(id) ON DELETE SET NULL;


--
-- Name: sms_order_events sms_order_events_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_order_events
    ADD CONSTRAINT sms_order_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.customer_orders(id) ON DELETE SET NULL;


--
-- Name: sms_order_events sms_order_events_shipment_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_order_events
    ADD CONSTRAINT sms_order_events_shipment_job_id_fkey FOREIGN KEY (shipment_job_id) REFERENCES public.shipping_order_jobs(id) ON DELETE SET NULL;


--
-- Name: sms_order_events sms_order_events_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_order_events
    ADD CONSTRAINT sms_order_events_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.sms_templates(id) ON DELETE SET NULL;


--
-- Name: sms_order_events sms_order_events_tracking_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_order_events
    ADD CONSTRAINT sms_order_events_tracking_event_id_fkey FOREIGN KEY (tracking_event_id) REFERENCES public.shipping_webhook_events(id) ON DELETE SET NULL;


--
-- Name: sms_provider_settings sms_provider_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_provider_settings
    ADD CONSTRAINT sms_provider_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: sms_templates sms_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_templates
    ADD CONSTRAINT sms_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: sms_templates sms_templates_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_templates
    ADD CONSTRAINT sms_templates_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: store_analytics_events store_analytics_events_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_analytics_events
    ADD CONSTRAINT store_analytics_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.customer_orders(id) ON DELETE SET NULL;


--
-- Name: store_analytics_events store_analytics_events_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_analytics_events
    ADD CONSTRAINT store_analytics_events_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: store_analytics_events store_analytics_events_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_analytics_events
    ADD CONSTRAINT store_analytics_events_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.store_analytics_sessions(id) ON DELETE CASCADE;


--
-- Name: store_analytics_events store_analytics_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_analytics_events
    ADD CONSTRAINT store_analytics_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: store_analytics_sessions store_analytics_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_analytics_sessions
    ADD CONSTRAINT store_analytics_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: support_ticket_attachments support_ticket_attachments_message_id_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_attachments
    ADD CONSTRAINT support_ticket_attachments_message_id_ticket_id_fkey FOREIGN KEY (message_id, ticket_id) REFERENCES public.support_ticket_messages(id, ticket_id) ON DELETE CASCADE;


--
-- Name: support_ticket_attachments support_ticket_attachments_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_attachments
    ADD CONSTRAINT support_ticket_attachments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: support_ticket_attachments support_ticket_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_attachments
    ADD CONSTRAINT support_ticket_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: support_ticket_events support_ticket_events_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_events
    ADD CONSTRAINT support_ticket_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: support_ticket_events support_ticket_events_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_events
    ADD CONSTRAINT support_ticket_events_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: support_ticket_messages support_ticket_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_messages
    ADD CONSTRAINT support_ticket_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: support_ticket_messages support_ticket_messages_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_ticket_messages
    ADD CONSTRAINT support_ticket_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: support_tickets support_tickets_assigned_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_assigned_admin_id_fkey FOREIGN KEY (assigned_admin_id) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.help_categories(id) ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.customer_orders(id) ON DELETE SET NULL;


--
-- Name: treasury_transactions treasury_transactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transactions
    ADD CONSTRAINT treasury_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: treasury_transactions treasury_transactions_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transactions
    ADD CONSTRAINT treasury_transactions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.hr_employees(id) ON DELETE RESTRICT;


--
-- Name: treasury_transactions treasury_transactions_procurement_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transactions
    ADD CONSTRAINT treasury_transactions_procurement_order_id_fkey FOREIGN KEY (procurement_order_id) REFERENCES public.commerce_procurement_orders(id) ON DELETE RESTRICT;


--
-- Name: treasury_transactions treasury_transactions_sales_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transactions
    ADD CONSTRAINT treasury_transactions_sales_order_id_fkey FOREIGN KEY (sales_order_id) REFERENCES public.commerce_sales_orders(id) ON DELETE RESTRICT;


--
-- Name: admin_users Admin users can read their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin users can read their own profile" ON public.admin_users FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: hr_employees Admins can add HR employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can add HR employees" ON public.hr_employees FOR INSERT TO authenticated WITH CHECK (public.has_admin_permission('hr.edit'::text));


--
-- Name: hr_employees Admins can edit HR employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can edit HR employees" ON public.hr_employees FOR UPDATE TO authenticated USING (public.has_admin_permission('hr.edit'::text)) WITH CHECK (public.has_admin_permission('hr.edit'::text));


--
-- Name: commerce_crm_accounts Admins can manage CRM accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage CRM accounts" ON public.commerce_crm_accounts TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());


--
-- Name: site_offer_cards Admins can manage offer cards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage offer cards" ON public.site_offer_cards TO authenticated USING (public.has_admin_permission('settings.edit'::text)) WITH CHECK (public.has_admin_permission('settings.edit'::text));


--
-- Name: commerce_order_return_items Admins can manage order return items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage order return items" ON public.commerce_order_return_items TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());


--
-- Name: commerce_order_returns Admins can manage order returns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage order returns" ON public.commerce_order_returns TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());


--
-- Name: commerce_procurement_items Admins can manage procurement items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage procurement items" ON public.commerce_procurement_items TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());


--
-- Name: commerce_procurement_orders Admins can manage procurement orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage procurement orders" ON public.commerce_procurement_orders TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());


--
-- Name: commerce_sales_items Admins can manage sales items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage sales items" ON public.commerce_sales_items TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());


--
-- Name: commerce_sales_orders Admins can manage sales orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage sales orders" ON public.commerce_sales_orders TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());


--
-- Name: commerce_shipping_companies Admins can manage shipping companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage shipping companies" ON public.commerce_shipping_companies TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());


--
-- Name: site_coupons Admins can manage site coupons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage site coupons" ON public.site_coupons TO authenticated USING (public.has_admin_permission('settings.edit'::text)) WITH CHECK (public.has_admin_permission('settings.edit'::text));


--
-- Name: commerce_warehouse_inventory Admins can manage warehouse inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage warehouse inventory" ON public.commerce_warehouse_inventory TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());


--
-- Name: commerce_warehouse_transfer_items Admins can manage warehouse transfer items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage warehouse transfer items" ON public.commerce_warehouse_transfer_items TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());


--
-- Name: commerce_warehouse_transfers Admins can manage warehouse transfers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage warehouse transfers" ON public.commerce_warehouse_transfers TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());


--
-- Name: commerce_warehouses Admins can manage warehouses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage warehouses" ON public.commerce_warehouses TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());


--
-- Name: hr_employees Admins can read HR employees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read HR employees" ON public.hr_employees FOR SELECT TO authenticated USING (public.has_admin_permission('hr.view'::text));


--
-- Name: treasury_transactions Admins can read Treasury transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read Treasury transactions" ON public.treasury_transactions FOR SELECT TO authenticated USING (public.has_admin_permission('treasury.view'::text));


--
-- Name: admin_activity_logs Admins can read activity logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read activity logs" ON public.admin_activity_logs FOR SELECT TO authenticated USING (public.has_admin_permission('settings.view'::text));


--
-- Name: commerce_inventory_movements Admins can read inventory movements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read inventory movements" ON public.commerce_inventory_movements FOR SELECT TO authenticated USING (public.is_active_admin());


--
-- Name: customer_order_messages Customers can read their own order messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can read their own order messages" ON public.customer_order_messages FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: site_offer_cards Public can read offer cards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read offer cards" ON public.site_offer_cards FOR SELECT USING (true);


--
-- Name: site_pages Public can read published site pages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read published site pages" ON public.site_pages FOR SELECT USING ((is_published = true));


--
-- Name: customer_profiles Users can create their own customer profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own customer profile" ON public.customer_profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: customer_order_items Users can read their own customer order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read their own customer order items" ON public.customer_order_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.customer_orders
  WHERE ((customer_orders.id = customer_order_items.order_id) AND (customer_orders.user_id = auth.uid())))));


--
-- Name: customer_orders Users can read their own customer orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read their own customer orders" ON public.customer_orders FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: customer_profiles Users can read their own customer profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read their own customer profile" ON public.customer_profiles FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: customer_profiles Users can update their own customer profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own customer profile" ON public.customer_profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: admin_activity_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

--
-- Name: after_sales_claim_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.after_sales_claim_events ENABLE ROW LEVEL SECURITY;

--
-- Name: after_sales_claim_evidence; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.after_sales_claim_evidence ENABLE ROW LEVEL SECURITY;

--
-- Name: after_sales_claim_information; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.after_sales_claim_information ENABLE ROW LEVEL SECURITY;

--
-- Name: after_sales_claims; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.after_sales_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: after_sales_communication_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.after_sales_communication_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: after_sales_communications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.after_sales_communications ENABLE ROW LEVEL SECURITY;

--
-- Name: after_sales_policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.after_sales_policies ENABLE ROW LEVEL SECURITY;

--
-- Name: after_sales_policy_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.after_sales_policy_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: after_sales_return_reasons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.after_sales_return_reasons ENABLE ROW LEVEL SECURITY;

--
-- Name: brands; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: category_specification_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.category_specification_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: category_specification_templates category_specification_templates_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY category_specification_templates_manage ON public.category_specification_templates TO authenticated USING (public.has_admin_permission('products.edit'::text)) WITH CHECK (public.has_admin_permission('products.edit'::text));


--
-- Name: category_specification_templates category_specification_templates_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY category_specification_templates_read ON public.category_specification_templates FOR SELECT TO authenticated USING ((public.has_admin_permission('products.view'::text) OR public.has_admin_permission('products.edit'::text)));


--
-- Name: chat_agent_availability; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_agent_availability ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_events ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_read_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_read_state ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_crm_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_crm_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_crm_activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_crm_activities ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_inventory_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_inventory_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_order_return_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_order_return_items ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_order_returns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_order_returns ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_procurement_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_procurement_items ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_procurement_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_procurement_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_sales_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_sales_items ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_sales_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_sales_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_serialized_inventory_batches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_serialized_inventory_batches ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_serialized_unit_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_serialized_unit_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_serialized_units; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_serialized_units ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_shipping_companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_shipping_companies ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_warehouse_inventory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_warehouse_inventory ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_warehouse_transfer_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_warehouse_transfer_items ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_warehouse_transfers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_warehouse_transfers ENABLE ROW LEVEL SECURITY;

--
-- Name: commerce_warehouses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commerce_warehouses ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_order_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_order_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: document_file_tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_file_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: document_folder_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_folder_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: document_folder_tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_folder_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: document_folders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;

--
-- Name: document_quick_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_quick_access ENABLE ROW LEVEL SECURITY;

--
-- Name: document_recent_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_recent_items ENABLE ROW LEVEL SECURITY;

--
-- Name: document_tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

--
-- Name: email_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: email_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

--
-- Name: email_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: email_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: email_provider_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_provider_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: email_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: erp_entity_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.erp_entity_links ENABLE ROW LEVEL SECURITY;

--
-- Name: erp_inventory_cache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.erp_inventory_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: erp_provider_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.erp_provider_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: erp_remote_writes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.erp_remote_writes ENABLE ROW LEVEL SECURITY;

--
-- Name: erp_stock_reservations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.erp_stock_reservations ENABLE ROW LEVEL SECURITY;

--
-- Name: erp_sync_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.erp_sync_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: erp_sync_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.erp_sync_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: erp_worker_leases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.erp_worker_leases ENABLE ROW LEVEL SECURITY;

--
-- Name: help_articles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;

--
-- Name: help_articles help_articles_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY help_articles_public_read ON public.help_articles FOR SELECT TO anon, authenticated USING (((status = 'published'::text) AND (EXISTS ( SELECT 1
   FROM public.help_categories c
  WHERE ((c.id = help_articles.category_id) AND (c.is_active = true))))));


--
-- Name: help_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.help_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: help_categories help_categories_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY help_categories_public_read ON public.help_categories FOR SELECT TO anon, authenticated USING ((is_active = true));


--
-- Name: hr_employees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;

--
-- Name: nps_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.nps_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: order_packing_scans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_packing_scans ENABLE ROW LEVEL SECURITY;

--
-- Name: order_packing_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_packing_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: order_packing_videos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_packing_videos ENABLE ROW LEVEL SECURITY;

--
-- Name: order_packing_work_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_packing_work_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: preorder_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.preorder_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: product_features; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_features ENABLE ROW LEVEL SECURITY;

--
-- Name: product_features product_features_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_features_manage ON public.product_features TO authenticated USING (public.has_admin_permission('products.edit'::text)) WITH CHECK (public.has_admin_permission('products.edit'::text));


--
-- Name: product_features product_features_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_features_read ON public.product_features FOR SELECT TO anon, authenticated USING (((EXISTS ( SELECT 1
   FROM public.products
  WHERE ((products.id = product_features.product_id) AND products.is_published))) OR public.has_admin_permission('products.view'::text) OR public.has_admin_permission('products.edit'::text)));


--
-- Name: product_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

--
-- Name: product_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: product_specifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_specifications ENABLE ROW LEVEL SECURITY;

--
-- Name: product_variants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

--
-- Name: product_variants product_variants_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_variants_admin_read ON public.product_variants FOR SELECT TO authenticated USING (public.is_active_admin());


--
-- Name: product_variants product_variants_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_variants_public_read ON public.product_variants FOR SELECT TO anon, authenticated USING ((is_active AND (EXISTS ( SELECT 1
   FROM public.products products
  WHERE ((products.id = product_variants.product_id) AND products.is_published)))));


--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: quick_setup_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quick_setup_events ENABLE ROW LEVEL SECURITY;

--
-- Name: quick_setup_revisions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quick_setup_revisions ENABLE ROW LEVEL SECURITY;

--
-- Name: quick_setup_events quick_setup_server_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quick_setup_server_boundary ON public.quick_setup_events AS RESTRICTIVE TO anon, authenticated USING (false) WITH CHECK (false);


--
-- Name: quick_setup_revisions quick_setup_server_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quick_setup_server_boundary ON public.quick_setup_revisions AS RESTRICTIVE TO anon, authenticated USING (false) WITH CHECK (false);


--
-- Name: quick_setup_state quick_setup_server_boundary; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quick_setup_server_boundary ON public.quick_setup_state AS RESTRICTIVE TO anon, authenticated USING (false) WITH CHECK (false);


--
-- Name: quick_setup_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quick_setup_state ENABLE ROW LEVEL SECURITY;

--
-- Name: brands security_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_public_read ON public.brands FOR SELECT TO anon, authenticated USING (true);


--
-- Name: categories security_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_public_read ON public.categories FOR SELECT TO anon, authenticated USING (true);


--
-- Name: product_images security_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_public_read ON public.product_images FOR SELECT TO anon, authenticated USING ((EXISTS ( SELECT 1
   FROM (public.products p
     JOIN public.product_variants v ON (((v.product_id = p.id) AND (v.id = product_images.variant_id) AND v.is_active)))
  WHERE ((p.id = product_images.product_id) AND (p.is_published = true)))));


--
-- Name: product_specifications security_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_public_read ON public.product_specifications FOR SELECT TO anon, authenticated USING ((EXISTS ( SELECT 1
   FROM public.products p
  WHERE ((p.id = product_specifications.product_id) AND (p.is_published = true)))));


--
-- Name: products security_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_public_read ON public.products FOR SELECT TO anon, authenticated USING ((is_published = true));


--
-- Name: site_hero_banners security_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_public_read ON public.site_hero_banners FOR SELECT TO anon, authenticated USING (true);


--
-- Name: site_links security_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_public_read ON public.site_links FOR SELECT TO anon, authenticated USING (true);


--
-- Name: site_settings security_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_public_read ON public.site_settings FOR SELECT TO anon, authenticated USING (true);


--
-- Name: site_top_bar_messages security_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_public_read ON public.site_top_bar_messages FOR SELECT TO anon, authenticated USING (true);


--
-- Name: brands security_staff_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_delete ON public.brands FOR DELETE TO authenticated USING ((public.has_admin_permission('brands.view'::text) AND public.has_admin_permission('brands.edit'::text)));


--
-- Name: categories security_staff_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_delete ON public.categories FOR DELETE TO authenticated USING ((public.has_admin_permission('categories.view'::text) AND public.has_admin_permission('categories.edit'::text)));


--
-- Name: product_images security_staff_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_delete ON public.product_images FOR DELETE TO authenticated USING ((public.has_admin_permission('products.view'::text) AND public.has_admin_permission('products.edit'::text)));


--
-- Name: product_specifications security_staff_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_delete ON public.product_specifications FOR DELETE TO authenticated USING ((public.has_admin_permission('products.view'::text) AND public.has_admin_permission('products.edit'::text)));


--
-- Name: products security_staff_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_delete ON public.products FOR DELETE TO authenticated USING ((public.has_admin_permission('products.view'::text) AND public.has_admin_permission('products.edit'::text)));


--
-- Name: site_hero_banners security_staff_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_delete ON public.site_hero_banners FOR DELETE TO authenticated USING ((public.has_admin_permission('settings.view'::text) AND public.has_admin_permission('settings.edit'::text)));


--
-- Name: site_links security_staff_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_delete ON public.site_links FOR DELETE TO authenticated USING ((public.has_admin_permission('settings.view'::text) AND public.has_admin_permission('settings.edit'::text)));


--
-- Name: site_settings security_staff_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_delete ON public.site_settings FOR DELETE TO authenticated USING ((public.has_admin_permission('settings.view'::text) AND public.has_admin_permission('settings.edit'::text)));


--
-- Name: site_top_bar_messages security_staff_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_delete ON public.site_top_bar_messages FOR DELETE TO authenticated USING ((public.has_admin_permission('settings.view'::text) AND public.has_admin_permission('settings.edit'::text)));


--
-- Name: brands security_staff_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_insert ON public.brands FOR INSERT TO authenticated WITH CHECK ((public.has_admin_permission('brands.view'::text) AND public.has_admin_permission('brands.add'::text)));


--
-- Name: categories security_staff_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_insert ON public.categories FOR INSERT TO authenticated WITH CHECK ((public.has_admin_permission('categories.view'::text) AND public.has_admin_permission('categories.add'::text)));


--
-- Name: product_images security_staff_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_insert ON public.product_images FOR INSERT TO authenticated WITH CHECK ((public.has_admin_permission('products.view'::text) AND public.has_admin_permission('products.edit'::text)));


--
-- Name: product_specifications security_staff_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_insert ON public.product_specifications FOR INSERT TO authenticated WITH CHECK ((public.has_admin_permission('products.view'::text) AND public.has_admin_permission('products.edit'::text)));


--
-- Name: products security_staff_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_insert ON public.products FOR INSERT TO authenticated WITH CHECK ((public.has_admin_permission('products.view'::text) AND public.has_admin_permission('products.add'::text)));


--
-- Name: site_hero_banners security_staff_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_insert ON public.site_hero_banners FOR INSERT TO authenticated WITH CHECK ((public.has_admin_permission('settings.view'::text) AND public.has_admin_permission('settings.edit'::text)));


--
-- Name: site_links security_staff_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_insert ON public.site_links FOR INSERT TO authenticated WITH CHECK ((public.has_admin_permission('settings.view'::text) AND public.has_admin_permission('settings.edit'::text)));


--
-- Name: site_settings security_staff_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_insert ON public.site_settings FOR INSERT TO authenticated WITH CHECK ((public.has_admin_permission('settings.view'::text) AND public.has_admin_permission('settings.edit'::text)));


--
-- Name: site_top_bar_messages security_staff_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_insert ON public.site_top_bar_messages FOR INSERT TO authenticated WITH CHECK ((public.has_admin_permission('settings.view'::text) AND public.has_admin_permission('settings.edit'::text)));


--
-- Name: brands security_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_read ON public.brands FOR SELECT TO authenticated USING (public.has_admin_permission('brands.view'::text));


--
-- Name: categories security_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_read ON public.categories FOR SELECT TO authenticated USING (public.has_admin_permission('categories.view'::text));


--
-- Name: product_images security_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_read ON public.product_images FOR SELECT TO authenticated USING (public.has_admin_permission('products.view'::text));


--
-- Name: product_specifications security_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_read ON public.product_specifications FOR SELECT TO authenticated USING (public.has_admin_permission('products.view'::text));


--
-- Name: products security_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_read ON public.products FOR SELECT TO authenticated USING (public.has_admin_permission('products.view'::text));


--
-- Name: site_hero_banners security_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_read ON public.site_hero_banners FOR SELECT TO authenticated USING (public.has_admin_permission('settings.view'::text));


--
-- Name: site_links security_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_read ON public.site_links FOR SELECT TO authenticated USING (public.has_admin_permission('settings.view'::text));


--
-- Name: site_settings security_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_read ON public.site_settings FOR SELECT TO authenticated USING (public.has_admin_permission('settings.view'::text));


--
-- Name: site_top_bar_messages security_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_read ON public.site_top_bar_messages FOR SELECT TO authenticated USING (public.has_admin_permission('settings.view'::text));


--
-- Name: brands security_staff_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_update ON public.brands FOR UPDATE TO authenticated USING ((public.has_admin_permission('brands.view'::text) AND public.has_admin_permission('brands.edit'::text))) WITH CHECK ((public.has_admin_permission('brands.view'::text) AND public.has_admin_permission('brands.edit'::text)));


--
-- Name: categories security_staff_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_update ON public.categories FOR UPDATE TO authenticated USING ((public.has_admin_permission('categories.view'::text) AND public.has_admin_permission('categories.edit'::text))) WITH CHECK ((public.has_admin_permission('categories.view'::text) AND public.has_admin_permission('categories.edit'::text)));


--
-- Name: product_images security_staff_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_update ON public.product_images FOR UPDATE TO authenticated USING ((public.has_admin_permission('products.view'::text) AND public.has_admin_permission('products.edit'::text))) WITH CHECK ((public.has_admin_permission('products.view'::text) AND public.has_admin_permission('products.edit'::text)));


--
-- Name: product_specifications security_staff_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_update ON public.product_specifications FOR UPDATE TO authenticated USING ((public.has_admin_permission('products.view'::text) AND public.has_admin_permission('products.edit'::text))) WITH CHECK ((public.has_admin_permission('products.view'::text) AND public.has_admin_permission('products.edit'::text)));


--
-- Name: products security_staff_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_update ON public.products FOR UPDATE TO authenticated USING ((public.has_admin_permission('products.view'::text) AND public.has_admin_permission('products.edit'::text))) WITH CHECK ((public.has_admin_permission('products.view'::text) AND public.has_admin_permission('products.edit'::text)));


--
-- Name: site_hero_banners security_staff_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_update ON public.site_hero_banners FOR UPDATE TO authenticated USING ((public.has_admin_permission('settings.view'::text) AND public.has_admin_permission('settings.edit'::text))) WITH CHECK ((public.has_admin_permission('settings.view'::text) AND public.has_admin_permission('settings.edit'::text)));


--
-- Name: site_links security_staff_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_update ON public.site_links FOR UPDATE TO authenticated USING ((public.has_admin_permission('settings.view'::text) AND public.has_admin_permission('settings.edit'::text))) WITH CHECK ((public.has_admin_permission('settings.view'::text) AND public.has_admin_permission('settings.edit'::text)));


--
-- Name: site_settings security_staff_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_update ON public.site_settings FOR UPDATE TO authenticated USING ((public.has_admin_permission('settings.view'::text) AND public.has_admin_permission('settings.edit'::text))) WITH CHECK ((public.has_admin_permission('settings.view'::text) AND public.has_admin_permission('settings.edit'::text)));


--
-- Name: site_top_bar_messages security_staff_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY security_staff_update ON public.site_top_bar_messages FOR UPDATE TO authenticated USING ((public.has_admin_permission('settings.view'::text) AND public.has_admin_permission('settings.edit'::text))) WITH CHECK ((public.has_admin_permission('settings.view'::text) AND public.has_admin_permission('settings.edit'::text)));


--
-- Name: shipping_city_mappings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shipping_city_mappings ENABLE ROW LEVEL SECURITY;

--
-- Name: shipping_claim_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shipping_claim_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: shipping_order_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shipping_order_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: shipping_provider_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shipping_provider_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: shipping_status_mappings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shipping_status_mappings ENABLE ROW LEVEL SECURITY;

--
-- Name: shipping_webhook_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shipping_webhook_events ENABLE ROW LEVEL SECURITY;

--
-- Name: site_coupons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_coupons ENABLE ROW LEVEL SECURITY;

--
-- Name: site_hero_banners; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_hero_banners ENABLE ROW LEVEL SECURITY;

--
-- Name: site_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_links ENABLE ROW LEVEL SECURITY;

--
-- Name: site_offer_cards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_offer_cards ENABLE ROW LEVEL SECURITY;

--
-- Name: site_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: site_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: site_top_bar_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_top_bar_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_batches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_batches ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_order_event_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_order_event_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_order_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_order_events ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_provider_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_provider_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: specification_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.specification_definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: specification_definitions specification_definitions_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY specification_definitions_manage ON public.specification_definitions TO authenticated USING (public.has_admin_permission('products.edit'::text)) WITH CHECK (public.has_admin_permission('products.edit'::text));


--
-- Name: specification_definitions specification_definitions_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY specification_definitions_read ON public.specification_definitions FOR SELECT TO anon, authenticated USING (true);


--
-- Name: store_analytics_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_analytics_events ENABLE ROW LEVEL SECURITY;

--
-- Name: store_analytics_internal_carts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_analytics_internal_carts ENABLE ROW LEVEL SECURITY;

--
-- Name: store_analytics_internal_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_analytics_internal_users ENABLE ROW LEVEL SECURITY;

--
-- Name: store_analytics_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_analytics_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: support_ticket_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_ticket_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: support_ticket_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_ticket_events ENABLE ROW LEVEL SECURITY;

--
-- Name: support_ticket_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: support_tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: system_reset_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_reset_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: system_reset_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_reset_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: treasury_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.treasury_transactions ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


CREATE TRIGGER on_auth_user_created_create_customer_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer_profile();
CREATE POLICY "chat_receive_broadcast" ON "realtime"."messages" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((extension = 'broadcast'::text) AND (topic = realtime.topic()) AND public.chat_can_receive_topic(realtime.topic())));
CREATE POLICY "after_sales_evidence_server_boundary" ON "storage"."objects" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING ((bucket_id <> 'after-sales-evidence'::text)) WITH CHECK ((bucket_id <> 'after-sales-evidence'::text));
CREATE POLICY "reverse_label_server_boundary" ON "storage"."objects" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (((bucket_id <> 'shipping-labels'::text) OR (name !~~ 'claims/%'::text))) WITH CHECK (((bucket_id <> 'shipping-labels'::text) OR (name !~~ 'claims/%'::text)));
