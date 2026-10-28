-- Extend the existing normal-sales inventory option to COD. No setting opens.
-- Cash still requires explicit Manual collection and the existing payment gates.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

do $$ declare d text; a text; begin
 d:=pg_get_functiondef('private.checkout_review_before_cod(jsonb)'::regprocedure);
 a:='if available<quantity and not (method=''card'' and (settings.allow_out_of_stock_purchases or not settings.inventory_tracking_required)) then';
 if position(a in d)=0 then raise exception 'Review normal serialized availability.';end if;
 d:=replace(d,a,'if available<quantity and not ((method=''card'' and (settings.allow_out_of_stock_purchases or not settings.inventory_tracking_required)) or (method=''cash'' and not settings.inventory_tracking_required)) then');
 a:='not (method=''card'' and not settings.inventory_tracking_required)';
 if position(a in d)=0 then raise exception 'Review normal bulk availability.';end if;
 execute replace(d,a,'not (method in (''card'',''cash'') and not settings.inventory_tracking_required)');

 d:=pg_get_functiondef('private.checkout_review_before_pdc(jsonb)'::regprocedure);
 a:='if method=''card'' and not settings.inventory_tracking_required then';
 if position(a in d)=0 then raise exception 'Review untracked delivery quote.';end if;
 execute replace(d,a,'if method in (''card'',''cash'') and not settings.inventory_tracking_required then');

 d:=pg_get_functiondef('public.commerce_create_normal_customer_order(uuid,jsonb,jsonb,boolean,uuid)'::regprocedure);
 a:='if p_order->>''payment_method'' is distinct from ''card'' or nullif(p_order->>''shipping_company_id'','''') is null then';
 if position(a in d)=0 then raise exception 'Review normal creator dispatch.';end if;
 d:=replace(d,a,'if p_order->>''payment_method'' not in (''card'',''cash'') or nullif(p_order->>''shipping_company_id'','''') is null then');
 a:='''shipping'',(p_order->>''shipping_company_id'')::uuid,''card'',';
 if position(a in d)=0 then raise exception 'Review saved payment method.';end if;
 execute replace(d,a,'''shipping'',(p_order->>''shipping_company_id'')::uuid,p_order->>''payment_method'',');

 d:=pg_get_functiondef('private.guard_backorder_fulfillment()'::regprocedure);
 a:='new.is_preorder or new.payment_method<>''card''';
 if position(a in d)=0 then raise exception 'Review normal untracked order guard.';end if;
 d:=replace(d,a,'new.is_preorder or new.payment_method not in (''card'',''cash'')');
 d:=replace(d,'Untracked sales require a normal card order.','Untracked sales require a normal card or COD order.');
 a:='if new.stock_fulfillment_state=''untracked'' then';
 if position(a in d)=0 then raise exception 'Review untracked payment snapshot.';end if;
 execute replace(d,a,a||$patch$
  if tg_op='UPDATE' and old.stock_fulfillment_state='untracked' and new.payment_method is distinct from old.payment_method then
   raise exception 'Payment method cannot change.';end if;
  if tg_op='INSERT' and new.payment_method='cash' then
   if new.shipping_company_id is null or new.shipping_method is distinct from 'shipping' then raise exception 'checkout:delivery';end if;
   perform private.require_manual_cod_collection(new.shipping_company_id);
  end if;
 $patch$);

 -- Untracked COD cancellation releases no warehouse units or quantities.
 -- Existing paid/shipped/packing/receipt guards still require financial review.
 d:=pg_get_functiondef('private.release_unpaid_card_stock()'::regprocedure);
 a:='old.stock_fulfillment_state<>''ready'' or old.status not in';
 if position(a in d)=0 then raise exception 'Review COD cancellation stock disposition.';end if;
 execute replace(d,a,'old.stock_fulfillment_state not in (''ready'',''untracked'') or old.status not in');
end $$;

notify pgrst,'reload schema';
commit;
