begin;

-- Reusable names keep existing product_specifications rows intact. Legacy labels
-- remain the fallback whenever definition_id is null or a definition is removed.
create table public.specification_definitions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  group_name text not null default '',
  aliases text[] not null default '{}',
  help_text text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  default_highlight boolean not null default false,
  created_at timestamptz not null default now(),
  constraint specification_definitions_key_check check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(key) <= 100),
  constraint specification_definitions_name_check check (char_length(btrim(name)) between 1 and 100),
  constraint specification_definitions_group_check check (char_length(group_name) <= 80),
  constraint specification_definitions_help_check check (char_length(help_text) <= 300),
  constraint specification_definitions_alias_count_check check (cardinality(aliases) <= 20)
);

create unique index specification_definitions_normalized_name_idx
  on public.specification_definitions (lower(btrim(name)));
create index specification_definitions_active_order_idx
  on public.specification_definitions (is_active, sort_order, name);

alter table public.product_specifications
  add column definition_id uuid references public.specification_definitions (id) on delete set null,
  add column is_highlight boolean not null default false;

create unique index product_specifications_product_definition_idx
  on public.product_specifications (product_id, definition_id)
  where definition_id is not null;

create table public.category_specification_templates (
  category_id uuid not null references public.categories (id) on delete cascade,
  definition_id uuid not null references public.specification_definitions (id) on delete cascade,
  sort_order integer not null default 0,
  highlight_default boolean not null default false,
  primary key (category_id, definition_id)
);

create index category_specification_templates_order_idx
  on public.category_specification_templates (category_id, sort_order, definition_id);

create table public.product_features (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  body text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint product_features_body_check check (char_length(btrim(body)) between 1 and 500)
);

create index product_features_product_order_idx
  on public.product_features (product_id, sort_order, created_at);

alter table public.specification_definitions enable row level security;
alter table public.category_specification_templates enable row level security;
alter table public.product_features enable row level security;

revoke all on public.specification_definitions, public.category_specification_templates,
  public.product_features from public, anon, authenticated;
grant select on public.specification_definitions to anon, authenticated;
grant insert, update, delete on public.specification_definitions to authenticated;
grant select, insert, update, delete on public.category_specification_templates to authenticated;
grant select on public.product_features to anon, authenticated;
grant insert, update, delete on public.product_features to authenticated;
grant all on public.specification_definitions, public.category_specification_templates,
  public.product_features to service_role;

create policy specification_definitions_read on public.specification_definitions
  for select to anon, authenticated using (true);
create policy specification_definitions_manage on public.specification_definitions
  for all to authenticated
  using (public.has_admin_permission('products.edit'))
  with check (public.has_admin_permission('products.edit'));

create policy category_specification_templates_read on public.category_specification_templates
  for select to authenticated
  using (public.has_admin_permission('products.view') or public.has_admin_permission('products.edit'));
create policy category_specification_templates_manage on public.category_specification_templates
  for all to authenticated
  using (public.has_admin_permission('products.edit'))
  with check (public.has_admin_permission('products.edit'));

create policy product_features_read on public.product_features
  for select to anon, authenticated
  using (
    exists (select 1 from public.products where products.id = product_features.product_id and products.is_published)
    or public.has_admin_permission('products.view')
    or public.has_admin_permission('products.edit')
  );
create policy product_features_manage on public.product_features
  for all to authenticated
  using (public.has_admin_permission('products.edit'))
  with check (public.has_admin_permission('products.edit'));

-- Starter vocabulary and category suggestions are data, not frontend rules.
-- Unknown categories can be configured later from the product editor.
insert into public.specification_definitions
  (key, name, group_name, aliases, sort_order, default_highlight)
values
  ('brand', 'Brand', 'General', array[]::text[], 10, false),
  ('model', 'Model', 'General', array[]::text[], 20, false),
  ('color', 'Color', 'Physical', array['Colour', 'Product Color', 'Product Colour'], 30, false),
  ('weight', 'Weight', 'Physical', array[]::text[], 40, false),
  ('dimensions', 'Dimensions', 'Physical', array['Size'], 50, false),
  ('warranty', 'Warranty', 'General', array[]::text[], 60, false),
  ('dpi', 'DPI', 'Performance', array['Dots Per Inch'], 70, true),
  ('polling-rate', 'Polling Rate', 'Performance', array['Report Rate'], 80, true),
  ('sensor-type', 'Sensor Type', 'Performance', array['Sensor'], 90, true),
  ('buttons', 'Buttons', 'Controls', array['Number of Buttons'], 100, true),
  ('connection-type', 'Connection Type', 'Connectivity', array['Connection', 'Connectivity'], 110, true),
  ('cable-length', 'Cable Length', 'Connectivity', array[]::text[], 120, false),
  ('layout', 'Layout', 'Controls', array[]::text[], 130, false),
  ('format', 'Format', 'Physical', array['Form Factor'], 140, false),
  ('keyboard-type', 'Keyboard Type', 'Controls', array[]::text[], 150, false),
  ('switch', 'Switch', 'Controls', array[]::text[], 160, false),
  ('switch-type', 'Switch Type', 'Controls', array[]::text[], 170, false),
  ('number-of-keys', 'Number of Keys', 'Controls', array['Keys'], 180, false),
  ('backlight', 'Backlight', 'Display', array['Lighting'], 190, true),
  ('processor', 'Processor', 'Performance', array['CPU'], 200, true),
  ('ram', 'RAM', 'Memory & Storage', array['Memory'], 210, true),
  ('storage', 'Storage', 'Memory & Storage', array['Capacity'], 220, true),
  ('gpu', 'GPU', 'Performance', array['Graphics Card'], 230, true),
  ('screen-size', 'Screen Size', 'Display', array['Display Size'], 240, true),
  ('screen-resolution', 'Screen Resolution', 'Display', array['Display Resolution'], 250, true),
  ('display-type', 'Display Type', 'Display', array['Panel Type'], 260, false),
  ('operating-system', 'Operating System', 'Software', array['OS'], 270, false),
  ('battery', 'Battery', 'Power', array[]::text[], 280, false),
  ('battery-capacity', 'Battery Capacity', 'Power', array[]::text[], 290, true),
  ('cameras', 'Cameras', 'Imaging', array['Camera'], 300, true),
  ('sim', 'SIM', 'Connectivity', array['SIM Type'], 310, false)
on conflict (key) do nothing;

with suggestions (category_pattern, definition_key, position, highlight_default) as (
  values
    ('(^|-)mouse(s)?($|-)|(^|-)mice($|-)', 'brand', 10, false),
    ('(^|-)mouse(s)?($|-)|(^|-)mice($|-)', 'model', 20, false),
    ('(^|-)mouse(s)?($|-)|(^|-)mice($|-)', 'sensor-type', 30, true),
    ('(^|-)mouse(s)?($|-)|(^|-)mice($|-)', 'dpi', 40, true),
    ('(^|-)mouse(s)?($|-)|(^|-)mice($|-)', 'polling-rate', 50, true),
    ('(^|-)mouse(s)?($|-)|(^|-)mice($|-)', 'buttons', 60, true),
    ('(^|-)mouse(s)?($|-)|(^|-)mice($|-)', 'connection-type', 70, true),
    ('(^|-)mouse(s)?($|-)|(^|-)mice($|-)', 'cable-length', 80, false),
    ('(^|-)mouse(s)?($|-)|(^|-)mice($|-)', 'color', 90, false),
    ('(^|-)mouse(s)?($|-)|(^|-)mice($|-)', 'weight', 100, false),
    ('(^|-)keyboard(s)?($|-)', 'brand', 10, false),
    ('(^|-)keyboard(s)?($|-)', 'model', 20, false),
    ('(^|-)keyboard(s)?($|-)', 'layout', 30, false),
    ('(^|-)keyboard(s)?($|-)', 'format', 40, false),
    ('(^|-)keyboard(s)?($|-)', 'keyboard-type', 50, false),
    ('(^|-)keyboard(s)?($|-)', 'switch', 55, false),
    ('(^|-)keyboard(s)?($|-)', 'switch-type', 60, true),
    ('(^|-)keyboard(s)?($|-)', 'number-of-keys', 70, true),
    ('(^|-)keyboard(s)?($|-)', 'backlight', 80, true),
    ('(^|-)keyboard(s)?($|-)', 'connection-type', 90, true),
    ('(^|-)keyboard(s)?($|-)', 'cable-length', 95, false),
    ('(^|-)keyboard(s)?($|-)', 'dimensions', 100, false),
    ('(^|-)keyboard(s)?($|-)', 'weight', 110, false),
    ('(^|-)laptop(s)?($|-)|(^|-)notebook(s)?($|-)', 'brand', 10, false),
    ('(^|-)laptop(s)?($|-)|(^|-)notebook(s)?($|-)', 'model', 20, false),
    ('(^|-)laptop(s)?($|-)|(^|-)notebook(s)?($|-)', 'processor', 30, true),
    ('(^|-)laptop(s)?($|-)|(^|-)notebook(s)?($|-)', 'ram', 40, true),
    ('(^|-)laptop(s)?($|-)|(^|-)notebook(s)?($|-)', 'storage', 50, true),
    ('(^|-)laptop(s)?($|-)|(^|-)notebook(s)?($|-)', 'gpu', 60, true),
    ('(^|-)laptop(s)?($|-)|(^|-)notebook(s)?($|-)', 'screen-size', 70, true),
    ('(^|-)laptop(s)?($|-)|(^|-)notebook(s)?($|-)', 'screen-resolution', 80, true),
    ('(^|-)laptop(s)?($|-)|(^|-)notebook(s)?($|-)', 'display-type', 85, false),
    ('(^|-)laptop(s)?($|-)|(^|-)notebook(s)?($|-)', 'operating-system', 90, false),
    ('(^|-)laptop(s)?($|-)|(^|-)notebook(s)?($|-)', 'battery', 100, false),
    ('(^|-)phone(s)?($|-)|(^|-)smartphone(s)?($|-)', 'brand', 10, false),
    ('(^|-)phone(s)?($|-)|(^|-)smartphone(s)?($|-)', 'model', 20, false),
    ('(^|-)phone(s)?($|-)|(^|-)smartphone(s)?($|-)', 'processor', 30, true),
    ('(^|-)phone(s)?($|-)|(^|-)smartphone(s)?($|-)', 'ram', 40, true),
    ('(^|-)phone(s)?($|-)|(^|-)smartphone(s)?($|-)', 'storage', 50, true),
    ('(^|-)phone(s)?($|-)|(^|-)smartphone(s)?($|-)', 'screen-size', 60, true),
    ('(^|-)phone(s)?($|-)|(^|-)smartphone(s)?($|-)', 'display-type', 65, false),
    ('(^|-)phone(s)?($|-)|(^|-)smartphone(s)?($|-)', 'cameras', 70, true),
    ('(^|-)phone(s)?($|-)|(^|-)smartphone(s)?($|-)', 'battery-capacity', 80, true),
    ('(^|-)phone(s)?($|-)|(^|-)smartphone(s)?($|-)', 'sim', 90, false),
    ('(^|-)phone(s)?($|-)|(^|-)smartphone(s)?($|-)', 'operating-system', 95, false),
    ('(^|-)phone(s)?($|-)|(^|-)smartphone(s)?($|-)', 'color', 100, false)
)
insert into public.category_specification_templates (category_id, definition_id, sort_order, highlight_default)
select categories.id, definitions.id, suggestions.position, suggestions.highlight_default
from public.categories as categories
join suggestions on lower(categories.slug) ~ suggestions.category_pattern
join public.specification_definitions as definitions on definitions.key = suggestions.definition_key
on conflict (category_id, definition_id) do nothing;

-- Extend the existing strict reset scope without replacing support/chat wrappers.
alter function public.system_reset_tables(text) rename to system_reset_tables_before_specifications;
create function public.system_reset_tables(p_scope text)
returns text[] language sql immutable set search_path = '' as $$
  select case when p_scope in ('products', 'full') then
    public.system_reset_tables_before_specifications(p_scope) ||
      array['product_features', 'category_specification_templates', 'specification_definitions']::text[]
  else public.system_reset_tables_before_specifications(p_scope) end;
$$;
revoke all on function public.system_reset_tables(text) from public, anon, authenticated;
revoke all on function public.system_reset_tables_before_specifications(text) from public, anon, authenticated;

commit;
