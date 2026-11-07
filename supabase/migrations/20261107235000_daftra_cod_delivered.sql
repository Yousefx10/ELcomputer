-- Owner request 7 Nov 2026 (phase 2C): record cash on delivery in Daftra automatically.
-- PDC's status API reports only the parcel status, so "Delivered" is the collection signal.
-- 1. Daftra payment method and treasury for cash collected by the courier.
-- 2. A delivered COD parcel queues its Daftra bill once; the worker records the payment.
--    Tracking is never blocked: a queue failure is logged and the courier update stays.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

alter table public.erp_provider_settings
 add column cod_payment_method text,
 add column cod_treasury_id integer,
 add constraint erp_provider_settings_cod_payment_method_check
  check (cod_payment_method is null or cod_payment_method ~ '^[A-Za-z0-9_-]{1,60}$'),
 add constraint erp_provider_settings_cod_treasury_check
  check (cod_treasury_id is null or cod_treasury_id>0);
comment on column public.erp_provider_settings.cod_payment_method is
 'Daftra payment method recorded when the courier delivers a cash on delivery order. Null records no payment.';

create function private.erp_queue_cod_delivered() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.normalized_state is distinct from 'delivered' or old.normalized_state is not distinct from 'delivered' then return new; end if;
 begin
  insert into public.erp_sync_jobs(operation,local_entity_type,local_id,dedupe_key,payload)
  select 'order.export','customer_order',o.id,'daftra:order:'||o.id::text||':cod_delivered',
   jsonb_build_object('order_status',o.status,'reason','cod_delivered')
  from public.customer_orders o
  where o.id=new.order_id and o.payment_method='cash' and o.erp_owner='daftra' and not coalesce(o.is_preorder,false)
   and public.get_active_erp_mode()='daftra'
  on conflict(dedupe_key) do nothing;
 exception when query_canceled or others then
  raise log 'Delivered COD order could not be queued for Daftra (SQLSTATE %).',sqlstate;
 end;
 return new;
end $$;
revoke all on function private.erp_queue_cod_delivered() from public,anon,authenticated;

create trigger erp_queue_cod_delivered after update of normalized_state on public.shipping_order_jobs
 for each row execute function private.erp_queue_cod_delivered();

notify pgrst,'reload schema';
commit;
