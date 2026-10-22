-- Restore the original server-only lookup/reconciliation contract.
-- Migration65's shipping_claim_% sweep also revoked these older PDC RPCs.
begin;
set local lock_timeout='5s';
set local statement_timeout='15s';
do $$
declare signature text; routine regprocedure; definition record;
begin
  foreach signature in array array['public.shipping_claim_pdc_lookup()','public.shipping_claim_pdc_refresh(uuid)'] loop
    routine:=to_regprocedure(signature);
    if routine is null then raise exception 'PDC lookup RPC is missing.'; end if;
    select p.prosecdef,p.proowner into definition from pg_proc p where p.oid=routine;
    if not definition.prosecdef or definition.proowner<>current_user::regrole then
      raise exception 'Review PDC lookup RPC ownership and security.';
    end if;
    if has_function_privilege('service_role',routine,'EXECUTE')
      or has_function_privilege('anon',routine,'EXECUTE')
      or has_function_privilege('authenticated',routine,'EXECUTE') then
      raise exception 'Unexpected PDC lookup RPC access baseline.';
    end if;
  end loop;
end $$;
grant execute on function public.shipping_claim_pdc_lookup(),public.shipping_claim_pdc_refresh(uuid) to service_role;
notify pgrst,'reload schema';
commit;
