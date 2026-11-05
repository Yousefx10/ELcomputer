begin;
create table private.sms_marketing_controls(id boolean primary key default true check(id),is_enabled boolean not null default false,revision integer not null default 0,unit_cost_minor integer check(unit_cost_minor between 1 and 100000),commercial_reference text not null default '',currency text not null default 'EGP' check(currency='EGP'),max_recipients integer not null default 100 check(max_recipients between 1 and 500),max_segments integer not null default 3 check(max_segments between 1 and 10),unicode_accepted boolean not null default false,updated_by uuid references public.admin_users(id));
insert into private.sms_marketing_controls(id) values(true);
create table private.sms_marketing_contacts(id uuid primary key default gen_random_uuid(),phone text not null unique check(phone~'^\+201[0125][0-9]{8}$'),locale text not null check(locale in('en','ar')),tags text[] not null default '{}',consented_at timestamptz not null,consent_reference text not null check(length(consent_reference) between 8 and 200),source_reference text not null check(length(source_reference) between 8 and 200),imported_by uuid not null references public.admin_users(id),revision integer not null default 1,created_at timestamptz not null default now());
create table private.sms_marketing_suppressions(phone text primary key,reason text not null,created_at timestamptz not null default now(),actor_id uuid references public.admin_users(id));
create table private.sms_campaigns(id uuid primary key default gen_random_uuid(),title text not null check(length(title) between 1 and 100),template_id uuid not null references public.sms_templates(id),locale text not null check(locale in('en','ar','all')),tags text[] not null default '{}',scheduled_at timestamptz not null,budget_minor integer not null check(budget_minor between 1 and 10000000),recipient_limit integer not null check(recipient_limit between 1 and 500),state text not null default 'draft' check(state in('draft','review','approved','paused','cancelled')),revision integer not null default 0,template_revision integer,settings_revision integer,provider_revision integer,planned_recipients integer not null default 0,planned_segments integer not null default 0,reserved_cost_minor integer not null default 0,created_by uuid not null references public.admin_users(id),approved_by uuid references public.admin_users(id),approved_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table private.sms_campaign_recipients(id uuid primary key default gen_random_uuid(),campaign_id uuid not null references private.sms_campaigns(id),contact_id uuid not null references private.sms_marketing_contacts(id),contact_revision integer not null,recipient text not null,locale text not null,body text not null check(length(body) between 1 and 4000),sender text not null,encoding text not null check(encoding in('gsm7','utf16')),units integer not null,segments integer not null check(segments between 1 and 10),cost_minor integer not null check(cost_minor>0),state text not null default 'ready' check(state in('ready','preparing','queued','suppressed')),lease_token uuid,lease_until timestamptz,attempts integer not null default 0,batch_id uuid references public.sms_batches(id),reason text not null default '',unique(campaign_id,contact_id));
create table private.sms_marketing_audit(id bigint generated always as identity primary key,actor_id uuid references public.admin_users(id),action text not null,campaign_id uuid references private.sms_campaigns(id),metadata jsonb not null default '{}',created_at timestamptz not null default now());
create function private.sms_marketing_audit(p_actor uuid,p_action text,p_campaign uuid,p_metadata jsonb default '{}') returns void language sql security definer set search_path='' as $$ insert into private.sms_marketing_audit(actor_id,action,campaign_id,metadata) values(p_actor,p_action,p_campaign,p_metadata) $$;
create function public.sms_marketing_settings(p_actor uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
 perform private.sms_channel_admin(p_actor,'sms.marketing.view');return jsonb_build_object('controls',(select to_jsonb(c) from private.sms_marketing_controls c where id),'contacts',(select count(*) from private.sms_marketing_contacts),'suppressed',(select count(*) from private.sms_marketing_suppressions),'campaigns',(select coalesce(jsonb_agg(r order by created_at desc),'[]') from(select c.*,(select coalesce(jsonb_object_agg(status,n),'{}') from(select coalesce(b.status,r.state) status,count(*) n from private.sms_campaign_recipients r left join public.sms_batches b on b.id=r.batch_id where r.campaign_id=c.id group by 1)x) outcomes from private.sms_campaigns c order by created_at desc limit 50)r));
end $$;
create function public.sms_marketing_configure(p_actor uuid,p_revision integer,p_settings jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.sms_marketing_controls;begin
 perform private.sms_channel_admin(p_actor,'sms.marketing.configure');select * into c from private.sms_marketing_controls where id for update;if c.revision<>p_revision then raise exception 'Marketing settings changed.';end if;
 if coalesce((p_settings->>'enabled')::boolean,false) and(nullif(p_settings->>'unit_cost_minor','') is null or length(p_settings->>'commercial_reference')<8 or(p_settings->>'unicode_accepted')::boolean is distinct from true) then raise exception 'Accepted provider pricing and Unicode terms are required.';end if;
 update private.sms_marketing_controls set is_enabled=coalesce((p_settings->>'enabled')::boolean,false),unit_cost_minor=nullif(p_settings->>'unit_cost_minor','')::integer,commercial_reference=left(coalesce(p_settings->>'commercial_reference',''),200),max_recipients=(p_settings->>'max_recipients')::integer,max_segments=(p_settings->>'max_segments')::integer,unicode_accepted=coalesce((p_settings->>'unicode_accepted')::boolean,false),revision=revision+1,updated_by=p_actor where id;
 perform private.sms_marketing_audit(p_actor,'settings',null,jsonb_build_object('revision',c.revision+1));return public.sms_marketing_settings(p_actor);
end $$;
create function public.sms_marketing_import(p_actor uuid,p_contacts jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;n integer:=0;skipped integer:=0;begin
 perform private.sms_channel_admin(p_actor,'sms.marketing.consent');if jsonb_typeof(p_contacts)<>'array' or jsonb_array_length(p_contacts) not between 1 and 500 then raise exception 'Import 1 to 500 explicitly consented contacts.';end if;
 for r in select value from jsonb_array_elements(p_contacts) loop
  if(r->>'opt_in')::boolean is distinct from true or(r->>'consented_at')::timestamptz>clock_timestamp() or(r->>'consented_at')::timestamptz<clock_timestamp()-interval '10 years' or r->>'locale' not in('en','ar') or jsonb_array_length(r->'tags')>10 then raise exception 'Valid consent provenance is required.';end if;
  if exists(select 1 from private.sms_marketing_suppressions where phone=r->>'phone') then skipped:=skipped+1;continue;end if;
  insert into private.sms_marketing_contacts(phone,locale,tags,consented_at,consent_reference,source_reference,imported_by) values(r->>'phone',r->>'locale',array(select jsonb_array_elements_text(r->'tags')),(r->>'consented_at')::timestamptz,r->>'consent_reference',r->>'source_reference',p_actor) on conflict(phone) do nothing;if found then n:=n+1;else skipped:=skipped+1;end if;
 end loop;perform private.sms_marketing_audit(p_actor,'import',null,jsonb_build_object('added',n,'skipped',skipped));return jsonb_build_object('added',n,'skipped',skipped);
end $$;
create function public.sms_marketing_suppress(p_actor uuid,p_phone text,p_reason text) returns void language plpgsql security definer set search_path='' as $$ begin
 perform private.sms_channel_admin(p_actor,'sms.marketing.consent');if p_phone!~'^\+201[0125][0-9]{8}$' or length(p_reason) not between 1 and 200 then raise exception 'Invalid suppression.';end if;
 insert into private.sms_marketing_suppressions(phone,reason,actor_id) values(p_phone,p_reason,p_actor) on conflict do nothing;perform private.sms_marketing_audit(p_actor,'suppress',null);
end $$;
create function public.sms_marketing_unsubscribe(p_contact uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server authorization required.';end if;
 insert into private.sms_marketing_suppressions(phone,reason) select phone,'recipient_unsubscribe' from private.sms_marketing_contacts where id=p_contact on conflict do nothing;
 if found then perform private.sms_marketing_audit(null,'unsubscribe',null);end if;
end $$;
create function public.sms_campaign_save(p_actor uuid,p_id uuid,p_revision integer,p_draft jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.sms_campaigns;t public.sms_templates;begin
 perform private.sms_channel_admin(p_actor,'sms.marketing.manage');select * into t from public.sms_templates where id=(p_draft->>'template_id')::uuid;
 if not found or t.traffic_type<>'campaign' or not t.is_enabled or t.text_en='' or t.text_ar='' or not(t.variables<@array['unsubscribe_url']) or not('unsubscribe_url'=any(t.variables)) then raise exception 'Choose an enabled bilingual campaign template with unsubscribe_url.';end if;
 if (p_draft->>'scheduled_at')::timestamptz<clock_timestamp()-interval '1 minute' or(p_draft->>'scheduled_at')::timestamptz>clock_timestamp()+interval '1 year' or jsonb_array_length(p_draft->'tags')>10 then raise exception 'Invalid campaign schedule or tags.';end if;
 if p_id is null then insert into private.sms_campaigns(title,template_id,locale,tags,scheduled_at,budget_minor,recipient_limit,created_by) values(p_draft->>'title',t.id,p_draft->>'locale',array(select jsonb_array_elements_text(p_draft->'tags')),(p_draft->>'scheduled_at')::timestamptz,(p_draft->>'budget_minor')::integer,(p_draft->>'recipient_limit')::integer,p_actor) returning * into c;
 else select * into c from private.sms_campaigns where id=p_id for update;if not found or c.revision<>p_revision or c.state<>'draft' then raise exception 'Only the current draft may be edited.';end if;
 update private.sms_campaigns set title=p_draft->>'title',template_id=t.id,locale=p_draft->>'locale',tags=array(select jsonb_array_elements_text(p_draft->'tags')),scheduled_at=(p_draft->>'scheduled_at')::timestamptz,budget_minor=(p_draft->>'budget_minor')::integer,recipient_limit=(p_draft->>'recipient_limit')::integer,revision=revision+1,updated_at=clock_timestamp() where id=c.id returning * into c;end if;
 perform private.sms_marketing_audit(p_actor,'draft',c.id,jsonb_build_object('revision',c.revision));return to_jsonb(c);
end $$;
create function public.sms_campaign_preview_source(p_actor uuid,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c private.sms_campaigns;begin
 perform private.sms_channel_admin(p_actor,'sms.marketing.manage');select * into c from private.sms_campaigns where id=p_id;if not found or c.state<>'draft' then raise exception 'Campaign is not a draft.';end if;
 return jsonb_build_object('campaign',to_jsonb(c),'controls',(select to_jsonb(s) from private.sms_marketing_controls s where id),'template',(select to_jsonb(t) from public.sms_templates t where id=c.template_id),'contacts',(select coalesce(jsonb_agg(r order by id),'[]') from(select x.id,x.phone,x.locale,x.revision from private.sms_marketing_contacts x where(c.locale='all' or c.locale=x.locale) and x.tags@>c.tags and not exists(select 1 from private.sms_marketing_suppressions s where s.phone=x.phone) order by x.id limit 501)r),'provider',(select jsonb_build_object('revision',config_revision,'sender',default_sender,'senders',sender_names) from public.sms_provider_settings where id='vodafone'));
end $$;
create function public.sms_campaign_prepare(p_actor uuid,p_id uuid,p_revision integer,p_rows jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.sms_campaigns;s private.sms_marketing_controls;t public.sms_templates;r jsonb;person private.sms_marketing_contacts;n integer;segs integer;cost integer;begin
 perform private.sms_channel_admin(p_actor,'sms.marketing.manage');select * into s from private.sms_marketing_controls where id for update;select * into c from private.sms_campaigns where id=p_id for update;select * into t from public.sms_templates where id=c.template_id for share;
 if c.id is null or c.state<>'draft' or c.revision<>p_revision or s.unit_cost_minor is null or s.commercial_reference='' or not s.unicode_accepted or not t.is_enabled or t.traffic_type<>'campaign' then raise exception 'Campaign or accepted provider terms are unavailable.';end if;
 n:=jsonb_array_length(p_rows);if jsonb_typeof(p_rows)<>'array' or n not between 1 and least(c.recipient_limit,s.max_recipients) then raise exception 'Audience exceeds campaign send limit or is empty.';end if;
 if n<>(select count(*) from private.sms_marketing_contacts x where(c.locale='all' or c.locale=x.locale) and x.tags@>c.tags and not exists(select 1 from private.sms_marketing_suppressions z where z.phone=x.phone)) then raise exception 'Audience changed. Preview again.';end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  select * into person from private.sms_marketing_contacts where id=(r->>'contact_id')::uuid for share;
  if not found or person.revision<>(r->>'contact_revision')::integer or person.phone<>r->>'recipient' or person.locale<>r->>'locale' or(c.locale<>'all' and c.locale<>person.locale) or not person.tags@>c.tags or exists(select 1 from private.sms_marketing_suppressions where phone=person.phone) or(r->>'segments')::integer not between 1 and s.max_segments or not((r->>'sender')=any(array(select unnest(sender_names) from public.sms_provider_settings where id='vodafone'))) then raise exception 'Audience, segment limit or approved sender changed.';end if;
  insert into private.sms_campaign_recipients(campaign_id,contact_id,contact_revision,recipient,locale,body,sender,encoding,units,segments,cost_minor) values(c.id,person.id,person.revision,person.phone,person.locale,r->>'body',r->>'sender',r->>'encoding',(r->>'units')::integer,(r->>'segments')::integer,(r->>'segments')::integer*s.unit_cost_minor);
 end loop;
 select sum(segments),sum(cost_minor) into segs,cost from private.sms_campaign_recipients where campaign_id=c.id;if cost>c.budget_minor then raise exception 'Campaign budget exceeded.';end if;
 update private.sms_campaigns set state='review',revision=revision+1,template_revision=t.revision,settings_revision=s.revision,provider_revision=(select config_revision from public.sms_provider_settings where id='vodafone'),planned_recipients=n,planned_segments=segs,reserved_cost_minor=cost,updated_at=clock_timestamp() where id=c.id returning * into c;
 perform private.sms_marketing_audit(p_actor,'prepared',c.id,jsonb_build_object('recipients',n,'segments',segs,'reserved_cost_minor',cost,'revision',c.revision));return to_jsonb(c);
end $$;
create function public.sms_campaign_control(p_actor uuid,p_id uuid,p_revision integer,p_action text,p_confirmation text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.sms_campaigns;s private.sms_marketing_controls;begin
 perform private.sms_channel_admin(p_actor,case when p_action in('approve','resume') then 'sms.marketing.approve' else 'sms.marketing.manage' end);select * into s from private.sms_marketing_controls where id for share;select * into c from private.sms_campaigns where id=p_id for update;
 if not found or c.revision<>p_revision then raise exception 'Campaign changed. Reload.';end if;
 if p_action in('approve','resume') then
  if c.state not in('review','paused') or c.settings_revision<>s.revision or not exists(select 1 from public.sms_templates where id=c.template_id and revision=c.template_revision and is_enabled and traffic_type='campaign') or c.provider_revision<>(select config_revision from public.sms_provider_settings where id='vodafone') or p_confirmation is distinct from 'APPROVE '||c.id::text||' '||c.revision::text||' '||c.planned_recipients::text||' '||c.planned_segments::text||' '||c.reserved_cost_minor::text||' EGP' then raise exception 'Review the exact audience, cost and current configuration.';end if;
  update private.sms_campaigns set state='approved',approved_by=p_actor,approved_at=clock_timestamp(),revision=revision+1,updated_at=clock_timestamp() where id=c.id returning * into c;
 elsif p_action='pause' and c.state='approved' then update private.sms_campaigns set state='paused',revision=revision+1,updated_at=clock_timestamp() where id=c.id returning * into c;
 elsif p_action='cancel' and c.state<>'cancelled' then update private.sms_campaigns set state='cancelled',revision=revision+1,updated_at=clock_timestamp() where id=c.id returning * into c;
 else raise exception 'Invalid campaign transition.';end if;
 perform private.sms_marketing_audit(p_actor,p_action,c.id,jsonb_build_object('revision',c.revision));return to_jsonb(c);
end $$;
create function private.sms_campaign_authorized(p_recipient uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.sms_campaign_recipients r join private.sms_campaigns c on c.id=r.campaign_id join private.sms_marketing_contacts x on x.id=r.contact_id join private.sms_marketing_controls s on s.id join public.sms_templates t on t.id=c.template_id join public.sms_provider_settings p on p.id='vodafone' where r.id=p_recipient and r.state<>'suppressed' and c.state='approved' and c.approved_at is not null and c.scheduled_at<=clock_timestamp() and c.settings_revision=s.revision and s.is_enabled and c.provider_revision=p.config_revision and t.revision=c.template_revision and t.is_enabled and t.traffic_type='campaign' and x.revision=r.contact_revision and x.phone=r.recipient and c.reserved_cost_minor<=c.budget_minor and r.cost_minor=r.segments*s.unit_cost_minor and not exists(select 1 from private.sms_marketing_suppressions z where z.phone=r.recipient));
$$;
create function public.sms_claim_marketing() returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.sms_campaign_recipients;begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server authorization required.';end if;
 update private.sms_campaign_recipients set state='suppressed',reason='claim_limit',lease_token=null where state='preparing' and lease_until<clock_timestamp() and attempts>=3;
 update private.sms_campaign_recipients set state='ready',lease_token=null where state='preparing' and lease_until<clock_timestamp() and batch_id is null;
 select x.* into r from private.sms_campaign_recipients x join private.sms_campaigns c on c.id=x.campaign_id where x.state='ready' and c.state='approved' and c.scheduled_at<=clock_timestamp() order by c.scheduled_at,x.id for update of x skip locked limit 1;
 if not found then return null;end if;
 if not private.sms_campaign_authorized(r.id) then update private.sms_campaign_recipients set state='suppressed',reason='consent_or_configuration_changed' where id=r.id;return jsonb_build_object('state','suppressed');end if;
 update private.sms_campaign_recipients set state='preparing',lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '1 minute',attempts=attempts+1 where id=r.id returning * into r;return to_jsonb(r);
end $$;
-- The legacy raw-list path cannot enqueue campaigns after this migration.
alter function public.sms_enqueue(jsonb,jsonb) rename to sms_enqueue_before_marketing;
create function public.sms_enqueue(p_batch jsonb,p_messages jsonb) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if p_batch->>'traffic_type' is distinct from 'notification' then raise exception 'Campaigns require a frozen consented audience and exact approval.';end if;return public.sms_enqueue_before_marketing(p_batch,p_messages);
end $$;
create function public.sms_enqueue_marketing(p_id uuid,p_token uuid,p_batch jsonb,p_messages jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.sms_campaign_recipients;b jsonb;begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server authorization required.';end if;
 select * into r from private.sms_campaign_recipients where id=p_id for update;
 if not found or r.state<>'preparing' or r.lease_token is distinct from p_token or r.lease_until<clock_timestamp() or not private.sms_campaign_authorized(r.id) or p_batch->>'idempotency_key' is distinct from 'marketing:'||r.id::text or p_batch->>'traffic_type' is distinct from 'campaign' or jsonb_array_length(p_messages)<>1 or p_messages#>>'{0,recipient}' is distinct from r.recipient or p_messages#>>'{0,body}' is distinct from r.body or p_messages#>>'{0,sender}' is distinct from r.sender or(p_messages#>>'{0,segments}')::integer is distinct from r.segments then raise exception 'Campaign consent or frozen content changed.';end if;
 b:=public.sms_enqueue_before_marketing(p_batch,p_messages);update private.sms_campaign_recipients set state='queued',batch_id=(b->>'id')::uuid,lease_token=null,lease_until=null where id=r.id;return b;
end $$;
create function public.sms_marketing_suppress_preparation(p_id uuid,p_token uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server authorization required.';end if;
 update private.sms_campaign_recipients set state='suppressed',reason='preparation_unavailable',lease_token=null where id=p_id and state='preparing' and lease_token=p_token;
end $$;
alter function public.sms_check_dispatch(uuid,uuid,integer) rename to sms_check_dispatch_before_marketing;
create function public.sms_check_dispatch(p_id uuid,p_token uuid,p_revision integer) returns boolean language plpgsql security definer set search_path='' as $$
declare ok boolean;r uuid;begin
 ok:=public.sms_check_dispatch_before_marketing(p_id,p_token,p_revision);if ok is distinct from true then return ok;end if;
 if exists(select 1 from public.sms_batches where id=p_id and traffic_type='campaign') then select id into r from private.sms_campaign_recipients where batch_id=p_id;return found and private.sms_campaign_authorized(r);end if;return true;
end $$;
create function public.sms_marketing_state() returns boolean language plpgsql stable security definer set search_path='' as $$ begin if auth.role() is distinct from 'service_role' then raise exception 'Server authorization required.';end if;return(select is_enabled from private.sms_marketing_controls where id);end $$;
create function public.sms_marketing_history(p_actor uuid,p_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
 perform private.sms_channel_admin(p_actor,'sms.marketing.reports');return jsonb_build_object('audit',(select coalesce(jsonb_agg(r order by id desc),'[]') from(select * from private.sms_marketing_audit where p_id is null or campaign_id=p_id order by id desc limit 100)r),'delivery','unverified');
end $$;
alter function public.default_admin_permissions() rename to default_admin_permissions_before_sms_marketing;
create function public.default_admin_permissions() returns jsonb language sql immutable set search_path='' as $$select public.default_admin_permissions_before_sms_marketing()||jsonb_build_object('sms.marketing.view',false,'sms.marketing.manage',false,'sms.marketing.consent',false,'sms.marketing.configure',false,'sms.marketing.approve',false,'sms.marketing.reports',false)$$;
do $$declare n text;f record;begin
 foreach n in array array['sms_marketing_controls','sms_marketing_contacts','sms_marketing_suppressions','sms_campaigns','sms_campaign_recipients','sms_marketing_audit'] loop execute format('alter table private.%I enable row level security',n);execute format('revoke all on private.%I from public,anon,authenticated',n);execute format('grant select on private.%I to service_role',n);end loop;
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('sms_marketing_settings','sms_marketing_configure','sms_marketing_import','sms_marketing_suppress','sms_marketing_unsubscribe','sms_campaign_save','sms_campaign_preview_source','sms_campaign_prepare','sms_campaign_control','sms_claim_marketing','sms_enqueue_marketing','sms_marketing_suppress_preparation','sms_enqueue','sms_check_dispatch','sms_marketing_state','sms_marketing_history') loop execute format('revoke all on function %s from public,anon,authenticated',f.sig);execute format('grant execute on function %s to service_role',f.sig);end loop;
 revoke all on function public.sms_enqueue_before_marketing(jsonb,jsonb),public.sms_check_dispatch_before_marketing(uuid,uuid,integer) from public,anon,authenticated,service_role;
 revoke all on function private.sms_marketing_audit(uuid,text,uuid,jsonb),private.sms_campaign_authorized(uuid) from public,anon,authenticated,service_role;
end $$;
commit;
