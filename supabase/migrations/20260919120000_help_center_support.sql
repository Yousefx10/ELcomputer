begin;

create or replace function public.default_admin_permissions ()
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'dashboard.view', false, 'dashboard.analysis', false, 'dashboard.orders', false,
    'products.view', false, 'products.add', false, 'products.edit', false,
    'categories.view', false, 'categories.add', false, 'categories.edit', false,
    'brands.view', false, 'brands.add', false, 'brands.edit', false,
    'reviews.view', false, 'reviews.delete', false,
    'settings.view', false, 'settings.edit', false, 'settings.coupons', false,
    'users.view', false, 'hr.view', false, 'hr.edit', false,
    'treasury.view', false, 'treasury.edit', false,
    'documents.view', false, 'documents.manage', false,
    'pages.view', false, 'pages.edit', false,
    'help.view', false, 'help.edit', false,
    'support.view', false, 'support.reply', false, 'support.manage', false
  );
$$;

create table public.help_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  sort_position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint help_categories_name_check check (char_length(btrim(name)) between 1 and 80),
  constraint help_categories_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  constraint help_categories_description_check check (char_length(description) <= 300)
);

create index help_categories_order_idx on public.help_categories (is_active, sort_position, name);

create table public.help_articles (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.help_categories (id) on delete restrict,
  title text not null,
  slug text not null,
  summary text not null default '',
  content_markdown text not null default '',
  status text not null default 'draft',
  is_featured boolean not null default false,
  sort_position integer not null default 0,
  created_by uuid references public.admin_users (id) on delete set null,
  updated_by uuid references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(content_markdown, '')), 'C')
  ) stored,
  unique (category_id, slug),
  constraint help_articles_title_check check (char_length(btrim(title)) between 1 and 160),
  constraint help_articles_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 160),
  constraint help_articles_summary_check check (char_length(summary) <= 500),
  constraint help_articles_content_check check (char_length(content_markdown) <= 100000),
  constraint help_articles_status_check check (status in ('draft', 'published', 'archived'))
);

create index help_articles_public_idx on public.help_articles (status, is_featured desc, sort_position, published_at desc);
create index help_articles_category_idx on public.help_articles (category_id, status, sort_position);
create index help_articles_search_idx on public.help_articles using gin (search_vector);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  reference_number bigint generated always as identity unique,
  customer_id uuid references auth.users (id) on delete set null,
  customer_email text not null,
  customer_name text not null default '',
  order_id uuid references public.customer_orders (id) on delete set null,
  category_id uuid references public.help_categories (id) on delete set null,
  subject text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  assigned_admin_id uuid references public.admin_users (id) on delete set null,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_reply_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint support_tickets_subject_check check (char_length(btrim(subject)) between 1 and 160),
  constraint support_tickets_email_check check (char_length(btrim(customer_email)) between 3 and 320),
  constraint support_tickets_status_check check (status in ('open', 'in_progress', 'waiting_for_customer', 'waiting_for_support', 'resolved', 'closed')),
  constraint support_tickets_priority_check check (priority in ('low', 'normal', 'high', 'urgent')),
  constraint support_tickets_closed_at_check check ((status = 'closed') = (closed_at is not null))
);

create unique index support_tickets_idempotency_idx on public.support_tickets (customer_id, idempotency_key) where customer_id is not null;
create index support_tickets_customer_idx on public.support_tickets (customer_id, updated_at desc);
create index support_tickets_status_idx on public.support_tickets (status, updated_at desc);
create index support_tickets_assignee_idx on public.support_tickets (assigned_admin_id, status, updated_at desc);
create index support_tickets_order_idx on public.support_tickets (order_id) where order_id is not null;
create index support_tickets_category_idx on public.support_tickets (category_id, updated_at desc);

create table public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  sender_id uuid references auth.users (id) on delete set null,
  sender_type text not null,
  sender_name text not null,
  body text not null,
  is_internal boolean not null default false,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (ticket_id, sender_id, idempotency_key),
  unique (id, ticket_id),
  constraint support_ticket_messages_type_check check (sender_type in ('customer', 'staff')),
  constraint support_ticket_messages_note_check check (not is_internal or sender_type = 'staff'),
  constraint support_ticket_messages_body_check check (char_length(btrim(body)) between 1 and 10000),
  constraint support_ticket_messages_name_check check (char_length(btrim(sender_name)) between 1 and 160)
);

create index support_ticket_messages_thread_idx on public.support_ticket_messages (ticket_id, created_at, id);

create table public.support_ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  message_id uuid not null,
  uploaded_by uuid references auth.users (id) on delete set null,
  original_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes integer not null,
  created_at timestamptz not null default now(),
  foreign key (message_id, ticket_id) references public.support_ticket_messages (id, ticket_id) on delete cascade,
  constraint support_ticket_attachments_name_check check (char_length(btrim(original_name)) between 1 and 180),
  constraint support_ticket_attachments_size_check check (size_bytes between 1 and 5242880),
  constraint support_ticket_attachments_mime_check check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'))
);

create index support_ticket_attachments_message_idx on public.support_ticket_attachments (message_id, created_at);
create index support_ticket_attachments_ticket_idx on public.support_ticket_attachments (ticket_id, created_at);

create table public.support_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  actor_type text not null,
  event_type text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now(),
  constraint support_ticket_events_actor_check check (actor_type in ('customer', 'staff', 'system')),
  constraint support_ticket_events_type_check check (event_type in ('created', 'status', 'priority', 'assignment'))
);

create index support_ticket_events_thread_idx on public.support_ticket_events (ticket_id, created_at, id);

create function public.support_touch_updated_at () returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger help_categories_touch before update on public.help_categories
for each row execute function public.support_touch_updated_at();
create trigger help_articles_touch before update on public.help_articles
for each row execute function public.support_touch_updated_at();

create function public.support_ticket_before_update () returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.customer_id is distinct from old.customer_id and not (old.customer_id is not null and new.customer_id is null))
    or new.customer_email is distinct from old.customer_email
    or new.customer_name is distinct from old.customer_name
    or (new.order_id is distinct from old.order_id and not (old.order_id is not null and new.order_id is null))
    or new.idempotency_key is distinct from old.idempotency_key then
    raise exception 'Ticket ownership and order cannot be changed.' using errcode = '22023';
  end if;

  if new.assigned_admin_id is not null and new.assigned_admin_id is distinct from old.assigned_admin_id
    and not exists (
      select 1 from public.admin_users a
      where a.id = new.assigned_admin_id and a.is_active = true
        and (a.role = 'owner' or coalesce((a.permissions ->> 'support.reply')::boolean, false))
    ) then
    raise exception 'Assignee cannot access support tickets.' using errcode = '22023';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger support_ticket_before_update before update on public.support_tickets
for each row execute function public.support_ticket_before_update();

create function public.support_ticket_audit_update () returns trigger
language plpgsql set search_path = '' as $$
declare
  v_actor uuid := nullif(current_setting('app.support_actor_id', true), '')::uuid;
  v_actor_type text := coalesce(nullif(current_setting('app.support_actor_type', true), ''), 'system');
begin
  if old.status is distinct from new.status then
    insert into public.support_ticket_events (ticket_id, actor_id, actor_type, event_type, old_value, new_value)
    values (new.id, v_actor, v_actor_type, 'status', old.status, new.status);
  end if;
  if old.priority is distinct from new.priority then
    insert into public.support_ticket_events (ticket_id, actor_id, actor_type, event_type, old_value, new_value)
    values (new.id, v_actor, v_actor_type, 'priority', old.priority, new.priority);
  end if;
  if old.assigned_admin_id is distinct from new.assigned_admin_id then
    insert into public.support_ticket_events (ticket_id, actor_id, actor_type, event_type, old_value, new_value)
    values (new.id, v_actor, v_actor_type, 'assignment', old.assigned_admin_id::text, new.assigned_admin_id::text);
  end if;
  return new;
end;
$$;

create trigger support_ticket_audit_update after update on public.support_tickets
for each row execute function public.support_ticket_audit_update();

create function public.support_create_ticket (
  p_customer_id uuid, p_order_id uuid, p_category_id uuid,
  p_subject text, p_body text, p_idempotency_key uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_ticket_id uuid;
  v_email text;
  v_name text;
begin
  select email, coalesce(nullif(full_name, ''), email) into v_email, v_name
  from public.customer_profiles where id = p_customer_id and is_active = true;
  if v_email is null then raise exception 'Customer account is unavailable.' using errcode = '22023'; end if;
  if p_order_id is not null and not exists (
    select 1 from public.customer_orders where id = p_order_id and user_id = p_customer_id
  ) then raise exception 'Order is unavailable.' using errcode = '22023'; end if;
  if p_category_id is not null and not exists (
    select 1 from public.help_categories where id = p_category_id and is_active = true
  ) then raise exception 'Category is unavailable.' using errcode = '22023'; end if;

  insert into public.support_tickets (customer_id, customer_email, customer_name, order_id, category_id, subject, idempotency_key)
  values (p_customer_id, v_email, left(v_name, 160), p_order_id, p_category_id, p_subject, p_idempotency_key)
  on conflict (customer_id, idempotency_key) where customer_id is not null do nothing
  returning id into v_ticket_id;

  if v_ticket_id is null then
    select id into v_ticket_id from public.support_tickets
    where customer_id = p_customer_id and idempotency_key = p_idempotency_key;
    return v_ticket_id;
  end if;

  insert into public.support_ticket_messages (ticket_id, sender_id, sender_type, sender_name, body, idempotency_key)
  values (v_ticket_id, p_customer_id, 'customer', left(v_name, 160), p_body, p_idempotency_key);
  insert into public.support_ticket_events (ticket_id, actor_id, actor_type, event_type, new_value)
  values (v_ticket_id, p_customer_id, 'customer', 'created', 'open');
  return v_ticket_id;
end;
$$;

create function public.support_add_message (
  p_ticket_id uuid, p_sender_id uuid, p_sender_type text,
  p_sender_name text, p_body text, p_internal boolean, p_idempotency_key uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_ticket public.support_tickets%rowtype;
  v_message_id uuid;
begin
  select * into v_ticket from public.support_tickets where id = p_ticket_id for update;
  if not found then raise exception 'Ticket not found.' using errcode = '22023'; end if;

  if p_sender_type = 'customer' then
    if v_ticket.customer_id is distinct from p_sender_id or p_internal then
      raise exception 'Ticket is unavailable.' using errcode = '22023';
    end if;
    if v_ticket.status in ('resolved', 'closed') then
      raise exception 'Reopen the ticket before replying.' using errcode = '22023';
    end if;
    if not exists (select 1 from public.customer_profiles where id = p_sender_id and is_active = true) then
      raise exception 'Customer account is unavailable.' using errcode = '22023';
    end if;
  elsif p_sender_type = 'staff' then
    if not exists (
      select 1 from public.admin_users a where a.id = p_sender_id and a.is_active = true
        and (a.role = 'owner' or coalesce((a.permissions ->> 'support.reply')::boolean, false))
    ) then raise exception 'Support access is required.' using errcode = '22023'; end if;
    if v_ticket.status = 'closed' and not p_internal then
      raise exception 'Reopen the ticket before replying.' using errcode = '22023';
    end if;
  else
    raise exception 'Invalid sender.' using errcode = '22023';
  end if;

  insert into public.support_ticket_messages (ticket_id, sender_id, sender_type, sender_name, body, is_internal, idempotency_key)
  values (p_ticket_id, p_sender_id, p_sender_type, p_sender_name, p_body, p_internal, p_idempotency_key)
  on conflict (ticket_id, sender_id, idempotency_key) do nothing returning id into v_message_id;
  if v_message_id is null then
    select id into v_message_id from public.support_ticket_messages
    where ticket_id = p_ticket_id and sender_id = p_sender_id and idempotency_key = p_idempotency_key;
    return v_message_id;
  end if;

  if not p_internal then
    perform set_config('app.support_actor_id', p_sender_id::text, true);
    perform set_config('app.support_actor_type', p_sender_type, true);
    update public.support_tickets set
      last_reply_at = now(),
      status = case when p_sender_type = 'customer' then 'waiting_for_support' else 'waiting_for_customer' end,
      closed_at = null
    where id = p_ticket_id;
  end if;
  return v_message_id;
end;
$$;

create function public.support_update_ticket (
  p_ticket_id uuid, p_actor_id uuid, p_actor_type text,
  p_status text, p_priority text, p_assignee_id uuid, p_change_assignment boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_ticket public.support_tickets%rowtype;
  v_can_manage boolean;
begin
  select * into v_ticket from public.support_tickets where id = p_ticket_id for update;
  if not found then raise exception 'Ticket not found.' using errcode = '22023'; end if;

  if p_actor_type = 'customer' then
    if v_ticket.customer_id is distinct from p_actor_id
      or p_priority is not null or p_change_assignment then
      raise exception 'Ticket is unavailable.' using errcode = '22023';
    end if;
    if p_status = 'closed' and v_ticket.status not in ('closed', 'resolved') then
      null;
    elsif p_status = 'open' and v_ticket.status in ('closed', 'resolved')
      and v_ticket.updated_at >= now() - interval '7 days' then
      null;
    else
      raise exception 'This status change is not available.' using errcode = '22023';
    end if;
  elsif p_actor_type = 'staff' then
    select a.role = 'owner' or coalesce((a.permissions ->> 'support.manage')::boolean, false)
    into v_can_manage from public.admin_users a where a.id = p_actor_id and a.is_active = true;
    if not coalesce(v_can_manage, false) then
      raise exception 'Support management access is required.' using errcode = '22023';
    end if;
    if p_status is not null and p_status not in ('open', 'in_progress', 'waiting_for_customer', 'waiting_for_support', 'resolved', 'closed') then
      raise exception 'Invalid status.' using errcode = '22023';
    end if;
    if p_priority is not null and p_priority not in ('low', 'normal', 'high', 'urgent') then
      raise exception 'Invalid priority.' using errcode = '22023';
    end if;
  else
    raise exception 'Invalid actor.' using errcode = '22023';
  end if;

  perform set_config('app.support_actor_id', p_actor_id::text, true);
  perform set_config('app.support_actor_type', p_actor_type, true);
  update public.support_tickets set
    status = coalesce(p_status, status),
    priority = coalesce(p_priority, priority),
    assigned_admin_id = case when p_change_assignment then p_assignee_id else assigned_admin_id end,
    closed_at = case when coalesce(p_status, status) = 'closed' then coalesce(closed_at, now()) else null end
  where id = p_ticket_id;
  return p_ticket_id;
end;
$$;

revoke all on function public.support_create_ticket(uuid, uuid, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.support_add_message(uuid, uuid, text, text, text, boolean, uuid) from public, anon, authenticated;
revoke all on function public.support_update_ticket(uuid, uuid, text, text, text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.support_create_ticket(uuid, uuid, uuid, text, text, uuid) to service_role;
grant execute on function public.support_add_message(uuid, uuid, text, text, text, boolean, uuid) to service_role;
grant execute on function public.support_update_ticket(uuid, uuid, text, text, text, uuid, boolean) to service_role;

alter table public.help_categories enable row level security;
alter table public.help_articles enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;
alter table public.support_ticket_attachments enable row level security;
alter table public.support_ticket_events enable row level security;

create policy help_categories_public_read on public.help_categories for select to anon, authenticated
using (is_active = true);
create policy help_articles_public_read on public.help_articles for select to anon, authenticated
using (status = 'published' and exists (
  select 1 from public.help_categories c where c.id = category_id and c.is_active = true
));

revoke all on public.help_categories, public.help_articles,
  public.support_tickets, public.support_ticket_messages,
  public.support_ticket_attachments, public.support_ticket_events from public, anon, authenticated;
grant select on public.help_categories, public.help_articles to anon, authenticated;
grant all on public.help_categories, public.help_articles,
  public.support_tickets, public.support_ticket_messages,
  public.support_ticket_attachments, public.support_ticket_events to service_role;
grant usage, select on sequence public.support_tickets_reference_number_seq to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-attachments', 'support-attachments', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No storage.objects policy is created for this private bucket. Only the
-- service role may upload or download through authenticated application APIs.

insert into public.help_categories (name, slug, description, sort_position) values
  ('Orders', 'orders', 'Track, change, and understand orders.', 10),
  ('Payments', 'payments', 'Payment methods and billing questions.', 20),
  ('Shipping', 'shipping', 'Delivery and tracking help.', 30),
  ('Returns & Refunds', 'returns-refunds', 'Returns, exchanges, and refunds.', 40),
  ('Products', 'products', 'Product information and compatibility.', 50),
  ('Account', 'account', 'Sign-in and account settings.', 60),
  ('Warranty', 'warranty', 'Warranty and repairs.', 70),
  ('Technical Support', 'technical-support', 'Troubleshooting your products.', 80),
  ('Other', 'other', 'Anything else we can help with.', 90);

-- Keep the existing reset allowlist fail-closed while accounting for these
-- known tables. The old scope lists remain unchanged for other scopes.
alter function public.system_reset_tables(text) rename to system_reset_tables_before_support;
create function public.system_reset_tables(p_scope text)
returns text[] language sql immutable set search_path = '' as $$
  select case p_scope
    when 'content' then array['help_articles', 'help_categories']::text[] || public.system_reset_tables_before_support(p_scope)
    when 'full' then array[
      'support_ticket_attachments', 'support_ticket_events', 'support_ticket_messages',
      'support_tickets', 'help_articles', 'help_categories'
    ]::text[] || public.system_reset_tables_before_support(p_scope)
    else public.system_reset_tables_before_support(p_scope)
  end;
$$;
revoke all on function public.system_reset_tables(text) from public, anon, authenticated;
revoke all on function public.system_reset_tables_before_support(text) from public, anon, authenticated;

-- The reset journal snapshots private object paths before DB rows are erased.
-- Cleanup then removes only those captured objects, preserving later uploads.
create function public.support_reset_manifest () returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.scope = 'full' then
    new.manifest := jsonb_set(
      new.manifest,
      '{support}',
      coalesce((select jsonb_agg(name) from storage.objects where bucket_id = 'support-attachments'), '[]'::jsonb)
    );
  end if;
  return new;
end;
$$;
create trigger support_reset_manifest before insert on public.system_reset_runs
for each row execute function public.support_reset_manifest();

commit;
