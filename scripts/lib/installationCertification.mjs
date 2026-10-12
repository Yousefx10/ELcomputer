export async function privateInstallationCatalog(db) {
  const result = {}
  const queries = {
    schema: "select nspname,pg_get_userbyid(nspowner) owner,nspacl::text acl from pg_namespace where nspname='private'",
    tables: "select relname,pg_get_userbyid(relowner) owner,relrowsecurity rls,relforcerowsecurity force_rls,relacl::text acl from pg_class where relnamespace='private'::regnamespace and relkind='r' order by relname",
    columns: "select attname,format_type(atttypid,atttypmod) type,attnotnull not_null,pg_get_expr(adbin,adrelid) default_expression from pg_attribute left join pg_attrdef on adrelid=attrelid and adnum=attnum where attrelid='private.installation_bootstrap'::regclass and attnum>0 and not attisdropped order by attnum",
    constraints: "select conname,pg_get_constraintdef(oid) definition from pg_constraint where connamespace='private'::regnamespace order by conname",
    functions: "select oid::regprocedure::text signature,pg_get_userbyid(proowner) owner,prosecdef security_definer,proconfig configuration,proacl::text acl,pg_get_functiondef(oid) definition from pg_proc where pronamespace='private'::regnamespace order by 1",
    triggers: "select tgname,pg_get_triggerdef(oid) definition from pg_trigger where tgrelid='private.installation_bootstrap'::regclass and not tgisinternal order by tgname",
    policies: "select policyname,roles,cmd,qual,with_check from pg_policies where schemaname='private' order by tablename,policyname"
  }
  for (const [key, query] of Object.entries(queries)) result[key] = (await db.query(query)).rows
  return result
}
