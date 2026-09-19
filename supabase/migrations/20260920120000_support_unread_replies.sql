begin;

alter table public.support_ticket_messages
  add column customer_read_at timestamptz;

create index support_ticket_messages_customer_unread_idx
  on public.support_ticket_messages (ticket_id, created_at)
  where sender_type = 'staff' and is_internal = false and customer_read_at is null;

-- Count tickets, rather than messages, so the account navigation stays compact.
-- Only the server may call this after authenticating the customer.
create function public.support_customer_unread_ticket_count(p_customer_id uuid)
returns bigint language sql stable security definer set search_path = '' as $$
  select count(distinct t.id)
  from public.support_tickets t
  join public.support_ticket_messages m on m.ticket_id = t.id
  where t.customer_id = p_customer_id
    and m.sender_type = 'staff'
    and m.is_internal = false
    and m.customer_read_at is null;
$$;

create function public.support_customer_unread_counts(
  p_customer_id uuid, p_ticket_ids uuid[]
) returns table(ticket_id uuid, unread_count bigint)
language sql stable security definer set search_path = '' as $$
  select t.id, count(m.id)
  from public.support_tickets t
  join public.support_ticket_messages m on m.ticket_id = t.id
  where t.customer_id = p_customer_id
    and t.id = any(p_ticket_ids)
    and m.sender_type = 'staff'
    and m.is_internal = false
    and m.customer_read_at is null
  group by t.id;
$$;

revoke all on function public.support_customer_unread_ticket_count(uuid)
  from public, anon, authenticated;
revoke all on function public.support_customer_unread_counts(uuid, uuid[])
  from public, anon, authenticated;
grant execute on function public.support_customer_unread_ticket_count(uuid)
  to service_role;
grant execute on function public.support_customer_unread_counts(uuid, uuid[])
  to service_role;

commit;
