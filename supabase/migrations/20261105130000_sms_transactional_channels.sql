begin;
create table private.sms_channel_controls(id boolean primary key default true check(id),transactional_enabled boolean not null default false,enabled_since timestamptz,revision integer not null default 0,updated_by uuid references public.admin_users(id));
insert into private.sms_channel_controls(id) values(true);
alter table public.sms_templates add column revision integer not null default 1;
create table private.sms_template_versions(template_id uuid not null references public.sms_templates(id),revision integer not null,snapshot jsonb not null,recorded_at timestamptz not null default now(),primary key(template_id,revision));
create function private.sms_version_template() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into private.sms_template_versions(template_id,revision,snapshot) values(old.id,old.revision,to_jsonb(old)) on conflict do nothing;
 new.revision:=old.revision+1;return new;
end $$;
create trigger sms_version_template before update on public.sms_templates for each row execute function private.sms_version_template();
create function private.sms_channel_admin(p_actor uuid,p_permission text) returns void language plpgsql security definer set search_path='' as $$ begin
 if auth.role() is distinct from 'service_role' or not exists(select 1 from public.admin_users where id=p_actor and is_active and(role='owner' or coalesce((permissions->>p_permission)::boolean,false))) then raise exception using errcode='42501',message='Not authorized.';end if;
end $$;
create function public.sms_save_versioned_template(p_actor uuid,p_id uuid,p_revision integer,p_template jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.sms_templates;begin
 perform private.sms_channel_admin(p_actor,'sms.templates.manage');
 if p_id is not null then select * into t from public.sms_templates where id=p_id for update;if not found or t.revision<>p_revision then raise exception 'Template changed. Reload before saving.';end if;
 update public.sms_templates set code=p_template->>'code',name=p_template->>'name',category=p_template->>'category',text_en=p_template->>'text_en',text_ar=p_template->>'text_ar',traffic_type=p_template->>'traffic_type',is_enabled=(p_template->>'is_enabled')::boolean,sender=p_template->>'sender',variables=array(select jsonb_array_elements_text(p_template->'variables')),updated_by=p_actor,updated_at=clock_timestamp() where id=p_id returning * into t;
 else insert into public.sms_templates(code,name,category,text_en,text_ar,traffic_type,is_enabled,sender,variables,created_by,updated_by) values(p_template->>'code',p_template->>'name',p_template->>'category',p_template->>'text_en',p_template->>'text_ar',p_template->>'traffic_type',(p_template->>'is_enabled')::boolean,p_template->>'sender',array(select jsonb_array_elements_text(p_template->'variables')),p_actor,p_actor) returning * into t;end if;
 return to_jsonb(t);
end $$;
create table private.sms_tx_bindings(event_type text primary key,is_enabled boolean not null default false,template_id uuid references public.sms_templates(id),revision integer not null default 0);
create table private.sms_transactional_events(
 id uuid primary key default gen_random_uuid(),event_type text not null references private.sms_tx_bindings(event_type),source_id uuid not null,order_id uuid references public.customer_orders(id),
 recipient text not null,locale text not null check(locale in('en','ar')),variables jsonb not null,
 template_id uuid not null references public.sms_templates(id),template_revision integer not null,settings_revision integer not null,binding_revision integer not null,
 state text not null default 'ready' check(state in('ready','processing','queued','suppressed')),reason text not null default '',attempts integer not null default 0,lease_token uuid,lease_until timestamptz,batch_id uuid references public.sms_batches(id),created_at timestamptz not null default now(),unique(event_type,source_id)
);
create function public.sms_transactional_settings(p_actor uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
 perform private.sms_channel_admin(p_actor,'sms.settings.view');return jsonb_build_object('controls',(select to_jsonb(c) from private.sms_channel_controls c where id),'bindings',(select coalesce(jsonb_agg(b order by event_type),'[]') from private.sms_tx_bindings b),'invoice_source_available',to_regclass('private.daftra_invoices') is not null);
end $$;
create function public.sms_configure_transactional(p_actor uuid,p_revision integer,p_enabled boolean,p_bindings jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.sms_channel_controls;b jsonb;t public.sms_templates;begin
 perform private.sms_channel_admin(p_actor,'sms.settings.manage');select * into c from private.sms_channel_controls where id for update;
 if c.revision<>p_revision or p_enabled is null or jsonb_typeof(p_bindings)<>'array' or jsonb_array_length(p_bindings)>7 then raise exception 'Notification settings changed.';end if;
 for b in select value from jsonb_array_elements(p_bindings) loop
  if not exists(select 1 from private.sms_tx_bindings where event_type=b->>'event_type') then raise exception 'Unknown notification event.';end if;
  if (b->>'is_enabled')::boolean then
   select * into t from public.sms_templates where id=(b->>'template_id')::uuid;
   if not found or not t.is_enabled or t.traffic_type<>'notification' or t.text_en='' or t.text_ar='' then raise exception 'Choose an enabled bilingual notification template.';end if;
   if not (t.variables <@ (case when b->>'event_type'='invoice_available' then array['invoice_number','invoice_url'] when b->>'event_type' in('payment_failed','transfer_under_review','transfer_rejected') then array['checkout_reference'] else array['order_number'] end)) then raise exception 'Template placeholders do not match the event.';end if;
   if b->>'event_type'='invoice_available' and to_regclass('private.daftra_invoices') is null then raise exception 'Install verified invoice access first.';end if;
  end if;
  update private.sms_tx_bindings set is_enabled=(b->>'is_enabled')::boolean,template_id=nullif(b->>'template_id','')::uuid,revision=revision+1 where event_type=b->>'event_type';
 end loop;
 if p_enabled and exists(select 1 from public.sms_order_event_settings where is_enabled and event_type in('order_confirmed','payment_confirmed')) and exists(select 1 from private.sms_tx_bindings where is_enabled and event_type in('cod_confirmed','prepaid_confirmed','transfer_verified')) then raise exception 'Disable overlapping legacy order notifications first.';end if;
 update private.sms_channel_controls set transactional_enabled=p_enabled,enabled_since=case when p_enabled and not c.transactional_enabled then clock_timestamp() else c.enabled_since end,revision=revision+1,updated_by=p_actor where id;
 return public.sms_transactional_settings(p_actor);
end $$;
-- Both configuration directions reject overlapping order-confirmation producers.
create function private.sms_legacy_overlap_guard() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.is_enabled and new.event_type in('order_confirmed','payment_confirmed') and exists(select 1 from private.sms_channel_controls where id and transactional_enabled) and exists(select 1 from private.sms_tx_bindings where is_enabled and event_type in('cod_confirmed','prepaid_confirmed','transfer_verified')) then raise exception 'Disable overlapping verified notifications first.';end if;return new;
end $$;
create trigger sms_legacy_overlap_guard before insert or update on public.sms_order_event_settings for each row execute function private.sms_legacy_overlap_guard();
create function private.sms_verified_paid(p_order uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.customer_orders o join private.payment_checkout_funds f on f.session_id=o.checkout_session_id and f.is_primary and f.amount_minor=o.total_amount*100 and f.currency=o.currency
 where o.id=p_order and o.payment_status='paid' and o.amount_paid=o.total_amount and o.paid_at is not null and o.status not in('cancelled','refunded','returned') and(
 f.kind='instapay' and f.reviewed_by is not null or f.kind='paymob' and exists(select 1 from private.payment_checkout_attempts a join private.payment_callback_inbox i on i.transaction_id=f.reference where a.session_id=o.checkout_session_id and a.mode='live' and a.status='succeeded' and i.mode='live' and i.status='succeeded' and i.processed and i.provider_order_id=a.provider_order_id and i.integration_id=a.integration_id and i.amount_minor=f.amount_minor and i.currency=f.currency and i.evidence_sha256 is not null and(i.signature_sha256 is not null or a.inquiry_transaction_id=i.transaction_id and a.inquiry_evidence_sha256=i.evidence_sha256 and a.inquiry_checked_at is not null))));
$$;
create function private.sms_tx_emit(p_kind text,p_source uuid,p_order uuid,p_phone text,p_locale text,p_variables jsonb) returns void language plpgsql security definer set search_path='' as $$
declare c private.sms_channel_controls;b private.sms_tx_bindings;t public.sms_templates;begin
 select * into c from private.sms_channel_controls where id;if not c.transactional_enabled then return;end if;
 select * into b from private.sms_tx_bindings where event_type=p_kind and is_enabled;if not found then return;end if;
 select * into t from public.sms_templates where id=b.template_id and is_enabled and traffic_type='notification';if not found then return;end if;
 insert into private.sms_transactional_events(event_type,source_id,order_id,recipient,locale,variables,template_id,template_revision,settings_revision,binding_revision)
 values(p_kind,p_source,p_order,p_phone,case when p_locale='ar' then 'ar' else 'en' end,p_variables,t.id,t.revision,c.revision,b.revision) on conflict(event_type,source_id) do nothing;
end $$;
create function public.sms_capture_transactional() returns integer language plpgsql security definer set search_path='' as $$
declare c private.sms_channel_controls;o public.customer_orders;r record;v record;n integer:=0;kind text;begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server authorization required.';end if;
 select * into c from private.sms_channel_controls where id;if not c.transactional_enabled then return 0;end if;
 for o in select * from public.customer_orders where created_at>=c.enabled_since and created_at>=clock_timestamp()-interval '24 hours' and ((payment_method='cash' and payment_status<>'paid' and status in('processing','in_progress','being_shipped','out_for_delivery','completed','delivered')) or private.sms_verified_paid(id)) and not exists(select 1 from private.sms_transactional_events e where e.source_id=customer_orders.id and e.event_type in('cod_confirmed','prepaid_confirmed','transfer_verified')) order by created_at limit 100 loop
  kind:=null;
  if o.payment_method='cash' and o.payment_status<>'paid' and o.status in('processing','in_progress','being_shipped','out_for_delivery','completed','delivered') then kind:='cod_confirmed';
  elsif private.sms_verified_paid(o.id) then kind:=case when o.payment_method='instapay' then 'transfer_verified' else 'prepaid_confirmed' end;end if;
  if kind is not null then perform private.sms_tx_emit(kind,o.id,o.id,o.phone,o.sms_locale,jsonb_build_object('order_number',o.order_number));n:=n+1;end if;
 end loop;
 for r in select s.id,s.snapshot,s.reference,t.proof_id,t.state,t.reviewed_by from private.payment_checkout_sessions s join private.transfer_submissions t on t.session_id=s.id join private.transfer_proofs p on p.id=t.proof_id and p.state='ready' where s.created_at>=c.enabled_since and t.state in('under_review','rejected') and not exists(select 1 from private.sms_transactional_events e where e.source_id=t.proof_id and e.event_type=case when t.state='under_review' then 'transfer_under_review' else 'transfer_rejected' end) order by s.created_at limit 100 loop
  if r.state='under_review' or r.state='rejected' and r.reviewed_by is not null then perform private.sms_tx_emit(case when r.state='under_review' then 'transfer_under_review' else 'transfer_rejected' end,r.proof_id,null,r.snapshot#>>'{order,phone}',r.snapshot#>>'{order,locale}',jsonb_build_object('checkout_reference',r.reference));n:=n+1;end if;
 end loop;
 for r in select a.id,s.snapshot,s.reference from private.payment_checkout_attempts a join private.payment_checkout_sessions s on s.id=a.session_id where a.created_at>=c.enabled_since and a.mode='live' and a.status='failed' and not exists(select 1 from private.sms_transactional_events e where e.source_id=a.id and e.event_type='payment_failed') and exists(select 1 from private.payment_callback_inbox i where i.provider_order_id=a.provider_order_id and i.integration_id=a.integration_id and i.amount_minor=a.amount_minor and i.currency=a.currency and i.mode='live' and i.status='failed' and i.processed and i.signature_sha256 is not null and i.evidence_sha256 is not null) order by a.created_at limit 100 loop
  perform private.sms_tx_emit('payment_failed',r.id,null,r.snapshot#>>'{order,phone}',r.snapshot#>>'{order,locale}',jsonb_build_object('checkout_reference',r.reference));n:=n+1;
 end loop;
 if to_regclass('private.daftra_invoices') is not null then
  for v in execute 'select i.id,i.order_id,i.snapshot,l.user_id,o.phone,o.sms_locale from private.daftra_invoices i join private.daftra_client_links l on l.id=i.client_link_id and l.revoked_at is null join public.customer_orders o on o.id=i.order_id and o.user_id=l.user_id where i.state=''issued'' and i.account_url=(select account_url from public.erp_provider_settings where id=''daftra'') and jsonb_array_length(public.daftra_owned_invoices(l.user_id,i.id,1,0))=1 and not exists(select 1 from private.sms_transactional_events e where e.source_id=i.id and e.event_type=''invoice_available'') and(select min(a.created_at) from private.daftra_invoice_audit a where a.invoice_id=i.id)>=$1 order by i.synced_at limit 100' using c.enabled_since loop
   perform private.sms_tx_emit('invoice_available',v.id,v.order_id,v.phone,v.sms_locale,jsonb_build_object('invoice_number',v.snapshot->>'number','invoice_path','/account/invoices/'||v.id::text));n:=n+1;
  end loop;
 end if;return n;
end $$;
create function private.sms_tx_authorized(p_id uuid) returns boolean language plpgsql stable security definer set search_path='' as $$
declare e private.sms_transactional_events;ok boolean:=false;begin
 select * into e from private.sms_transactional_events where id=p_id;if not found or e.state='suppressed' then return false;end if;
 if not exists(select 1 from private.sms_channel_controls c join private.sms_tx_bindings b on b.event_type=e.event_type join public.sms_templates t on t.id=e.template_id where c.id and c.transactional_enabled and c.revision=e.settings_revision and b.is_enabled and b.revision=e.binding_revision and b.template_id=e.template_id and t.is_enabled and t.revision=e.template_revision) then return false;end if;
 if e.event_type in('cod_confirmed','prepaid_confirmed','transfer_verified') then
  return exists(select 1 from public.customer_orders o where o.id=e.order_id and o.phone=e.recipient and o.status not in('cancelled','returned','refunded') and(case when e.event_type='cod_confirmed' then o.payment_method='cash' and o.payment_status<>'paid' else private.sms_verified_paid(o.id) end));
 elsif e.event_type in('transfer_under_review','transfer_rejected') then
  return exists(select 1 from private.transfer_proofs p join private.transfer_submissions t on t.proof_id=p.id join private.payment_checkout_sessions s on s.id=t.session_id where p.id=e.source_id and s.snapshot#>>'{order,phone}'=e.recipient and(case when e.event_type='transfer_under_review' then t.state='under_review' else t.state='rejected' and t.reviewed_by is not null end));
 elsif e.event_type='payment_failed' then return exists(select 1 from private.payment_checkout_attempts a join private.payment_checkout_sessions s on s.id=a.session_id where a.id=e.source_id and a.status='failed' and s.snapshot#>>'{order,phone}'=e.recipient);
 elsif e.event_type='invoice_available' and to_regclass('private.daftra_invoices') is not null then
  execute 'select exists(select 1 from private.daftra_invoices i join private.daftra_client_links l on l.id=i.client_link_id and l.revoked_at is null join public.customer_orders o on o.id=i.order_id and o.user_id=l.user_id where i.id=$1 and i.state=''issued'' and o.phone=$2 and jsonb_array_length(public.daftra_owned_invoices(l.user_id,i.id,1,0))=1 and i.account_url=(select account_url from public.erp_provider_settings where id=''daftra''))' into ok using e.source_id,e.recipient;return ok;
 end if;return false;
end $$;
create function public.sms_claim_transactional() returns jsonb language plpgsql security definer set search_path='' as $$
declare e private.sms_transactional_events;t public.sms_templates;begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server authorization required.';end if;
 update private.sms_transactional_events set state='suppressed',reason='claim_limit' where state='processing' and lease_until<clock_timestamp() and attempts>=3;
 update private.sms_transactional_events set state='ready',lease_token=null where state='processing' and lease_until<clock_timestamp() and batch_id is null;
 select * into e from private.sms_transactional_events where state='ready' order by created_at for update skip locked limit 1;if not found then return null;end if;
 if not private.sms_tx_authorized(e.id) then update private.sms_transactional_events set state='suppressed',reason='source_or_configuration_changed' where id=e.id;return null;end if;
 update private.sms_transactional_events set state='processing',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '1 minute' where id=e.id returning * into e;
 select * into t from public.sms_templates where id=e.template_id;return to_jsonb(e)||jsonb_build_object('template_text',case when e.locale='ar' then t.text_ar else t.text_en end,'sender',t.sender);
end $$;
create function public.sms_enqueue_transactional(p_id uuid,p_token uuid,p_batch jsonb,p_messages jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare e private.sms_transactional_events;r jsonb;digits text;begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server authorization required.';end if;
 select * into e from private.sms_transactional_events where id=p_id for update;
 if not found or e.state<>'processing' or e.lease_token is distinct from p_token or e.lease_until<clock_timestamp() or not private.sms_tx_authorized(e.id) or p_batch->>'idempotency_key'<>'tx:'||e.id::text or p_batch->>'traffic_type'<>'notification' or jsonb_array_length(p_messages)<>1 then raise exception 'Notification source changed.';end if;
 digits:=regexp_replace(e.recipient,'[^0-9]','','g');if digits like '00%' then digits:=substr(digits,3);end if;
 if digits~'^01[0125][0-9]{8}$' then digits:='20'||substr(digits,2);elsif digits~'^1[0125][0-9]{8}$' then digits:='20'||digits;end if;
 if digits!~'^201[0125][0-9]{8}$' or p_messages#>>'{0,recipient}'<>'+'||digits then raise exception 'Notification recipient does not match its source.';end if;
 r:=public.sms_enqueue(p_batch,p_messages);update private.sms_transactional_events set state='queued',batch_id=(r->>'id')::uuid,lease_token=null,lease_until=null where id=e.id;return r;
end $$;
alter function public.sms_check_dispatch(uuid,uuid,integer) rename to sms_check_dispatch_before_channels;
create function public.sms_check_dispatch(p_id uuid,p_token uuid,p_revision integer) returns boolean language plpgsql security definer set search_path='' as $$
declare ok boolean;e uuid;begin
 ok:=public.sms_check_dispatch_before_channels(p_id,p_token,p_revision);if ok is distinct from true then return ok;end if;
 if exists(select 1 from public.sms_batches where id=p_id and traffic_type='notification') and not(select transactional_enabled from private.sms_channel_controls where id) then return false;end if;
 select id into e from private.sms_transactional_events where batch_id=p_id;if found then return private.sms_tx_authorized(e);end if;return true;
end $$;
create function public.sms_channel_state() returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server authorization required.';end if;
 return(select jsonb_build_object('transactionalEnabled',transactional_enabled,'revision',revision) from private.sms_channel_controls where id);
end $$;
revoke all on function public.sms_check_dispatch_before_channels(uuid,uuid,integer) from public,anon,authenticated,service_role;
create function public.sms_suppress_transactional(p_id uuid,p_token uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$ begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server authorization required.';end if;
 update private.sms_transactional_events set state='suppressed',reason=left(p_reason,60),lease_token=null,lease_until=null where id=p_id and state='processing' and lease_token=p_token;
end $$;
do $$ declare body text;begin
 body:=pg_get_functiondef('public.sms_claim_before_order_sms()'::regprocedure);
 if position('where status=''queued'' and available_at<=clock_timestamp()' in body)=0 then raise exception 'SMS claim contract changed.';end if;
 body:=replace(body,'FUNCTION public.sms_claim_before_order_sms()','FUNCTION public.sms_claim_for_channels(p_types text[])');
 body:=replace(body,'where status=''queued'' and available_at<=clock_timestamp()','where status=''queued'' and traffic_type=any(p_types) and available_at<=clock_timestamp()');execute body;
end $$;
do $$ declare n text;f record;begin
 foreach n in array array['sms_channel_controls','sms_template_versions','sms_tx_bindings','sms_transactional_events'] loop execute format('alter table private.%I enable row level security',n);execute format('revoke all on private.%I from public,anon,authenticated',n);execute format('grant select on private.%I to service_role',n);end loop;
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('sms_save_versioned_template','sms_transactional_settings','sms_configure_transactional','sms_capture_transactional','sms_claim_transactional','sms_enqueue_transactional','sms_check_dispatch','sms_suppress_transactional','sms_claim_for_channels','sms_channel_state') loop execute format('revoke all on function %s from public,anon,authenticated',f.sig);execute format('grant execute on function %s to service_role',f.sig);end loop;
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in('sms_legacy_overlap_guard','sms_channel_admin','sms_version_template','sms_verified_paid','sms_tx_emit','sms_tx_authorized') loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);end loop;
end $$;
insert into public.sms_templates(code,name,category,text_en,text_ar,traffic_type,is_enabled,variables) values
('tx_cod_confirmed','COD confirmed','transactional','COD order {{order_number}} is confirmed. Payment is due on collection.','تم تأكيد طلب {{order_number}}. الدفع عند الاستلام.','notification',false,array['order_number']),
('tx_prepaid_confirmed','Verified payment','transactional','Payment is verified. Order {{order_number}} is confirmed.','تم التحقق من الدفع وتأكيد الطلب {{order_number}}.','notification',false,array['order_number']),
('tx_payment_failed','Definitive payment failure','transactional','Payment attempt {{checkout_reference}} failed. Check your account.','فشلت محاولة الدفع {{checkout_reference}}. راجع حسابك.','notification',false,array['checkout_reference']),
('tx_transfer_under_review','Transfer review','transactional','Transfer {{checkout_reference}} is under review and remains unpaid.','التحويل {{checkout_reference}} قيد المراجعة ولم يتم تأكيد الدفع.','notification',false,array['checkout_reference']),
('tx_transfer_verified','Verified transfer','transactional','Transfer verified. Order {{order_number}} is confirmed.','تم التحقق من التحويل وتأكيد الطلب {{order_number}}.','notification',false,array['order_number']),
('tx_transfer_rejected','Rejected transfer proof','transactional','Transfer evidence {{checkout_reference}} was rejected. Check your account.','رفض مستند التحويل {{checkout_reference}}. راجع حسابك.','notification',false,array['checkout_reference']),
('tx_invoice_available','Invoice available','transactional','Invoice {{invoice_number}} is available: {{invoice_url}}','الفاتورة {{invoice_number}} متاحة: {{invoice_url}}','notification',false,array['invoice_number','invoice_url']),
('tx_shipment_booked','Shipment booked','transactional','Shipment {{awb}} for order {{order_number}} is booked.','تم تسجيل الشحنة {{awb}} للطلب {{order_number}}.','notification',false,array['awb','order_number']),
('tx_shipment_dispatched','Shipment dispatched','transactional','Shipment {{awb}} for order {{order_number}} is on its way.','الشحنة {{awb}} للطلب {{order_number}} في الطريق.','notification',false,array['awb','order_number']),
('tx_shipment_delivered','Verified delivery','transactional','Delivery is confirmed for order {{order_number}}, shipment {{awb}}.','تم تأكيد تسليم الطلب {{order_number}}، الشحنة {{awb}}.','notification',false,array['awb','order_number']),
('tx_refund_update','Verified refund update','transactional','A verified refund update is available for order {{order_number}}. Check your account.','يوجد تحديث موثق للاسترداد للطلب {{order_number}}. راجع حسابك.','notification',false,array['order_number']);
insert into private.sms_tx_bindings(event_type,template_id)
select substr(code,4),id from public.sms_templates where code in('tx_cod_confirmed','tx_prepaid_confirmed','tx_payment_failed','tx_transfer_under_review','tx_transfer_verified','tx_transfer_rejected','tx_invoice_available');
commit;
