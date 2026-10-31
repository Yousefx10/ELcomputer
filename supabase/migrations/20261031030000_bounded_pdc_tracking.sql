--107: tracking only. No provider activation, booking, old-order backfill or financial writes.
begin;
set local lock_timeout='5s';set local statement_timeout='60s';
create function private.pdc_tracking_policy_valid(p jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text;v integer;
begin
 if jsonb_typeof(p)<>'object' or jsonb_typeof(p->'enabled') is distinct from 'boolean' then return false;end if;
 if (select count(*) from jsonb_object_keys(p))<>10 then return false;end if;
 foreach k in array array['interval_seconds','max_requests_minute','max_requests_hour','max_requests_day','batch_size','concurrency','max_failures','max_age_days','stale_seconds'] loop
  if not (p ? k) or jsonb_typeof(p->k)<>'number' or (p->>k)!~'^[0-9]+$' then return false;end if;v:=(p->>k)::integer;
  if not (case k when 'interval_seconds' then v between 300 and 86400 when 'max_requests_minute' then v between 1 and 5
   when 'max_requests_hour' then v between 1 and 60 when 'max_requests_day' then v between 1 and 500
   when 'batch_size' then v between 1 and 5 when 'concurrency' then v between 1 and 2 when 'max_failures' then v between 1 and 8
   when 'max_age_days' then v between 7 and 180 when 'stale_seconds' then v between 600 and 172800 else false end) then return false;end if;
 end loop;return true;
exception when others then return false;
end $$;
alter table public.shipping_provider_settings
 add column tracking_policy jsonb not null default '{"enabled":false,"interval_seconds":900,"max_requests_minute":2,"max_requests_hour":20,"max_requests_day":100,"batch_size":3,"concurrency":1,"max_failures":8,"max_age_days":90,"stale_seconds":3600}',
 add column tracking_request_times timestamptz[] not null default '{}',
 add constraint shipping_tracking_policy_valid check(private.pdc_tracking_policy_valid(tracking_policy)),
 add constraint shipping_tracking_counters_valid check(cardinality(tracking_request_times)<=500 and array_position(tracking_request_times,null) is null);
alter table public.shipping_order_jobs
 add column awb_verified_at timestamptz,
 add column tracking_token uuid,add column tracking_lease_until timestamptz,add column tracking_next_at timestamptz,
 add column tracking_checked_at timestamptz,add column tracking_success_at timestamptz,
 add column tracking_failures integer not null default 0 check(tracking_failures between 0 and 100000),
 add column tracking_error_code text check(tracking_error_code in ('PROVIDER_UNAVAILABLE','IDENTITY_MISMATCH','INVALID_STATUS','TRACKING_DISABLED','PERSISTENCE_UNCERTAIN')),
 add column tracking_progress_rank smallint not null default 0 check(tracking_progress_rank between 0 and 70);
alter table public.shipping_webhook_events add column projection_disposition text not null default 'legacy'
 check(projection_disposition in ('legacy','current','stale','regression','conflict'));
create index shipping_tracking_due_idx on public.shipping_order_jobs(tracking_next_at,created_at)
 where provider='pdc' and awb is not null and state in ('ready','label_pending','submitting');
create index shipping_tracking_active_lease_idx on public.shipping_order_jobs(tracking_lease_until) where tracking_token is not null;

create function private.pdc_tracking_rank(p text) returns integer language sql immutable set search_path='' as $$
 select case p when 'registered' then 10 when 'picked_up' then 20 when 'in_transit' then 30 when 'arrived_at_hub' then 30
 when 'out_for_delivery' then 40 when 'delivery_attempted' then 40 when 'partial_delivery' then 50 when 'returning' then 60
 when 'delivered' then 70 when 'returned' then 70 when 'cancelled' then 70 when 'lost' then 70 when 'damaged' then 70 else 0 end
$$;
create function private.pdc_tracking_verified(p_job uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.role()='service_role' and exists(select 1 from public.shipping_order_jobs j join private.pdc_dispatches d
 on d.job_id=j.id and d.order_id=j.order_id and d.to_ref=j.to_ref and d.awb=j.awb and d.state='created'
 where j.id=p_job and j.provider='pdc' and j.state in ('ready','label_pending','submitting') and j.awb ~ '^[A-Za-z0-9][A-Za-z0-9-]{0,99}$'
 and j.provider_identity->>'api_mode'='production')
$$;
-- Timestamp actual verified future booking/recovery, never job creation or a historical backfill.
do $$declare d text;a text;begin
 d:=pg_get_functiondef('public.shipping_order_finish(uuid,uuid,text,text,text,bigint)'::regprocedure);
 a:='set state=''label_pending'',awb=p_awb,lease_until=null';
 if strpos(d,a)=0 then raise exception 'Booking timestamp anchor mismatch';end if;
 execute replace(d,a,'set state=''label_pending'',awb=p_awb,awb_verified_at=clock_timestamp(),lease_until=null');
 d:=pg_get_functiondef('public.shipping_order_recover(uuid,uuid,text,text,jsonb)'::regprocedure);
 a:='set state=''label_pending'',awb=p_awb,work_token=gen_random_uuid()';
 if strpos(d,a)=0 then raise exception 'Recovery timestamp anchor mismatch';end if;
 execute replace(d,a,'set state=''label_pending'',awb=p_awb,awb_verified_at=clock_timestamp(),work_token=gen_random_uuid()');
end $$;
-- Keep the existing atomic AWB+StatusID identity and ingestion; add proof and monotone projection.
do $$declare d text;a text;begin
 d:=pg_get_functiondef('public.shipping_record_pdc_event_before_sms(jsonb)'::regprocedure);
 a:='v_stale boolean;';if strpos(d,a)=0 then raise exception 'Tracking declaration anchor mismatch';end if;
 d:=replace(d,a,'v_stale boolean; v_regression boolean; v_mapping_conflict boolean; v_rank integer; v_previous_rank integer;');
 a:='if v_job.awb is null or v_job.awb <> p_update->>''awb'' then return jsonb_build_object(''error'',''awb_mismatch''); end if;';
 if strpos(d,a)=0 then raise exception 'Tracking identity anchor mismatch';end if;
 d:=replace(d,a,a||E'\n  if not private.pdc_tracking_verified(v_job.id) then return jsonb_build_object(''error'',''unverified_shipment'');end if;\n  if v_date>clock_timestamp()+interval ''5 minutes'' then return jsonb_build_object(''error'',''future_event'');end if;');
 a:='v_state := public.shipping_resolve_pdc_state(v_id,p_update->>''status_name'');';
 if strpos(d,a)=0 then raise exception 'Tracking mapping anchor mismatch';end if;
 d:=replace(d,a,a||E'\n  v_mapping_conflict:=v_id is not null and v_state<>''unknown'' and (nullif(btrim(p_update->>''status_name''),'''') is not null or private.pdc_tracking_rank(v_state)=70) and not exists(select 1 from public.shipping_status_mappings m where m.provider=''pdc'' and m.provider_status_id=v_id and exists(select 1 from unnest(m.provider_aliases||array[m.provider_label]) label where lower(btrim(label))=lower(btrim(p_update->>''status_name''))));\n  if v_mapping_conflict then v_state:=''unknown'';end if;');
 a:='if not v_stale then';if strpos(d,a)=0 then raise exception 'Tracking ordering anchor mismatch';end if;
 d:=replace(d,a,E'v_previous_rank:=greatest(v_job.tracking_progress_rank,private.pdc_tracking_rank(v_job.normalized_state));\n  v_rank:=private.pdc_tracking_rank(v_state);\n  v_regression:=v_mapping_conflict or (v_previous_rank=70 and v_state is distinct from v_job.normalized_state)\n   or (v_rank>0 and v_rank<v_previous_rank) or (v_rank=0 and v_state=''unknown'' and v_previous_rank>0);\n  update public.shipping_webhook_events set projection_disposition=case when v_mapping_conflict then ''conflict'' when v_regression then ''regression'' when v_stale and v_rank>v_previous_rank then ''conflict'' when v_stale then ''stale'' else ''current'' end where id=v_event.id;\n  if not v_stale and not v_regression then');
 a:='provider_status_source=v_source,provider_status_observed_at=v_observed,updated_at=clock_timestamp()';
 if strpos(d,a)=0 then raise exception 'Tracking progress anchor mismatch';end if;
 d:=replace(d,a,'provider_status_source=v_source,provider_status_observed_at=v_observed,tracking_progress_rank=greatest(v_previous_rank,v_rank),updated_at=clock_timestamp()');
 d:=replace(d,'jsonb_build_object(''received'',true,''stale'',v_stale)','jsonb_build_object(''received'',true,''stale'',v_stale,''regression'',v_regression)');
 execute d;
end $$;

create function public.shipping_claim_pdc_tracking(p_order_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
declare s public.shipping_provider_settings%rowtype;j public.shipping_order_jobs%rowtype;n timestamptz:=clock_timestamp();p jsonb;token uuid:=gen_random_uuid();
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501';end if;
 select * into s from public.shipping_provider_settings where id='pdc' for update;p:=s.tracking_policy;
 if not found or not s.is_enabled or not (p->>'enabled')::boolean or s.api_mode<>'production' then return jsonb_build_object('error','disabled');end if;
 if (select count(*) from public.shipping_order_jobs where tracking_token is not null and tracking_lease_until>n)>=(p->>'concurrency')::integer then return jsonb_build_object('error','busy');end if;
 if (select count(*) from unnest(s.tracking_request_times) t where t>n-interval '1 minute')>=(p->>'max_requests_minute')::integer
 or (select count(*) from unnest(s.tracking_request_times) t where t>n-interval '1 hour')>=(p->>'max_requests_hour')::integer
 or (select count(*) from unnest(s.tracking_request_times) t where t>n-interval '1 day')>=(p->>'max_requests_day')::integer then return jsonb_build_object('error','budget');end if;
 select q.* into j from public.shipping_order_jobs q join public.customer_orders o on o.id=q.order_id
 where q.provider='pdc' and q.awb is not null and q.state in ('ready','label_pending','submitting') and (p_order_id is null or q.order_id=p_order_id) and private.pdc_tracking_verified(q.id)
 and o.status<>'cancelled' and q.provider_identity=jsonb_build_object('base_url',s.base_url,'api_mode',s.api_mode,'company_id',s.company_id)
 and private.pdc_tracking_rank(q.normalized_state)<70 and (q.tracking_lease_until is null or q.tracking_lease_until<=n)
 and (q.tracking_next_at is null or q.tracking_next_at<=n) and (q.tracking_checked_at is null or q.tracking_checked_at<=n-interval '5 minutes')
 and coalesce(q.awb_verified_at,q.created_at)<=n-interval '2 minutes'
 and (p_order_id is not null or (q.tracking_failures<(p->>'max_failures')::integer and coalesce(q.awb_verified_at,q.created_at)>=n-make_interval(days=>(p->>'max_age_days')::integer)))
 order by q.tracking_next_at nulls first,q.created_at,q.id limit 1 for update of q skip locked;
 if not found then return jsonb_build_object('error',case when p_order_id is null then 'empty' else 'not_due_or_ineligible' end);end if;
 update public.shipping_provider_settings set tracking_request_times=array(select t from unnest(s.tracking_request_times) t where t>n-interval '1 day')||n where id='pdc';
 update public.shipping_order_jobs set tracking_token=token,tracking_lease_until=n+interval '2 minutes',tracking_checked_at=n,reconciliation_attempted_at=n where id=j.id;
 return jsonb_build_object('job_id',j.id,'order_id',j.order_id,'token',token,'awb',j.awb,'ref',j.to_ref,'observed_at',n,'provider_identity',j.provider_identity);
end $$;
create function public.shipping_finish_pdc_tracking(p_job uuid,p_token uuid,p_success boolean,p_error text default null) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='4s' set lock_timeout='2s' as $$
declare j public.shipping_order_jobs%rowtype;p jsonb;f integer;seconds integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501';end if;
 if p_success is null or (not p_success and (p_error is null or p_error not in ('PROVIDER_UNAVAILABLE','IDENTITY_MISMATCH','INVALID_STATUS','TRACKING_DISABLED','PERSISTENCE_UNCERTAIN'))) then raise exception 'Invalid tracking outcome';end if;
 select * into j from public.shipping_order_jobs where id=p_job for update;
 if not found or p_token is null or j.tracking_token is null or j.tracking_lease_until is null or j.tracking_token is distinct from p_token or j.tracking_lease_until<=clock_timestamp() then return jsonb_build_object('error','lease_conflict');end if;
 select tracking_policy into p from public.shipping_provider_settings where id='pdc';
 f:=case when p_success then 0 else least(j.tracking_failures+1,100000) end;
 seconds:=case when p_success then (p->>'interval_seconds')::integer else least(86400,(p->>'interval_seconds')::integer*power(2,least(f,8))::integer) end;
 update public.shipping_order_jobs set tracking_token=null,tracking_lease_until=null,tracking_failures=f,
 tracking_error_code=case when p_success then null else p_error end,tracking_success_at=case when p_success then clock_timestamp() else tracking_success_at end,
 tracking_next_at=clock_timestamp()+make_interval(secs=>seconds) where id=j.id;
 perform realtime.send(jsonb_build_object('changed',true),'changed','shipping:order:'||j.order_id::text,true);
 return jsonb_build_object('finished',true,'failures',f,'automatic_paused',f>=(p->>'max_failures')::integer);
end $$;
create function public.shipping_pdc_tracking_metadata(p_order_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare j public.shipping_order_jobs%rowtype;p jsonb;verified boolean;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required' using errcode='42501';end if;
 select * into j from public.shipping_order_jobs where order_id=p_order_id and provider='pdc';if not found then return null;end if;
 select tracking_policy into p from public.shipping_provider_settings where id='pdc';verified:=private.pdc_tracking_verified(j.id);
 return jsonb_build_object('booking_verified',verified,'binding_sha256',encode(sha256(convert_to(j.id::text||'|'||j.order_id::text||'|'||j.to_ref||'|'||coalesce(j.awb,''),'UTF8')),'hex'),'policy_enabled',(p->>'enabled')::boolean,'booked_at',case when verified then j.awb_verified_at end,
 'last_attempt_at',j.tracking_checked_at,'last_success_at',j.tracking_success_at,'latest_update_at',greatest(j.tracking_success_at,j.provider_status_observed_at),'next_attempt_at',j.tracking_next_at,
 'error_code',j.tracking_error_code,'stale',greatest(j.tracking_success_at,j.provider_status_observed_at) is null or greatest(j.tracking_success_at,j.provider_status_observed_at)<clock_timestamp()-make_interval(secs=>(p->>'stale_seconds')::integer),
 'terminal',private.pdc_tracking_rank(j.normalized_state)=70,
 'automatic_paused',j.tracking_failures>=(p->>'max_failures')::integer or coalesce(j.awb_verified_at,j.created_at)<clock_timestamp()-make_interval(days=>(p->>'max_age_days')::integer),
 'manual_due',verified and private.pdc_tracking_rank(j.normalized_state)<70 and coalesce(j.tracking_next_at,'-infinity'::timestamptz)<=clock_timestamp()
 and coalesce(j.tracking_lease_until,'-infinity'::timestamptz)<=clock_timestamp() and coalesce(j.tracking_checked_at,'-infinity'::timestamptz)<=clock_timestamp()-interval '5 minutes');
end $$;
-- Close the old unbudgeted public refresh path. All staff/scheduled reads use the same lease/budgets.
create or replace function public.shipping_claim_pdc_refresh(p_order_id uuid) returns jsonb language sql security definer set search_path='' as $$
 select public.shipping_claim_pdc_tracking(p_order_id)
$$;
revoke all on function private.pdc_tracking_policy_valid(jsonb),private.pdc_tracking_rank(text),private.pdc_tracking_verified(uuid) from public,anon,authenticated;
grant execute on function private.pdc_tracking_policy_valid(jsonb),private.pdc_tracking_rank(text),private.pdc_tracking_verified(uuid) to service_role;
revoke all on function public.shipping_claim_pdc_tracking(uuid),public.shipping_finish_pdc_tracking(uuid,uuid,boolean,text),public.shipping_pdc_tracking_metadata(uuid) from public,anon,authenticated;
grant execute on function public.shipping_claim_pdc_tracking(uuid),public.shipping_finish_pdc_tracking(uuid,uuid,boolean,text),public.shipping_pdc_tracking_metadata(uuid) to service_role;
notify pgrst,'reload schema';
commit;
