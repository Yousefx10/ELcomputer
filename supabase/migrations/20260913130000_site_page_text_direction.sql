begin;

alter table public.site_pages
add column if not exists text_direction text not null default 'auto'
check (text_direction in ('auto', 'ltr', 'rtl'));

commit;
