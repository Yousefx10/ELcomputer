import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {authSecurityFingerprint} from '../live-sales-release/auth.mjs'
import {schemaState} from '../footer-release/database.mjs'
import {canonicalSchema} from '../inactive-history-release/database.mjs'

export const sorted=value=>value instanceof Date?value.toISOString():Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,sorted(value[k])])):value
export const digest=value=>createHash('sha256').update(JSON.stringify(sorted(value))).digest('hex')
export const sha=value=>createHash('sha256').update(value).digest('hex')
export const quote=value=>'"'+value.replaceAll('"','""')+'"'
export const historyTables=['batches','customers','items','orders','sources']
export const historyFunctions=['customer_history_import_batch(uuid,text,text,uuid,jsonb)','customer_history_claim(uuid)','customer_history_read(uuid,uuid,text,integer)','customer_history_hide_source(uuid,text)']

export async function definitions(db){
 return (await db.query(`select n.nspname schema,c.relname name,json_agg(a.attname order by a.attnum) columns
 from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid
 where c.relkind='r' and a.attnum>0 and not a.attisdropped and
 (n.nspname in ('public','private','catalog_private') or n.nspname='auth' and c.relname in ('users','identities') or n.nspname='storage' and c.relname in ('objects','buckets'))
 group by n.nspname,c.relname order by 1,2`)).rows
}

// One server round trip, with the same complete original-column projection as
// the established release snapshot. Repeatable-read transactions tolerate other
// customers' concurrent edits while still detecting this transaction's writes.
export async function protectedRows(db,tables){
 const sql=tables.map(t=>`select '${t.schema.replaceAll("'","''")}'::text schema,'${t.name.replaceAll("'","''")}'::text name,
 count(*)::int count,encode(sha256(convert_to(coalesce(jsonb_agg(row_data order by row_data::text collate "C")::text,'[]'),'UTF8')),'hex') sha256
 from (select to_jsonb(t) row_data from (select ${t.columns.map(quote).join(',')} from ${quote(t.schema)}.${quote(t.name)}) t) rows`).join(' union all ')
 const rows=(await db.query(sql)).rows
 return tables.map(t=>({...t,...rows.find(r=>r.schema===t.schema&&r.name===t.name)}))
}

export async function targetIdentity(db){
 const users=(await db.query(`select u.id,u.email,u.email_confirmed_at is not null confirmed,coalesce(u.is_anonymous,false) anonymous,
 exists(select 1 from public.admin_users a where a.id=u.id) admin_member,
 u.banned_until from auth.users u order by u.id`)).rows
 const profiles=(await db.query('select * from public.customer_profiles order by id')).rows
 return {observed_utc:new Date().toISOString(),users,profiles}
}

export function ownershipAuthority(target){
 return {users:target.users.map(u=>({id:u.id,email:String(u.email||'').trim().toLowerCase(),confirmed:u.confirmed,anonymous:u.anonymous,admin_member:u.admin_member,banned_until:u.banned_until})),profiles:target.profiles.map(p=>({id:p.id,email:String(p.email||'').trim().toLowerCase(),is_active:p.is_active,is_internal:p.is_internal}))}
}

export async function privateCatalog(db){
 const namespace=(await db.query("select nspname name,pg_get_userbyid(nspowner) owner,nspacl::text acl from pg_namespace where nspname='customer_history_private'")).rows
 const relations=(await db.query(`select c.relname name,c.relkind kind,c.relrowsecurity rls,c.relforcerowsecurity force_rls,
 pg_get_userbyid(c.relowner) owner,c.relacl::text acl from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='customer_history_private' and c.relkind in ('r','S','v') order by 1`)).rows
 const columns=(await db.query(`select c.relname table_name,a.attname name,a.attnum ordinal,format_type(a.atttypid,a.atttypmod) type,a.attnotnull not_null,
 pg_get_expr(d.adbin,d.adrelid) default_value from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
 left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname='customer_history_private' and a.attnum>0 and not a.attisdropped order by 1,3`)).rows
 const constraints=(await db.query(`select c.relname table_name,k.conname name,k.contype type,k.convalidated validated,pg_get_constraintdef(k.oid,true) definition
 from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='customer_history_private' order by 1,2`)).rows
 const indexes=(await db.query("select * from pg_indexes where schemaname='customer_history_private' order by tablename,indexname")).rows
 const policies=(await db.query("select * from pg_policies where schemaname='customer_history_private' order by tablename,policyname")).rows
 const triggers=(await db.query(`select c.relname table_name,t.tgname name,pg_get_triggerdef(t.oid,true) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid
 join pg_namespace n on n.oid=c.relnamespace where n.nspname='customer_history_private' and not t.tgisinternal order by 1,2`)).rows
 assert.deepEqual(relations.filter(r=>r.kind==='r').map(r=>r.name).sort(),historyTables)
 assert.equal(triggers.length,0,'Unexpected history trigger could cause unrelated writes')
 return canonicalSchema({namespace,relations,columns,constraints,indexes,policies,triggers})
}

export async function access(db){
 const relations=(await db.query(`select c.relname name,c.relrowsecurity rls,pg_get_userbyid(c.relowner) owner from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='customer_history_private' and c.relkind='r' order by 1`)).rows
 assert.deepEqual(relations.map(r=>r.name),historyTables)
 for(const row of relations){assert.equal(row.rls,true);assert.equal(row.owner,'postgres')}
 const roles=['anon','authenticated','service_role'],privileges=['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']
 const rights=(await db.query(`select role,tablename,privilege,has_schema_privilege(role,'customer_history_private','USAGE') usage,
 has_table_privilege(role,'customer_history_private.'||tablename,privilege) allowed from unnest($1::text[]) role
 cross join unnest($2::text[]) tablename cross join unnest($3::text[]) privilege`,[roles,historyTables,privileges])).rows
 for(const row of rights){assert.equal(row.usage,false);assert.equal(row.allowed,false)}
 const rpc=(await db.query(`select role,signature,has_function_privilege(role,'public.'||signature,'EXECUTE') allowed from unnest($1::text[]) role
 cross join unnest($2::text[]) signature`,[roles,historyFunctions])).rows
 for(const row of rpc)assert.equal(row.allowed,row.role==='service_role')
 return {private_rls_and_grants:'PASS',service_only_rpc:'PASS',private_noninternal_triggers:0}
}

export async function historyCounts(db){
 const result={}
 for(const name of historyTables)result[name]=(await db.query('select count(*)::int n from customer_history_private.'+name)).rows[0].n
 result.claims=(await db.query('select count(*)::int n from customer_history_private.customers where auth_user_id is not null')).rows[0].n
 return result
}

export async function baseline(db,{tables}={}){
 const history=(await db.query('select version,name,statements from supabase_migrations.schema_migrations order by version')).rows
 assert.equal(history.length,94);assert.equal(history.at(-1).version,'20261025120000')
 const defs=tables||await definitions(db)
 return {history,schema:canonicalSchema(await schemaState(db)),history_schema:await privateCatalog(db),tables:defs,
 protected_tables:await protectedRows(db,defs),auth_security:await authSecurityFingerprint(db),history_access:await access(db),history_counts:await historyCounts(db)}
}

export async function verifyImported(db,prepared,sourceId){
 for(const [name,rows]of [['customers',prepared.payload.customers],['orders',prepared.payload.orders],['items',prepared.payload.items]]){
  const actual=(await db.query('select record from customer_history_private.'+name+' where source_id=$1 order by length(legacy_id),legacy_id',[sourceId])).rows.map(r=>r.record)
  const expected=[...rows].sort((a,b)=>a.legacy_id.length-b.legacy_id.length||a.legacy_id.localeCompare(b.legacy_id))
  assert.deepEqual(actual,expected,'Historical '+name+' snapshots changed')
 }
 const policy=(await db.query('select legacy_id,claim_approved,review_evidence,auth_user_id from customer_history_private.customers where source_id=$1',[sourceId])).rows
 for(const row of policy){const wanted=prepared.payload.customers.find(c=>c.legacy_id===row.legacy_id);assert.equal(row.claim_approved,wanted.claim_approved);assert.equal(row.review_evidence,wanted.review_evidence)}
 return {all_customer_order_refund_item_snapshots_equal:true,source_id:sourceId,counts:await historyCounts(db),eligibility_columns_match:true}
}

export async function importBatchPreserving(db,{sourceId,sourceKey,sourceSha256,tables},batch){
 let begun=false
 try{
  await db.query("begin isolation level repeatable read;set local statement_timeout='60s';set local lock_timeout='5s'");begun=true
  const before=await protectedRows(db,tables)
  const receipt=(await db.query('select public.customer_history_import_batch($1,$2,$3,$4,$5) receipt',[sourceId,sourceKey,sourceSha256,batch.id,batch.payload])).rows[0].receipt
  assert.deepEqual(await protectedRows(db,tables),before,'Import attempted to change current Auth/profile/commerce/Storage data')
  await db.query('commit');begun=false
  return {receipt,preservation:'PASS',protected_tables:tables.length,original_state_sha256:digest(before)}
 }catch(error){if(begun)await db.query('rollback').catch(()=>{});throw error}
}
