-- Independent inactive tracking increment after freshly inspected schema113; candidate115 follows discovery114.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create table private.meta_settings (
 id boolean primary key default true check(id), enabled boolean not null default false,
 capi_enabled boolean not null default false, pixel_id text not null default '',
 token_encrypted text, test_event_code text not null default '', graph_version text not null default 'v26.0',
 revision integer not null default 0, enabled_since timestamptz,
 test_customer_id uuid references auth.users(id),test_started_at timestamptz,test_expires_at timestamptz,test_event_limit integer not null default 0 check(test_event_limit between 0 and 20),
 check(pixel_id='' or pixel_id~'^[0-9]{5,30}$'),check(graph_version~'^v[0-9]{2,3}\.0$'),
 check(test_event_code='' or test_event_code~'^[A-Za-z0-9_-]{1,100}$'),
 check(not enabled or pixel_id<>''),check(not capi_enabled or token_encrypted is not null)
);
insert into private.meta_settings(id) values(true);
create table private.meta_consents (
 id uuid primary key default gen_random_uuid(), token_hash text not null unique check(token_hash~'^[a-f0-9]{64}$'),
 granted boolean not null, policy_revision integer not null, created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp()+interval '180 days', revoked_at timestamptz,
 user_agent text not null default '' check(length(user_agent)<=512),fbp text,fbc text,user_id uuid references auth.users(id) on delete set null,
 check(fbp is null or fbp~'^fb\.[0-9]\.[0-9]{10,13}\.[A-Za-z0-9._-]{1,200}$'),
 check(fbc is null or fbc~'^fb\.[0-9]\.[0-9]{10,13}\.[A-Za-z0-9._-]{1,200}$')
);
create table private.meta_checkout_consents (
 user_id uuid not null, cart_id uuid not null, consent_id uuid not null references private.meta_consents(id) on delete restrict,
 source_path text not null default '/checkout', quote_data jsonb,quote_expires_at timestamptz, created_at timestamptz not null default clock_timestamp(),
 primary key(user_id,cart_id)
);
create table private.meta_event_outbox (
 id uuid primary key default gen_random_uuid(), event_name text not null,
 event_id text not null, order_id uuid, consent_id uuid not null references private.meta_consents(id) on delete restrict,
 settings_revision integer not null, event_time timestamptz not null default clock_timestamp(),
 source_path text not null, custom_data jsonb not null default '{}',
 state text not null default 'pending' check(state in ('pending','dispatching','delivered','retry','held','suppressed')),
 attempts integer not null default 0 check(attempts between 0 and 5), lease_id uuid, lease_until timestamptz,
 next_attempt_at timestamptz not null default clock_timestamp(), outcome text, delivered_at timestamptz,browser_claimed_at timestamptz,
 unique(event_name,event_id),
 check(event_name in ('PageView','ViewContent','Search','AddToCart','InitiateCheckout','AddPaymentInfo','Purchase','CODOrderPlaced')),
 check(length(event_id) between 1 and 100),check(jsonb_typeof(custom_data)='object')
);
create index meta_event_pending on private.meta_event_outbox(next_attempt_at) where state in ('pending','retry','dispatching');
create function private.meta_event_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Tracking receipts are retained.';end if;
 if (new.event_name,new.event_id,new.order_id,new.consent_id,new.settings_revision,new.event_time,new.source_path,new.custom_data)
 is distinct from (old.event_name,old.event_id,old.order_id,old.consent_id,old.settings_revision,old.event_time,old.source_path,old.custom_data)
 then raise exception 'Tracking event identity is immutable.';end if;
 return new;
end $$;
create trigger meta_event_immutable before update or delete on private.meta_event_outbox for each row execute function private.meta_event_immutable();
create function private.meta_staff(p_actor uuid,p_write boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.checkout_server();
 if not exists(select 1 from public.admin_users where id=p_actor and is_active and
 (role='owner' or coalesce((permissions->>'settings.view')::boolean,false) and
 (not p_write or coalesce((permissions->>'settings.edit')::boolean,false))))
 then raise exception 'Settings permission required.' using errcode='42501';end if;
end $$;
create function public.commerce_meta_settings(p_actor uuid default null,p_customer uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.checkout_server();if p_actor is not null then perform private.meta_staff(p_actor,false);end if;
 return (select jsonb_build_object('enabled',enabled and (p_actor is not null or test_event_code='' or coalesce(test_customer_id=p_customer and test_expires_at>clock_timestamp(),false)),'capiEnabled',capi_enabled,'pixelId',pixel_id,'revision',revision,
 'graphVersion',graph_version,'testEventCode',case when p_actor is not null then test_event_code else '' end,
 'testMode',test_event_code<>'','testCustomerId',case when p_actor is not null then test_customer_id end,'testWindowMinutes',15,'testEventLimit',case when p_actor is not null then test_event_limit else 0 end,'testExpiresAt',case when p_actor is not null or test_customer_id=p_customer then test_expires_at end,'tokenSet',case when p_actor is not null then token_encrypted is not null else false end) from private.meta_settings where id);
end $$;
create function public.commerce_meta_configure(p_actor uuid,p_revision integer,p_config jsonb,p_token text default null,p_clear_token boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s private.meta_settings;begin
 perform private.meta_staff(p_actor,true);
 if jsonb_typeof(p_config)<>'object' or exists(select 1 from jsonb_object_keys(p_config) k where k not in ('enabled','capiEnabled','pixelId','graphVersion','testEventCode','testCustomerId','testWindowMinutes','testEventLimit'))
 or jsonb_typeof(p_config->'enabled')<>'boolean' or jsonb_typeof(p_config->'capiEnabled')<>'boolean'
 or (p_token is not null and (length(p_token)>8192 or p_token!~'^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'))
 then raise exception 'Invalid tracking settings.' using errcode='22023';end if;
 select * into s from private.meta_settings where id for update;
 if s.revision<>p_revision then raise exception 'Tracking settings changed.' using errcode='P0001';end if;
 if s.test_event_code<>'' and coalesce(p_config->>'testEventCode','')='' and ((p_config->>'enabled')::boolean or (p_config->>'capiEnabled')::boolean) then raise exception 'Disable tracking before removing Test Events configuration.';end if;
 if coalesce(p_config->>'testEventCode','')<>'' and (p_config->>'enabled')::boolean then
  if nullif(p_config->>'testCustomerId','') is null or not exists(select 1 from auth.users where id=(p_config->>'testCustomerId')::uuid)
   or public.store_analytics_is_internal_user((p_config->>'testCustomerId')::uuid)
   or coalesce((p_config->>'testWindowMinutes')::integer,0) not between 1 and 30
   or coalesce((p_config->>'testEventLimit')::integer,0) not between 1 and 20 then raise exception 'Choose a non-staff test customer, bounded window and event limit.';end if;
 end if;

 update private.meta_settings set enabled=(p_config->>'enabled')::boolean,capi_enabled=(p_config->>'capiEnabled')::boolean,
 pixel_id=coalesce(p_config->>'pixelId',''),graph_version=coalesce(p_config->>'graphVersion','v26.0'),test_event_code=coalesce(p_config->>'testEventCode',''),
 test_customer_id=nullif(p_config->>'testCustomerId','')::uuid,test_started_at=case when coalesce(p_config->>'testEventCode','')<>'' and (p_config->>'enabled')::boolean then clock_timestamp() end,
 test_expires_at=case when coalesce(p_config->>'testEventCode','')<>'' and (p_config->>'enabled')::boolean then clock_timestamp()+make_interval(mins=>(p_config->>'testWindowMinutes')::integer) end,test_event_limit=coalesce((p_config->>'testEventLimit')::integer,0),
 token_encrypted=case when p_clear_token then null else coalesce(p_token,token_encrypted) end,
 enabled_since=case when (p_config->>'enabled')::boolean and not s.enabled then clock_timestamp() else enabled_since end,
 revision=revision+1 where id;
 update private.meta_event_outbox set state='suppressed',outcome='configuration_changed',lease_id=null,lease_until=null where state in ('pending','retry','dispatching');
 insert into public.admin_activity_logs(admin_user_id,author_name,author_email,author_role,action_key,description,metadata)
 select id,coalesce(full_name,email),email,role,'marketing.meta.configure','Updated tracking controls.',jsonb_build_object('revision',s.revision+1,'enabled',p_config->'enabled','token_changed',p_token is not null or p_clear_token) from public.admin_users where id=p_actor;
 return public.commerce_meta_settings(p_actor);
end $$;
create function public.commerce_meta_consent(p_hash text,p_granted boolean,p_agent text default '',p_user uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.meta_settings;c private.meta_consents;begin
 perform private.checkout_server();select * into s from private.meta_settings where id;
 if p_hash!~'^[a-f0-9]{64}$' or p_granted is null then raise exception 'Invalid consent.';end if;
 if p_granted and not s.enabled then return jsonb_build_object('granted',false);end if;
 if p_granted and s.test_event_code<>'' and (p_user is distinct from s.test_customer_id or s.test_expires_at is null or s.test_expires_at<=clock_timestamp() or public.store_analytics_is_internal_user(p_user)) then return jsonb_build_object('granted',false);end if;
 if p_granted and exists(select 1 from private.meta_consents where token_hash=p_hash and revoked_at is not null) then return jsonb_build_object('granted',false);end if;
 insert into private.meta_consents(token_hash,granted,policy_revision,user_agent,user_id)
 values(p_hash,p_granted,s.revision,case when p_granted then left(coalesce(p_agent,''),512) else '' end,case when p_granted then p_user end)
 on conflict(token_hash) do update set granted=excluded.granted,revoked_at=case when not excluded.granted then clock_timestamp() end,
 user_agent=excluded.user_agent,user_id=excluded.user_id,fbp=case when excluded.granted then meta_consents.fbp end,fbc=case when excluded.granted then meta_consents.fbc end,
 policy_revision=excluded.policy_revision,expires_at=clock_timestamp()+interval '180 days' returning * into c;
 if not p_granted then update private.meta_event_outbox set state='suppressed',outcome='consent_revoked',lease_id=null,lease_until=null where consent_id=c.id and state in ('pending','retry','dispatching');end if;
 return jsonb_build_object('granted',c.granted,'revision',s.revision);
end $$;
create function private.meta_allowed(p_hash text) returns uuid language plpgsql stable security definer set search_path='' as $$
declare cid uuid;begin
 select c.id into cid from private.meta_consents c cross join private.meta_settings s where s.id and s.enabled
 and c.token_hash=p_hash and c.granted and c.expires_at>clock_timestamp() and c.policy_revision=s.revision and (s.test_event_code='' or c.user_id=s.test_customer_id and s.test_expires_at>clock_timestamp());
 return cid;
end $$;
create function public.commerce_meta_context(p_hash text,p_fbp text default null,p_fbc text default null) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform private.checkout_server();
 if p_fbp is not null and p_fbp!~'^fb\.[0-9]\.[0-9]{10,13}\.[A-Za-z0-9._-]{1,200}$' or p_fbc is not null and p_fbc!~'^fb\.[0-9]\.[0-9]{10,13}\.[A-Za-z0-9._-]{1,200}$' then return false;end if;
 update private.meta_consents set fbp=coalesce(p_fbp,fbp),fbc=coalesce(p_fbc,fbc) where id=private.meta_allowed(p_hash);return found;
end $$;
create function public.commerce_meta_bind_checkout(p_user uuid,p_cart uuid,p_hash text) returns boolean language plpgsql security definer set search_path='' as $$
declare cid uuid;begin
 perform private.checkout_authorize(p_user);cid:=private.meta_allowed(p_hash);
 if cid is null or p_cart is null or public.store_analytics_is_internal_user(p_user) then return false;end if;
 insert into private.meta_checkout_consents(user_id,cart_id,consent_id) values(p_user,p_cart,cid)
 on conflict(user_id,cart_id) do update set consent_id=excluded.consent_id,created_at=clock_timestamp();return true;
end $$;
create function public.commerce_meta_quote(p_user uuid,p_cart uuid,p_hash text,p_data jsonb,p_expires timestamptz) returns boolean
language plpgsql security definer set search_path='' as $$
declare cid uuid;begin
 perform private.checkout_authorize(p_user);cid:=private.meta_allowed(p_hash);
 if cid is null or public.store_analytics_is_internal_user(p_user) or p_cart is null then return false;end if;
 if jsonb_typeof(p_data)<>'object' or p_data->>'currency'<>'EGP' or jsonb_typeof(p_data->'contents')<>'array'
 or jsonb_array_length(p_data->'contents') not between 1 and 100 or (p_data->>'value')::numeric<0
 or p_expires is null or p_expires<=clock_timestamp() or p_expires>clock_timestamp()+interval '6 minutes'
 then raise exception 'Invalid quote context.';end if;
 insert into private.meta_checkout_consents(user_id,cart_id,consent_id,quote_data,quote_expires_at)
 values(p_user,p_cart,cid,p_data,p_expires) on conflict(user_id,cart_id)
 do update set consent_id=excluded.consent_id,quote_data=excluded.quote_data,quote_expires_at=excluded.quote_expires_at,created_at=clock_timestamp();return true;
end $$;
create function private.meta_capture_order(p_order uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare o public.customer_orders;s private.meta_settings;cid uuid;f private.payment_checkout_funds;
 data jsonb;ename text;valid boolean:=false;begin
 select * into s from private.meta_settings where id;if not s.enabled or s.test_event_code<>'' then return false;end if;
 select * into o from public.customer_orders where id=p_order;
 if not found or o.created_at<s.enabled_since or o.currency<>'EGP' or o.status in ('cancelled','refunded') or o.user_id is null then return false;end if;
 select c.id into cid from private.meta_checkout_consents m join private.meta_consents c on c.id=m.consent_id
 where m.user_id=o.user_id and m.cart_id=o.checkout_cart_id and c.granted and c.expires_at>clock_timestamp()
 and c.policy_revision=s.revision and m.created_at<=o.created_at and not public.store_analytics_is_internal_user(o.user_id);
 if cid is null then return false;end if;
 if o.payment_method='cash' then
  valid:=o.payment_status='paid' and o.amount_paid=o.total_amount and o.paid_at is not null and
   coalesce((select sum(amount) from public.order_cod_collections where order_id=o.id),0)>=o.total_amount;
  ename:=case when valid then 'Purchase' else 'CODOrderPlaced' end;
 elsif o.payment_status='paid' and o.amount_paid=o.total_amount and o.paid_at is not null and o.checkout_session_id is not null then
  select * into f from private.payment_checkout_funds where session_id=o.checkout_session_id and is_primary and currency='EGP' and amount_minor=o.total_amount*100;
  if not found then return false;end if;
  if f.kind='paymob' then valid:=exists(select 1 from private.payment_checkout_attempts a join private.payment_callback_inbox i on i.transaction_id=f.reference
   where a.session_id=o.checkout_session_id and a.mode='live' and a.status='succeeded' and i.mode='live' and i.status='succeeded' and i.processed
   and i.provider_order_id=a.provider_order_id and i.integration_id=a.integration_id and i.amount_minor=f.amount_minor and i.currency=f.currency
   and i.evidence_sha256 is not null and (i.signature_sha256 is not null
    or a.inquiry_transaction_id=i.transaction_id and a.inquiry_evidence_sha256=i.evidence_sha256 and a.inquiry_checked_at is not null));
  elsif f.kind='instapay' then valid:=f.reviewed_by is not null;
  elsif f.kind='account_balance' and to_regclass('private.customer_balance_reservations') is not null then
   execute 'select exists(select 1 from private.customer_balance_reservations r join private.customer_balance_entries e on e.id=r.debit_entry where r.session_id=$1 and r.user_id=$2 and r.state=''spent'' and r.amount_minor=$3 and e.kind=''debit'' and e.amount_minor=$3)' into valid using o.checkout_session_id,o.user_id,f.amount_minor;
  end if;
  if not valid then return false;end if;ename:='Purchase';
 else return false;end if;
 select jsonb_build_object('currency','EGP','value',o.total_amount,'content_type','product','content_ids',jsonb_agg(coalesce(variant_id,product_id)::text order by id),
 'contents',jsonb_agg(jsonb_build_object('id',coalesce(variant_id,product_id)::text,'quantity',quantity,'item_price',unit_price) order by id),'num_items',sum(quantity))
 into data from public.customer_order_items where order_id=o.id and product_id is not null;
 if data->'contents'='null'::jsonb then return false;end if;
 if ename='CODOrderPlaced' then data:=data||jsonb_build_object('payment_status','uncollected');end if;
 insert into private.meta_event_outbox(event_name,event_id,order_id,consent_id,settings_revision,event_time,source_path,custom_data,state)
 values(ename,lower(ename)||':'||o.id::text,o.id,cid,s.revision,case when valid then greatest(o.paid_at,o.created_at) else o.created_at end,'/checkout',data,case when s.capi_enabled then 'pending' else 'held' end)
 on conflict(event_name,event_id) do nothing;return true;
end $$;
create function private.meta_order_trigger() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='payment_checkout_sessions' then perform private.meta_capture_order(new.order_id);else perform private.meta_capture_order(new.id);end if;return null;
exception when others then raise log 'meta:capture_pending';return null;
end $$;
create constraint trigger meta_paid_checkout after update on private.payment_checkout_sessions deferrable initially deferred for each row execute function private.meta_order_trigger();
create constraint trigger meta_order_change after insert or update on public.customer_orders deferrable initially deferred for each row execute function private.meta_order_trigger();
create function public.commerce_meta_event(p_hash text,p_user uuid,p_event jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid;s private.meta_settings;ename text;eid text;path text;data jsonb:='{}';product jsonb;pid uuid;vid uuid;qty integer;begin
 perform private.checkout_server();cid:=private.meta_allowed(p_hash);if cid is null or (p_user is not null and public.store_analytics_is_internal_user(p_user)) then return null;end if;
 if jsonb_typeof(p_event)<>'object' or exists(select 1 from jsonb_object_keys(p_event) k where k not in ('eventName','eventId','path','productId','variantId','cartId','quantity')) then raise exception 'Invalid tracking event.';end if;
 ename:=p_event->>'eventName';eid:=p_event->>'eventId';path:=split_part(split_part(coalesce(p_event->>'path','/'), '?',1),'#',1);
 if ename not in ('PageView','ViewContent','Search','AddToCart','InitiateCheckout','AddPaymentInfo') or eid!~'^[0-9a-f-]{36}$'
 or length(path)>500 or path!~'^/' or path~'^//|[[:cntrl:]]' or path~'^/(ar/)?(dashboard|account|api|checkout/|sms/unsubscribe(/|$))' then raise exception 'Invalid tracking event.';end if;
 if ename in ('ViewContent','AddToCart') then
  pid:=(p_event->>'productId')::uuid;qty:=case when ename='ViewContent' then 1 else (p_event->>'quantity')::integer end;
  if qty is null or qty not between 1 and 99 then raise exception 'Invalid tracking quantity.';end if;
  vid:=nullif(p_event->>'variantId','')::uuid;
  select jsonb_build_object('currency','EGP','value',coalesce(v.sale_price,p.price)*qty,'content_type','product','content_ids',jsonb_build_array(coalesce(v.id,p.id)::text),
   'contents',jsonb_build_array(jsonb_build_object('id',coalesce(v.id,p.id)::text,'quantity',qty,'item_price',coalesce(v.sale_price,p.price))),'num_items',qty)
   into data from public.storefront_products p left join public.product_variants v on v.id=vid and v.product_id=p.id and v.is_active
   where p.id=pid and (vid is null or v.id is not null);
  if ename='AddToCart' and vid is null and exists(select 1 from public.storefront_products where id=pid and is_serialized) then return null;end if;
  if data is null then raise exception 'Product unavailable.';end if;
 end if;
 if ename in ('InitiateCheckout','AddPaymentInfo') then
  if p_user is null then return null;end if;
  select quote_data into data from private.meta_checkout_consents
   where user_id=p_user and cart_id=nullif(p_event->>'cartId','')::uuid and consent_id=cid and quote_expires_at>clock_timestamp();
  if data is null then return null;end if;
 end if;
 select * into s from private.meta_settings where id for update;
 if s.test_event_code<>'' then
  if p_user is distinct from s.test_customer_id or s.test_expires_at is null or s.test_expires_at<=clock_timestamp() then return null;end if;
  if not exists(select 1 from private.meta_event_outbox where event_name=ename and event_id=eid and consent_id=cid)
   and (select count(*) from private.meta_event_outbox where settings_revision=s.revision)>=s.test_event_limit then return null;end if;
 end if;
 insert into private.meta_event_outbox(event_name,event_id,consent_id,settings_revision,source_path,custom_data,state)
 values(ename,eid,cid,s.revision,path,data,case when s.capi_enabled then 'pending' else 'held' end) on conflict(event_name,event_id) do nothing;
 return (select jsonb_build_object('eventName',event_name,'eventId',event_id,'data',custom_data) from private.meta_event_outbox where event_name=ename and event_id=eid and consent_id=cid);
end $$;
create function public.commerce_meta_purchase(p_user uuid,p_order uuid,p_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid;receipt jsonb;begin
 perform private.checkout_authorize(p_user);cid:=private.meta_allowed(p_hash);
 if cid is null or not exists(select 1 from public.customer_orders where id=p_order and user_id=p_user) then return null;end if;
 perform private.meta_capture_order(p_order);
 update private.meta_event_outbox set browser_claimed_at=clock_timestamp()
 where order_id=p_order and event_name='Purchase' and consent_id=cid and state<>'suppressed' and browser_claimed_at is null
 returning jsonb_build_object('eventName',event_name,'eventId',event_id,'data',custom_data) into receipt;
 return receipt;
end $$;
create function public.commerce_meta_claim() returns jsonb language plpgsql security definer set search_path='' as $$
declare e private.meta_event_outbox;s private.meta_settings;oid uuid;begin
 perform private.checkout_server();select * into s from private.meta_settings where id;
 if not s.enabled or not s.capi_enabled then return null;end if;
 -- Bounded repair only for future consent-bound paid orders; never historical backfill.
 for oid in select o.id from public.customer_orders o join private.meta_checkout_consents m on m.user_id=o.user_id and m.cart_id=o.checkout_cart_id where o.created_at>=s.enabled_since and o.created_at>=clock_timestamp()-interval '24 hours' and o.payment_status='paid' and not exists(select 1 from private.meta_event_outbox posted where posted.order_id=o.id and posted.event_name='Purchase') order by o.created_at limit 20 loop
  begin perform private.meta_capture_order(oid);exception when others then raise log 'meta:capture_pending';end;
 end loop;
 update private.meta_event_outbox set state='suppressed',outcome='expired_or_revoked',lease_id=null,lease_until=null
 where state in ('pending','retry','dispatching') and (settings_revision<>s.revision or event_time<clock_timestamp()-interval '24 hours'
 or not exists(select 1 from private.meta_consents c where c.id=consent_id and c.granted and c.expires_at>clock_timestamp() and c.policy_revision=s.revision));
 select * into e from private.meta_event_outbox where attempts<5 and next_attempt_at<=clock_timestamp()
 and (state in ('pending','retry') or state='dispatching' and lease_until<clock_timestamp()) order by event_time,id for update skip locked limit 1;
 if not found then return null;end if;
 update private.meta_event_outbox set state='dispatching',attempts=attempts+1,lease_id=gen_random_uuid(),lease_until=clock_timestamp()+interval '1 minute' where id=e.id returning * into e;
 return jsonb_build_object('id',e.id,'lease',e.lease_id);
end $$;
create function public.commerce_meta_dispatch(p_id uuid,p_lease uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare e private.meta_event_outbox;s private.meta_settings;c private.meta_consents;begin
 perform private.checkout_server();select * into e from private.meta_event_outbox where id=p_id and lease_id=p_lease and state='dispatching' and lease_until>clock_timestamp() for update;
 if not found then return null;end if;
 select * into s from private.meta_settings where id;select * into c from private.meta_consents where id=e.consent_id;
 if not s.enabled or not s.capi_enabled or s.revision<>e.settings_revision or not c.granted or c.expires_at<=clock_timestamp() or c.policy_revision<>s.revision then return null;end if;
 if s.test_event_code<>'' and (s.test_expires_at is null or s.test_expires_at<=clock_timestamp() or c.user_id is distinct from s.test_customer_id or e.event_name in ('Purchase','CODOrderPlaced')) then return null;end if;
 return jsonb_build_object('revision',s.revision,'pixelId',s.pixel_id,'tokenEncrypted',s.token_encrypted,'graphVersion',s.graph_version,'testEventCode',s.test_event_code,
 'event',jsonb_build_object('event_name',e.event_name,'event_id',e.event_id,'event_time',extract(epoch from e.event_time)::bigint,'action_source','website',
 'source_path',e.source_path,'user_data',jsonb_strip_nulls(jsonb_build_object('external_id',jsonb_build_array(c.token_hash),'client_user_agent',c.user_agent,'fbp',c.fbp,'fbc',c.fbc)),'custom_data',e.custom_data));
end $$;
create function public.commerce_meta_finish(p_id uuid,p_lease uuid,p_outcome text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform private.checkout_server();if p_outcome not in ('accepted','transient','rejected','uncertain') then raise exception 'Invalid outcome.';end if;
 update private.meta_event_outbox set state=case when p_outcome='accepted' then 'delivered' when p_outcome='rejected' or attempts>=5 then 'held' else 'retry' end,
 outcome=p_outcome,delivered_at=case when p_outcome='accepted' then clock_timestamp() end,next_attempt_at=clock_timestamp()+make_interval(secs=>least(3600,30*(2^attempts)::integer)),lease_id=null,lease_until=null
 where id=p_id and lease_id=p_lease and state='dispatching' and lease_until>clock_timestamp();return found;
end $$;
create function public.commerce_meta_diagnostics(p_actor uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform private.meta_staff(p_actor,false);return jsonb_build_object('counts',coalesce((select jsonb_object_agg(state,n) from (select state,count(*) n from private.meta_event_outbox group by state) x),'{}'),
 'recent',coalesce((select jsonb_agg(x order by event_time desc) from (select event_name,event_time,state,attempts,outcome from private.meta_event_outbox order by event_time desc limit 20) x),'[]'));end $$;
create function public.commerce_meta_retention() returns jsonb language plpgsql security definer set search_path='' as $$
declare scrubbed integer;suppressed integer;begin
 perform private.checkout_server();
 -- Bounded private attribute cleanup remains available when dispatch is disabled.
 with expired as (select id from private.meta_consents where (expires_at<=clock_timestamp() or not granted)
 and (user_agent<>'' or fbp is not null or fbc is not null or granted) order by expires_at for update skip locked limit 500)
 update private.meta_consents c set granted=false,revoked_at=coalesce(revoked_at,clock_timestamp()),user_agent='',fbp=null,fbc=null
 where c.id in (select id from expired);get diagnostics scrubbed=row_count;
 with stale as (select e.id from private.meta_event_outbox e join private.meta_consents c on c.id=e.consent_id
 where e.state in ('pending','retry','dispatching','held') and (not c.granted or c.expires_at<=clock_timestamp() or e.event_time<clock_timestamp()-interval '24 hours')
 order by e.event_time for update of e skip locked limit 500)
 update private.meta_event_outbox set state='suppressed',outcome='retention_expired',lease_id=null,lease_until=null
 where id in (select id from stale);get diagnostics suppressed=row_count;
 return jsonb_build_object('scrubbed',scrubbed,'suppressed',suppressed);
end $$;
do $$ declare n text;begin
 foreach n in array array['meta_settings','meta_consents','meta_checkout_consents','meta_event_outbox'] loop
 execute format('alter table private.%I enable row level security',n);execute format('revoke all on private.%I from public,anon,authenticated,service_role',n);
 end loop;
end $$;
do $$ declare f record;begin
 for f in select p.oid::regprocedure sig,n.nspname schema from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and (left(p.proname,14)='commerce_meta_' or left(p.proname,5)='meta_') loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);
 if f.schema='public' then execute format('grant execute on function %s to service_role',f.sig);end if;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
