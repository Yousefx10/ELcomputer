begin;

create or replace function public.close_order_packing_work_session(
  p_work_session_id uuid,
  p_admin_user_id uuid,
  p_author_name text,
  p_author_email text,
  p_author_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

revoke all on function public.close_order_packing_work_session(
  uuid,
  uuid,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.close_order_packing_work_session(
  uuid,
  uuid,
  text,
  text,
  text
) to service_role;

commit;
