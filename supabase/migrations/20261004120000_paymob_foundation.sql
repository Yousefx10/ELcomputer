-- Local foundation only: no production application/migration during this task.
-- Private provider ledger. Existing orders, totals, statuses and RLS remain intact.
create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.customer_orders(id) on delete restrict,
  provider text not null default 'paymob' check (provider = 'paymob'),
  method text not null default 'card' check (method = 'card'),
  mode text not null check (mode in ('test', 'live')),
  integration_id bigint not null check (integration_id > 0),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency = 'EGP'),
  status text not null default 'initiated' check (status in ('initiated','pending','succeeded','failed','cancelled','expired')),
  intention_id text unique,
  provider_order_id text unique,
  client_secret text check (length(client_secret) <= 512),
  error_code text check (length(error_code) <= 80),
  expires_at timestamptz not null default now() + interval '30 minutes',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, provider)
);
create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.payment_attempts(id) on delete restrict,
  provider text not null check (provider = 'paymob'),
  transaction_id text not null,
  status text not null check (status in ('pending','succeeded','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, transaction_id)
);
create index payment_transactions_attempt_idx on public.payment_transactions(attempt_id);
alter table public.payment_attempts enable row level security;
alter table public.payment_transactions enable row level security;
revoke all on public.payment_attempts, public.payment_transactions from public, anon, authenticated;
grant select, insert, update on public.payment_attempts, public.payment_transactions to service_role;

create function public.commerce_claim_payment_attempt(p_order_id uuid, p_user_id uuid, p_mode text, p_integration_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.customer_orders%rowtype; v_attempt public.payment_attempts%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Server access required.'; end if;
  if p_mode is distinct from 'test' or p_integration_id is null or p_integration_id <= 0 then raise exception 'Gateway unavailable.'; end if;
  select * into v_order from public.customer_orders where id=p_order_id and user_id=p_user_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.is_preorder or v_order.payment_method is distinct from 'card' or v_order.currency is distinct from 'EGP'
    or v_order.total_amount <= 0 or v_order.payment_status not in ('pending','failed') or v_order.status not in ('pending_payment','on_hold') then
    raise exception 'Order is not payable.';
  end if;
  if not exists (select 1 from public.site_settings where key='default' and payment_card_enabled) then raise exception 'Card unavailable.'; end if;
  select * into v_attempt from public.payment_attempts where order_id=p_order_id and provider='paymob';
  if found then
    if v_attempt.amount_minor <> v_order.total_amount * 100 or v_attempt.currency <> v_order.currency then raise exception 'Order changed.'; end if;
    return jsonb_build_object('created',false,'attempt',to_jsonb(v_attempt));
  end if;
  insert into public.payment_attempts(order_id,mode,integration_id,amount_minor,currency)
    values(p_order_id,p_mode,p_integration_id,(v_order.total_amount * 100)::bigint,v_order.currency) returning * into v_attempt;
  return jsonb_build_object('created',true,'attempt',to_jsonb(v_attempt));
end;
$$;

create function public.commerce_store_payment_intention(p_attempt_id uuid,p_intention_id text,p_provider_order_id text,p_client_secret text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Server access required.'; end if;
  if p_intention_id is null or length(p_intention_id)>160 or p_intention_id not like 'pi_test_%'
    or p_provider_order_id is null or p_provider_order_id !~ '^[0-9]{1,18}$'
    or p_client_secret is null or p_client_secret not like 'egy_csk_test_%' then raise exception 'Invalid intention.'; end if;
  update public.payment_attempts set intention_id=p_intention_id,provider_order_id=p_provider_order_id,
    client_secret=p_client_secret,status='pending',error_code=null,updated_at=now()
    where id=p_attempt_id and mode='test' and status='initiated' and intention_id is null;
  if not found then raise exception 'Intention already recorded.'; end if;
end;
$$;

create function public.commerce_reconcile_payment_transaction(p_transaction jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_attempt public.payment_attempts%rowtype; v_order public.customer_orders%rowtype;
  v_existing public.payment_transactions%rowtype; v_status text := p_transaction->>'status';
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Server access required.'; end if;
  if v_status is null or v_status not in ('pending','succeeded','failed') or coalesce(p_transaction->>'mode','') not in ('test','live')
    or coalesce(p_transaction->>'transaction_id','') !~ '^[0-9]{1,18}$' then raise exception 'Invalid transaction.'; end if;
  -- Resolve from HMAC-covered Paymob order ID, never unsigned merchant_order_id/extras.
  select * into v_attempt from public.payment_attempts where provider='paymob' and provider_order_id=p_transaction->>'provider_order_id';
  if not found then raise exception 'Provider order not persisted yet.' using errcode='40001'; end if;
  -- Consistent order-before-attempt locking also serializes cancellation/amount changes.
  select * into v_order from public.customer_orders where id=v_attempt.order_id for update;
  select * into v_attempt from public.payment_attempts where id=v_attempt.id for update;
  if v_attempt.mode is distinct from p_transaction->>'mode' or v_attempt.integration_id is distinct from (p_transaction->>'integration_id')::bigint
    or v_attempt.amount_minor is distinct from (p_transaction->>'amount_minor')::bigint or v_attempt.currency is distinct from p_transaction->>'currency'
    or v_order.total_amount * 100 <> v_attempt.amount_minor or v_order.currency <> v_attempt.currency
    or v_order.payment_method <> 'card' or v_order.is_preorder then raise exception 'Payment context mismatch.'; end if;
  select * into v_existing from public.payment_transactions where provider='paymob' and transaction_id=p_transaction->>'transaction_id';
  if found and v_existing.attempt_id <> v_attempt.id then raise exception 'Transaction belongs to another payment.'; end if;
  insert into public.payment_transactions(attempt_id,provider,transaction_id,status)
    values(v_attempt.id,'paymob',p_transaction->>'transaction_id',v_status)
    on conflict(provider,transaction_id) do update set
      status=case when payment_transactions.status='succeeded' then 'succeeded'
        when excluded.status='pending' and payment_transactions.status='failed' then 'failed' else excluded.status end,
      updated_at=case when payment_transactions.status=excluded.status then payment_transactions.updated_at else now() end
    where payment_transactions.attempt_id=excluded.attempt_id;
  if not found then raise exception 'Transaction belongs to another payment.'; end if;
  if v_attempt.status='succeeded' then return; end if;
  if v_status='pending' and v_attempt.status in ('failed','cancelled','expired') then return; end if;
  update public.payment_attempts set status=v_status,updated_at=now(),
    paid_at=case when v_status='succeeded' then coalesce(paid_at,now()) else paid_at end,
    client_secret=case when v_status='succeeded' then null else client_secret end
    where id=v_attempt.id and status is distinct from v_status;
  -- Dormant LIVE settlement path. Foundation initiation/configuration cannot create live attempts.
  -- Tests exercise this only with isolated database fixtures, never Paymob/network credentials.
  if v_attempt.mode='live' then
    if v_order.status in ('cancelled','refunded') or v_order.payment_status='refunded' then
      update public.payment_attempts set error_code='order_requires_review' where id=v_attempt.id;
      return;
    end if;
    if v_status='succeeded' and v_order.payment_status<>'paid' then
      update public.customer_orders set payment_status='paid',paid_at=coalesce(paid_at,now()),
        amount_paid=total_amount,status=case when status='pending_payment' then 'processing' else status end,updated_at=now()
        where id=v_order.id;
    elsif v_status='failed' and v_order.payment_status='pending' then
      update public.customer_orders set payment_status='failed',updated_at=now() where id=v_order.id;
    end if;
  end if;
  -- TEST signals NEVER mark commerce orders paid, move status or trigger shipping/fulfillment.
end;
$$;

-- Keep unpaid online orders out of physical packing. Cash/manual workflow unaffected.
create function public.guard_unpaid_card_packing()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_order public.customer_orders%rowtype;
begin
  select * into v_order from public.customer_orders where id=new.order_id for update;
  if v_order.payment_method='card' and (v_order.payment_status<>'paid' or exists (
    select 1 from public.payment_attempts where order_id=v_order.id and mode='test')) then
    raise exception 'A verified live card payment is required before packing.';
  end if;
  return new;
end;
$$;
create trigger a_guard_unpaid_card_packing before insert on public.order_packing_sessions for each row execute function public.guard_unpaid_card_packing();

create function public.guard_card_order_progress()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.payment_attempts where order_id=old.id)
    and (new.total_amount is distinct from old.total_amount or new.currency is distinct from old.currency
      or new.user_id is distinct from old.user_id or new.payment_method is distinct from old.payment_method
      or new.is_preorder is distinct from old.is_preorder) then
    raise exception 'Gateway order financial context cannot change.';
  end if;
  if new.payment_method='card' then
    if exists (select 1 from public.payment_attempts where order_id=new.id and mode='test')
      and (new.payment_status='paid' or new.status not in ('pending_payment','on_hold','cancelled')) then
      raise exception 'Test gateway payments cannot fulfill commerce orders.';
    end if;
    -- Preserve unrelated edits to historical orders and the existing refund lifecycle.
    -- Reject new fulfillment transitions; a historical status is not payment proof.
    if new.payment_status<>'paid' and new.status not in ('pending_payment','on_hold','cancelled','refunded')
      and (new.status is distinct from old.status or new.payment_status is distinct from old.payment_status
        or new.payment_method is distinct from old.payment_method) then
      raise exception 'Card payment must be confirmed before fulfillment.';
    end if;
  end if;
  return new;
end;
$$;
create trigger a_guard_card_order_progress before update on public.customer_orders for each row execute function public.guard_card_order_progress();

revoke all on function public.commerce_claim_payment_attempt(uuid,uuid,text,bigint),public.commerce_store_payment_intention(uuid,text,text,text),public.commerce_reconcile_payment_transaction(jsonb),public.guard_unpaid_card_packing(),public.guard_card_order_progress() from public,anon,authenticated;
grant execute on function public.commerce_claim_payment_attempt(uuid,uuid,text,bigint),public.commerce_store_payment_intention(uuid,text,text,text),public.commerce_reconcile_payment_transaction(jsonb) to service_role;

-- Reset awareness preserves the existing explicit owner reset contract and FK safety.
alter function public.system_reset_tables(text) rename to system_reset_tables_before_paymob;
create function public.system_reset_tables(p_scope text) returns text[] language sql immutable set search_path = '' as $$
  with base as (select public.system_reset_tables_before_paymob(p_scope) as tables),
    ordered as (select tables, array_position(tables,'erp_stock_reservations') as pos from base)
  select case when p_scope in ('orders','commerce','full') then
    tables[1:pos-1] || array['payment_transactions','payment_attempts']::text[] || tables[pos:cardinality(tables)]
    else tables end from ordered;
$$;
revoke all on function public.system_reset_tables(text),public.system_reset_tables_before_paymob(text) from public,anon,authenticated;
