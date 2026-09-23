alter table public.site_settings
  add column if not exists payment_card_enabled boolean not null default false,
  add column if not exists payment_card_fee numeric(12, 2) not null default 0,
  add column if not exists payment_bank_transfer_enabled boolean not null default false,
  add column if not exists payment_bank_transfer_fee numeric(12, 2) not null default 0,
  add column if not exists payment_bank_transfer_instructions text,
  add column if not exists payment_instapay_enabled boolean not null default false,
  add column if not exists payment_instapay_fee numeric(12, 2) not null default 0,
  add column if not exists payment_instapay_instructions text,
  add column if not exists payment_paypal_enabled boolean not null default false,
  add column if not exists payment_paypal_fee numeric(12, 2) not null default 0,
  add column if not exists payment_cash_enabled boolean not null default true,
  add column if not exists payment_cash_fee numeric(12, 2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'site_settings_payment_fees_check'
      and conrelid = 'public.site_settings'::regclass
  ) then
    alter table public.site_settings
      add constraint site_settings_payment_fees_check check (
        payment_card_fee >= 0
        and payment_bank_transfer_fee >= 0
        and payment_instapay_fee >= 0
        and payment_paypal_fee >= 0
        and payment_cash_fee >= 0
      );
  end if;
end;
$$;

alter table public.customer_orders
  add column if not exists payment_fee_amount numeric(12, 2) not null default 0,
  add column if not exists payment_proof_status text not null default 'not_required',
  add column if not exists payment_proof_file_name text,
  add column if not exists payment_proof_uploaded_at timestamp with time zone,
  add column if not exists payment_proof_reviewed_at timestamp with time zone;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'customer_orders_payment_fee_amount_check'
      and conrelid = 'public.customer_orders'::regclass
  ) then
    alter table public.customer_orders
      add constraint customer_orders_payment_fee_amount_check
      check (payment_fee_amount >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'customer_orders_payment_proof_status_check'
      and conrelid = 'public.customer_orders'::regclass
  ) then
    alter table public.customer_orders
      add constraint customer_orders_payment_proof_status_check
      check (payment_proof_status in (
        'not_required',
        'pending_upload',
        'under_review',
        'approved',
        'rejected'
      ));
  end if;
end;
$$;

create or replace function public.storefront_prepare_order_payment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_settings public.site_settings%rowtype;
  v_method text := lower(btrim(coalesce(new.payment_method, '')));
  v_enabled boolean := false;
  v_fee numeric(12, 2) := 0;
begin
  select settings.*
  into v_settings
  from public.site_settings as settings
  where settings.key = 'default';

  if not found then
    if v_method in ('', 'cash') then
      new.payment_method := 'cash';
      new.payment_fee_amount := 0;
      new.payment_proof_status := 'not_required';
      return new;
    end if;

    raise exception 'Store payment settings are unavailable.';
  end if;

  -- Keep the currently deployed checkout compatible while the new two-step
  -- frontend is rolled out. The new server route requires an explicit method.
  if v_method = '' then
    v_method := 'cash';
  end if;

  case v_method
    when 'card' then
      v_enabled := v_settings.payment_card_enabled;
      v_fee := v_settings.payment_card_fee;
    when 'bank_transfer' then
      v_enabled := v_settings.payment_bank_transfer_enabled;
      v_fee := v_settings.payment_bank_transfer_fee;
    when 'instapay' then
      v_enabled := v_settings.payment_instapay_enabled;
      v_fee := v_settings.payment_instapay_fee;
    when 'paypal' then
      v_enabled := v_settings.payment_paypal_enabled;
      v_fee := v_settings.payment_paypal_fee;
    when 'cash' then
      v_enabled := v_settings.payment_cash_enabled;
      v_fee := v_settings.payment_cash_fee;
    else
      raise exception 'Choose a valid payment method.';
  end case;

  if not coalesce(v_enabled, false) then
    raise exception 'The selected payment method is not available.';
  end if;

  new.payment_method := v_method;
  new.payment_fee_amount := round(greatest(coalesce(v_fee, 0), 0)::numeric, 2);
  new.total_amount := round((coalesce(new.total_amount, 0) + new.payment_fee_amount)::numeric, 2);
  new.payment_proof_status := case
    when v_method in ('bank_transfer', 'instapay') then 'pending_upload'
    else 'not_required'
  end;

  return new;
end;
$$;

drop trigger if exists customer_orders_prepare_payment on public.customer_orders;

create trigger customer_orders_prepare_payment
before insert on public.customer_orders
for each row
execute function public.storefront_prepare_order_payment();

revoke all on function public.storefront_prepare_order_payment() from public, anon, authenticated;
