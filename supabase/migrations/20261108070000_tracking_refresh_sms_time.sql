-- Owner request 8 Nov 2026: opening an order refreshes the courier status, and courier SMS work with polled tracking.
-- 1. An order-level check ignores the hourly schedule. The 5-minute per-parcel limit and the daily budget stay.
-- 2. The courier status API gives no event time, so a polled update uses the time it was first seen.
--    If tracking was down for over 6 hours, the update's age is unknown and no SMS is sent.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

do $do$
declare d text:=pg_get_functiondef('public.shipping_claim_pdc_tracking(uuid)'::regprocedure);
 a text:=$a$and (q.tracking_next_at is null or q.tracking_next_at<=n)$a$;
 b text:=$a$and (p_order_id is not null or q.tracking_next_at is null or q.tracking_next_at<=n)$a$;
begin
 if position(a in d)=0 then raise exception 'Tracking claim differs from the reviewed version.'; end if;
 execute replace(d,a,b);
end $do$;

do $do$
declare d text:=pg_get_functiondef('public.shipping_record_pdc_event_outbound(jsonb)'::regprocedure);
 event_old text:=$a$intent.provider_event_at:=tracking.status_date;$a$;
 event_new text:=$a$intent.provider_event_at:=coalesce(tracking.status_date,tracking.received_at);$a$;
 row_old text:=$a$job.id,job.awb,tracking.id,tracking.status_date,intent.template_id,$a$;
 row_new text:=$a$job.id,job.awb,tracking.id,intent.provider_event_at,intent.template_id,$a$;
 age_old text:=$a$if tracking.status_date is not null and tracking.status_date<clock_timestamp()-interval '6 hours' then return result; end if;$a$;
 age_new text:=$a$if tracking.status_date is not null and tracking.status_date<clock_timestamp()-interval '6 hours' then return result; end if;
    if tracking.status_date is null and coalesce(before_job.tracking_success_at,before_job.awb_verified_at,before_job.created_at)<clock_timestamp()-interval '6 hours' then return result; end if;$a$;
begin
 if position(event_old in d)=0 or position(row_old in d)=0 or position(age_old in d)=0 then raise exception 'Courier SMS function differs from the reviewed version.'; end if;
 execute replace(replace(replace(d,event_old,event_new),row_old,row_new),age_old,age_new);
end $do$;

notify pgrst,'reload schema';
commit;
