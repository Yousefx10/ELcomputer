// Bound, additive 82 -> 85 release. Never consults the ambient CLI link.
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import pg from 'pg'
export const hash = bytes => createHash('sha256').update(bytes).digest('hex')
export const pendingNames = ['20261020120000_cod_shipping_checkout.sql','20261020160000_private_vps_packing_videos.sql','20261020200000_normal_cod_collections.sql']
const quote = name => '"'+name.replaceAll('"','""')+'"'
export async function migrations(repo) {
  const certificate=JSON.parse(await readFile(repo+'/supabase/bootstrap/release-82-v1/manifest.json'))
  const names=(await readdir(repo+'/supabase/migrations')).filter(n=>n.endsWith('.sql')).sort()
  assert.deepEqual(names,[...certificate.migrations.map(m=>m.filename),...pendingNames])
  for(const m of certificate.migrations)assert.equal(hash(await readFile(repo+'/supabase/migrations/'+m.filename)),m.sha256,'Historical migration drift')
  const pending=[]
  for(const filename of pendingNames){const text=await readFile(repo+'/supabase/migrations/'+filename,'utf8');assert.equal((text.match(/^begin;$/gmi)||[]).length,1);assert.equal((text.match(/^commit;$/gmi)||[]).length,1);assert.match(text,/commit;\s*$/i)
    pending.push({filename,version:filename.slice(0,14),name:filename.slice(15,-4),sha256:hash(text),text})}
  return {history:certificate.history.map(({version,name})=>({version,name})),pending}
}
export async function connect(target,{readOnly=true}={}) {
  const credentials=JSON.parse(await readFile(target.credentials_file))
  assert.equal(credentials.project_ref,target.project_ref)
  assert.equal(target.database.host,'db.'+target.project_ref+'.supabase.co')
  assert.equal(target.database.port,5432);assert.equal(target.database.user,'postgres');assert.equal(target.database.name,'postgres')
  const db=new pg.Client({host:target.database.host,port:5432,user:'postgres',database:'postgres',password:credentials.database_password,
    ssl:{ca:await readFile(target.database.ca_file),rejectUnauthorized:true,servername:target.database.host,minVersion:'TLSv1.2'},
    options:'-c default_transaction_read_only='+(readOnly?'on':'off')+' -c statement_timeout=60000 -c lock_timeout=5000',connectionTimeoutMillis:12000,
    query_timeout:65000,keepAlive:true,keepAliveInitialDelayMillis:10000,
    application_name:'commerce_foundation_'+(readOnly?'readonly':'approved_release')})
  await db.connect();return db
}
export async function checkDatabase(db,release) {
  const history=(await db.query('select version,name from supabase_migrations.schema_migrations order by version')).rows
  assert.deepEqual(history,release.history,'Production migration history changed; never reapply')
  const controls=(await db.query("select payment_cash_enabled,payment_card_enabled,payment_paypal_enabled,payment_bank_transfer_enabled,payment_instapay_enabled,erp_mode from public.site_settings where key='default'")).rows
  assert.equal(controls.length,1);assert.equal(controls[0].erp_mode,'built_in')
  for(const [key,value] of Object.entries(controls[0]))if(key.endsWith('_enabled'))assert.equal(value,false,'Payment activation is outside this release')
  const tables=(await db.query(`select n.nspname schema,c.relname name,pg_get_userbyid(c.relowner) owner from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r' and n.nspname in ('public','private','catalog_private') order by 1,2`)).rows
  assert.ok(tables.length>100);assert.ok(tables.every(t=>t.owner==='postgres'),'Application ownership drift')
  return {history,controls:controls[0],tables:tables.length,read_only:(await db.query('show transaction_read_only')).rows[0].transaction_read_only}
}
// Preserve every old application row using its original column projection. Added
// default columns are excluded automatically; Auth identities are also compared.
export async function snapshot(db,{lock=false}={}) {
  const tables=(await db.query(`select n.nspname schema,c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'
    and (n.nspname in ('public','private','catalog_private') or n.nspname='auth' and c.relname in ('users','identities') or n.nspname='storage' and c.relname in ('objects','buckets')) order by 1,2`)).rows
  const result=[]
  for(const table of tables){const id=quote(table.schema)+'.'+quote(table.name)
    // Managed Auth/Storage remain read-only; never require broader write/lock
    // privileges there. Their protected rows are still compared before commit.
    if(lock&&['public','private','catalog_private'].includes(table.schema))await db.query('lock table '+id+' in share mode')
    const columns=(await db.query('select attname from pg_attribute where attrelid=$1::regclass and attnum>0 and not attisdropped order by attnum',[id])).rows.map(r=>r.attname)
    result.push({...table,columns,...await fingerprint(db,table,columns)})}
  return result
}
async function fingerprint(db,table,columns) {
  const projection=columns.map(quote).join(','),id=quote(table.schema)+'.'+quote(table.name)
  return (await db.query(`select count(*)::int count,encode(sha256(convert_to(coalesce(jsonb_agg(row_data order by row_data::text collate "C")::text,'[]'),'UTF8')),'hex') sha256 from (select to_jsonb(t) row_data from (select ${projection} from ${id}) t) rows`)).rows[0]
}
export async function verifyAccess(db) {
  for(const table of ['public.order_cod_collections','public.order_cod_reconciliations','private.cod_collection_commands']){
    assert.equal((await db.query('select relrowsecurity from pg_class where oid=$1::regclass',[table])).rows[0].relrowsecurity,true)
    for(const role of ['anon','authenticated','service_role'])for(const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']){
      const allowed=(await db.query('select has_table_privilege($1,$2,$3) allowed',[role,table,privilege])).rows[0].allowed
      assert.equal(allowed,role==='service_role'&&privilege==='SELECT'&&table.startsWith('public.'),'New ledger ACL drift')
    }
  }
  for(const fn of ['public.commerce_cod_cash_command(uuid,uuid,uuid,text,uuid,numeric,text,date,boolean)',
    'public.packing_video_prepare(uuid,uuid,text,bigint,timestamptz,timestamptz)','public.packing_video_finish(uuid,uuid,uuid,text,numeric)']){
    for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query('select has_function_privilege($1,$2,\'EXECUTE\') allowed',[role,fn])).rows[0].allowed,role==='service_role','RPC grant drift')
  }
  for(const privilege of ['INSERT','UPDATE'])assert.equal((await db.query('select has_table_privilege(\'service_role\',\'public.order_packing_videos\',$1) allowed',[privilege])).rows[0].allowed,false)
  return {private_ledgers:'PASS',service_only_commands:'PASS',direct_video_writes_revoked:true}
}
export async function applyMigrations(db,release,{beforeCommit=()=>{}}={}) {
  let begun=false
  try{
    await db.query('begin isolation level read committed');begun=true
    await db.query("set local lock_timeout='5s';set local statement_timeout='60s'")
    assert.equal((await db.query("select pg_try_advisory_xact_lock(hashtextextended('elcomputer-system-reset',0)) locked")).rows[0].locked,true,'Business/reset operation in progress')
    await checkDatabase(db,release)
    const before=await snapshot(db,{lock:true})
    for(const m of release.pending){assert.equal(hash(m.text),m.sha256,'Migration source changed during transaction');await db.query(m.text.replace(/^begin;\s*$/im,'').replace(/^commit;\s*$/im,''));await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[m.version,m.name,[m.text]])}
    for(const old of before)assert.deepEqual(await fingerprint(db,old,old.columns),{count:old.count,sha256:old.sha256},'Existing rows changed: '+old.schema+'.'+old.name)
    for(const name of ['order_cod_collections','order_cod_reconciliations'])assert.equal((await db.query('select count(*)::int count from public.'+quote(name))).rows[0].count,0)
    assert.equal((await db.query('select count(*)::int count from private.cod_collection_commands')).rows[0].count,0)
    const access=await verifyAccess(db)
    const history=(await db.query('select version,name from supabase_migrations.schema_migrations order by version')).rows
    assert.deepEqual(history,[...release.history,...release.pending.map(({version,name})=>({version,name}))])
    await beforeCommit({before,history});await db.query('commit');begun=false
    return {preserved_tables:before.length,history,access,counts:Object.fromEntries(before.map(t=>[t.schema+'.'+t.name,t.count]))}
  }catch(error){if(begun)await db.query('rollback').catch(()=>{});throw error}
}
