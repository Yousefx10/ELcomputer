begin;

create table if not exists public.nps_responses (
  id uuid not null default gen_random_uuid(),
  response_id uuid not null,
  user_id uuid null,
  visitor_id uuid not null,
  score smallint not null,
  feedback text null,
  source text not null default 'store',
  created_at timestamp with time zone not null default now(),
  constraint nps_responses_pkey primary key (id),
  constraint nps_responses_response_id_key unique (response_id),
  constraint nps_responses_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null,
  constraint nps_responses_score_check check (score between 0 and 10),
  constraint nps_responses_feedback_length_check check (
    feedback is null
    or char_length(btrim(feedback)) between 1 and 999
  ),
  constraint nps_responses_source_check check (
    source ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$'
  )
);

create index if not exists nps_responses_created_at_idx
on public.nps_responses (created_at desc);

create index if not exists nps_responses_user_created_idx
on public.nps_responses (user_id, created_at desc)
where user_id is not null;

create index if not exists nps_responses_visitor_created_idx
on public.nps_responses (visitor_id, created_at desc);

create or replace function public.enforce_nps_response_cooldown ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
begin
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

drop trigger if exists nps_responses_enforce_cooldown on public.nps_responses;

create trigger nps_responses_enforce_cooldown
before insert on public.nps_responses
for each row
execute function public.enforce_nps_response_cooldown();

create table if not exists public.store_analytics_sessions (
  id uuid not null,
  visitor_id uuid not null,
  user_id uuid null,
  started_at timestamp with time zone not null default now(),
  last_seen_at timestamp with time zone not null default now(),
  constraint store_analytics_sessions_pkey primary key (id),
  constraint store_analytics_sessions_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null,
  constraint store_analytics_sessions_time_check check (last_seen_at >= started_at)
);

create index if not exists store_analytics_sessions_started_idx
on public.store_analytics_sessions (started_at desc);

create index if not exists store_analytics_sessions_visitor_started_idx
on public.store_analytics_sessions (visitor_id, started_at desc);

create index if not exists store_analytics_sessions_user_started_idx
on public.store_analytics_sessions (user_id, started_at desc)
where user_id is not null;

create table if not exists public.store_analytics_events (
  id uuid not null default gen_random_uuid(),
  event_id uuid not null,
  session_id uuid not null,
  visitor_id uuid not null,
  user_id uuid null,
  event_name text not null,
  path text null,
  product_id uuid null,
  cart_id uuid null,
  order_id uuid null,
  quantity integer null,
  resulting_quantity integer null,
  duration_ms integer null,
  source text null,
  occurred_at timestamp with time zone not null default now(),
  constraint store_analytics_events_pkey primary key (id),
  constraint store_analytics_events_event_id_key unique (event_id),
  constraint store_analytics_events_session_id_fkey foreign key (session_id) references public.store_analytics_sessions (id) on delete cascade,
  constraint store_analytics_events_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null,
  constraint store_analytics_events_product_id_fkey foreign key (product_id) references public.products (id) on delete set null,
  constraint store_analytics_events_order_id_fkey foreign key (order_id) references public.customer_orders (id) on delete set null,
  constraint store_analytics_events_name_check check (
    event_name = any (array[
      'page_view'::text,
      'product_view'::text,
      'product_dwell'::text,
      'add_to_cart'::text,
      'remove_from_cart'::text,
      'cart_quantity_changed'::text,
      'cart_cleared'::text,
      'checkout_started'::text,
      'order_created'::text
    ])
  ),
  constraint store_analytics_events_path_check check (
    path is null
    or (
      char_length(path) between 1 and 500
      and left(path, 1) = '/'
      and position('?' in path) = 0
      and position('#' in path) = 0
    )
  ),
  constraint store_analytics_events_quantity_check check (
    quantity is null or quantity between 1 and 999
  ),
  constraint store_analytics_events_resulting_quantity_check check (
    resulting_quantity is null or resulting_quantity between 0 and 999
  ),
  constraint store_analytics_events_duration_check check (
    duration_ms is null or duration_ms between 0 and 1800000
  ),
  constraint store_analytics_events_source_check check (
    source is null
    or source ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$'
  ),
  constraint store_analytics_events_product_check check (
    event_name not in (
      'product_view',
      'product_dwell',
      'add_to_cart',
      'remove_from_cart',
      'cart_quantity_changed'
    )
    or product_id is not null
  ),
  constraint store_analytics_events_cart_check check (
    event_name not in (
      'add_to_cart',
      'remove_from_cart',
      'cart_quantity_changed',
      'cart_cleared',
      'checkout_started'
    )
    or cart_id is not null
  ),
  constraint store_analytics_events_order_check check (
    event_name <> 'order_created'
    or order_id is not null
  )
);

create index if not exists store_analytics_events_name_occurred_idx
on public.store_analytics_events (event_name, occurred_at desc);

create index if not exists store_analytics_events_session_occurred_idx
on public.store_analytics_events (session_id, occurred_at desc);

create index if not exists store_analytics_events_visitor_occurred_idx
on public.store_analytics_events (visitor_id, occurred_at desc);

create index if not exists store_analytics_events_user_occurred_idx
on public.store_analytics_events (user_id, occurred_at desc)
where user_id is not null;

create index if not exists store_analytics_events_product_occurred_idx
on public.store_analytics_events (product_id, occurred_at desc)
where product_id is not null;

create index if not exists store_analytics_events_cart_occurred_idx
on public.store_analytics_events (cart_id, occurred_at)
where cart_id is not null;

create unique index if not exists store_analytics_events_order_created_uidx
on public.store_analytics_events (order_id)
where event_name = 'order_created' and order_id is not null;

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
  where created_at >= now() - interval '90 days';

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

  with cart_activity as (
    select
      events.cart_id,
      min(events.occurred_at) filter (
        where events.event_name = 'add_to_cart'
      ) as started_at,
      max(events.occurred_at) as last_activity_at,
      bool_or(events.event_name = 'order_created') as has_order
    from public.store_analytics_events as events
    where events.cart_id is not null
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
  where events.occurred_at >= v_window_start;

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
language sql
security definer
stable
set search_path = public
as $$
  with session_summary as (
    select
      count(*)::bigint as visits,
      greatest(count(*) - 1, 0)::bigint as returning_visits,
      max(last_seen_at) as last_seen_at
    from public.store_analytics_sessions
    where user_id = p_user_id
  ),
  event_summary as (
    select
      count(*) filter (where event_name = 'product_view')::bigint as product_views,
      coalesce(
        sum(duration_ms) filter (where event_name = 'product_dwell'),
        0
      )::bigint as total_product_dwell_ms,
      count(*) filter (where event_name = 'add_to_cart')::bigint as add_to_cart_events,
      count(*) filter (where event_name = 'checkout_started')::bigint as checkout_starts,
      max(occurred_at) as last_seen_at
    from public.store_analytics_events
    where user_id = p_user_id
  ),
  product_engagement as (
    select
      events.product_id,
      count(*) filter (where events.event_name = 'product_view')::bigint as view_count,
      coalesce(
        sum(events.duration_ms) filter (where events.event_name = 'product_dwell'),
        0
      )::bigint as dwell_ms,
      max(events.occurred_at) as last_viewed_at
    from public.store_analytics_events as events
    where events.user_id = p_user_id
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
  from session_summary as sessions
  cross join event_summary as events;
$$;

alter table public.nps_responses enable row level security;
alter table public.store_analytics_sessions enable row level security;
alter table public.store_analytics_events enable row level security;

revoke all on table public.nps_responses from anon, authenticated;
revoke all on table public.store_analytics_sessions from anon, authenticated;
revoke all on table public.store_analytics_events from anon, authenticated;

grant select, insert, update, delete on table public.nps_responses to service_role;
grant select, insert, update, delete on table public.store_analytics_sessions to service_role;
grant select, insert, update, delete on table public.store_analytics_events to service_role;

revoke all on function public.store_analytics_get_snapshot (integer) from public;
revoke all on function public.store_analytics_get_snapshot (integer) from anon;
revoke all on function public.store_analytics_get_snapshot (integer) from authenticated;
grant execute on function public.store_analytics_get_snapshot (integer) to service_role;

revoke all on function public.store_analytics_get_customer_behavior (uuid) from public;
revoke all on function public.store_analytics_get_customer_behavior (uuid) from anon;
revoke all on function public.store_analytics_get_customer_behavior (uuid) from authenticated;
grant execute on function public.store_analytics_get_customer_behavior (uuid) to service_role;

revoke all on function public.enforce_nps_response_cooldown () from public;
revoke all on function public.enforce_nps_response_cooldown () from anon;
revoke all on function public.enforce_nps_response_cooldown () from authenticated;
grant execute on function public.enforce_nps_response_cooldown () to service_role;

commit;
