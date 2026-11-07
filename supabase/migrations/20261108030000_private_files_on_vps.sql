-- Owner request 7 Nov 2026 (STORAGE-VPS-01): files live on the VPS private disk; Supabase is the
-- database only. Documents, support, chat and after-sales evidence keep their stored paths; the
-- server writes the bytes to <private root>/vps-v1/storage/<bucket>/<path> instead of Supabase
-- Storage. A system reset must still remove those files, so its manifest now also lists the paths
-- recorded in the application tables (legacy Supabase objects stay listed too).
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

do $$
declare d text; a text; b text;
begin
 d:=pg_get_functiondef('catalog_private.reset_manifest()'::regprocedure);
 a:='select o.name from storage.objects o where o.bucket_id=bucket';
 b:='select name from storage.objects where bucket_id=bucket order by name limit 10001) objects;';
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 or (length(d)-length(replace(d,b,'')))/length(b)<>1 then
  raise exception 'Reset manifest anchors changed.';
 end if;
 d:=replace(d,a,'select o.name from (select s.name from storage.objects s where s.bucket_id=bucket'
  ||' union select f.storage_path from public.documents f where kind=''documents'''
  ||' union select t.storage_path from public.support_ticket_attachments t where kind=''support'''
  ||' union select c.storage_path from public.chat_attachments c where kind=''chat'') o where true');
 d:=replace(d,b,'select name from (select s.name from storage.objects s where s.bucket_id=bucket'
  ||' union select f.storage_path from public.documents f) o order by name limit 10001) objects;');
 execute d;
end $$;

notify pgrst,'reload schema';
commit;
