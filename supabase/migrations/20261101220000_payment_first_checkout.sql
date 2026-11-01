-- 108 candidate. Inactive prepaid checkout. No existing order/attempt rewrite.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create table private.payment_checkout_settings(id boolean primary key default true check(id),enabled boolean not null default false,enabled_since timestamptz,revision integer not null default 0);
insert into private.payment_checkout_settings(id) values(true);
create table private.payment_checkout_sessions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null,cart_id uuid not null unique,quote_id uuid not null,
 reference text not null unique default 'CHK-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),
 intent_hash bytea not null check(octet_length(intent_hash)=32),snapshot jsonb not null,
 state text not null default 'prepared' check(state in ('prepared','opening','pending','failed','uncertain','finalizing','paid','review','retired')),
 order_id uuid unique references public.customer_orders(id) on delete restrict deferrable initially deferred,
 review_reason text,expires_at timestamptz not null default clock_timestamp()+interval '30 minutes',
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
create unique index payment_checkout_one_unresolved on private.payment_checkout_sessions(user_id) where state not in ('paid','retired');
create table private.payment_checkout_attempts(
 id uuid primary key default gen_random_uuid(),session_id uuid not null unique references private.payment_checkout_sessions(id) on delete restrict,
 mode text not null check(mode in ('test','live')),integration_id bigint not null check(integration_id>0),amount_minor bigint not null check(amount_minor>0),currency text not null check(currency='EGP'),
 status text not null default 'initiated' check(status in ('initiated','pending','failed','succeeded','uncertain')),
 intention_id text unique,provider_order_id text unique,client_secret text,error_code text,
 dispatch_started_at timestamptz not null default clock_timestamp(),paid_at timestamptz,created_at timestamptz not null default clock_timestamp()
);
create table private.payment_callback_inbox(
 transaction_id text primary key check(transaction_id~'^[0-9]{1,18}$'),provider_order_id text not null check(provider_order_id~'^[0-9]{1,18}$'),
 mode text not null check(mode in ('test','live')),integration_id bigint not null check(integration_id>0),amount_minor bigint not null check(amount_minor>0),currency text not null check(currency='EGP'),
 status text not null check(status in ('pending','failed','succeeded')),received_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 evidence_sha256 text check(evidence_sha256~'^[a-f0-9]{64}$'),signature_sha256 text check(signature_sha256~'^[a-f0-9]{64}$'),processed boolean not null default false,error_code text
);
create index payment_callback_unprocessed on private.payment_callback_inbox(provider_order_id,received_at) where not processed;
-- Hash-only immutable receipts preserve each distinct signed status, without PAN/body data.
create table private.payment_callback_receipts(
 transaction_id text not null references private.payment_callback_inbox(transaction_id) on delete restrict,
 evidence_sha256 text not null check(evidence_sha256~'^[a-f0-9]{64}$'),signature_sha256 text not null check(signature_sha256~'^[a-f0-9]{64}$'),
 status text not null check(status in ('pending','failed','succeeded')),received_at timestamptz not null default clock_timestamp(),
 primary key(transaction_id,evidence_sha256)
);
create function private.checkout_callback_receipt_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Signed callback evidence is immutable.';end $$;
create trigger checkout_callback_receipt_immutable before update or delete on private.payment_callback_receipts for each row execute function private.checkout_callback_receipt_immutable();
create table private.payment_checkout_funds(
 id uuid primary key default gen_random_uuid(),session_id uuid not null references private.payment_checkout_sessions(id) on delete restrict,
 kind text not null check(kind in ('paymob','instapay')),reference text not null,amount_minor bigint not null check(amount_minor>0),currency text not null check(currency='EGP'),
 is_primary boolean not null,verified_at timestamptz not null default clock_timestamp(),reviewed_by uuid, evidence jsonb not null default '{}',unique(kind,reference)
);
create unique index payment_checkout_primary_funds on private.payment_checkout_funds(session_id) where is_primary;
alter table public.customer_orders add column checkout_session_id uuid unique references private.payment_checkout_sessions(id) on delete restrict;

create function private.checkout_server() returns void language plpgsql set search_path='' as $$
begin if auth.role() is distinct from 'service_role' then raise exception 'Server access required.' using errcode='42501';end if;end $$;
create function private.checkout_staff(p_actor uuid,p_permission text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.checkout_server();
 if not exists(select 1 from public.admin_users where id=p_actor and is_active and (role='owner' or coalesce((permissions->>'payments.view')::boolean,false) and coalesce((permissions->>p_permission)::boolean,false))) then raise exception 'Payment permission denied.' using errcode='42501';end if;
end $$;
create function public.commerce_payment_checkout_readiness() returns jsonb language plpgsql security definer set search_path='' as $$
begin perform private.checkout_server();return (select jsonb_build_object('installed',true,'enabled',enabled,'revision',revision,'manual',jsonb_build_object('installed',false,'ready',false)) from private.payment_checkout_settings where id);end $$;
create function public.commerce_payment_checkout_configure(p_actor uuid,p_revision integer,p_enabled boolean) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.checkout_staff(p_actor,'payments.configure');
 if p_enabled is null then raise exception 'Invalid payment setting.';end if;
 update private.payment_checkout_settings set enabled=p_enabled,enabled_since=case when p_enabled then clock_timestamp() else enabled_since end,revision=revision+1 where id and revision=p_revision;
 if not found then raise exception 'Payment settings changed.' using errcode='40001';end if;
 insert into public.admin_activity_logs(admin_user_id,author_name,author_email,author_role,action_key,description,metadata)
 select id,coalesce(full_name,email),email,role,'payments.lifecycle.configure','Updated payment checkout controls.',jsonb_build_object('enabled',p_enabled) from public.admin_users where id=p_actor;
 return public.commerce_payment_checkout_readiness();
end $$;
create function public.commerce_payment_checkout_admin(p_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb;begin
 perform private.checkout_staff(p_actor,'payments.view');
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'reference',reference,'state',state,'totalAmount',snapshot#>>'{review,totalAmount}','currency','EGP','createdAt',created_at,'orderId',order_id,'reviewReason',review_reason) order by created_at desc),'[]') into rows
 from (select * from private.payment_checkout_sessions order by created_at desc limit 50) x;
 return jsonb_build_object('items',rows,'readiness',public.commerce_payment_checkout_readiness(),'monitor',public.commerce_payment_checkout_monitor());
end $$;
create function public.commerce_payment_checkout_monitor() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.checkout_server();return jsonb_build_object('unresolved',(select count(*) from private.payment_checkout_sessions where state not in ('paid','retired')),
 'verified_order_pending',(select count(*) from private.payment_checkout_funds f join private.payment_checkout_sessions s on s.id=f.session_id where f.is_primary and s.order_id is null),
 'additional_verified_payments',(select count(*) from private.payment_checkout_funds where not is_primary),
 'unprocessed_callbacks',(select count(*) from private.payment_callback_inbox where not processed),
 'overdue_unverified',(select count(*) from private.payment_checkout_sessions s where order_id is null and expires_at<clock_timestamp() and exists(select 1 from private.payment_checkout_attempts a where a.session_id=s.id)));
end $$;
create function private.checkout_funded(p_id uuid) returns private.payment_checkout_sessions language plpgsql security definer set search_path='' as $$
declare s private.payment_checkout_sessions;
begin
 perform private.checkout_server();select * into s from private.payment_checkout_sessions where id=p_id;
 if not found or s.state<>'finalizing' or s.order_id is null or not exists(select 1 from private.payment_checkout_funds f
  where f.session_id=s.id and f.is_primary and f.amount_minor=(s.snapshot#>>'{review,totalAmount}')::numeric*100 and f.currency='EGP') then raise exception 'Verified checkout funds required.';end if;
 return s;
end $$;
create function private.checkout_order_insert_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare s private.payment_checkout_sessions;
begin
 if new.checkout_session_id is null then return new;end if;
 s:=private.checkout_funded(new.checkout_session_id);
 if new.id<>s.order_id or new.user_id is distinct from (case when exists(select 1 from auth.users where id=s.user_id) then s.user_id end)
  or new.payment_method is distinct from s.snapshot#>>'{order,payment_method}' or new.total_amount*100<>(s.snapshot#>>'{review,totalAmount}')::numeric*100 then raise exception 'Checkout identity mismatch.';end if;
 return new;
end $$;
create trigger a_checkout_verified_insert before insert on public.customer_orders for each row execute function private.checkout_order_insert_guard();

create function private.checkout_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Checkout evidence is immutable.';end if;
 if tg_table_name='payment_checkout_sessions' and (to_jsonb(new)-array['state','order_id','review_reason','updated_at']) is distinct from (to_jsonb(old)-array['state','order_id','review_reason','updated_at']) then raise exception 'Checkout snapshot is immutable.';end if;
 if tg_table_name='payment_checkout_attempts' then
  if (to_jsonb(new)-array['status','intention_id','provider_order_id','client_secret','error_code','paid_at']) is distinct from (to_jsonb(old)-array['status','intention_id','provider_order_id','client_secret','error_code','paid_at'])
   or old.provider_order_id is not null and new.provider_order_id is distinct from old.provider_order_id
   or old.intention_id is not null and new.intention_id is distinct from old.intention_id
   or old.client_secret is not null and new.client_secret is not null and new.client_secret is distinct from old.client_secret then raise exception 'Payment attempt is immutable.';end if;
 end if;
 if tg_table_name='payment_checkout_funds' then raise exception 'Verified funds are immutable.';end if;
 return new;
end $$;
create trigger checkout_snapshot_immutable before update or delete on private.payment_checkout_sessions for each row execute function private.checkout_immutable();
create trigger checkout_attempt_immutable before update or delete on private.payment_checkout_attempts for each row execute function private.checkout_immutable();
create trigger checkout_funds_immutable before update or delete on private.payment_checkout_funds for each row execute function private.checkout_immutable();

create function private.checkout_order_update_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if old.checkout_session_id is not null and (to_jsonb(new)-array['status','payment_status','paid_at','amount_paid','updated_at','packing_completed_at','shipping_review_status','awaiting_customer_message_id','stock_fulfillment_state','fulfillment_message','stock_reservation_released_at','first_name','last_name','phone','street_address','city','governorate','shipping_company_name','payment_proof_file_name','payment_proof_uploaded_at','payment_proof_reviewed_at','payment_proof_status']) is distinct from (to_jsonb(old)-array['status','payment_status','paid_at','amount_paid','updated_at','packing_completed_at','shipping_review_status','awaiting_customer_message_id','stock_fulfillment_state','fulfillment_message','stock_reservation_released_at','first_name','last_name','phone','street_address','city','governorate','shipping_company_name','payment_proof_file_name','payment_proof_uploaded_at','payment_proof_reviewed_at','payment_proof_status']) then raise exception 'Paid checkout financial identity is immutable.';end if;
 return new;
end $$;
create trigger a_checkout_verified_update before update on public.customer_orders for each row execute function private.checkout_order_update_guard();

-- The existing INSERT guards still run, using the trusted frozen paid snapshot.
-- Legacy CARD/COD/manual paths are byte-for-byte unchanged outside this branch.
do $patch$ declare d text;a text;begin
 d:=pg_get_functiondef('public.storefront_prepare_order_payment()'::regprocedure);a:='begin';
 if position(a in d)=0 then raise exception 'Review payment insert guard.';end if;
 d:=replace(d,a,a||$body$
  if new.checkout_session_id is not null then
   perform private.checkout_funded(new.checkout_session_id);
   select (s.snapshot#>>'{review,paymentFee}')::numeric,(s.snapshot#>>'{review,totalAmount}')::numeric
    into new.payment_fee_amount,new.total_amount from private.payment_checkout_sessions s where s.id=new.checkout_session_id;
   new.payment_proof_status:=case when new.payment_method='instapay' then 'approved' else 'not_required' end;return new;
  end if;
 $body$);execute d;
 d:=pg_get_functiondef('private.prepare_cod_shipping()'::regprocedure);a:='begin';
 if position(a in d)=0 then raise exception 'Review shipping insert guard.';end if;
 execute replace(d,a,a||$body$
  if new.checkout_session_id is not null then
   perform private.checkout_funded(new.checkout_session_id);
   select (s.snapshot#>>'{order,shipping_company_id}')::uuid,s.snapshot#>>'{review,shipping,companyName}',coalesce((s.snapshot#>>'{review,shippingFee}')::numeric,0)
    into new.shipping_company_id,new.shipping_company_name,new.shipping_fee_amount from private.payment_checkout_sessions s where s.id=new.checkout_session_id;
   new.card_checkout_verified:=(new.payment_method='card');return new;
  end if;
 $body$);
 d:=pg_get_functiondef('private.capture_order_email()'::regprocedure);a:='begin';
 if position(a in d)=0 then raise exception 'Review email insert guard.';end if;
 execute replace(d,a,a||E'\n if tg_op=''INSERT'' and new.checkout_session_id is not null then return new;end if;');
end $patch$;

create function public.commerce_prepare_payment_checkout(p_user_id uuid,p_cart_id uuid,p_quote_id uuid,p_order jsonb,p_items jsonb,p_cart_revision text default null,p_cart_lines jsonb default '[]') returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare s private.payment_checkout_sessions;q private.checkout_quotes;intent jsonb;review jsonb;fp bytea;lines jsonb;settings public.site_settings;
begin
 perform private.checkout_authorize(p_user_id);perform private.cod_authorize(p_user_id);
 if p_cart_id is null or p_quote_id is null then raise exception 'checkout:quote';end if;
 if jsonb_typeof(p_cart_lines)<>'array' or jsonb_array_length(p_cart_lines)>100 or octet_length(p_cart_lines::text)>32768 then raise exception 'checkout:conflict';end if;
 intent:=private.checkout_intent(p_order,p_items);fp:=sha256(convert_to(intent::text,'UTF8'));
 if jsonb_array_length(p_cart_lines)>0 and (jsonb_array_length(p_cart_lines)<>jsonb_array_length(intent->'items')
  or exists(select 1 from jsonb_array_elements(p_cart_lines) c where c->>'cart_line_id'!~'^[0-9a-f-]{36}$' or not exists(select 1 from jsonb_array_elements(intent->'items') i
   where c->>'cart_key'=(i->>'product_id')||':'||coalesce(i->>'variant_id','default') and (c->>'quantity')::integer=(i->>'quantity')::integer))
  or (select count(distinct c->>'cart_key') from jsonb_array_elements(p_cart_lines) c)<>jsonb_array_length(p_cart_lines)) then raise exception 'checkout:conflict';end if;
 perform pg_advisory_xact_lock(hashtextextended('payment-checkout-user:'||p_user_id::text,0));
 perform pg_advisory_xact_lock(hashtextextended('checkout-command:'||p_cart_id::text,0));
 select * into s from private.payment_checkout_sessions where cart_id=p_cart_id for update;
 if found then
  if s.user_id<>p_user_id or s.intent_hash<>fp or s.quote_id<>p_quote_id or s.snapshot->>'cart_revision' is distinct from p_cart_revision or s.snapshot->'cart_lines' is distinct from p_cart_lines then raise exception 'checkout:conflict';end if;
  return jsonb_build_object('created',false,'checkout',public.commerce_read_payment_checkout(p_user_id,s.id));
 end if;
 if not exists(select 1 from private.payment_checkout_settings where id and enabled) then raise exception 'Payment-first checkout is disabled.';end if;
 if p_order->>'payment_method'<>'card' then raise exception 'Unsupported prepaid method.';end if;
 if exists(select 1 from private.payment_checkout_sessions where user_id=p_user_id and state not in ('paid','retired')) then raise exception 'payment_first:existing';end if;
 if exists(select 1 from private.checkout_commands where command_id=p_cart_id) or exists(select 1 from public.customer_orders where checkout_cart_id=p_cart_id) then raise exception 'checkout:legacy';end if;
 perform private.validate_checkout_location(p_user_id,p_order);
 select * into q from private.checkout_quotes where id=p_quote_id;
 if not found or q.user_id<>p_user_id or q.cart_id<>p_cart_id or q.intent_hash<>fp or q.retired_by_reset or q.expires_at<=clock_timestamp() then raise exception 'checkout:quote';end if;
 review:=private.checkout_review(intent);
 if q.review_hash<>sha256(convert_to(review::text,'UTF8')) or coalesce((review->>'isPreorder')::boolean,true) or review->>'erpMode'<>'built_in' then raise exception 'checkout:quote';end if;
 if nullif(intent#>>'{order,first_name}','') is null or nullif(intent#>>'{order,email}','') is null or intent#>>'{order,phone}'!~'^01[0-9]{9}$' then raise exception 'Complete delivery details.';end if;
 if review->>'stockFulfillmentState'='awaiting_stock' and p_order->>'backorder_accepted' is distinct from 'true' then raise exception 'Accept special-order terms.';end if;
 select * into settings from public.site_settings where key='default';
 select jsonb_agg(jsonb_build_object('product_id',p.id,'variant_id',v.id,'product_title',l->>'title','product_slug',p.slug,'image_url',p.image_url,'product_sku',p.sku,'is_serialized',p.is_serialized,
  'variant_name',v.name,'variant_code',v.code,'variant_sku',v.sku,'variant_color_name',v.color_name,'variant_color_hex',v.color_hex,
  'unit_price',round((l->>'total')::numeric/(l->>'quantity')::integer,2),'quantity',(l->>'quantity')::integer,'line_total',(l->>'total')::numeric))
 into lines from jsonb_array_elements(review->'lines') l join public.products p on p.id=(l->>'productId')::uuid
 left join public.product_variants v on v.id=nullif(l->>'variantId','')::uuid;
 if jsonb_array_length(lines)<>jsonb_array_length(review->'lines') then raise exception 'checkout:unavailable';end if;
 insert into private.payment_checkout_sessions(user_id,cart_id,quote_id,intent_hash,snapshot)
 values(p_user_id,p_cart_id,p_quote_id,fp,jsonb_build_object('version',1,'order',(intent->'order')||jsonb_build_object('locale',case when p_order->>'locale'='ar' then 'ar' else 'en' end),'intent',intent,'review',review,'items',lines,
  'cart_revision',p_cart_revision,'cart_lines',p_cart_lines,'inventory_required',settings.inventory_tracking_required)) returning * into s;
 return jsonb_build_object('created',true,'checkout',public.commerce_read_payment_checkout(p_user_id,s.id));
end $$;

create function public.commerce_read_payment_checkout(p_user_id uuid,p_session_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s private.payment_checkout_sessions;a private.payment_checkout_attempts;o public.customer_orders;paid boolean:=false;funded boolean:=false;
begin
 perform private.checkout_authorize(p_user_id);select * into s from private.payment_checkout_sessions where id=p_session_id and user_id=p_user_id;
 if not found then raise exception 'Checkout not found.' using errcode='42501';end if;
 select * into a from private.payment_checkout_attempts where session_id=s.id;
 select * into o from public.customer_orders where id=s.order_id and user_id=p_user_id;
 select exists(select 1 from private.payment_checkout_funds where session_id=s.id and is_primary) into funded;
 paid:=o.id is not null and o.payment_status='paid' and o.amount_paid=o.total_amount and o.status not in ('cancelled','refunded') and funded and (o.payment_method<>'card' or private.order_email_paid(o));
 return jsonb_build_object('id',s.id,'reference',s.reference,'state',s.state,'paymentStatus',case when paid then 'paid' when o.payment_status='refunded' then 'refunded' when funded and o.id is null then 'verified_order_pending' when s.state='review' then 'verification_required' when a.status='failed' then 'failed' else 'unverified' end,
  'orderId',o.id,'orderNumber',o.order_number,'orderStatus',o.status,'stockReview',o.stock_fulfillment_state='awaiting_stock','fundsVerified',funded,'expiresAt',s.expires_at,'createdAt',s.created_at,
  'method',s.snapshot#>>'{order,payment_method}','totalAmount',s.snapshot#>>'{review,totalAmount}','currency','EGP',
  'review',s.snapshot->'review','address',s.snapshot->'order','cartId',s.cart_id,'cartRevision',s.snapshot->>'cart_revision','cartLines',s.snapshot->'cart_lines','items',s.snapshot->'items');
end $$;
create function public.commerce_list_payment_checkouts(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 perform private.checkout_authorize(p_user_id);
 select coalesce(jsonb_agg(public.commerce_read_payment_checkout(p_user_id,x.id) order by x.created_at desc),'[]') into result
 from (select id,created_at from private.payment_checkout_sessions where user_id=p_user_id order by created_at desc limit 30) x;return result;
end $$;
create function public.commerce_claim_checkout_payment(p_user_id uuid,p_session_id uuid,p_mode text,p_integration_id bigint) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare s private.payment_checkout_sessions;a private.payment_checkout_attempts;
begin
 perform private.checkout_authorize(p_user_id);perform private.cod_authorize(p_user_id);
 select * into s from private.payment_checkout_sessions where id=p_session_id and user_id=p_user_id for update;
 if not found then raise exception 'Checkout not found.';end if;
 select * into a from private.payment_checkout_attempts where session_id=s.id;
 if found then return jsonb_build_object('created',false);end if;
 if not exists(select 1 from private.payment_checkout_settings where id and enabled) or s.state<>'prepared' or s.expires_at<=clock_timestamp()
  or p_mode not in ('test','live') or p_integration_id is null or p_integration_id<1 or s.snapshot#>>'{order,payment_method}'<>'card'
  or not exists(select 1 from public.site_settings where key='default' and payment_card_enabled) then raise exception 'Checkout cannot start payment.';end if;
 insert into private.payment_checkout_attempts(session_id,mode,integration_id,amount_minor,currency)
 values(s.id,p_mode,p_integration_id,((s.snapshot#>>'{review,totalAmount}')::numeric*100)::bigint,'EGP') returning * into a;
 update private.payment_checkout_sessions set state='opening',updated_at=clock_timestamp() where id=s.id;
 return jsonb_build_object('created',true,'attempt',to_jsonb(a),'snapshot',s.snapshot,'reference',s.reference);
end $$;

create function private.finalize_payment_checkout(p_session_id uuid) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare s private.payment_checkout_sessions;f private.payment_checkout_funds;a private.payment_checkout_attempts;o public.customer_orders;
 oid uuid;line jsonb;pid uuid;vid uuid;tracked boolean;v_order jsonb;review jsonb;
begin
 perform private.checkout_server();select * into s from private.payment_checkout_sessions where id=p_session_id for update;
 if not found then raise exception 'Checkout not found.';end if;
 select * into o from public.customer_orders where checkout_session_id=s.id;
 if found then
  update private.payment_checkout_sessions set order_id=o.id,state='paid',updated_at=clock_timestamp() where id=s.id;
  return jsonb_build_object('created',false,'order_id',o.id);
 end if;
 select * into f from private.payment_checkout_funds where session_id=s.id and is_primary;
 review:=s.snapshot->'review';v_order:=s.snapshot->'order';
 if not found or f.amount_minor<>(review->>'totalAmount')::numeric*100 or f.currency<>'EGP' then raise exception 'Verified funds required.';end if;
 if (f.kind='paymob' and v_order->>'payment_method'<>'card') or (f.kind='instapay' and v_order->>'payment_method'<>'instapay') then raise exception 'Funds method mismatch.';end if;
 if f.kind='paymob' then
  select * into a from private.payment_checkout_attempts where session_id=s.id;
  if not found or a.mode<>'live' or a.status<>'succeeded' or a.provider_order_id is null then raise exception 'Verified live gateway receipt required.';end if;
 elsif f.kind<>'instapay' then raise exception 'Unsupported funds.';end if;
 oid:=gen_random_uuid();tracked:=coalesce((s.snapshot->>'inventory_required')::boolean,true) or coalesce((select inventory_tracking_required from public.site_settings where key='default'),true);
 update private.payment_checkout_sessions set state='finalizing',order_id=oid,updated_at=clock_timestamp() where id=s.id;
 perform set_config('app.warranty_purchase_capture','on',true);perform set_config('app.order_sms_locale',coalesce(v_order->>'locale','en'),true);
 insert into public.customer_orders(id,user_id,checkout_cart_id,checkout_session_id,order_number,status,first_name,last_name,email,phone,street_address,city,governorate,shipping_method,
  shipping_company_id,payment_method,subtotal_amount,discount_amount,delivery_discount_amount,coupon_code,total_amount,currency,stock_fulfillment_state,fulfillment_message)
 values(oid,case when exists(select 1 from auth.users where id=s.user_id) then s.user_id end,s.cart_id,s.id,
  'ORD-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||upper(substr(replace(oid::text,'-',''),1,10)),case when tracked then 'on_hold' else 'pending_payment' end,
  v_order->>'first_name',nullif(v_order->>'last_name',''),v_order->>'email',v_order->>'phone',v_order->>'street_address',v_order->>'city',v_order->>'governorate','shipping',
  nullif(v_order->>'shipping_company_id','')::uuid,v_order->>'payment_method',(review->>'orderValue')::numeric,(review->>'discountAmount')::numeric,coalesce((review->>'deliveryDiscountAmount')::numeric,0),
  v_order->>'coupon_code',(review->>'totalAmount')::numeric,'EGP',case when tracked then 'awaiting_stock' else 'untracked' end,case when tracked then 'Stock allocation requires staff review.' else '' end)
 returning * into o;
 for line in select value from jsonb_array_elements(s.snapshot->'items') loop
  select id into pid from public.products where id=(line->>'product_id')::uuid;
  vid:=null;if pid is not null then select id into vid from public.product_variants where id=nullif(line->>'variant_id','')::uuid and product_id=pid;end if;
  insert into public.customer_order_items(order_id,product_id,variant_id,product_title,product_slug,image_url,product_sku,variant_name,variant_code,variant_sku,variant_color_name,variant_color_hex,unit_price,quantity,line_total)
  values(oid,pid,vid,line->>'product_title',line->>'product_slug',case when exists(select 1 from public.products where id=pid and image_url=line->>'image_url') then line->>'image_url' end,line->>'product_sku',line->>'variant_name',line->>'variant_code',line->>'variant_sku',line->>'variant_color_name',line->>'variant_color_hex',
   (line->>'unit_price')::numeric,(line->>'quantity')::integer,(line->>'line_total')::numeric);
 end loop;
 if f.kind='paymob' then
  insert into public.payment_attempts(id,order_id,provider,method,mode,integration_id,amount_minor,currency,status,intention_id,provider_order_id,client_secret,paid_at,expires_at)
  values(a.id,oid,'paymob','card','live',a.integration_id,a.amount_minor,a.currency,'succeeded',a.intention_id,a.provider_order_id,null,f.verified_at,s.expires_at);
  insert into public.payment_transactions(attempt_id,provider,transaction_id,status) values(a.id,'paymob',f.reference,'succeeded');
 end if;
 update public.customer_orders set payment_status='paid',amount_paid=total_amount,paid_at=f.verified_at,status=case when tracked then 'on_hold' else 'processing' end,updated_at=clock_timestamp() where id=oid returning * into o;
 if v_order->>'coupon_code' is not null then update public.site_coupons set usage_count=usage_count+1,updated_at=clock_timestamp() where upper(code)=v_order->>'coupon_code';end if;
 insert into private.checkout_commands(user_id,command_id,intent_hash,quote_id,order_id) values(s.user_id,s.cart_id,s.intent_hash,s.quote_id,oid);
 update private.payment_checkout_sessions set state='paid',review_reason=null,updated_at=clock_timestamp() where id=s.id;
 return jsonb_build_object('created',true,'order_id',oid,'user_id',s.user_id,'cart_id',s.cart_id);
end $$;

create function private.apply_checkout_callback(p_provider_order_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a private.payment_checkout_attempts;s private.payment_checkout_sessions;r private.payment_callback_inbox;f private.payment_checkout_funds;result jsonb;primary_exists boolean;
begin
 select * into a from private.payment_checkout_attempts where provider_order_id=p_provider_order_id;
 if not found then return jsonb_build_object('matched',false);end if;
 select * into s from private.payment_checkout_sessions where id=a.session_id for update;
 select * into a from private.payment_checkout_attempts where id=a.id for update;
 for r in select * from private.payment_callback_inbox where provider_order_id=p_provider_order_id and not processed order by (status='succeeded') desc,received_at,transaction_id limit 20 for update loop
  if r.mode<>a.mode or r.integration_id<>a.integration_id or r.amount_minor<>a.amount_minor or r.currency<>a.currency then
   update private.payment_callback_inbox set error_code='context_mismatch' where transaction_id=r.transaction_id;
   update private.payment_checkout_sessions set state=case when order_id is not null then state else 'review' end,review_reason='payment_context_mismatch' where id=s.id;continue;
  end if;
  if r.status='succeeded' then
   update private.payment_checkout_attempts set status='succeeded',paid_at=coalesce(paid_at,r.received_at),client_secret=null,error_code=null where id=a.id returning * into a;
   if a.mode='live' then
    select * into f from private.payment_checkout_funds where kind='paymob' and reference=r.transaction_id;
    if not found then
     select exists(select 1 from private.payment_checkout_funds where session_id=s.id and is_primary) into primary_exists;
     insert into private.payment_checkout_funds(session_id,kind,reference,amount_minor,currency,is_primary,verified_at)
     values(s.id,'paymob',r.transaction_id,r.amount_minor,r.currency,not primary_exists,r.received_at) returning * into f;
    end if;
    if f.session_id<>s.id then raise exception 'Transaction belongs to another checkout.';end if;
    if f.is_primary then
     begin result:=private.finalize_payment_checkout(s.id);
     exception when others then update private.payment_checkout_sessions set state=case when order_id is not null then state else 'review' end,review_reason='paid_order_requires_recovery',updated_at=clock_timestamp() where id=s.id;
     end;
    else update private.payment_checkout_sessions set review_reason='additional_verified_payment' where id=s.id;end if;
   end if;
  elsif a.status<>'succeeded' then
   update private.payment_checkout_attempts set status=case when status='failed' and r.status='pending' then status else r.status end where id=a.id returning * into a;
   update private.payment_checkout_sessions set state=case when a.status='failed' then 'failed' else 'pending' end,updated_at=clock_timestamp() where id=s.id;
  end if;
  update private.payment_callback_inbox set processed=true,error_code=null where transaction_id=r.transaction_id;
 end loop;
 return coalesce(result,'{}')||jsonb_build_object('matched',true);
end $$;
create function public.commerce_accept_payment_callback(p_transaction jsonb) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare r private.payment_callback_inbox;t text:=p_transaction->>'transaction_id';result jsonb;
begin
 perform private.checkout_server();
 perform pg_advisory_xact_lock(hashtextextended('checkout-provider-order:'||coalesce(p_transaction->>'provider_order_id',''),0));
 if t is null or t!~'^[0-9]{1,18}$' or coalesce(p_transaction->>'provider_order_id','')!~'^[0-9]{1,18}$'
  or coalesce(p_transaction->>'status','') not in ('pending','failed','succeeded') or coalesce(p_transaction->>'mode','') not in ('test','live')
  or coalesce(p_transaction->>'currency','')<>'EGP' or coalesce((p_transaction->>'amount_minor')::bigint,0)<1 or coalesce((p_transaction->>'integration_id')::bigint,0)<1 then raise exception 'Invalid payment receipt.';end if;
 perform pg_advisory_xact_lock(hashtextextended('gateway-transaction:'||t,0));
 select * into r from private.payment_callback_inbox where transaction_id=t for update;
 if found and (r.provider_order_id<>p_transaction->>'provider_order_id' or r.mode<>p_transaction->>'mode' or r.integration_id<>(p_transaction->>'integration_id')::bigint or r.amount_minor<>(p_transaction->>'amount_minor')::bigint or r.currency<>p_transaction->>'currency') then raise exception 'Receipt context mismatch.';end if;
 insert into private.payment_callback_inbox(transaction_id,provider_order_id,mode,integration_id,amount_minor,currency,status,evidence_sha256,signature_sha256)
 values(t,p_transaction->>'provider_order_id',p_transaction->>'mode',(p_transaction->>'integration_id')::bigint,(p_transaction->>'amount_minor')::bigint,p_transaction->>'currency',p_transaction->>'status',p_transaction->>'evidence_sha256',p_transaction->>'signature_sha256')
 on conflict(transaction_id) do update set status=case when payment_callback_inbox.status='succeeded' then 'succeeded' when payment_callback_inbox.status='failed' and excluded.status='pending' then 'failed' else excluded.status end,
  processed=case when payment_callback_inbox.status=excluded.status or payment_callback_inbox.status='succeeded' or payment_callback_inbox.status='failed' and excluded.status='pending' then payment_callback_inbox.processed else false end,updated_at=clock_timestamp();
 if p_transaction->>'evidence_sha256'~'^[a-f0-9]{64}$' and p_transaction->>'signature_sha256'~'^[a-f0-9]{64}$' then
  insert into private.payment_callback_receipts(transaction_id,evidence_sha256,signature_sha256,status)
  values(t,p_transaction->>'evidence_sha256',p_transaction->>'signature_sha256',p_transaction->>'status') on conflict do nothing;
 end if;
 result:=private.apply_checkout_callback(p_transaction->>'provider_order_id');
 if result->>'matched'='true' then return result;end if;
 if exists(select 1 from public.payment_attempts where provider_order_id=p_transaction->>'provider_order_id') then
  perform public.commerce_reconcile_payment_transaction(p_transaction);
  update private.payment_callback_inbox set processed=true where transaction_id=t;
  return jsonb_build_object('matched',true,'legacy',true);
 end if;
 return jsonb_build_object('matched',false,'durable',true);
end $$;
create function public.commerce_store_checkout_intention(p_attempt_id uuid,p_intention_id text,p_provider_order_id text,p_client_secret text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a private.payment_checkout_attempts;
begin
 perform private.checkout_server();perform pg_advisory_xact_lock(hashtextextended('checkout-provider-order:'||coalesce(p_provider_order_id,''),0));select * into a from private.payment_checkout_attempts where id=p_attempt_id for update;
 if not found or a.intention_id is not null or a.status not in ('initiated','uncertain') or p_intention_id!~('^pi_'||a.mode||'_.+$') or length(p_intention_id)>160
  or p_provider_order_id!~'^[0-9]{1,18}$' or p_client_secret!~('^(egy_)?csk_'||a.mode||'_.+$') or length(p_client_secret)>512 then raise exception 'Invalid intention receipt.';end if;
 if exists(select 1 from public.payment_attempts where provider_order_id=p_provider_order_id and id<>a.id) then raise exception 'Provider order is already bound.';end if;
 update private.payment_checkout_attempts set intention_id=p_intention_id,provider_order_id=p_provider_order_id,client_secret=p_client_secret,status='pending',error_code=null where id=a.id;
 update private.payment_checkout_sessions set state='pending',updated_at=clock_timestamp() where id=a.session_id;
 return private.apply_checkout_callback(p_provider_order_id);
end $$;
create function public.commerce_checkout_payment_uncertain(p_attempt_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin perform private.checkout_server();update private.payment_checkout_attempts set status='uncertain',error_code='intention_uncertain' where id=p_attempt_id and status='initiated';
 update private.payment_checkout_sessions s set state='uncertain' from private.payment_checkout_attempts a where a.id=p_attempt_id and a.session_id=s.id and a.status='uncertain';end $$;
create function public.commerce_recover_funded_checkout(p_session_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform private.checkout_server();return private.finalize_payment_checkout(p_session_id);end $$;

-- Cached/controlled clients cannot create a new unpaid prepaid order after activation.
alter function public.commerce_checkout_command(uuid,uuid,uuid,jsonb,jsonb) rename to commerce_checkout_command_before_payment_first;
create function public.commerce_admin_recover_funded_checkout(p_actor uuid,p_session_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 perform private.checkout_staff(p_actor,'payments.verify');
 perform private.checkout_staff(p_actor,'payments.review');
 if not exists(select 1 from private.payment_checkout_funds where session_id=p_session_id and is_primary) then raise exception 'Verified funds required.';end if;
 result:=public.commerce_recover_funded_checkout(p_session_id);
 insert into public.admin_activity_logs(admin_user_id,author_name,author_email,author_role,action_key,description,metadata)
 select id,coalesce(full_name,email),email,role,'payments.checkout.recover','Recovered a verified payment order.',jsonb_build_object('session_id',p_session_id,'order_id',result->>'order_id') from public.admin_users where id=p_actor;
 return result;
end $$;

create function public.commerce_checkout_command(p_user_id uuid,p_cart_id uuid,p_quote_id uuid,p_order jsonb,p_items jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform private.checkout_authorize(p_user_id);
 perform pg_advisory_xact_lock(hashtextextended('checkout-command:'||p_cart_id::text,0));
 if exists(select 1 from private.payment_checkout_sessions where cart_id=p_cart_id and (user_id<>p_user_id or state<>'paid')) then raise exception 'payment_first:existing';end if;
 if p_order->>'payment_method'<>'cash' and exists(select 1 from private.payment_checkout_settings where id and (enabled or enabled_since is not null))
  and not exists(select 1 from private.checkout_commands where user_id=p_user_id and command_id=p_cart_id) then raise exception 'payment_first:session_required';end if;
 return public.commerce_checkout_command_before_payment_first(p_user_id,p_cart_id,p_quote_id,p_order,p_items);
end $$;
revoke all on function public.commerce_checkout_command_before_payment_first(uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;

-- Drain durable callback-before-persistence receipts for grandfathered orders too.
alter function public.commerce_store_payment_intention(uuid,text,text,text) rename to commerce_store_payment_intention_before_payment_first;
create function public.commerce_store_payment_intention(p_attempt_id uuid,p_intention_id text,p_provider_order_id text,p_client_secret text) returns void
language plpgsql security definer set search_path='' as $$
declare r private.payment_callback_inbox;begin
 perform private.checkout_server();perform pg_advisory_xact_lock(hashtextextended('checkout-provider-order:'||coalesce(p_provider_order_id,''),0));
 if exists(select 1 from private.payment_checkout_attempts where provider_order_id=p_provider_order_id and id<>p_attempt_id) then raise exception 'Provider order is already bound.';end if;
 perform public.commerce_store_payment_intention_before_payment_first(p_attempt_id,p_intention_id,p_provider_order_id,p_client_secret);
 for r in select * from private.payment_callback_inbox where provider_order_id=p_provider_order_id and not processed order by (status='succeeded') desc,received_at,transaction_id limit 20 for update loop
  perform public.commerce_reconcile_payment_transaction(to_jsonb(r));update private.payment_callback_inbox set processed=true where transaction_id=r.transaction_id;
 end loop;
end $$;
revoke all on function public.commerce_store_payment_intention_before_payment_first(uuid,text,text,text),public.commerce_store_payment_intention(uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.commerce_store_payment_intention(uuid,text,text,text) to service_role;

do $coverage$ declare d text;a text:=$needle$'checkout_commands'$needle$;begin
 d:=pg_get_functiondef('catalog_private.reset_assert_coverage()'::regprocedure);
 if position(a in d)=0 then raise exception 'Review prepaid reset coverage.';end if;
 execute replace(d,a,$replacement$'checkout_commands','payment_checkout_settings','payment_checkout_sessions','payment_checkout_attempts','payment_callback_inbox','payment_callback_receipts','payment_checkout_funds'$replacement$);
end $coverage$;
-- Every private audit record is retained. Refuse destructive financial resets.
create function private.payment_checkout_reset_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin if new.scope in ('orders','commerce','full') and exists(select 1 from private.payment_checkout_sessions) then raise exception 'Preserve checkout payment evidence before a financial reset.';end if;return new;end $$;
create trigger a_payment_checkout_evidence_guard before insert on public.system_reset_runs for each row execute function private.payment_checkout_reset_guard();

do $privileges$ declare t text;r record;begin
 foreach t in array array['payment_checkout_settings','payment_checkout_sessions','payment_checkout_attempts','payment_callback_inbox','payment_callback_receipts','payment_checkout_funds'] loop
  execute format('alter table private.%I enable row level security',t);
  execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
 end loop;
 for r in select p.oid::regprocedure signature,n.nspname schema from pg_proc p join pg_namespace n on n.oid=p.pronamespace where
  (n.nspname='private' and p.proname in ('checkout_server','checkout_staff','checkout_callback_receipt_immutable','checkout_immutable','checkout_funded','checkout_order_insert_guard','checkout_order_update_guard','finalize_payment_checkout','apply_checkout_callback','payment_checkout_reset_guard'))
  or (n.nspname='public' and p.proname in ('commerce_payment_checkout_readiness','commerce_payment_checkout_configure','commerce_payment_checkout_admin','commerce_payment_checkout_monitor','commerce_prepare_payment_checkout','commerce_read_payment_checkout','commerce_list_payment_checkouts','commerce_claim_checkout_payment','commerce_accept_payment_callback','commerce_store_checkout_intention','commerce_checkout_payment_uncertain','commerce_recover_funded_checkout','commerce_admin_recover_funded_checkout','commerce_checkout_command')) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',r.signature);
  if r.schema='public' then execute format('grant execute on function %s to service_role',r.signature);end if;
 end loop;
end $privileges$;
-- Preserve the previously qualified legacy cancellation hold.
create or replace function private.release_unpaid_card_stock() returns trigger
language plpgsql security definer set search_path='' as $$
declare attempt public.payment_attempts%rowtype; item public.customer_order_items%rowtype;
 product public.products%rowtype; unit public.commerce_serialized_units%rowtype; restored integer; balance integer;
 original_warehouse uuid; warehouse_count integer;
 previous text:=coalesce(current_setting('app.serialized_inventory_write',true),'');
begin
 if old.stock_reservation_released_at is not null and new.status not in ('cancelled','refunded') then
  raise exception 'A released reservation cannot be reopened.';end if;
 if new.status<>'cancelled' or old.status='cancelled' or old.payment_method<>'card' or not old.card_checkout_verified
  or old.is_preorder or old.payment_status not in ('pending','failed') or old.amount_paid<>0 then return new;end if;
 if old.stock_reservation_released_at is not null then return new;end if;
 perform public.assert_built_in_erp();
 select * into attempt from public.payment_attempts where order_id=old.id and provider='paymob' for update;
 -- An elapsed local deadline or failed transaction does not prove provider finality.
 -- Hold every existing attempt until a separately qualified finality contract exists.
 if found then raise exception 'Reconcile this payment before cancellation.';end if;
 if exists(select 1 from public.order_packing_sessions where order_id=old.id and status in ('active','completed'))
  or exists(select 1 from public.shipping_order_jobs where order_id=old.id and (dispatch_started_at is not null or awb is not null)) then
  raise exception 'Review packing or shipment before cancellation.';end if;
 if old.stock_fulfillment_state='ready' then
  perform set_config('app.serialized_inventory_write','on',true);
  for item in select * from public.customer_order_items where order_id=old.id order by product_id,variant_id,id loop
   select * into product from public.products where id=item.product_id for update;
   if not found then raise exception 'Original stock location requires review.';end if;
   select min(warehouse_id::text)::uuid,count(distinct warehouse_id)::integer into original_warehouse,warehouse_count
    from public.commerce_inventory_movements where reference_id=old.id and product_id=product.id and movement_type='sale_out';
   if original_warehouse is null or warehouse_count<>1 then raise exception 'Original stock location requires review.';end if;
   if product.is_serialized then
    perform 1 from public.product_variants where id=item.variant_id and product_id=product.id for update;
    if not found then raise exception 'Original product option requires review.';end if;
    restored:=0;
    for unit in select * from public.commerce_serialized_units where customer_order_id=old.id
     and customer_order_item_id=item.id and product_id=product.id and variant_id=item.variant_id
     and warehouse_id=original_warehouse and status='sold' order by id for update loop
     update public.commerce_serialized_units set status='in_stock',customer_order_id=null,customer_order_item_id=null,
      customer_user_id=null,sold_at=null,returned_at=null,updated_at=clock_timestamp() where id=unit.id;
     insert into public.commerce_serialized_unit_movements(unit_id,product_id,variant_id,warehouse_id,customer_order_id,
      movement_type,from_status,to_status,notes) values(unit.id,product.id,item.variant_id,unit.warehouse_id,old.id,
      'returned','sold','in_stock','Unpaid order cancelled; reservation released.');
     restored:=restored+1;
    end loop;
    if restored<>item.quantity then raise exception 'Original stock allocation requires review.';end if;
    update public.product_variants set stock_quantity=stock_quantity+restored,updated_at=clock_timestamp() where id=item.variant_id;
   end if;
   update public.products set stock_quantity=stock_quantity+item.quantity where id=product.id;
   update public.commerce_warehouse_inventory set quantity=quantity+item.quantity,updated_at=clock_timestamp()
    where warehouse_id=original_warehouse and product_id=product.id returning quantity into balance;
   if not found then raise exception 'Original warehouse balance requires review.';end if;
   insert into public.commerce_inventory_movements(warehouse_id,product_id,movement_type,reference_type,reference_id,
    quantity_change,quantity_after,unit_cost,notes) values(original_warehouse,product.id,'return_in','manual',old.id,
    item.quantity,balance,coalesce(product.cost_price,0),'Unpaid order cancelled; reservation released.');
  end loop;
  perform set_config('app.serialized_inventory_write',previous,true);
 end if;
 update public.payment_attempts set status='cancelled',client_secret=null,updated_at=clock_timestamp()
  where order_id=old.id and status<>'succeeded';
 new.stock_reservation_released_at:=clock_timestamp();
 return new;
end $$;
notify pgrst,'reload schema';

notify pgrst,'reload schema';
commit;
