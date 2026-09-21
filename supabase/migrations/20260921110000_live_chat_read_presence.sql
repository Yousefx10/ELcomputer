begin;

-- Typing uses the existing short-lived counter table, never a presence row.
create or replace function public.chat_consume_limit(p_scope text, p_subject_hash text,
  p_window_seconds integer, p_max integer) returns void
language plpgsql set search_path = '' as $$
declare
  v_start timestamptz;
  v_attempts integer;
begin
  if p_scope not in ('message', 'conversation', 'typing') or p_subject_hash !~ '^[0-9a-f]{64}$'
    or p_window_seconds not between 1 and 86400 or p_max not between 1 and 100 then
    raise exception 'Invalid chat limit.' using errcode = '22023';
  end if;
  delete from public.chat_rate_limits where ctid in (
    select ctid from public.chat_rate_limits
    where expires_at < pg_catalog.clock_timestamp() limit 20
  );
  v_start := pg_catalog.to_timestamp(pg_catalog.floor(
    extract(epoch from pg_catalog.clock_timestamp()) / p_window_seconds) * p_window_seconds);
  insert into public.chat_rate_limits(scope, subject_hash, window_started_at, attempts, expires_at)
  values (p_scope, p_subject_hash, v_start, 1,
    v_start + pg_catalog.make_interval(secs => p_window_seconds))
  on conflict (scope, subject_hash, window_started_at) do update
    set attempts = public.chat_rate_limits.attempts + 1
  returning attempts into v_attempts;
  if v_attempts > p_max then
    raise exception 'CHAT_RATE_LIMIT' using errcode = 'P0001';
  end if;
end;
$$;

create function public.chat_mark_read(p_conversation_id uuid, p_actor_id uuid,
  p_actor_kind text, p_sequence bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
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

create function public.chat_unread_summary(p_actor_id uuid, p_actor_kind text,
  p_conversation_ids uuid[]) returns table(conversation_id uuid,
  last_read_sequence bigint, unread_count bigint)
language plpgsql stable security definer set search_path = '' as $$
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

create function public.chat_set_agent_availability(p_admin_id uuid, p_state text)
returns table(declared_state text, lease_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
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

revoke all on function public.chat_mark_read(uuid,uuid,text,bigint),
  public.chat_unread_summary(uuid,text,uuid[]),
  public.chat_set_agent_availability(uuid,text) from public,anon,authenticated;
grant execute on function public.chat_mark_read(uuid,uuid,text,bigint),
  public.chat_unread_summary(uuid,text,uuid[]),
  public.chat_set_agent_availability(uuid,text) to service_role;

commit;
