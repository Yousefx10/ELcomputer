begin;

create or replace function public.default_admin_permissions ()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'dashboard.view', false,
    'dashboard.analysis', false,
    'dashboard.orders', false,
    'products.view', false,
    'products.add', false,
    'products.edit', false,
    'categories.view', false,
    'categories.add', false,
    'categories.edit', false,
    'brands.view', false,
    'brands.add', false,
    'brands.edit', false,
    'settings.view', false,
    'settings.edit', false,
    'settings.coupons', false,
    'users.view', false,
    'hr.view', false,
    'hr.edit', false,
    'treasury.view', false,
    'treasury.edit', false
  );
$$;

create table if not exists public.hr_employees (
  id uuid not null default gen_random_uuid (),
  employee_code text null,
  first_name text not null,
  last_name text null,
  email text null,
  phone text null,
  address text null,
  position text not null,
  department text null,
  hire_date date null,
  employment_status text not null default 'active',
  salary_amount numeric (12, 2) not null default 0,
  salary_frequency text not null default 'monthly',
  salary_notes text null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint hr_employees_pkey primary key (id),
  constraint hr_employees_created_by_fkey foreign key (created_by) references public.admin_users (id) on delete set null,
  constraint hr_employees_status_check check (employment_status = any (array['active'::text, 'on_leave'::text, 'inactive'::text, 'terminated'::text])),
  constraint hr_employees_salary_amount_check check (salary_amount >= 0),
  constraint hr_employees_salary_frequency_check check (salary_frequency = any (array['monthly'::text, 'weekly'::text, 'daily'::text, 'hourly'::text]))
);

create unique index if not exists hr_employees_code_uidx
on public.hr_employees (employee_code)
where employee_code is not null;

create index if not exists hr_employees_status_name_idx
on public.hr_employees (employment_status, first_name, last_name);

create table if not exists public.treasury_transactions (
  id uuid not null default gen_random_uuid (),
  transaction_type text not null,
  amount numeric (12, 2) not null,
  party_name text not null,
  procurement_order_id uuid null,
  sales_order_id uuid null,
  employee_id uuid null,
  salary_period date null,
  reference_number text null,
  notes text null,
  paid_at date not null default current_date,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  constraint treasury_transactions_pkey primary key (id),
  constraint treasury_transactions_procurement_order_id_fkey foreign key (procurement_order_id) references public.commerce_procurement_orders (id) on delete restrict,
  constraint treasury_transactions_sales_order_id_fkey foreign key (sales_order_id) references public.commerce_sales_orders (id) on delete restrict,
  constraint treasury_transactions_employee_id_fkey foreign key (employee_id) references public.hr_employees (id) on delete restrict,
  constraint treasury_transactions_created_by_fkey foreign key (created_by) references public.admin_users (id) on delete set null,
  constraint treasury_transactions_amount_check check (amount > 0),
  constraint treasury_transactions_type_check check (transaction_type = any (array['supplier_payment'::text, 'customer_receipt'::text, 'salary_payment'::text])),
  constraint treasury_transactions_reference_check check (
    (
      transaction_type = 'supplier_payment'
      and procurement_order_id is not null
      and sales_order_id is null
      and employee_id is null
      and salary_period is null
    )
    or (
      transaction_type = 'customer_receipt'
      and procurement_order_id is null
      and sales_order_id is not null
      and employee_id is null
      and salary_period is null
    )
    or (
      transaction_type = 'salary_payment'
      and procurement_order_id is null
      and sales_order_id is null
      and employee_id is not null
      and salary_period is not null
    )
  )
);

create index if not exists treasury_transactions_paid_at_idx
on public.treasury_transactions (paid_at desc, created_at desc);

create index if not exists treasury_transactions_procurement_idx
on public.treasury_transactions (procurement_order_id, created_at desc)
where procurement_order_id is not null;

create index if not exists treasury_transactions_sales_idx
on public.treasury_transactions (sales_order_id, created_at desc)
where sales_order_id is not null;

create index if not exists treasury_transactions_employee_idx
on public.treasury_transactions (employee_id, salary_period desc)
where employee_id is not null;

create or replace function public.treasury_get_outstanding_supplier_invoices ()
returns table (
  id uuid,
  invoice_number text,
  account_name text,
  total_amount numeric,
  paid_amount numeric,
  due_amount numeric,
  created_at timestamp with time zone
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.has_admin_permission ('treasury.view') then
    raise exception 'Not authorized';
  end if;

  return query
  select
    procurement.id,
    procurement.invoice_number,
    supplier.name,
    procurement.total_cost,
    procurement.paid_amount,
    procurement.total_cost - procurement.paid_amount,
    procurement.created_at
  from public.commerce_procurement_orders as procurement
  join public.commerce_crm_accounts as supplier
    on supplier.id = procurement.supplier_id
  where procurement.paid_amount < procurement.total_cost
  order by procurement.created_at desc;
end;
$$;

create or replace function public.treasury_get_outstanding_customer_invoices ()
returns table (
  id uuid,
  invoice_number text,
  account_name text,
  total_amount numeric,
  paid_amount numeric,
  due_amount numeric,
  created_at timestamp with time zone
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.has_admin_permission ('treasury.view') then
    raise exception 'Not authorized';
  end if;

  return query
  select
    sale.id,
    sale.order_number,
    customer.name,
    sale.total_amount,
    sale.paid_amount,
    sale.total_amount - sale.paid_amount,
    sale.created_at
  from public.commerce_sales_orders as sale
  join public.commerce_crm_accounts as customer
    on customer.id = sale.customer_id
  where sale.paid_amount < sale.total_amount
  order by sale.created_at desc;
end;
$$;

create or replace function public.treasury_record_supplier_payment (
  p_procurement_order_id uuid,
  p_amount numeric,
  p_paid_at date,
  p_reference_number text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction_id uuid;
  v_total numeric (12, 2);
  v_paid numeric (12, 2);
  v_amount numeric (12, 2);
  v_supplier_name text;
begin
  if not public.has_admin_permission ('treasury.edit') then
    raise exception 'Not authorized';
  end if;

  v_amount := round(coalesce(p_amount, 0), 2);

  if v_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;

  select procurement.total_cost, procurement.paid_amount, supplier.name
  into v_total, v_paid, v_supplier_name
  from public.commerce_procurement_orders as procurement
  join public.commerce_crm_accounts as supplier
    on supplier.id = procurement.supplier_id
  where procurement.id = p_procurement_order_id
  for update of procurement;

  if not found then
    raise exception 'Procurement invoice not found.';
  end if;

  if v_amount > (v_total - v_paid) then
    raise exception 'Payment exceeds the outstanding supplier balance.';
  end if;

  update public.commerce_procurement_orders
  set
    paid_amount = paid_amount + v_amount,
    updated_at = now()
  where id = p_procurement_order_id;

  insert into public.treasury_transactions (
    transaction_type,
    amount,
    party_name,
    procurement_order_id,
    reference_number,
    notes,
    paid_at,
    created_by
  )
  values (
    'supplier_payment',
    v_amount,
    v_supplier_name,
    p_procurement_order_id,
    nullif(trim(p_reference_number), ''),
    nullif(trim(p_notes), ''),
    coalesce(p_paid_at, current_date),
    auth.uid ()
  )
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;

create or replace function public.treasury_record_customer_receipt (
  p_sales_order_id uuid,
  p_amount numeric,
  p_paid_at date,
  p_reference_number text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction_id uuid;
  v_total numeric (12, 2);
  v_paid numeric (12, 2);
  v_amount numeric (12, 2);
  v_customer_name text;
begin
  if not public.has_admin_permission ('treasury.edit') then
    raise exception 'Not authorized';
  end if;

  v_amount := round(coalesce(p_amount, 0), 2);

  if v_amount <= 0 then
    raise exception 'Receipt amount must be greater than zero.';
  end if;

  select sale.total_amount, sale.paid_amount, customer.name
  into v_total, v_paid, v_customer_name
  from public.commerce_sales_orders as sale
  join public.commerce_crm_accounts as customer
    on customer.id = sale.customer_id
  where sale.id = p_sales_order_id
  for update of sale;

  if not found then
    raise exception 'Sales invoice not found.';
  end if;

  if v_amount > (v_total - v_paid) then
    raise exception 'Receipt exceeds the outstanding customer balance.';
  end if;

  update public.commerce_sales_orders
  set
    paid_amount = paid_amount + v_amount,
    updated_at = now()
  where id = p_sales_order_id;

  insert into public.treasury_transactions (
    transaction_type,
    amount,
    party_name,
    sales_order_id,
    reference_number,
    notes,
    paid_at,
    created_by
  )
  values (
    'customer_receipt',
    v_amount,
    v_customer_name,
    p_sales_order_id,
    nullif(trim(p_reference_number), ''),
    nullif(trim(p_notes), ''),
    coalesce(p_paid_at, current_date),
    auth.uid ()
  )
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;

create or replace function public.treasury_record_salary_payment (
  p_employee_id uuid,
  p_amount numeric,
  p_salary_period date,
  p_paid_at date,
  p_reference_number text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction_id uuid;
  v_amount numeric (12, 2);
  v_employee_name text;
  v_salary_period date;
begin
  if not public.has_admin_permission ('treasury.edit') then
    raise exception 'Not authorized';
  end if;

  v_amount := round(coalesce(p_amount, 0), 2);

  if v_amount <= 0 then
    raise exception 'Salary amount must be greater than zero.';
  end if;

  if p_salary_period is null then
    raise exception 'Salary period is required.';
  end if;

  select trim(concat(first_name, ' ', coalesce(last_name, '')))
  into v_employee_name
  from public.hr_employees
  where id = p_employee_id;

  if not found then
    raise exception 'Employee not found.';
  end if;

  v_salary_period := date_trunc('month', p_salary_period)::date;

  insert into public.treasury_transactions (
    transaction_type,
    amount,
    party_name,
    employee_id,
    salary_period,
    reference_number,
    notes,
    paid_at,
    created_by
  )
  values (
    'salary_payment',
    v_amount,
    v_employee_name,
    p_employee_id,
    v_salary_period,
    nullif(trim(p_reference_number), ''),
    nullif(trim(p_notes), ''),
    coalesce(p_paid_at, current_date),
    auth.uid ()
  )
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;

alter table public.hr_employees enable row level security;
alter table public.treasury_transactions enable row level security;

drop policy if exists "Admins can read HR employees" on public.hr_employees;
create policy "Admins can read HR employees"
on public.hr_employees
for select
to authenticated
using (public.has_admin_permission ('hr.view'));

drop policy if exists "Admins can add HR employees" on public.hr_employees;
create policy "Admins can add HR employees"
on public.hr_employees
for insert
to authenticated
with check (public.has_admin_permission ('hr.edit'));

drop policy if exists "Admins can edit HR employees" on public.hr_employees;
create policy "Admins can edit HR employees"
on public.hr_employees
for update
to authenticated
using (public.has_admin_permission ('hr.edit'))
with check (public.has_admin_permission ('hr.edit'));

drop policy if exists "Admins can read Treasury transactions" on public.treasury_transactions;
create policy "Admins can read Treasury transactions"
on public.treasury_transactions
for select
to authenticated
using (public.has_admin_permission ('treasury.view'));

revoke all on function public.treasury_get_outstanding_supplier_invoices () from public;
revoke all on function public.treasury_get_outstanding_customer_invoices () from public;
revoke all on function public.treasury_record_supplier_payment (uuid, numeric, date, text, text) from public;
revoke all on function public.treasury_record_customer_receipt (uuid, numeric, date, text, text) from public;
revoke all on function public.treasury_record_salary_payment (uuid, numeric, date, date, text, text) from public;

grant execute on function public.treasury_get_outstanding_supplier_invoices () to authenticated;
grant execute on function public.treasury_get_outstanding_customer_invoices () to authenticated;
grant execute on function public.treasury_record_supplier_payment (uuid, numeric, date, text, text) to authenticated;
grant execute on function public.treasury_record_customer_receipt (uuid, numeric, date, text, text) to authenticated;
grant execute on function public.treasury_record_salary_payment (uuid, numeric, date, date, text, text) to authenticated;

commit;
