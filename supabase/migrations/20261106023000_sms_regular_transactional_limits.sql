-- Candidate only. Rebind against the actual installed predecessor before release.
-- Existing pilot does not read these fields; zero defaults keep regular dispatch off.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
alter table public.sms_provider_settings
 add column transactional_daily_segment_limit integer not null default 0
  check(transactional_daily_segment_limit between 0 and 1000),
 add column transactional_min_interval_seconds integer not null default 60
  check(transactional_min_interval_seconds between 60 and 86400);
-- Existing signature/owner/grants are retained; the worker verifies capture cutoff.
create or replace function public.sms_channel_state() returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server authorization required.';end if;
 return(select jsonb_build_object('transactionalEnabled',transactional_enabled,'revision',revision,'enabledSince',enabled_since) from private.sms_channel_controls where id);
end $$;
commit;
