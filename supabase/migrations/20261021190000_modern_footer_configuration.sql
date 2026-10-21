-- Additive presentation settings; existing footer values/menus remain intact.
-- Existing Settings RLS and recursive site_settings media guards also cover JSON.
alter table public.site_settings add column footer_modern_config jsonb;
alter table public.site_settings add constraint site_settings_modern_footer_config_check
  check (footer_modern_config is null or (
    jsonb_typeof(footer_modern_config) = 'object'
    and coalesce(footer_modern_config->>'version' = '1', false)
    and octet_length(footer_modern_config::text) <= 65536
  ));
comment on column public.site_settings.footer_modern_config is
  'Modern footer presentation v1. NULL inherits legacy values. No credentials or subscriber data.';
