begin;

-- A row is reserved before the private object is uploaded and becomes visible
-- only after the server completes it. This keeps Realtime from announcing a
-- file that is not ready to download yet.
alter table public.chat_attachments
  add column content_sha256 text,
  add column is_ready boolean not null default false,
  add constraint chat_attachments_hash_check check (
    content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'
  );
update public.chat_attachments set is_ready = true;
create index chat_attachments_ready_message_idx
  on public.chat_attachments(message_id,created_at) where is_ready;

create or replace function public.chat_consume_limit(p_scope text, p_subject_hash text,
  p_window_seconds integer, p_max integer) returns void
language plpgsql set search_path = '' as $$
declare
  v_start timestamptz;
  v_attempts integer;
begin
  if p_scope not in ('message','conversation','typing','attachment')
    or p_subject_hash !~ '^[0-9a-f]{64}$'
    or p_window_seconds not between 1 and 86400 or p_max not between 1 and 100 then
    raise exception 'Invalid chat limit.' using errcode = '22023';
  end if;
  delete from public.chat_rate_limits where ctid in (
    select ctid from public.chat_rate_limits
    where expires_at < pg_catalog.clock_timestamp() limit 20
  );
  v_start := pg_catalog.to_timestamp(pg_catalog.floor(
    extract(epoch from pg_catalog.clock_timestamp()) / p_window_seconds) * p_window_seconds);
  insert into public.chat_rate_limits(scope,subject_hash,window_started_at,attempts,expires_at)
  values (p_scope,p_subject_hash,v_start,1,
    v_start + pg_catalog.make_interval(secs => p_window_seconds))
  on conflict (scope,subject_hash,window_started_at) do update
    set attempts = public.chat_rate_limits.attempts + 1
  returning attempts into v_attempts;
  if v_attempts > p_max then
    raise exception 'CHAT_RATE_LIMIT' using errcode = 'P0001';
  end if;
end;
$$;

create function public.chat_reserve_attachment(p_attachment_id uuid,
  p_conversation_id uuid, p_message_id uuid, p_actor_id uuid, p_actor_kind text,
  p_original_name text, p_storage_path text, p_mime_type text,
  p_size_bytes integer, p_content_sha256 text, p_subject_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_chat public.chat_conversations%rowtype;
  v_message public.chat_messages%rowtype;
  v_existing public.chat_attachments%rowtype;
  v_enabled boolean;
  v_mimes text[];
  v_max_bytes integer;
  v_max_count integer;
  v_extension text;
begin
  if p_attachment_id is null or p_actor_id is null
    or p_actor_kind not in ('customer','guest','staff')
    or p_content_sha256 is null or p_content_sha256 !~ '^[0-9a-f]{64}$'
    or p_original_name is null or pg_catalog.char_length(pg_catalog.btrim(p_original_name)) not between 1 and 180 then
    raise exception 'Attachment details are invalid.' using errcode = '22023';
  end if;
  select * into v_chat from public.chat_conversations
    where id = p_conversation_id for update;
  if not found then raise exception 'Chat not found.' using errcode = 'P0002'; end if;
  select * into v_message from public.chat_messages
    where id = p_message_id and conversation_id = p_conversation_id for update;
  if not found then raise exception 'Chat message not found.' using errcode = 'P0002'; end if;
  if v_chat.status = 'closed' then
    raise exception 'CHAT_CLOSED' using errcode = 'P0001';
  end if;
  if p_actor_kind = 'customer' then
    if v_chat.customer_id is distinct from p_actor_id
      or v_message.sender_id is distinct from p_actor_id
      or v_message.sender_kind <> 'customer' or v_message.is_internal
      or not exists (select 1 from public.customer_profiles p
        where p.id = p_actor_id and p.is_active) then
      raise exception 'Chat attachment access denied.' using errcode = '42501';
    end if;
  elsif p_actor_kind = 'guest' then
    if v_chat.guest_auth_user_id is distinct from p_actor_id or v_chat.customer_id is not null
      or v_message.sender_id is distinct from p_actor_id or v_message.sender_kind <> 'guest'
      or v_message.is_internal or not exists (select 1 from auth.users u
        where u.id = p_actor_id and u.is_anonymous) then
      raise exception 'Chat attachment access denied.' using errcode = '42501';
    end if;
  elsif v_chat.status <> 'active' or v_chat.assigned_admin_id is distinct from p_actor_id
    or v_message.sender_id is distinct from p_actor_id or v_message.sender_kind <> 'staff'
    or not exists (select 1 from public.admin_users a where a.id = p_actor_id
      and a.is_active and (a.role = 'owner' or (
        coalesce((a.permissions ->> 'support.view')::boolean,false)
        and coalesce((a.permissions ->> 'support.reply')::boolean,false)))) then
    raise exception 'Chat attachment access denied.' using errcode = '42501';
  end if;

  select attachments_enabled,allowed_attachment_mimes,max_attachment_bytes,
    max_attachments_per_message into v_enabled,v_mimes,v_max_bytes,v_max_count
    from public.chat_settings where singleton;
  if not coalesce(v_enabled,false) then
    raise exception 'CHAT_ATTACHMENTS_DISABLED' using errcode = 'P0001';
  end if;
  if p_mime_type <> all(v_mimes) or p_size_bytes not between 1 and v_max_bytes then
    raise exception 'Attachment type or size is invalid.' using errcode = '22023';
  end if;
  v_extension := case p_mime_type when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png' when 'image/webp' then 'webp'
    when 'application/pdf' then 'pdf' end;
  if v_extension is null or p_storage_path is distinct from
    p_conversation_id::text || '/' || p_message_id::text || '/'
      || p_attachment_id::text || '.' || v_extension then
    raise exception 'Attachment path is invalid.' using errcode = '22023';
  end if;

  select * into v_existing from public.chat_attachments where id = p_attachment_id;
  if found then
    if v_existing.conversation_id = p_conversation_id
      and v_existing.message_id = p_message_id
      and v_existing.uploaded_by = p_actor_id
      and v_existing.original_name = pg_catalog.btrim(p_original_name)
      and v_existing.storage_path = p_storage_path
      and v_existing.mime_type = p_mime_type
      and v_existing.size_bytes = p_size_bytes
      and v_existing.content_sha256 = p_content_sha256 then
      return pg_catalog.jsonb_build_object('id',v_existing.id,'created',false,
        'ready',v_existing.is_ready);
    end if;
    raise exception 'CHAT_ATTACHMENT_KEY_CONFLICT' using errcode = 'P0001';
  end if;
  if (select count(*) from public.chat_attachments where message_id = p_message_id) >= v_max_count then
    raise exception 'CHAT_ATTACHMENT_LIMIT' using errcode = 'P0001';
  end if;
  perform public.chat_consume_limit('attachment',p_subject_hash,60,12);
  insert into public.chat_attachments(id,conversation_id,message_id,uploaded_by,
    original_name,storage_path,mime_type,size_bytes,content_sha256)
  values(p_attachment_id,p_conversation_id,p_message_id,p_actor_id,
    pg_catalog.btrim(p_original_name),p_storage_path,p_mime_type,p_size_bytes,p_content_sha256);
  return pg_catalog.jsonb_build_object('id',p_attachment_id,'created',true,'ready',false);
end;
$$;

create function public.chat_complete_attachment(p_attachment_id uuid,
  p_actor_id uuid, p_content_sha256 text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  update public.chat_attachments set is_ready = true
    where id = p_attachment_id and uploaded_by = p_actor_id
      and content_sha256 = p_content_sha256
    returning id into v_id;
  if v_id is null then
    raise exception 'Chat attachment access denied.' using errcode = '42501';
  end if;
  return v_id;
end;
$$;

create function public.chat_signal_attachment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_internal boolean;
  v_payload jsonb;
begin
  select is_internal into v_internal from public.chat_messages where id = new.message_id;
  v_payload := pg_catalog.jsonb_build_object('conversationId',new.conversation_id,
    'messageId',new.message_id,'attachmentId',new.id,'kind','attachment');
  perform realtime.send(v_payload,'changed','chat:staff:' || new.conversation_id::text,true);
  if not coalesce(v_internal,true) then
    perform realtime.send(v_payload,'changed','chat:public:' || new.conversation_id::text,true);
  end if;
  return new;
end;
$$;
create trigger chat_signal_attachment_ready after update of is_ready on public.chat_attachments
for each row when (old.is_ready = false and new.is_ready = true)
execute function public.chat_signal_attachment();

revoke all on function public.chat_reserve_attachment(uuid,uuid,uuid,uuid,text,text,text,text,integer,text,text),
  public.chat_complete_attachment(uuid,uuid,text), public.chat_signal_attachment()
  from public,anon,authenticated;
grant execute on function public.chat_reserve_attachment(uuid,uuid,uuid,uuid,text,text,text,text,integer,text,text),
  public.chat_complete_attachment(uuid,uuid,text) to service_role;

commit;
