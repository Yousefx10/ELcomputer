-- Add branding preferences to the existing singleton settings model.
-- No catalog/content changes. Apply separately during an authorized release.
alter table public.site_settings
  add column if not exists site_logo_light_url text,
  add column if not exists site_logo_dark_url text,
  add column if not exists site_theme_default text not null default 'system'
    check (site_theme_default in ('system', 'light', 'dark'));
