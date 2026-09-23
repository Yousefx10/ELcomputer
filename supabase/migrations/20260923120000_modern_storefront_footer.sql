alter table public.site_settings
  add column if not exists footer_style text not null default 'classic',
  add column if not exists footer_modern_card_image_url text,
  add column if not exists footer_modern_card_title text default 'Need help choosing?',
  add column if not exists footer_modern_card_text text default 'Our team can help you find the right setup.',
  add column if not exists footer_modern_card_button_label text default 'Contact us',
  add column if not exists footer_modern_card_button_url text default '/help',
  add column if not exists footer_modern_community_image_url text,
  add column if not exists footer_modern_community_text text default 'Join our Slack',
  add column if not exists footer_modern_community_url text,
  add column if not exists footer_modern_banner_image_url text,
  add column if not exists footer_modern_banner_alt text,
  add column if not exists footer_modern_banner_url text,
  add column if not exists footer_modern_bottom_left_text text default 'Legal',
  add column if not exists footer_modern_bottom_left_url text,
  add column if not exists footer_modern_bottom_center_text text default '© 2026 All rights reserved by ELCOMPUTER',
  add column if not exists footer_modern_bottom_right_title text,
  add column if not exists footer_modern_bottom_right_text text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'site_settings_footer_style_check'
      and conrelid = 'public.site_settings'::regclass
  ) then
    alter table public.site_settings
      add constraint site_settings_footer_style_check
      check (footer_style in ('classic', 'modern'));
  end if;
end;
$$;
