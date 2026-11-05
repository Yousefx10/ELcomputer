-- 110 candidate after qualified109. Inactive EGP account ledger. No legacy credits/backfill.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create table private.customer_balance_settings(
 id boolean primary key default true check(id), enabled boolean not null default false,
 funding_enabled boolean not null default false, terms_approved boolean not null default false,
 reconciliation_approved boolean not null default false, funding_recipient text not null default '', funding_recipient_verified boolean not null default false, revision integer not null default 0,
 approved_by uuid, approved_at timestamptz
);
insert into private.customer_balance_settings(id) values(true);
create table private.customer_balance_accounts(
 user_id uuid primary key references auth.users(id) on delete restrict,
 currency text not null default 'EGP' check(currency='EGP'),
 available_minor bigint not null default 0 check(available_minor between 0 and 9000000000000),
 reserved_minor bigint not null default 0 check(reserved_minor between 0 and 9000000000000),
 revision bigint not null default 0, created_at timestamptz not null default clock_timestamp()
);
create table private.customer_balance_entries(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references private.customer_balance_accounts(user_id) on delete restrict,
 sequence bigint not null, command_id uuid not null unique, fingerprint bytea not null,
 kind text not null check(kind in ('deposit','store_credit','reserve','release','debit','reversal','adjustment_debit')),
 amount_minor bigint not null check(amount_minor between 1 and 9000000000000), currency text not null default 'EGP' check(currency='EGP'),
 available_delta bigint not null, reserved_delta bigint not null,
 available_after bigint not null check(available_after>=0), reserved_after bigint not null check(reserved_after>=0),
 session_id uuid references private.payment_checkout_sessions(id) on delete restrict,
 reverses_id uuid unique references private.customer_balance_entries(id) on delete restrict,
 actor uuid, funding_reference text, evidence_sha256 text, private_evidence jsonb not null default '{}',
 created_at timestamptz not null default clock_timestamp(), unique(user_id,sequence),
 check((kind in ('deposit','store_credit','reversal') and available_delta=amount_minor and reserved_delta=0)
  or (kind='adjustment_debit' and available_delta=-amount_minor and reserved_delta=0)
  or (kind='reserve' and available_delta=-amount_minor and reserved_delta=amount_minor)
  or (kind='release' and available_delta=amount_minor and reserved_delta=-amount_minor)
  or (kind='debit' and available_delta=0 and reserved_delta=-amount_minor))
);
create unique index customer_balance_funding_reference on private.customer_balance_entries(kind,funding_reference) where kind in ('deposit','store_credit','adjustment_debit','reversal');
create table private.customer_balance_reservations(
 session_id uuid primary key references private.payment_checkout_sessions(id) on delete restrict,
 user_id uuid not null references private.customer_balance_accounts(user_id) on delete restrict,
 amount_minor bigint not null check(amount_minor>0), state text not null check(state in ('held','spent','released')),
 reserve_entry uuid not null references private.customer_balance_entries(id) on delete restrict,
 debit_entry uuid references private.customer_balance_entries(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp()
);
create function private.balance_evidence_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Account balance evidence is immutable.';end $$;
create trigger customer_balance_entry_immutable before update or delete on private.customer_balance_entries for each row execute function private.balance_evidence_immutable();
create function private.balance_account_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or current_setting('app.balance_ledger_write',true) is distinct from 'on' then raise exception 'Account balance ledger transaction required.';end if;
 if tg_op='UPDATE' and (new.user_id<>old.user_id or new.currency<>old.currency or new.created_at<>old.created_at or new.revision<>old.revision+1) then raise exception 'Account balance identity is immutable.';end if;
 return new;
end $$;
create trigger customer_balance_account_guard before insert or update or delete on private.customer_balance_accounts for each row execute function private.balance_account_guard();
create function private.balance_reservation_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or current_setting('app.balance_ledger_write',true) is distinct from 'on' then raise exception 'Account balance ledger transaction required.';end if;
 if tg_op='UPDATE' and ((to_jsonb(new)-array['state','debit_entry']) is distinct from (to_jsonb(old)-array['state','debit_entry']) or old.state<>'held' or new.state not in ('spent','released')) then raise exception 'Balance reservation is immutable.';end if;
 return new;
end $$;
create trigger customer_balance_reservation_guard before insert or update or delete on private.customer_balance_reservations for each row execute function private.balance_reservation_guard();

alter table public.site_settings add column payment_account_balance_enabled boolean not null default false;
alter table public.site_settings add column payment_account_balance_fee numeric not null default 0 check(payment_account_balance_fee>=0);

create function private.balance_ready() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.customer_balance_settings b join private.payment_checkout_settings p on p.id
  join public.site_settings s on s.key='default' where b.id and b.enabled and b.terms_approved and b.reconciliation_approved
  and b.approved_by is not null and b.approved_at is not null and p.enabled and s.payment_account_balance_enabled)
$$;
create function private.balance_assert(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare a private.customer_balance_accounts;v_available numeric;v_reserved numeric;v_sequence bigint;v_count bigint;begin
 select * into a from private.customer_balance_accounts where user_id=p_user;
 if not found then return;end if;
 select coalesce(sum(available_delta),0),coalesce(sum(reserved_delta),0),coalesce(max(sequence),0),count(*) into v_available,v_reserved,v_sequence,v_count
 from private.customer_balance_entries where user_id=p_user;
 if a.available_minor<>v_available or a.reserved_minor<>v_reserved or a.revision<>v_sequence or a.revision<>v_count then
  raise exception 'Account balance reconciliation required.';end if;
end $$;
create function private.balance_post(p_user uuid,p_command uuid,p_kind text,p_amount bigint,p_available bigint,p_reserved bigint,
 p_session uuid default null,p_actor uuid default null,p_reference text default null,p_sha text default null,p_evidence jsonb default '{}',p_reverses uuid default null)
returns private.customer_balance_entries language plpgsql security definer set search_path='' as $$
declare a private.customer_balance_accounts;e private.customer_balance_entries;fp bytea;
 prior text:=coalesce(current_setting('app.balance_ledger_write',true),'');
begin
 perform private.checkout_server();
 if p_user is null or p_command is null or p_amount is null or p_amount not between 1 and 9000000000000 then raise exception 'Invalid account balance command.';end if;
 fp:=sha256(convert_to(jsonb_build_array(p_user,p_kind,p_amount,p_available,p_reserved,p_session,p_actor,p_reference,p_sha,p_evidence,p_reverses)::text,'UTF8'));
 perform set_config('app.balance_ledger_write','on',true);
 insert into private.customer_balance_accounts(user_id) values(p_user) on conflict(user_id) do nothing;
 select * into a from private.customer_balance_accounts where user_id=p_user for update;
 perform private.balance_assert(p_user);
 select * into e from private.customer_balance_entries where command_id=p_command;
 if found then
  if e.fingerprint<>fp or e.user_id<>p_user then raise exception 'Balance command changed.' using errcode='40001';end if;
  perform set_config('app.balance_ledger_write',prior,true);return e;
 end if;
 if a.available_minor+p_available<0 or a.reserved_minor+p_reserved<0 then raise exception 'Insufficient available account balance.' using errcode='23514';end if;
 update private.customer_balance_accounts set available_minor=available_minor+p_available,reserved_minor=reserved_minor+p_reserved,revision=revision+1 where user_id=p_user returning * into a;
 insert into private.customer_balance_entries(user_id,sequence,command_id,fingerprint,kind,amount_minor,available_delta,reserved_delta,available_after,reserved_after,
 session_id,actor,funding_reference,evidence_sha256,private_evidence,reverses_id)
 values(p_user,a.revision,p_command,fp,p_kind,p_amount,p_available,p_reserved,a.available_minor,a.reserved_minor,p_session,p_actor,p_reference,p_sha,p_evidence,p_reverses) returning * into e;
 perform set_config('app.balance_ledger_write',prior,true);return e;
end $$;

create function public.commerce_customer_balance(p_user_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a private.customer_balance_accounts;begin
 perform private.checkout_authorize(p_user_id);
 select * into a from private.customer_balance_accounts where user_id=p_user_id for share;
 perform private.balance_assert(p_user_id);
 return jsonb_build_object('currency','EGP','availableMinor',coalesce(a.available_minor,0),'reservedMinor',coalesce(a.reserved_minor,0),'enabled',private.balance_ready(),'spentMinor',coalesce((select sum(case when e.kind='debit' then e.amount_minor when e.kind='reversal' and exists(select 1 from private.customer_balance_entries d where d.id=e.reverses_id and d.kind='debit') then -e.amount_minor else 0 end)::text from private.customer_balance_entries e where e.user_id=p_user_id),'0'),
 'transactions',coalesce((select jsonb_agg(x order by x.created_at desc,x.sequence desc) from
  (select id,sequence,kind,amount_minor as "amountMinor",available_after as "availableAfterMinor",reserved_after as "reservedAfterMinor",created_at,session_id as "checkoutId"
   from private.customer_balance_entries where user_id=p_user_id order by sequence desc limit 100) x),'[]'));
end $$;
create function public.commerce_balance_configure(p_actor uuid,p_revision integer,p_config jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s private.customer_balance_settings;begin
 perform private.checkout_staff(p_actor,'payments.configure');
 if jsonb_typeof(p_config) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_config) k where k not in ('enabled','funding_enabled','terms_approved','reconciliation_approved','funding_recipient','funding_recipient_verified'))
  or exists(select 1 from jsonb_each(p_config) q where q.key<>'funding_recipient' and jsonb_typeof(q.value)<>'boolean')
  or (p_config ? 'funding_recipient' and (jsonb_typeof(p_config->'funding_recipient')<>'string' or length(btrim(p_config->>'funding_recipient')) not between 1 and 200)) then raise exception 'Invalid balance settings.';end if;
 select * into s from private.customer_balance_settings where id for update;
 if s.revision<>p_revision then raise exception 'Balance settings changed.' using errcode='40001';end if;
 if (coalesce((p_config->>'enabled')::boolean,false) or coalesce((p_config->>'funding_enabled')::boolean,false)) and
  (p_config->'terms_approved' is distinct from 'true'::jsonb or p_config->'reconciliation_approved' is distinct from 'true'::jsonb) then raise exception 'Approved funding, refund and reconciliation terms required.';end if;
 if coalesce((p_config->>'funding_enabled')::boolean,false) and (p_config->'funding_recipient_verified' is distinct from 'true'::jsonb or length(btrim(coalesce(p_config->>'funding_recipient',''))) not between 1 and 200) then raise exception 'Verify the approved store funding recipient.';end if;
 update private.customer_balance_settings set enabled=coalesce((p_config->>'enabled')::boolean,false),funding_enabled=coalesce((p_config->>'funding_enabled')::boolean,false),
 funding_recipient=coalesce(btrim(p_config->>'funding_recipient'),''),funding_recipient_verified=coalesce((p_config->>'funding_recipient_verified')::boolean,false),
 terms_approved=coalesce((p_config->>'terms_approved')::boolean,false),reconciliation_approved=coalesce((p_config->>'reconciliation_approved')::boolean,false),
 approved_by=case when p_config->'terms_approved'='true'::jsonb and p_config->'reconciliation_approved'='true'::jsonb then p_actor end,
 approved_at=case when p_config->'terms_approved'='true'::jsonb and p_config->'reconciliation_approved'='true'::jsonb then clock_timestamp() end,revision=revision+1 where id returning * into s;
 update public.site_settings set payment_account_balance_enabled=s.enabled where key='default';
 insert into public.admin_activity_logs(admin_user_id,author_name,author_email,author_role,action_key,description,metadata)
 select id,coalesce(full_name,email),email,role,'payments.balance.configure','Updated account balance controls.',jsonb_build_object('revision',s.revision,'enabled',s.enabled,'funding_enabled',s.funding_enabled) from public.admin_users where id=p_actor;
 return to_jsonb(s)-array['approved_by'];
end $$;

create function public.commerce_balance_adjust(p_actor uuid,p_user_id uuid,p_command uuid,p_kind text,p_amount_minor bigint,p_evidence jsonb) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare e private.customer_balance_entries;ref text;target private.customer_balance_entries;begin
 perform private.checkout_staff(p_actor,'payments.balance');
 if not exists(select 1 from private.customer_balance_settings where id and funding_enabled and terms_approved and reconciliation_approved and approved_by is not null) then raise exception 'Balance funding is disabled.';end if;
 if not exists(select 1 from public.customer_profiles where id=p_user_id and is_active) or not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null) then raise exception 'Verified customer identity required.';end if;
 if p_kind not in ('deposit','store_credit','adjustment_debit','reversal') or p_amount_minor is null or p_amount_minor not between 1 and 9000000000000
  or jsonb_typeof(p_evidence) is distinct from 'object' or p_evidence->>'currency' is distinct from 'EGP'
  or p_evidence->'authorized' is distinct from 'true'::jsonb or length(btrim(coalesce(p_evidence->>'reason',''))) not between 4 and 400
  or coalesce(p_evidence->>'evidence_sha256','')!~'^[a-f0-9]{64}$' then raise exception 'Authorized funding evidence required.';end if;
 ref:=upper(regexp_replace(btrim(p_evidence->>'reference'),'[[:space:]]+','','g'));
 if ref is null or length(ref) not between 4 and 120 or ref~'[[:cntrl:]]' then raise exception 'Unique funding reference required.';end if;
 if p_kind='deposit' then
  if p_evidence->'bank_credit_verified' is distinct from 'true'::jsonb
   or not exists(select 1 from private.customer_balance_settings where id and funding_recipient_verified and funding_recipient=p_evidence->>'recipient')
   or nullif(p_evidence->>'bank_received_at','') is null or (p_evidence->>'bank_received_at')::timestamptz>clock_timestamp()+interval '5 minutes' then raise exception 'Verify actual bank credit first.';end if;
  perform pg_advisory_xact_lock(hashtextextended('verified-bank-reference:'||ref,0));
  if exists(select 1 from private.payment_checkout_funds where kind='instapay' and reference=ref) then raise exception 'Bank reference already used.' using errcode='23505';end if;
 elsif p_kind='store_credit' and p_evidence->'store_credit_approved' is distinct from 'true'::jsonb then raise exception 'Approved store-credit source required.';
 elsif p_kind='reversal' then
  select * into target from private.customer_balance_entries where id=(p_evidence->>'reverses_id')::uuid and user_id=p_user_id and kind in ('debit','adjustment_debit') for update;
  if not found or target.amount_minor<>p_amount_minor or p_evidence->'reversal_approved' is distinct from 'true'::jsonb then raise exception 'Approved original debit reversal required.';end if;
 end if;
 e:=private.balance_post(p_user_id,p_command,p_kind,p_amount_minor,case when p_kind='adjustment_debit' then -p_amount_minor else p_amount_minor end,0,
  null,p_actor,ref,p_evidence->>'evidence_sha256',p_evidence,case when p_kind='reversal' then target.id end);
 insert into public.admin_activity_logs(admin_user_id,author_name,author_email,author_role,action_key,description,metadata)
 select id,coalesce(full_name,email),email,role,'payments.balance.adjust','Recorded approved balance evidence.',jsonb_build_object('entry',e.id,'customer',p_user_id,'kind',p_kind,'amount_minor',p_amount_minor) from public.admin_users where id=p_actor
 and not exists(select 1 from public.admin_activity_logs where action_key='payments.balance.adjust' and metadata->>'entry'=e.id::text);
 return jsonb_build_object('entryId',e.id,'availableMinor',e.available_after,'reservedMinor',e.reserved_after,'currency','EGP');
end $$;

-- One bank credit may fund either one transfer checkout or account balance, never both.
create function private.balance_bank_reference_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind='instapay' then
  new.reference:=upper(regexp_replace(btrim(new.reference),'[[:space:]]+','','g'));
  if length(new.reference) not between 4 and 120 or new.reference~'[[:cntrl:]]' then raise exception 'Unique bank reference required.';end if;
  perform pg_advisory_xact_lock(hashtextextended('verified-bank-reference:'||new.reference,0));
  if exists(select 1 from private.customer_balance_entries where kind='deposit' and funding_reference=new.reference) then raise exception 'Bank reference already used.' using errcode='23505';end if;
 end if;return new;
end $$;
create trigger balance_bank_reference_guard before insert on private.payment_checkout_funds for each row execute function private.balance_bank_reference_guard();
alter table private.payment_checkout_funds drop constraint payment_checkout_funds_kind_check;
alter table private.payment_checkout_funds add constraint payment_checkout_funds_kind_check check(kind in ('paymob','instapay','account_balance'));

-- Extend the already qualified109 method contracts using exact, reviewed anchors.
do $contracts$
declare d text;a text;r record;begin
 for r in select conname from pg_constraint where conrelid='public.customer_orders'::regclass and conname='customer_orders_payment_method_check' and contype='c'
  and pg_get_constraintdef(oid) not like '%account_balance%' loop
  select pg_get_constraintdef(oid) into d from pg_constraint where conrelid='public.customer_orders'::regclass and conname=r.conname;
  if position('''instapay''' in d)=0 then raise exception 'Review account-balance method constraint.';end if;
  execute format('alter table public.customer_orders drop constraint %I',r.conname);
  execute format('alter table public.customer_orders add constraint %I %s',r.conname,replace(d,'''instapay''::text','''instapay''::text, ''account_balance''::text'));
 end loop;
 d:=pg_get_functiondef('private.checkout_review_before_cod(jsonb)'::regprocedure);
 d:=replace(d,'method in (''cash'',''instapay'')','method in (''cash'',''instapay'',''account_balance'')');
 execute replace(d,'method in (''card'',''cash'',''instapay'')','method in (''card'',''cash'',''instapay'',''account_balance'')');
 d:=pg_get_functiondef('private.checkout_review_before_pdc(jsonb)'::regprocedure);
 d:=replace(d,'method not in (''cash'',''card'',''instapay'')','method not in (''cash'',''card'',''instapay'',''account_balance'')');
 execute replace(d,'method in (''card'',''cash'',''instapay'')','method in (''card'',''cash'',''instapay'',''account_balance'')');
 d:=pg_get_functiondef('private.checkout_review(jsonb)'::regprocedure);
 a:='begin';execute replace(d,a,E'begin\n if p_intent#>>''{order,payment_method}''=''account_balance'' and private.balance_ready() is distinct from true then raise exception ''Account balance is unavailable.'';end if;');
 d:=pg_get_functiondef('public.commerce_prepare_payment_checkout(uuid,uuid,uuid,jsonb,jsonb,text,jsonb)'::regprocedure);
 a:='if p_order->>''payment_method'' not in (''card'',''instapay'') then';
 if position(a in d)=0 then raise exception 'Review balance snapshot methods.';end if;
 d:=replace(d,a,'if p_order->>''payment_method'' not in (''card'',''instapay'',''account_balance'') then');
 a:='if (p_order->>''payment_method''=''card''';
 if position(a in d)=0 then raise exception 'Review balance snapshot activation.';end if;
 execute replace(d,a,'if (p_order->>''payment_method''=''account_balance'' and private.balance_ready() is distinct from true) or (p_order->>''payment_method''=''card''');
 d:=pg_get_functiondef('private.finalize_payment_checkout(uuid)'::regprocedure);
 a:='elsif f.kind<>''instapay'' then raise exception ''Unsupported funds.'';end if;';
 if position(a in d)=0 then raise exception 'Review balance finalization funding.';end if;
 execute replace(d,a,$body$elsif f.kind='account_balance' then
  if v_order->>'payment_method'<>'account_balance' or not exists(select 1 from private.customer_balance_reservations r
   join private.customer_balance_entries e on e.id=r.reserve_entry where r.session_id=s.id and r.user_id=s.user_id and r.state='held'
   and r.amount_minor=f.amount_minor and e.id::text=f.reference and e.kind='reserve') then raise exception 'Verified balance reservation required.';end if;
 elsif f.kind<>'instapay' then raise exception 'Unsupported funds.';end if;$body$);
 d:=pg_get_functiondef('public.commerce_checkout_command(uuid,uuid,uuid,jsonb,jsonb)'::regprocedure);
 execute replace(d,'perform private.checkout_authorize(p_user_id);',E'perform private.checkout_authorize(p_user_id);\n if p_order->>''payment_method''=''account_balance'' then raise exception ''payment_first:session_required'';end if;');
 d:=pg_get_functiondef('private.guard_backorder_fulfillment()'::regprocedure);
 a:='new.payment_method not in (''card'',''cash'',''instapay'')';
 if position(a in d)=0 then raise exception 'Review paid balance stock mode.';end if;
 execute replace(d,a,'new.payment_method not in (''card'',''cash'',''instapay'',''account_balance'')');
end $contracts$;

create function public.commerce_pay_with_balance(p_user_id uuid,p_cart_id uuid,p_quote_id uuid,p_order jsonb,p_items jsonb,p_cart_revision text,p_cart_lines jsonb)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare a private.customer_balance_accounts;s private.payment_checkout_sessions;prepared jsonb;amount bigint;
 reserve private.customer_balance_entries;debit private.customer_balance_entries;result jsonb;prior text:=coalesce(current_setting('app.balance_ledger_write',true),'');
begin
 perform private.checkout_authorize(p_user_id);perform private.cod_authorize(p_user_id);
 if p_order->>'payment_method'<>'account_balance' or private.balance_ready() is distinct from true then raise exception 'Account balance is disabled.';end if;
 select * into a from private.customer_balance_accounts where user_id=p_user_id for update;
 if not found then raise exception 'Insufficient available account balance.';end if;
 perform private.balance_assert(p_user_id);
 prepared:=public.commerce_prepare_payment_checkout(p_user_id,p_cart_id,p_quote_id,p_order,p_items,p_cart_revision,p_cart_lines);
 select * into s from private.payment_checkout_sessions where id=(prepared#>>'{checkout,id}')::uuid for update;
 if s.order_id is not null then return jsonb_build_object('created',false,'checkout',public.commerce_read_payment_checkout(p_user_id,s.id));end if;
 if not (prepared->>'created')::boolean then raise exception 'Review the original balance checkout.';end if;
 amount:=(s.snapshot#>>'{review,totalAmount}')::numeric*100;
 if amount<=0 or a.available_minor<amount then raise exception 'Insufficient available account balance.';end if;
 reserve:=private.balance_post(p_user_id,gen_random_uuid(),'reserve',amount,-amount,amount,s.id);
 perform set_config('app.balance_ledger_write','on',true);
 insert into private.customer_balance_reservations(session_id,user_id,amount_minor,state,reserve_entry) values(s.id,p_user_id,amount,'held',reserve.id);
 perform set_config('app.balance_ledger_write',prior,true);
 insert into private.payment_checkout_funds(session_id,kind,reference,amount_minor,currency,is_primary,evidence)
 values(s.id,'account_balance',reserve.id::text,amount,'EGP',true,jsonb_build_object('ledger_entry',reserve.id));
 -- Any finalization failure aborts this whole transaction: no permanent debit or held reservation.
 result:=private.finalize_payment_checkout(s.id);
 debit:=private.balance_post(p_user_id,gen_random_uuid(),'debit',amount,0,-amount,s.id);
 perform set_config('app.balance_ledger_write','on',true);
 update private.customer_balance_reservations set state='spent',debit_entry=debit.id where session_id=s.id;
 perform set_config('app.balance_ledger_write',prior,true);
 return jsonb_build_object('created',true,'checkout',public.commerce_read_payment_checkout(p_user_id,s.id));
end $$;

-- Immutable funded-order provenance and the shared verified-only email/packing contracts.
do $paid$
declare d text;a text;begin
 d:=pg_get_functiondef('private.order_email_paid(public.customer_orders)'::regprocedure);
 a:='select (o.payment_method=''instapay''';
 if position(a in d)=0 then raise exception 'Review balance paid email.';end if;
 execute replace(d,a,$body$select (o.payment_method='account_balance' and o.payment_status='paid' and o.amount_paid=o.total_amount and o.paid_at is not null and o.status not in ('cancelled','refunded')
 and exists(select 1 from private.customer_balance_reservations r where r.session_id=o.checkout_session_id and r.user_id=o.user_id and r.state in ('held','spent') and r.amount_minor=o.total_amount*100)) or (o.payment_method='instapay'$body$);
 foreach a in array array['order_email_reason','capture_order_email'] loop
  d:=pg_get_functiondef(case when a='order_email_reason' then 'private.order_email_reason(public.order_email_events)'::regprocedure else 'private.capture_order_email()'::regprocedure end);
  execute replace(d,'payment_method not in (''card'',''cash'',''instapay'')','payment_method not in (''card'',''cash'',''instapay'',''account_balance'')');
 end loop;
end $paid$;

create or replace function public.commerce_payment_checkout_readiness() returns jsonb language plpgsql security definer set search_path='' as $$
begin perform private.checkout_server();return (select jsonb_build_object('installed',true,'enabled',enabled,'revision',revision,
 'manual',jsonb_build_object('installed',true,'ready',private.transfer_ready()),'balance',jsonb_build_object('installed',true,'ready',private.balance_ready())) from private.payment_checkout_settings where id);end $$;

do $fulfillment$
declare d text;a text;begin
 d:=pg_get_functiondef('private.pdc_order_eligibility(uuid)'::regprocedure);
 a:='o.payment_method=''instapay'' and private.order_email_paid(o)';
 if position(a in d)=0 then raise exception 'Review balance shipment eligibility.';end if;
 d:=replace(d,a,'o.payment_method in (''instapay'',''account_balance'') and private.order_email_paid(o)');
 execute replace(d,'if o.payment_method=''instapay'' and private.order_email_paid(o) is distinct from true','if o.payment_method in (''instapay'',''account_balance'') and private.order_email_paid(o) is distinct from true');
 d:=pg_get_functiondef('private.payment_checkout_reset_guard()'::regprocedure);
 execute replace(d,'and exists(select 1 from private.payment_checkout_sessions)','and (exists(select 1 from private.payment_checkout_sessions) or exists(select 1 from private.customer_balance_entries))');
 d:=pg_get_functiondef('catalog_private.reset_assert_coverage()'::regprocedure);
 if position($needle$'transfer_commands'$needle$ in d)=0 then raise exception 'Review balance reset coverage.';end if;
 execute replace(d,$needle$'transfer_commands'$needle$,$replacement$'transfer_commands','customer_balance_settings','customer_balance_accounts','customer_balance_entries','customer_balance_reservations'$replacement$);
end $fulfillment$;

create function public.commerce_balance_admin(p_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform private.checkout_staff(p_actor,'payments.balance');return jsonb_build_object(
 'settings',(select to_jsonb(s) from private.customer_balance_settings s where id),
 'entries',coalesce((select jsonb_agg(q order by q.created_at desc) from (select id,user_id,kind,amount_minor,currency,available_after,reserved_after,created_at
  from private.customer_balance_entries order by created_at desc,id limit 100) q),'[]'));
end $$;
create function public.commerce_balance_settings(p_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform private.checkout_staff(p_actor,'payments.configure');return (select to_jsonb(s) from private.customer_balance_settings s where id);end $$;

create function public.commerce_balance_reconciliation() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform private.checkout_server();return (select jsonb_build_object('accounts',count(*),'variance_accounts',count(*) filter(where a.available_minor<>coalesce(e.available,0) or a.reserved_minor<>coalesce(e.reserved,0) or a.revision<>coalesce(e.sequence,0) or a.revision<>coalesce(e.entries,0)),
 'held_reservations',(select count(*) from private.customer_balance_reservations where state='held')) from private.customer_balance_accounts a
 left join (select user_id,sum(available_delta) available,sum(reserved_delta) reserved,max(sequence) sequence,count(*) entries from private.customer_balance_entries group by user_id) e using(user_id));end $$;

create function private.balance_order_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.payment_method='account_balance' and (new.checkout_session_id is null or not exists(
  select 1 from private.customer_balance_reservations r join private.payment_checkout_funds f on f.session_id=r.session_id
  where r.session_id=new.checkout_session_id and r.user_id=new.user_id and r.state in ('held','spent') and f.kind='account_balance' and f.is_primary
  and f.reference=r.reserve_entry::text and f.amount_minor=r.amount_minor and f.amount_minor=new.total_amount*100 and f.currency=new.currency)) then
  raise exception 'Verified balance payment required.';end if;return new;
end $$;
create trigger a_balance_verified_order before insert or update on public.customer_orders for each row execute function private.balance_order_guard();

-- No direct table rights; service RPCs retain authenticated owner/staff authorization.
do $security$
declare name text;r record;begin
 foreach name in array array['customer_balance_settings','customer_balance_accounts','customer_balance_entries','customer_balance_reservations'] loop
  execute format('alter table private.%I enable row level security',name);
  execute format('revoke all on private.%I from public,anon,authenticated,service_role',name);
 end loop;
 for r in select p.oid::regprocedure signature,n.nspname schema from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='private' and p.proname like 'balance_%') or (n.nspname='public' and p.proname in ('commerce_customer_balance','commerce_balance_configure','commerce_balance_adjust','commerce_pay_with_balance','commerce_balance_admin','commerce_balance_settings','commerce_balance_reconciliation')) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',r.signature);
  if r.schema='public' then execute format('grant execute on function %s to service_role',r.signature);end if;
 end loop;
end $security$;
notify pgrst,'reload schema';
commit;
