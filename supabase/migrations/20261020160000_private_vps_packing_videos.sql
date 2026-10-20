-- 84: private VPS evidence for the existing packing workflow. No file/object IO.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

alter table public.order_packing_videos
 add column storage_backend text not null default 'supabase' check(storage_backend in ('supabase','vps')),
 add column upload_id uuid,
 add column sha256 text,
 add column validated_at timestamptz,
 add constraint packing_vps_evidence_check check (
  storage_backend<>'vps' or (upload_id is not null and size_bytes is not null and
   storage_path='vps-v1/'||recorded_by::text||'/'||order_id::text||'/'||packing_session_id::text||'/'||upload_id::text||
    case mime_type when 'video/webm' then '.webm' when 'video/mp4' then '.mp4' else '.mov' end and
   (status<>'ready' or (sha256 ~ '^[0-9a-f]{64}$' and sha256 is not null and validated_at is not null)))
 );

-- Same reset exclusion and actor/session lock order as existing scan validation.
create function private.packing_video_authorize(p_session_id uuid,p_admin_id uuid)
returns public.order_packing_sessions language plpgsql security definer set search_path='' as $$
declare actor public.admin_users%rowtype; session public.order_packing_sessions%rowtype;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Not authorized.' using errcode='42501';end if;
 perform pg_advisory_xact_lock_shared(hashtextextended('elcomputer-system-reset',0));
 select * into actor from public.admin_users where id=p_admin_id for share;
 if not found or not actor.is_active or not (actor.role='owner' or
  (coalesce((actor.permissions->>'dashboard.view')::boolean,false) and coalesce((actor.permissions->>'dashboard.orders')::boolean,false)))
 then raise exception 'This admin can no longer process orders.' using errcode='42501';end if;
 select * into session from public.order_packing_sessions where id=p_session_id for update;
 if not found or session.status<>'active' or session.admin_user_id is distinct from p_admin_id then
  raise exception 'This packing session is not active for this operator.';end if;
 -- Closing the parent work session locks it before its children; do not invert.
 if not exists(select 1 from public.order_packing_work_sessions where id=session.work_session_id
  and admin_user_id=p_admin_id and status='active') then raise exception 'Your packing session is no longer active.';end if;
 perform 1 from public.customer_orders where id=session.order_id and status in ('pending_payment','processing') for share;
 if not found then raise exception 'The order status changed while it was being packed.';end if;
 return session;
end $$;

create function public.packing_video_prepare(p_session_id uuid,p_admin_id uuid,p_mime_type text,
 p_size_bytes bigint,p_started_at timestamptz,p_ended_at timestamptz) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare session public.order_packing_sessions%rowtype; video public.order_packing_videos%rowtype;
 upload uuid:=gen_random_uuid(); filename text; extension text;
begin
 session:=private.packing_video_authorize(p_session_id,p_admin_id);
 if p_mime_type is null or p_mime_type not in ('video/webm','video/mp4','video/quicktime')
  or p_size_bytes is null or p_size_bytes not between 1 and 524288000
  or p_started_at is null or p_ended_at is null or not isfinite(p_started_at) or not isfinite(p_ended_at)
  or p_ended_at<=p_started_at then raise exception 'A complete packing recording is required.';end if;
 select * into video from public.order_packing_videos where packing_session_id=session.id for update;
 if found and video.storage_backend<>'vps' then raise exception 'Release this order before recording a VPS video.';end if;
 if found and video.storage_backend='vps' then
  if video.mime_type<>p_mime_type or video.size_bytes<>p_size_bytes or video.recording_started_at<>p_started_at
   or video.recording_ended_at<>p_ended_at then raise exception 'Release this order before starting a new recording.';end if;
  return to_jsonb(video);
 end if;
 extension:=case p_mime_type when 'video/webm' then '.webm' when 'video/mp4' then '.mp4' else '.mov' end;
 select left(regexp_replace(coalesce(nullif(order_number,''),id::text),'[^a-zA-Z0-9._-]','-','g'),180)||extension
  into filename from public.customer_orders where id=session.order_id;
 insert into public.order_packing_videos(packing_session_id,work_session_id,order_id,recorded_by,storage_backend,upload_id,
  storage_path,file_name,mime_type,size_bytes,status,recording_started_at,recording_ended_at)
 values(session.id,session.work_session_id,session.order_id,p_admin_id,'vps',upload,
  'vps-v1/'||p_admin_id::text||'/'||session.order_id::text||'/'||session.id::text||'/'||upload::text||extension,
  filename,p_mime_type,p_size_bytes,'uploading',p_started_at,p_ended_at)
 returning * into video;
 return to_jsonb(video);
end $$;

create function public.packing_video_finish(p_session_id uuid,p_admin_id uuid,p_upload_id uuid,
 p_sha256 text,p_duration_seconds numeric) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare session public.order_packing_sessions%rowtype; video public.order_packing_videos%rowtype;
begin
 session:=private.packing_video_authorize(p_session_id,p_admin_id);
 select * into video from public.order_packing_videos where packing_session_id=session.id for update;
 if not found or video.storage_backend<>'vps' or video.upload_id is distinct from p_upload_id
  or video.recorded_by<>p_admin_id or video.order_id<>session.order_id or video.work_session_id<>session.work_session_id then
  raise exception 'Packing video upload not found.';end if;
 if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' or p_duration_seconds is null
  or not (p_duration_seconds>0 and p_duration_seconds<='86400'::numeric)
  or abs(p_duration_seconds-extract(epoch from video.recording_ended_at-video.recording_started_at))>
   greatest(3,p_duration_seconds*0.05) then raise exception 'The video duration does not match the recording.';end if;
 if video.status='ready' then
  if video.sha256<>p_sha256 then raise exception 'The saved packing video changed.';end if;
  return jsonb_build_object('video',to_jsonb(video),'saved',false);
 end if;
 update public.order_packing_videos set sha256=p_sha256,duration_seconds=p_duration_seconds,status='ready',
  uploaded_at=clock_timestamp(),validated_at=clock_timestamp(),updated_at=clock_timestamp()
 where id=video.id returning * into video;
 return jsonb_build_object('video',to_jsonb(video),'saved',true);
end $$;

-- Preserve the existing mandatory video and every-scan coverage trigger verbatim.
-- Add a separate requirement for server-validated VPS evidence on new completions.
create function private.require_vps_packing_video() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_table_schema<>'public' or tg_table_name<>'order_packing_sessions' or tg_op<>'UPDATE' then
  raise exception 'Invalid packing operation.' using errcode='42501';end if;
 if old.status<>'completed' and new.status='completed' and not exists(
  select 1 from public.order_packing_videos where packing_session_id=new.id and order_id=new.order_id
   and recorded_by=new.admin_user_id and work_session_id=new.work_session_id and status='ready'
   and storage_backend='vps' and sha256 is not null and validated_at is not null
 ) then raise exception 'Save the private VPS video before completing this order.';end if;
 return new;
end $$;
create trigger order_packing_sessions_require_vps_video before update of status on public.order_packing_sessions
 for each row execute function private.require_vps_packing_video();

-- Releasing/closing an interrupted session retains its private metadata for
-- cleanup, without leaving a cancelled upload permanently blocking reset.
create function private.cancel_vps_packing_upload() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_table_schema<>'public' or tg_table_name<>'order_packing_sessions' or tg_op<>'UPDATE' then
  raise exception 'Invalid packing operation.' using errcode='42501';end if;
 if old.status='active' and new.status='cancelled' then
  update public.order_packing_videos set status='failed',updated_at=clock_timestamp()
   where packing_session_id=new.id and storage_backend='vps' and status='uploading';
 end if;
 return new;
end $$;
create trigger order_packing_sessions_cancel_vps_upload after update of status on public.order_packing_sessions
 for each row execute function private.cancel_vps_packing_upload();

-- Full reset previously captured Storage metadata only. Include VPS keys in its
-- existing bounded, durable packing manifest; other scopes and blockers stay.
do $$ declare definition text; anchor text:='  new.manifest:=jsonb_set(new.manifest,array[kind],paths);';begin
 definition:=pg_get_functiondef('catalog_private.reset_manifest()'::regprocedure);
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then
  raise exception 'Review packing reset manifest.';end if;
 execute replace(definition,anchor,$patch$
  if new.scope='full' and kind='packing' then
   select coalesce(jsonb_agg(path order by path),'[]') into paths from (
    select value path from jsonb_array_elements_text(paths)
    union select storage_path from public.order_packing_videos where storage_backend='vps'
    order by path limit 10001) packing_files;
  end if;
  new.manifest:=jsonb_set(new.manifest,array[kind],paths);$patch$);
end $$;

revoke all on function private.packing_video_authorize(uuid,uuid),private.require_vps_packing_video(),private.cancel_vps_packing_upload(),
 public.packing_video_prepare(uuid,uuid,text,bigint,timestamptz,timestamptz),
 public.packing_video_finish(uuid,uuid,uuid,text,numeric) from public,anon,authenticated,service_role;
grant execute on function public.packing_video_prepare(uuid,uuid,text,bigint,timestamptz,timestamptz),
 public.packing_video_finish(uuid,uuid,uuid,text,numeric) to service_role;
-- Only these actor/session-bound server routines can write video evidence.
revoke insert,update on public.order_packing_videos from service_role;
notify pgrst,'reload schema';
commit;
