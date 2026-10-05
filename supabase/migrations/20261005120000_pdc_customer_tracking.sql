begin;

-- Extend the existing PDC subsystem; retain all historic jobs/events/aliases.
alter table public.shipping_provider_settings
  add column api_mode text not null default 'production' check (api_mode in ('production','test')),
  add column status_timezone text not null default 'Africa/Cairo',
  add column cities_cache jsonb not null default '[]'::jsonb check (jsonb_typeof(cities_cache) = 'array'),
  add column products_cache jsonb not null default '[]'::jsonb check (jsonb_typeof(products_cache) = 'array'),
  add column cities_synced_at timestamptz,
  add column products_synced_at timestamptz,
  add column lookup_attempted_at timestamptz;
alter table public.shipping_provider_settings drop constraint shipping_provider_settings_base_url_check;
alter table public.shipping_provider_settings add constraint shipping_provider_settings_base_url_check check (
  (api_mode = 'production' and base_url = 'https://clientsapi.pdc-eg.com/api/ClientUsers/V6/') or
  (api_mode = 'test' and base_url = 'https://clientsapi-test.pdc-eg.com/api/ClientUsers/V6/')
);

create function public.shipping_valid_state(p_state text) returns boolean
language sql immutable set search_path = '' as $$
  select p_state = any(array['registered','picked_up','in_transit','arrived_at_hub','out_for_delivery','delivered',
    'delivery_attempted','delayed','rescheduled','held','returning','returned','cancelled','lost','damaged','partial_delivery','unknown']);
$$;
alter table public.shipping_status_mappings
  add column normalized_state text not null default 'unknown' check (public.shipping_valid_state(normalized_state)),
  add column provider_aliases text[] not null default '{}';

-- Seed only the new presentation fields. Old provider/order mappings are retained.
update public.shipping_status_mappings set normalized_state = case
  when provider_status_id in (2,82,83,88,93) then 'in_transit'
  when provider_status_id in (3,84,85,98) then 'arrived_at_hub'
  when provider_status_id = 4 then 'out_for_delivery'
  when provider_status_id = 5 then 'delivered'
  when provider_status_id in (7,77) then 'returning'
  when provider_status_id = 8 then 'returned'
  when provider_status_id = 9 then 'lost'
  when provider_status_id = 10 then 'damaged'
  when provider_status_id = 13 then 'registered'
  when provider_status_id = 12 then 'picked_up'
  when provider_status_id in (14,91) then 'delayed'
  when provider_status_id in (15,87,89,90) then 'delivery_attempted'
  when provider_status_id = 19 then 'rescheduled'
  when provider_status_id = 24 then 'partial_delivery'
  when provider_status_id in (92,94,95,96) then 'held'
  else 'unknown' end where provider = 'pdc';
update public.shipping_status_mappings set provider_aliases = array['Transfer To Branch','In Transit-Departed'] where provider = 'pdc' and provider_status_id = 2;
update public.shipping_status_mappings set provider_aliases = array['Received At Branch','In Transit-Arrived'] where provider = 'pdc' and provider_status_id = 3;
update public.shipping_status_mappings set provider_aliases = array['Out For Delivery'] where provider = 'pdc' and provider_status_id = 4;
update public.shipping_status_mappings set provider_aliases = array['shipment Delivered','Shipment Delivered'] where provider = 'pdc' and provider_status_id = 5;
update public.shipping_status_mappings set provider_aliases = array['Not Delivered'] where provider = 'pdc' and provider_status_id = 15;
update public.shipping_status_mappings set provider_aliases = array['To Be Returned'] where provider = 'pdc' and provider_status_id = 7;
update public.shipping_status_mappings set provider_aliases = array['Returned','Returned To Shipper'] where provider = 'pdc' and provider_status_id = 8;
update public.shipping_status_mappings set provider_aliases = array['Lost','Shipment Lost'] where provider = 'pdc' and provider_status_id = 9;
update public.shipping_status_mappings set provider_aliases = array['Damaged','Package issue'] where provider = 'pdc' and provider_status_id = 10;
update public.shipping_status_mappings set provider_aliases = array['Reoperate','Re-Operate'] where provider = 'pdc' and provider_status_id = 11;
update public.shipping_status_mappings set provider_aliases = array['Collected','Picked Up'] where provider = 'pdc' and provider_status_id = 12;
update public.shipping_status_mappings set provider_aliases = array['New Pickup'] where provider = 'pdc' and provider_status_id = 13;
update public.shipping_status_mappings set provider_aliases = array['Postponed'] where provider = 'pdc' and provider_status_id = 14;
update public.shipping_status_mappings set provider_aliases = array['Reschedule'] where provider = 'pdc' and provider_status_id = 19;
update public.shipping_status_mappings set provider_aliases = array['Partial Delivery'] where provider = 'pdc' and provider_status_id = 24;
update public.shipping_status_mappings set provider_aliases = array['Received At Hub','Received From Courier after attempt','Recived At Hub'] where provider = 'pdc' and provider_status_id = 97;
update public.shipping_status_mappings set provider_aliases = array['In Transit'] where provider = 'pdc' and provider_status_id = 82;
update public.shipping_status_mappings set provider_aliases = array['Recieved','on the way to Destination Hub'] where provider = 'pdc' and provider_status_id = 83;
update public.shipping_status_mappings set provider_aliases = array['Received','Recived At Hub'] where provider = 'pdc' and provider_status_id = 84;
update public.shipping_status_mappings set provider_aliases = array['In Transit','Received At Destination Hub'] where provider = 'pdc' and provider_status_id = 85;
update public.shipping_status_mappings set provider_aliases = array['Under Return Process','In Transit - Undelivered'] where provider = 'pdc' and provider_status_id = 77;
update public.shipping_status_mappings set provider_aliases = array['In Transit - Undelivered'] where provider = 'pdc' and provider_status_id = 87;
update public.shipping_status_mappings set provider_aliases = array['In Transit','In Transit to Destination Hub'] where provider = 'pdc' and provider_status_id = 88;
update public.shipping_status_mappings set provider_aliases = array['In Transit - Undelivered'] where provider = 'pdc' and provider_status_id = 89;
update public.shipping_status_mappings set provider_aliases = array['In Transit - Undelivered'] where provider = 'pdc' and provider_status_id = 90;
update public.shipping_status_mappings set provider_aliases = array['Wrong Sort'] where provider = 'pdc' and provider_status_id = 91;
update public.shipping_status_mappings set provider_aliases = array['Unclear Address'] where provider = 'pdc' and provider_status_id = 92;
update public.shipping_status_mappings set provider_aliases = array['3PL International Shipment'] where provider = 'pdc' and provider_status_id = 93;
update public.shipping_status_mappings set provider_aliases = array['Hold At Warehouse'] where provider = 'pdc' and provider_status_id = 94;
update public.shipping_status_mappings set provider_aliases = array['On Hold','Packaging and extra weights'] where provider = 'pdc' and provider_status_id = 95;
update public.shipping_status_mappings set provider_aliases = array['Hold for Update'] where provider = 'pdc' and provider_status_id = 96;
update public.shipping_status_mappings set provider_aliases = array['Recived At Hub'] where provider = 'pdc' and provider_status_id = 98;

-- These are the explicit default CustomerStatusName values in the review file.
-- Name-only API results can resolve those configured labels without inventing IDs.
update public.shipping_status_mappings m set provider_aliases = array(
  select distinct a from unnest(m.provider_aliases || array[labels.label]) a
) from (values ('registered','Shipment registered'),('picked_up','Handed to courier'),('in_transit','In transit'),('arrived_at_hub','Arrived at hub'),('out_for_delivery','Out for delivery'),('delivered','Delivered'),('delivery_attempted','Delivery attempted'),('delayed','Delivery delayed'),('rescheduled','Delivery rescheduled'),('held','Shipment held'),('returning','Returning to sender'),('returned','Returned'),('cancelled','Shipment cancelled'),('lost','Shipment lost'),('damaged','Shipment damaged'),('partial_delivery','Partially delivered')) labels(state,label)
where m.provider='pdc' and m.normalized_state=labels.state;

alter table public.shipping_order_jobs
  add column normalized_state text not null default 'unknown' check (public.shipping_valid_state(normalized_state)),
  add column provider_status_source text not null default 'legacy' check (provider_status_source in ('legacy','webhook','reconciliation')),
  add column provider_status_observed_at timestamptz,
  add column reconciliation_attempted_at timestamptz;
alter table public.shipping_webhook_events
  alter column provider_status_id drop not null,
  add column shipment_job_id uuid references public.shipping_order_jobs(id) on delete cascade,
  add column normalized_state text not null default 'unknown' check (public.shipping_valid_state(normalized_state)),
  add column source text not null default 'legacy' check (source in ('legacy','webhook','reconciliation'));
-- Old timestamp-based duplicates remain intact. New numeric events use vendor AWB+StatusID.
create unique index shipping_events_pdc_status_uidx
  on public.shipping_webhook_events(provider,awb,provider_status_id)
  where source <> 'legacy' and provider_status_id is not null;
create index shipping_events_history_idx on public.shipping_webhook_events(provider,order_ref,awb,status_date,received_at)
  where processed_at is not null;

create function public.shipping_resolve_pdc_state(p_id integer, p_name text) returns text
language plpgsql stable security definer set search_path = '' as $$
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

create function public.shipping_record_pdc_event(p_update jsonb) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '4s' set lock_timeout = '2s' as $$
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

create function public.shipping_claim_pdc_refresh(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '4s' set lock_timeout = '2s' as $$
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

create function public.shipping_claim_pdc_lookup() returns boolean
language plpgsql security definer set search_path = '' set statement_timeout = '4s' set lock_timeout = '2s' as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required'; end if;
  update public.shipping_provider_settings set lookup_attempted_at=clock_timestamp()
    where id='pdc' and (lookup_attempted_at is null or lookup_attempted_at <= clock_timestamp()-interval '1 minute');
  return found;
end;
$$;

create function public.shipping_can_receive_topic(p_topic text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.customer_orders o
    join public.customer_profiles p on p.id=o.user_id and p.is_active=true
    join auth.users u on u.id=o.user_id and u.is_anonymous=false
    where o.user_id=auth.uid() and p_topic='shipping:order:' || o.id::text);
$$;
revoke all on function public.shipping_valid_state(text) from public,anon,authenticated;
grant execute on function public.shipping_valid_state(text) to service_role;
revoke all on function public.shipping_resolve_pdc_state(integer,text),public.shipping_record_pdc_event(jsonb),
  public.shipping_claim_pdc_refresh(uuid),public.shipping_claim_pdc_lookup() from public,anon,authenticated;
grant execute on function public.shipping_resolve_pdc_state(integer,text),public.shipping_record_pdc_event(jsonb),
  public.shipping_claim_pdc_refresh(uuid),public.shipping_claim_pdc_lookup() to service_role;
revoke all on function public.shipping_can_receive_topic(text) from public,anon;
grant execute on function public.shipping_can_receive_topic(text) to authenticated;
create policy shipping_receive_broadcast on realtime.messages for select to authenticated
  using (extension='broadcast' and topic=realtime.topic() and public.shipping_can_receive_topic(realtime.topic()));

commit;
