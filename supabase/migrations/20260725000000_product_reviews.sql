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
    'treasury.edit', false
  );
$$;

update public.admin_users
set permissions = public.default_admin_permissions() || coalesce(permissions, '{}'::jsonb);

create table if not exists public.product_reviews (
  id uuid not null default gen_random_uuid(),
  product_id uuid not null,
  user_id uuid not null,
  rating smallint not null,
  review_text text not null,
  display_full_name boolean not null default false,
  created_at timestamp with time zone not null default now(),
  constraint product_reviews_pkey primary key (id),
  constraint product_reviews_product_id_fkey foreign key (product_id) references public.products (id) on delete cascade,
  constraint product_reviews_user_id_fkey foreign key (user_id) references public.customer_profiles (id) on delete cascade,
  constraint product_reviews_product_user_key unique (product_id, user_id),
  constraint product_reviews_rating_check check (rating between 1 and 5),
  constraint product_reviews_text_length_check check (
    char_length(btrim(review_text)) between 1 and 999
  )
);

create index if not exists product_reviews_product_created_idx
on public.product_reviews (product_id, created_at desc);

create index if not exists product_reviews_created_at_idx
on public.product_reviews (created_at desc);

create index if not exists product_reviews_user_created_idx
on public.product_reviews (user_id, created_at desc);

create or replace function public.sync_product_average_rating ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
begin
  if tg_op = 'DELETE' then
    v_product_id := old.product_id;
  else
    v_product_id := new.product_id;
  end if;

  update public.products
  set average_rating = coalesce((
    select round(avg(reviews.rating)::numeric, 2)
    from public.product_reviews as reviews
    where reviews.product_id = v_product_id
  ), 0)
  where id = v_product_id;

  if tg_op = 'UPDATE' then
    if old.product_id is distinct from new.product_id then
      update public.products
      set average_rating = coalesce((
        select round(avg(reviews.rating)::numeric, 2)
        from public.product_reviews as reviews
        where reviews.product_id = old.product_id
      ), 0)
      where id = old.product_id;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists product_reviews_sync_average_rating on public.product_reviews;

create trigger product_reviews_sync_average_rating
after insert or update of rating, product_id or delete
on public.product_reviews
for each row
execute function public.sync_product_average_rating();

alter table public.product_reviews enable row level security;

revoke all on table public.product_reviews from anon, authenticated;

commit;
