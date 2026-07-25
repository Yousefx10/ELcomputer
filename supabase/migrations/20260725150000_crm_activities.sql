begin;

create index if not exists commerce_crm_accounts_entity_name_idx
on public.commerce_crm_accounts (entity_type, name, id);

create table if not exists public.commerce_crm_activities (
  id uuid not null default gen_random_uuid(),
  crm_account_id uuid not null,
  activity_type text not null,
  status text not null,
  subject text not null,
  notes text null,
  priority text null,
  occurred_at timestamp with time zone not null,
  closed_at timestamp with time zone null,
  effective_at timestamp with time zone
    generated always as (coalesce(closed_at, occurred_at)) stored,
  resolution text null,
  created_by uuid null,
  closed_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint commerce_crm_activities_pkey primary key (id),
  constraint commerce_crm_activities_crm_account_id_fkey
    foreign key (crm_account_id)
    references public.commerce_crm_accounts (id)
    on delete restrict,
  constraint commerce_crm_activities_created_by_fkey
    foreign key (created_by)
    references public.admin_users (id)
    on delete set null,
  constraint commerce_crm_activities_closed_by_fkey
    foreign key (closed_by)
    references public.admin_users (id)
    on delete set null,
  constraint commerce_crm_activities_type_check
    check (activity_type in ('call', 'case')),
  constraint commerce_crm_activities_status_check
    check (status in ('completed', 'raised', 'closed')),
  constraint commerce_crm_activities_priority_check
    check (
      priority is null
      or priority in ('low', 'normal', 'high', 'urgent')
    ),
  constraint commerce_crm_activities_subject_check
    check (
      char_length(btrim(subject)) between 1 and 200
    ),
  constraint commerce_crm_activities_notes_check
    check (
      notes is null
      or char_length(btrim(notes)) between 1 and 5000
    ),
  constraint commerce_crm_activities_resolution_check
    check (
      resolution is null
      or char_length(btrim(resolution)) between 1 and 5000
    ),
  constraint commerce_crm_activities_lifecycle_check
    check (
      (
        activity_type = 'call'
        and status = 'completed'
        and priority is null
        and closed_at is null
        and closed_by is null
        and resolution is null
      )
      or (
        activity_type = 'case'
        and priority is not null
        and (
          (
            status = 'raised'
            and closed_at is null
            and closed_by is null
            and resolution is null
          )
          or (
            status = 'closed'
            and closed_at is not null
            and closed_at >= occurred_at
          )
        )
      )
    )
);

create index if not exists commerce_crm_activities_occurred_idx
on public.commerce_crm_activities (occurred_at desc, id desc);

create index if not exists commerce_crm_activities_effective_idx
on public.commerce_crm_activities (effective_at desc, id desc);

create index if not exists commerce_crm_activities_account_effective_idx
on public.commerce_crm_activities (
  crm_account_id,
  effective_at desc,
  id desc
);

create index if not exists commerce_crm_activities_type_status_effective_idx
on public.commerce_crm_activities (
  activity_type,
  status,
  effective_at desc,
  id desc
);

create index if not exists commerce_crm_activities_open_cases_idx
on public.commerce_crm_activities (
  crm_account_id,
  occurred_at desc,
  id desc
)
where activity_type = 'case'
  and status = 'raised';

create or replace function public.enforce_commerce_crm_activity_transition ()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Preserve activity history when an admin account is removed. The foreign
  -- keys may only clear their attribution columns; no activity data can change.
  if new.id is not distinct from old.id
    and new.crm_account_id is not distinct from old.crm_account_id
    and new.activity_type is not distinct from old.activity_type
    and new.status is not distinct from old.status
    and new.subject is not distinct from old.subject
    and new.notes is not distinct from old.notes
    and new.priority is not distinct from old.priority
    and new.occurred_at is not distinct from old.occurred_at
    and new.closed_at is not distinct from old.closed_at
    and new.resolution is not distinct from old.resolution
    and new.created_at is not distinct from old.created_at
    and new.updated_at is not distinct from old.updated_at
    and (
      new.created_by is not distinct from old.created_by
      or (old.created_by is not null and new.created_by is null)
    )
    and (
      new.closed_by is not distinct from old.closed_by
      or (old.closed_by is not null and new.closed_by is null)
    )
    and (
      new.created_by is distinct from old.created_by
      or new.closed_by is distinct from old.closed_by
    ) then
    new.updated_at := old.updated_at;
    return new;
  end if;

  if old.activity_type <> 'case'
    or old.status <> 'raised'
    or new.activity_type <> 'case'
    or new.status <> 'closed' then
    raise exception using
      errcode = 'P0001',
      message = 'CRM activities are immutable except when closing a raised case.';
  end if;

  if new.id is distinct from old.id
    or new.crm_account_id is distinct from old.crm_account_id
    or new.subject is distinct from old.subject
    or new.notes is distinct from old.notes
    or new.priority is distinct from old.priority
    or new.occurred_at is distinct from old.occurred_at
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = 'P0001',
      message = 'A raised case cannot be rewritten while it is being closed.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists commerce_crm_activities_enforce_transition
on public.commerce_crm_activities;

create trigger commerce_crm_activities_enforce_transition
before update on public.commerce_crm_activities
for each row
execute function public.enforce_commerce_crm_activity_transition();

create or replace function public.commerce_crm_get_activity_stats ()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'calls',
    count(*) filter (where activity_type = 'call'),
    'raisedCases',
    count(*) filter (
      where activity_type = 'case'
        and status = 'raised'
    ),
    'closedCases',
    count(*) filter (
      where activity_type = 'case'
        and status = 'closed'
    )
  )
  from public.commerce_crm_activities;
$$;

alter table public.commerce_crm_activities enable row level security;

revoke all on table public.commerce_crm_activities
from public, anon, authenticated;

grant select, insert, update
on table public.commerce_crm_activities
to service_role;

revoke delete, truncate
on table public.commerce_crm_activities
from service_role;

revoke all on function public.enforce_commerce_crm_activity_transition ()
from public, anon, authenticated;

grant execute on function public.enforce_commerce_crm_activity_transition ()
to service_role;

revoke all on function public.commerce_crm_get_activity_stats ()
from public, anon, authenticated;

grant execute on function public.commerce_crm_get_activity_stats ()
to service_role;

commit;
