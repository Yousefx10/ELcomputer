begin;

alter table public.site_settings
add column if not exists dashboard_layout text;

update public.site_settings
set dashboard_layout = 'standard'
where dashboard_layout is null
  or lower(btrim(dashboard_layout)) not in ('standard', 'detailed');

update public.site_settings
set dashboard_layout = lower(btrim(dashboard_layout));

alter table public.site_settings
alter column dashboard_layout set default 'standard',
alter column dashboard_layout set not null;

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'site_settings_dashboard_layout_check'
      and conrelid = 'public.site_settings'::regclass
  ) then
    alter table public.site_settings
    add constraint site_settings_dashboard_layout_check
    check (dashboard_layout in ('standard', 'detailed'));
  end if;
end;
$migration$;

commit;
