-- 93: bounded unpaid-card expiry and transactional, once-only stock release.
-- An application cancellation never voids/refunds a provider transaction.
begin;
set local lock_timeout='5s';set local statement_timeout='60s';
alter table public.customer_orders add column stock_reservation_released_at timestamptz;

create function private.release_unpaid_card_stock() returns trigger
language plpgsql security definer set search_path='' as $$
declare attempt public.payment_attempts%rowtype; item public.customer_order_items%rowtype;
 product public.products%rowtype; unit public.commerce_serialized_units%rowtype; restored integer; balance integer;
 original_warehouse uuid; warehouse_count integer;
 previous text:=coalesce(current_setting('app.serialized_inventory_write',true),'');
begin
 if old.stock_reservation_released_at is not null and new.status not in ('cancelled','refunded') then
  raise exception 'A released reservation cannot be reopened.';end if;
 if new.status<>'cancelled' or old.status='cancelled' or old.payment_method<>'card' or not old.card_checkout_verified
  or old.is_preorder or old.payment_status not in ('pending','failed') or old.amount_paid<>0 then return new;end if;
 if old.stock_reservation_released_at is not null then return new;end if;
 perform public.assert_built_in_erp();
 select * into attempt from public.payment_attempts where order_id=old.id and provider='paymob' for update;
 if found and (attempt.status='succeeded' or attempt.expires_at>clock_timestamp()-interval '1 hour'
  or attempt.provider_order_id is null) then raise exception 'Reconcile this payment before cancellation.';end if;
 if exists(select 1 from public.order_packing_sessions where order_id=old.id and status in ('active','completed'))
  or exists(select 1 from public.shipping_order_jobs where order_id=old.id and (dispatch_started_at is not null or awb is not null)) then
  raise exception 'Review packing or shipment before cancellation.';end if;
 if old.stock_fulfillment_state='ready' then
  perform set_config('app.serialized_inventory_write','on',true);
  for item in select * from public.customer_order_items where order_id=old.id order by product_id,variant_id,id loop
   select * into product from public.products where id=item.product_id for update;
   if not found then raise exception 'Original stock location requires review.';end if;
   select min(warehouse_id::text)::uuid,count(distinct warehouse_id)::integer into original_warehouse,warehouse_count
    from public.commerce_inventory_movements where reference_id=old.id and product_id=product.id and movement_type='sale_out';
   if original_warehouse is null or warehouse_count<>1 then raise exception 'Original stock location requires review.';end if;
   if product.is_serialized then
    perform 1 from public.product_variants where id=item.variant_id and product_id=product.id for update;
    if not found then raise exception 'Original product option requires review.';end if;
    restored:=0;
    for unit in select * from public.commerce_serialized_units where customer_order_id=old.id
     and customer_order_item_id=item.id and product_id=product.id and variant_id=item.variant_id
     and warehouse_id=original_warehouse and status='sold' order by id for update loop
     update public.commerce_serialized_units set status='in_stock',customer_order_id=null,customer_order_item_id=null,
      customer_user_id=null,sold_at=null,returned_at=null,updated_at=clock_timestamp() where id=unit.id;
     insert into public.commerce_serialized_unit_movements(unit_id,product_id,variant_id,warehouse_id,customer_order_id,
      movement_type,from_status,to_status,notes) values(unit.id,product.id,item.variant_id,unit.warehouse_id,old.id,
      'returned','sold','in_stock','Unpaid order cancelled; reservation released.');
     restored:=restored+1;
    end loop;
    if restored<>item.quantity then raise exception 'Original stock allocation requires review.';end if;
    update public.product_variants set stock_quantity=stock_quantity+restored,updated_at=clock_timestamp() where id=item.variant_id;
   end if;
   update public.products set stock_quantity=stock_quantity+item.quantity where id=product.id;
   update public.commerce_warehouse_inventory set quantity=quantity+item.quantity,updated_at=clock_timestamp()
    where warehouse_id=original_warehouse and product_id=product.id returning quantity into balance;
   if not found then raise exception 'Original warehouse balance requires review.';end if;
   insert into public.commerce_inventory_movements(warehouse_id,product_id,movement_type,reference_type,reference_id,
    quantity_change,quantity_after,unit_cost,notes) values(original_warehouse,product.id,'return_in','manual',old.id,
    item.quantity,balance,coalesce(product.cost_price,0),'Unpaid order cancelled; reservation released.');
  end loop;
  perform set_config('app.serialized_inventory_write',previous,true);
 end if;
 update public.payment_attempts set status='cancelled',client_secret=null,updated_at=clock_timestamp()
  where order_id=old.id and status<>'succeeded';
 new.stock_reservation_released_at:=clock_timestamp();
 return new;
end $$;
create trigger b_release_unpaid_card_stock before update of status on public.customer_orders
 for each row execute function private.release_unpaid_card_stock();

create function public.commerce_expire_unpaid_card_orders(p_limit integer default 25) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='3s' as $$
declare row record; expired jsonb:='[]'; review jsonb:='[]';
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server access required.' using errcode='42501';end if;
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'A bounded batch is required.';end if;
 for row in select o.id from public.customer_orders o left join public.payment_attempts a on a.order_id=o.id and a.provider='paymob'
  where o.payment_method='card' and o.card_checkout_verified and not o.is_preorder and o.status in ('pending_payment','on_hold')
   and o.payment_status in ('pending','failed') and o.amount_paid=0 and o.created_at<clock_timestamp()-interval '1 hour'
   and o.stock_reservation_released_at is null
   and (a.id is null or a.status<>'succeeded' and a.expires_at<clock_timestamp()-interval '1 hour')
  order by o.created_at,o.id limit p_limit for update of o skip locked loop
  begin
   update public.customer_orders set status='cancelled',updated_at=clock_timestamp() where id=row.id;
   expired:=expired||to_jsonb(row.id);
  exception when sqlstate 'P0001' then review:=review||to_jsonb(row.id);
  end;
 end loop;
 return jsonb_build_object('cancelled',expired,'requiresReview',review);
end $$;
revoke all on function private.release_unpaid_card_stock() from public,anon,authenticated,service_role;
revoke all on function public.commerce_expire_unpaid_card_orders(integer) from public,anon,authenticated;
grant execute on function public.commerce_expire_unpaid_card_orders(integer) to service_role;

-- A fresh, paid and packed order can record an administrator-verified PDC AWB.
-- This cannot reconcile or replace an uncertain automated booking.
create function public.shipping_order_record_manual_awb(p_order_id uuid,p_admin_id uuid,p_awb text) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare job public.shipping_order_jobs%rowtype; settings public.shipping_provider_settings%rowtype;
 reference text:='ORD-'||p_order_id::text;
begin
 if auth.role() is distinct from 'service_role' or not exists(select 1 from public.admin_users where id=p_admin_id
  and is_active and (role='owner' or coalesce((permissions->>'dashboard.orders')::boolean,false))) then
  raise exception 'Order permission is required.' using errcode='42501';end if;
 if p_awb is null or p_awb !~ '^[A-Za-z0-9][A-Za-z0-9-]{0,99}$' then raise exception 'A real airway bill is required.';end if;
 perform private.pdc_order_eligibility(p_order_id);
 if not exists(select 1 from public.customer_orders where id=p_order_id and payment_status='paid'
  and amount_paid=total_amount and stock_fulfillment_state='ready') then raise exception 'Paid, allocated stock is required.';end if;
 -- An application status alone never substitutes for completed packing.
 if not exists(select 1 from public.order_packing_sessions where order_id=p_order_id and status='completed') then
  raise exception 'Complete packing before recording an airway bill.';end if;
 select * into settings from public.shipping_provider_settings where id='pdc' for share;
 insert into public.shipping_order_jobs(order_id,to_ref) values(p_order_id,reference) on conflict(order_id) do nothing;
 select * into job from public.shipping_order_jobs where order_id=p_order_id for update;
 if job.awb=p_awb and exists(select 1 from private.pdc_dispatches where job_id=job.id and actor_id=p_admin_id and awb=p_awb and state='created') then
  return jsonb_build_object('id',job.id,'awb',job.awb,'state',job.state);end if;
 if job.awb is not null or job.dispatch_started_at is not null or job.to_ref<>reference
  or exists(select 1 from private.pdc_dispatches where order_id=p_order_id)
  or exists(select 1 from public.shipping_order_jobs where awb=p_awb and id<>job.id) then
  raise exception 'Reconcile the original booking. Do not attach another airway bill.';end if;
 update public.shipping_order_jobs set awb=p_awb,state='label_pending',requested_by=p_admin_id,dispatch_started_at=clock_timestamp(),
  provider_identity=jsonb_build_object('base_url',settings.base_url,'api_mode',settings.api_mode,'company_id',settings.company_id),
  last_error=null,next_attempt_at=null,updated_at=clock_timestamp() where id=job.id returning * into job;
 insert into private.pdc_dispatches(job_id,order_id,to_ref,token,actor_id,state,awb)
  values(job.id,p_order_id,reference,gen_random_uuid(),p_admin_id,'created',p_awb);
 return jsonb_build_object('id',job.id,'awb',job.awb,'state',job.state);
end $$;
revoke all on function public.shipping_order_record_manual_awb(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.shipping_order_record_manual_awb(uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
