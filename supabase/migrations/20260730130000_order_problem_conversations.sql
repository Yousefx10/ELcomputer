begin;

-- Preserve the existing completion-message contract while making problem
-- conversations explicit and safely replyable.
alter table public.customer_order_messages
  add column if not exists sender_type text;

alter table public.customer_order_messages
  add column if not exists message_kind text;

alter table public.customer_order_messages
  add column if not exists sender_customer_user_id uuid;

alter table public.customer_order_messages
  add column if not exists reply_to_message_id uuid;

alter table public.customer_order_messages
  add column if not exists replied_at timestamptz;

alter table public.customer_order_messages
  add column if not exists admin_read_at timestamptz;

-- Conversation history is audit data. Match the immutable-message trigger by
-- retaining its order/session references instead of nulling them on deletion.
alter table public.customer_order_messages
  drop constraint if exists customer_order_messages_order_id_fkey;

alter table public.customer_order_messages
  add constraint customer_order_messages_order_id_fkey
  foreign key (order_id)
  references public.customer_orders (id)
  on delete restrict;

alter table public.customer_order_messages
  drop constraint if exists customer_order_messages_packing_session_id_fkey;

alter table public.customer_order_messages
  add constraint customer_order_messages_packing_session_id_fkey
  foreign key (packing_session_id)
  references public.order_packing_sessions (id)
  on delete restrict;

update public.customer_order_messages
set
  sender_type = coalesce(sender_type, 'admin'),
  message_kind = coalesce(message_kind, 'order_update')
where sender_type is null
  or message_kind is null;

alter table public.customer_order_messages
  alter column sender_type set default 'admin',
  alter column sender_type set not null,
  alter column message_kind set default 'order_update',
  alter column message_kind set not null;

alter table public.customer_order_messages
  drop constraint if exists customer_order_messages_sender_type_check;

alter table public.customer_order_messages
  add constraint customer_order_messages_sender_type_check check (
    sender_type in ('admin', 'customer')
  );

alter table public.customer_order_messages
  drop constraint if exists customer_order_messages_kind_check;

alter table public.customer_order_messages
  add constraint customer_order_messages_kind_check check (
    message_kind in ('order_update', 'packing_problem', 'customer_reply')
  );

alter table public.customer_order_messages
  drop constraint if exists customer_order_messages_sender_customer_fkey;

alter table public.customer_order_messages
  add constraint customer_order_messages_sender_customer_fkey
  foreign key (sender_customer_user_id)
  references auth.users (id)
  on delete set null;

alter table public.customer_order_messages
  drop constraint if exists customer_order_messages_reply_to_fkey;

alter table public.customer_order_messages
  add constraint customer_order_messages_reply_to_fkey
  foreign key (reply_to_message_id)
  references public.customer_order_messages (id)
  on delete restrict;

alter table public.customer_order_messages
  drop constraint if exists customer_order_messages_sender_shape_check;

alter table public.customer_order_messages
  add constraint customer_order_messages_sender_shape_check check (
    (
      sender_type = 'admin'
      and message_kind in ('order_update', 'packing_problem')
      and sender_customer_user_id is null
      and reply_to_message_id is null
    )
    or (
      sender_type = 'customer'
      and message_kind = 'customer_reply'
      and sender_admin_user_id is null
      and reply_to_message_id is not null
      and (
        sender_customer_user_id is null
        or sender_customer_user_id = user_id
      )
    )
  );

alter table public.customer_order_messages
  drop constraint if exists customer_order_messages_problem_session_check;

alter table public.customer_order_messages
  add constraint customer_order_messages_problem_session_check check (
    message_kind <> 'packing_problem'
    or packing_session_id is not null
  );

create index if not exists customer_order_messages_order_created_idx
  on public.customer_order_messages (order_id, created_at, id)
  where order_id is not null;

create index if not exists customer_order_messages_reply_to_idx
  on public.customer_order_messages (reply_to_message_id, created_at, id)
  where reply_to_message_id is not null;

create unique index if not exists customer_order_messages_customer_reply_uidx
  on public.customer_order_messages (reply_to_message_id)
  where sender_type = 'customer'
    and reply_to_message_id is not null;

-- The pointer is the concurrency guard for a hold. A reply to an older
-- conversation can never release a newer hold.
alter table public.customer_orders
  add column if not exists awaiting_customer_message_id uuid;

alter table public.customer_orders
  drop constraint if exists customer_orders_awaiting_customer_message_fkey;

alter table public.customer_orders
  add constraint customer_orders_awaiting_customer_message_fkey
  foreign key (awaiting_customer_message_id)
  references public.customer_order_messages (id)
  on delete set null;

create index if not exists customer_orders_awaiting_customer_message_idx
  on public.customer_orders (awaiting_customer_message_id)
  where awaiting_customer_message_id is not null;

create or replace function public.validate_customer_order_message()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_order_user_id uuid;
  v_session_order_id uuid;
  v_parent public.customer_order_messages%rowtype;
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
      or new.user_id is distinct from old.user_id
      or new.order_id is distinct from old.order_id
      or new.packing_session_id is distinct from old.packing_session_id
      or new.sender_type is distinct from old.sender_type
      or new.message_kind is distinct from old.message_kind
      or new.reply_to_message_id is distinct from old.reply_to_message_id
      or new.sender_name is distinct from old.sender_name
      or new.subject is distinct from old.subject
      or new.body is distinct from old.body
      or new.created_at is distinct from old.created_at
      or (
        new.sender_admin_user_id is distinct from old.sender_admin_user_id
        and not (
          old.sender_admin_user_id is not null
          and new.sender_admin_user_id is null
        )
      )
      or (
        new.sender_customer_user_id is distinct from old.sender_customer_user_id
        and not (
          old.sender_customer_user_id is not null
          and new.sender_customer_user_id is null
        )
      )
    then
      raise exception 'Order message sender, conversation, and content are immutable.';
    end if;
  end if;

  if new.order_id is not null then
    select orders.user_id
    into v_order_user_id
    from public.customer_orders as orders
    where orders.id = new.order_id;

    if not found or v_order_user_id is distinct from new.user_id then
      raise exception 'The message recipient does not own the selected order.';
    end if;
  end if;

  if new.packing_session_id is not null then
    select sessions.order_id
    into v_session_order_id
    from public.order_packing_sessions as sessions
    where sessions.id = new.packing_session_id;

    if not found
      or new.order_id is null
      or v_session_order_id is distinct from new.order_id
    then
      raise exception 'The message packing session does not match its order.';
    end if;
  end if;

  if new.reply_to_message_id is not null then
    select messages.*
    into v_parent
    from public.customer_order_messages as messages
    where messages.id = new.reply_to_message_id;

    if not found
      or v_parent.user_id is distinct from new.user_id
      or v_parent.order_id is distinct from new.order_id
      or v_parent.sender_type <> 'admin'
      or v_parent.message_kind <> 'packing_problem'
      or v_parent.reply_to_message_id is not null
    then
      raise exception 'Customer replies must target the matching order problem message.';
    end if;
  end if;

  if new.sender_type = 'admin' then
    if tg_op = 'INSERT' and new.sender_admin_user_id is null then
      raise exception 'An admin sender is required for this order message.';
    end if;

    if new.sender_customer_user_id is not null
      or new.message_kind not in ('order_update', 'packing_problem')
      or new.reply_to_message_id is not null
    then
      raise exception 'The admin order message sender is not valid.';
    end if;
  elsif new.sender_type = 'customer' then
    if new.sender_admin_user_id is not null
      or new.sender_customer_user_id is distinct from new.user_id
      or new.message_kind <> 'customer_reply'
      or new.reply_to_message_id is null
      or new.packing_session_id is not null
    then
      raise exception 'The customer order reply sender is not valid.';
    end if;

    new.read_at := coalesce(new.read_at, clock_timestamp());
  else
    raise exception 'The order message sender type is not valid.';
  end if;

  if new.message_kind = 'packing_problem'
    and new.packing_session_id is null
  then
    raise exception 'A packing problem must identify its packing session.';
  end if;

  new.sender_name := btrim(new.sender_name);
  new.subject := btrim(new.subject);
  new.body := btrim(new.body);
  return new;
end;
$$;

create or replace function public.maintain_order_problem_hold()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_message public.customer_order_messages%rowtype;
  v_session_status text;
begin
  if new.status <> 'on_hold' then
    new.awaiting_customer_message_id := null;
    return new;
  end if;

  -- A normal/manual transition into on-hold must not inherit an old request.
  -- The problem RPC supplies a newly inserted, distinct pointer in the same
  -- transaction and therefore passes through to the validation below.
  if tg_op = 'UPDATE'
    and old.status is distinct from 'on_hold'
    and new.awaiting_customer_message_id is not distinct from
      old.awaiting_customer_message_id
  then
    new.awaiting_customer_message_id := null;
    return new;
  end if;

  if new.awaiting_customer_message_id is null then
    return new;
  end if;

  select messages.*
  into v_message
  from public.customer_order_messages as messages
  where messages.id = new.awaiting_customer_message_id;

  if not found
    or v_message.order_id is distinct from new.id
    or v_message.user_id is distinct from new.user_id
    or v_message.sender_type <> 'admin'
    or v_message.message_kind <> 'packing_problem'
    or v_message.reply_to_message_id is not null
    or v_message.replied_at is not null
  then
    raise exception 'The current customer-response request is not valid for this order.';
  end if;

  select sessions.status
  into v_session_status
  from public.order_packing_sessions as sessions
  where sessions.id = v_message.packing_session_id
    and sessions.order_id = new.id;

  if not found or v_session_status <> 'cancelled' then
    raise exception 'The order problem must close its packing session before waiting for a reply.';
  end if;

  return new;
end;
$$;

drop trigger if exists customer_orders_maintain_problem_hold
  on public.customer_orders;

create trigger customer_orders_maintain_problem_hold
before insert or update of status, awaiting_customer_message_id
on public.customer_orders
for each row
execute function public.maintain_order_problem_hold();

create or replace function public.report_order_packing_problem(
  p_session_id uuid,
  p_admin_user_id uuid,
  p_subject text,
  p_body text,
  p_sender_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.order_packing_sessions%rowtype;
  v_order public.customer_orders%rowtype;
  v_admin public.admin_users%rowtype;
  v_message public.customer_order_messages%rowtype;
  v_now timestamptz := clock_timestamp();
  v_subject text := nullif(btrim(p_subject), '');
  v_body text := nullif(btrim(p_body), '');
  v_sender_name text;
begin
  if coalesce(auth.role()::text, '') <> 'service_role' then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  if p_session_id is null or p_admin_user_id is null then
    raise exception 'A packing session and processor are required.';
  end if;

  if v_body is null then
    raise exception 'Describe the order problem for the purchaser.';
  end if;

  if length(v_body) > 2000 then
    raise exception 'The order problem message cannot exceed 2000 characters.';
  end if;

  if v_subject is not null and length(v_subject) > 200 then
    raise exception 'The order problem subject cannot exceed 200 characters.';
  end if;

  select sessions.*
  into v_session
  from public.order_packing_sessions as sessions
  where sessions.id = p_session_id
  for update;

  if not found then
    raise exception 'Packing session not found.';
  end if;

  if v_session.admin_user_id is distinct from p_admin_user_id then
    raise exception 'Only the admin who claimed this order can report its problem.';
  end if;

  select admins.*
  into v_admin
  from public.admin_users as admins
  where admins.id = p_admin_user_id;

  if not found
    or not coalesce(v_admin.is_active, false)
    or (
      v_admin.role <> 'owner'
      and not coalesce(
        (v_admin.permissions ->> 'dashboard.orders')::boolean,
        false
      )
    )
  then
    raise exception 'This admin can no longer process orders.';
  end if;

  v_sender_name := left(
    coalesce(
      nullif(btrim(v_admin.full_name), ''),
      nullif(btrim(v_admin.email), ''),
      nullif(btrim(p_sender_name), ''),
      'Store team'
    ),
    160
  );

  select orders.*
  into v_order
  from public.customer_orders as orders
  where orders.id = v_session.order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  select messages.*
  into v_message
  from public.customer_order_messages as messages
  where messages.packing_session_id = v_session.id
    and messages.message_kind = 'packing_problem'
  limit 1;

  if found then
    return jsonb_build_object(
      'message_id', v_message.id,
      'order_id', v_order.id,
      'order_status', v_order.status,
      'session_id', v_session.id,
      'session_status', v_session.status,
      'awaiting_customer_message_id',
        v_order.awaiting_customer_message_id,
      'already_reported', true
    );
  end if;

  if v_session.status <> 'active' then
    raise exception 'This packing session is no longer active.';
  end if;

  if v_order.status not in ('pending_payment', 'processing') then
    raise exception 'The order status changed before its problem could be reported.';
  end if;

  if v_order.packing_completed_at is not null then
    raise exception 'A completed packing order cannot be placed on a problem hold.';
  end if;

  if v_order.user_id is null then
    raise exception 'This guest order does not have a customer account inbox.';
  end if;

  v_subject := coalesce(
    v_subject,
    'Problem with order '
      || coalesce(v_order.order_number, '#' || left(v_order.id::text, 8))
  );

  update public.order_packing_sessions
  set
    status = 'cancelled',
    completed_at = null,
    completed_order_status = null,
    updated_at = v_now
  where id = v_session.id;

  insert into public.customer_order_messages (
    user_id,
    order_id,
    packing_session_id,
    sender_admin_user_id,
    sender_customer_user_id,
    sender_type,
    message_kind,
    reply_to_message_id,
    sender_name,
    subject,
    body,
    read_at,
    created_at
  )
  values (
    v_order.user_id,
    v_order.id,
    v_session.id,
    p_admin_user_id,
    null,
    'admin',
    'packing_problem',
    null,
    v_sender_name,
    v_subject,
    v_body,
    null,
    v_now
  )
  returning * into v_message;

  update public.customer_orders
  set
    status = 'on_hold',
    awaiting_customer_message_id = v_message.id,
    updated_at = v_now
  where id = v_order.id;

  return jsonb_build_object(
    'message_id', v_message.id,
    'order_id', v_order.id,
    'order_status', 'on_hold',
    'session_id', v_session.id,
    'session_status', 'cancelled',
    'awaiting_customer_message_id', v_message.id,
    'already_reported', false
  );
end;
$$;

create or replace function public.reply_to_order_message(
  p_message_id uuid,
  p_user_id uuid,
  p_body text,
  p_sender_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.customer_order_messages%rowtype;
  v_reply public.customer_order_messages%rowtype;
  v_order public.customer_orders%rowtype;
  v_customer public.customer_profiles%rowtype;
  v_session_status text;
  v_now timestamptz := clock_timestamp();
  v_body text := nullif(btrim(p_body), '');
  v_sender_name text;
  v_subject text;
begin
  if coalesce(auth.role()::text, '') <> 'service_role' then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  if p_message_id is null or p_user_id is null then
    raise exception 'A message and customer are required.';
  end if;

  if v_body is null then
    raise exception 'Write a reply to the order problem.';
  end if;

  if length(v_body) > 2000 then
    raise exception 'The customer reply cannot exceed 2000 characters.';
  end if;

  select messages.*
  into v_parent
  from public.customer_order_messages as messages
  where messages.id = p_message_id
  for update;

  if not found then
    raise exception 'Order message not found.';
  end if;

  if v_parent.user_id is distinct from p_user_id then
    raise exception 'This order message does not belong to the customer.';
  end if;

  if v_parent.sender_type <> 'admin'
    or v_parent.message_kind <> 'packing_problem'
    or v_parent.reply_to_message_id is not null
    or v_parent.order_id is null
  then
    raise exception 'Only an order problem message can receive this reply.';
  end if;

  select orders.*
  into v_order
  from public.customer_orders as orders
  where orders.id = v_parent.order_id
    and orders.user_id = p_user_id
  for update;

  if not found then
    raise exception 'The customer does not own the order linked to this message.';
  end if;

  select messages.*
  into v_reply
  from public.customer_order_messages as messages
  where messages.reply_to_message_id = v_parent.id
    and messages.sender_type = 'customer'
  limit 1;

  if found then
    select sessions.status
    into v_session_status
    from public.order_packing_sessions as sessions
    where sessions.id = v_parent.packing_session_id;

    return jsonb_build_object(
      'message_id', v_reply.id,
      'reply_to_message_id', v_parent.id,
      'order_id', v_order.id,
      'order_status', v_order.status,
      'session_id', v_parent.packing_session_id,
      'session_status', v_session_status,
      'order_resumed', v_order.status = 'processing',
      'already_replied', true
    );
  end if;

  if v_order.status <> 'on_hold'
    or v_order.awaiting_customer_message_id is distinct from v_parent.id
  then
    raise exception 'This is not the current order problem awaiting a customer reply.';
  end if;

  select sessions.status
  into v_session_status
  from public.order_packing_sessions as sessions
  where sessions.id = v_parent.packing_session_id
    and sessions.order_id = v_order.id;

  if not found or v_session_status <> 'cancelled' then
    raise exception 'The packing session for this order problem is not closed.';
  end if;

  select profiles.*
  into v_customer
  from public.customer_profiles as profiles
  where profiles.id = p_user_id;

  v_sender_name := left(
    coalesce(
      nullif(btrim(v_customer.full_name), ''),
      nullif(btrim(v_customer.email), ''),
      nullif(btrim(p_sender_name), ''),
      'Customer'
    ),
    160
  );
  v_subject := left('Re: ' || v_parent.subject, 200);

  insert into public.customer_order_messages (
    user_id,
    order_id,
    packing_session_id,
    sender_admin_user_id,
    sender_customer_user_id,
    sender_type,
    message_kind,
    reply_to_message_id,
    sender_name,
    subject,
    body,
    read_at,
    created_at
  )
  values (
    p_user_id,
    v_order.id,
    null,
    null,
    p_user_id,
    'customer',
    'customer_reply',
    v_parent.id,
    v_sender_name,
    v_subject,
    v_body,
    v_now,
    v_now
  )
  returning * into v_reply;

  update public.customer_order_messages
  set
    read_at = coalesce(read_at, v_now),
    replied_at = v_now
  where id = v_parent.id;

  update public.customer_orders
  set
    status = 'processing',
    awaiting_customer_message_id = null,
    updated_at = v_now
  where id = v_order.id
    and status = 'on_hold'
    and awaiting_customer_message_id = v_parent.id;

  if not found then
    raise exception 'The current order problem changed before the reply was saved.';
  end if;

  return jsonb_build_object(
    'message_id', v_reply.id,
    'reply_to_message_id', v_parent.id,
    'order_id', v_order.id,
    'order_status', 'processing',
    'session_id', v_parent.packing_session_id,
    'session_status', v_session_status,
    'order_resumed', true,
    'already_replied', false
  );
end;
$$;

revoke all on function public.report_order_packing_problem(
  uuid,
  uuid,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.report_order_packing_problem(
  uuid,
  uuid,
  text,
  text,
  text
) to service_role;

revoke all on function public.reply_to_order_message(
  uuid,
  uuid,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.reply_to_order_message(
  uuid,
  uuid,
  text,
  text
) to service_role;

commit;
