-- Confirm Orders: a closed browser no longer strands an order, packers can tick items by hand
-- on orders with no stock units to scan, and each packing video appears in Documents.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

alter table public.order_packing_work_sessions
 add column last_seen_at timestamptz not null default clock_timestamp(),
 add column client_id text check(client_id is null or client_id~'^[0-9a-f-]{36}$');

alter table public.order_packing_scans drop constraint order_packing_scans_type_check;
alter table public.order_packing_scans add constraint order_packing_scans_type_check check(scan_type=any(array['sku'::text,'serialized'::text,'checked'::text]));

do $patch$
declare d text;anchor constant text:=$a$raise exception 'Scan the exact assigned unit code or QR for this item.';
  else
$a$;
begin
 d:=pg_get_functiondef('public.validate_order_packing_scan()'::regprocedure);
 if position(anchor in d)=0 then raise exception 'scan rule anchor changed';end if;
 execute replace(d,anchor,$a$raise exception 'Scan the exact assigned unit code or QR for this item.';
  elsif new.scan_type='checked' and exists(select 1 from public.customer_orders where id=v_session.order_id and stock_fulfillment_state='untracked') then
    -- A hand check, only where the order has no stock units to scan.
    new.scanned_code:='checked';
  else
$a$);
end $patch$;

alter table public.document_folders add column is_system boolean not null default false;
alter table public.documents add column packing_video_id uuid unique references public.order_packing_videos(id) on delete cascade;

-- Documents shows Packing videos / date / packer / "packer - order.ext". The bytes stay in the private video store.
create function private.publish_packing_video(p_session uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.order_packing_sessions;v public.order_packing_videos;o public.customer_orders;
 root uuid;day_folder uuid;person_folder uuid;doc uuid;tz text;day text;person text;ext text;
begin
 select * into s from public.order_packing_sessions where id=p_session and status='completed';
 if not found then return null;end if;
 select * into v from public.order_packing_videos where packing_session_id=s.id and status='ready' order by created_at desc limit 1;
 if not found then return null;end if;
 select id into doc from public.documents where packing_video_id=v.id;
 if found then return doc;end if;
 select * into o from public.customer_orders where id=s.order_id;
 select nullif(btrim(business_timezone),'') into tz from public.chat_settings limit 1;
 if tz is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=tz) then tz:='Africa/Cairo';end if;
 day:=to_char(coalesce(v.recording_started_at,s.completed_at) at time zone tz,'YYYY-MM-DD');
 person:=left(btrim(regexp_replace(coalesce(nullif(btrim(s.processor_name),''),'Staff'),'[/\\]+',' ','g')),120);
 ext:=coalesce(nullif(substring(v.file_name from '\.([A-Za-z0-9]{1,10})$'),''),'webm');
 insert into public.document_folders(parent_id,name,is_system,created_by) values(null,'Packing videos',true,v.recorded_by)
  on conflict(lower(name)) where parent_id is null do update set is_system=true returning id into root;
 insert into public.document_folders(parent_id,name,is_system,created_by) values(root,day,true,v.recorded_by)
  on conflict(parent_id,lower(name)) where parent_id is not null do update set is_system=true returning id into day_folder;
 insert into public.document_folders(parent_id,name,is_system,created_by) values(day_folder,person,true,v.recorded_by)
  on conflict(parent_id,lower(name)) where parent_id is not null do update set is_system=true returning id into person_folder;
 insert into public.documents(folder_id,name,storage_path,mime_type,size_bytes,created_by,packing_video_id)
 values(person_folder,left(person||' - '||regexp_replace(coalesce(o.order_number,left(s.order_id::text,8)),'[/\\]+','-','g'),230)||'.'||ext,'packing-video/'||v.id::text,v.mime_type,v.size_bytes,v.recorded_by,v.id)
 returning id into doc;
 return doc;
end $$;
create function private.publish_packing_video_after_completion() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform private.publish_packing_video(new.id);return null;
exception when others then raise log 'packing_video_document:failed';return null;
end $$;
create trigger order_packing_sessions_publish_video after update of status on public.order_packing_sessions
 for each row when (new.status='completed' and old.status is distinct from 'completed') execute function private.publish_packing_video_after_completion();
revoke all on function private.publish_packing_video(uuid),private.publish_packing_video_after_completion() from public,anon,authenticated,service_role;
select private.publish_packing_video(id) from public.order_packing_sessions where status='completed';
commit;
