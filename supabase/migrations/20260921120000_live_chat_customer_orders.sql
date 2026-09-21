begin;

-- Called only by the server after verifying the bearer token. The row lock and
-- revision prevent a stale tab or agent from silently replacing a linked order.
create function public.chat_set_order(p_conversation_id uuid, p_actor_id uuid,
  p_actor_kind text, p_order_id uuid, p_expected_revision bigint) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_chat public.chat_conversations%rowtype;
begin
  select * into v_chat from public.chat_conversations where id = p_conversation_id for update;
  if not found then raise exception 'Chat not found.' using errcode = 'P0002'; end if;
  if p_expected_revision is null or v_chat.revision <> p_expected_revision then
    raise exception 'CHAT_STALE' using errcode = 'P0001';
  end if;
  if v_chat.customer_id is null or v_chat.status = 'closed' then
    raise exception 'CHAT_ORDER_DENIED' using errcode = 'P0001';
  end if;
  if p_actor_kind = 'customer' then
    if p_actor_id is distinct from v_chat.customer_id or not exists (
      select 1 from public.customer_profiles p where p.id = p_actor_id and p.is_active = true
    ) then raise exception 'CHAT_ORDER_DENIED' using errcode = 'P0001'; end if;
  elsif p_actor_kind = 'staff' then
    if not exists (select 1 from public.admin_users a where a.id = p_actor_id
      and a.is_active = true and (a.role = 'owner' or
        (coalesce((a.permissions ->> 'support.view')::boolean,false) and
         coalesce((a.permissions ->> 'support.reply')::boolean,false)))
      and (a.role = 'owner' or
        coalesce((a.permissions ->> 'support.manage')::boolean,false) or
        v_chat.assigned_admin_id = p_actor_id)) then
      raise exception 'CHAT_ORDER_DENIED' using errcode = 'P0001';
    end if;
  else
    raise exception 'CHAT_ORDER_DENIED' using errcode = 'P0001';
  end if;
  if p_order_id is not null and not exists (
    select 1 from public.customer_orders o where o.id = p_order_id
      and o.user_id = v_chat.customer_id
  ) then raise exception 'CHAT_ORDER_DENIED' using errcode = 'P0001'; end if;
  if v_chat.order_id is not distinct from p_order_id then return v_chat.id; end if;
  update public.chat_conversations set order_id = p_order_id where id = v_chat.id;
  insert into public.chat_events(conversation_id,actor_id,actor_kind,event_type,old_value,new_value)
  values (v_chat.id,p_actor_id,p_actor_kind,
    case when p_order_id is null then 'order_unlinked' else 'order_linked' end,
    pg_catalog.jsonb_build_object('order_id',v_chat.order_id),
    pg_catalog.jsonb_build_object('order_id',p_order_id));
  return v_chat.id;
end;
$$;

-- Both bearer tokens are checked by the server. No typed contact field is
-- considered proof of ownership. The guest loses access after association.
create function public.chat_identify_guest(p_conversation_id uuid, p_guest_id uuid,
  p_customer_id uuid, p_expected_revision bigint) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_chat public.chat_conversations%rowtype;
begin
  select * into v_chat from public.chat_conversations where id = p_conversation_id for update;
  if not found then raise exception 'Chat not found.' using errcode = 'P0002'; end if;
  if p_expected_revision is null or v_chat.revision <> p_expected_revision then
    raise exception 'CHAT_STALE' using errcode = 'P0001';
  end if;
  if v_chat.guest_auth_user_id is distinct from p_guest_id or v_chat.customer_id is not null
    or v_chat.order_id is not null or v_chat.ticket_id is not null
    or not exists (select 1 from auth.users u where u.id = p_guest_id and u.is_anonymous = true)
    or not exists (select 1 from auth.users u join public.customer_profiles p on p.id = u.id
      where u.id = p_customer_id and u.is_anonymous = false and p.is_active = true) then
    raise exception 'CHAT_IDENTIFY_DENIED' using errcode = 'P0001';
  end if;
  if v_chat.status <> 'closed' and exists (
    select 1 from public.chat_conversations c where c.customer_id = p_customer_id
      and c.status <> 'closed'
  ) then raise exception 'CHAT_ACCOUNT_BUSY' using errcode = 'P0001'; end if;
  update public.chat_conversations set customer_id = p_customer_id,
    guest_auth_user_id = null where id = v_chat.id;
  insert into public.chat_events(conversation_id,actor_id,actor_kind,event_type,old_value,new_value)
  values(v_chat.id,p_customer_id,'customer','identified',
    pg_catalog.jsonb_build_object('guest_auth_user_id',p_guest_id),
    pg_catalog.jsonb_build_object('customer_id',p_customer_id));
  return v_chat.id;
exception when unique_violation then
  raise exception 'CHAT_ACCOUNT_BUSY' using errcode = 'P0001';
end;
$$;

revoke all on function public.chat_set_order(uuid,uuid,text,uuid,bigint),
  public.chat_identify_guest(uuid,uuid,uuid,bigint) from public, anon, authenticated;
grant execute on function public.chat_set_order(uuid,uuid,text,uuid,bigint),
  public.chat_identify_guest(uuid,uuid,uuid,bigint) to service_role;

commit;
