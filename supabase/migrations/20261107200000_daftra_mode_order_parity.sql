-- Owner request 7 Nov 2026: shipping stays a website job in either ERP mode, so order
-- emails and staff PDC booking also cover orders recorded while Daftra is the active ERP.
-- Only the built-in-only condition is removed; every other rule is unchanged.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

do $$
declare sig text; d text; anchor text;
begin
 foreach sig in array array['private.capture_order_email()','private.order_email_reason(public.order_email_events)','private.pdc_order_eligibility(uuid)'] loop
  d:=pg_get_functiondef(sig::regprocedure);
  anchor:=case sig when 'private.capture_order_email()' then ' or new.erp_owner<>''built_in'''
   when 'private.order_email_reason(public.order_email_events)' then ' or o.erp_owner<>''built_in'''
   else ' and o.erp_owner=''built_in''' end;
  if position(anchor in d)=0 then raise exception 'ERP owner anchor missing in %',sig; end if;
  d:=replace(d,anchor,'');
  if position('erp_owner' in d)>0 then raise exception 'ERP owner rule remains in %',sig; end if;
  execute d;
 end loop;
end $$;
commit;
