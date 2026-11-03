-- A stale editorial revision is a permanent HTTP conflict, not a transaction
-- serialization failure. PostgREST 14 retries SQLSTATE 40001 indefinitely.
-- This version occupies the unused slot after deployed payment-first 108 and
-- before the separately preserved, unapplied manual-transfer candidate.
begin;
do $migration$
declare
  signature regprocedure := 'public.catalog_save_product(uuid,uuid,text,uuid,bigint,jsonb,jsonb)'::regprocedure;
  definition text;
  old_statement text := 'raise exception ''catalog:conflict'' using errcode=''40001'';';
  new_statement text := 'raise exception ''catalog:conflict'' using errcode=''PT409'';';
begin
  select pg_get_functiondef(signature) into definition;
  if (length(definition)-length(replace(definition,old_statement,''))) / length(old_statement) <> 1
    or position(new_statement in definition)>0 then
    raise exception 'Catalog conflict function does not match the expected version.';
  end if;
  execute replace(definition,old_statement,new_statement);
  if pg_get_functiondef(signature) <> replace(definition,old_statement,new_statement) then
    raise exception 'Catalog conflict correction verification failed.';
  end if;
end;
$migration$;
commit;
