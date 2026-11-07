-- Owner request 7 Nov 2026 (phase 3B): the website makes each customer bill PDF itself, from the
-- Daftra bill's number and amounts. PDF files live on the VPS private documents disk; only their
-- path and checksum are stored here. Bill emails reuse the existing Brevo queue with the PDF
-- attached at send time. Dashboard → Settings → Bill design edits site_settings.bill_design.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

alter table public.site_settings
 add column bill_design jsonb not null default '{}'::jsonb,
 add constraint site_settings_bill_design_check check (jsonb_typeof(bill_design)='object' and octet_length(bill_design::text)<=4096);
comment on column public.site_settings.bill_design is 'Bill PDF design: titles, seller details, footer, logo, colours. Printed on every bill.';

create table private.order_bills (
 order_id uuid primary key references public.customer_orders(id) on delete cascade,
 bill_number text not null check (bill_number ~ '^[A-Za-z0-9/_-]{1,40}$'),
 bill_date date not null,
 source text not null check (source='daftra'),
 external_id text not null check (external_id ~ '^[0-9]{1,20}$'),
 locale text not null check (locale in ('en','ar')),
 file_path text not null check (file_path ~ '^vps-v1/bills/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'),
 sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
 size_bytes integer not null check (size_bytes between 5 and 5242880),
 total_amount numeric(12,2) not null check (total_amount>=0),
 paid_amount numeric(12,2) not null check (paid_amount>=0),
 content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
 generated_at timestamptz not null default clock_timestamp(),
 created_at timestamptz not null default clock_timestamp()
);
create table private.order_bill_emails (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.customer_orders(id) on delete cascade,
 kind text not null check (kind in ('issued','resend')),
 recipient text not null,
 locale text not null check (locale in ('en','ar')),
 email_message_id uuid unique,
 requested_by uuid references public.admin_users(id) on delete set null,
 created_at timestamptz not null default clock_timestamp()
);
create unique index order_bill_emails_issued_uidx on private.order_bill_emails(order_id) where kind='issued';
create index order_bill_emails_order_idx on private.order_bill_emails(order_id,created_at desc);
alter table private.order_bills enable row level security;
alter table private.order_bill_emails enable row level security;
revoke all on table private.order_bills,private.order_bill_emails from public,anon,authenticated;

create function private.order_bill_json(b private.order_bills) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('order_id',b.order_id,'bill_number',b.bill_number,'bill_date',b.bill_date,'source',b.source,'external_id',b.external_id,
  'locale',b.locale,'file_path',b.file_path,'sha256',b.sha256,'size_bytes',b.size_bytes,'total_amount',b.total_amount,'paid_amount',b.paid_amount,
  'content_sha256',b.content_sha256,'generated_at',b.generated_at,'created_at',b.created_at)
$$;

create function public.order_bill_get(p_order uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare b private.order_bills;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required.' using errcode='42501';end if;
 select * into b from private.order_bills where order_id=p_order;
 if not found then return null;end if;
 return private.order_bill_json(b);
end $$;

-- Saves the newest PDF version of an order's bill. Earlier files stay on disk untouched.
create function public.order_bill_save(p_bill jsonb) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare b private.order_bills;o public.customer_orders;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required.' using errcode='42501';end if;
 select * into o from public.customer_orders where id=(p_bill->>'order_id')::uuid for share;
 if not found or o.erp_owner is distinct from 'daftra' then raise exception 'Bills are made for Daftra orders only.' using errcode='22023';end if;
 insert into private.order_bills(order_id,bill_number,bill_date,source,external_id,locale,file_path,sha256,size_bytes,total_amount,paid_amount,content_sha256)
 values(o.id,p_bill->>'bill_number',(p_bill->>'bill_date')::date,'daftra',p_bill->>'external_id',p_bill->>'locale',p_bill->>'file_path',p_bill->>'sha256',
  (p_bill->>'size_bytes')::integer,(p_bill->>'total_amount')::numeric,(p_bill->>'paid_amount')::numeric,p_bill->>'content_sha256')
 on conflict(order_id) do update set bill_number=excluded.bill_number,bill_date=excluded.bill_date,external_id=excluded.external_id,locale=excluded.locale,
  file_path=excluded.file_path,sha256=excluded.sha256,size_bytes=excluded.size_bytes,total_amount=excluded.total_amount,paid_amount=excluded.paid_amount,
  content_sha256=excluded.content_sha256,generated_at=clock_timestamp()
 returning * into b;
 return private.order_bill_json(b);
end $$;

-- One "bill issued" email per order; staff resends are logged and limited (2 minutes apart, 5 a day).
-- The recipient follows the same ownership rule as order emails.
create function public.order_bill_email_request(p_order uuid,p_actor uuid,p_kind text) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare o public.customer_orders;b private.order_bills;e private.order_bill_emails;s public.order_email_settings;p public.email_provider_settings;a public.admin_users;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required.' using errcode='42501';end if;
 if p_kind not in ('issued','resend') or (p_kind='issued')<>(p_actor is null) then raise exception 'Invalid bill email request.' using errcode='22023';end if;
 if p_kind='resend' then
  select * into a from public.admin_users where id=p_actor and is_active and (role='owner' or coalesce((permissions->>'dashboard.orders')::boolean,false));
  if not found then raise exception 'Order permission is required.' using errcode='42501';end if;
 end if;
 select * into o from public.customer_orders where id=p_order for update;
 if not found then raise exception 'Order not found.' using errcode='22023';end if;
 select * into b from private.order_bills where order_id=o.id;
 if not found then return jsonb_build_object('skipped','no_bill');end if;
 select * into s from public.order_email_settings where id;
 select * into p from public.email_provider_settings where id='brevo';
 if not coalesce(s.is_enabled,false) or not coalesce(public.email_ready(p),false) then return jsonb_build_object('skipped','email_off');end if;
 if o.email is null or private.order_email_recipient_owned(o) is distinct from true then return jsonb_build_object('skipped','recipient_unverified');end if;
 if p_kind='issued' then
  select * into e from private.order_bill_emails where order_id=o.id and kind='issued';
  if found and e.email_message_id is not null then return jsonb_build_object('skipped','already_sent');end if;
 else
  if exists(select 1 from private.order_bill_emails where order_id=o.id and created_at>clock_timestamp()-interval '2 minutes') then return jsonb_build_object('skipped','too_soon');end if;
  if (select count(*) from private.order_bill_emails where order_id=o.id and created_at>clock_timestamp()-interval '1 day')>=5 then return jsonb_build_object('skipped','daily_limit');end if;
 end if;
 if e.id is null then
  insert into private.order_bill_emails(order_id,kind,recipient,locale,requested_by)
  values(o.id,p_kind,lower(o.email),case when o.sms_locale='ar' then 'ar' else 'en' end,p_actor) returning * into e;
  if p_kind='resend' then
   insert into public.admin_activity_logs(admin_user_id,author_name,author_email,author_role,action_key,description,metadata)
   values(a.id,coalesce(nullif(btrim(a.full_name),''),lower(btrim(a.email)),'Admin'),lower(btrim(coalesce(a.email,''))),case when a.role='owner' then 'owner' else 'admin' end,
    'orders.bill.resend','Sent the bill email again.',jsonb_build_object('order_id',o.id::text,'bill_number',b.bill_number));
  end if;
 end if;
 return jsonb_build_object('id',e.id,'recipient',e.recipient,'locale',e.locale,'order_number',o.order_number,'bill_number',b.bill_number);
end $$;

create function public.order_bill_email_mark(p_id uuid,p_message uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required.' using errcode='42501';end if;
 update private.order_bill_emails set email_message_id=p_message where id=p_id and (email_message_id is null or email_message_id=p_message);
 if not found then raise exception 'Bill email record changed.' using errcode='40001';end if;
end $$;

-- The email worker attaches the order's current bill PDF when the message is sent.
create function public.order_bill_for_email(p_message uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare b private.order_bills;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service role required.' using errcode='42501';end if;
 select bl.* into b from private.order_bill_emails e join private.order_bills bl on bl.order_id=e.order_id where e.email_message_id=p_message;
 if not found then return null;end if;
 return private.order_bill_json(b);
end $$;

revoke all on function private.order_bill_json(private.order_bills),public.order_bill_get(uuid),public.order_bill_save(jsonb),
 public.order_bill_email_request(uuid,uuid,text),public.order_bill_email_mark(uuid,uuid),public.order_bill_for_email(uuid) from public,anon,authenticated;
grant execute on function public.order_bill_get(uuid),public.order_bill_save(jsonb),public.order_bill_email_request(uuid,uuid,text),
 public.order_bill_email_mark(uuid,uuid),public.order_bill_for_email(uuid) to service_role;

notify pgrst,'reload schema';
commit;
