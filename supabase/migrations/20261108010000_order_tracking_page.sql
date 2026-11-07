-- Owner request 7 Nov 2026 (phase 3A): the storefront "Track your orders" link is set in
-- the Dashboard and opens the public tracking page by default. A store path or https link.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

alter table public.site_settings
 add column track_orders_link text not null default '/track',
 add constraint site_settings_track_orders_link_check check (
  (track_orders_link ~ '^/[A-Za-z0-9/_.~?=&%#-]{0,200}$' and track_orders_link !~ '^//')
  or (char_length(track_orders_link)<=300 and track_orders_link ~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?(/[^[:space:]<>"]*)?$'));
comment on column public.site_settings.track_orders_link is
 'Target of the storefront Track your orders link: a store path (default /track) or an https link.';

notify pgrst,'reload schema';
commit;
