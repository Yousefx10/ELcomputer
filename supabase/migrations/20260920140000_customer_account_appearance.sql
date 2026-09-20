begin;

alter table public.site_settings
add column if not exists account_dashboard_style text;

update public.site_settings
set account_dashboard_style = 'modern'
where account_dashboard_style is null
  or account_dashboard_style not in ('classic', 'modern');

alter table public.site_settings
alter column account_dashboard_style set default 'modern',
alter column account_dashboard_style set not null;

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'site_settings_account_dashboard_style_check'
      and conrelid = 'public.site_settings'::regclass
  ) then
    alter table public.site_settings
    add constraint site_settings_account_dashboard_style_check
    check (account_dashboard_style in ('classic', 'modern'));
  end if;
end;
$migration$;

commit;
