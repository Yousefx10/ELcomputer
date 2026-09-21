begin;

-- Guest chats may use a verified anonymous Auth identity with either an email
-- or a mobile number. Keep the existing account-ticket shape while allowing
-- the ticket to retain the contact channel that was actually supplied.
alter table public.support_tickets
  alter column customer_email drop not null,
  add column customer_mobile text;

alter table public.support_tickets
  drop constraint support_tickets_email_check,
  add constraint support_tickets_email_check check (
    customer_email is null or char_length(pg_catalog.btrim(customer_email)) between 3 and 320
  ),
  add constraint support_tickets_mobile_check check (
    customer_mobile is null or customer_mobile ~ '^\+?[0-9 ()-]{7,30}$'
  ),
  add constraint support_tickets_contact_check check (
    customer_email is not null or customer_mobile is not null
  );

-- Preserve a readable actor snapshot for future ticket audit rows. The
-- original actor_id remains available while its Auth row exists.
alter table public.support_ticket_events add column actor_name text;

alter table public.support_ticket_events
  drop constraint support_ticket_events_type_check,
  add constraint support_ticket_events_type_check check (
    event_type in ('created', 'status', 'priority', 'assignment', 'source_chat')
  );

create function public.support_ticket_snapshot_actor() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.actor_name is not null then return new; end if;
  if new.actor_type = 'staff' then
    select coalesce(nullif(pg_catalog.btrim(a.full_name), ''), a.email, a.id::text)
      into new.actor_name from public.admin_users a where a.id = new.actor_id;
  elsif new.actor_type = 'customer' then
    select coalesce(nullif(pg_catalog.btrim(p.full_name), ''), p.email, p.id::text)
      into new.actor_name from public.customer_profiles p where p.id = new.actor_id;
  else
    new.actor_name := 'System';
  end if;
  new.actor_name := coalesce(new.actor_name, new.actor_id::text, 'System');
  return new;
end;
$$;

create trigger support_ticket_events_snapshot before insert on public.support_ticket_events
for each row execute function public.support_ticket_snapshot_actor();

update public.support_ticket_events e set actor_name = case
  when e.actor_type = 'staff' then coalesce(
    (select coalesce(nullif(pg_catalog.btrim(a.full_name), ''), a.email, a.id::text)
      from public.admin_users a where a.id = e.actor_id), e.actor_id::text, 'System')
  when e.actor_type = 'customer' then coalesce(
    (select coalesce(nullif(pg_catalog.btrim(p.full_name), ''), p.email, p.id::text)
      from public.customer_profiles p where p.id = e.actor_id), e.actor_id::text, 'System')
  else 'System' end
where e.actor_name is null;

-- Once a ticket has copied the chat's order relation, normal chat writes may
-- not silently change that relation and leave the two records inconsistent.
create function public.chat_preserve_ticket_order() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.ticket_id is not null and new.order_id is distinct from old.order_id then
    raise exception 'CHAT_TICKET_ORDER_LOCKED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger chat_preserve_ticket_order before update of order_id on public.chat_conversations
for each row execute function public.chat_preserve_ticket_order();

-- One row lock covers the authorization decision, stale-tab check, ticket
-- insert, relationship update and both audit trails. The transcript and files
-- stay canonical in Live Chat and are reached through chat.ticket_id.
create function public.chat_create_ticket(p_conversation_id uuid, p_staff_id uuid,
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
  -- A retry after the committed transaction returns the one linked ticket.
  if v_chat.ticket_id is not null then return v_chat.ticket_id; end if;
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

  update public.chat_conversations set ticket_id = v_ticket_id
    where id = v_chat.id;
  insert into public.chat_events(conversation_id, actor_id, actor_kind,
    event_type, old_value, new_value)
  values(v_chat.id, p_staff_id, 'staff', 'ticket_created', null,
    pg_catalog.jsonb_build_object('ticket_id', v_ticket_id,
      'ticket_reference', v_ticket_reference));
  return v_ticket_id;
end;
$$;

revoke all on function public.support_ticket_snapshot_actor(),
  public.chat_preserve_ticket_order(),
  public.chat_create_ticket(uuid,uuid,text,bigint)
  from public, anon, authenticated;
grant execute on function public.chat_create_ticket(uuid,uuid,text,bigint) to service_role;

commit;
