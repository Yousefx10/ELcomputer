-- A store can track by default instead of asking first. Asking first stays the default.
-- Records stay truthful: a default grant is stored as 'default', never as an opt-in.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

alter table private.meta_settings add column consent_mode text not null default 'opt_in' check(consent_mode in ('opt_in','default'));
alter table private.meta_consents add column basis text not null default 'opt_in' check(basis in ('opt_in','default'));

do $patch$
declare d text;
begin
 d:=pg_get_functiondef('public.commerce_meta_settings(uuid,uuid)'::regprocedure);
 if position($a$'pixelId',pixel_id,$a$ in d)=0 then raise exception 'settings anchor missing';end if;
 d:=replace(d,$a$'pixelId',pixel_id,$a$,$a$'pixelId',pixel_id,'consentMode',consent_mode,$a$);
 execute d;

 d:=pg_get_functiondef('public.commerce_meta_configure(uuid,integer,jsonb,text,boolean)'::regprocedure);
 if position($a$'testWindowMinutes','testEventLimit'))$a$ in d)=0 or position($a$or jsonb_typeof(p_config->'enabled')<>'boolean'$a$ in d)=0
  or position($a$pixel_id=coalesce(p_config->>'pixelId','')$a$ in d)=0 or position($a$'token_changed',p_token is not null or p_clear_token)$a$ in d)=0 then raise exception 'configure anchor missing';end if;
 d:=replace(d,$a$'testWindowMinutes','testEventLimit'))$a$,$a$'testWindowMinutes','testEventLimit','consentMode'))$a$);
 d:=replace(d,$a$or jsonb_typeof(p_config->'enabled')<>'boolean'$a$,$a$or coalesce(p_config->>'consentMode','opt_in') not in ('opt_in','default') or jsonb_typeof(p_config->'enabled')<>'boolean'$a$);
 d:=replace(d,$a$pixel_id=coalesce(p_config->>'pixelId','')$a$,$a$consent_mode=coalesce(p_config->>'consentMode',s.consent_mode),pixel_id=coalesce(p_config->>'pixelId','')$a$);
 d:=replace(d,$a$'token_changed',p_token is not null or p_clear_token)$a$,$a$'token_changed',p_token is not null or p_clear_token,'consent_mode',coalesce(p_config->>'consentMode',s.consent_mode))$a$);
 execute d;
end $patch$;

create function public.commerce_meta_default_consent(p_hash text,p_agent text default '',p_user uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s private.meta_settings;c private.meta_consents;begin
 perform private.checkout_server();select * into s from private.meta_settings where id;
 if p_hash!~'^[a-f0-9]{64}$' then raise exception 'Invalid consent.';end if;
 -- Only a store set to track by default records this basis. Test Events stay bound to their named customer.
 if not s.enabled or s.consent_mode<>'default' or s.test_event_code<>'' or public.store_analytics_is_internal_user(p_user) then return jsonb_build_object('granted',false);end if;
 -- A recorded decline stands. Clearing browser storage never turns tracking back on.
 if exists(select 1 from private.meta_consents where token_hash=p_hash and (not granted or revoked_at is not null)) then return jsonb_build_object('granted',false,'declined',true);end if;
 insert into private.meta_consents(token_hash,granted,policy_revision,user_agent,user_id,basis)
 values(p_hash,true,s.revision,left(coalesce(p_agent,''),512),p_user,'default')
 on conflict(token_hash) do update set policy_revision=excluded.policy_revision,user_agent=excluded.user_agent,user_id=coalesce(excluded.user_id,meta_consents.user_id),expires_at=clock_timestamp()+interval '180 days'
 returning * into c;
 return jsonb_build_object('granted',c.granted,'revision',s.revision);
end $$;
revoke all on function public.commerce_meta_default_consent(text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.commerce_meta_default_consent(text,text,uuid) to service_role;
commit;
