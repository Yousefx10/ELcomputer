-- 86: reuse the reviewed COD stock/delivery transaction for card checkout.
-- No settings, identities, inventory or provider credentials are enabled/seeded.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table public.customer_orders add column card_checkout_verified boolean not null default false;

do $$ declare definition text; anchor text; name text; begin
 definition:=pg_get_functiondef('private.checkout_review(jsonb)'::regprocedure);
 anchor:='if p_intent#>>''{order,payment_method}''<>''cash'' then return review;end if;';
 if position(anchor in definition)=0 then raise exception 'Review checkout stock/delivery guard.';end if;
 definition:=replace(definition,anchor,'if p_intent#>>''{order,payment_method}'' not in (''cash'',''card'') then return review;end if;');
 execute replace(definition,'COD requires ready stock in the built-in inventory.','Purchase requires ready stock in the built-in inventory.');
 definition:=pg_get_functiondef('private.prepare_cod_shipping()'::regprocedure);
 anchor:='new.payment_method is distinct from ''cash''';
 if position(anchor in definition)=0 then raise exception 'Review shipping insert guard.';end if;
 definition:=replace(definition,anchor,'new.payment_method not in (''cash'',''card'')');
 anchor:='new.shipping_company_name:=shipping->>''companyName'';';
 if position(anchor in definition)=0 then raise exception 'Review shipping snapshot.';end if;
 execute replace(definition,anchor,'new.card_checkout_verified:=(new.payment_method=''card'');'||E'\n '||anchor);
 foreach name in array array['quote','command'] loop
  definition:=pg_get_functiondef(case when name='quote' then 'public.commerce_checkout_quote(uuid,uuid,jsonb,jsonb)'::regprocedure
   else 'public.commerce_checkout_command(uuid,uuid,uuid,jsonb,jsonb)'::regprocedure end);
  anchor:='lower(btrim(p_order->>''payment_method''))=''cash''';
  if position(anchor in definition)=0 then raise exception 'Review confirmed identity guard.';end if;
  definition:=replace(definition,anchor,'lower(btrim(p_order->>''payment_method'')) in (''cash'',''card'')');
  if name='command' then
   anchor:='intent#>>''{order,payment_method}''=''cash''';
   if position(anchor in definition)=0 then raise exception 'Review physical stock allocation.';end if;
   definition:=replace(definition,anchor,'intent#>>''{order,payment_method}'' in (''cash'',''card'')');
  end if;
  execute definition;
 end loop;
end $$;

create or replace function public.commerce_claim_payment_attempt(p_order_id uuid,p_user_id uuid,p_mode text,p_integration_id bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.customer_orders%rowtype; a public.payment_attempts%rowtype;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server access required.';end if;
 if p_mode is null or p_mode not in ('test','live') or p_integration_id is null or p_integration_id<=0 then raise exception 'Gateway unavailable.';end if;
 select * into o from public.customer_orders where id=p_order_id and user_id=p_user_id for update;
 if not found then raise exception 'Order not found.';end if;
 if o.is_preorder or o.payment_method is distinct from 'card' or o.currency is distinct from 'EGP' or o.total_amount<=0
  or o.payment_status not in ('pending','failed') or o.status not in ('pending_payment','on_hold') then raise exception 'Order is not payable.';end if;
 if not exists(select 1 from public.site_settings where key='default' and payment_card_enabled) then raise exception 'Card unavailable.';end if;
 if p_mode='live' then
  perform private.checkout_authorize(p_user_id);perform private.cod_authorize(p_user_id);
  if not o.card_checkout_verified or o.shipping_company_id is null then raise exception 'Review a new checkout before live payment.';end if;
 end if;
 select * into a from public.payment_attempts where order_id=o.id and provider='paymob';
 if found then
  if a.amount_minor<>o.total_amount*100 or a.currency<>o.currency or a.mode<>p_mode or a.integration_id<>p_integration_id then raise exception 'Payment context changed.';end if;
  return jsonb_build_object('created',false,'attempt',to_jsonb(a));
 end if;
 insert into public.payment_attempts(order_id,mode,integration_id,amount_minor,currency)
 values(o.id,p_mode,p_integration_id,(o.total_amount*100)::bigint,o.currency) returning * into a;
 return jsonb_build_object('created',true,'attempt',to_jsonb(a));
end $$;

create or replace function public.commerce_store_payment_intention(p_attempt_id uuid,p_intention_id text,p_provider_order_id text,p_client_secret text)
returns void language plpgsql security definer set search_path='' as $$
declare a public.payment_attempts%rowtype;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server access required.';end if;
 select * into a from public.payment_attempts where id=p_attempt_id for update;
 if not found or a.status<>'initiated' or a.intention_id is not null then raise exception 'Intention already recorded.';end if;
 if p_intention_id is null or length(p_intention_id)>160 or p_intention_id !~ ('^pi_'||a.mode||'_.+$')
  or p_provider_order_id is null or p_provider_order_id !~ '^[0-9]{1,18}$' or p_client_secret is null or length(p_client_secret)>512
  or p_client_secret !~ ('^(egy_)?csk_'||a.mode||'_.+$') then raise exception 'Invalid intention.';end if;
 update public.payment_attempts set intention_id=p_intention_id,provider_order_id=p_provider_order_id,client_secret=p_client_secret,
  status='pending',error_code=null,updated_at=now() where id=a.id;
end $$;

-- Preserve all established accounting/test/fulfillment guards. Freeze the new
-- attestation and the saved delivery amount/identity once payment has started.
create function private.guard_card_checkout_snapshot() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.card_checkout_verified is distinct from old.card_checkout_verified or
  (exists(select 1 from public.payment_attempts where order_id=old.id) and
   (new.shipping_company_id is distinct from old.shipping_company_id or new.shipping_fee_amount is distinct from old.shipping_fee_amount)) then
  raise exception 'Gateway order checkout context cannot change.';
 end if;
 return new;
end $$;
create trigger a_guard_card_checkout_snapshot before update on public.customer_orders for each row execute function private.guard_card_checkout_snapshot();
revoke all on function private.guard_card_checkout_snapshot() from public,anon,authenticated,service_role;
revoke all on function public.commerce_claim_payment_attempt(uuid,uuid,text,bigint),public.commerce_store_payment_intention(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.commerce_claim_payment_attempt(uuid,uuid,text,bigint),public.commerce_store_payment_intention(uuid,text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
