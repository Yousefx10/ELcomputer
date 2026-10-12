-- Phase 3/M2. No hosted Auth creation, provider activation or historical capture.
begin;

-- Defaults affect only future inserts; saved merchant rows are preserved.
alter table public.site_settings
 alter column site_name set default '',
 alter column landing_page_title set default '',
 alter column footer_cta_title set default '',
 alter column footer_cta_subtitle set default '',
 alter column footer_cta_button_label set default '',
 alter column footer_cta_button_url set default '',
 alter column footer_email set default '',
 alter column footer_phone set default '',
 alter column footer_address set default '',
 alter column copyright_text set default '',
 alter column footer_modern_card_title set default '',
 alter column footer_modern_card_text set default '',
 alter column footer_modern_card_button_label set default '',
 alter column footer_modern_card_button_url set default '',
 alter column footer_modern_community_text set default '',
 alter column footer_modern_bottom_left_text set default '',
 alter column footer_modern_bottom_center_text set default '',
 alter column auth_show_visual_text set default false,
 alter column hero_enabled set default false,
 alter column banner_ad_1_enabled set default false,
 alter column banner_ad_2_enabled set default false,
 alter column payment_cash_enabled set default false;

-- An occupied private namespace is unsupported. Abort atomically rather than
-- changing unrelated schema/function privileges in an existing installation.
create schema private;
revoke all on schema private from public,anon,authenticated,service_role;
create table private.installation_bootstrap (
 singleton boolean primary key default true check(singleton),
 installation_id uuid not null unique,
 phase text not null check(phase in ('available','registered','auth_started','complete','sealed_existing')),
 revision bigint not null default 0 check(revision>=0),
 binding jsonb,
 registered_at timestamptz,
 auth_subject uuid, -- Historical receipt: no FK; deletion/reset cannot reopen it.
 completed_at timestamptz,
 error_code text check(error_code in ('auth_unresolved','identity_conflict','promotion_failed')),
 check((phase in ('available','sealed_existing'))=(binding is null)),
 check((phase='complete')=(completed_at is not null)),
 check(phase<>'complete' or auth_subject is not null)
);
alter table private.installation_bootstrap enable row level security;
revoke all on private.installation_bootstrap from public,anon,authenticated,service_role;

create function private.installation_assert_operator() returns void language plpgsql set search_path='' as $$
begin
 if session_user<>'postgres' then raise exception 'Installation operator required.' using errcode='42501';end if;
end $$;

-- Closed allowlist; any new/unknown populated public table blocks bootstrap.
-- Identity rows may belong only to the exact interrupted Auth request subject.
create function private.installation_assert_empty(p_subject uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare t text;occupied boolean;
begin
 perform private.installation_assert_operator();
 if exists(select 1 from auth.users where p_subject is null or id<>p_subject) or
    exists(select 1 from public.admin_users) or
    exists(select 1 from public.customer_profiles where p_subject is null or id<>p_subject) then
  raise exception 'Installation identity conflict.' using errcode='42501';end if;
 for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and c.relname<>all(array[
  'after_sales_communication_settings','after_sales_policies','after_sales_return_reasons','chat_settings','email_provider_settings','help_categories','shipping_city_mappings','shipping_status_mappings','sms_provider_settings','sms_templates','sms_order_event_settings','specification_definitions','site_settings','quick_setup_state','quick_setup_revisions','shipping_provider_settings','customer_profiles','admin_users']) loop
  execute format('select exists(select 1 from public.%I)',t) into occupied;
  if occupied then raise exception 'Installation contains business history.' using errcode='42501';end if;
 end loop;
 if exists(select 1 from public.shipping_provider_settings where company_id is not null or product_id is not null or is_enabled or auto_create_labels or reverse_enabled or access_token_encrypted is not null or webhook_secret_encrypted is not null or cities_cache<>'[]'::jsonb or products_cache<>'[]'::jsonb) or
    exists(select 1 from public.sms_provider_settings where is_enabled or account_id_encrypted is not null or password_encrypted is not null or hash_secret_encrypted is not null) or
    exists(select 1 from public.email_provider_settings where api_key_encrypted is not null or webhook_token_encrypted is not null or coalesce((config->>'is_enabled')::boolean,false)) or
    exists(select 1 from public.site_settings where payment_cash_enabled or payment_card_enabled or payment_bank_transfer_enabled or payment_instapay_enabled or payment_paypal_enabled or auth_facebook_enabled or erp_mode<>'built_in') or
    exists(select 1 from public.chat_settings where is_enabled) or
    exists(select 1 from public.after_sales_policies where warranty_enabled or return_enabled) or
    exists(select 1 from public.after_sales_communication_settings where is_enabled or sms_enabled or email_enabled) then
  raise exception 'Installation providers are configured.' using errcode='42501';end if;
end $$;

-- Classify before adding the missing neutral PDC row. Historical installs have
-- a PDC singleton and are permanently sealed, even with no current owner.
do $$
declare fresh boolean:=false;install uuid;
begin
 select installation_id into strict install from public.quick_setup_state where singleton;
 if not exists(select 1 from public.shipping_provider_settings) and
    not exists(select 1 from public.quick_setup_state where revision<>0 or selections<>'{}'::jsonb) and
    (select count(*)=17 and bool_and(revision=0) from public.quick_setup_revisions) then
  begin perform private.installation_assert_empty();fresh:=true;
  exception when insufficient_privilege then fresh:=false;end;
 end if;
 insert into private.installation_bootstrap(installation_id,phase) values(install,case when fresh then 'available' else 'sealed_existing' end);
end $$;

alter table public.shipping_provider_settings alter column company_id drop not null,alter column product_id drop not null;
alter table public.shipping_provider_settings add constraint shipping_provider_settings_company_valid check(company_id is null or company_id ~ '^[0-9]{1,40}$');
alter table public.shipping_provider_settings add constraint shipping_provider_settings_merchant_required check(not(is_enabled or auto_create_labels or reverse_enabled) or (company_id is not null and product_id is not null));
insert into public.shipping_provider_settings(id,display_name,base_url,company_id,product_id)
 values('pdc','PDC Courier','https://clientsapi.pdc-eg.com/api/ClientUsers/V6/',null,null) on conflict(id) do nothing;
-- One-time trusted initial seed, before any evidence/owner/request exists.
-- Existing configuration generations are never rewritten.
do $$
declare previous text:=current_setting('app.quick_setup_write',true);
begin
 if exists(select 1 from private.installation_bootstrap where phase='available') then
  perform set_config('app.quick_setup_write','on',true);
  update public.quick_setup_revisions set revision=0 where domain='shipping' and revision=1;
  perform set_config('app.quick_setup_write',coalesce(previous,''),true);
 end if;
end $$;

create function private.installation_journal_guard() returns trigger language plpgsql set search_path='' as $$
begin
 perform private.installation_assert_operator();
 if tg_op in ('DELETE','TRUNCATE') then raise exception 'Installation journal is retained.' using errcode='42501';end if;
 if current_setting('app.installation_write',true) is distinct from 'on' or tg_op<>'UPDATE' then raise exception 'Installation command required.' using errcode='42501';end if;
 if old.phase in ('complete','sealed_existing') or new.singleton is distinct from old.singleton or new.installation_id is distinct from old.installation_id or new.revision<>old.revision+1 or
    (old.binding is not null and (new.binding is distinct from old.binding or new.registered_at is distinct from old.registered_at)) or
    (old.auth_subject is not null and new.auth_subject is distinct from old.auth_subject) or
    not((old.phase='available' and new.phase='registered') or (old.phase='registered' and new.phase='auth_started') or (old.phase='auth_started' and new.phase in ('auth_started','complete'))) then
  raise exception 'Installation checkpoint is immutable.' using errcode='42501';end if;
 return new;
end $$;
create trigger installation_journal_guard before insert or update or delete on private.installation_bootstrap for each row execute function private.installation_journal_guard();
create trigger installation_journal_truncate before truncate on private.installation_bootstrap for each statement execute function private.installation_journal_guard();

-- Canonical HTTPS origin only: no credentials, path, query, fragment or Host.
create function public.installation_https_origin(p_origin text) returns text language plpgsql immutable set search_path='' as $$
declare origin text:=lower(btrim(p_origin));
begin
 -- The existing settings editor accepts case variants and a single root slash.
 -- Normalize reads only; preserve the saved merchant value on upgrade.
 if right(origin,1)='/' then origin:=left(origin,length(origin)-1);end if;
 if origin is null or length(origin)>253 or origin !~ '^https://[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[1-9][0-9]{0,4})?$' or origin ~ '\.\.' or origin ~ '(^https://|\.)-' or origin ~ '-(\.|:|$)' then return null;end if;
 if position(':' in substr(origin,9))>0 and split_part(substr(origin,9),':',2)::integer>65535 then return null;end if;
 if right(origin,4)=':443' then return left(origin,length(origin)-4);end if;
 return origin;
end $$;

create function private.installation_binding(p_binding jsonb) returns private.installation_bootstrap language plpgsql security definer set search_path='' as $$
declare j private.installation_bootstrap;k text;
begin
 perform private.installation_assert_operator();
 if p_binding is null or jsonb_typeof(p_binding)<>'object' or p_binding-array['installation_id','request_id','target_digest','project_ref','site_origin','owner_email_digest']<>'{}'::jsonb or (select count(*) from jsonb_object_keys(p_binding))<>6 then raise exception 'Invalid installation binding.' using errcode='22023';end if;
 foreach k in array array['installation_id','request_id','target_digest','project_ref','site_origin','owner_email_digest'] loop
  if jsonb_typeof(p_binding->k) is distinct from 'string' then raise exception 'Invalid installation binding.' using errcode='22023';end if;
 end loop;
 if p_binding->>'installation_id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or p_binding->>'request_id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or p_binding->>'target_digest' !~ '^[0-9a-f]{64}$' or p_binding->>'owner_email_digest' !~ '^[0-9a-f]{64}$' or p_binding->>'project_ref' !~ '^[a-z0-9]{20}$' or public.installation_https_origin(p_binding->>'site_origin') is null then raise exception 'Invalid installation binding.' using errcode='22023';end if;
 select * into strict j from private.installation_bootstrap where singleton for update;
 if j.installation_id::text is distinct from p_binding->>'installation_id' or j.installation_id is distinct from (select installation_id from public.quick_setup_state where singleton) or j.phase='sealed_existing' or (j.binding is not null and j.binding is distinct from p_binding) then raise exception 'Installation binding conflict.' using errcode='42501';end if;
 return j;
end $$;

create function private.installation_register(p_binding jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.installation_bootstrap;
begin
 j:=private.installation_binding(p_binding);
 if j.phase='available' then
  lock table auth.users,public.admin_users in share row exclusive mode;
  perform private.installation_assert_empty();
  perform set_config('app.installation_write','on',true);
  update private.installation_bootstrap set binding=p_binding,phase='registered',revision=revision+1,registered_at=clock_timestamp() where singleton returning * into j;
  perform set_config('app.installation_write','',true);
 end if;
 return to_jsonb(j);
end $$;

-- Compare-and-set before HTTP. Only the winner may create an Auth identity.
create function private.installation_start_auth(p_binding jsonb,p_revision bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.installation_bootstrap;
begin
 j:=private.installation_binding(p_binding);
 if j.phase<>'registered' or j.revision is distinct from p_revision then raise exception 'Installation retry conflict.' using errcode='40001';end if;
 perform private.installation_assert_empty();
 perform set_config('app.installation_write','on',true);
 update private.installation_bootstrap set phase='auth_started',revision=revision+1 where singleton returning * into j;
 perform set_config('app.installation_write','',true);
 return to_jsonb(j);
end $$;

-- Auth Admin API happens separately. This transaction only verifies/promotes.
create function private.installation_link_owner(p_binding jsonb,p_subject uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.installation_bootstrap;u auth.users;marker jsonb;permissions_value jsonb;full_name_value text;
begin
 j:=private.installation_binding(p_binding);
 if j.phase='complete' then
  if j.auth_subject is distinct from p_subject then raise exception 'Installation subject conflict.' using errcode='42501';end if;
  return to_jsonb(j); -- Historical receipt, even after demotion/reset/deletion.
 end if;
 if j.phase<>'auth_started' or p_subject is null then raise exception 'Auth request required.' using errcode='42501';end if;
 lock table auth.users,public.admin_users in share row exclusive mode;
 perform private.installation_assert_empty(p_subject);
 select * into u from auth.users where id=p_subject for update;
 marker:=jsonb_build_object('version',1,'installation_id',p_binding->>'installation_id','request_id',p_binding->>'request_id','target_digest',p_binding->>'target_digest','project_ref',p_binding->>'project_ref');
 if u.id is null or u.is_anonymous or u.email_confirmed_at is null or u.created_at is null or u.created_at<j.registered_at or u.raw_app_meta_data->'elcomputer_bootstrap' is distinct from marker or
    encode(sha256(convert_to(lower(btrim(u.email)),'UTF8')),'hex') is distinct from p_binding->>'owner_email_digest' then raise exception 'Unverifiable installation identity.' using errcode='42501';end if;
 select jsonb_object_agg(key,true) into permissions_value from jsonb_object_keys(public.default_admin_permissions()) key;
 full_name_value:=left(coalesce(u.raw_user_meta_data->>'full_name',''),120);
 insert into public.admin_users(id,email,full_name,role,permissions,is_active) values(u.id,lower(btrim(u.email)),full_name_value,'owner',permissions_value,true);
 insert into public.admin_activity_logs(admin_user_id,author_name,author_email,author_role,action_key,description,metadata)
  values(u.id,coalesce(nullif(full_name_value,''),lower(btrim(u.email))),lower(btrim(u.email)),'owner','installation.owner.bootstrap','Created the first installation owner.',jsonb_build_object('installation_id',j.installation_id,'request_id',p_binding->>'request_id','auth_subject',u.id));
 perform set_config('app.installation_write','on',true);
 update private.installation_bootstrap set phase='complete',revision=revision+1,auth_subject=u.id,completed_at=clock_timestamp(),error_code=null where singleton returning * into j;
 perform set_config('app.installation_write','',true);
 return to_jsonb(j);
end $$;

create function private.installation_record_error(p_binding jsonb,p_code text) returns void language plpgsql security definer set search_path='' as $$
declare j private.installation_bootstrap;
begin
 j:=private.installation_binding(p_binding);
 if j.phase='complete' then return;end if;
 if j.phase<>'auth_started' or p_code is null or p_code not in ('auth_unresolved','identity_conflict','promotion_failed') then raise exception 'Invalid installation error.' using errcode='22023';end if;
 perform set_config('app.installation_write','on',true);
 update private.installation_bootstrap set revision=revision+1,error_code=p_code where singleton;
 perform set_config('app.installation_write','',true);
end $$;

-- Saved origin wins; a trusted fresh-install request can supply the same origin
-- before the owner configures site settings. No private receipt is returned.
create function public.after_sales_notification_origin() returns text language sql stable security definer set search_path='' as $$
 select coalesce(public.installation_https_origin((select seo_site_url from public.site_settings where key='default')),public.installation_https_origin((select binding->>'site_origin' from private.installation_bootstrap where phase in ('registered','auth_started','complete'))));
$$;

-- Guarded replacement of precisely the known source-70 construction. Existing
-- captured intents/queues/settings and their immutable snapshots stay untouched.
do $$
declare definition text;needle text;
begin
 definition:=pg_get_functiondef('public.after_sales_capture_communication()'::regprocedure);
 needle:='''https://new.elcomputer.net''||case';
 if position(needle in definition)=0 then raise exception 'Unexpected Claims origin source.';end if;
 definition:=replace(definition,needle,'public.after_sales_notification_origin()||case');
 needle:='coalesce(source_reason,public.after_sales_communication_reason(intent))';
if position(needle in definition)=0 then raise exception 'Unexpected Claims suppression source.';end if;
 definition:=replace(definition,needle,'coalesce(source_reason,public.after_sales_communication_reason(intent),case when payload_value->>''claim_url'' is null then ''invalid_template'' end)');
 execute definition;
end $$;

revoke all on all functions in schema private from public,anon,authenticated,service_role;
grant usage on schema private to postgres;
grant all on private.installation_bootstrap to postgres;
grant execute on all functions in schema private to postgres;
revoke all on function public.installation_https_origin(text),public.after_sales_notification_origin() from public,anon,authenticated,service_role;
grant execute on function public.after_sales_notification_origin() to service_role;
commit;
