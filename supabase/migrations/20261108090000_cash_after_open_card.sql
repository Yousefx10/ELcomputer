-- Owner report 8 Nov 2026: after trying card, "Place order" with cash stopped at "Check this payment".
-- Card sessions stay pending for good once abandoned, so one abandoned attempt blocked cash on those items forever.
-- A card session now blocks cash only while it can still be paid: before its 30-minute expiry.
-- Sessions under review, uncertain or finalizing still block, because money may have moved.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create function private.checkout_cash_conflict(p_user uuid,p_items jsonb) returns uuid
language sql stable security definer set search_path='' as $$
 select s.id from private.payment_checkout_sessions s left join private.payment_checkout_attempts a on a.session_id=s.id
 where s.user_id=p_user and s.state not in ('paid','retired')
 and (s.snapshot#>>'{order,payment_method}'='instapay' or private.checkout_items_overlap(s.snapshot#>'{intent,items}',p_items))
 and (a.id is null or not private.checkout_interface_unsubmitted(a.id))
 and not (s.snapshot#>>'{order,payment_method}'='card'
  and (s.state='failed' or (s.state in ('prepared','opening','pending') and s.expires_at<=clock_timestamp())))
 order by s.created_at,s.id limit 1
$$;
revoke all on function private.checkout_cash_conflict(uuid,jsonb) from public,anon,authenticated;

do $do$
declare d text:=pg_get_functiondef('public.commerce_checkout_command(uuid,uuid,uuid,jsonb,jsonb)'::regprocedure);
 a text:=$a$private.checkout_conflicting_payment(p_user_id,private.checkout_intent(p_order,p_items)->'items')$a$;
 b text:=$a$private.checkout_cash_conflict(p_user_id,private.checkout_intent(p_order,p_items)->'items')$a$;
begin
 if position(a in d)=0 then raise exception 'Checkout command differs from the reviewed version.'; end if;
 execute replace(d,a,b);
end $do$;

notify pgrst,'reload schema';
commit;
