begin;

create or replace function public.require_order_packing_video()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_video public.order_packing_videos%rowtype;
begin
  if old.status <> 'completed' and new.status = 'completed' then
    select videos.*
    into v_video
    from public.order_packing_videos as videos
    where videos.packing_session_id = new.id
      and videos.order_id = new.order_id
      and videos.recorded_by = new.admin_user_id
      and videos.work_session_id = new.work_session_id
      and videos.status = 'ready';

    if not found then
      raise exception 'Upload the packing video before completing this order.';
    end if;

    if exists (
      select 1
      from public.order_packing_scans as scans
      where scans.session_id = new.id
        and (
          scans.created_at < v_video.recording_started_at
          or scans.created_at > v_video.recording_ended_at
        )
    ) then
      raise exception 'The packing video must cover every item scan.';
    end if;
  end if;

  return new;
end;
$$;

commit;
