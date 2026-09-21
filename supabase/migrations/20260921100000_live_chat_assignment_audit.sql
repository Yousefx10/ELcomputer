begin;

-- Keep the names that were visible when each workflow event occurred. Auth and
-- admin rows can be renamed or deleted while the conversation stays retained.
alter table public.chat_events
  add column actor_name text,
  add column old_assignee_name text,
  add column new_assignee_name text;

create function public.chat_event_name(p_admin_id uuid) returns text
language sql stable set search_path = '' as $$
  select coalesce(nullif(pg_catalog.btrim(a.full_name), ''), a.email, a.id::text)
  from public.admin_users a where a.id = p_admin_id;
$$;

create function public.chat_snapshot_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old_id uuid;
  v_new_id uuid;
begin
  if new.actor_kind = 'staff' then
    new.actor_name := coalesce(public.chat_event_name(new.actor_id), new.actor_id::text);
  elsif new.actor_kind in ('customer', 'guest') then
    select c.contact_name into new.actor_name from public.chat_conversations c
      where c.id = new.conversation_id;
  else
    new.actor_name := 'System';
  end if;
  v_old_id := nullif(new.old_value ->> 'assigned_admin_id', '')::uuid;
  v_new_id := nullif(new.new_value ->> 'assigned_admin_id', '')::uuid;
  if v_old_id is not null then
    new.old_assignee_name := coalesce(public.chat_event_name(v_old_id), v_old_id::text);
  end if;
  if v_new_id is not null then
    new.new_assignee_name := coalesce(public.chat_event_name(v_new_id), v_new_id::text);
  end if;
  return new;
end;
$$;
create trigger chat_events_snapshot before insert on public.chat_events
for each row execute function public.chat_snapshot_event();

-- Best-effort backfill for rows written before this migration. Deleted actors
-- cannot be identified retroactively; new events always capture a snapshot.
update public.chat_events e set
  actor_name = case when e.actor_kind = 'staff'
    then coalesce(public.chat_event_name(e.actor_id), e.actor_id::text)
    when e.actor_kind in ('customer', 'guest') then c.contact_name
    else 'System' end,
  old_assignee_name = public.chat_event_name(nullif(e.old_value ->> 'assigned_admin_id', '')::uuid),
  new_assignee_name = public.chat_event_name(nullif(e.new_value ->> 'assigned_admin_id', '')::uuid)
from public.chat_conversations c where c.id = e.conversation_id;

-- Keep the Phase 2 row lock and revision check. Managers can now assign a
-- waiting chat directly; transfers remain restricted to active chats.
create or replace function public.chat_transition(p_conversation_id uuid, p_staff_id uuid,
  p_action text, p_target_id uuid, p_expected_revision bigint) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_conversation public.chat_conversations%rowtype;
  v_manage boolean;
  v_reply boolean;
  v_old jsonb;
begin
  select a.role = 'owner' or coalesce((a.permissions ->> 'support.manage')::boolean,false),
    a.role = 'owner' or (coalesce((a.permissions ->> 'support.view')::boolean,false)
      and coalesce((a.permissions ->> 'support.reply')::boolean,false))
    into v_manage, v_reply from public.admin_users a
    where a.id = p_staff_id and a.is_active = true;
  if not coalesce(v_reply,false) then
    raise exception 'Support reply access is required.' using errcode = '42501';
  end if;
  select * into v_conversation from public.chat_conversations
    where id = p_conversation_id for update;
  if not found then raise exception 'Chat not found.' using errcode = 'P0002'; end if;
  if p_expected_revision is null or v_conversation.revision <> p_expected_revision then
    raise exception 'CHAT_STALE' using errcode = 'P0001';
  end if;
  v_old := pg_catalog.jsonb_build_object('status',v_conversation.status,
    'assigned_admin_id',v_conversation.assigned_admin_id);
  if p_action in ('assign', 'transfer') then
    if not coalesce(v_manage,false) or p_target_id is null then
      raise exception 'CHAT_TRANSITION_DENIED' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.admin_users a where a.id = p_target_id
      and a.is_active = true and (a.role = 'owner' or (
        coalesce((a.permissions ->> 'support.view')::boolean,false)
        and coalesce((a.permissions ->> 'support.reply')::boolean,false)))) then
      raise exception 'CHAT_TARGET_UNAVAILABLE' using errcode = 'P0001';
    end if;
  end if;
  if p_action = 'claim' then
    if v_conversation.status <> 'waiting' or v_conversation.assigned_admin_id is not null then
      raise exception 'CHAT_ALREADY_ASSIGNED' using errcode = 'P0001';
    end if;
    update public.chat_conversations set status = 'active',
      assigned_admin_id = p_staff_id where id = p_conversation_id;
  elsif p_action = 'assign' then
    if v_conversation.status <> 'waiting' or v_conversation.assigned_admin_id is not null then
      raise exception 'CHAT_ALREADY_ASSIGNED' using errcode = 'P0001';
    end if;
    update public.chat_conversations set status = 'active',
      assigned_admin_id = p_target_id where id = p_conversation_id;
  elsif p_action = 'transfer' then
    if v_conversation.status <> 'active'
      or p_target_id = v_conversation.assigned_admin_id
      or not exists (select 1 from public.chat_settings
        where singleton and transfers_enabled) then
      raise exception 'CHAT_TRANSITION_DENIED' using errcode = 'P0001';
    end if;
    update public.chat_conversations set assigned_admin_id = p_target_id
      where id = p_conversation_id;
  elsif p_action = 'close' then
    if v_conversation.status = 'closed' or
      (not v_manage and v_conversation.assigned_admin_id is distinct from p_staff_id) then
      raise exception 'CHAT_TRANSITION_DENIED' using errcode = 'P0001';
    end if;
    update public.chat_conversations set status = 'closed', closed_at = now()
      where id = p_conversation_id;
  elsif p_action = 'reopen' then
    if not v_manage or v_conversation.status <> 'closed'
      or not exists (select 1 from public.chat_settings
        where singleton and reopen_enabled) then
      raise exception 'CHAT_TRANSITION_DENIED' using errcode = 'P0001';
    end if;
    update public.chat_conversations set status = 'waiting',
      assigned_admin_id = null, closed_at = null where id = p_conversation_id;
  else
    raise exception 'Invalid chat transition.' using errcode = '22023';
  end if;
  insert into public.chat_events(conversation_id, actor_id, actor_kind,
    event_type, old_value, new_value)
  select p_conversation_id, p_staff_id, 'staff',
    case p_action when 'claim' then 'claimed' when 'assign' then 'assigned'
      when 'transfer' then 'transferred' when 'close' then 'closed'
      else 'reopened' end,
    v_old, pg_catalog.jsonb_build_object('status', status,
      'assigned_admin_id', assigned_admin_id)
    from public.chat_conversations where id = p_conversation_id;
  return p_conversation_id;
end;
$$;

revoke all on function public.chat_event_name(uuid), public.chat_snapshot_event()
  from public, anon, authenticated;
grant execute on function public.chat_event_name(uuid), public.chat_snapshot_event()
  to service_role;
revoke all on function public.chat_transition(uuid,uuid,text,uuid,bigint)
  from public, anon, authenticated;
grant execute on function public.chat_transition(uuid,uuid,text,uuid,bigint)
  to service_role;

commit;
