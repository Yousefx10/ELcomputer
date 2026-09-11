begin;

create or replace function public.enqueue_daftra_order_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean := false;
begin
  select coalesce(
    erp_mode = 'daftra' and daftra_connection_status = 'connected',
    false
  )
  into v_enabled
  from public.site_settings
  where key = 'default';

  if v_enabled is not true then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  insert into public.erp_sync_jobs (
    operation,
    local_entity_type,
    local_id,
    dedupe_key,
    payload
  )
  values (
    'order.export',
    'customer_order',
    new.id,
    'daftra:order:' || new.id::text || ':status:' || new.status,
    jsonb_build_object('order_status', new.status)
  )
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

revoke all on function public.enqueue_daftra_order_sync() from public;
grant execute on function public.enqueue_daftra_order_sync() to service_role;

commit;
