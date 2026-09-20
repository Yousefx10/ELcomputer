begin;

-- Chat is disabled until the later application and staging phases are complete.
-- These settings are private; public clients will receive a projected status API.
create table public.chat_settings (
  singleton boolean primary key default true check (singleton),
  is_enabled boolean not null default false,
  availability_override text not null default 'auto'
    check (availability_override in ('auto', 'online', 'offline')),
  business_timezone text not null default 'Africa/Cairo'
    check (char_length(business_timezone) between 3 and 64),
  weekly_hours jsonb not null default '{"0":[["09:00","18:00"]],"1":[["09:00","18:00"]],"2":[["09:00","18:00"]],"3":[["09:00","18:00"]],"4":[["09:00","18:00"]],"5":[],"6":[]}'::jsonb,
  welcome_message text not null default 'Hi! How can we help you today?'
    check (char_length(welcome_message) between 1 and 500),
  offline_message text not null default 'Support is currently offline. Leave us a message.'
    check (char_length(offline_message) between 1 and 500),
  guest_contact_rule text not null default 'either'
    check (guest_contact_rule in ('either', 'email', 'mobile', 'both')),
  customer_send_cooldown_seconds smallint not null default 4
    check (customer_send_cooldown_seconds between 0 and 60),
  max_message_length integer not null default 4000
    check (max_message_length between 100 and 10000),
  attachments_enabled boolean not null default true,
  allowed_attachment_mimes text[] not null default array['image/jpeg','image/png','image/webp','application/pdf']::text[],
  max_attachment_bytes integer not null default 5242880
    check (max_attachment_bytes between 1024 and 5242880),
  max_attachments_per_message smallint not null default 3
    check (max_attachments_per_message between 0 and 5),
  auto_assignment_enabled boolean not null default false,
  sound_notifications_enabled boolean not null default true,
  transfers_enabled boolean not null default true,
  reopen_enabled boolean not null default true,
  offline_behavior text not null default 'conversation'
    check (offline_behavior in ('conversation', 'ticket')),
  ticket_conversion_enabled boolean not null default true,
  updated_by uuid references public.admin_users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint chat_settings_allowed_mimes_check check (
    cardinality(allowed_attachment_mimes) between 1 and 4
    and allowed_attachment_mimes <@ array['image/jpeg','image/png','image/webp','application/pdf']::text[]
  )
);

create function public.chat_validate_settings() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_day integer;
  v_slot jsonb;
  v_start text;
  v_end text;
  v_previous_end text;
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.business_timezone) then
    raise exception 'Invalid chat business timezone.' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(new.weekly_hours) <> 'object'
    or (select count(*) from pg_catalog.jsonb_object_keys(new.weekly_hours)) <> 7 then
    raise exception 'Chat hours must contain seven days.' using errcode = '22023';
  end if;
  for v_day in 0..6 loop
    if pg_catalog.jsonb_typeof(new.weekly_hours -> v_day::text) <> 'array' then
      raise exception 'Chat hours day is invalid.' using errcode = '22023';
    end if;
    if pg_catalog.jsonb_array_length(new.weekly_hours -> v_day::text) > 3 then
      raise exception 'Chat hours have too many intervals.' using errcode = '22023';
    end if;
    v_previous_end := null;
    for v_slot in select value from pg_catalog.jsonb_array_elements(new.weekly_hours -> v_day::text) loop
      if pg_catalog.jsonb_typeof(v_slot) <> 'array'
        or pg_catalog.jsonb_array_length(v_slot) <> 2 then
        raise exception 'Chat hours interval is invalid.' using errcode = '22023';
      end if;
      v_start := v_slot ->> 0;
      v_end := v_slot ->> 1;
      if v_start !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or v_end !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or v_start >= v_end or (v_previous_end is not null and v_start < v_previous_end) then
        raise exception 'Chat hours interval is invalid.' using errcode = '22023';
      end if;
      v_previous_end := v_end;
    end loop;
  end loop;
  new.updated_at := now();
  return new;
end;
$$;
create trigger chat_settings_validate before insert or update on public.chat_settings
for each row execute function public.chat_validate_settings();
insert into public.chat_settings(singleton) values (true);

create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  reference_number bigint generated always as identity unique,
  customer_id uuid references auth.users(id) on delete set null,
  guest_auth_user_id uuid references auth.users(id) on delete set null,
  contact_name text not null,
  contact_email text,
  contact_mobile text,
  status text not null default 'waiting'
    check (status in ('waiting', 'active', 'closed')),
  intake_mode text not null default 'live'
    check (intake_mode in ('live', 'offline')),
  assigned_admin_id uuid references public.admin_users(id) on delete set null,
  order_id uuid references public.customer_orders(id) on delete set null,
  ticket_id uuid unique references public.support_tickets(id) on delete set null,
  creation_key uuid not null,
  revision bigint not null default 0 check (revision >= 0),
  last_customer_message_seq bigint not null default 0 check (last_customer_message_seq >= 0),
  last_staff_message_seq bigint not null default 0 check (last_staff_message_seq >= 0),
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint chat_conversations_identity_check check (customer_id is null or guest_auth_user_id is null),
  constraint chat_conversations_name_check check (char_length(btrim(contact_name)) between 1 and 160),
  constraint chat_conversations_contact_check check (contact_email is not null or contact_mobile is not null),
  constraint chat_conversations_email_check check (contact_email is null or (
    char_length(contact_email) between 3 and 320
    and contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  )),
  constraint chat_conversations_mobile_check check (contact_mobile is null or (
    char_length(contact_mobile) between 7 and 30
    and contact_mobile ~ '^\+?[0-9 ()-]+$'
  )),
  constraint chat_conversations_closed_check check ((status = 'closed') = (closed_at is not null)),
  constraint chat_conversations_active_check check (status <> 'active' or assigned_admin_id is not null)
);
create unique index chat_conversations_open_customer_uidx
  on public.chat_conversations(customer_id) where customer_id is not null and status <> 'closed';
create unique index chat_conversations_open_guest_uidx
  on public.chat_conversations(guest_auth_user_id) where guest_auth_user_id is not null and status <> 'closed';
create unique index chat_conversations_customer_creation_uidx
  on public.chat_conversations(customer_id, creation_key) where customer_id is not null;
create unique index chat_conversations_guest_creation_uidx
  on public.chat_conversations(guest_auth_user_id, creation_key) where guest_auth_user_id is not null;
create index chat_conversations_queue_idx on public.chat_conversations(status, intake_mode, last_activity_at desc, id);
create index chat_conversations_assignee_idx on public.chat_conversations(assigned_admin_id, status, last_activity_at desc)
  where assigned_admin_id is not null;
create index chat_conversations_customer_history_idx on public.chat_conversations(customer_id, created_at desc, id)
  where customer_id is not null;
create index chat_conversations_guest_history_idx on public.chat_conversations(guest_auth_user_id, created_at desc, id)
  where guest_auth_user_id is not null;
create index chat_conversations_order_idx on public.chat_conversations(order_id) where order_id is not null;

create function public.chat_guard_conversation() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.customer_id is null and new.guest_auth_user_id is null then
    raise exception 'Chat identity is required.' using errcode = '22023';
  end if;
  if new.customer_id is not null and not exists (
    select 1 from auth.users u where u.id = new.customer_id and u.is_anonymous = false
  ) then
    raise exception 'Customer identity is unavailable.' using errcode = '22023';
  end if;
  if new.guest_auth_user_id is not null and not exists (
    select 1 from auth.users u where u.id = new.guest_auth_user_id and u.is_anonymous = true
  ) then
    raise exception 'Guest identity is unavailable.' using errcode = '22023';
  end if;
  if new.order_id is not null then
    if tg_op = 'INSERT' then
      if not exists (select 1 from public.customer_orders o
        where o.id = new.order_id and o.user_id = new.customer_id) then
        raise exception 'Chat order does not belong to the customer.' using errcode = '22023';
      end if;
    elsif new.order_id is distinct from old.order_id
      or (new.customer_id is distinct from old.customer_id and new.customer_id is not null) then
      if not exists (select 1 from public.customer_orders o
        where o.id = new.order_id and o.user_id = new.customer_id) then
        raise exception 'Chat order does not belong to the customer.' using errcode = '22023';
      end if;
    end if;
  end if;
  if new.ticket_id is not null then
    if tg_op = 'INSERT' then
      if not exists (select 1 from public.support_tickets t where t.id = new.ticket_id
        and t.customer_id is not distinct from new.customer_id) then
        raise exception 'Chat ticket does not belong to the customer.' using errcode = '22023';
      end if;
    elsif new.ticket_id is distinct from old.ticket_id
      or (new.customer_id is distinct from old.customer_id and new.customer_id is not null
        and old.guest_auth_user_id is null) then
      if not exists (select 1 from public.support_tickets t where t.id = new.ticket_id
        and t.customer_id is not distinct from new.customer_id) then
        raise exception 'Chat ticket does not belong to the customer.' using errcode = '22023';
      end if;
    end if;
  end if;
  if new.assigned_admin_id is not null and not exists (
    select 1 from public.admin_users a where a.id = new.assigned_admin_id and a.is_active = true
      and (a.role = 'owner' or (
        coalesce((a.permissions ->> 'support.view')::boolean, false)
        and coalesce((a.permissions ->> 'support.reply')::boolean, false)))
  ) then
    raise exception 'Chat assignee cannot reply.' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' then
    if old.assigned_admin_id is not null and new.assigned_admin_id is null and new.status = 'active' then
      new.status := 'waiting';
    end if;
    new.revision := old.revision + 1;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
create trigger chat_conversations_guard before insert or update on public.chat_conversations
for each row execute function public.chat_guard_conversation();

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  sequence_number bigint generated always as identity unique,
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_kind text not null check (sender_kind in ('customer', 'guest', 'staff')),
  sender_name text not null check (char_length(btrim(sender_name)) between 1 and 160),
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  is_internal boolean not null default false,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (id, conversation_id),
  constraint chat_messages_internal_check check (not is_internal or sender_kind = 'staff')
);
create unique index chat_messages_idempotency_idx
  on public.chat_messages(conversation_id, sender_id, idempotency_key);
create index chat_messages_thread_idx
  on public.chat_messages(conversation_id, sequence_number desc);
create index chat_messages_customer_unread_idx
  on public.chat_messages(conversation_id, sequence_number)
  where sender_kind = 'staff' and is_internal = false;
create index chat_messages_staff_unread_idx
  on public.chat_messages(conversation_id, sequence_number)
  where sender_kind in ('customer', 'guest');

create function public.chat_validate_message_actor() returns trigger
language plpgsql set search_path = '' as $$
declare v_conversation public.chat_conversations%rowtype;
begin
  select * into v_conversation from public.chat_conversations where id = new.conversation_id;
  if not found or new.sender_id is null or v_conversation.status = 'closed' then
    raise exception 'Chat message cannot be saved.' using errcode = '22023';
  end if;
  if (new.sender_kind = 'customer' and (v_conversation.customer_id is distinct from new.sender_id or new.is_internal))
    or (new.sender_kind = 'guest' and (v_conversation.guest_auth_user_id is distinct from new.sender_id or new.is_internal))
    or (new.sender_kind = 'staff' and (
      v_conversation.assigned_admin_id is distinct from new.sender_id
      or v_conversation.status <> 'active')) then
    raise exception 'Chat message actor is invalid.' using errcode = '22023';
  end if;
  if new.sender_kind = 'customer' and not exists (
    select 1 from public.customer_profiles p where p.id = new.sender_id and p.is_active = true
  ) then
    raise exception 'Customer account is unavailable.' using errcode = '22023';
  end if;
  if new.sender_kind = 'guest' and not exists (
    select 1 from auth.users u where u.id = new.sender_id and u.is_anonymous = true
  ) then
    raise exception 'Guest identity is unavailable.' using errcode = '22023';
  end if;
  if new.sender_kind = 'staff' and not exists (
    select 1 from public.admin_users a where a.id = new.sender_id and a.is_active = true
      and (a.role = 'owner' or (
        coalesce((a.permissions ->> 'support.view')::boolean, false)
        and coalesce((a.permissions ->> 'support.reply')::boolean, false)))
  ) then
    raise exception 'Support reply access is required.' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger chat_messages_validate_actor before insert on public.chat_messages
for each row execute function public.chat_validate_message_actor();

create table public.chat_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_kind text not null check (actor_kind in ('customer', 'guest', 'staff', 'system')),
  event_type text not null check (event_type in (
    'created', 'identified', 'claimed', 'assigned', 'transferred',
    'agent_replied', 'status_changed', 'order_linked', 'order_unlinked',
    'ticket_created', 'closed', 'reopened'
  )),
  old_value jsonb,
  new_value jsonb,
  related_message_id uuid references public.chat_messages(id) on delete set null,
  created_at timestamptz not null default now()
);
create index chat_events_thread_idx
  on public.chat_events(conversation_id, created_at, id);

create table public.chat_read_state (
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  actor_kind text not null check (actor_kind in ('customer', 'guest', 'staff')),
  last_read_sequence bigint not null default 0 check (last_read_sequence >= 0),
  updated_at timestamptz not null default now(),
  primary key (conversation_id, actor_id)
);
create index chat_read_state_actor_idx on public.chat_read_state(actor_id, updated_at desc);

create table public.chat_attachments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  message_id uuid not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  original_name text not null check (char_length(btrim(original_name)) between 1 and 180),
  storage_path text not null unique check (char_length(storage_path) between 1 and 500),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  created_at timestamptz not null default now(),
  foreign key (message_id, conversation_id)
    references public.chat_messages(id, conversation_id) on delete cascade
);
create index chat_attachments_message_idx on public.chat_attachments(message_id, created_at);
create index chat_attachments_thread_idx on public.chat_attachments(conversation_id, created_at);

create table public.chat_agent_availability (
  admin_id uuid primary key references public.admin_users(id) on delete cascade,
  declared_state text not null default 'offline'
    check (declared_state in ('online', 'away', 'offline')),
  lease_expires_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint chat_agent_availability_online_check check (
    declared_state <> 'online' or lease_expires_at is not null
  )
);
create index chat_agent_availability_online_idx
  on public.chat_agent_availability(lease_expires_at)
  where declared_state = 'online';

create table public.chat_rate_limits (
  scope text not null check (scope in ('message', 'conversation', 'duplicate', 'attachment', 'typing')),
  subject_hash text not null check (subject_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  attempts integer not null default 1 check (attempts >= 0),
  expires_at timestamptz not null,
  primary key (scope, subject_hash, window_started_at),
  constraint chat_rate_limits_expiry_check check (expires_at > window_started_at)
);
create index chat_rate_limits_expiry_idx on public.chat_rate_limits(expires_at);

-- All chat tables are server-only. RLS remains enabled as a second boundary.
alter table public.chat_settings enable row level security;
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_events enable row level security;
alter table public.chat_read_state enable row level security;
alter table public.chat_attachments enable row level security;
alter table public.chat_agent_availability enable row level security;
alter table public.chat_rate_limits enable row level security;
revoke all on public.chat_settings, public.chat_conversations, public.chat_messages,
  public.chat_events, public.chat_read_state, public.chat_attachments,
  public.chat_agent_availability, public.chat_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.chat_settings, public.chat_conversations,
  public.chat_messages, public.chat_events, public.chat_read_state,
  public.chat_attachments, public.chat_agent_availability, public.chat_rate_limits to service_role;
grant usage, select on sequence public.chat_conversations_reference_number_seq,
  public.chat_messages_sequence_number_seq to service_role;

-- Realtime receives only scoped, private Broadcast signals. No browser-role
-- INSERT policy is provided; later typing signals must pass a rate-limited API.
create function public.chat_can_receive_topic(p_topic text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_is_anonymous boolean := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
  v_staff boolean;
  v_id_text text;
  v_id uuid;
begin
  if v_actor is null or p_topic is null then return false; end if;
  select exists (
    select 1 from public.admin_users a where a.id = v_actor and a.is_active = true
      and (a.role = 'owner' or coalesce((a.permissions ->> 'support.view')::boolean, false))
  ) into v_staff;
  if p_topic = 'chat:inbox' then return v_staff; end if;
  if p_topic not like 'chat:public:%' and p_topic not like 'chat:staff:%' then return false; end if;
  v_id_text := pg_catalog.split_part(p_topic, ':', 3);
  if v_id_text !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    or p_topic not in ('chat:public:' || v_id_text, 'chat:staff:' || v_id_text) then
    return false;
  end if;
  v_id := v_id_text::uuid;
  if p_topic = 'chat:staff:' || v_id_text then
    return v_staff and exists (select 1 from public.chat_conversations where id = v_id);
  end if;
  if v_staff then
    return exists (select 1 from public.chat_conversations where id = v_id);
  end if;
  if v_is_anonymous then
    return exists (
      select 1 from public.chat_conversations c
      where c.id = v_id and c.guest_auth_user_id = v_actor and c.customer_id is null
    );
  end if;
  return exists (
    select 1 from public.chat_conversations c
    join public.customer_profiles p on p.id = c.customer_id and p.is_active = true
    where c.id = v_id and c.customer_id = v_actor
  );
end;
$$;
revoke all on function public.chat_can_receive_topic(text) from public, anon;
grant execute on function public.chat_can_receive_topic(text) to authenticated;
create policy chat_receive_broadcast on realtime.messages for select to authenticated
using (extension = 'broadcast' and topic = realtime.topic()
  and public.chat_can_receive_topic(realtime.topic()));

-- Supabase anonymous Auth users receive the authenticated role. Their Auth
-- records must not be mistaken for permanent customer profiles.
create or replace function public.handle_new_customer_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.is_anonymous = true then return new; end if;
  insert into public.customer_profiles (id, email, full_name, avatar_url)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name', pg_catalog.split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  ) on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.guard_customer_profile_protected_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Anonymous chat guests cannot create customer profiles.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if new.wallet_balance is distinct from 0::numeric or new.is_active is distinct from true then
      raise exception 'Customer account fields cannot be changed.' using errcode = '42501';
    end if;
  elsif new.wallet_balance is distinct from old.wallet_balance
    or new.is_active is distinct from old.is_active then
    raise exception 'Customer account fields cannot be changed.' using errcode = '42501';
  end if;
  return new;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-attachments', 'chat-attachments', false, 5242880,
  array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
-- Deliberately no storage.objects policy for this bucket.

alter function public.system_reset_tables(text) rename to system_reset_tables_before_chat;
create function public.system_reset_tables(p_scope text)
returns text[] language sql immutable set search_path = '' as $$
  select case p_scope when 'full' then array[
    'chat_attachments', 'chat_read_state', 'chat_events', 'chat_messages',
    'chat_agent_availability', 'chat_rate_limits', 'chat_conversations', 'chat_settings'
  ]::text[] || public.system_reset_tables_before_chat(p_scope)
  else public.system_reset_tables_before_chat(p_scope) end;
$$;
revoke all on function public.system_reset_tables(text) from public, anon, authenticated;
revoke all on function public.system_reset_tables_before_chat(text) from public, anon, authenticated;

create function public.chat_reset_manifest() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.scope = 'full' then
    new.manifest := pg_catalog.jsonb_set(new.manifest, '{chat}',
      coalesce((select pg_catalog.jsonb_agg(name)
        from storage.objects where bucket_id = 'chat-attachments'), '[]'::jsonb));
  end if;
  return new;
end;
$$;
create trigger chat_reset_manifest before insert on public.system_reset_runs
for each row execute function public.chat_reset_manifest();

commit;
