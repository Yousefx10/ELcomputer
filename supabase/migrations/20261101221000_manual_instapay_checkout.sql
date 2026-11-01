-- 109 candidate. Independent private InstaPay review; every activation OFF.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create table private.transfer_settings(
 id boolean primary key default true check(id),enabled boolean not null default false,enabled_since timestamptz,revision integer not null default 0,
 recipient_name text not null default '',recipient_address text not null default '',recipient_verified boolean not null default false,
 instructions_en text not null default '',instructions_ar text not null default '',verified_by uuid,verified_at timestamptz,
 mime_types text[] not null default array['image/jpeg','image/png','application/pdf'],max_bytes integer not null default 5242880 check(max_bytes between 1024 and 5242880),
 max_proofs integer not null default 3 check(max_proofs between 1 and 5)
);
insert into private.transfer_settings(id) values(true);
create table private.transfer_submissions(
 session_id uuid primary key references private.payment_checkout_sessions(id) on delete restrict,user_id uuid not null,
 reference text unique not null default 'TRF-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),
 state text not null default 'awaiting_proof' check(state in ('awaiting_proof','under_review','correction_requested','rejected','verified','verified_order_pending')),
 revision integer not null default 0,recipient_snapshot jsonb not null,settings_revision integer not null,
 proof_id uuid,customer_reference text,public_reason text,submitted_at timestamptz,reviewed_by uuid,reviewed_at timestamptz,created_at timestamptz not null default clock_timestamp()
);
create table private.transfer_proofs(
 id uuid primary key default gen_random_uuid(),session_id uuid not null references private.transfer_submissions(session_id) on delete restrict,user_id uuid not null,
 request_id uuid not null unique,sha256 text not null unique check(sha256~'^[a-f0-9]{64}$'),size_bytes integer not null check(size_bytes between 1 and 5242880),
 mime_type text not null check(mime_type in ('image/jpeg','image/png','application/pdf')),path text not null unique,
 state text not null default 'reserved' check(state in ('reserved','ready')),created_at timestamptz not null default clock_timestamp(),ready_at timestamptz
);
create table private.transfer_commands(
 id uuid primary key,session_id uuid not null references private.transfer_submissions(session_id) on delete restrict,actor uuid not null,action text not null,
 fingerprint bytea not null,result jsonb not null,private_evidence jsonb not null default '{}',created_at timestamptz not null default clock_timestamp()
);
-- Identity and evidence are append-only; only review state may advance.
create function private.transfer_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Transfer evidence is immutable.';end if;
 if tg_table_name='transfer_submissions' and (to_jsonb(new)-array['state','revision','proof_id','customer_reference','public_reason','submitted_at','reviewed_by','reviewed_at']) is distinct from (to_jsonb(old)-array['state','revision','proof_id','customer_reference','public_reason','submitted_at','reviewed_by','reviewed_at']) then raise exception 'Transfer identity is immutable.';end if;
 if tg_table_name='transfer_proofs' and ((to_jsonb(new)-array['state','ready_at']) is distinct from (to_jsonb(old)-array['state','ready_at']) or old.state='ready' and new.state<>'ready') then raise exception 'Transfer proof is immutable.';end if;
 if tg_table_name='transfer_commands' then raise exception 'Transfer command is immutable.';end if;
 return new;
end $$;
create trigger transfer_identity_immutable before update or delete on private.transfer_submissions for each row execute function private.transfer_immutable();
create trigger transfer_proof_immutable before update or delete on private.transfer_proofs for each row execute function private.transfer_immutable();
create trigger transfer_command_immutable before update or delete on private.transfer_commands for each row execute function private.transfer_immutable();
revoke all on function private.transfer_immutable() from public,anon,authenticated,service_role;

create function private.transfer_ready() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.transfer_settings t join public.site_settings s on s.key='default'
 where t.id and t.enabled and t.recipient_verified and t.verified_by is not null and t.verified_at is not null
 and length(btrim(t.recipient_name)) between 1 and 120 and length(btrim(t.recipient_address)) between 1 and 200
 and length(btrim(t.instructions_en)) between 1 and 2000 and length(btrim(t.instructions_ar)) between 1 and 2000 and s.payment_instapay_enabled)
$$;
create function public.commerce_transfer_configure(p_actor uuid,p_revision integer,p_config jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t private.transfer_settings;v_enabled boolean;begin
 perform private.checkout_staff(p_actor,'payments.configure');
 if jsonb_typeof(p_config)<>'object' or exists(select 1 from jsonb_object_keys(p_config) k where k not in ('enabled','recipient_name','recipient_address','recipient_verified','instructions_en','instructions_ar','mime_types','max_bytes','max_proofs')) then raise exception 'Invalid transfer settings.';end if;
 select * into t from private.transfer_settings where id for update;
 if t.revision<>p_revision then raise exception 'Transfer settings changed.' using errcode='40001';end if;
 v_enabled:=coalesce((p_config->>'enabled')::boolean,false);
 if length(coalesce(p_config->>'recipient_name',''))>120 or length(coalesce(p_config->>'recipient_address',''))>200 or length(coalesce(p_config->>'instructions_en',''))>2000 or length(coalesce(p_config->>'instructions_ar',''))>2000
 or jsonb_typeof(p_config->'mime_types')<>'array' or jsonb_array_length(p_config->'mime_types') not between 1 and 3
 or exists(select 1 from jsonb_array_elements_text(p_config->'mime_types') m where m not in ('image/jpeg','image/png','application/pdf')) then raise exception 'Invalid transfer settings.';end if;
 update private.transfer_settings set enabled=v_enabled,enabled_since=case when v_enabled then coalesce(enabled_since,clock_timestamp()) else enabled_since end,revision=revision+1,recipient_name=btrim(p_config->>'recipient_name'),recipient_address=btrim(p_config->>'recipient_address'),
 recipient_verified=coalesce((p_config->>'recipient_verified')::boolean,false),verified_by=case when (p_config->>'recipient_verified')::boolean then p_actor end,verified_at=case when (p_config->>'recipient_verified')::boolean then clock_timestamp() end,
 instructions_en=btrim(p_config->>'instructions_en'),instructions_ar=btrim(p_config->>'instructions_ar'),mime_types=array(select jsonb_array_elements_text(p_config->'mime_types')),
 max_bytes=(p_config->>'max_bytes')::integer,max_proofs=(p_config->>'max_proofs')::integer where id;
 if v_enabled and private.transfer_ready() is distinct from true then raise exception 'Verify recipient, instructions and existing InstaPay setting first.';end if;
 insert into public.admin_activity_logs(admin_user_id,author_name,author_email,author_role,action_key,description,metadata) select id,coalesce(full_name,email),email,role,'payments.transfer.configure','Updated transfer controls.',jsonb_build_object('enabled',v_enabled,'previous_revision',p_revision) from public.admin_users where id=p_actor;
 return public.commerce_transfer_settings(p_actor);
end $$;
create function public.commerce_transfer_settings(p_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform private.checkout_staff(p_actor,'payments.configure');return (select to_jsonb(t)||jsonb_build_object('ready',private.transfer_ready()) from private.transfer_settings t where id);end $$;

-- Reuse existing pricing/stock/delivery rules with the independently enabled method.
do $review$ declare d text;a text;begin
 d:=pg_get_functiondef('private.checkout_review_before_cod(jsonb)'::regprocedure);
 a:='(method=''cash'' and not settings.inventory_tracking_required)';
 if position(a in d)=0 then raise exception 'Review manual serialized availability.';end if;
 d:=replace(d,a,'(method in (''cash'',''instapay'') and not settings.inventory_tracking_required)');
 a:='method in (''card'',''cash'') and not settings.inventory_tracking_required';
 if position(a in d)=0 then raise exception 'Review manual untracked quantity.';end if;
 execute replace(d,a,'method in (''card'',''cash'',''instapay'') and not settings.inventory_tracking_required');
 d:=pg_get_functiondef('private.checkout_review_before_pdc(jsonb)'::regprocedure);
 a:='method not in (''cash'',''card'')';if position(a in d)=0 then raise exception 'Review manual delivery scope.';end if;
 d:=replace(d,a,'method not in (''cash'',''card'',''instapay'')');
 execute replace(d,'method in (''card'',''cash'') and not settings.inventory_tracking_required','method in (''card'',''cash'',''instapay'') and not settings.inventory_tracking_required');
 d:=pg_get_functiondef('private.guard_backorder_fulfillment()'::regprocedure);
 a:='new.payment_method not in (''card'',''cash'')';if position(a in d)=0 then raise exception 'Review paid manual stock mode.';end if;
 execute replace(d,a,'new.payment_method not in (''card'',''cash'',''instapay'')');
 d:=pg_get_functiondef('private.checkout_review(jsonb)'::regprocedure);
 execute replace(d,'begin',E'begin\n if p_intent#>>''{order,payment_method}''=''instapay'' and private.transfer_ready() is distinct from true then raise exception ''InstaPay is unavailable.'';end if;');
 d:=pg_get_functiondef('public.commerce_prepare_payment_checkout(uuid,uuid,uuid,jsonb,jsonb,text,jsonb)'::regprocedure);
 a:='if not exists(select 1 from private.payment_checkout_settings where id and enabled) then raise exception ''Payment-first checkout is disabled.'';end if;';
 if position(a in d)=0 then raise exception 'Review manual lifecycle activation.';end if;
 d:=replace(d,a,'if (p_order->>''payment_method''=''card'' and not exists(select 1 from private.payment_checkout_settings where id and enabled)) or (p_order->>''payment_method''=''instapay'' and private.transfer_ready() is distinct from true) then raise exception ''Payment checkout is unavailable.'';end if;');
 execute replace(d,'if p_order->>''payment_method''<>''card'' then','if p_order->>''payment_method'' not in (''card'',''instapay'') then');
 d:=pg_get_functiondef('public.commerce_checkout_command(uuid,uuid,uuid,jsonb,jsonb)'::regprocedure);
 execute replace(d,'perform private.checkout_authorize(p_user_id);',E'perform private.checkout_authorize(p_user_id);\n if p_order->>''payment_method''=''instapay'' and exists(select 1 from private.transfer_settings where id and (enabled or enabled_since is not null)) and not exists(select 1 from private.checkout_commands where user_id=p_user_id and command_id=p_cart_id) then raise exception ''payment_first:session_required'';end if;');
end $review$;

create function public.commerce_prepare_transfer_checkout(p_user_id uuid,p_cart_id uuid,p_quote_id uuid,p_order jsonb,p_items jsonb,p_cart_revision text,p_cart_lines jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;s private.payment_checkout_sessions;t private.transfer_settings;begin
 perform private.checkout_authorize(p_user_id);perform private.cod_authorize(p_user_id);
 if p_order->>'payment_method'<>'instapay' or private.transfer_ready() is distinct from true then raise exception 'InstaPay is unavailable.';end if;
 select * into t from private.transfer_settings where id for share;
 result:=public.commerce_prepare_payment_checkout(p_user_id,p_cart_id,p_quote_id,p_order,p_items,p_cart_revision,p_cart_lines);
 select * into s from private.payment_checkout_sessions where id=(result#>>'{checkout,id}')::uuid;
 insert into private.transfer_submissions(session_id,user_id,recipient_snapshot,settings_revision)
 values(s.id,p_user_id,jsonb_build_object('name',t.recipient_name,'address',t.recipient_address,'instructions_en',t.instructions_en,'instructions_ar',t.instructions_ar,'mime_types',to_jsonb(t.mime_types),'max_bytes',t.max_bytes,'max_proofs',t.max_proofs),t.revision)
 on conflict(session_id) do nothing;
 return jsonb_build_object('created',(result->>'created')::boolean,'checkout',public.commerce_read_payment_checkout(p_user_id,s.id));
end $$;

alter function public.commerce_read_payment_checkout(uuid,uuid) rename to commerce_read_payment_checkout_before_transfer;
create function public.commerce_read_payment_checkout(p_user_id uuid,p_session_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;t private.transfer_submissions;begin
 result:=public.commerce_read_payment_checkout_before_transfer(p_user_id,p_session_id);
 select * into t from private.transfer_submissions where session_id=p_session_id and user_id=p_user_id;
 if found then
  result:=result||jsonb_build_object('transfer',jsonb_build_object('reference',t.reference,'state',t.state,'revision',t.revision,'recipient',t.recipient_snapshot,'proofId',t.proof_id,'reason',t.public_reason));
  if result->>'paymentStatus'<>'paid' then result:=result||jsonb_build_object('paymentStatus',case when t.state='under_review' then 'under_review' when t.state='awaiting_proof' then 'awaiting_transfer' when t.state in ('rejected','correction_requested') then 'proof_needs_attention' else result->>'paymentStatus' end);end if;
 end if;return result;
end $$;
revoke all on function public.commerce_read_payment_checkout_before_transfer(uuid,uuid) from public,anon,authenticated,service_role;

create function public.commerce_transfer_reserve_proof(p_user_id uuid,p_session_id uuid,p_request_id uuid,p_revision integer,p_sha256 text,p_size integer,p_mime text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t private.transfer_submissions;p private.transfer_proofs;ext text;begin
 perform private.checkout_authorize(p_user_id);
 select * into t from private.transfer_submissions where session_id=p_session_id and user_id=p_user_id for update;
 if not found then raise exception 'Transfer not found.' using errcode='42501';end if;
 select * into p from private.transfer_proofs where request_id=p_request_id;
 if found then
  if p.user_id<>p_user_id or p.session_id<>p_session_id or p.sha256<>p_sha256 or p.size_bytes<>p_size or p.mime_type<>p_mime then raise exception 'Proof command changed.';end if;return to_jsonb(p);
 end if;
 if t.revision<>p_revision or t.state not in ('awaiting_proof','correction_requested','rejected') or p_request_id is null then raise exception 'Transfer changed. Refresh first.' using errcode='40001';end if;
 if p_sha256!~'^[a-f0-9]{64}$' or p_size not between 1 and (t.recipient_snapshot->>'max_bytes')::integer
  or not exists(select 1 from jsonb_array_elements_text(t.recipient_snapshot->'mime_types') m where m=p_mime)
  or (select count(*) from private.transfer_proofs where session_id=p_session_id)>=(t.recipient_snapshot->>'max_proofs')::integer then raise exception 'Proof limit or format rejected.';end if;
 if exists(select 1 from private.transfer_proofs where sha256=p_sha256) then raise exception 'This proof was already submitted.' using errcode='23505';end if;
 ext:=case p_mime when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'application/pdf' then 'pdf' end;
 if ext is null then raise exception 'Unsupported proof.';end if;
 p.id:=gen_random_uuid();
 insert into private.transfer_proofs(id,session_id,user_id,request_id,sha256,size_bytes,mime_type,path)
 values(p.id,p_session_id,p_user_id,p_request_id,p_sha256,p_size,p_mime,'transfers-v1/'||p_user_id||'/'||p_session_id||'/'||p.id||'.'||ext) returning * into p;
 return to_jsonb(p);
end $$;
create function public.commerce_transfer_finish_proof(p_user_id uuid,p_proof_id uuid,p_sha256 text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.checkout_authorize(p_user_id);
 update private.transfer_proofs set state='ready',ready_at=coalesce(ready_at,clock_timestamp()) where id=p_proof_id and user_id=p_user_id and sha256=p_sha256;
 if not found then raise exception 'Proof not found.' using errcode='42501';end if;
end $$;
create function public.commerce_transfer_submit(p_user_id uuid,p_session_id uuid,p_request_id uuid,p_revision integer,p_proof_id uuid,p_reference text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t private.transfer_submissions;c private.transfer_commands;fp bytea:=sha256(convert_to(jsonb_build_array(p_session_id,p_proof_id,p_reference,p_revision)::text,'UTF8'));result jsonb;begin
 perform private.checkout_authorize(p_user_id);
 select * into t from private.transfer_submissions where session_id=p_session_id and user_id=p_user_id for update;
 if not found then raise exception 'Transfer not found.' using errcode='42501';end if;
 select * into c from private.transfer_commands where id=p_request_id;
 if found then if c.actor<>p_user_id or c.session_id<>p_session_id or c.fingerprint<>fp or c.action<>'submit' then raise exception 'Proof command changed.';end if;return c.result;end if;
 if t.revision<>p_revision or t.state not in ('awaiting_proof','correction_requested','rejected') or p_request_id is null or length(coalesce(p_reference,''))>120
  or not exists(select 1 from private.transfer_proofs where id=p_proof_id and session_id=p_session_id and user_id=p_user_id and state='ready') then raise exception 'Transfer changed or proof unavailable.' using errcode='40001';end if;
 update private.transfer_submissions set state='under_review',proof_id=p_proof_id,customer_reference=nullif(btrim(p_reference),''),submitted_at=clock_timestamp(),public_reason=null,revision=revision+1 where session_id=p_session_id returning * into t;
 result:=jsonb_build_object('reference',t.reference,'state',t.state,'revision',t.revision);
 insert into private.transfer_commands(id,session_id,actor,action,fingerprint,result) values(p_request_id,p_session_id,p_user_id,'submit',fp,result);
 return result;
end $$;
create function public.commerce_transfer_review(p_actor uuid,p_session_id uuid,p_request_id uuid,p_revision integer,p_action text,p_evidence jsonb) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare t private.transfer_submissions;s private.payment_checkout_sessions;c private.transfer_commands;fp bytea:=sha256(convert_to(jsonb_build_array(p_session_id,p_revision,p_action,p_evidence)::text,'UTF8'));
 result jsonb;fund private.payment_checkout_funds;ref text;amount bigint;begin
 perform private.checkout_staff(p_actor,case when p_action='verify' then 'payments.verify' else 'payments.review' end);
 select * into t from private.transfer_submissions where session_id=p_session_id for update;
 if not found then raise exception 'Transfer not found.';end if;
 select * into c from private.transfer_commands where id=p_request_id;
 if found then if c.actor<>p_actor or c.session_id<>p_session_id or c.fingerprint<>fp or c.action<>p_action then raise exception 'Review command changed.';end if;return c.result;end if;
 if p_request_id is null or t.revision<>p_revision or t.state<>'under_review' or p_action not in ('verify','reject','correct') then raise exception 'Transfer changed. Refresh first.' using errcode='40001';end if;
 select * into s from private.payment_checkout_sessions where id=p_session_id for update;
 if p_action='verify' then
  if p_evidence->'bank_credit_verified' is distinct from 'true'::jsonb or p_evidence->>'currency' is distinct from 'EGP'
   or p_evidence->>'recipient' is distinct from t.recipient_snapshot->>'address'
   or (p_evidence->>'recipient_revision')::integer is distinct from t.settings_revision
   or coalesce((p_evidence->>'amount_minor')::bigint,0)<>(s.snapshot#>>'{review,totalAmount}')::numeric*100
   or not exists(select 1 from private.transfer_proofs where id=t.proof_id and state='ready' and session_id=p_session_id)
   or nullif(p_evidence->>'bank_received_at','') is null or (p_evidence->>'bank_received_at')::timestamptz>clock_timestamp()+interval '5 minutes' then raise exception 'Verify actual bank credit, amount and original recipient.';end if;
  ref:=upper(regexp_replace(btrim(p_evidence->>'bank_reference'),'[[:space:]]+','','g'));amount:=(p_evidence->>'amount_minor')::bigint;
  if ref is null or length(ref) not between 4 and 120 or ref~'[[:cntrl:]]' then raise exception 'A unique bank reference is required.';end if;
  if exists(select 1 from private.payment_checkout_funds where kind='instapay' and reference=ref) then raise exception 'Bank reference already used.' using errcode='23505';end if;
  insert into private.payment_checkout_funds(session_id,kind,reference,amount_minor,currency,is_primary,reviewed_by,evidence)
  values(p_session_id,'instapay',ref,amount,'EGP',true,p_actor,p_evidence||jsonb_build_object('proof_id',t.proof_id)) returning * into fund;
  begin result:=private.finalize_payment_checkout(p_session_id);
  exception when others then
   update private.payment_checkout_sessions set state='review',review_reason='paid_order_requires_recovery' where id=p_session_id;
   result:=jsonb_build_object('created',false,'order_id',null);
  end;
  update private.transfer_submissions set state=case when result->>'order_id' is null then 'verified_order_pending' else 'verified' end,reviewed_by=p_actor,reviewed_at=clock_timestamp(),public_reason=null,revision=revision+1 where session_id=p_session_id returning * into t;
 else
  if length(btrim(coalesce(p_evidence->>'reason',''))) not between 1 and 300 then raise exception 'A concise customer-facing reason is required.';end if;
  update private.transfer_submissions set state=case when p_action='reject' then 'rejected' else 'correction_requested' end,public_reason=btrim(p_evidence->>'reason'),reviewed_by=p_actor,reviewed_at=clock_timestamp(),revision=revision+1 where session_id=p_session_id returning * into t;
  result:='{}';
 end if;
 result:=result||jsonb_build_object('reference',t.reference,'state',t.state,'revision',t.revision);
 insert into private.transfer_commands(id,session_id,actor,action,fingerprint,result,private_evidence) values(p_request_id,p_session_id,p_actor,p_action,fp,result,p_evidence);
 insert into public.admin_activity_logs(admin_user_id,author_name,author_email,author_role,action_key,description,metadata)
 select id,coalesce(full_name,email),email,role,'payments.transfer.review','Reviewed a transfer submission.',jsonb_build_object('session_id',p_session_id,'action',p_action,'order_id',result->>'order_id') from public.admin_users where id=p_actor;
 return result;
end $$;
create function public.commerce_transfer_staff_queue(p_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb;begin
 perform private.checkout_staff(p_actor,'payments.review');
 select coalesce(jsonb_agg(jsonb_build_object('sessionId',t.session_id,'reference',t.reference,'state',t.state,'revision',t.revision,'proofId',t.proof_id,'settingsRevision',t.settings_revision,
 'recipient',t.recipient_snapshot,'totalAmount',s.snapshot#>>'{review,totalAmount}','currency','EGP','customerReference',t.customer_reference,'submittedAt',t.submitted_at,'orderId',s.order_id) order by t.created_at),'[]') into rows
 from (select * from private.transfer_submissions where state='under_review' order by created_at limit 50) t join private.payment_checkout_sessions s on s.id=t.session_id;
 return jsonb_build_object('items',rows);
end $$;
create function public.commerce_transfer_staff_detail(p_actor uuid,p_session_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 perform private.checkout_staff(p_actor,'payments.review');
 select jsonb_build_object('sessionId',session_id,'proofId',proof_id,'state',state,'revision',revision) into result from private.transfer_submissions where session_id=p_session_id;
 if result is null then raise exception 'Transfer not found.';end if;return result;
end $$;
create function public.commerce_transfer_read_proof(p_user_id uuid,p_proof_id uuid,p_admin boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare p private.transfer_proofs;begin
 if p_admin then perform private.checkout_staff(p_user_id,'payments.review');else perform private.checkout_authorize(p_user_id);end if;
 select * into p from private.transfer_proofs where id=p_proof_id and state='ready' and (p_admin or user_id=p_user_id);
 if not found then raise exception 'Proof not found.' using errcode='42501';end if;return to_jsonb(p);
end $$;

-- Preserve owner verification at capture and dispatch for verified manual funds.
do $email$ declare d text;a text;begin
 d:=pg_get_functiondef('private.order_email_paid(public.customer_orders)'::regprocedure);
 a:='select o.payment_method=''card''';if position(a in d)=0 then raise exception 'Review paid-email evidence.';end if;
 d:=replace(d,a,$branch$select (o.payment_method='instapay' and o.payment_status='paid' and o.amount_paid=o.total_amount and o.paid_at is not null and o.status not in ('cancelled','refunded') and exists(select 1 from private.payment_checkout_funds f where f.session_id=o.checkout_session_id and f.kind='instapay' and f.is_primary and f.reviewed_by is not null and f.amount_minor=o.total_amount*100 and f.currency=o.currency)) or o.payment_method='card'$branch$);execute d;
 foreach a in array array['order_email_reason','capture_order_email'] loop
  d:=pg_get_functiondef(case when a='order_email_reason' then 'private.order_email_reason(public.order_email_events)'::regprocedure else 'private.capture_order_email()'::regprocedure end);
  execute replace(d,'payment_method not in (''card'',''cash'')','payment_method not in (''card'',''cash'',''instapay'')');
 end loop;
end $email$;
-- Verified transfer orders reuse staff-only packing/booking, with zero COD.
-- This never queues or dispatches a shipment; the established gates remain.
do $fulfillment$ declare d text;a text;begin
 d:=pg_get_functiondef('private.pdc_order_eligibility(uuid)'::regprocedure);
 a:='o.payment_method in (''cash'',''card'')';
 if position(a in d)=0 then raise exception 'Review paid-transfer untracked eligibility.';end if;
 d:=replace(d,a,'(o.payment_method in (''cash'',''card'') or (o.payment_method=''instapay'' and private.order_email_paid(o)))');
 a:='if o.payment_method=''cash'' and not o.is_preorder then';
 if position(a in d)=0 then raise exception 'Review transfer courier financial guard.';end if;
 d:=replace(d,a,'if o.payment_method=''instapay'' and private.order_email_paid(o) is distinct from true then raise exception ''Verified transfer funds required.'';end if; '||a);
 execute d;
end $fulfillment$;
create or replace function public.commerce_payment_checkout_readiness() returns jsonb language plpgsql security definer set search_path='' as $$
begin perform private.checkout_server();return (select jsonb_build_object('installed',true,'enabled',enabled,'revision',revision,'manual',jsonb_build_object('installed',true,'ready',private.transfer_ready())) from private.payment_checkout_settings where id);end $$;

do $security$ declare t text;r record;d text;begin
 foreach t in array array['transfer_settings','transfer_submissions','transfer_proofs','transfer_commands'] loop
  execute format('alter table private.%I enable row level security',t);execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
 end loop;
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('commerce_transfer_configure','commerce_transfer_settings','commerce_prepare_transfer_checkout','commerce_read_payment_checkout','commerce_transfer_reserve_proof','commerce_transfer_finish_proof','commerce_transfer_submit','commerce_transfer_review','commerce_transfer_staff_queue','commerce_transfer_staff_detail','commerce_transfer_read_proof','commerce_payment_checkout_readiness') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',r.signature);execute format('grant execute on function %s to service_role',r.signature);
 end loop;
 revoke all on function private.transfer_ready() from public,anon,authenticated,service_role;
 d:=pg_get_functiondef('catalog_private.reset_assert_coverage()'::regprocedure);
 if position($needle$'payment_checkout_funds'$needle$ in d)=0 then raise exception 'Review transfer audit reset coverage.';end if;
 execute replace(d,$needle$'payment_checkout_funds'$needle$,$replacement$'payment_checkout_funds','transfer_settings','transfer_submissions','transfer_proofs','transfer_commands'$replacement$);
end $security$;
create or replace function public.commerce_recover_funded_checkout(p_session_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 perform private.checkout_server();result:=private.finalize_payment_checkout(p_session_id);
 update private.transfer_submissions set state='verified' where session_id=p_session_id and state='verified_order_pending' and result->>'order_id' is not null;
 return result;
end $$;
notify pgrst,'reload schema';
commit;
