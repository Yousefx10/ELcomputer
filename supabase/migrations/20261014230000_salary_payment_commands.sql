-- 81: salary accounting commands, atomic audit and retained reset tombstones.
begin;
set local lock_timeout='5s';

create table private.salary_payment_commands (
 command_id uuid primary key,
 actor_id uuid not null,
 payload_hash bytea not null check(octet_length(payload_hash)=32),
 transaction_id uuid not null unique,
 audit_id uuid not null unique,
 committed_at timestamptz not null default clock_timestamp(),
 retired_by_reset boolean not null default false
);
-- No payroll values or external FKs: receipts outlive Commerce/Full erasure.
alter table private.salary_payment_commands enable row level security;
revoke all on private.salary_payment_commands from public,anon,authenticated,service_role;

create function public.treasury_record_salary_payment_command(
 p_actor_id uuid,p_command_id uuid,p_employee_id uuid,p_amount numeric,
 p_salary_period date,p_paid_at date,p_reference_number text,p_notes text
) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare
 a public.admin_users%rowtype;
 receipt private.salary_payment_commands%rowtype;
 employee_name text; amount numeric(12,2); period date; fingerprint bytea;
 transaction_id uuid:=gen_random_uuid(); audit_id uuid:=gen_random_uuid();
begin
 -- Same exclusion order as reset, then authority, command and business rows.
 perform pg_advisory_xact_lock_shared(hashtextextended('elcomputer-system-reset',0));
 if auth.role() is distinct from 'service_role' then
  raise exception 'salary:permission' using errcode='42501';
 end if;
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception 'salary:invalid' using errcode='22023';
 end if;
 select * into a from public.admin_users where id=p_actor_id for share;
 if not found or not a.is_active or not(a.role='owner' or
  coalesce((a.permissions->>'treasury.view')::boolean,false) and
  coalesce((a.permissions->>'treasury.edit')::boolean,false)) then
  raise exception 'salary:permission' using errcode='42501';
 end if;
 if p_command_id is null or p_employee_id is null or p_amount is null or
  p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<=0 or
  p_amount>=10000000000 or p_salary_period is null or p_paid_at is null or
  not isfinite(p_salary_period) or not isfinite(p_paid_at) or
  length(coalesce(p_reference_number,''))>200 or length(coalesce(p_notes,''))>2000 then
  raise exception 'salary:invalid' using errcode='22023';
 end if;
 amount:=round(p_amount,2);
 if amount<=0 then raise exception 'salary:invalid' using errcode='22023';end if;
 period:=date_trunc('month',p_salary_period)::date;
 fingerprint:=sha256(convert_to(jsonb_build_object(
  'employee',p_employee_id,'amount',trim_scale(p_amount),'period',p_salary_period,
  'paid_at',p_paid_at,'reference',nullif(trim(p_reference_number),''),
  'notes',nullif(trim(p_notes),''))::text,'UTF8'));
 perform pg_advisory_xact_lock(hashtextextended('salary-command:'||p_command_id::text,0));
 select * into receipt from private.salary_payment_commands where command_id=p_command_id;
 if found then
  if receipt.actor_id<>p_actor_id then raise exception 'salary:permission' using errcode='42501';end if;
  if receipt.payload_hash<>fingerprint then raise exception 'salary:reused' using errcode='22023';end if;
  if receipt.retired_by_reset or not exists(select 1 from public.treasury_transactions where id=receipt.transaction_id) then
   raise exception 'salary:reset' using errcode='22023';
  end if;
  return jsonb_build_object('status','committed','command_id',receipt.command_id,
   'transaction_id',receipt.transaction_id,'audit_id',receipt.audit_id);
 end if;
 perform 1 from public.site_settings where key='default' for share;
 perform public.assert_built_in_erp();
 select trim(concat(first_name,' ',coalesce(last_name,''))) into employee_name
  from public.hr_employees where id=p_employee_id for share;
 if not found then raise exception 'salary:employee' using errcode='P0002';end if;
 insert into public.treasury_transactions(id,transaction_type,amount,party_name,
  employee_id,salary_period,reference_number,notes,paid_at,created_by)
 values(transaction_id,'salary_payment',amount,employee_name,p_employee_id,period,
  nullif(trim(p_reference_number),''),nullif(trim(p_notes),''),p_paid_at,a.id);
 insert into public.admin_activity_logs(id,admin_user_id,author_name,author_email,
  author_role,action_key,description,metadata)
 values(audit_id,a.id,coalesce(nullif(trim(a.full_name),''),a.email,'Admin'),a.email,a.role,
  'treasury.salary_payment.created',left('Recorded salary payment for '||employee_name||'.',220),
  jsonb_build_object('treasury_transaction_id',transaction_id,'command_id',p_command_id));
 insert into private.salary_payment_commands(command_id,actor_id,payload_hash,transaction_id,audit_id)
 values(p_command_id,a.id,fingerprint,transaction_id,audit_id);
 return jsonb_build_object('status','committed','command_id',p_command_id,
  'transaction_id',transaction_id,'audit_id',audit_id);
end $$;
revoke all on function public.treasury_record_salary_payment_command(uuid,uuid,uuid,numeric,date,date,text,text) from public,anon,authenticated,service_role;
grant execute on function public.treasury_record_salary_payment_command(uuid,uuid,uuid,numeric,date,date,text,text) to service_role;
-- Close the unkeyed write path. Existing ledger history stays unchanged.
revoke all on function public.treasury_record_salary_payment(uuid,numeric,date,date,text,text) from public,anon,authenticated,service_role;

-- Extend only the existing explicit coverage and pre-erasure manifest hooks.
do $guard$ declare definition text; anchor text;begin
 definition:=pg_get_functiondef('catalog_private.reset_assert_coverage()'::regprocedure);
 anchor:='(n.nspname=''private'' and c.relname<>''installation_bootstrap'')';
 if position(anchor in definition)=0 then raise exception 'Review salary receipt reset coverage.';end if;
 execute replace(definition,anchor,'(n.nspname=''private'' and not c.relname=any(array[''installation_bootstrap'',''salary_payment_commands'']))');
 definition:=pg_get_functiondef('catalog_private.reset_manifest()'::regprocedure);
 anchor:=' if new.scope=''media'' then';
 if position(anchor in definition)=0 then raise exception 'Review salary receipt reset exclusion.';end if;
 execute replace(definition,anchor,E' if new.scope in (''commerce'',''full'') then\n  update private.salary_payment_commands set retired_by_reset=true where not retired_by_reset;\n end if;\n'||anchor);
end $guard$;
notify pgrst,'reload schema';
commit;
