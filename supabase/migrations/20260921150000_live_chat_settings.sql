begin;

-- Ticket-based offline intake depends on the shared conversion switch.
alter table public.chat_settings add constraint chat_settings_offline_ticket_check
  check (offline_behavior <> 'ticket' or ticket_conversion_enabled);

-- Return the exact reason behind public availability so the settings page can
-- explain the current state without recreating timezone logic in JavaScript.
create function public.chat_availability_details(p_at timestamptz) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_settings public.chat_settings%rowtype;
  v_local timestamp;
  v_day text;
  v_clock time;
  v_slot jsonb;
  v_in_hours boolean := false;
  v_agent_count integer := 0;
  v_available boolean := false;
  v_reason text := 'disabled';
begin
  select * into v_settings from public.chat_settings where singleton;
  if not found then
    return pg_catalog.jsonb_build_object('available', false, 'reason', 'disabled',
      'withinHours', false, 'eligibleAgentCount', 0);
  end if;
  v_local := p_at at time zone v_settings.business_timezone;
  v_day := extract(dow from v_local)::integer::text;
  v_clock := v_local::time;
  for v_slot in select value from pg_catalog.jsonb_array_elements(v_settings.weekly_hours -> v_day) loop
    if v_clock >= (v_slot ->> 0)::time and v_clock < (v_slot ->> 1)::time then
      v_in_hours := true;
      exit;
    end if;
  end loop;
  select count(*)::integer into v_agent_count
  from public.chat_agent_availability a join public.admin_users u on u.id = a.admin_id
  where a.declared_state = 'online' and a.lease_expires_at > p_at
    and u.is_active = true and (u.role = 'owner' or (
      coalesce((u.permissions ->> 'support.view')::boolean, false)
      and coalesce((u.permissions ->> 'support.reply')::boolean, false)));

  if not v_settings.is_enabled then v_reason := 'disabled';
  elsif v_settings.availability_override = 'offline' then v_reason := 'forced_offline';
  elsif v_agent_count = 0 then v_reason := 'no_agent';
  elsif v_settings.availability_override = 'online' then
    v_available := true; v_reason := 'forced_online';
  elsif v_in_hours then v_available := true; v_reason := 'within_hours';
  else v_reason := 'outside_hours';
  end if;
  return pg_catalog.jsonb_build_object(
    'available', v_available, 'reason', v_reason, 'withinHours', v_in_hours,
    'eligibleAgentCount', v_agent_count, 'timezone', v_settings.business_timezone,
    'localTime', pg_catalog.to_char(v_local, 'YYYY-MM-DD HH24:MI:SS'));
end;
$$;

create or replace function public.chat_live_available() returns boolean
language sql set search_path = '' as $$
  select coalesce((public.chat_availability_details(pg_catalog.clock_timestamp())
    ->> 'available')::boolean, false);
$$;

-- All settings and their permanent admin log commit together. The expected
-- timestamp prevents two dashboard tabs from silently overwriting each other.
create function public.chat_update_settings(p_actor_id uuid,
  p_expected_updated_at timestamptz, p_settings jsonb) returns public.chat_settings
language plpgsql security definer set search_path = '' as $$
declare
  v_actor public.admin_users%rowtype;
  v_settings public.chat_settings%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_changed text[];
  v_keys constant text[] := array[
    'is_enabled','availability_override','business_timezone','weekly_hours',
    'welcome_message','offline_message','guest_contact_rule',
    'customer_send_cooldown_seconds','max_message_length','attachments_enabled',
    'allowed_attachment_mimes','max_attachment_bytes','max_attachments_per_message',
    'transfers_enabled','reopen_enabled','offline_behavior','ticket_conversion_enabled'
  ];
begin
  select * into v_actor from public.admin_users where id = p_actor_id and is_active = true;
  if not found or not (v_actor.role = 'owner'
    or coalesce((v_actor.permissions ->> 'settings.edit')::boolean, false)) then
    raise exception 'Live Chat settings access denied.' using errcode = '42501';
  end if;
  if pg_catalog.jsonb_typeof(p_settings) <> 'object'
    or not p_settings ?& v_keys
    or exists (select 1 from pg_catalog.jsonb_object_keys(p_settings) k
      where not k = any(v_keys)) then
    raise exception 'Live Chat settings payload is invalid.' using errcode = '22023';
  end if;
  select * into v_settings from public.chat_settings where singleton for update;
  if not found then raise exception 'Live Chat settings are unavailable.' using errcode = 'P0002'; end if;
  if p_expected_updated_at is null or v_settings.updated_at is distinct from p_expected_updated_at then
    raise exception 'CHAT_SETTINGS_STALE' using errcode = 'P0001';
  end if;
  v_before := to_jsonb(v_settings) - 'singleton' - 'updated_by' - 'updated_at';

  update public.chat_settings set
    is_enabled = (p_settings ->> 'is_enabled')::boolean,
    availability_override = p_settings ->> 'availability_override',
    business_timezone = p_settings ->> 'business_timezone',
    weekly_hours = p_settings -> 'weekly_hours',
    welcome_message = p_settings ->> 'welcome_message',
    offline_message = p_settings ->> 'offline_message',
    guest_contact_rule = p_settings ->> 'guest_contact_rule',
    customer_send_cooldown_seconds = (p_settings ->> 'customer_send_cooldown_seconds')::smallint,
    max_message_length = (p_settings ->> 'max_message_length')::integer,
    attachments_enabled = (p_settings ->> 'attachments_enabled')::boolean,
    allowed_attachment_mimes = array(select pg_catalog.jsonb_array_elements_text(
      p_settings -> 'allowed_attachment_mimes')),
    max_attachment_bytes = (p_settings ->> 'max_attachment_bytes')::integer,
    max_attachments_per_message = (p_settings ->> 'max_attachments_per_message')::smallint,
    transfers_enabled = (p_settings ->> 'transfers_enabled')::boolean,
    reopen_enabled = (p_settings ->> 'reopen_enabled')::boolean,
    offline_behavior = p_settings ->> 'offline_behavior',
    ticket_conversion_enabled = (p_settings ->> 'ticket_conversion_enabled')::boolean,
    updated_by = p_actor_id
  where singleton returning * into v_settings;
  v_after := to_jsonb(v_settings) - 'singleton' - 'updated_by' - 'updated_at';
  select pg_catalog.array_agg(b.key order by b.key) into v_changed
  from pg_catalog.jsonb_each(v_before) b join pg_catalog.jsonb_each(v_after) a using (key)
  where b.value is distinct from a.value;
  if coalesce(pg_catalog.cardinality(v_changed), 0) = 0 then return v_settings; end if;

  insert into public.admin_activity_logs(admin_user_id, author_name, author_email,
    author_role, action_key, description, metadata)
  values(p_actor_id, coalesce(nullif(pg_catalog.btrim(v_actor.full_name), ''), v_actor.email),
    v_actor.email, v_actor.role, 'chat.settings.updated',
    'Updated Live Chat settings: ' || pg_catalog.array_to_string(v_changed, ', '),
    pg_catalog.jsonb_build_object('changed_fields', v_changed,
      'before', v_before, 'after', v_after));
  return v_settings;
end;
$$;

-- Offline ticket mode keeps the chat as the canonical customer channel and
-- creates a linked system ticket in the same transaction as the first message.
create or replace function public.chat_start_with_message(p_actor_id uuid, p_is_guest boolean,
  p_name text, p_email text, p_mobile text, p_order_id uuid,
  p_creation_key uuid, p_subject_hash text, p_body text,
  p_message_key uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_conversation_id uuid;
  v_message_id uuid;
  v_existing_message_id uuid;
  v_ticket_id uuid;
  v_ticket_reference bigint;
  v_chat public.chat_conversations%rowtype;
  v_create_ticket boolean := false;
begin
  v_conversation_id := public.chat_create_or_resume(p_actor_id, p_is_guest,
    p_name, p_email, p_mobile, p_order_id, p_creation_key, p_subject_hash);
  select id into v_existing_message_id from public.chat_messages
    where conversation_id = v_conversation_id and sender_id = p_actor_id
      and idempotency_key = p_message_key;
  v_message_id := public.chat_send_message(v_conversation_id, p_actor_id,
    case when p_is_guest then 'guest' else 'customer' end,
    p_name, p_body, p_message_key, p_subject_hash, false);
  select * into v_chat from public.chat_conversations
    where id = v_conversation_id for update;
  v_ticket_id := v_chat.ticket_id;
  if v_existing_message_id is null and v_chat.intake_mode = 'offline' then
    select offline_behavior = 'ticket' and ticket_conversion_enabled
      into v_create_ticket from public.chat_settings where singleton;
  end if;
  if coalesce(v_create_ticket, false) and v_ticket_id is null then
    insert into public.support_tickets(customer_id, customer_email, customer_mobile,
      customer_name, order_id, subject, idempotency_key)
    values(v_chat.customer_id, v_chat.contact_email, v_chat.contact_mobile,
      v_chat.contact_name, v_chat.order_id,
      'Offline chat #' || v_chat.reference_number::text, v_chat.id)
    returning id, reference_number into v_ticket_id, v_ticket_reference;
    insert into public.support_ticket_events(ticket_id, actor_id, actor_type,
      event_type, new_value)
    values
      (v_ticket_id, null, 'system', 'created', 'open'),
      (v_ticket_id, null, 'system', 'source_chat', v_chat.id::text);
    update public.chat_conversations set ticket_id = v_ticket_id where id = v_chat.id;
    insert into public.chat_events(conversation_id, actor_id, actor_kind,
      event_type, old_value, new_value)
    values(v_chat.id, null, 'system', 'ticket_created', null,
      pg_catalog.jsonb_build_object('ticket_id', v_ticket_id,
        'ticket_reference', v_ticket_reference, 'offline', true));
  end if;
  return pg_catalog.jsonb_build_object('conversationId', v_conversation_id,
    'messageId', v_message_id, 'ticketId', v_ticket_id);
end;
$$;

-- Apply the saved conversion switch at the authorization boundary.
create or replace function public.chat_create_ticket(p_conversation_id uuid, p_staff_id uuid,
  p_subject text, p_expected_revision bigint) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_chat public.chat_conversations%rowtype;
  v_ticket_id uuid;
  v_ticket_reference bigint;
  v_manage boolean;
  v_reply boolean;
begin
  select a.role = 'owner' or coalesce((a.permissions ->> 'support.manage')::boolean, false),
    a.role = 'owner' or (coalesce((a.permissions ->> 'support.view')::boolean, false)
      and coalesce((a.permissions ->> 'support.reply')::boolean, false))
    into v_manage, v_reply from public.admin_users a
    where a.id = p_staff_id and a.is_active = true;
  if not coalesce(v_reply, false) then
    raise exception 'Support reply access is required.' using errcode = '42501';
  end if;
  select * into v_chat from public.chat_conversations
    where id = p_conversation_id for update;
  if not found then raise exception 'Chat not found.' using errcode = 'P0002'; end if;
  if not coalesce(v_manage, false)
    and v_chat.assigned_admin_id is distinct from p_staff_id then
    raise exception 'CHAT_TICKET_DENIED' using errcode = 'P0001';
  end if;
  if v_chat.ticket_id is not null then return v_chat.ticket_id; end if;
  if not exists (select 1 from public.chat_settings
    where singleton and ticket_conversion_enabled) then
    raise exception 'CHAT_TICKET_DISABLED' using errcode = 'P0001';
  end if;
  if p_expected_revision is null or v_chat.revision <> p_expected_revision then
    raise exception 'CHAT_STALE' using errcode = 'P0001';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_subject, ''))) not between 1 and 160 then
    raise exception 'Ticket subject is invalid.' using errcode = '22023';
  end if;
  if v_chat.contact_email is null and v_chat.contact_mobile is null then
    raise exception 'Ticket contact is unavailable.' using errcode = '22023';
  end if;
  insert into public.support_tickets(customer_id, customer_email, customer_mobile,
    customer_name, order_id, subject, assigned_admin_id, idempotency_key)
  values(v_chat.customer_id, v_chat.contact_email, v_chat.contact_mobile,
    v_chat.contact_name, v_chat.order_id, pg_catalog.btrim(p_subject),
    coalesce(v_chat.assigned_admin_id, p_staff_id), v_chat.id)
  returning id, reference_number into v_ticket_id, v_ticket_reference;
  insert into public.support_ticket_events(ticket_id, actor_id, actor_type,
    event_type, new_value)
  values
    (v_ticket_id, p_staff_id, 'staff', 'created', 'open'),
    (v_ticket_id, p_staff_id, 'staff', 'source_chat', v_chat.id::text);
  update public.chat_conversations set ticket_id = v_ticket_id where id = v_chat.id;
  insert into public.chat_events(conversation_id, actor_id, actor_kind,
    event_type, old_value, new_value)
  values(v_chat.id, p_staff_id, 'staff', 'ticket_created', null,
    pg_catalog.jsonb_build_object('ticket_id', v_ticket_id,
      'ticket_reference', v_ticket_reference));
  return v_ticket_id;
end;
$$;

revoke all on function public.chat_availability_details(timestamptz),
  public.chat_update_settings(uuid,timestamptz,jsonb)
  from public, anon, authenticated;
grant execute on function public.chat_availability_details(timestamptz),
  public.chat_update_settings(uuid,timestamptz,jsonb) to service_role;

commit;
