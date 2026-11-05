-- Merchant-authorized new CARD/Apple Pay attempts. Financial uncertainty is retained.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table private.payment_checkout_settings add column merchant_risk_retry_enabled boolean not null default false;
alter table private.payment_checkout_sessions add column commercial_obligation_id uuid references private.payment_checkout_sessions(id) deferrable initially deferred;
alter table private.payment_checkout_attempts add column presentation_retired_at timestamptz;
create index payment_checkout_obligation on private.payment_checkout_sessions(commercial_obligation_id) where commercial_obligation_id is not null;

create function private.checkout_merchant_retry_enabled() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select enabled and merchant_risk_retry_enabled from private.payment_checkout_settings where id),false)
$$;
create function private.checkout_obligation_root(p_id uuid) returns uuid language sql stable security definer set search_path='' as $$
 select coalesce(commercial_obligation_id,id) from private.payment_checkout_sessions where id=p_id
$$;
create function private.checkout_obligation_order(p_id uuid) returns uuid language sql stable security definer set search_path='' as $$
 select o.id from private.payment_checkout_sessions member join public.customer_orders o on o.checkout_session_id=member.id
 where coalesce(member.commercial_obligation_id,member.id)=private.checkout_obligation_root(p_id)
 order by o.created_at,o.id limit 1
$$;
create function private.checkout_same_purchase(p_old uuid,p_new uuid) returns boolean language sql stable security definer set search_path='' as $$
 select a.user_id=b.user_id and a.snapshot#>>'{order,payment_method}'='card' and b.snapshot#>>'{order,payment_method}'='card'
 and a.state<>'retired' and (
  (jsonb_array_length(coalesce(a.snapshot->'cart_lines','[]'))>0
   and (select jsonb_agg(jsonb_build_object('key',x->>'cart_key','line',x->>'cart_line_id') order by x->>'cart_key') from jsonb_array_elements(a.snapshot->'cart_lines') x)
       =(select jsonb_agg(jsonb_build_object('key',x->>'cart_key','line',x->>'cart_line_id') order by x->>'cart_key') from jsonb_array_elements(b.snapshot->'cart_lines') x))
  or ((a.snapshot->'intent')#-'{order,locale}'=(b.snapshot->'intent')#-'{order,locale}'
   and a.state<>'paid' and a.order_id is null and private.checkout_obligation_order(a.id) is null))
 from private.payment_checkout_sessions a,private.payment_checkout_sessions b where a.id=p_old and b.id=p_new
$$;
create function private.checkout_card_conflict(p_user uuid,p_items jsonb,p_except uuid default null) returns uuid language sql stable security definer set search_path='' as $$
 select s.id from private.payment_checkout_sessions s left join private.payment_checkout_attempts a on a.session_id=s.id
 where s.user_id=p_user and s.id is distinct from p_except and s.state not in('paid','retired')
 and (s.snapshot#>>'{order,payment_method}'='instapay' or private.checkout_items_overlap(s.snapshot#>'{intent,items}',p_items))
 and (a.id is null or not private.checkout_interface_unsubmitted(a.id))
 and (not private.checkout_merchant_retry_enabled() or s.snapshot#>>'{order,payment_method}'<>'card')
 order by s.created_at,s.id limit 1
$$;

do $immutable$ declare d text;a text;begin
 d:=pg_get_functiondef('private.checkout_immutable()'::regprocedure);
 a:='array[''state'',''order_id'',''review_reason'',''updated_at'']';
 if position(a in d)=0 then raise exception 'Review checkout immutable preimage.';end if;
 d:=replace(d,a,'array[''state'',''order_id'',''review_reason'',''updated_at'',''commercial_obligation_id'']');
 a:='''inquiry_checked_at'']';if position(a in d)=0 then raise exception 'Review attempt immutable preimage.';end if;
 d:=replace(d,a,'''inquiry_checked_at'',''presentation_retired_at'']');
 a:='begin';d:=replace(d,a,a||$body$
 if tg_op='UPDATE' and tg_table_name='payment_checkout_sessions' then
 if new.commercial_obligation_id is distinct from old.commercial_obligation_id then
  if old.commercial_obligation_id is not null or not exists(select 1 from private.payment_checkout_sessions r where r.id=new.commercial_obligation_id and r.user_id=new.user_id and (r.commercial_obligation_id is null or r.commercial_obligation_id=r.id)) then raise exception 'Commercial obligation identity is immutable.';end if;
 end if;end if;
 if tg_op='UPDATE' and tg_table_name='payment_checkout_attempts' then
 if old.presentation_retired_at is not null and new.presentation_retired_at is distinct from old.presentation_retired_at then raise exception 'Presentation retirement is immutable.';end if;end if;
 $body$);execute d;
end $immutable$;

alter function public.commerce_payment_checkout_readiness() rename to commerce_payment_checkout_readiness_before_merchant_retry;
create function public.commerce_payment_checkout_readiness() returns jsonb language plpgsql security definer set search_path='' as $$
begin perform private.checkout_server();return public.commerce_payment_checkout_readiness_before_merchant_retry()||jsonb_build_object('merchantRiskRetries',private.checkout_merchant_retry_enabled());end $$;
create function public.commerce_configure_payment_retry(p_actor uuid,p_revision integer,p_enabled boolean) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.checkout_staff(p_actor,'payments.configure');if p_enabled is null then raise exception 'Invalid retry policy.';end if;
 update private.payment_checkout_settings set merchant_risk_retry_enabled=p_enabled,revision=revision+1 where id and revision=p_revision;
 if not found then raise exception 'Payment settings changed.' using errcode='40001';end if;
 insert into public.admin_activity_logs(admin_user_id,author_name,author_email,author_role,action_key,description,metadata)
 select id,coalesce(full_name,email),email,role,'payments.retry.configure','Updated merchant payment retry policy.',jsonb_build_object('merchant_risk_retries',p_enabled) from public.admin_users where id=p_actor;
 return public.commerce_payment_checkout_readiness();
end $$;

do $prepare$ declare d text;begin
 d:=pg_get_functiondef('public.commerce_prepare_payment_checkout(uuid,uuid,uuid,jsonb,jsonb,text,jsonb)'::regprocedure);
 if position('private.checkout_conflicting_payment(p_user_id,intent->''items'')' in d)=0 then raise exception 'Review CARD conflict preimage.';end if;
 d:=replace(d,'private.checkout_conflicting_payment(p_user_id,intent->''items'')','private.checkout_card_conflict(p_user_id,intent->''items'')');execute d;
end $prepare$;
alter function public.commerce_prepare_payment_checkout(uuid,uuid,uuid,jsonb,jsonb,text,jsonb) rename to commerce_prepare_payment_checkout_before_merchant_retry;
create function public.commerce_prepare_payment_checkout(p_user_id uuid,p_cart_id uuid,p_quote_id uuid,p_order jsonb,p_items jsonb,p_cart_revision text default null,p_cart_lines jsonb default '[]') returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare result jsonb;s private.payment_checkout_sessions;root_id uuid;ids uuid[];winning uuid;funded_session uuid;
begin
 result:=public.commerce_prepare_payment_checkout_before_merchant_retry(p_user_id,p_cart_id,p_quote_id,p_order,p_items,p_cart_revision,p_cart_lines);
 if not private.checkout_merchant_retry_enabled() or p_order->>'payment_method'<>'card' then return result;end if;
 select * into s from private.payment_checkout_sessions where id=(result#>>'{checkout,id}')::uuid and user_id=p_user_id;
 if not found then raise exception 'Checkout not found.' using errcode='42501';end if;
 if s.commercial_obligation_id is not null then return result;end if;
 select coalesce(old.commercial_obligation_id,old.id) into root_id from private.payment_checkout_sessions old
 where old.id<>s.id and private.checkout_same_purchase(old.id,s.id)
 order by (old.commercial_obligation_id is not null) desc,old.created_at,old.id limit 1;
 root_id:=coalesce(root_id,s.id);
 select array_agg(id) into ids from private.payment_checkout_sessions old
 where old.id=s.id or old.id=root_id or old.commercial_obligation_id=root_id
  or old.commercial_obligation_id is null and private.checkout_same_purchase(old.id,s.id);
 update private.payment_checkout_sessions set commercial_obligation_id=root_id where id=any(ids) and commercial_obligation_id is null;
 update private.payment_checkout_attempts set presentation_retired_at=coalesce(presentation_retired_at,clock_timestamp()),interface_token=null
 where session_id=any(ids) and session_id<>s.id;
 winning:=private.checkout_obligation_order(s.id);
 select member.id into funded_session from private.payment_checkout_sessions member join private.payment_checkout_funds receipt on receipt.session_id=member.id and receipt.is_primary where private.checkout_obligation_root(member.id)=root_id limit 1;
 return jsonb_build_object('created',(result->>'created')::boolean,'checkout',public.commerce_read_payment_checkout(p_user_id,coalesce((select checkout_session_id from public.customer_orders where id=winning),funded_session,s.id)));
end $$;

do $resume$ declare d text;begin
 d:=pg_get_functiondef('private.checkout_interface_can_resume(uuid)'::regprocedure);
 if position('and a.client_secret is not null' in d)=0 then raise exception 'Review resume preimage.';end if;
 execute replace(d,'and a.client_secret is not null','and a.presentation_retired_at is null and a.client_secret is not null');
end $resume$;

do $interface$ declare d text;a text;begin
 d:=pg_get_functiondef('public.commerce_checkout_payment_interface(uuid,uuid,text,uuid,text,bigint)'::regprocedure);
 d:=replace(d,'private.checkout_conflicting_payment(p_user_id,s.snapshot#>''{intent,items}'',s.id)','private.checkout_card_conflict(p_user_id,s.snapshot#>''{intent,items}'',s.id)');
 a:='if a.id is null or s.order_id is not null';if position(a in d)=0 then raise exception 'Review presentation guard preimage.';end if;
 execute replace(d,a,'if a.id is null or a.presentation_retired_at is not null or s.order_id is not null');
end $interface$;
create function public.commerce_retire_checkout_presentation(p_user_id uuid,p_session_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.checkout_authorize(p_user_id);perform pg_advisory_xact_lock(hashtextextended('payment-checkout-user:'||p_user_id::text,0));
 if not exists(select 1 from private.payment_checkout_sessions where id=p_session_id and user_id=p_user_id and snapshot#>>'{order,payment_method}'='card') then raise exception 'Checkout not found.' using errcode='42501';end if;
 if private.checkout_merchant_retry_enabled() then
  update private.payment_checkout_attempts set presentation_retired_at=coalesce(presentation_retired_at,clock_timestamp()),interface_token=null where session_id=p_session_id;
 end if;
 return public.commerce_read_payment_checkout(p_user_id,p_session_id);
end $$;

-- User serialization precedes session locks. Distinct transactions remain immutable;
-- only the first verified charge for an obligation is its primary funding receipt.
do $callback$ declare d text;a text;begin
 d:=pg_get_functiondef('private.apply_checkout_callback(text)'::regprocedure);
 a:='select * into s from private.payment_checkout_sessions where id=a.session_id for update;';
 if position(a in d)=0 then raise exception 'Review callback locking preimage.';end if;
 d:=replace(d,a,'perform pg_advisory_xact_lock(hashtextextended(''payment-checkout-user:''||(select user_id::text from private.payment_checkout_sessions where id=a.session_id),0));'||E'\n '||a);
 a:='select exists(select 1 from private.payment_checkout_funds where session_id=s.id and is_primary) into primary_exists;';
 if position(a in d)=0 then raise exception 'Review primary funding preimage.';end if;
 d:=replace(d,a,'select exists(select 1 from private.payment_checkout_funds received_fund join private.payment_checkout_sessions member on member.id=received_fund.session_id where private.checkout_obligation_root(member.id)=private.checkout_obligation_root(s.id) and received_fund.is_primary) into primary_exists;');
 a:='else update private.payment_checkout_sessions set review_reason=''additional_verified_payment'' where id=s.id;';
 if position(a in d)=0 then raise exception 'Review excess funding preimage.';end if;
 execute replace(d,a,'else update private.payment_checkout_sessions set review_reason=''additional_verified_payment'',state=case when order_id is null then ''review'' else state end where id=s.id;');
end $callback$;
-- Intention receipt storage takes the same user lock before attempt row locks.
do $store$ declare d text;a text;begin
 d:=pg_get_functiondef('public.commerce_store_checkout_intention(uuid,text,text,text)'::regprocedure);
 a:='select * into a from private.payment_checkout_attempts where id=p_attempt_id for update;';
 if position(a in d)=0 then raise exception 'Review intention storage lock preimage.';end if;
 execute replace(d,a,'perform pg_advisory_xact_lock(hashtextextended(''payment-checkout-user:''||(select stored_session.user_id::text from private.payment_checkout_attempts stored_attempt join private.payment_checkout_sessions stored_session on stored_session.id=stored_attempt.session_id where stored_attempt.id=p_attempt_id),0));'||E'\n '||a);
end $store$;
do $finalize$ declare d text;a text;begin
 d:=pg_get_functiondef('private.finalize_payment_checkout(uuid)'::regprocedure);
 a:='perform private.checkout_server();select * into s from private.payment_checkout_sessions where id=p_session_id for update;';
 if position(a in d)=0 then raise exception 'Review fulfillment lock preimage.';end if;
 d:=replace(d,a,'perform private.checkout_server();perform pg_advisory_xact_lock(hashtextextended(''payment-checkout-user:''||(select user_id::text from private.payment_checkout_sessions where id=p_session_id),0));select * into s from private.payment_checkout_sessions where id=p_session_id for update;');
 a:='perform pg_advisory_xact_lock(hashtextextended(''checkout-paid-cart:''||s.user_id::text,0));';
 if position(a in d)=0 then raise exception 'Review fulfillment serialization preimage.';end if;
 execute replace(d,a,a||E'\n if private.checkout_obligation_order(s.id) is not null then raise exception ''Related paid checkout requires reconciliation.'';end if;');
end $finalize$;

alter function public.commerce_read_payment_checkout(uuid,uuid) rename to commerce_read_payment_checkout_before_merchant_retry;
create function public.commerce_read_payment_checkout(p_user_id uuid,p_session_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;s private.payment_checkout_sessions;o public.customer_orders;winner private.payment_checkout_sessions;
begin
 r:=public.commerce_read_payment_checkout_before_merchant_retry(p_user_id,p_session_id);
 select * into s from private.payment_checkout_sessions where id=p_session_id and user_id=p_user_id;
 select * into o from public.customer_orders where id=private.checkout_obligation_order(s.id) and user_id=p_user_id;
 if o.id is not null and o.payment_status='paid' and o.amount_paid=o.total_amount and o.status not in('cancelled','refunded','returned') and private.order_email_paid(o)
  and exists(select 1 from private.payment_checkout_funds where session_id=s.id) then
  select * into winner from private.payment_checkout_sessions where id=o.checkout_session_id;
  r:=r||jsonb_build_object('paymentStatus','paid','fundsVerified',true,'orderId',o.id,'orderNumber',o.order_number,'orderStatus',o.status,
   'completionCheckoutId',winner.id,'cartId',winner.cart_id,'cartRevision',winner.snapshot->>'cart_revision','cartLines',winner.snapshot->'cart_lines',
   'items',winner.snapshot->'items','review',winner.snapshot->'review','totalAmount',o.total_amount,'stockReview',o.stock_fulfillment_state='awaiting_stock');
 end if;
 return r||jsonb_build_object('merchantRiskRetryAllowed',private.checkout_merchant_retry_enabled() and s.snapshot#>>'{order,payment_method}'='card' and r->>'paymentStatus' not in('paid','verified_order_pending') and not exists(select 1 from private.payment_checkout_funds receipt join private.payment_checkout_sessions member on member.id=receipt.session_id where private.checkout_obligation_root(member.id)=private.checkout_obligation_root(s.id)));
end $$;

do $admin$ declare d text;a text;begin
 d:=pg_get_functiondef('public.commerce_payment_checkout_admin(uuid)'::regprocedure);
 a:='''orderId'',order_id,''reviewReason'',review_reason';if position(a in d)=0 then raise exception 'Review staff projection preimage.';end if;
 execute replace(d,a,'''orderId'',coalesce(order_id,private.checkout_obligation_order(id)),''reviewReason'',review_reason');
end $admin$;

revoke all on function public.commerce_payment_checkout_readiness_before_merchant_retry(),public.commerce_prepare_payment_checkout_before_merchant_retry(uuid,uuid,uuid,jsonb,jsonb,text,jsonb),public.commerce_read_payment_checkout_before_merchant_retry(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.commerce_payment_checkout_readiness(),public.commerce_prepare_payment_checkout(uuid,uuid,uuid,jsonb,jsonb,text,jsonb),public.commerce_read_payment_checkout(uuid,uuid),public.commerce_configure_payment_retry(uuid,integer,boolean),public.commerce_retire_checkout_presentation(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.commerce_payment_checkout_readiness(),public.commerce_prepare_payment_checkout(uuid,uuid,uuid,jsonb,jsonb,text,jsonb),public.commerce_read_payment_checkout(uuid,uuid),public.commerce_configure_payment_retry(uuid,integer,boolean),public.commerce_retire_checkout_presentation(uuid,uuid) to service_role;
revoke all on function private.checkout_merchant_retry_enabled(),private.checkout_obligation_root(uuid),private.checkout_obligation_order(uuid),private.checkout_same_purchase(uuid,uuid),private.checkout_card_conflict(uuid,jsonb,uuid) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
