-- Authentication presentation and provider visibility on the existing public settings row.
alter table public.site_settings
  add column if not exists auth_page_layout text not null default 'split'
    check (auth_page_layout in ('split', 'centered', 'reversed')),
  add column if not exists auth_image_light_url text,
  add column if not exists auth_image_dark_url text,
  add column if not exists auth_image_position text not null default 'center'
    check (auth_image_position in ('left', 'center', 'right')),
  add column if not exists auth_show_visual_text boolean not null default true,
  add column if not exists auth_visual_eyebrow text,
  add column if not exists auth_visual_headline text,
  add column if not exists auth_visual_supporting_text text,
  add column if not exists auth_login_heading text,
  add column if not exists auth_login_supporting_text text,
  add column if not exists auth_signup_heading text,
  add column if not exists auth_signup_supporting_text text,
  add column if not exists auth_facebook_enabled boolean not null default false;
