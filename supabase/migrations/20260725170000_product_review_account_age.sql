begin;

create or replace function public.enforce_product_review_account_eligibility ()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_created_at timestamp with time zone;
begin
  select users.created_at
  into v_account_created_at
  from auth.users as users
  where users.id = new.user_id;

  if v_account_created_at is null then
    raise exception using
      errcode = 'P0001',
      message = 'PRODUCT_REVIEW_ACCOUNT_NOT_FOUND';
  end if;

  if v_account_created_at > pg_catalog.statement_timestamp() - interval '1 hour' then
    perform orders.id
    from public.customer_orders as orders
    where orders.user_id = new.user_id
      and orders.status in ('completed', 'delivered')
    limit 1
    for share;

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'PRODUCT_REVIEW_ACCOUNT_TOO_NEW';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists product_reviews_enforce_account_eligibility
on public.product_reviews;

create trigger product_reviews_enforce_account_eligibility
before insert on public.product_reviews
for each row
execute function public.enforce_product_review_account_eligibility();

revoke all on function public.enforce_product_review_account_eligibility ()
from public, anon, authenticated;

commit;
