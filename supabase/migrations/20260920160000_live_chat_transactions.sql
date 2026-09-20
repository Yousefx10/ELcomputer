begin;

-- Counters are shared by all application servers. Subjects are server-generated
-- SHA-256 hashes of verified actor IDs, never browser-provided identities.
create function public.chat_consume_limit(p_scope text, p_subject_hash text,
  p_window_seconds integer, p_max integer) returns void
language plpgsql set search_path = '' as $$
declare
  v_start timestamptz;
  v_attempts integer;
begin
  if p_scope not in ('message', 'conversation') or p_subject_hash !~ '^[0-9a-f]{64}$'
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

create function public.chat_create_or_resume(p_actor_id uuid, p_is_guest boolean,
  p_name text, p_email text, p_mobile text, p_order_id uuid,
  p_creation_key uuid, p_subject_hash text) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_id uuid;
  v_rule text;
  v_name text := nullif(pg_catalog.btrim(p_name), '');
  v_email text := nullif(pg_catalog.lower(pg_catalog.btrim(p_email)), '');
  v_mobile text := nullif(pg_catalog.btrim(p_mobile), '');
begin
  if p_actor_id is null or p_creation_key is null or p_is_guest is null then
    raise exception 'Invalid chat identity.' using errcode = '22023';
  end if;
  if p_is_guest then
    if not exists (select 1 from auth.users where id = p_actor_id and is_anonymous = true) then
      raise exception 'Guest identity is unavailable.' using errcode = '42501';
    end if;
    if p_order_id is not null then
      raise exception 'Guest orders require verified account ownership.' using errcode = '42501';
    end if;
  elsif not exists (select 1 from public.customer_profiles p
    join auth.users u on u.id = p.id and u.is_anonymous = false
    where p.id = p_actor_id and p.is_active = true) then
    raise exception 'Customer account is unavailable.' using errcode = '42501';
  end if;
  if p_order_id is not null and not exists (select 1 from public.customer_orders
    where id = p_order_id and user_id = p_actor_id) then
    raise exception 'Chat order does not belong to the customer.' using errcode = '22023';
  end if;
  select id into v_id from public.chat_conversations
    where (p_is_guest and guest_auth_user_id = p_actor_id
      or not p_is_guest and customer_id = p_actor_id)
      and status <> 'closed' limit 1;
  if v_id is not null then return v_id; end if;
  select id into v_id from public.chat_conversations
    where (p_is_guest and guest_auth_user_id = p_actor_id
      or not p_is_guest and customer_id = p_actor_id)
      and creation_key = p_creation_key limit 1;
  if v_id is not null then return v_id; end if;
  select guest_contact_rule into v_rule from public.chat_settings
    where singleton and is_enabled = true;
  if v_rule is null then
    raise exception 'CHAT_DISABLED' using errcode = 'P0001';
  end if;
  if v_name is null or pg_catalog.char_length(v_name) > 160
    or (v_rule in ('email', 'both') and v_email is null)
    or (v_rule in ('mobile', 'both') and v_mobile is null)
    or (v_rule = 'either' and v_email is null and v_mobile is null) then
    raise exception 'Chat contact is incomplete.' using errcode = '22023';
  end if;
  perform public.chat_consume_limit('conversation', p_subject_hash, 3600, 5);
  begin
    insert into public.chat_conversations(customer_id, guest_auth_user_id,
      contact_name, contact_email, contact_mobile, order_id, creation_key)
    values (case when p_is_guest then null else p_actor_id end,
      case when p_is_guest then p_actor_id else null end,
      v_name, v_email, v_mobile, p_order_id, p_creation_key)
    returning id into v_id;
  exception when unique_violation then
    select id into v_id from public.chat_conversations
      where (p_is_guest and guest_auth_user_id = p_actor_id
        or not p_is_guest and customer_id = p_actor_id)
        and (status <> 'closed' or creation_key = p_creation_key)
      order by (status <> 'closed') desc limit 1;
    if v_id is null then raise; end if;
    return v_id;
  end;
  insert into public.chat_events(conversation_id, actor_id, actor_kind, event_type)
  values (v_id, p_actor_id, case when p_is_guest then 'guest' else 'customer' end, 'created');
  return v_id;
end;
$$;

create function public.chat_send_message(p_conversation_id uuid, p_sender_id uuid,
  p_sender_kind text, p_sender_name text, p_body text, p_key uuid,
  p_subject_hash text, p_internal boolean default false) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_conversation public.chat_conversations%rowtype;
  v_existing public.chat_messages%rowtype;
  v_id uuid;
  v_seq bigint;
  v_body text := pg_catalog.btrim(p_body);
  v_limit integer;
  v_cooldown integer;
  v_previous timestamptz;
begin
  if p_key is null or p_sender_id is null or p_sender_kind not in ('customer','guest','staff') then
    raise exception 'Invalid chat submission.' using errcode = '22023';
  end if;
  select * into v_conversation from public.chat_conversations
    where id = p_conversation_id for update;
  if not found then raise exception 'Chat not found.' using errcode = 'P0002'; end if;
  select * into v_existing from public.chat_messages
    where conversation_id = p_conversation_id and sender_id = p_sender_id
      and idempotency_key = p_key;
  if found then
    if v_existing.sender_kind = p_sender_kind and v_existing.body = v_body
      and v_existing.is_internal = p_internal then return v_existing.id; end if;
    raise exception 'CHAT_KEY_CONFLICT' using errcode = 'P0001';
  end if;
  if v_conversation.status = 'closed' then
    raise exception 'CHAT_CLOSED' using errcode = 'P0001';
  end if;
  select max_message_length, customer_send_cooldown_seconds
    into v_limit, v_cooldown from public.chat_settings where singleton;
  if v_limit is null or pg_catalog.char_length(v_body) not between 1 and v_limit then
    raise exception 'Chat message length is invalid.' using errcode = '22023';
  end if;
  if p_sender_kind <> 'staff' then
    if not exists (select 1 from public.chat_settings where singleton and is_enabled) then
      raise exception 'CHAT_DISABLED' using errcode = 'P0001';
    end if;
    select created_at into v_previous from public.chat_messages
      where conversation_id = p_conversation_id and sender_id = p_sender_id
        and sender_kind in ('customer','guest')
      order by sequence_number desc limit 1;
    if v_previous is not null and v_previous + pg_catalog.make_interval(secs => v_cooldown)
      > pg_catalog.clock_timestamp() then
      raise exception 'CHAT_COOLDOWN' using errcode = 'P0001';
    end if;
    perform public.chat_consume_limit('message', p_subject_hash, 60, 12);
    if exists (select 1 from public.chat_messages
      where conversation_id = p_conversation_id and sender_id = p_sender_id
        and body = v_body and created_at > pg_catalog.clock_timestamp() - interval '15 seconds') then
      raise exception 'CHAT_DUPLICATE' using errcode = 'P0001';
    end if;
  end if;
  insert into public.chat_messages(conversation_id, sender_id, sender_kind,
    sender_name, body, is_internal, idempotency_key)
  values (p_conversation_id, p_sender_id, p_sender_kind,
    pg_catalog.btrim(p_sender_name), v_body, p_internal, p_key)
  returning id, sequence_number into v_id, v_seq;
  if not p_internal then
    update public.chat_conversations set
      last_activity_at = now(),
      last_customer_message_seq = case when p_sender_kind <> 'staff' then v_seq
        else last_customer_message_seq end,
      last_staff_message_seq = case when p_sender_kind = 'staff'
        then v_seq else last_staff_message_seq end
      where id = p_conversation_id;
  end if;
  if p_sender_kind = 'staff' and not p_internal then
    insert into public.chat_events(conversation_id, actor_id, actor_kind,
      event_type, related_message_id)
    values (p_conversation_id, p_sender_id, 'staff', 'agent_replied', v_id);
  end if;
  return v_id;
end;
$$;

create function public.chat_transition(p_conversation_id uuid, p_staff_id uuid,
  p_action text, p_target_id uuid, p_expected_revision bigint) returns uuid
language plpgsql set search_path = '' as $$
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
  if p_action = 'claim' then
    if v_conversation.status <> 'waiting' or v_conversation.assigned_admin_id is not null then
      raise exception 'CHAT_ALREADY_ASSIGNED' using errcode = 'P0001';
    end if;
    update public.chat_conversations set status = 'active',
      assigned_admin_id = p_staff_id where id = p_conversation_id;
  elsif p_action = 'transfer' then
    if not v_manage or v_conversation.status <> 'active' or p_target_id is null
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
    case p_action when 'claim' then 'claimed' when 'transfer' then 'transferred'
      when 'close' then 'closed' else 'reopened' end,
    v_old, pg_catalog.jsonb_build_object('status', status,
      'assigned_admin_id', assigned_admin_id)
    from public.chat_conversations where id = p_conversation_id;
  return p_conversation_id;
end;
$$;

-- Broadcast rows commit with the chat write. Payloads contain only opaque IDs,
-- cursor/revision and event type. Customer channels never receive internal notes.
create function public.chat_signal_conversation() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_payload jsonb;
begin
  v_payload := pg_catalog.jsonb_build_object('conversationId', new.id,
    'revision', new.revision, 'kind', 'conversation');
  perform realtime.send(v_payload, 'changed', 'chat:inbox', true);
  perform realtime.send(v_payload, 'changed', 'chat:staff:' || new.id::text, true);
  perform realtime.send(v_payload, 'changed', 'chat:public:' || new.id::text, true);
  return new;
end;
$$;
create trigger chat_signal_conversation after insert or update on public.chat_conversations
for each row execute function public.chat_signal_conversation();

create function public.chat_signal_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_payload jsonb;
begin
  v_payload := pg_catalog.jsonb_build_object('conversationId', new.conversation_id,
    'messageId', new.id, 'sequence', new.sequence_number, 'kind', 'message');
  perform realtime.send(v_payload, 'changed', 'chat:staff:' || new.conversation_id::text, true);
  if not new.is_internal then
    perform realtime.send(v_payload, 'changed', 'chat:public:' || new.conversation_id::text, true);
  end if;
  if new.sender_kind <> 'staff' then
    perform realtime.send(pg_catalog.jsonb_build_object(
      'conversationId',new.conversation_id,'sequence',new.sequence_number,
      'kind','message'), 'changed', 'chat:inbox', true);
  end if;
  return new;
end;
$$;
create trigger chat_signal_message after insert on public.chat_messages
for each row execute function public.chat_signal_message();

revoke all on function public.chat_consume_limit(text,text,integer,integer),
  public.chat_create_or_resume(uuid,boolean,text,text,text,uuid,uuid,text),
  public.chat_send_message(uuid,uuid,text,text,text,uuid,text,boolean),
  public.chat_transition(uuid,uuid,text,uuid,bigint)
  from public, anon, authenticated;
grant execute on function public.chat_consume_limit(text,text,integer,integer),
  public.chat_create_or_resume(uuid,boolean,text,text,text,uuid,uuid,text),
  public.chat_send_message(uuid,uuid,text,text,text,uuid,text,boolean),
  public.chat_transition(uuid,uuid,text,uuid,bigint) to service_role;
revoke all on function public.chat_signal_conversation(),
  public.chat_signal_message() from public, anon, authenticated;

commit;
