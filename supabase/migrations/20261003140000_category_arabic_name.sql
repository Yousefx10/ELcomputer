-- Optional staff-authored display translation. No data, slug, grant or policy changes.
begin;
alter table public.categories add column if not exists name_ar text;
comment on column public.categories.name_ar is 'Optional Arabic display name. name is the English source; slug remains canonical.';
notify pgrst, 'reload schema';
commit;
