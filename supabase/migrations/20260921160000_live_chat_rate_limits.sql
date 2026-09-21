begin;

-- Actor limits remain in the write transactions. Network limits add a second,
-- server-generated subject that survives anonymous-session rotation. Only
-- hashes are stored; raw addresses and message bodies never enter this table.
alter table public.chat_rate_limits
  drop constraint chat_rate_limits_scope_check;
alter table public.chat_rate_limits
  add constraint chat_rate_limits_scope_check check (scope in (
    'message','conversation','duplicate','attachment','typing',
    'network_message','network_message_hour','network_conversation',
    'network_conversation_day','network_duplicate','network_attachment',
    'network_attachment_hour','network_typing','network_typing_hour'
  ));

create or replace function public.chat_consume_limit(p_scope text, p_subject_hash text,
  p_window_seconds integer, p_max integer) returns void
language plpgsql set search_path = '' as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_start timestamptz;
  v_expires timestamptz;
  v_attempts integer;
  v_retry integer;
begin
  if p_scope not in (
      'message','conversation','duplicate','attachment','typing',
      'network_message','network_message_hour','network_conversation',
      'network_conversation_day','network_duplicate','network_attachment',
      'network_attachment_hour','network_typing','network_typing_hour'
    ) or p_subject_hash !~ '^[0-9a-f]{64}$'
    or p_window_seconds not between 1 and 86400 or p_max not between 1 and 1000 then
    raise exception 'Invalid chat limit.' using errcode = '22023';
  end if;
  delete from public.chat_rate_limits where ctid in (
    select ctid from public.chat_rate_limits
    where expires_at < v_now limit 20
  );
  v_start := pg_catalog.to_timestamp(pg_catalog.floor(
    extract(epoch from v_now) / p_window_seconds) * p_window_seconds);
  v_expires := v_start + pg_catalog.make_interval(secs => p_window_seconds);
  insert into public.chat_rate_limits(scope,subject_hash,window_started_at,attempts,expires_at)
  values (p_scope,p_subject_hash,v_start,1,v_expires)
  on conflict (scope,subject_hash,window_started_at) do update
    set attempts = public.chat_rate_limits.attempts + 1
  returning attempts into v_attempts;
  if v_attempts > p_max then
    v_retry := greatest(1,
      pg_catalog.ceil(extract(epoch from v_expires - v_now))::integer);
    raise exception 'CHAT_RATE_LIMIT' using errcode = 'P0001', hint = v_retry::text;
  end if;
end;
$$;

-- One RPC evaluates all network windows for an action. Generous thresholds
-- avoid penalizing normal shared networks while bounding guest-session churn.
create function public.chat_consume_network_limits(p_network_hash text,
  p_action text, p_content_hash text default null) returns void
language plpgsql set search_path = '' as $$
begin
  if p_network_hash !~ '^[0-9a-f]{64}$'
    or p_action not in ('conversation','conversation_message','message','attachment','typing')
    or (p_content_hash is not null and p_content_hash !~ '^[0-9a-f]{64}$') then
    raise exception 'Invalid chat network limit.' using errcode = '22023';
  end if;

  if p_action in ('conversation','conversation_message') then
    perform public.chat_consume_limit('network_conversation',p_network_hash,3600,20);
    perform public.chat_consume_limit('network_conversation_day',p_network_hash,86400,60);
  end if;
  if p_action in ('conversation_message','message') then
    perform public.chat_consume_limit('network_message',p_network_hash,60,60);
    perform public.chat_consume_limit('network_message_hour',p_network_hash,3600,500);
    if p_content_hash is not null then
      perform public.chat_consume_limit('network_duplicate',p_content_hash,600,5);
    end if;
  elsif p_action = 'attachment' then
    perform public.chat_consume_limit('network_attachment',p_network_hash,60,30);
    perform public.chat_consume_limit('network_attachment_hour',p_network_hash,3600,120);
  elsif p_action = 'typing' then
    perform public.chat_consume_limit('network_typing',p_network_hash,60,30);
    perform public.chat_consume_limit('network_typing_hour',p_network_hash,3600,300);
  end if;
end;
$$;

create index chat_messages_sender_recent_idx
  on public.chat_messages(sender_id,created_at desc)
  where sender_kind in ('customer','guest');

-- Idempotent retries still return before any limit is consumed. For new
-- customer messages, normalize spacing and case so trivial text changes do
-- not bypass the immediate duplicate check. Three repeats over ten minutes
-- are allowed; a fourth is paused.
create or replace function public.chat_send_message(p_conversation_id uuid, p_sender_id uuid,
  p_sender_kind text, p_sender_name text, p_body text, p_key uuid,
  p_subject_hash text, p_internal boolean default false) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_conversation public.chat_conversations%rowtype;
  v_existing public.chat_messages%rowtype;
  v_id uuid;
  v_seq bigint;
  v_body text := pg_catalog.btrim(p_body);
  v_normalized_body text;
  v_limit integer;
  v_cooldown integer;
  v_previous timestamptz;
  v_duplicate_count integer;
  v_duplicate_oldest timestamptz;
  v_duplicate_newest timestamptz;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_retry integer;
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
  select max_message_length,customer_send_cooldown_seconds
    into v_limit,v_cooldown from public.chat_settings where singleton;
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
    if v_previous is not null
      and v_previous + pg_catalog.make_interval(secs => v_cooldown) > v_now then
      v_retry := greatest(1,pg_catalog.ceil(extract(epoch from
        v_previous + pg_catalog.make_interval(secs => v_cooldown) - v_now))::integer);
      raise exception 'CHAT_COOLDOWN' using errcode = 'P0001', hint = v_retry::text;
    end if;
    perform public.chat_consume_limit('message',p_subject_hash,60,12);
    v_normalized_body := pg_catalog.lower(pg_catalog.regexp_replace(
      v_body,'[[:space:]]+',' ','g'));
    select count(*)::integer,min(created_at),max(created_at)
      into v_duplicate_count,v_duplicate_oldest,v_duplicate_newest
    from public.chat_messages
    where sender_id = p_sender_id and sender_kind in ('customer','guest')
      and created_at > v_now - interval '10 minutes'
      and pg_catalog.lower(pg_catalog.regexp_replace(
        pg_catalog.btrim(body),'[[:space:]]+',' ','g')) = v_normalized_body;
    if v_duplicate_newest is not null
      and v_duplicate_newest > v_now - interval '15 seconds' then
      v_retry := greatest(1,pg_catalog.ceil(extract(epoch from
        v_duplicate_newest + interval '15 seconds' - v_now))::integer);
      raise exception 'CHAT_DUPLICATE' using errcode = 'P0001', hint = v_retry::text;
    elsif v_duplicate_count >= 3 then
      v_retry := greatest(1,pg_catalog.ceil(extract(epoch from
        v_duplicate_oldest + interval '10 minutes' - v_now))::integer);
      raise exception 'CHAT_DUPLICATE' using errcode = 'P0001', hint = v_retry::text;
    end if;
  end if;
  insert into public.chat_messages(conversation_id,sender_id,sender_kind,
    sender_name,body,is_internal,idempotency_key)
  values (p_conversation_id,p_sender_id,p_sender_kind,
    pg_catalog.btrim(p_sender_name),v_body,p_internal,p_key)
  returning id,sequence_number into v_id,v_seq;
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
    insert into public.chat_events(conversation_id,actor_id,actor_kind,
      event_type,related_message_id)
    values (p_conversation_id,p_sender_id,'staff','agent_replied',v_id);
  end if;
  return v_id;
end;
$$;

revoke all on function public.chat_consume_network_limits(text,text,text)
  from public,anon,authenticated;
grant execute on function public.chat_consume_network_limits(text,text,text)
  to service_role;

commit;
