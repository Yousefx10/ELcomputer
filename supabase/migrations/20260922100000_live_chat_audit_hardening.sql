begin;

-- An uncertain HTTP response may be retried with the same submission key.
-- Recognize an already committed message before consuming the separate network
-- budget, while leaving all new or conflicting submissions rate limited.
create function public.chat_consume_network_limits_unless_retry(
  p_network_hash text, p_action text, p_content_hash text,
  p_actor_id uuid, p_actor_kind text, p_conversation_id uuid,
  p_creation_key uuid, p_message_key uuid, p_body text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_conversation_id uuid;
  v_body text := pg_catalog.btrim(p_body);
begin
  if p_network_hash is null or p_network_hash !~ '^[0-9a-f]{64}$'
    or (p_content_hash is not null and p_content_hash !~ '^[0-9a-f]{64}$')
    or p_action is null or p_action not in ('message','conversation_message')
    or p_actor_id is null or p_actor_kind is null
    or p_actor_kind not in ('customer','guest') or p_message_key is null
    or p_body is null or pg_catalog.char_length(v_body) not between 1 and 10000
    or (p_action = 'message' and (p_conversation_id is null or p_creation_key is not null))
    or (p_action = 'conversation_message' and (p_creation_key is null or p_conversation_id is not null)) then
    raise exception 'Invalid chat retry limit.' using errcode = '22023';
  end if;

  if p_action = 'message' then
    select c.id into v_conversation_id from public.chat_conversations c
    where c.id = p_conversation_id and (
      (p_actor_kind = 'customer' and c.customer_id = p_actor_id)
      or (p_actor_kind = 'guest' and c.guest_auth_user_id = p_actor_id
        and c.customer_id is null));
  else
    select c.id into v_conversation_id from public.chat_conversations c
    where c.creation_key = p_creation_key and (
      (p_actor_kind = 'customer' and c.customer_id = p_actor_id)
      or (p_actor_kind = 'guest' and c.guest_auth_user_id = p_actor_id
        and c.customer_id is null));
  end if;

  if v_conversation_id is not null and exists (
    select 1 from public.chat_messages m
    where m.conversation_id = v_conversation_id and m.sender_id = p_actor_id
      and m.sender_kind = p_actor_kind and m.idempotency_key = p_message_key
      and m.body = v_body and not m.is_internal
  ) then
    return false;
  end if;

  perform public.chat_consume_network_limits(
    p_network_hash,p_action,p_content_hash);
  return true;
end;
$$;

-- Reservation and object upload are separated by network I/O. Recheck the
-- conversation, message, identity, and assignment while completing a pending
-- object so a concurrent close, transfer, deactivation, or guest association
-- cannot publish a file. A file already completed remains idempotently retryable.
create or replace function public.chat_complete_attachment(p_attachment_id uuid,
  p_actor_id uuid, p_content_sha256 text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_attachment public.chat_attachments%rowtype;
  v_chat public.chat_conversations%rowtype;
  v_message public.chat_messages%rowtype;
  v_id uuid;
begin
  select * into v_attachment from public.chat_attachments
    where id = p_attachment_id for update;
  if not found or v_attachment.uploaded_by is distinct from p_actor_id
    or v_attachment.content_sha256 is distinct from p_content_sha256 then
    raise exception 'Chat attachment access denied.' using errcode = '42501';
  end if;
  if v_attachment.is_ready then return v_attachment.id; end if;

  select * into v_chat from public.chat_conversations
    where id = v_attachment.conversation_id for update;
  if not found then
    raise exception 'CHAT_CLOSED' using errcode = 'P0001';
  end if;
  select * into v_message from public.chat_messages
    where id = v_attachment.message_id
      and conversation_id = v_attachment.conversation_id;
  if not found or v_chat.status = 'closed'
    or v_message.sender_id is distinct from p_actor_id then
    raise exception 'CHAT_CLOSED' using errcode = 'P0001';
  end if;

  if v_message.sender_kind = 'customer' then
    if v_chat.customer_id is distinct from p_actor_id or v_message.is_internal
      or not exists (select 1 from public.customer_profiles p
        where p.id = p_actor_id and p.is_active) then
      raise exception 'Chat attachment access denied.' using errcode = '42501';
    end if;
  elsif v_message.sender_kind = 'guest' then
    if v_chat.guest_auth_user_id is distinct from p_actor_id
      or v_chat.customer_id is not null or v_message.is_internal
      or not exists (select 1 from auth.users u
        where u.id = p_actor_id and u.is_anonymous) then
      raise exception 'Chat attachment access denied.' using errcode = '42501';
    end if;
  elsif v_message.sender_kind = 'staff' then
    if v_chat.status <> 'active' or v_chat.assigned_admin_id is distinct from p_actor_id
      or not exists (select 1 from public.admin_users a where a.id = p_actor_id
        and a.is_active and (a.role = 'owner' or (
          coalesce((a.permissions ->> 'support.view')::boolean,false)
          and coalesce((a.permissions ->> 'support.reply')::boolean,false)))) then
      raise exception 'Chat attachment access denied.' using errcode = '42501';
    end if;
  else
    raise exception 'Chat attachment access denied.' using errcode = '42501';
  end if;

  update public.chat_attachments set is_ready = true
    where id = v_attachment.id returning id into v_id;
  return v_id;
end;
$$;

-- A public message already supplies a scoped message signal. Avoid emitting a
-- second conversation signal for its activity-only projection update, and send
-- one inbox signal for every public message regardless of sender.
drop trigger chat_signal_conversation on public.chat_conversations;
create trigger chat_signal_conversation
after insert or update of customer_id,guest_auth_user_id,contact_name,
  contact_email,contact_mobile,status,intake_mode,assigned_admin_id,
  order_id,ticket_id,closed_at on public.chat_conversations
for each row execute function public.chat_signal_conversation();

create or replace function public.chat_signal_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_payload jsonb;
begin
  v_payload := pg_catalog.jsonb_build_object('conversationId',new.conversation_id,
    'messageId',new.id,'sequence',new.sequence_number,'kind','message');
  perform realtime.send(v_payload,'changed','chat:staff:' || new.conversation_id::text,true);
  if not new.is_internal then
    perform realtime.send(v_payload,'changed','chat:public:' || new.conversation_id::text,true);
    perform realtime.send(pg_catalog.jsonb_build_object(
      'conversationId',new.conversation_id,'sequence',new.sequence_number,
      'kind','message'),'changed','chat:inbox',true);
  end if;
  return new;
end;
$$;

-- Match the bounded inbox views without relying on a sort after broad status,
-- assignment, or offline filters.
create index chat_conversations_status_activity_idx
  on public.chat_conversations(status,last_activity_at desc,id);
create index chat_conversations_open_assignee_activity_idx
  on public.chat_conversations(assigned_admin_id,last_activity_at desc,id)
  where status <> 'closed';
create index chat_conversations_unassigned_activity_idx
  on public.chat_conversations(last_activity_at desc,id)
  where assigned_admin_id is null and status <> 'closed';
create index chat_conversations_offline_activity_idx
  on public.chat_conversations(last_activity_at desc,id)
  where intake_mode = 'offline' and status <> 'closed';

-- Trigger helpers are not browser-callable application APIs.
revoke all on function public.chat_consume_network_limits_unless_retry(
  text,text,text,uuid,text,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.chat_consume_network_limits_unless_retry(
  text,text,text,uuid,text,uuid,uuid,uuid,text) to service_role;
revoke all on function public.chat_validate_settings(),
  public.chat_reset_manifest() from public,anon,authenticated;

commit;
