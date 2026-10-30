-- 105: verified order-owner recipients; sending and capture remain unchanged.
-- Existing schema104, checkout, Email settings and historical rows are preserved.
begin;
set local lock_timeout='5s';
create function private.order_email_recipient_owned(o public.customer_orders) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u join public.customer_profiles p on p.id=u.id
  where u.id=o.user_id and p.is_active and not coalesce(u.is_anonymous,false)
   and u.email_confirmed_at is not null and nullif(lower(btrim(u.email)),'') is not null
   and lower(btrim(u.email))=lower(btrim(o.email)));
$$;
revoke all on function private.order_email_recipient_owned(public.customer_orders) from public,anon,authenticated,service_role;

create or replace function private.order_email_reason(e public.order_email_events) returns text
language plpgsql stable security definer set search_path='' as $$
declare o public.customer_orders;s public.order_email_settings;p public.email_provider_settings;
begin
 select * into s from public.order_email_settings where id;
 if not coalesce(s.is_enabled,false) or s.revision is distinct from e.setting_revision or e.created_at<s.enabled_since then return 'order_email_disabled_or_changed';end if;
 if e.expires_at<=clock_timestamp() then return 'expired';end if;
 select * into p from public.email_provider_settings where id='brevo';
 if not coalesce(public.email_ready(p),false) or p.revision is distinct from e.provider_revision then return 'provider_disabled_or_changed';end if;
 select * into o from public.customer_orders where id=e.order_id;
 if not found or o.user_id is null or o.checkout_cart_id is null or o.is_preorder or o.erp_owner<>'built_in'
  or o.payment_method not in ('card','cash') or o.currency<>'EGP'
  or lower(o.email) is distinct from e.recipient or o.total_amount::text is distinct from e.payload->>'total_amount'
  or o.payment_method is distinct from e.payload->>'payment_method'
  or o.status in ('cancelled','refunded') then return 'order_changed';end if;
 if private.order_email_recipient_owned(o) is distinct from true then return 'recipient_unverified';end if;
 if e.event_type='payment_verified' and private.order_email_paid(o) is distinct from true then return 'payment_unverified';end if;
 if e.event_type='order_received' and o.payment_status<>'pending' then return 'receipt_superseded';end if;
 return null;
end $$;

create or replace function private.capture_order_email() returns trigger
language plpgsql security definer set search_path='' as $$
declare s public.order_email_settings;p public.email_provider_settings;kind text;
begin
 -- Disabled capture creates no sendable backlog and performs no historical scan.
 select * into s from public.order_email_settings where id;
 if not coalesce(s.is_enabled,false) then return new;end if;
 select * into p from public.email_provider_settings where id='brevo';
 if not coalesce(public.email_ready(p),false) then return new;end if;
 if new.user_id is null or new.checkout_cart_id is null or new.is_preorder or new.erp_owner<>'built_in'
  or new.payment_method not in ('card','cash') or new.currency<>'EGP' or new.email is null then return new;end if;
 if private.order_email_recipient_owned(new) is distinct from true then return new;end if;
 if tg_op='INSERT' and new.payment_status='pending' then kind:='order_received';
 elsif tg_op='UPDATE' and new.payment_status='paid' and old.payment_status is distinct from new.payment_status
  and private.order_email_paid(new) then kind:='payment_verified';else return new;end if;
 perform set_config('app.order_email_write','on',true);
 insert into public.order_email_events(order_id,event_type,locale,recipient,payload,setting_revision,provider_revision)
 values(new.id,kind,new.sms_locale,lower(new.email),jsonb_build_object('id',new.id,'order_number',new.order_number,
  'payment_method',new.payment_method,'total_amount',new.total_amount::text,'currency',new.currency),s.revision,p.revision)
 on conflict(order_id,event_type) do nothing;
 return new;
exception when others then
 -- Notification storage must never undo a checkout or authoritative settlement.
 -- Preserve a sanitized operational failure; no recipient/body/raw error in logs.
 raise log 'Order email capture failed (SQLSTATE %).',sqlstate;
 return new;
end $$;
commit;
