begin;

create or replace function public.default_admin_permissions ()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'dashboard.view', false,
    'dashboard.analysis', false,
    'dashboard.orders', false,
    'products.view', false,
    'products.add', false,
    'products.edit', false,
    'categories.view', false,
    'categories.add', false,
    'categories.edit', false,
    'brands.view', false,
    'brands.add', false,
    'brands.edit', false,
    'reviews.view', false,
    'reviews.delete', false,
    'settings.view', false,
    'settings.edit', false,
    'settings.coupons', false,
    'users.view', false,
    'hr.view', false,
    'hr.edit', false,
    'treasury.view', false,
    'treasury.edit', false,
    'documents.view', false,
    'documents.manage', false
  );
$$;

update public.admin_users
set permissions = public.default_admin_permissions() || coalesce(permissions, '{}'::jsonb);

create table if not exists public.document_folders (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid null references public.document_folders (id) on delete cascade,
  name text not null,
  is_restricted boolean not null default false,
  created_by uuid null references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_folders_name_check check (
    char_length(btrim(name)) between 1 and 120
    and name !~ '[/\\]'
    and btrim(name) not in ('.', '..')
  )
);

create unique index if not exists document_folders_root_name_uidx
on public.document_folders (lower(name))
where parent_id is null;

create unique index if not exists document_folders_parent_name_uidx
on public.document_folders (parent_id, lower(name))
where parent_id is not null;

create index if not exists document_folders_parent_name_idx
on public.document_folders (parent_id, name);

create table if not exists public.document_folder_permissions (
  folder_id uuid not null references public.document_folders (id) on delete cascade,
  admin_user_id uuid not null references public.admin_users (id) on delete cascade,
  access_level text not null default 'viewer',
  granted_by uuid null references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (folder_id, admin_user_id),
  constraint document_folder_permissions_access_check check (
    access_level in ('viewer', 'editor')
  )
);

create index if not exists document_folder_permissions_admin_idx
on public.document_folder_permissions (admin_user_id, folder_id);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid null references public.document_folders (id) on delete cascade,
  name text not null,
  storage_path text not null unique,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  created_by uuid null references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_name_check check (
    char_length(btrim(name)) between 1 and 240
    and name !~ '[/\\]'
    and btrim(name) not in ('.', '..')
  ),
  constraint documents_size_check check (size_bytes >= 0)
);

create index if not exists documents_folder_updated_idx
on public.documents (folder_id, updated_at desc);

alter table public.document_folders enable row level security;
alter table public.document_folder_permissions enable row level security;
alter table public.documents enable row level security;

revoke all on table public.document_folders from anon, authenticated;
revoke all on table public.document_folder_permissions from anon, authenticated;
revoke all on table public.documents from anon, authenticated;

grant select, insert, update, delete on table public.document_folders to service_role;
grant select, insert, update, delete on table public.document_folder_permissions to service_role;
grant select, insert, update, delete on table public.documents to service_role;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'admin-documents',
  'admin-documents',
  false,
  26214400,
  null
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
