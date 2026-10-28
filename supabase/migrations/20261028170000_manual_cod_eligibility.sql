-- Cash collection is a separate, explicit capability. No existing option opens.
-- CARD uses the existing delivery rules; no provider/accounting/stock changes.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

alter table public.commerce_shipping_companies
 add column cod_collection_enabled boolean not null default false,
 add constraint shipping_manual_cod_collection_check
 check (not cod_collection_enabled or provider='manual');

create function private.require_manual_cod_collection(p_company uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.commerce_shipping_companies where id=p_company
  and is_active and checkout_enabled and provider='manual' and cod_collection_enabled for share;
 if not found then raise exception 'checkout:delivery';end if;
end $$;

-- Compose the current review without changing quote contents or fingerprints.
-- The established command checks durable receipts before running a fresh review.
do $$ declare d text; a text; begin
 d:=pg_get_functiondef('private.checkout_review(jsonb)'::regprocedure);
 a:='CREATE OR REPLACE FUNCTION private.checkout_review(';
 if position(a in d)<>1 then raise exception 'Review current checkout binding.';end if;
 execute replace(d,a,'CREATE OR REPLACE FUNCTION private.checkout_review_before_cash_collection(');
end $$;

create or replace function private.checkout_review(p_intent jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if p_intent#>>'{order,payment_method}'='cash' then
  perform private.require_manual_cod_collection((p_intent#>>'{order,shipping_company_id}')::uuid);
 end if;
 return private.checkout_review_before_cash_collection(p_intent);
end $$;

-- Keep the capability locked through insertion, including internal creators.
-- Historical internal cash records without checkout delivery retain their path.
create function private.guard_manual_cod_collection() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.payment_method='cash' and new.shipping_company_id is not null then
  perform private.require_manual_cod_collection(new.shipping_company_id);
 end if;
 return new;
end $$;
create trigger b_require_manual_cod_collection before insert on public.customer_orders
 for each row execute function private.guard_manual_cod_collection();

-- Reuse the exact physical-reservation return transaction for unfulfilled COD.
-- Cash received, packing, dispatch, shipped states and gateway attempts require
-- operational review. CARD cancellation and its reconciliation gates stay intact.
do $$ declare d text; a text; begin
 d:=pg_get_functiondef('private.release_unpaid_card_stock()'::regprocedure);
 a:='if new.status<>''cancelled'' or old.status=''cancelled'' or old.payment_method<>''card'' or not old.card_checkout_verified';
 if position(a in d)=0 then raise exception 'Review cancellation eligibility.';end if;
 d:=replace(d,a,$patch$
 if new.status='cancelled' and old.status<>'cancelled' and old.payment_method='cash' and not old.is_preorder then
  if old.payment_status<>'pending' or old.amount_paid<>0 or old.erp_owner<>'built_in'
   or old.stock_fulfillment_state<>'ready' or old.status not in ('pending_payment','processing','on_hold')
   or exists(select 1 from public.order_cod_collections where order_id=old.id)
   or exists(select 1 from public.payment_attempts where order_id=old.id) then
   raise exception 'Review cash, stock and delivery before cancellation.';
  end if;
 end if;
 if new.status<>'cancelled' or old.status='cancelled'
  or not (old.payment_method='cash' or (old.payment_method='card' and old.card_checkout_verified))
 $patch$);
 execute d;
end $$;

revoke all on function private.require_manual_cod_collection(uuid),
 private.checkout_review_before_cash_collection(jsonb),private.checkout_review(jsonb),
 private.guard_manual_cod_collection() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
