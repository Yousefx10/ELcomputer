begin;

-- Additive address book. Existing profile addresses and order snapshots stay intact.
create table public.customer_delivery_addresses (
  id uuid primary key,
  customer_id uuid not null references public.customer_profiles(id) on delete cascade,
  label text not null default '' check (length(label) <= 60 and label = btrim(label)),
  first_name text not null check (length(first_name) between 1 and 100 and first_name = btrim(first_name)),
  last_name text not null default '' check (length(last_name) <= 100 and last_name = btrim(last_name)),
  street_address text not null check (length(street_address) between 1 and 200 and street_address = btrim(street_address)),
  address_line_2 text not null default '' check (length(address_line_2) <= 200 and address_line_2 = btrim(address_line_2)),
  city text not null check (length(city) between 1 and 100 and city = btrim(city)),
  governorate text not null check (governorate = any(array[
    'Alexandria','Assuit','Aswan','Bani Suif','Behira','Cairo','Dakahlia','Damietta',
    'El Kalioubia','Fayoum','Gharbia','Giza','Ismailia','Kafr Alsheikh','Luxor',
    'Matrouh','Menya','Monufia','New Valley','North Coast','North Sinai','Port Said',
    'Qena','Red Sea','Sharqia','Sohag','South Sinai','Suez'
  ]::text[])),
  phone text not null check (phone ~ '^01[0-9]{9}$'),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_delivery_address_no_test_marker check (
    (street_address || ' ' || address_line_2) !~* '\msignup\s+isolation\s+[a-z]\M'
  ),
  constraint customer_delivery_address_no_control_characters check (
    (label || first_name || last_name || street_address || address_line_2 || city) !~ '[[:cntrl:]]'
  )
);
create index customer_delivery_addresses_customer_idx
  on public.customer_delivery_addresses(customer_id, created_at, id);
alter table public.customer_delivery_addresses enable row level security;
revoke all on public.customer_delivery_addresses from public, anon, authenticated, service_role;
grant select on public.customer_delivery_addresses to authenticated, service_role;
create policy customer_delivery_addresses_read_own on public.customer_delivery_addresses
  for select to authenticated using (
    customer_id = (select auth.uid()) and exists (
      select 1 from public.customer_profiles p where p.id = customer_id and p.is_active
    )
  );

-- Only the authenticated server boundary may supply the customer identity.
-- A profile row lock serializes the per-customer limit and revision decisions.
create function public.customer_save_delivery_address(
  p_customer_id uuid, p_id uuid, p_expected_revision integer, p_address jsonb
) returns jsonb language plpgsql security definer set search_path = '' set lock_timeout = '3s' as $$
declare
  v_existing public.customer_delivery_addresses%rowtype;
  v_saved public.customer_delivery_addresses%rowtype;
  v_address jsonb;
  v_keys text[] := array['label','first_name','last_name','street_address','address_line_2','city','governorate','phone'];
begin
  if p_id is null or p_customer_id is null or jsonb_typeof(p_address) is distinct from 'object'
    or (p_expected_revision is not null and p_expected_revision < 1) then
    raise exception 'Invalid saved address.' using errcode = '22023';
  end if;
  if exists(select 1 from jsonb_each(p_address) e
    where not(e.key = any(v_keys)) or jsonb_typeof(e.value) not in ('string','null')) then
    raise exception 'Invalid saved address.' using errcode = '22023';
  end if;
  select jsonb_object_agg(k, coalesce(p_address->>k, '')) into v_address from unnest(v_keys) k;
  perform 1 from public.customer_profiles where id = p_customer_id and is_active for update;
  if not found then raise exception 'Customer unavailable.' using errcode = '42501'; end if;
  select * into v_existing from public.customer_delivery_addresses
    where id = p_id and customer_id = p_customer_id for update;
  if found then
    -- Exact lost-acknowledgement retries return the existing receipt without writes.
    if (to_jsonb(v_existing) - array['id','customer_id','revision','created_at','updated_at']) = v_address then
      return to_jsonb(v_existing) - 'customer_id';
    end if;
    if p_expected_revision is null or p_expected_revision <> v_existing.revision then
      raise exception 'Saved address changed.' using errcode = '40001';
    end if;
    update public.customer_delivery_addresses set
      label = v_address->>'label', first_name = v_address->>'first_name',
      last_name = v_address->>'last_name', street_address = v_address->>'street_address',
      address_line_2 = v_address->>'address_line_2', city = v_address->>'city',
      governorate = v_address->>'governorate', phone = v_address->>'phone',
      revision = revision + 1, updated_at = clock_timestamp()
      where id = p_id and customer_id = p_customer_id returning * into v_saved;
  else
    if p_expected_revision is not null then
      raise exception 'Saved address unavailable.' using errcode = 'P0002';
    end if;
    if (select count(*) from public.customer_delivery_addresses where customer_id = p_customer_id) >= 20 then
      raise exception 'Saved address limit reached.' using errcode = '54000';
    end if;
    insert into public.customer_delivery_addresses(
      id, customer_id, label, first_name, last_name, street_address, address_line_2, city, governorate, phone
    ) values (
      p_id, p_customer_id, v_address->>'label', v_address->>'first_name', v_address->>'last_name',
      v_address->>'street_address', v_address->>'address_line_2', v_address->>'city',
      v_address->>'governorate', v_address->>'phone'
    ) returning * into v_saved;
  end if;
  return to_jsonb(v_saved) - 'customer_id';
end;
$$;
revoke all on function public.customer_save_delivery_address(uuid,uuid,integer,jsonb) from public, anon, authenticated;
grant execute on function public.customer_save_delivery_address(uuid,uuid,integer,jsonb) to service_role;

create function public.customer_remove_delivery_address(
  p_customer_id uuid, p_id uuid, p_expected_revision integer
) returns jsonb language plpgsql security definer set search_path = '' set lock_timeout = '3s' as $$
declare v_revision integer;
begin
  if p_id is null or p_customer_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'Invalid saved address.' using errcode = '22023';
  end if;
  perform 1 from public.customer_profiles where id = p_customer_id and is_active for update;
  if not found then raise exception 'Customer unavailable.' using errcode = '42501'; end if;
  select revision into v_revision from public.customer_delivery_addresses
    where id = p_id and customer_id = p_customer_id for update;
  if not found then raise exception 'Saved address unavailable.' using errcode = 'P0002'; end if;
  if p_expected_revision <> v_revision then
    raise exception 'Saved address changed.' using errcode = '40001';
  end if;
  delete from public.customer_delivery_addresses where id = p_id and customer_id = p_customer_id;
  return jsonb_build_object('id',p_id,'deleted',true);
end;
$$;
revoke all on function public.customer_remove_delivery_address(uuid,uuid,integer) from public, anon, authenticated;
grant execute on function public.customer_remove_delivery_address(uuid,uuid,integer) to service_role;

commit;
