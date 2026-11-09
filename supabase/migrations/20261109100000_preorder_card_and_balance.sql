-- Card and Apple Pay pre-orders: the deposit or full amount at checkout, the balance later.
-- Both switches start off. Existing attempts, orders, stock and provider settings are untouched.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table public.site_settings add column payment_preorder_card_enabled boolean not null default false;
-- How the remaining balance is collected. A store can change this in the Dashboard at any time.
alter table public.site_settings add column payment_preorder_balance_mode text not null default 'staff' check(payment_preorder_balance_mode in ('online','staff'));

create function pg_temp.preorder_patch(d text,a text,b text) returns text language plpgsql as $$
begin
 if position(a in d)=0 or (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'Review preorder function preimage.';end if;
 return replace(d,a,b);
end $$;

create function private.validate_preorder_capacity(p_intent jsonb,p_cart uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare p public.products; requested bigint; accepted bigint; held bigint;
 customer uuid:=nullif(current_setting('app.checkout_customer_id',true),'')::uuid;
begin
 if customer is null then raise exception 'checkout:permission' using errcode='42501';end if;
 for p in select * from public.products where id in (select (value->>'product_id')::uuid from jsonb_array_elements(p_intent->'items')) order by id for update loop
  if not p.is_published or p.selling_mode<>'preorder' or not p.preorder_active
   or p.preorder_starts_at>clock_timestamp() or p.preorder_ends_at<=clock_timestamp() then raise exception 'preorder:unavailable';end if;
  select sum((value->>'quantity')::int) into requested from jsonb_array_elements(p_intent->'items') where (value->>'product_id')::uuid=p.id;
  select coalesce(sum(i.quantity),0) into accepted from public.customer_order_items i join public.customer_orders o on o.id=i.order_id
   where i.product_id=p.id and i.is_preorder and o.status not in ('cancelled','refunded');
  select coalesce(sum((i->>'quantity')::int),0) into held from private.payment_checkout_sessions s
   join private.payment_checkout_attempts a on a.session_id=s.id cross join lateral jsonb_array_elements(s.snapshot#>'{intent,items}') i
   where s.cart_id is distinct from p_cart and s.order_id is null and s.state not in ('paid','retired')
    and s.snapshot#>>'{review,isPreorder}'='true' and i->>'product_id'=p.id::text and not private.checkout_interface_unsubmitted(a.id);
  if p.preorder_total_limit is not null and accepted+held+requested>p.preorder_total_limit then raise exception 'preorder:sold_out';end if;
  select coalesce(sum(i.quantity),0) into accepted from public.customer_order_items i join public.customer_orders o on o.id=i.order_id
   where i.product_id=p.id and i.is_preorder and o.user_id=customer and o.status not in ('cancelled','refunded');
  select coalesce(sum((i->>'quantity')::int),0) into held from private.payment_checkout_sessions s
   join private.payment_checkout_attempts a on a.session_id=s.id cross join lateral jsonb_array_elements(s.snapshot#>'{intent,items}') i
   where s.user_id=customer and s.cart_id is distinct from p_cart and s.order_id is null and s.state not in ('paid','retired')
    and s.snapshot#>>'{review,isPreorder}'='true' and i->>'product_id'=p.id::text and not private.checkout_interface_unsubmitted(a.id);
  if p.preorder_customer_limit is not null and accepted+held+requested>p.preorder_customer_limit then raise exception 'preorder:customer_limit';end if;
 end loop;
end $$;

-- Preserve old fingerprints. Only the new explicit preorder consent adds a key.
do $$ declare d text;begin
 d:=pg_get_functiondef('private.checkout_intent(jsonb,jsonb)'::regprocedure);
 d:=pg_temp.preorder_patch(d,'return intent;',E'if p_order ? ''preorder_accepted'' then intent:=jsonb_set(intent,''{order}'',(intent->''order'')||jsonb_build_object(''preorder_accepted'',(p_order->>''preorder_accepted'')::boolean));end if;\n return intent;');execute d;
 d:=pg_get_functiondef('private.checkout_review_before_cod(jsonb)'::regprocedure);
 d:=pg_temp.preorder_patch(d,$a$method not in ('bank_transfer','instapay')$a$,$b$(method not in ('bank_transfer','instapay') and not (method='card' and settings.payment_preorder_card_enabled))$b$);execute d;
 d:=pg_get_functiondef('private.checkout_review_before_pdc(jsonb)'::regprocedure);
 d:=pg_temp.preorder_patch(d,$a$if method not in ('cash','card','instapay') then return review;end if;$a$,$b$
 if method='card' and (review->>'isPreorder')::boolean then
  select * into settings from public.site_settings where key='default' for share;
  if not settings.payment_preorder_card_enabled then raise exception 'preorder:disabled';end if;
  if review->>'erpMode'<>'built_in' and settings.inventory_tracking_required then raise exception 'preorder:unavailable';end if;
  perform private.validate_preorder_capacity(p_intent,nullif(current_setting('app.checkout_cart_id',true),'')::uuid);
  shipping:=private.cod_shipping((p_intent#>>'{order,shipping_company_id}')::uuid,p_intent#>>'{order,governorate}');
  if (review->>'requiredNow')::numeric+(shipping->>'fee')::numeric<=0 then raise exception 'preorder:payment_amount';end if;
  return review||jsonb_build_object('shipping',shipping,'shippingFee',(shipping->>'fee')::numeric,
   'totalAmount',(review->>'totalAmount')::numeric+(shipping->>'fee')::numeric,
   'requiredNow',(review->>'requiredNow')::numeric+(shipping->>'fee')::numeric,
   'payableNow',(review->>'requiredNow')::numeric+(shipping->>'fee')::numeric,
   'stockFulfillmentState',case when settings.inventory_tracking_required then 'ready' else 'untracked' end,'allowOutOfStock',false);
 end if;
 if method not in ('cash','card','instapay') then return review;end if;
 $b$);execute d;
 d:=pg_get_functiondef('public.commerce_prepare_payment_checkout_before_merchant_retry(uuid,uuid,uuid,jsonb,jsonb,text,jsonb)'::regprocedure);
 d:=pg_temp.preorder_patch(d,$a$or coalesce((review->>'isPreorder')::boolean,true) or (review->>'erpMode'<>'built_in' and coalesce((select site_cfg.inventory_tracking_required from public.site_settings site_cfg where site_cfg.key='default'),true))$a$,$b$or (coalesce((review->>'isPreorder')::boolean,true) and not (review->>'isPreorder'='true' and p_order->>'payment_method'='card' and p_order->>'preorder_accepted'='true' and exists(select 1 from public.site_settings where key='default' and payment_preorder_card_enabled))) or (review->>'erpMode'<>'built_in' and coalesce((select site_cfg.inventory_tracking_required from public.site_settings site_cfg where site_cfg.key='default'),true))$b$);
 d:=pg_temp.preorder_patch(d,$a$'unit_price',round((l->>'total')::numeric/(l->>'quantity')::integer,2)$a$,$b$'is_preorder',(review->>'isPreorder')::boolean,'preorder_payment_mode',l->>'paymentMode','preorder_deposit_percent',l->'depositPercent','initial_amount_due',l->'due','expected_availability_date',l->>'expectedAvailabilityDate','availability_message',l->>'availabilityMessage','unit_price',round((l->>'total')::numeric/(l->>'quantity')::integer,2)$b$);execute d;
 d:=pg_get_functiondef('public.commerce_claim_checkout_payment_before_interfaces(uuid,uuid,text,bigint)'::regprocedure);
 d:=pg_temp.preorder_patch(d,$a$((s.snapshot#>>'{review,totalAmount}')::numeric*100)::bigint$a$,$b$(coalesce((s.snapshot#>>'{review,payableNow}')::numeric,(s.snapshot#>>'{review,totalAmount}')::numeric)*100)::bigint$b$);
 d:=pg_temp.preorder_patch(d,$a$if found then return jsonb_build_object('created',false);end if;$a$,$b$if found then return jsonb_build_object('created',false);end if;
 if s.snapshot#>>'{review,isPreorder}'='true' and not exists(select 1 from public.site_settings where key='default' and payment_preorder_card_enabled) then raise exception 'preorder:disabled';end if;$b$);execute d;
 d:=pg_get_functiondef('private.checkout_funded(uuid)'::regprocedure);
 d:=pg_temp.preorder_patch(d,$a$(s.snapshot#>>'{review,totalAmount}')::numeric*100$a$,$b$coalesce((s.snapshot#>>'{review,payableNow}')::numeric,(s.snapshot#>>'{review,totalAmount}')::numeric)*100$b$);execute d;
end $$;

-- New submission fences revalidate terms and allocation. Dismissal never releases a hold.
alter function private.checkout_interface_can_resume(uuid) rename to checkout_interface_can_resume_before_preorders;
create function private.checkout_interface_can_resume(p_session_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.checkout_interface_can_resume_before_preorders(p_session_id) and exists(select 1 from private.payment_checkout_sessions s
  where s.id=p_session_id and (s.snapshot#>>'{review,isPreorder}' is distinct from 'true' or exists(select 1 from public.site_settings where key='default' and payment_preorder_card_enabled)))
$$;
do $$ declare d text;begin
 d:=pg_get_functiondef('public.commerce_checkout_payment_interface(uuid,uuid,text,uuid,text,bigint)'::regprocedure);
 d:=pg_temp.preorder_patch(d,'failure text;','failure text; current_review jsonb;');
 d:=pg_temp.preorder_patch(d,$a$perform private.validate_coupon_capacity(s.snapshot->'intent',s.cart_id);$a$,$b$
 if s.snapshot#>>'{review,isPreorder}'='true' then
  perform set_config('app.checkout_cart_id',s.cart_id::text,true);
  current_review:=private.checkout_review(s.snapshot->'intent');
  if current_review is distinct from s.snapshot->'review' then raise exception 'checkout:restart';end if;
 end if;
 perform private.validate_coupon_capacity(s.snapshot->'intent',s.cart_id);$b$);execute d;
end $$;

-- Derive the new branch from the existing finalizer, retaining lineage, proof,
-- receipt, item-option and exactly-one-order guards. Normal orders use the original.
do $$ declare d text;begin
 d:=pg_get_functiondef('private.finalize_payment_checkout(uuid)'::regprocedure);
 d:=pg_temp.preorder_patch(d,'FUNCTION private.finalize_payment_checkout(','FUNCTION private.finalize_preorder_payment_checkout(');
 d:=pg_temp.preorder_patch(d,$a$f.amount_minor<>(review->>'totalAmount')::numeric*100$a$,$b$f.amount_minor<>(review->>'payableNow')::numeric*100$b$);
 d:=pg_temp.preorder_patch(d,$a$tracked:=coalesce((s.snapshot->>'inventory_required')::boolean,true) or coalesce((select inventory_tracking_required from public.site_settings where key='default'),true);$a$,$b$tracked:=true;$b$);
 d:=pg_temp.preorder_patch(d,'currency,stock_fulfillment_state,fulfillment_message)','currency,stock_fulfillment_state,fulfillment_message,is_preorder,initial_amount_due,preorder_fulfillment_state)');
 d:=pg_temp.preorder_patch(d,$a$'EGP',case when tracked then 'awaiting_stock' else 'untracked' end,case when tracked then 'Stock allocation requires staff review.' else '' end)$a$,$b$'EGP',case when coalesce((s.snapshot->>'inventory_required')::boolean,true) then 'ready' else 'untracked' end,'',true,(review->>'payableNow')::numeric,'awaiting_stock')$b$);
 d:=pg_temp.preorder_patch(d,'variant_options,unit_price,quantity,line_total)','variant_options,unit_price,quantity,line_total,is_preorder,preorder_payment_mode,preorder_deposit_percent,initial_amount_due,expected_availability_date,availability_message)');
 d:=pg_temp.preorder_patch(d,$a$(line->>'line_total')::numeric);$a$,$b$(line->>'line_total')::numeric,true,line->>'preorder_payment_mode',nullif(line->>'preorder_deposit_percent','')::numeric,(line->>'initial_amount_due')::numeric,nullif(line->>'expected_availability_date','')::date,line->>'availability_message');$b$);
 d:=pg_temp.preorder_patch(d,$a$payment_status='paid',amount_paid=total_amount,paid_at=f.verified_at$a$,$b$payment_status=case when (review->>'payableNow')::numeric=total_amount then 'paid' else 'partially_paid' end,amount_paid=(review->>'payableNow')::numeric,paid_at=case when (review->>'payableNow')::numeric=total_amount then f.verified_at else null end$b$);
 execute d;
end $$;
alter function private.finalize_payment_checkout(uuid) rename to finalize_payment_checkout_before_preorders;
create function private.finalize_payment_checkout(p_session_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform private.checkout_server();
 if exists(select 1 from private.payment_checkout_sessions where id=p_session_id and snapshot#>>'{review,isPreorder}'='true' and snapshot#>>'{order,payment_method}'='card') then
  return private.finalize_preorder_payment_checkout(p_session_id);
 end if;
 return private.finalize_payment_checkout_before_preorders(p_session_id);
end $$;

create function private.preorder_payment_verified(p_session uuid,p_order uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.payment_checkout_sessions s join public.customer_orders o on o.id=s.order_id
  join private.payment_checkout_funds f on f.session_id=s.id and f.is_primary
  join private.payment_checkout_attempts a on a.session_id=s.id
  join public.payment_attempts p on p.id=a.id and p.order_id=o.id
  where s.id=p_session and o.id=p_order and s.state='paid' and s.user_id=o.user_id
   and s.snapshot#>>'{review,isPreorder}'='true' and o.is_preorder and o.payment_method='card'
   and o.status not in ('cancelled','refunded') and o.payment_status in ('paid','partially_paid')
   and o.total_amount=(s.snapshot#>>'{review,totalAmount}')::numeric
   and o.initial_amount_due=(s.snapshot#>>'{review,payableNow}')::numeric
   and o.amount_paid>=o.initial_amount_due and o.amount_paid<=o.total_amount
   and f.kind='paymob' and f.currency=o.currency and f.amount_minor=o.initial_amount_due*100
   and a.mode='live' and a.status='succeeded' and a.amount_minor=f.amount_minor
   and p.mode='live' and p.status='succeeded' and p.amount_minor=f.amount_minor and p.paid_at is not null
   and exists(select 1 from public.payment_transactions t where t.attempt_id=p.id and t.transaction_id=f.reference and t.status='succeeded')
   and o.amount_paid=f.amount_minor/100.0+coalesce((select sum(amount) from public.preorder_payments where order_id=o.id),0))
$$;
do $$ declare d text;begin
 d:=pg_get_functiondef('public.commerce_read_payment_checkout_before_transfer(uuid,uuid)'::regprocedure);
 d:=pg_temp.preorder_patch(d,$a$paid:=o.id is not null$a$,$b$paid:=private.preorder_payment_verified(s.id,o.id) or o.id is not null$b$);
 d:=pg_temp.preorder_patch(d,$a$'review',s.snapshot->'review'$a$,$b$'isPreorder',coalesce((s.snapshot#>>'{review,isPreorder}')::boolean,false),'paymentAmount',coalesce(s.snapshot#>>'{review,payableNow}',s.snapshot#>>'{review,totalAmount}'),'remainingAmount',case when o.id is not null then o.total_amount-o.amount_paid else coalesce((s.snapshot#>>'{review,remainingAfterPayment}')::numeric,0) end,'orderPaymentStatus',o.payment_status,'preorderFulfillmentState',o.preorder_fulfillment_state,'review',s.snapshot->'review'$b$);execute d;
 d:=pg_get_functiondef('public.commerce_payment_checkout_admin(uuid)'::regprocedure);
 d:=pg_temp.preorder_patch(d,$a$'totalAmount',snapshot#>>'{review,totalAmount}'$a$,$b$'paymentAmount',coalesce(snapshot#>>'{review,payableNow}',snapshot#>>'{review,totalAmount}'),'isPreorder',coalesce((snapshot#>>'{review,isPreorder}')::boolean,false),'totalAmount',snapshot#>>'{review,totalAmount}'$b$);execute d;
 d:=pg_get_functiondef('public.commerce_complete_customer_cart(uuid,uuid)'::regprocedure);
 d:=pg_temp.preorder_patch(d,$a$user_id=p_user_id and payment_status='paid'$a$,$b$user_id=p_user_id and (payment_status='paid' or private.preorder_payment_verified(s.id,s.order_id))$b$);execute d;
end $$;
alter function public.commerce_payment_checkout_readiness() rename to commerce_payment_checkout_readiness_before_preorders;
create function public.commerce_payment_checkout_readiness() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform private.checkout_server();
 return public.commerce_payment_checkout_readiness_before_preorders()||jsonb_build_object('preorders',jsonb_build_object('installed',true,'balanceOnline',exists(select 1 from public.site_settings s where s.key='default' and s.payment_preorder_balance_mode='online'),'enabled',exists(select 1 from public.site_settings s where s.key='default' and s.payment_preorder_card_enabled and s.payment_card_enabled and exists(select 1 from private.payment_checkout_settings where id and enabled))));
end $$;

-- Existing manual balance evidence stays explicit. CARD settlement is never
-- manufactured by this staff operation; it accepts verified bank/InstaPay only.
do $$ declare d text;begin
 d:=pg_get_functiondef('public.commerce_record_preorder_payment(uuid,uuid,numeric,text)'::regprocedure);
 d:=pg_temp.preorder_patch(d,'p_reference text)','p_reference text, p_method text)');
 d:=pg_temp.preorder_patch(d,$a$v_amount := p_amount;$a$,$b$if p_method not in ('bank_transfer','instapay') or p_method is null then raise exception 'Choose a verified balance payment method.';end if;v_amount := p_amount;$b$);
 d:=pg_temp.preorder_patch(d,'btrim(p_reference), v_order.payment_method, p_admin_id','btrim(p_reference), p_method, p_admin_id');execute d;
 d:=pg_get_functiondef('public.commerce_record_preorder_payment(uuid,uuid,numeric,text)'::regprocedure);
 d:=pg_temp.preorder_patch(d,$a$v_amount := p_amount;$a$,$b$if v_order.payment_method='card' then raise exception 'Choose a verified balance payment method.';end if;v_amount := p_amount;$b$);execute d;
end $$;

revoke all on function private.validate_preorder_capacity(jsonb,uuid),private.finalize_preorder_payment_checkout(uuid),private.finalize_payment_checkout_before_preorders(uuid),private.finalize_payment_checkout(uuid),private.preorder_payment_verified(uuid,uuid),private.checkout_interface_can_resume_before_preorders(uuid),private.checkout_interface_can_resume(uuid),public.commerce_payment_checkout_readiness_before_preorders(),public.commerce_payment_checkout_readiness(),public.commerce_record_preorder_payment(uuid,uuid,numeric,text,text) from public,anon,authenticated,service_role;
grant execute on function public.commerce_payment_checkout_readiness(),public.commerce_record_preorder_payment(uuid,uuid,numeric,text,text) to service_role;
do $$ declare d text; a text:='''stock_fulfillment_state'',''fulfillment_message''';begin
 d:=pg_get_functiondef('private.checkout_order_update_guard()'::regprocedure);
 if (length(d)-length(replace(d,a,'')))/length(a)<>2 then raise exception 'Review preorder fulfillment snapshot guard.';end if;
 execute replace(d,a,a||',''preorder_fulfillment_state''');
end $$;

-- Balance payments reuse the checkout session, attempt, callback and funds path.
-- The session's review total is the balance, so every amount check stays unchanged.
alter table public.preorder_payments drop constraint preorder_payments_method_check;
alter table public.preorder_payments add constraint preorder_payments_method_check check(method=any(array['bank_transfer'::text,'instapay'::text,'card'::text]));
alter table public.preorder_payments alter column verified_by drop not null;
alter table public.preorder_payments add constraint preorder_payments_verified_check check(method='card' or verified_by is not null);
alter table public.preorder_payments add column checkout_session_id uuid unique references private.payment_checkout_sessions(id);
create unique index payment_checkout_one_open_balance on private.payment_checkout_sessions((snapshot->>'balance_order_id')) where snapshot->>'balance_order_id' is not null and state not in ('paid','retired');

create function private.preorder_fully_paid(o public.customer_orders) returns boolean language sql stable security definer set search_path='' as $$
 select o.is_preorder and o.payment_status='paid' and o.amount_paid=o.total_amount and o.paid_at is not null and o.status not in ('cancelled','refunded') and o.currency='EGP'
  and exists(select 1 from public.payment_attempts a where a.order_id=o.id and a.provider='paymob' and a.method='card' and a.mode='live' and a.status='succeeded' and a.amount_minor=o.initial_amount_due*100)
  and o.initial_amount_due+coalesce((select sum(p.amount) from public.preorder_payments p where p.order_id=o.id),0)=o.total_amount
$$;

create function public.commerce_prepare_preorder_balance(p_user_id uuid,p_order_id uuid) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare o public.customer_orders;s private.payment_checkout_sessions;a private.payment_checkout_attempts;balance numeric;snap jsonb;new_id uuid:=gen_random_uuid();
begin
 perform private.checkout_authorize(p_user_id);perform private.cod_authorize(p_user_id);
 perform pg_advisory_xact_lock(hashtextextended('payment-checkout-user:'||p_user_id::text,0));
 select * into o from public.customer_orders where id=p_order_id and user_id=p_user_id for update;
 if not found or not o.is_preorder or o.status in ('cancelled','refunded') or o.payment_status<>'partially_paid' or o.amount_paid<=0 or o.amount_paid>=o.total_amount or o.currency<>'EGP'
  or not exists(select 1 from public.site_settings where key='default' and payment_card_enabled and payment_preorder_card_enabled and payment_preorder_balance_mode='online')
  or not exists(select 1 from private.payment_checkout_settings where id and enabled) then raise exception 'preorder:balance_unavailable';end if;
 balance:=o.total_amount-o.amount_paid;
 select * into s from private.payment_checkout_sessions where user_id=p_user_id and snapshot->>'balance_order_id'=o.id::text and state not in ('paid','retired') for update;
 if found then
  select * into a from private.payment_checkout_attempts where session_id=s.id for update;
  if exists(select 1 from private.payment_checkout_funds f where f.session_id=s.id) then raise exception 'payment_first:existing' using detail=s.id::text;end if;
  if a.id is not null and not (private.checkout_interface_unsubmitted(a.id) or (a.status='failed' and not exists(select 1 from private.payment_callback_inbox r where r.provider_order_id=a.provider_order_id and r.status in ('pending','succeeded')))) then raise exception 'payment_first:existing' using detail=s.id::text;end if;
  if s.expires_at>clock_timestamp() and (s.snapshot#>>'{review,totalAmount}')::numeric=balance and (a.id is null or private.checkout_interface_can_resume(s.id)) then
   return jsonb_build_object('created',false,'checkout',public.commerce_read_payment_checkout(p_user_id,s.id));
  end if;
  update private.payment_checkout_attempts set presentation_retired_at=coalesce(presentation_retired_at,clock_timestamp()),interface_token=null where session_id=s.id;
  update private.payment_checkout_sessions set state='retired',updated_at=clock_timestamp() where id=s.id;
 end if;
 snap:=jsonb_build_object('kind','preorder_balance','balance_order_id',o.id,'inventory_required',false,'items','[]'::jsonb,'cart_lines','[]'::jsonb,'intent',jsonb_build_object('items','[]'::jsonb),
  'order',jsonb_build_object('first_name',o.first_name,'last_name',o.last_name,'email',o.email,'phone',o.phone,'street_address',o.street_address,'city',o.city,'governorate',o.governorate,'payment_method','card','locale',coalesce(o.sms_locale,'en')),
  'review',jsonb_build_object('totalAmount',balance,'orderValue',balance,'discountAmount',0,'paymentFee',0,'shippingFee',0,'requiredNow',balance,'payableNow',balance,'remainingAfterPayment',0,'isPreorder',false,'lines','[]'::jsonb));
 insert into private.payment_checkout_sessions(id,user_id,cart_id,quote_id,reference,intent_hash,snapshot,state,expires_at)
 values(new_id,p_user_id,gen_random_uuid(),gen_random_uuid(),'BAL-'||upper(substr(replace(new_id::text,'-',''),1,16)),sha256(convert_to(snap::text,'UTF8')),snap,'prepared',clock_timestamp()+interval '30 minutes');
 return jsonb_build_object('created',true,'checkout',public.commerce_read_payment_checkout(p_user_id,new_id));
end $$;

-- Only verified gateway funds reach this. Money that cannot apply stays visible in review.
create function private.finalize_preorder_balance(p_session_id uuid) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare s private.payment_checkout_sessions;f private.payment_checkout_funds;a private.payment_checkout_attempts;o public.customer_orders;received numeric;
begin
 perform private.checkout_server();
 perform pg_advisory_xact_lock(hashtextextended('payment-checkout-user:'||(select user_id::text from private.payment_checkout_sessions where id=p_session_id),0));
 select * into s from private.payment_checkout_sessions where id=p_session_id for update;
 if not found then raise exception 'Checkout not found.';end if;
 if s.state='paid' then return jsonb_build_object('created',false,'order_id',s.snapshot->>'balance_order_id');end if;
 select * into f from private.payment_checkout_funds where session_id=s.id and is_primary;
 select * into a from private.payment_checkout_attempts where session_id=s.id;
 if f.session_id is null or f.kind<>'paymob' or f.currency<>'EGP' or f.amount_minor<>(s.snapshot#>>'{review,totalAmount}')::numeric*100
  or a.id is null or a.mode<>'live' or a.status<>'succeeded' or a.provider_order_id is null then raise exception 'Verified funds required.';end if;
 received:=f.amount_minor/100.0;
 select * into o from public.customer_orders where id=(s.snapshot->>'balance_order_id')::uuid for update;
 if not found or o.user_id is distinct from s.user_id or not o.is_preorder or o.status in ('cancelled','refunded') or o.payment_status<>'partially_paid' or o.amount_paid+received<>o.total_amount then
  update private.payment_checkout_sessions set state='review',review_reason='preorder_balance_conflict',updated_at=clock_timestamp() where id=s.id;
  return jsonb_build_object('created',false,'review',true);
 end if;
 insert into public.preorder_payments(order_id,amount,reference,method,verified_by,checkout_session_id) values(o.id,received,f.reference,'card',null,s.id);
 update public.customer_orders set amount_paid=total_amount,payment_status='paid',paid_at=f.verified_at,updated_at=clock_timestamp() where id=o.id;
 update private.payment_checkout_sessions set state='paid',review_reason=null,updated_at=clock_timestamp() where id=s.id;
 return jsonb_build_object('created',false,'order_id',o.id,'balance',true);
end $$;

alter function private.finalize_payment_checkout(uuid) rename to finalize_payment_checkout_before_balance;
create function private.finalize_payment_checkout(p_session_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform private.checkout_server();
 if exists(select 1 from private.payment_checkout_sessions where id=p_session_id and snapshot->>'kind'='preorder_balance') then return private.finalize_preorder_balance(p_session_id);end if;
 return private.finalize_payment_checkout_before_balance(p_session_id);
end $$;

alter function public.commerce_read_payment_checkout(uuid,uuid) rename to commerce_read_payment_checkout_before_balance;
create function public.commerce_read_payment_checkout(p_user_id uuid,p_session_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb:=public.commerce_read_payment_checkout_before_balance(p_user_id,p_session_id);s private.payment_checkout_sessions;o public.customer_orders;
begin
 select * into s from private.payment_checkout_sessions where id=p_session_id and user_id=p_user_id;
 if s.snapshot->>'kind' is distinct from 'preorder_balance' then return r;end if;
 select * into o from public.customer_orders where id=(s.snapshot->>'balance_order_id')::uuid and user_id=p_user_id;
 return r||jsonb_build_object('isPreorderBalance',true,'orderId',o.id,'orderNumber',o.order_number,'orderStatus',o.status,'stockReview',false,'paymentAmount',(s.snapshot#>>'{review,totalAmount}')::numeric,'remainingAmount',o.total_amount-o.amount_paid,
  'paymentStatus',case when s.state='paid' then 'paid' else r->>'paymentStatus' end);
end $$;

-- A settled balance session has no order of its own, so it must not look like stuck money.
do $$ declare d text;begin
 d:=pg_get_functiondef('public.commerce_payment_checkout_monitor()'::regprocedure);
 d:=pg_temp.preorder_patch(d,$a$where f.is_primary and s.order_id is null)$a$,$b$where f.is_primary and s.order_id is null and not (s.state='paid' and s.snapshot->>'kind'='preorder_balance'))$b$);
 d:=pg_temp.preorder_patch(d,$a$s where order_id is null and expires_at<clock_timestamp()$a$,$b$s where order_id is null and not (s.state='paid' and s.snapshot->>'kind'='preorder_balance') and expires_at<clock_timestamp()$b$);execute d;
 -- A deposit is a verified payment, so the customer gets the same confirmation SMS.
 d:=pg_get_functiondef('private.sms_verified_paid(uuid)'::regprocedure);
 d:=pg_temp.preorder_patch(d,$a$f.amount_minor=o.total_amount*100$a$,$b$f.amount_minor=(case when o.is_preorder then o.initial_amount_due else o.total_amount end)*100$b$);
 d:=pg_temp.preorder_patch(d,$a$o.payment_status='paid' and o.amount_paid=o.total_amount and o.paid_at is not null$a$,$b$(o.payment_status='paid' and o.amount_paid=o.total_amount and o.paid_at is not null or o.is_preorder and o.payment_status='partially_paid' and o.amount_paid=o.initial_amount_due)$b$);execute d;
end $$;

-- Released pre-orders move on like any paid order, with or without tracked stock.
do $$ declare d text;a text;begin
 d:=pg_get_functiondef('private.guard_backorder_fulfillment()'::regprocedure);
 d:=pg_temp.preorder_patch(d,$a$if new.is_preorder or new.payment_method not in ('card','cash','instapay') then$a$,$b$if (new.is_preorder and new.payment_method<>'card') or new.payment_method not in ('card','cash','instapay') then$b$);execute d;
 d:=pg_get_functiondef('public.commerce_release_preorder(uuid,uuid)'::regprocedure);
 d:=pg_temp.preorder_patch(d,'perform public.assert_built_in_erp();','');
 d:=pg_temp.preorder_patch(d,$a$perform set_config('app.serialized_inventory_write', 'on', true);$a$,$b$if v_order.stock_fulfillment_state='untracked' then
    update public.customer_orders set preorder_fulfillment_state='ready',status='processing',updated_at=now() where id=p_order_id returning * into v_order;
    return to_jsonb(v_order);
  end if;
  perform public.assert_built_in_erp();
  perform set_config('app.serialized_inventory_write', 'on', true);$b$);execute d;
 d:=pg_get_functiondef('public.enqueue_daftra_order_sync()'::regprocedure);
 d:=pg_temp.preorder_patch(d,'or new.is_preorder then return new; end if;',$b$or (new.is_preorder and new.preorder_fulfillment_state<>'ready') then return new; end if;$b$);execute d;
 d:=pg_get_functiondef('private.pdc_order_eligibility(uuid)'::regprocedure);
 a:=$a$(o.payment_method='instapay' and private.order_email_paid(o))) and not o.is_preorder$a$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>2 then raise exception 'Review courier eligibility preimage.';end if;
 d:=replace(d,a,$b$(o.payment_method='instapay' and private.order_email_paid(o))) and (not o.is_preorder or private.preorder_fully_paid(o))$b$);
 d:=pg_temp.preorder_patch(d,$a$or not exists(select 1 from public.payment_attempts
   where order_id=o.id and mode='live' and status='succeeded' and amount_minor=o.total_amount*100)$a$,$b$or not (private.preorder_fully_paid(o) or exists(select 1 from public.payment_attempts
   where order_id=o.id and mode='live' and status='succeeded' and amount_minor=o.total_amount*100))$b$);execute d;
end $$;

revoke all on function private.preorder_fully_paid(public.customer_orders),private.finalize_preorder_balance(uuid),private.finalize_payment_checkout_before_balance(uuid),public.commerce_read_payment_checkout_before_balance(uuid,uuid),public.commerce_prepare_preorder_balance(uuid,uuid),public.commerce_read_payment_checkout(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.commerce_read_payment_checkout(uuid,uuid),public.commerce_prepare_preorder_balance(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
