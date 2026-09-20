begin;

-- Customers may edit their contact details, but account state and stored value
-- must remain controlled by trusted server-side operations.
create or replace function public.guard_customer_profile_protected_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.wallet_balance is distinct from 0::numeric
      or new.is_active is distinct from true then
      raise exception 'Customer account fields cannot be changed.'
        using errcode = '42501';
    end if;
  elsif new.wallet_balance is distinct from old.wallet_balance
    or new.is_active is distinct from old.is_active then
    raise exception 'Customer account fields cannot be changed.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists customer_profiles_guard_protected_fields
  on public.customer_profiles;
create trigger customer_profiles_guard_protected_fields
before insert or update on public.customer_profiles
for each row execute function public.guard_customer_profile_protected_fields();

commit;
