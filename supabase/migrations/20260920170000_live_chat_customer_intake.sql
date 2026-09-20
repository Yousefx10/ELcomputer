begin;

-- Supabase API roles cannot read the auth schema directly. These functions
-- are invoked only through server-only chat writes and keep an empty search
-- path; their Auth lookups must execute as the migration owner.
alter function public.chat_guard_conversation() security definer;
alter function public.chat_validate_message_actor() security definer;
alter function public.chat_create_or_resume(uuid,boolean,text,text,text,uuid,uuid,text)
  security definer;
revoke all on function public.chat_guard_conversation(),
  public.chat_validate_message_actor() from public, anon, authenticated;

-- One source of truth for public availability and the saved intake mode.
-- Manual online still requires an eligible agent with a current lease.
create function public.chat_live_available() returns boolean
language plpgsql set search_path = '' as $$
declare
  v_settings public.chat_settings%rowtype;
  v_local timestamp;
  v_day text;
  v_clock time;
  v_slot jsonb;
begin
  select * into v_settings from public.chat_settings where singleton;
  if not found or not v_settings.is_enabled
    or v_settings.availability_override = 'offline' then return false; end if;
  if not exists (
    select 1 from public.chat_agent_availability a
    join public.admin_users u on u.id = a.admin_id
    where a.declared_state = 'online' and a.lease_expires_at > pg_catalog.clock_timestamp()
      and u.is_active = true and (u.role = 'owner' or (
        coalesce((u.permissions ->> 'support.view')::boolean, false)
        and coalesce((u.permissions ->> 'support.reply')::boolean, false)))
  ) then return false; end if;
  if v_settings.availability_override = 'online' then return true; end if;
  v_local := pg_catalog.clock_timestamp() at time zone v_settings.business_timezone;
  v_day := extract(dow from v_local)::integer::text;
  v_clock := v_local::time;
  for v_slot in select value from pg_catalog.jsonb_array_elements(v_settings.weekly_hours -> v_day) loop
    if v_clock >= (v_slot ->> 0)::time and v_clock < (v_slot ->> 1)::time then
      return true;
    end if;
  end loop;
  return false;
end;
$$;
revoke all on function public.chat_live_available() from public, anon, authenticated;
grant execute on function public.chat_live_available() to service_role;

create function public.chat_set_intake_mode() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.intake_mode := case when public.chat_live_available() then 'live' else 'offline' end;
  return new;
end;
$$;
create trigger chat_set_intake_mode before insert on public.chat_conversations
for each row execute function public.chat_set_intake_mode();
revoke all on function public.chat_set_intake_mode() from public, anon, authenticated;

-- The first message and conversation commit together. A retry with the same
-- keys returns the same saved rows, including after an uncertain HTTP result.
create function public.chat_start_with_message(p_actor_id uuid, p_is_guest boolean,
  p_name text, p_email text, p_mobile text, p_order_id uuid,
  p_creation_key uuid, p_subject_hash text, p_body text,
  p_message_key uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_conversation_id uuid;
  v_message_id uuid;
begin
  v_conversation_id := public.chat_create_or_resume(p_actor_id, p_is_guest,
    p_name, p_email, p_mobile, p_order_id, p_creation_key, p_subject_hash);
  v_message_id := public.chat_send_message(v_conversation_id, p_actor_id,
    case when p_is_guest then 'guest' else 'customer' end,
    p_name, p_body, p_message_key, p_subject_hash, false);
  return pg_catalog.jsonb_build_object('conversationId', v_conversation_id,
    'messageId', v_message_id);
end;
$$;
revoke all on function public.chat_start_with_message(uuid,boolean,text,text,text,uuid,uuid,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.chat_start_with_message(uuid,boolean,text,text,text,uuid,uuid,text,text,uuid)
  to service_role;

commit;
