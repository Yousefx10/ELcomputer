begin;

-- Internal identities are kept in a ledger without an auth.users foreign key.
-- This preserves the exclusion even if an administrator account is deleted.
create table if not exists public.store_analytics_internal_users (
  user_id uuid not null,
  marked_at timestamp with time zone not null default now(),
  constraint store_analytics_internal_users_pkey primary key (user_id)
);

create table if not exists public.store_analytics_internal_carts (
  cart_id uuid not null,
  marked_at timestamp with time zone not null default now(),
  constraint store_analytics_internal_carts_pkey primary key (cart_id)
);

create or replace function public.serialize_store_analytics_internal_user_insert ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended('store-analytics-internal-user:' || new.user_id::text, 0)
  );

  return new;
end;
$$;

drop trigger if exists store_analytics_internal_users_serialize_insert
on public.store_analytics_internal_users;

create trigger store_analytics_internal_users_serialize_insert
before insert on public.store_analytics_internal_users
for each row
execute function public.serialize_store_analytics_internal_user_insert();

create or replace function public.prevent_store_analytics_ledger_mutation ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'Store analytics exclusion ledgers are append-only.';
end;
$$;

drop trigger if exists store_analytics_internal_users_immutable
on public.store_analytics_internal_users;

create trigger store_analytics_internal_users_immutable
before update or delete on public.store_analytics_internal_users
for each row
execute function public.prevent_store_analytics_ledger_mutation();

drop trigger if exists store_analytics_internal_carts_immutable
on public.store_analytics_internal_carts;

create trigger store_analytics_internal_carts_immutable
before update or delete on public.store_analytics_internal_carts
for each row
execute function public.prevent_store_analytics_ledger_mutation();

alter table public.nps_responses
add column if not exists is_internal boolean not null default false;

alter table public.store_analytics_sessions
add column if not exists is_internal boolean not null default false;

alter table public.customer_profiles
add column if not exists is_internal boolean not null default false;

update public.nps_responses
set is_internal = false
where is_internal is null;

update public.store_analytics_sessions
set is_internal = false
where is_internal is null;

update public.customer_profiles
set is_internal = false
where is_internal is null;

alter table public.nps_responses
alter column is_internal set default false,
alter column is_internal set not null;

alter table public.store_analytics_sessions
alter column is_internal set default false,
alter column is_internal set not null;

alter table public.customer_profiles
alter column is_internal set default false,
alter column is_internal set not null;

create or replace function public.enforce_nps_response_internal_identity ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(
        'store-analytics-internal-user:' || new.user_id::text,
        0
      )
    );
  end if;

  if tg_op = 'UPDATE' and old.is_internal then
    new.is_internal := true;
    return new;
  end if;

  new.is_internal := exists (
    select 1
    from public.store_analytics_internal_users as internal_users
    where internal_users.user_id = new.user_id
  );

  return new;
end;
$$;

drop trigger if exists a_nps_responses_enforce_internal_identity
on public.nps_responses;

create trigger a_nps_responses_enforce_internal_identity
before insert or update on public.nps_responses
for each row
execute function public.enforce_nps_response_internal_identity();

create or replace function public.enforce_store_analytics_session_internal_identity ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(
        'store-analytics-internal-user:' || new.user_id::text,
        0
      )
    );
  end if;

  if tg_op = 'UPDATE' and old.is_internal then
    new.is_internal := true;
    return new;
  end if;

  new.is_internal := exists (
    select 1
    from public.store_analytics_internal_users as internal_users
    where internal_users.user_id = new.user_id
  );

  return new;
end;
$$;

drop trigger if exists store_analytics_sessions_enforce_internal_identity
on public.store_analytics_sessions;

create trigger store_analytics_sessions_enforce_internal_identity
before insert or update of user_id, is_internal on public.store_analytics_sessions
for each row
execute function public.enforce_store_analytics_session_internal_identity();

create or replace function public.enforce_nps_response_cooldown ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
begin
  -- Derive this again here so correctness does not depend on the ordering of
  -- multiple BEFORE INSERT triggers.
  if new.user_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(
        'store-analytics-internal-user:' || new.user_id::text,
        0
      )
    );
  end if;

  new.is_internal := exists (
    select 1
    from public.store_analytics_internal_users as internal_users
    where internal_users.user_id = new.user_id
  );

  if new.is_internal then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('visitor:' || new.visitor_id::text, 0)
  );

  if new.user_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended('user:' || new.user_id::text, 0)
    );
  end if;

  if exists (
    select 1
    from public.nps_responses as responses
    where responses.response_id <> new.response_id
      and responses.is_internal = false
      and responses.created_at >= now() - interval '90 days'
      and (
        (
          new.user_id is not null
          and (
            responses.user_id = new.user_id
            or responses.visitor_id = new.visitor_id
          )
        )
        or (
          new.user_id is null
          and responses.user_id is null
          and responses.visitor_id = new.visitor_id
        )
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'NPS response cooldown is active.';
  end if;

  return new;
end;
$$;

create or replace function public.apply_store_analytics_internal_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.nps_responses
  set is_internal = true
  where user_id = new.user_id
    and is_internal = false;

  update public.store_analytics_sessions
  set is_internal = true
  where user_id = new.user_id
    and is_internal = false;

  update public.customer_profiles
  set is_internal = true
  where id = new.user_id
    and is_internal = false;

  insert into public.store_analytics_internal_carts (cart_id)
  select distinct events.cart_id
  from public.store_analytics_events as events
  join public.store_analytics_sessions as sessions
    on sessions.id = events.session_id
  where events.cart_id is not null
    and (
      events.user_id = new.user_id
      or sessions.user_id = new.user_id
    )
  on conflict (cart_id) do nothing;

  return new;
end;
$$;

drop trigger if exists store_analytics_internal_user_apply
on public.store_analytics_internal_users;

create trigger store_analytics_internal_user_apply
after insert on public.store_analytics_internal_users
for each row
execute function public.apply_store_analytics_internal_user();

create or replace function public.mark_admin_as_store_analytics_internal ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.store_analytics_internal_users (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists admin_users_mark_store_analytics_internal
on public.admin_users;

create trigger admin_users_mark_store_analytics_internal
after insert on public.admin_users
for each row
execute function public.mark_admin_as_store_analytics_internal();

create or replace function public.enforce_customer_profile_internal_identity ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended(
      'store-analytics-internal-user:' || new.id::text,
      0
    )
  );

  new.is_internal := exists (
    select 1
    from public.store_analytics_internal_users as internal_users
    where internal_users.user_id = new.id
  );

  return new;
end;
$$;

drop trigger if exists customer_profiles_enforce_internal_identity
on public.customer_profiles;

create trigger customer_profiles_enforce_internal_identity
before insert or update on public.customer_profiles
for each row
execute function public.enforce_customer_profile_internal_identity();

insert into public.store_analytics_internal_users (user_id)
select admins.id
from public.admin_users as admins
on conflict (user_id) do nothing;

-- Make the migration idempotent even when a ledger row already existed.
update public.nps_responses as responses
set is_internal = true
where responses.is_internal = false
  and exists (
    select 1
    from public.store_analytics_internal_users as internal_users
    where internal_users.user_id = responses.user_id
  );

update public.store_analytics_sessions as sessions
set is_internal = true
where sessions.is_internal = false
  and exists (
    select 1
    from public.store_analytics_internal_users as internal_users
    where internal_users.user_id = sessions.user_id
  );

update public.customer_profiles as profiles
set is_internal = true
where profiles.is_internal = false
  and exists (
    select 1
    from public.store_analytics_internal_users as internal_users
    where internal_users.user_id = profiles.id
  );

insert into public.store_analytics_internal_carts (cart_id)
select distinct events.cart_id
from public.store_analytics_events as events
join public.store_analytics_sessions as sessions
  on sessions.id = events.session_id
where events.cart_id is not null
  and sessions.is_internal = true
on conflict (cart_id) do nothing;

create index if not exists nps_responses_external_created_idx
on public.nps_responses (created_at desc)
where is_internal = false;

create index if not exists store_analytics_sessions_external_started_idx
on public.store_analytics_sessions (started_at desc)
where is_internal = false;

create index if not exists store_analytics_sessions_external_visitor_started_idx
on public.store_analytics_sessions (visitor_id, started_at, id)
where is_internal = false;

create index if not exists store_analytics_events_occurred_session_idx
on public.store_analytics_events (occurred_at desc, session_id);

create index if not exists customer_profiles_external_created_idx
on public.customer_profiles (created_at desc)
where is_internal = false;

create index if not exists customer_profiles_external_active_idx
on public.customer_profiles (is_active)
where is_internal = false;

create or replace function public.store_analytics_is_internal_user (
  p_user_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    p_user_id is not null
    and exists (
      select 1
      from public.store_analytics_internal_users as internal_users
      where internal_users.user_id = p_user_id
    );
$$;

create or replace function public.store_analytics_mark_internal_cart (
  p_cart_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_cart_id is null then
    return false;
  end if;

  insert into public.store_analytics_internal_carts (cart_id)
  values (p_cart_id)
  on conflict (cart_id) do nothing;

  return true;
end;
$$;

create or replace function public.store_analytics_mark_internal_session_carts (
  p_session_id uuid,
  p_visitor_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
begin
  if p_session_id is null or p_visitor_id is null then
    return 0;
  end if;

  if not exists (
    select 1
    from public.store_analytics_sessions as sessions
    where sessions.id = p_session_id
      and sessions.visitor_id = p_visitor_id
      and sessions.is_internal = true
  ) then
    return 0;
  end if;

  insert into public.store_analytics_internal_carts (cart_id)
  select distinct events.cart_id
  from public.store_analytics_events as events
  where events.session_id = p_session_id
    and events.visitor_id = p_visitor_id
    and events.cart_id is not null
  on conflict (cart_id) do nothing;

  get diagnostics v_inserted = row_count;

  return v_inserted;
end;
$$;

create or replace function public.store_analytics_get_snapshot (
  p_window_days integer default 30
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_window_days integer := greatest(1, least(coalesce(p_window_days, 30), 365));
  v_window_start timestamp with time zone;
  v_nps_total bigint := 0;
  v_nps_promoters bigint := 0;
  v_nps_passives bigint := 0;
  v_nps_detractors bigint := 0;
  v_nps_score integer;
  v_total_visits bigint := 0;
  v_returning_visits bigint := 0;
  v_unique_visitors bigint := 0;
  v_mature_carts bigint := 0;
  v_abandoned_carts bigint := 0;
  v_purchasing_customers bigint := 0;
  v_repeat_customers bigint := 0;
  v_page_views bigint := 0;
  v_product_views bigint := 0;
  v_unique_product_viewers bigint := 0;
  v_avg_product_dwell_seconds numeric := 0;
  v_add_to_cart_events bigint := 0;
  v_checkout_starts bigint := 0;
  v_orders_created bigint := 0;
begin
  v_window_start := now() - make_interval(days => v_window_days);

  select
    count(*)::bigint,
    count(*) filter (where score >= 9)::bigint,
    count(*) filter (where score between 7 and 8)::bigint,
    count(*) filter (where score <= 6)::bigint
  into
    v_nps_total,
    v_nps_promoters,
    v_nps_passives,
    v_nps_detractors
  from public.nps_responses
  where created_at >= now() - interval '90 days'
    and is_internal = false;

  v_nps_score := case
    when v_nps_total = 0 then null
    else round(
      (
        (v_nps_promoters::numeric / v_nps_total::numeric)
        - (v_nps_detractors::numeric / v_nps_total::numeric)
      ) * 100
    )::integer
  end;

  with window_sessions as (
    select
      sessions.id,
      sessions.visitor_id,
      sessions.started_at,
      exists (
        select 1
        from public.store_analytics_sessions as previous_sessions
        where previous_sessions.visitor_id = sessions.visitor_id
          and previous_sessions.is_internal = false
          and (
            previous_sessions.started_at < sessions.started_at
            or (
              previous_sessions.started_at = sessions.started_at
              and previous_sessions.id < sessions.id
            )
          )
      ) as is_returning
    from public.store_analytics_sessions as sessions
    where sessions.started_at >= v_window_start
      and sessions.is_internal = false
  )
  select
    count(*)::bigint,
    count(*) filter (where is_returning)::bigint,
    count(distinct visitor_id)::bigint
  into
    v_total_visits,
    v_returning_visits,
    v_unique_visitors
  from window_sessions;

  with candidate_carts as (
    select distinct events.cart_id
    from public.store_analytics_events as events
    join public.store_analytics_sessions as sessions
      on sessions.id = events.session_id
    where events.event_name = 'add_to_cart'
      and events.occurred_at >= v_window_start
      and events.cart_id is not null
      and sessions.is_internal = false
      and not exists (
        select 1
        from public.store_analytics_internal_carts as internal_carts
        where internal_carts.cart_id = events.cart_id
      )
      and not exists (
        select 1
        from public.store_analytics_events as earlier_events
        join public.store_analytics_sessions as earlier_sessions
          on earlier_sessions.id = earlier_events.session_id
        where earlier_events.cart_id = events.cart_id
          and earlier_events.event_name = 'add_to_cart'
          and earlier_events.occurred_at < v_window_start
          and earlier_sessions.is_internal = false
      )
  ),
  cart_activity as (
    select
      events.cart_id,
      min(events.occurred_at) filter (
        where events.event_name = 'add_to_cart'
      ) as started_at,
      max(events.occurred_at) as last_activity_at,
      bool_or(events.event_name = 'order_created') as has_order
    from public.store_analytics_events as events
    join candidate_carts
      on candidate_carts.cart_id = events.cart_id
    join public.store_analytics_sessions as sessions
      on sessions.id = events.session_id
    where sessions.is_internal = false
    group by events.cart_id
  ),
  mature_carts as (
    select cart_id, has_order
    from cart_activity
    where started_at >= v_window_start
      and (
        has_order
        or last_activity_at <= now() - interval '24 hours'
      )
  )
  select
    count(*)::bigint,
    count(*) filter (where not has_order)::bigint
  into
    v_mature_carts,
    v_abandoned_carts
  from mature_carts;

  with fulfilled_orders as (
    select orders.user_id, count(*)::bigint as fulfilled_count
    from public.customer_orders as orders
    where orders.status in ('completed', 'delivered')
      and not exists (
        select 1
        from public.store_analytics_internal_users as internal_users
        where internal_users.user_id = orders.user_id
      )
    group by orders.user_id
  )
  select
    count(*)::bigint,
    count(*) filter (where fulfilled_count >= 2)::bigint
  into
    v_purchasing_customers,
    v_repeat_customers
  from fulfilled_orders;

  select
    count(*) filter (where events.event_name = 'page_view')::bigint,
    count(*) filter (where events.event_name = 'product_view')::bigint,
    count(distinct events.visitor_id) filter (
      where events.event_name = 'product_view'
    )::bigint,
    coalesce(
      round(
        (
          sum(events.duration_ms) filter (
            where events.event_name = 'product_dwell'
          )
        )::numeric
        / nullif(
          count(*) filter (
            where events.event_name = 'product_view'
          ),
          0
        )::numeric
        / 1000.0,
        2
      ),
      0
    ),
    count(*) filter (where events.event_name = 'add_to_cart')::bigint,
    count(*) filter (where events.event_name = 'checkout_started')::bigint,
    count(*) filter (where events.event_name = 'order_created')::bigint
  into
    v_page_views,
    v_product_views,
    v_unique_product_viewers,
    v_avg_product_dwell_seconds,
    v_add_to_cart_events,
    v_checkout_starts,
    v_orders_created
  from public.store_analytics_events as events
  join public.store_analytics_sessions as sessions
    on sessions.id = events.session_id
  where events.occurred_at >= v_window_start
    and sessions.is_internal = false;

  return jsonb_build_object(
    'nps', jsonb_build_object(
      'score', v_nps_score,
      'total', v_nps_total,
      'promoters', v_nps_promoters,
      'passives', v_nps_passives,
      'detractors', v_nps_detractors
    ),
    'kpis', jsonb_build_object(
      'returningVisitorRate', case
        when v_total_visits = 0 then 0
        else round((v_returning_visits::numeric / v_total_visits::numeric) * 100, 2)
      end,
      'totalVisits', v_total_visits,
      'returningVisits', v_returning_visits,
      'uniqueVisitors', v_unique_visitors,
      'cartAbandonmentRate', case
        when v_mature_carts = 0 then 0
        else round((v_abandoned_carts::numeric / v_mature_carts::numeric) * 100, 2)
      end,
      'matureCarts', v_mature_carts,
      'abandonedCarts', v_abandoned_carts,
      'repeatPurchaseRate', case
        when v_purchasing_customers = 0 then 0
        else round((v_repeat_customers::numeric / v_purchasing_customers::numeric) * 100, 2)
      end,
      'purchasingCustomers', v_purchasing_customers,
      'repeatCustomers', v_repeat_customers
    ),
    'activity', jsonb_build_object(
      'pageViews', v_page_views,
      'productViews', v_product_views,
      'uniqueProductViewers', v_unique_product_viewers,
      'avgProductDwellSeconds', v_avg_product_dwell_seconds,
      'addToCartEvents', v_add_to_cart_events,
      'checkoutStarts', v_checkout_starts,
      'ordersCreated', v_orders_created
    )
  );
end;
$$;

create or replace function public.store_analytics_get_customer_behavior (
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if p_user_id is null or exists (
    select 1
    from public.store_analytics_internal_users as internal_users
    where internal_users.user_id = p_user_id
  ) then
    return jsonb_build_object(
      'available', false,
      'visits', 0,
      'returningVisits', 0,
      'productViews', 0,
      'totalProductDwellSeconds', 0,
      'averageProductDwellSeconds', 0,
      'addToCartEvents', 0,
      'checkoutStarts', 0,
      'lastSeenAt', null,
      'products', '[]'::jsonb
    );
  end if;

  with session_summary as (
    select
      count(*)::bigint as visits,
      greatest(count(*) - 1, 0)::bigint as returning_visits,
      max(last_seen_at) as last_seen_at
    from public.store_analytics_sessions
    where user_id = p_user_id
      and is_internal = false
  ),
  event_summary as (
    select
      count(*) filter (where events.event_name = 'product_view')::bigint as product_views,
      coalesce(
        sum(events.duration_ms) filter (
          where events.event_name = 'product_dwell'
        ),
        0
      )::bigint as total_product_dwell_ms,
      count(*) filter (
        where events.event_name = 'add_to_cart'
      )::bigint as add_to_cart_events,
      count(*) filter (
        where events.event_name = 'checkout_started'
      )::bigint as checkout_starts,
      max(events.occurred_at) as last_seen_at
    from public.store_analytics_events as events
    join public.store_analytics_sessions as sessions
      on sessions.id = events.session_id
    where events.user_id = p_user_id
      and sessions.is_internal = false
  ),
  product_engagement as (
    select
      events.product_id,
      count(*) filter (
        where events.event_name = 'product_view'
      )::bigint as view_count,
      coalesce(
        sum(events.duration_ms) filter (
          where events.event_name = 'product_dwell'
        ),
        0
      )::bigint as dwell_ms,
      max(events.occurred_at) as last_viewed_at
    from public.store_analytics_events as events
    join public.store_analytics_sessions as sessions
      on sessions.id = events.session_id
    where events.user_id = p_user_id
      and sessions.is_internal = false
      and events.product_id is not null
      and events.event_name in ('product_view', 'product_dwell')
    group by events.product_id
  ),
  top_products as (
    select
      products.title,
      products.slug,
      engagement.view_count,
      round((engagement.dwell_ms::numeric / 1000.0), 1) as dwell_seconds,
      engagement.last_viewed_at
    from product_engagement as engagement
    join public.products as products
      on products.id = engagement.product_id
    order by
      engagement.view_count desc,
      engagement.dwell_ms desc,
      engagement.last_viewed_at desc
    limit 5
  )
  select jsonb_build_object(
    'available', true,
    'visits', sessions.visits,
    'returningVisits', sessions.returning_visits,
    'productViews', events.product_views,
    'totalProductDwellSeconds',
      round((events.total_product_dwell_ms::numeric / 1000.0), 1),
    'averageProductDwellSeconds',
      case
        when events.product_views = 0 then 0
        else round(
          (
            events.total_product_dwell_ms::numeric
            / events.product_views::numeric
            / 1000.0
          ),
          1
        )
      end,
    'addToCartEvents', events.add_to_cart_events,
    'checkoutStarts', events.checkout_starts,
    'lastSeenAt', case
      when sessions.last_seen_at is null then events.last_seen_at
      when events.last_seen_at is null then sessions.last_seen_at
      else greatest(sessions.last_seen_at, events.last_seen_at)
    end,
    'products', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'title', top_products.title,
            'slug', top_products.slug,
            'viewCount', top_products.view_count,
            'dwellSeconds', top_products.dwell_seconds,
            'lastViewedAt', top_products.last_viewed_at
          )
          order by
            top_products.view_count desc,
            top_products.dwell_seconds desc,
            top_products.last_viewed_at desc
        )
        from top_products
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from session_summary as sessions
  cross join event_summary as events;

  return v_result;
end;
$$;

alter table public.store_analytics_internal_users enable row level security;
alter table public.store_analytics_internal_carts enable row level security;

revoke all on table public.store_analytics_internal_users
from public, anon, authenticated;
revoke all on table public.store_analytics_internal_carts
from public, anon, authenticated;

grant select, insert
on table public.store_analytics_internal_users
to service_role;
grant select, insert
on table public.store_analytics_internal_carts
to service_role;

revoke update, delete, truncate
on table public.store_analytics_internal_users
from service_role;
revoke update, delete, truncate
on table public.store_analytics_internal_carts
from service_role;

revoke all on function public.prevent_store_analytics_ledger_mutation ()
from public, anon, authenticated;
grant execute on function public.prevent_store_analytics_ledger_mutation ()
to service_role;

revoke all on function public.serialize_store_analytics_internal_user_insert ()
from public, anon, authenticated;
grant execute on function public.serialize_store_analytics_internal_user_insert ()
to service_role;

revoke all on function public.enforce_nps_response_internal_identity ()
from public, anon, authenticated;
grant execute on function public.enforce_nps_response_internal_identity ()
to service_role;

revoke all on function public.enforce_store_analytics_session_internal_identity ()
from public, anon, authenticated;
grant execute on function public.enforce_store_analytics_session_internal_identity ()
to service_role;

revoke all on function public.store_analytics_is_internal_user (uuid)
from public, anon, authenticated;
grant execute on function public.store_analytics_is_internal_user (uuid)
to service_role;

revoke all on function public.store_analytics_mark_internal_cart (uuid)
from public, anon, authenticated;
grant execute on function public.store_analytics_mark_internal_cart (uuid)
to service_role;

revoke all on function public.store_analytics_mark_internal_session_carts (uuid, uuid)
from public, anon, authenticated;
grant execute on function public.store_analytics_mark_internal_session_carts (uuid, uuid)
to service_role;

revoke all on function public.apply_store_analytics_internal_user ()
from public, anon, authenticated;
grant execute on function public.apply_store_analytics_internal_user ()
to service_role;

revoke all on function public.mark_admin_as_store_analytics_internal ()
from public, anon, authenticated;
grant execute on function public.mark_admin_as_store_analytics_internal ()
to service_role;

revoke all on function public.enforce_customer_profile_internal_identity ()
from public, anon, authenticated;
grant execute on function public.enforce_customer_profile_internal_identity ()
to service_role;

revoke all on function public.store_analytics_get_snapshot (integer)
from public, anon, authenticated;
grant execute on function public.store_analytics_get_snapshot (integer)
to service_role;

revoke all on function public.store_analytics_get_customer_behavior (uuid)
from public, anon, authenticated;
grant execute on function public.store_analytics_get_customer_behavior (uuid)
to service_role;

commit;
