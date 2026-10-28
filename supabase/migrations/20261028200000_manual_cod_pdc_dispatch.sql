-- 101: staff-requested PDC fulfillment of approved Manual COD orders.
-- Checkout delivery/fees remain immutable. No provider settings are enabled.
begin;
set local lock_timeout='5s';

alter table public.commerce_shipping_companies
 add column cod_collection_provider text not null default 'manual',
 add constraint shipping_cod_collection_provider_check
 check (cod_collection_provider in ('manual','pdc')
  and (cod_collection_provider='manual' or provider='manual'));

do $$
declare definition text; anchor text;
begin
 definition:=pg_get_functiondef('private.pdc_checkout_delivery(uuid,text,text,text)'::regprocedure);
 anchor:='if c.provider is distinct from ''pdc'' then return null;end if;';
 if position(anchor in definition)=0 then raise exception 'PDC checkout destination guard changed.';end if;
 definition:=replace(definition,anchor,E'if c.provider is distinct from ''pdc'' and not coalesce(\n  c.provider=''manual'' and c.cod_collection_enabled and c.cod_collection_provider=''pdc''\n  and p_method=''cash'',false) then return null;end if;');
 execute definition;

 definition:=pg_get_functiondef('private.pdc_order_eligibility(uuid)'::regprocedure);
 anchor:=E'if not found or c.provider<>''pdc'' or not c.is_active or not c.checkout_enabled or not exists(';
 if position(anchor in definition)=0 then raise exception 'PDC selected-courier guard changed.';end if;
 definition:=replace(definition,anchor,E'if not found or not (c.provider=''pdc'' or (c.provider=''manual'' and c.cod_collection_enabled\n  and c.cod_collection_provider=''pdc''\n  and o.payment_method=''cash'' and not o.is_preorder and o.erp_owner=''built_in''\n  and o.stock_fulfillment_state in (''ready'',''untracked'')))\n  or not c.is_active or not c.checkout_enabled or not exists(');

 -- A saved ordinary untracked COD sale has no recorded serialized allocation.
 -- Completed quantity scans and validated private packing video remain mandatory.
 -- Every other payment/inventory mode keeps the original physical allocation rule.
 anchor:=E'if exists(select 1 from public.customer_order_items i join public.products p on p.id=i.product_id where i.order_id=o.id and p.is_serialized';
 if position(anchor in definition)=0 then raise exception 'PDC stock guard changed.';end if;
 definition:=replace(definition,anchor,E'if (not (o.payment_method=''cash'' and not o.is_preorder and o.erp_owner=''built_in''\n  and o.stock_fulfillment_state=''untracked'') and exists(select 1 from public.customer_order_items i join public.products p on p.id=i.product_id where i.order_id=o.id and p.is_serialized');
 anchor:=E'u.status=''sold'')<>i.quantity)\n  or not exists(select 1 from public.customer_order_items where order_id=o.id)';
 if position(anchor in definition)=0 then raise exception 'PDC allocation guard changed.';end if;
 definition:=replace(definition,anchor,E'u.status=''sold'')<>i.quantity))\n  or not exists(select 1 from public.customer_order_items where order_id=o.id)');
 execute definition;
end $$;

-- Existing function ownership, private ACLs, PDC COD capability, city mapping,
-- packing, customer balance, provider identity and one-dispatch guards are retained.
notify pgrst,'reload schema';
commit;
