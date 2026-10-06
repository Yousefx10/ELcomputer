-- Local PDC -> central Notification integration. No backfill or activation.
begin;

alter table public.sms_order_event_settings drop constraint sms_order_event_settings_event_type_check;
alter table public.sms_order_event_settings add constraint sms_order_event_settings_event_type_check
  check (event_type in ('order_confirmed','payment_confirmed','processing','cancelled',
    'pdc_out_for_delivery','pdc_delivery_exception','pdc_delivered'));
alter table public.sms_order_event_settings add column capture_started_at timestamptz not null default clock_timestamp();
alter table public.sms_order_events drop constraint sms_order_events_event_type_check;
alter table public.sms_order_events add constraint sms_order_events_event_type_check
  check (event_type in ('order_confirmed','payment_confirmed','processing','cancelled',
    'pdc_out_for_delivery','pdc_delivery_exception','pdc_delivered'));
alter table public.sms_order_events
  add column shipment_job_id uuid references public.shipping_order_jobs(id) on delete set null,
  add column shipment_awb text,
  add column tracking_event_id uuid references public.shipping_webhook_events(id) on delete set null,
  add column provider_event_at timestamptz;
alter table public.sms_order_events drop constraint sms_order_events_order_id_event_type_key;
create unique index sms_order_events_order_identity on public.sms_order_events(order_id,event_type)
  where event_type in ('order_confirmed','payment_confirmed','processing','cancelled');
create unique index sms_order_events_shipment_identity on public.sms_order_events(shipment_job_id,shipment_awb,event_type)
  where shipment_job_id is not null;
create index sms_order_events_order_link on public.sms_order_events(order_id);
create index sms_order_events_tracking_link on public.sms_order_events(tracking_event_id) where tracking_event_id is not null;
alter table public.sms_order_events drop constraint sms_order_events_reason_check;
alter table public.sms_order_events add constraint sms_order_events_reason_check check (reason in (
  'provider_disabled','provider_not_ready','event_disabled','configuration_changed','template_unavailable',
  'order_removed','expired','invalid_phone','invalid_template','segment_limit','storage_error','capture_failed',
  'shipment_changed','event_time_unknown','stale_event'));

insert into public.sms_templates(code,name,category,text_en,text_ar,traffic_type,variables) values
  ('pdc_out_for_delivery','PDC out for delivery','pdc','Order {{order_number}} is out for delivery. PDC tracking: {{awb}}.','الطلب {{order_number}} خرج للتسليم. رقم تتبع PDC: {{awb}}.','notification',array['order_number','awb']),
  ('pdc_delivery_exception','PDC delivery exception','pdc','PDC could not deliver order {{order_number}}. {{delivery_reason}}. Tracking: {{awb}}.','تعذر على PDC تسليم الطلب {{order_number}}. {{delivery_reason}}. رقم التتبع: {{awb}}.','notification',array['order_number','delivery_reason','awb']),
  ('pdc_delivered','PDC delivered','pdc','PDC delivered order {{order_number}}. Tracking: {{awb}}.','تم تسليم الطلب {{order_number}} بواسطة PDC. رقم التتبع: {{awb}}.','notification',array['order_number','awb'])
on conflict(code) do nothing;
insert into public.sms_order_event_settings(event_type,template_en_id,template_ar_id)
select t.code,t.id,t.id from public.sms_templates t
where t.code in ('pdc_out_for_delivery','pdc_delivery_exception','pdc_delivered');

-- Preserve all Order SMS authorization, then add shipment-specific freshness.
alter function public.sms_order_event_reason(public.sms_order_events) rename to sms_order_event_reason_before_pdc_sms;
create function public.sms_order_event_reason(e public.sms_order_events) returns text
language plpgsql stable security definer set search_path='' as $$
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

-- Extend the one canonical durable source used by webhook AND reconciliation.
-- Keep its REF/AWB authentication, deduplication, ordering, Broadcast and response.
alter function public.shipping_record_pdc_event(jsonb) rename to shipping_record_pdc_event_before_sms;
create function public.shipping_record_pdc_event(p_update jsonb) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
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
end $$;

revoke all on function public.sms_order_event_reason_before_pdc_sms(public.sms_order_events),
  public.shipping_record_pdc_event_before_sms(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.sms_order_event_reason(public.sms_order_events),
  public.shipping_record_pdc_event(jsonb) from public,anon,authenticated;
grant execute on function public.sms_order_event_reason(public.sms_order_events),
  public.shipping_record_pdc_event(jsonb) to service_role;
notify pgrst,'reload schema';
commit;
