-- 113 candidate, after the independently inspected physical112 ledger.
-- Presentation/submission evidence is separate from financial status.
-- Existing attempts remain unknown. No age-based retirement or financial rewrite.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

alter table private.payment_checkout_attempts
 add column interface_state text not null default 'unknown'
  check(interface_state in ('unknown','initialized','submitted','superseded')),
 add column interface_token uuid,
 add column submission_started_at timestamptz,
 add column submission_failure_id text,
 add column replacement_cart_id uuid,
 add column inquiry_transaction_id text,
 add column inquiry_evidence_sha256 text check(inquiry_evidence_sha256~'^[a-f0-9]{64}$'),
 add column inquiry_checked_at timestamptz;

create function private.checkout_items_overlap(p_left jsonb,p_right jsonb) returns boolean
language sql immutable set search_path='' as $$
 select exists(select 1 from jsonb_array_elements(coalesce(p_left,'[]')) l
 join jsonb_array_elements(coalesce(p_right,'[]')) r
 on l->>'product_id'=r->>'product_id'
 and coalesce(l->>'variant_id','')=coalesce(r->>'variant_id',''))
$$;

create function private.checkout_interface_unsubmitted(p_attempt_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select a.interface_state in ('initialized','superseded')
  and a.submission_started_at is null and a.provider_order_id is not null
  and a.client_secret is not null and a.error_code is null
  and a.status in ('pending','failed') and s.order_id is null
  and s.state in ('pending','failed')
  and not exists(select 1 from private.payment_checkout_funds f where f.session_id=s.id)
  and not exists(select 1 from private.payment_callback_inbox r
   where r.provider_order_id=a.provider_order_id)
 from private.payment_checkout_attempts a join private.payment_checkout_sessions s on s.id=a.session_id
 where a.id=p_attempt_id),false)
$$;

create function private.checkout_retry_receipt(p_attempt_id uuid) returns text
language sql stable security definer set search_path='' as $$
 select r.transaction_id from private.payment_checkout_attempts a
 join private.payment_callback_inbox r on r.provider_order_id=a.provider_order_id
 where a.id=p_attempt_id and r.status='failed' and r.processed
 and r.mode=a.mode and r.integration_id=a.integration_id
 and r.amount_minor=a.amount_minor and r.currency=a.currency
 and (exists(select 1 from private.payment_callback_receipts proof
  where proof.transaction_id=r.transaction_id and proof.status='failed')
  or a.inquiry_transaction_id=r.transaction_id and a.inquiry_evidence_sha256 is not null)
 and not exists(select 1 from private.payment_callback_inbox pending
  where pending.provider_order_id=a.provider_order_id and pending.status in ('pending','succeeded'))
 and not exists(select 1 from private.payment_checkout_funds f where f.session_id=a.session_id)
 order by r.received_at desc,r.transaction_id desc limit 1
$$;

create function private.checkout_interface_can_resume(p_session_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select s.order_id is null and s.expires_at>clock_timestamp()
  and s.state in ('pending','failed') and a.client_secret is not null
  and (a.interface_state='initialized'
   or a.interface_state='submitted' and a.status='failed'
    and private.checkout_retry_receipt(a.id) is not null
    and private.checkout_retry_receipt(a.id) is distinct from a.submission_failure_id)
  and not exists(select 1 from private.payment_checkout_funds f where f.session_id=s.id)
  and not exists(select 1 from private.payment_callback_inbox r
   where r.provider_order_id=a.provider_order_id and r.status in ('pending','succeeded'))
 from private.payment_checkout_sessions s join private.payment_checkout_attempts a on a.session_id=s.id
 where s.id=p_session_id),false)
$$;

create function private.checkout_conflicting_payment(p_user_id uuid,p_items jsonb,p_except uuid default null) returns uuid
language sql stable security definer set search_path='' as $$
 select s.id from private.payment_checkout_sessions s
 left join private.payment_checkout_attempts a on a.session_id=s.id
 where s.user_id=p_user_id and s.id is distinct from p_except
 and s.state not in ('paid','retired')
 and (s.snapshot#>>'{order,payment_method}'='instapay'
  or private.checkout_items_overlap(s.snapshot#>'{intent,items}',p_items))
 and (a.id is null or not private.checkout_interface_unsubmitted(a.id))
 order by s.created_at,s.id limit 1
$$;

-- The old global index enforced the same lock even if the API changed.
-- User advisory locks now serialize preparation, supersession and submission.
drop index private.payment_checkout_one_unresolved;
create index payment_checkout_unresolved_owner on private.payment_checkout_sessions(user_id,created_at)
 where state not in ('paid','retired');

do $immutable$ declare d text;a text;begin
 d:=pg_get_functiondef('private.checkout_immutable()'::regprocedure);
 a:='array[''status'',''intention_id'',''provider_order_id'',''client_secret'',''error_code'',''paid_at'']';
 if position(a in d)=0 then raise exception 'Review checkout attempt immutable preimage.';end if;
 d:=replace(d,a,'array[''status'',''intention_id'',''provider_order_id'',''client_secret'',''error_code'',''paid_at'',''interface_state'',''interface_token'',''submission_started_at'',''submission_failure_id'',''replacement_cart_id'',''inquiry_transaction_id'',''inquiry_evidence_sha256'',''inquiry_checked_at'']');
 a:='if tg_table_name=''payment_checkout_attempts'' then';
 if position(a in d)=0 then raise exception 'Review replacement identity guard preimage.';end if;
 execute replace(d,a,a||E'\n  if old.replacement_cart_id is not null and new.replacement_cart_id is distinct from old.replacement_cart_id then raise exception ''Replacement checkout identity is immutable.'';end if;');
end $immutable$;

do $prepare$ declare d text;a text;begin
 d:=pg_get_functiondef('public.commerce_prepare_payment_checkout(uuid,uuid,uuid,jsonb,jsonb,text,jsonb)'::regprocedure);
 a:=$old$if found then
  if s.user_id<>p_user_id or s.intent_hash<>fp or s.quote_id<>p_quote_id or s.snapshot->>'cart_revision' is distinct from p_cart_revision or s.snapshot->'cart_lines' is distinct from p_cart_lines then raise exception 'checkout:conflict';end if;
  return jsonb_build_object('created',false,'checkout',public.commerce_read_payment_checkout(p_user_id,s.id));
 end if;$old$;
 if position(a in d)=0 then raise exception 'Review checkout cart replay preimage.';end if;
 d:=replace(d,a,$new$if found then
  if s.user_id<>p_user_id then raise exception 'checkout:conflict';end if;
  if s.intent_hash<>fp or s.snapshot->>'cart_revision' is distinct from p_cart_revision or s.snapshot->'cart_lines' is distinct from p_cart_lines then
   if s.state='paid' or exists(select 1 from private.payment_checkout_attempts a where a.session_id=s.id and private.checkout_interface_unsubmitted(a.id))
    or not private.checkout_items_overlap(s.snapshot#>'{intent,items}',intent->'items') then
    raise exception 'checkout:restart';
   end if;
   raise exception 'payment_first:existing' using detail=s.id::text;
  end if;
  if exists(select 1 from private.payment_checkout_attempts a where a.session_id=s.id and a.interface_state='superseded') then raise exception 'checkout:restart';end if;
  if exists(select 1 from private.payment_checkout_attempts a where a.session_id=s.id and private.checkout_interface_unsubmitted(a.id)) then
   if s.expires_at<=clock_timestamp() or sha256(convert_to(private.checkout_review(intent)::text,'UTF8'))<>sha256(convert_to((s.snapshot->'review')::text,'UTF8')) then raise exception 'checkout:restart';end if;
  end if;
  -- A refreshed quote never changes an already frozen financial snapshot.
  return jsonb_build_object('created',false,'checkout',public.commerce_read_payment_checkout(p_user_id,s.id));
 end if;$new$);
 a:=$old$if exists(select 1 from private.payment_checkout_sessions where user_id=p_user_id and state not in ('paid','retired')) then raise exception 'payment_first:existing';end if;$old$;
 if position(a in d)=0 then raise exception 'Review customer-wide checkout hold preimage.';end if;
 d:=replace(d,a,$new$if p_order->>'payment_method'='instapay' then
  if exists(select 1 from private.payment_checkout_sessions where user_id=p_user_id and state not in ('paid','retired')) then raise exception 'payment_first:existing';end if;
 else
  select * into s from private.payment_checkout_sessions where id=private.checkout_conflicting_payment(p_user_id,intent->'items');
  if found then raise exception 'payment_first:existing' using detail=s.id::text;end if;
 end if;$new$);
 a:=$old$return jsonb_build_object('created',true,'checkout',public.commerce_read_payment_checkout(p_user_id,s.id));$old$;
 if position(a in d)=0 then raise exception 'Review checkout creation receipt preimage.';end if;
 d:=replace(d,a,$new$if p_order->>'payment_method'='card' then
  update private.payment_checkout_attempts old_attempt set interface_state='superseded',interface_token=null,replacement_cart_id=s.cart_id
  from private.payment_checkout_sessions old_session
  where old_session.id=old_attempt.session_id and old_session.user_id=p_user_id and old_session.id<>s.id
   and old_attempt.interface_state='initialized' and private.checkout_interface_unsubmitted(old_attempt.id)
   and private.checkout_items_overlap(old_session.snapshot#>'{intent,items}',intent->'items');
 end if;
 return jsonb_build_object('created',true,'checkout',public.commerce_read_payment_checkout(p_user_id,s.id));$new$);
 execute d;
end $prepare$;

-- Legacy application bundles cannot create an unguarded new provider intention.
alter function public.commerce_claim_checkout_payment(uuid,uuid,text,bigint) rename to commerce_claim_checkout_payment_before_interfaces;
do $claim$ declare d text;a text;begin
 d:=pg_get_functiondef('public.commerce_claim_checkout_payment_before_interfaces(uuid,uuid,text,bigint)'::regprocedure);
 a:='insert into private.payment_checkout_attempts(session_id,mode,integration_id,amount_minor,currency)';
 if position(a in d)=0 then raise exception 'Review payment claim preimage.';end if;
 d:=replace(d,a,'insert into private.payment_checkout_attempts(session_id,mode,integration_id,amount_minor,currency,interface_state)');
 a:=$old$((s.snapshot#>>'{review,totalAmount}')::numeric*100)::bigint,'EGP')$old$;
 if position(a in d)=0 then raise exception 'Review payment claim value preimage.';end if;
 execute replace(d,a,$new$((s.snapshot#>>'{review,totalAmount}')::numeric*100)::bigint,'EGP','initialized')$new$);
end $claim$;
revoke all on function public.commerce_claim_checkout_payment_before_interfaces(uuid,uuid,text,bigint) from public,anon,authenticated,service_role;
create function public.commerce_claim_checkout_payment(p_user_id uuid,p_session_id uuid,p_mode text,p_integration_id bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
begin perform private.checkout_authorize(p_user_id);raise exception 'payment_first:refresh';end $$;
create function public.commerce_claim_checkout_payment(p_user_id uuid,p_session_id uuid,p_mode text,p_integration_id bigint,p_ui_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform private.checkout_authorize(p_user_id);
 if p_ui_version is distinct from 2 then raise exception 'payment_first:refresh';end if;
 return public.commerce_claim_checkout_payment_before_interfaces(p_user_id,p_session_id,p_mode,p_integration_id);
end $$;

create function public.commerce_checkout_payment_interface(p_user_id uuid,p_session_id uuid,p_action text,p_token uuid default null,p_mode text default null,p_integration_id bigint default null) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare s private.payment_checkout_sessions;a private.payment_checkout_attempts;conflict uuid;failure text;
begin
 perform private.checkout_authorize(p_user_id);
 if p_action not in ('context','open','submit','hosted') then raise exception 'Invalid payment interface action.';end if;
 select * into s from private.payment_checkout_sessions where id=p_session_id and user_id=p_user_id;
 if not found then raise exception 'Checkout not found.' using errcode='42501';end if;
 select * into a from private.payment_checkout_attempts where session_id=s.id;
 if p_action='context' then return jsonb_build_object('mode',a.mode,'integrationId',a.integration_id,'checkout',public.commerce_read_payment_checkout(p_user_id,s.id));end if;
 perform private.cod_authorize(p_user_id);
 perform pg_advisory_xact_lock(hashtextextended('payment-checkout-user:'||p_user_id::text,0));
 select * into s from private.payment_checkout_sessions where id=p_session_id and user_id=p_user_id for update;
 select * into a from private.payment_checkout_attempts where session_id=s.id for update;
 if a.id is null or s.order_id is not null or s.state not in ('pending','failed')
  or not exists(select 1 from private.payment_checkout_settings where id and enabled)
  or not exists(select 1 from public.site_settings where key='default' and payment_card_enabled)
  or a.mode is distinct from p_mode or a.integration_id is distinct from p_integration_id
 then return jsonb_build_object('allowed',false,'checkout',public.commerce_read_payment_checkout(p_user_id,s.id));end if;
 conflict:=private.checkout_conflicting_payment(p_user_id,s.snapshot#>'{intent,items}',s.id);
 if conflict is not null then raise exception 'payment_first:existing' using detail=conflict::text;end if;
 if s.expires_at<=clock_timestamp() then
  if private.checkout_interface_unsubmitted(a.id) then raise exception 'checkout:restart';end if;
  return jsonb_build_object('allowed',false,'checkout',public.commerce_read_payment_checkout(p_user_id,s.id));
 end if;
 if p_action='open' then
  if not private.checkout_interface_can_resume(s.id) then return jsonb_build_object('allowed',false,'checkout',public.commerce_read_payment_checkout(p_user_id,s.id));end if;
  update private.payment_checkout_attempts set interface_token=gen_random_uuid(),interface_state='initialized' where id=a.id returning * into a;
  return jsonb_build_object('allowed',true,'token',a.interface_token,'clientSecret',a.client_secret,'checkout',public.commerce_read_payment_checkout(p_user_id,s.id));
 end if;
 if p_token is null or a.interface_token is distinct from p_token or a.interface_state<>'initialized'
  or not private.checkout_interface_can_resume(s.id) then return jsonb_build_object('allowed',false,'checkout',public.commerce_read_payment_checkout(p_user_id,s.id));end if;
 failure:=private.checkout_retry_receipt(a.id);
 update private.payment_checkout_attempts set interface_state='submitted',interface_token=null,
  submission_started_at=clock_timestamp(),submission_failure_id=failure where id=a.id;
 return jsonb_build_object('allowed',true,'checkout',public.commerce_read_payment_checkout(p_user_id,s.id));
end $$;

-- Preserve the transfer wrapper and all original paid-order proof checks.
do $projection$ declare d text;a text;begin
 d:=pg_get_functiondef('public.commerce_read_payment_checkout_before_transfer(uuid,uuid)'::regprocedure);
 a:=$old$when a.status='failed' then 'failed' else 'unverified' end$old$;
 if position(a in d)=0 then raise exception 'Review customer payment status preimage.';end if;
 d:=replace(d,a,$new$when a.status='failed'
 and not exists(select 1 from private.payment_callback_inbox outstanding where outstanding.provider_order_id=a.provider_order_id and outstanding.status in ('pending','succeeded'))
 and (a.interface_state<>'submitted' or private.checkout_retry_receipt(a.id) is not null and private.checkout_retry_receipt(a.id) is distinct from a.submission_failure_id) then 'failed'
 when a.interface_state='initialized' and private.checkout_interface_can_resume(s.id) then 'ready' else 'unverified' end$new$);
 a:=$old$'orderId',o.id,$old$;
 if position(a in d)=0 then raise exception 'Review checkout public projection preimage.';end if;
 execute replace(d,a,$new$'interfaceState',coalesce(a.interface_state,'unknown'),'canResume',private.checkout_interface_can_resume(s.id),
 'canRestart',private.checkout_interface_unsubmitted(a.id),'orderId',o.id,$new$);
end $projection$;

-- COD stays unpaid and independent. An unresolved charge protects its affected
-- items; initialized forms can be superseded without cancelling an order.
do $cash$ declare d text;a text;begin
 d:=pg_get_functiondef('public.commerce_checkout_command(uuid,uuid,uuid,jsonb,jsonb)'::regprocedure);
 a:=$old$perform pg_advisory_xact_lock(hashtextextended('checkout-command:'||p_cart_id::text,0));$old$;
 if position(a in d)=0 then raise exception 'Review checkout command lock preimage.';end if;
 d:=replace(d,a,$new$perform pg_advisory_xact_lock(hashtextextended('payment-checkout-user:'||p_user_id::text,0));
 perform pg_advisory_xact_lock(hashtextextended('checkout-command:'||p_cart_id::text,0));$new$);
 a:=$old$if exists(select 1 from private.payment_checkout_sessions where cart_id=p_cart_id and (user_id<>p_user_id or state<>'paid')) then raise exception 'payment_first:existing';end if;$old$;
 if position(a in d)=0 then raise exception 'Review COD cart payment guard preimage.';end if;
 d:=replace(d,a,$new$if exists(select 1 from private.payment_checkout_sessions s join private.payment_checkout_attempts a on a.session_id=s.id
  where s.cart_id=p_cart_id and s.user_id=p_user_id and private.checkout_interface_unsubmitted(a.id)) then raise exception 'checkout:restart';end if;
 if exists(select 1 from private.payment_checkout_sessions where cart_id=p_cart_id and (user_id<>p_user_id or state<>'paid')) then raise exception 'payment_first:existing' using detail=(select id::text from private.payment_checkout_sessions where cart_id=p_cart_id and user_id=p_user_id);end if;
 if p_order->>'payment_method'='cash' and private.checkout_conflicting_payment(p_user_id,private.checkout_intent(p_order,p_items)->'items') is not null then raise exception 'payment_first:existing' using detail=private.checkout_conflicting_payment(p_user_id,private.checkout_intent(p_order,p_items)->'items')::text;end if;
 if p_order->>'payment_method'='cash' then
  update private.payment_checkout_attempts a set interface_state='superseded',interface_token=null,replacement_cart_id=p_cart_id
  from private.payment_checkout_sessions s where s.id=a.session_id and s.user_id=p_user_id
  and a.interface_state='initialized' and private.checkout_interface_unsubmitted(a.id)
  and private.checkout_items_overlap(s.snapshot#>'{intent,items}',private.checkout_intent(p_order,p_items)->'items');
 end if;$new$);
 execute d;
end $cash$;

-- Supersession is never financial finality. A genuine late success still enters
-- the existing funds ledger. Explicit replacement chains require private review
-- rather than creating a second order for the same superseded cart action.
do $paid$ declare d text;a text;begin
 d:=pg_get_functiondef('private.finalize_payment_checkout(uuid)'::regprocedure);
 a:=$old$select * into f from private.payment_checkout_funds where session_id=s.id and is_primary;$old$;
 if position(a in d)=0 then raise exception 'Review funded checkout finalization preimage.';end if;
 execute replace(d,a,$new$perform pg_advisory_xact_lock(hashtextextended('checkout-paid-cart:'||s.user_id::text,0));
 if exists(with recursive family(cart_id) as (
  select s.cart_id union
  select case when origin_session.cart_id=lineage.cart_id then edge.replacement_cart_id else origin_session.cart_id end
  from family lineage join (private.payment_checkout_attempts edge join private.payment_checkout_sessions origin_session on origin_session.id=edge.session_id)
   on origin_session.cart_id=lineage.cart_id or edge.replacement_cart_id=lineage.cart_id
  where origin_session.user_id=s.user_id and edge.replacement_cart_id is not null
 ) select 1 from public.customer_orders other where other.user_id=s.user_id
  and other.checkout_cart_id in (select cart_id from family)
  and other.checkout_session_id is distinct from s.id) then
  raise exception 'Related paid checkout requires reconciliation.';
 end if;
 select * into f from private.payment_checkout_funds where session_id=s.id and is_primary;$new$);
end $paid$;

-- Explicit, authenticated inquiry reconciliation is a private staff operation.
-- No browser endpoint, credential, live provider call or inquiry worker is added.
create function public.commerce_record_checkout_inquiry(p_actor uuid,p_attempt_id uuid,p_transaction jsonb,p_evidence_sha256 text) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare a private.payment_checkout_attempts;result jsonb;
begin
 perform private.checkout_staff(p_actor,'payments.verify');perform private.checkout_staff(p_actor,'payments.review');
 select * into a from private.payment_checkout_attempts where id=p_attempt_id;
 if not found or a.provider_order_id is null or coalesce(p_evidence_sha256,'')!~'^[a-f0-9]{64}$'
  or p_transaction->>'provider_order_id' is distinct from a.provider_order_id
  or p_transaction->>'mode' is distinct from a.mode
  or (p_transaction->>'integration_id')::bigint is distinct from a.integration_id
  or (p_transaction->>'amount_minor')::bigint is distinct from a.amount_minor
  or p_transaction->>'currency' is distinct from a.currency
  or p_transaction ? 'signature_sha256' then raise exception 'Inquiry context mismatch.';end if;
 -- Record its real source without inventing a callback HMAC receipt.
 result:=public.commerce_accept_payment_callback(p_transaction||jsonb_build_object('evidence_sha256',p_evidence_sha256));
 update private.payment_checkout_attempts set inquiry_transaction_id=p_transaction->>'transaction_id',
  inquiry_evidence_sha256=p_evidence_sha256,inquiry_checked_at=clock_timestamp() where id=a.id;
 insert into public.admin_activity_logs(admin_user_id,author_name,author_email,author_role,action_key,description,metadata)
 select id,coalesce(full_name,email),email,role,'payments.checkout.inquiry','Reconciled a targeted provider inquiry.',
  jsonb_build_object('attempt_id',a.id,'transaction_id',p_transaction->>'transaction_id','evidence_sha256',p_evidence_sha256)
 from public.admin_users where id=p_actor;
 return result;
end $$;

-- Ordinary unsubmitted forms do not become overdue payment alarms. Historical
-- unknown/submitted attempts and every actual callback/fund remain monitored.
do $monitor$ declare d text;a text;begin
 d:=pg_get_functiondef('public.commerce_payment_checkout_monitor()'::regprocedure);
 a:='where a.session_id=s.id))';
 if position(a in d)=0 then raise exception 'Review checkout monitor preimage.';end if;
 execute replace(d,a,'where a.session_id=s.id and not private.checkout_interface_unsubmitted(a.id)))');
end $monitor$;

revoke all on function public.commerce_claim_checkout_payment(uuid,uuid,text,bigint),
 public.commerce_claim_checkout_payment(uuid,uuid,text,bigint,integer),
 public.commerce_checkout_payment_interface(uuid,uuid,text,uuid,text,bigint),
 public.commerce_record_checkout_inquiry(uuid,uuid,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.commerce_claim_checkout_payment(uuid,uuid,text,bigint),
 public.commerce_claim_checkout_payment(uuid,uuid,text,bigint,integer),
 public.commerce_checkout_payment_interface(uuid,uuid,text,uuid,text,bigint),
 public.commerce_record_checkout_inquiry(uuid,uuid,jsonb,text) to service_role;
revoke all on function private.checkout_items_overlap(jsonb,jsonb),
 private.checkout_interface_unsubmitted(uuid),private.checkout_retry_receipt(uuid),
 private.checkout_interface_can_resume(uuid),private.checkout_conflicting_payment(uuid,jsonb,uuid)
 from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
