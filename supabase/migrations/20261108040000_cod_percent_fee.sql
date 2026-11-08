-- Owner request (Phase 4): the cash on delivery fee can be a percentage of the order value,
-- managed in Dashboard → Settings → Payments. COD fee = the fixed fee + the percentage of the
-- order value (products after discounts, plus delivery), rounded up to the nearest pound.
-- With the percentage at 0 every quote, order and total stays exactly as before.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

alter table public.site_settings
 add column payment_cash_fee_percent numeric(5,2) not null default 0,
 add constraint site_settings_payment_cash_fee_percent_check check (payment_cash_fee_percent between 0 and 10);
comment on column public.site_settings.payment_cash_fee_percent is
 'Cash on delivery fee as a percent of the order value (products after discounts plus delivery), added to payment_cash_fee and rounded up to a whole pound.';

-- Checkout review: the quote shows the same fee the order will store.
alter function private.checkout_review(jsonb) rename to checkout_review_before_cod_percent;
create function private.checkout_review(p_intent jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare review jsonb:=private.checkout_review_before_cod_percent(p_intent); pct numeric; base numeric; fee numeric:=0;
begin
 if p_intent#>>'{order,payment_method}' is distinct from 'cash' or coalesce((review->>'isPreorder')::boolean,false) then return review;end if;
 select s.payment_cash_fee_percent into pct from public.site_settings s where s.key='default';
 base:=(review->>'totalAmount')::numeric-coalesce((review->>'paymentFee')::numeric,0);
 if coalesce(pct,0)>0 and base>0 then fee:=ceil(base*pct/100);end if;
 if fee<=0 then return review;end if;
 return review||jsonb_build_object('paymentFee',coalesce((review->>'paymentFee')::numeric,0)+fee,
  'totalAmount',(review->>'totalAmount')::numeric+fee,'requiredNow',(review->>'requiredNow')::numeric+fee);
end $$;
revoke all on function private.checkout_review_before_cod_percent(jsonb),private.checkout_review(jsonb) from public,anon,authenticated,service_role;

-- Order insert: the cash order total already holds products, discounts and delivery here
-- (customer_orders_prepare_cod_shipping runs first), so the same base gives the same fee.
create or replace function public.storefront_prepare_order_payment() returns trigger
language plpgsql set search_path to '' as $function$
declare
  v_settings public.site_settings%rowtype;
  v_method text := lower(btrim(coalesce(new.payment_method, '')));
  v_enabled boolean := false;
  v_fee numeric(12, 2) := 0;
begin
  if new.checkout_session_id is not null then
   perform private.checkout_funded(new.checkout_session_id);
   select (s.snapshot#>>'{review,paymentFee}')::numeric,(s.snapshot#>>'{review,totalAmount}')::numeric
    into new.payment_fee_amount,new.total_amount from private.payment_checkout_sessions s where s.id=new.checkout_session_id;
   new.payment_proof_status:=case when new.payment_method='instapay' then 'approved' else 'not_required' end;return new;
  end if;

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
      v_fee := greatest(coalesce(v_settings.payment_cash_fee, 0), 0)
        + case when coalesce(v_settings.payment_cash_fee_percent, 0) > 0 and coalesce(new.is_preorder, false) is false and coalesce(new.total_amount, 0) > 0
            then ceil(new.total_amount * v_settings.payment_cash_fee_percent / 100) else 0 end;
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
$function$;

notify pgrst,'reload schema';
commit;
