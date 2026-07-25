begin;

create index if not exists store_analytics_sessions_external_last_seen_idx
on public.store_analytics_sessions (last_seen_at desc, visitor_id)
where is_internal = false;

create or replace function public.store_analytics_get_live_visitors (
  p_active_seconds integer default 180
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct visitor_id)::bigint
  from public.store_analytics_sessions
  where is_internal = false
    and last_seen_at >= now() - (
      greatest(
        60,
        least(coalesce(p_active_seconds, 180), 600)
      ) * interval '1 second'
    );
$$;

revoke all on function public.store_analytics_get_live_visitors (integer)
from public, anon, authenticated;

grant execute on function public.store_analytics_get_live_visitors (integer)
to service_role;

commit;
