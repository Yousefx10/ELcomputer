-- 85: normal COD receipts and explicit treasury reconciliation. No backfill.
begin;
set local lock_timeout='5s';

create table public.order_cod_collections (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.customer_orders(id) on delete restrict,
 amount numeric(12,2) not null check(amount>0 and amount<10000000000),
 reference text not null check(length(reference) between 3 and 120 and reference=btrim(reference)),
 received_on date not null check(isfinite(received_on)),
 audit_id uuid not null unique references public.admin_activity_logs(id) on delete restrict deferrable initially deferred,
 confirmed_by uuid not null references public.admin_users(id) on delete restrict,
 recorded_at timestamptz not null default clock_timestamp()
);
create unique index order_cod_collections_reference on public.order_cod_collections(order_id,lower(reference));
create index order_cod_collections_order on public.order_cod_collections(order_id,recorded_at);

-- Reuse customer_receipt income and the existing treasury report/sign convention.
alter table public.treasury_transactions add column customer_order_id uuid
 references public.customer_orders(id) on delete restrict;
alter table public.treasury_transactions drop constraint treasury_transactions_reference_check;
alter table public.treasury_transactions add constraint treasury_transactions_reference_check check (
 (transaction_type='supplier_payment' and procurement_order_id is not null and sales_order_id is null
  and customer_order_id is null and employee_id is null and salary_period is null)
 or (transaction_type='customer_receipt' and procurement_order_id is null
  and num_nonnulls(sales_order_id,customer_order_id)=1 and employee_id is null and salary_period is null)
 or (transaction_type='salary_payment' and procurement_order_id is null and sales_order_id is null
  and customer_order_id is null and employee_id is not null and salary_period is not null)
);
create index treasury_transactions_customer_order on public.treasury_transactions(customer_order_id) where customer_order_id is not null;
create table public.order_cod_reconciliations (
 id uuid primary key default gen_random_uuid(),
 collection_id uuid not null unique references public.order_cod_collections(id) on delete restrict,
 treasury_transaction_id uuid not null unique references public.treasury_transactions(id) on delete restrict,
 reference text not null check(length(reference) between 3 and 120 and reference=btrim(reference)),
 audit_id uuid not null unique references public.admin_activity_logs(id) on delete restrict deferrable initially deferred,
 reconciled_by uuid not null references public.admin_users(id) on delete restrict,
 recorded_at timestamptz not null default clock_timestamp()
);
-- A remittance reference identifies one receipt, never a silently reused deposit.
create unique index order_cod_reconciliations_reference on public.order_cod_reconciliations(lower(reference));
alter table public.order_cod_collections enable row level security;
alter table public.order_cod_reconciliations enable row level security;
revoke all on public.order_cod_collections,public.order_cod_reconciliations from public,anon,authenticated,service_role;
grant select on public.order_cod_collections,public.order_cod_reconciliations to service_role;

-- Minimal command tombstones survive an explicitly authorized Commerce/Full reset.
create table private.cod_collection_commands (
 command_id uuid primary key,
 actor_id uuid not null,
 payload_hash bytea not null check(octet_length(payload_hash)=32),
 result jsonb not null,
 retired_by_reset boolean not null default false
);
alter table private.cod_collection_commands enable row level security;
revoke all on private.cod_collection_commands from public,anon,authenticated,service_role;

create function public.commerce_cod_cash_command(
 p_actor_id uuid,p_command_id uuid,p_order_id uuid,p_action text,p_collection_id uuid,
 p_amount numeric,p_reference text,p_received_on date,p_confirmed boolean
) returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare
 a public.admin_users%rowtype; o public.customer_orders%rowtype;
 c public.order_cod_collections%rowtype; receipt private.cod_collection_commands%rowtype;
 fingerprint bytea; result jsonb; collected numeric; entry_id uuid:=gen_random_uuid();
 ledger_id uuid:=gen_random_uuid(); audit_id uuid:=gen_random_uuid();
begin
 perform pg_advisory_xact_lock_shared(hashtextextended('elcomputer-system-reset',0));
 if auth.role() is distinct from 'service_role' then raise exception 'cod:permission' using errcode='42501';end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'cod:invalid' using errcode='22023';end if;
 select * into a from public.admin_users where id=p_actor_id for share;
 if not found or not a.is_active or not(a.role='owner' or
  coalesce((a.permissions->>'dashboard.view')::boolean,false) and
  coalesce((a.permissions->>'dashboard.orders')::boolean,false) and
  (p_action='receive' or coalesce((a.permissions->>'treasury.view')::boolean,false)
    and coalesce((a.permissions->>'treasury.edit')::boolean,false))) then
  raise exception 'cod:permission' using errcode='42501';end if;
 if p_command_id is null or p_order_id is null or p_action is null or p_action not in ('receive','reconcile')
  or p_confirmed is distinct from true or p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity')
  or p_amount<=0 or p_amount>=10000000000 or round(p_amount,2)<>p_amount
  or length(btrim(coalesce(p_reference,''))) not between 3 and 120
  or p_received_on is null or not isfinite(p_received_on) or p_received_on>current_date
  or p_action='receive' and p_collection_id is not null or p_action='reconcile' and p_collection_id is null then
  raise exception 'cod:invalid' using errcode='22023';end if;
 fingerprint:=sha256(convert_to(jsonb_build_object('order',p_order_id,'action',p_action,
  'collection',p_collection_id,'amount',trim_scale(p_amount),'reference',btrim(p_reference),
  'received_on',p_received_on,'confirmed',p_confirmed)::text,'UTF8'));
 perform pg_advisory_xact_lock(hashtextextended('cod-command:'||p_command_id::text,0));
 select * into receipt from private.cod_collection_commands where command_id=p_command_id;
 if found then
  if receipt.actor_id<>p_actor_id then raise exception 'cod:permission' using errcode='42501';end if;
  if receipt.payload_hash<>fingerprint then raise exception 'cod:reused' using errcode='22023';end if;
  if receipt.retired_by_reset then raise exception 'cod:reset' using errcode='22023';end if;
  return receipt.result;
 end if;
 perform public.assert_built_in_erp();
 select * into o from public.customer_orders where id=p_order_id for update;
 if not found then raise exception 'cod:missing' using errcode='P0002';end if;
 if o.is_preorder or o.payment_method<>'cash' or o.erp_owner<>'built_in'
  or o.status not in ('delivered','completed') or o.payment_status not in ('pending','partially_paid','paid') then
  raise exception 'cod:ineligible' using errcode='22023';end if;
 if p_received_on < o.created_at::date then raise exception 'cod:date' using errcode='22023';end if;
 select coalesce(sum(amount),0) into collected from public.order_cod_collections where order_id=o.id;
 -- Existing historical amounts/statuses require review, never an invented backfill.
 if o.amount_paid<>collected or o.payment_status<>(case when collected=o.total_amount and collected>0 then 'paid'
  when collected>0 then 'partially_paid' else 'pending' end)
  or (collected=o.total_amount and collected>0)<>(o.paid_at is not null) then
  raise exception 'cod:history' using errcode='22023';end if;
 if p_action='receive' then
  if p_amount>o.total_amount-collected then raise exception 'cod:balance' using errcode='22023';end if;
  insert into public.order_cod_collections(id,order_id,amount,reference,received_on,confirmed_by,audit_id)
   values(entry_id,o.id,p_amount,btrim(p_reference),p_received_on,a.id,audit_id);
  update public.customer_orders set amount_paid=collected+p_amount,
   payment_status=case when collected+p_amount=total_amount then 'paid' else 'partially_paid' end,
   paid_at=case when collected+p_amount=total_amount then clock_timestamp() else null end,
   updated_at=clock_timestamp() where id=o.id;
 else
  select * into c from public.order_cod_collections where id=p_collection_id and order_id=o.id for update;
  if not found then raise exception 'cod:missing' using errcode='P0002';end if;
  if c.amount<>p_amount or p_received_on<c.received_on then raise exception 'cod:mismatch' using errcode='22023';end if;
  if exists(select 1 from public.order_cod_reconciliations where collection_id=c.id) then
   raise exception 'cod:duplicate' using errcode='23505';end if;
  insert into public.treasury_transactions(id,transaction_type,amount,party_name,customer_order_id,
   reference_number,notes,paid_at,created_by)
  values(ledger_id,'customer_receipt',c.amount,concat_ws(' ',o.first_name,nullif(o.last_name,'')),o.id,
   btrim(p_reference),'COD '||o.order_number,p_received_on,a.id);
  insert into public.order_cod_reconciliations(id,collection_id,treasury_transaction_id,reference,reconciled_by,audit_id)
   values(entry_id,c.id,ledger_id,btrim(p_reference),a.id,audit_id);
 end if;
 result:=jsonb_build_object('status','committed','command_id',p_command_id,'entry_id',entry_id,
  'collection_id',case when p_action='receive' then entry_id else c.id end,
  'treasury_transaction_id',case when p_action='reconcile' then ledger_id else null end,'audit_id',audit_id);
 insert into public.admin_activity_logs(id,admin_user_id,author_name,author_email,author_role,action_key,description,metadata)
 values(audit_id,a.id,coalesce(nullif(btrim(a.full_name),''),a.email,'Admin'),a.email,a.role,
  'orders.cod.'||p_action,'Confirmed COD '||p_action||' for '||o.order_number||'.',
  jsonb_build_object('order_id',o.id,'command_id',p_command_id,'entry_id',entry_id,'amount',p_amount,
   'collection_id',result->'collection_id','treasury_transaction_id',result->'treasury_transaction_id'));
 insert into private.cod_collection_commands(command_id,actor_id,payload_hash,result)
  values(p_command_id,a.id,fingerprint,result);
 return result;
end $$;
revoke all on function public.commerce_cod_cash_command(uuid,uuid,uuid,text,uuid,numeric,text,date,boolean) from public,anon,authenticated,service_role;
grant execute on function public.commerce_cod_cash_command(uuid,uuid,uuid,text,uuid,numeric,text,date,boolean) to service_role;

-- Status edits, delivery webhooks and browser updates cannot assert cash receipt.
create function private.guard_cod_cash_balance() returns trigger language plpgsql security definer set search_path='' as $$
declare collected numeric;
begin
 if tg_op='INSERT' then
  if new.payment_method='cash' and not new.is_preorder and (new.amount_paid<>0 or new.payment_status<>'pending' or new.paid_at is not null) then
   raise exception 'cod:history' using errcode='22023';end if;
  return new;
 end if;
 if new.payment_method='cash' and not new.is_preorder and (old.payment_method<>'cash' or old.is_preorder)
  and (new.amount_paid<>0 or new.payment_status<>'pending' or new.paid_at is not null) then
  raise exception 'cod:history' using errcode='22023';end if;
 if old.payment_method='cash' and not old.is_preorder then
  select coalesce(sum(amount),0) into collected from public.order_cod_collections where order_id=old.id;
  if collected>0 and (new.total_amount is distinct from old.total_amount or new.subtotal_amount is distinct from old.subtotal_amount
   or new.discount_amount is distinct from old.discount_amount or new.shipping_fee_amount is distinct from old.shipping_fee_amount
   or new.payment_fee_amount is distinct from old.payment_fee_amount or new.payment_method is distinct from old.payment_method
   or new.is_preorder is distinct from old.is_preorder) then raise exception 'cod:history' using errcode='22023';end if;
  if new.amount_paid is distinct from old.amount_paid or new.payment_status is distinct from old.payment_status
   or new.paid_at is distinct from old.paid_at then
   -- Only a newly inserted immutable receipt may advance financial fields.
   if collected<=old.amount_paid or new.amount_paid<>collected or new.payment_status<>(case when collected=old.total_amount and collected>0 then 'paid'
    when collected>0 then 'partially_paid' else 'pending' end)
    or (collected=old.total_amount and collected>0)<>(new.paid_at is not null) then
    raise exception 'cod:history' using errcode='22023';end if;
  end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_cod_cash_balance() from public,anon,authenticated,service_role;
create trigger z_cod_cash_balance before insert or update on public.customer_orders
 for each row execute function private.guard_cod_cash_balance();

-- Extend existing explicit reset contracts, keeping Orders Reset from erasing money.
alter function public.system_reset_tables(text) rename to system_reset_tables_before_cod;
create function public.system_reset_tables(p_scope text) returns text[] language sql immutable set search_path='' as $$
 with base as (select public.system_reset_tables_before_cod(p_scope) tables),
 positioned as (select tables,array_position(tables,'preorder_payments') pos from base)
 select case when p_scope in ('orders','commerce','full') then tables[1:pos]
  || array['order_cod_collections','order_cod_reconciliations']::text[] || tables[pos+1:cardinality(tables)]
  else tables end from positioned
$$;
revoke all on function public.system_reset_tables(text),public.system_reset_tables_before_cod(text) from public,anon,authenticated,service_role;
grant execute on function public.system_reset_tables(text) to service_role;
do $guard$ declare definition text; anchor text;begin
 definition:=pg_get_functiondef('catalog_private.reset_assert_coverage()'::regprocedure);
 anchor:=$anchor$'checkout_quotes','checkout_commands'$anchor$;
 if position(anchor in definition)=0 then raise exception 'Review COD reset coverage.';end if;
 execute replace(definition,anchor,anchor||',''cod_collection_commands''');
 definition:=pg_get_functiondef('catalog_private.reset_manifest()'::regprocedure);
 anchor:=' if new.scope=''media'' then';
 if position(anchor in definition)=0 then raise exception 'Review COD receipt retention.';end if;
 execute replace(definition,anchor,E' if new.scope in (''commerce'',''full'') then\n  update private.cod_collection_commands set retired_by_reset=true where not retired_by_reset;\n end if;\n'||anchor);
 definition:=pg_get_functiondef('public.system_reset_plan(uuid,text)'::regprocedure);
 anchor:=' return plan;';
 if position(anchor in definition)=0 then raise exception 'Review COD financial history reset.';end if;
 execute replace(definition,anchor,E' if p_scope=''orders'' and exists(select 1 from public.order_cod_collections) then\n  plan:=jsonb_set(plan,''{blockers}'',plan->''blockers''||jsonb_build_array(jsonb_build_object(''table'',''order_cod_collections'',''count'',1)));\n end if;\n'||anchor);
end $guard$;
notify pgrst,'reload schema';
commit;
