begin;

-- New conversations always remain Live Chat conversations. Tickets are created
-- only by staff conversion or unresolved customer feedback.
update public.chat_settings set offline_behavior = 'conversation'
where offline_behavior <> 'conversation';
alter table public.chat_settings
  add column request_call_enabled boolean not null default false,
  add constraint chat_settings_conversation_intake_only
    check (offline_behavior = 'conversation');

alter table public.chat_conversations
  add column resolution_resolved boolean,
  add column satisfaction_rating smallint,
  add column resolution_feedback_at timestamptz,
  add column callback_status text,
  add column callback_mobile text,
  add column callback_requested_at timestamptz,
  add column callback_updated_at timestamptz,
  add constraint chat_conversations_rating_check
    check (satisfaction_rating is null or satisfaction_rating between 1 and 5),
  add constraint chat_conversations_resolution_check check (
    (resolution_resolved is null and satisfaction_rating is null and resolution_feedback_at is null)
    or (resolution_resolved is not null and satisfaction_rating is not null and resolution_feedback_at is not null)
  ),
  add constraint chat_conversations_callback_status_check
    check (callback_status is null or callback_status in ('pending','completed','cancelled')),
  add constraint chat_conversations_callback_mobile_check
    check (callback_mobile is null or callback_mobile ~ '^\+?[0-9 ()-]{7,30}$'),
  add constraint chat_conversations_callback_check check (
    (callback_status is null and callback_mobile is null
      and callback_requested_at is null and callback_updated_at is null)
    or (callback_status is not null and callback_mobile is not null
      and callback_requested_at is not null and callback_updated_at is not null)
  );

create index chat_conversations_pending_callback_idx
  on public.chat_conversations(callback_requested_at desc,id)
  where callback_status = 'pending';

alter table public.chat_events drop constraint chat_events_event_type_check;
alter table public.chat_events add constraint chat_events_event_type_check
  check (event_type in (
    'created', 'identified', 'claimed', 'assigned', 'transferred',
    'agent_replied', 'status_changed', 'order_linked', 'order_unlinked',
    'ticket_created', 'closed', 'reopened', 'resolution_feedback',
    'callback_requested', 'callback_updated'
  ));

create or replace function public.chat_update_settings(p_actor_id uuid,
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
    'transfers_enabled','reopen_enabled','offline_behavior','ticket_conversion_enabled',
    'request_call_enabled'
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
    request_call_enabled = (p_settings ->> 'request_call_enabled')::boolean,
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

create or replace function public.chat_start_with_message(p_actor_id uuid, p_is_guest boolean,
  p_name text, p_email text, p_mobile text, p_order_id uuid,
  p_creation_key uuid, p_subject_hash text, p_body text,
  p_message_key uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_conversation_id uuid;
  v_message_id uuid;
begin
  v_conversation_id := public.chat_create_or_resume(p_actor_id, p_is_guest,
    p_name, p_email, p_mobile, p_order_id, p_creation_key, p_subject_hash);
  v_message_id := public.chat_send_message(v_conversation_id, p_actor_id,
    case when p_is_guest then 'guest' else 'customer' end,
    p_name, p_body, p_message_key, p_subject_hash, false);
  return pg_catalog.jsonb_build_object('conversationId', v_conversation_id,
    'messageId', v_message_id, 'ticketId', null);
end;
$$;

create function public.chat_submit_resolution_feedback(p_conversation_id uuid,
  p_actor_id uuid, p_is_guest boolean, p_resolved boolean,
  p_rating smallint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_chat public.chat_conversations%rowtype;
  v_actor_kind text := case when p_is_guest then 'guest' else 'customer' end;
  v_ticket_id uuid;
  v_ticket_reference bigint;
  v_negative boolean;
begin
  if p_resolved is null or p_rating is null or p_rating not between 1 and 5 then
    raise exception 'Resolution feedback is invalid.' using errcode = '22023';
  end if;
  select * into v_chat from public.chat_conversations
    where id = p_conversation_id for update;
  if not found then raise exception 'Chat not found.' using errcode = 'P0002'; end if;
  if (p_is_guest and (v_chat.guest_auth_user_id is distinct from p_actor_id
      or v_chat.customer_id is not null))
    or (not p_is_guest and v_chat.customer_id is distinct from p_actor_id) then
    raise exception 'Chat feedback access denied.' using errcode = '42501';
  end if;
  if v_chat.status <> 'closed' then
    raise exception 'CHAT_FEEDBACK_OPEN' using errcode = 'P0001';
  end if;
  if v_chat.resolution_feedback_at is not null then
    select reference_number into v_ticket_reference from public.support_tickets
      where id = v_chat.ticket_id;
    return pg_catalog.jsonb_build_object('resolved',v_chat.resolution_resolved,
      'rating',v_chat.satisfaction_rating,'ticketId',v_chat.ticket_id,
      'ticketReference',v_ticket_reference,'submittedAt',v_chat.resolution_feedback_at);
  end if;

  v_negative := not p_resolved or p_rating <= 2;
  v_ticket_id := v_chat.ticket_id;
  if v_negative and v_ticket_id is null then
    insert into public.support_tickets(customer_id,customer_email,customer_mobile,
      customer_name,order_id,subject,assigned_admin_id,idempotency_key)
    values(v_chat.customer_id,v_chat.contact_email,v_chat.contact_mobile,
      v_chat.contact_name,v_chat.order_id,
      'Unresolved live chat #' || v_chat.reference_number::text ||
        ' (' || p_rating::text || '/5)',v_chat.assigned_admin_id,v_chat.id)
    returning id,reference_number into v_ticket_id,v_ticket_reference;
    insert into public.support_ticket_events(ticket_id,actor_id,actor_type,
      event_type,new_value)
    values
      (v_ticket_id,null,'system','created','open'),
      (v_ticket_id,null,'system','source_chat',v_chat.id::text);
  elsif v_ticket_id is not null then
    select reference_number into v_ticket_reference from public.support_tickets
      where id = v_ticket_id;
  end if;

  update public.chat_conversations set
    resolution_resolved = p_resolved,
    satisfaction_rating = p_rating,
    resolution_feedback_at = pg_catalog.clock_timestamp(),
    ticket_id = coalesce(ticket_id,v_ticket_id)
  where id = v_chat.id;
  insert into public.chat_events(conversation_id,actor_id,actor_kind,
    event_type,new_value)
  values(v_chat.id,p_actor_id,v_actor_kind,'resolution_feedback',
    pg_catalog.jsonb_build_object('resolved',p_resolved,'rating',p_rating,
      'negative',v_negative,'ticket_id',v_ticket_id));
  if v_negative and v_chat.ticket_id is null then
    insert into public.chat_events(conversation_id,actor_id,actor_kind,
      event_type,new_value)
    values(v_chat.id,null,'system','ticket_created',
      pg_catalog.jsonb_build_object('ticket_id',v_ticket_id,
        'ticket_reference',v_ticket_reference,'resolution_follow_up',true));
  end if;
  return pg_catalog.jsonb_build_object('resolved',p_resolved,'rating',p_rating,
    'ticketId',v_ticket_id,'ticketReference',v_ticket_reference,
    'submittedAt',pg_catalog.clock_timestamp());
end;
$$;

create function public.chat_request_callback(p_conversation_id uuid,
  p_actor_id uuid, p_is_guest boolean, p_mobile text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_chat public.chat_conversations%rowtype;
  v_mobile text := pg_catalog.btrim(coalesce(p_mobile,''));
  v_actor_kind text := case when p_is_guest then 'guest' else 'customer' end;
begin
  if v_mobile !~ '^\+?[0-9 ()-]{7,30}$' then
    raise exception 'Callback mobile is invalid.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.chat_settings
    where singleton and request_call_enabled) then
    raise exception 'CHAT_CALLBACK_DISABLED' using errcode = 'P0001';
  end if;
  select * into v_chat from public.chat_conversations
    where id = p_conversation_id for update;
  if not found then raise exception 'Chat not found.' using errcode = 'P0002'; end if;
  if (p_is_guest and (v_chat.guest_auth_user_id is distinct from p_actor_id
      or v_chat.customer_id is not null))
    or (not p_is_guest and v_chat.customer_id is distinct from p_actor_id) then
    raise exception 'Callback request access denied.' using errcode = '42501';
  end if;
  if v_chat.callback_status is not null then
    return pg_catalog.jsonb_build_object('status',v_chat.callback_status,
      'mobile',v_chat.callback_mobile,'requestedAt',v_chat.callback_requested_at,
      'updatedAt',v_chat.callback_updated_at);
  end if;
  update public.chat_conversations set callback_status = 'pending',
    callback_mobile = v_mobile, callback_requested_at = pg_catalog.clock_timestamp(),
    callback_updated_at = pg_catalog.clock_timestamp()
  where id = v_chat.id;
  insert into public.chat_events(conversation_id,actor_id,actor_kind,
    event_type,new_value)
  values(v_chat.id,p_actor_id,v_actor_kind,'callback_requested',
    pg_catalog.jsonb_build_object('status','pending','mobile',v_mobile));
  return pg_catalog.jsonb_build_object('status','pending','mobile',v_mobile,
    'requestedAt',pg_catalog.clock_timestamp(),'updatedAt',pg_catalog.clock_timestamp());
end;
$$;

create function public.chat_set_callback_status(p_conversation_id uuid,
  p_staff_id uuid, p_status text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_chat public.chat_conversations%rowtype;
  v_manage boolean;
  v_reply boolean;
begin
  if p_status not in ('completed','cancelled') then
    raise exception 'Callback status is invalid.' using errcode = '22023';
  end if;
  select a.role = 'owner' or coalesce((a.permissions ->> 'support.manage')::boolean,false),
    a.role = 'owner' or (coalesce((a.permissions ->> 'support.view')::boolean,false)
      and coalesce((a.permissions ->> 'support.reply')::boolean,false))
    into v_manage,v_reply from public.admin_users a
    where a.id = p_staff_id and a.is_active;
  if not coalesce(v_reply,false) then
    raise exception 'Support reply access is required.' using errcode = '42501';
  end if;
  select * into v_chat from public.chat_conversations
    where id = p_conversation_id for update;
  if not found then raise exception 'Chat not found.' using errcode = 'P0002'; end if;
  if v_chat.callback_status <> 'pending' then
    raise exception 'CHAT_CALLBACK_NOT_PENDING' using errcode = 'P0001';
  end if;
  if v_chat.assigned_admin_id is not null
    and v_chat.assigned_admin_id is distinct from p_staff_id
    and not coalesce(v_manage,false) then
    raise exception 'CHAT_CALLBACK_DENIED' using errcode = 'P0001';
  end if;
  update public.chat_conversations set callback_status = p_status,
    callback_updated_at = pg_catalog.clock_timestamp()
  where id = v_chat.id;
  insert into public.chat_events(conversation_id,actor_id,actor_kind,
    event_type,old_value,new_value)
  values(v_chat.id,p_staff_id,'staff','callback_updated',
    pg_catalog.jsonb_build_object('status','pending'),
    pg_catalog.jsonb_build_object('status',p_status));
  return v_chat.id;
end;
$$;

drop trigger chat_signal_conversation on public.chat_conversations;
create trigger chat_signal_conversation
after insert or update of customer_id,guest_auth_user_id,contact_name,
  contact_email,contact_mobile,status,intake_mode,assigned_admin_id,
  order_id,ticket_id,closed_at,resolution_resolved,satisfaction_rating,
  resolution_feedback_at,callback_status,callback_mobile,callback_requested_at
on public.chat_conversations
for each row execute function public.chat_signal_conversation();

revoke all on function public.chat_submit_resolution_feedback(uuid,uuid,boolean,boolean,smallint),
  public.chat_request_callback(uuid,uuid,boolean,text),
  public.chat_set_callback_status(uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.chat_submit_resolution_feedback(uuid,uuid,boolean,boolean,smallint),
  public.chat_request_callback(uuid,uuid,boolean,text),
  public.chat_set_callback_status(uuid,uuid,text)
  to service_role;

commit;
