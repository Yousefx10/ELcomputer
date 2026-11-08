-- Owner request 8 Nov 2026: order status follows the courier (ORDER-STATUS-PDC-01), the customer-facing
-- courier name comes from the Dashboard, and courier SMS reach customers when tracking is polled.
-- 1. A switch in Settings -> Order flow. Off by default; each deployment turns it on.
-- 2. Forward-only status moves from courier states. Never overrides on hold, cancelled, refunded or finished orders.
-- 3. Courier SMS use the Dashboard name. Polled events stay sendable for 3 hours; older events are not sent.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

alter table public.commerce_order_flow_settings add column status_follows_courier boolean not null default false;
comment on column public.commerce_order_flow_settings.status_follows_courier is
 'When true, courier updates move the order forward: being shipped, out for delivery, completed.';

create function private.order_status_follow_courier() returns trigger
language plpgsql security definer set search_path='' as $$
declare next_status text; allowed text[];
begin
 if new.normalized_state is not distinct from old.normalized_state then return new; end if;
 if not coalesce((select f.status_follows_courier from public.commerce_order_flow_settings f where f.id='default'),false) then return new; end if;
 if new.normalized_state in ('picked_up','in_transit','arrived_at_hub') then
  next_status:='being_shipped'; allowed:=array['processing','ready_to_deliver','in_progress'];
 elsif new.normalized_state='out_for_delivery' then
  next_status:='out_for_delivery'; allowed:=array['processing','ready_to_deliver','in_progress','being_shipped'];
 elsif new.normalized_state='delivered' then
  next_status:='completed'; allowed:=array['processing','ready_to_deliver','in_progress','being_shipped','out_for_delivery'];
 else return new; end if;
 -- Tracking is never blocked: an order guard refusing the move leaves the status as it is.
 begin
  update public.customer_orders o set status=next_status where o.id=new.order_id and o.status=any(allowed);
 exception when query_canceled or others then
  raise log 'Courier update could not move the order status (SQLSTATE %).',sqlstate;
 end;
 return new;
end $$;
revoke all on function private.order_status_follow_courier() from public,anon,authenticated;
create trigger order_status_follow_courier after update of normalized_state on public.shipping_order_jobs
 for each row execute function private.order_status_follow_courier();

drop function public.order_flow_save(uuid,text,text,numeric);
create function public.order_flow_save(p_admin uuid,p_paid text,p_cod text,p_weight numeric,p_status_follows boolean default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f public.commerce_order_flow_settings%rowtype;
begin
 if auth.role() is distinct from 'service_role' or not exists(select 1 from public.admin_users where id=p_admin and is_active
  and (role='owner' or (coalesce((permissions->>'settings.edit')::boolean,false) and coalesce((permissions->>'dashboard.orders')::boolean,false)))) then
  raise exception 'Order flow permission is required.' using errcode='42501';
 end if;
 if p_paid not in ('review','auto') or p_cod not in ('review','auto') or p_weight is null or p_weight not between 0.001 and 99999.999 or p_weight<>trunc(p_weight,3) then
  raise exception 'Choose a valid order flow and parcel weight.' using errcode='22023';
 end if;
 select * into f from public.commerce_order_flow_settings where id='default' for update;
 update public.commerce_order_flow_settings set paid_orders=p_paid,cod_orders=p_cod,parcel_weight_kg=p_weight,
  status_follows_courier=coalesce(p_status_follows,f.status_follows_courier),
  acting_admin_id=case when p_paid='auto' or p_cod='auto' then p_admin else acting_admin_id end,
  paid_auto_since=case when p_paid<>'auto' then null when f.paid_orders='auto' then f.paid_auto_since else clock_timestamp() end,
  cod_auto_since=case when p_cod<>'auto' then null when f.cod_orders='auto' then f.cod_auto_since else clock_timestamp() end,
  updated_by=p_admin,updated_at=clock_timestamp() where id='default' returning * into f;
 return to_jsonb(f);
end $$;
revoke all on function public.order_flow_save(uuid,text,text,numeric,boolean) from public,anon,authenticated;
grant execute on function public.order_flow_save(uuid,text,text,numeric,boolean) to service_role;

-- The name customers see, set in Dashboard -> Commerce -> Shipping.
create function private.courier_display_name() returns text
language sql stable security definer set search_path='' as $$
 select nullif(btrim(s.display_name),'') from public.shipping_provider_settings s where s.id='pdc'
$$;
revoke all on function private.courier_display_name() from public,anon,authenticated;

do $do$
declare d text:=pg_get_functiondef('public.shipping_record_pdc_event_outbound(jsonb)'::regprocedure);
 old_expiry text:=$a$intent.expires_at:=least(clock_timestamp()+interval '10 minutes',coalesce(tracking.status_date+interval '10 minutes',clock_timestamp()+interval '10 minutes'));$a$;
 new_expiry text:=$a$-- Tracking may be polled, so a new update can already be minutes old. Old news is not sent.
    if tracking.status_date is not null and tracking.status_date<clock_timestamp()-interval '6 hours' then return result; end if;
    intent.expires_at:=clock_timestamp()+interval '3 hours';$a$;
 old_name text:=$a$'courier_name','PDC')$a$;
 new_name text:=$a$'courier_name',private.courier_display_name())$a$;
begin
 if position(old_expiry in d)=0 or position(old_name in d)=0 then raise exception 'Courier SMS function differs from the reviewed version.'; end if;
 execute replace(replace(d,old_expiry,new_expiry),old_name,new_name);
end $do$;

-- Default wording only; a template edited in the Dashboard stays as it is.
update public.sms_templates set
 text_en='Order {{order_number}} is out for delivery. {{courier_name}} tracking: {{awb}}.',
 text_ar='الطلب {{order_number}} خرج للتسليم. رقم تتبع {{courier_name}}: {{awb}}.'
 where code='pdc_out_for_delivery' and text_en='Order {{order_number}} is out for delivery. PDC tracking: {{awb}}.' and text_ar='الطلب {{order_number}} خرج للتسليم. رقم تتبع PDC: {{awb}}.';
update public.sms_templates set
 text_en='{{courier_name}} could not deliver order {{order_number}}. {{delivery_reason}}. Tracking: {{awb}}.',
 text_ar='تعذر على {{courier_name}} تسليم الطلب {{order_number}}. {{delivery_reason}}. رقم التتبع: {{awb}}.'
 where code='pdc_delivery_exception' and text_en='PDC could not deliver order {{order_number}}. {{delivery_reason}}. Tracking: {{awb}}.' and text_ar='تعذر على PDC تسليم الطلب {{order_number}}. {{delivery_reason}}. رقم التتبع: {{awb}}.';
update public.sms_templates set
 text_en='{{courier_name}} delivered order {{order_number}}. Tracking: {{awb}}.',
 text_ar='تم تسليم الطلب {{order_number}} بواسطة {{courier_name}}. رقم التتبع: {{awb}}.'
 where code='pdc_delivered' and text_en='PDC delivered order {{order_number}}. Tracking: {{awb}}.' and text_ar='تم تسليم الطلب {{order_number}} بواسطة PDC. رقم التتبع: {{awb}}.';

notify pgrst,'reload schema';
commit;
