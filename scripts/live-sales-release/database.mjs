// A separate, bounded 85 -> 87 release. The completed 82 -> 85 operator is inert.
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {hash,connect,snapshot,verifyAccess as verifyFoundation} from '../commerce-release/database.mjs'
import {json as certificateJson} from '../lib/cleanBaseline.mjs'
export {hash,connect,snapshot}
const foundation = [
  ['20261020120000_cod_shipping_checkout.sql','7f7dce470bd29b25b2aec5b5cbaaefe06c43efb6a7d6c0b8f49a451bb9eaa36b'],
  ['20261020160000_private_vps_packing_videos.sql','9057b0a8cdf7fbcefa386db51abe2b19341dbf9d1db3e9e1d70d0fb220748c21'],
  ['20261020200000_normal_cod_collections.sql','691a93c3c8ca9a8cdcf403ce1da6313a223f91570748a2bb2e5512282490ade3']
]
const pending = [
  ['20261021010000_live_card_checkout.sql','04d26ea7cef634cc753c71663061e9a14a400efb8eb2741f7e9c158e87245790'],
  ['20261021020000_safe_pdc_dispatch.sql','1166201e9f0d9af4c8d2a4b8e04601c4e7318fbb82ce7609aa9f8e19f4927cd3']
]
export async function migrations(repo) {
  const certificate=JSON.parse(await readFile(repo+'/supabase/bootstrap/release-82-v1/manifest.json'))
  const expected=[...certificate.migrations,...foundation.map(([filename,sha256])=>({filename,sha256})),...pending.map(([filename,sha256])=>({filename,sha256}))]
  assert.deepEqual((await readdir(repo+'/supabase/migrations')).filter(n=>n.endsWith('.sql')).sort(),expected.map(m=>m.filename))
  const files=[]
  for(const m of expected){const text=await readFile(repo+'/supabase/migrations/'+m.filename,'utf8');assert.equal(hash(text),m.sha256,'Migration source drift');files.push({...m,text,version:m.filename.slice(0,14),name:m.filename.slice(15,-4)})}
  return {history:files.slice(0,85).map(({version,name})=>({version,name})),foundation:files.slice(82,85),pending:files.slice(85),certificate_history:certificate.history}
}
export async function checkDatabase(db,release,{after=false}={}) {
  const identities=rows=>rows.map(({version,name})=>({version,name}))
  const history=(await db.query('select version,name,statements from supabase_migrations.schema_migrations order by version')).rows
  assert.deepEqual(identities(history),[...release.history,...(after?identities(release.pending):[])],'Production migration history changed; never reapply')
  for(let i=0;i<82;i++)assert.equal(hash(certificateJson(history[i].statements)),release.certificate_history[i].statements_sha256,'Historical statement drift')
  for(const m of [...release.foundation,...(after?release.pending:[])])assert.deepEqual(history.find(r=>r.version===m.version).statements,[m.text],'Stored migration source drift')
  const controls=(await db.query("select payment_cash_enabled,payment_card_enabled,payment_paypal_enabled,payment_bank_transfer_enabled,payment_instapay_enabled,erp_mode from public.site_settings where key='default'")).rows
  assert.equal(controls.length,1);assert.equal(controls[0].erp_mode,'built_in')
  for(const [key,value]of Object.entries(controls[0]))if(key.endsWith('_enabled'))assert.equal(value,false,'Activation is unapproved')
  const pdc=(await db.query("select is_enabled,auto_create_labels,reverse_enabled from public.shipping_provider_settings where id='pdc'")).rows
  assert.deepEqual(pdc,[{is_enabled:false,auto_create_labels:false,reverse_enabled:false}])
  const owners=(await db.query("select pg_get_userbyid(c.relowner) owner from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in ('public','private','catalog_private')")).rows
  assert.ok(owners.length>100&&owners.every(r=>r.owner==='postgres'),'Application ownership drift')
  const protectedTables=await snapshot(db)
  for(const name of ['public.payment_attempts','public.shipping_order_jobs','public.shipping_claim_jobs'])assert.equal(protectedTables.find(r=>r.schema+'.'+r.name===name)?.count,0,'Outstanding provider work requires separate review')
  return {history:identities(history),controls:controls[0],pdc,protected_tables:protectedTables,read_only:(await db.query('show transaction_read_only')).rows[0].transaction_read_only}
}
export async function verifyAccess(db) {
  await verifyFoundation(db)
  for(const table of ['private.pdc_dispatches','public.shipping_order_jobs']){
    assert.equal((await db.query('select relrowsecurity from pg_class where oid=$1::regclass',[table])).rows[0].relrowsecurity,true)
    for(const role of ['anon','authenticated','service_role'])for(const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']){
      assert.equal((await db.query('select has_table_privilege($1,$2,$3) allowed',[role,table,privilege])).rows[0].allowed,role==='service_role'&&privilege==='SELECT','Dispatch ACL drift')
    }
  }
  const functions=(await db.query("select p.oid::regprocedure::text signature,n.nspname schema from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='private' and p.proname like 'pdc_%') or (n.nspname='public' and p.proname like 'shipping_order_%') or (n.nspname='public' and p.proname in ('commerce_claim_payment_attempt','commerce_store_payment_intention','shipping_claim_read_label'))")).rows
  assert.ok(functions.length>=9)
  for(const f of functions)for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query("select has_function_privilege($1,$2,'EXECUTE') allowed",[role,f.signature])).rows[0].allowed,role==='service_role'&&f.schema==='public','Shipping/payment RPC drift')
  assert.equal((await db.query('select count(*)::int count from private.pdc_dispatches')).rows[0].count,0)
  return {foundation:'PASS',dispatch_acl:'PASS',service_only_commands:'PASS',dispatches:0}
}
export async function compareOriginal(db,before) {
  const quote=s=>'"'+s.replaceAll('"','""')+'"'
  for(const old of before){
    const columns=old.columns.map(quote).join(','),table=quote(old.schema)+'.'+quote(old.name)
    const actual=(await db.query(`select count(*)::int count,encode(sha256(convert_to(coalesce(jsonb_agg(row_data order by row_data::text collate "C")::text,'[]'),'UTF8')),'hex') sha256 from (select to_jsonb(t) row_data from (select ${columns} from ${table}) t) rows`)).rows[0]
    assert.deepEqual(actual,{count:old.count,sha256:old.sha256},'Existing row changed: '+table)
  }
}
export async function applyMigrations(db,release,{beforeCommit=()=>{}}={}) {
  let begun=false
  try{
    await db.query('begin');begun=true
    await db.query("set local lock_timeout='5s';set local statement_timeout='60s'")
    assert.equal((await db.query("select pg_try_advisory_xact_lock(hashtextextended('elcomputer-system-reset',0)) locked")).rows[0].locked,true,'Business operation in progress')
    await checkDatabase(db,release)
    const before=await snapshot(db,{lock:true})
    await checkDatabase(db,release) // Recheck queues/controls after acquiring locks.
    for(const m of release.pending){
      assert.equal(hash(m.text),m.sha256,'Migration source drift')
      assert.equal((m.text.match(/^begin;$/gmi)||[]).length,1);assert.equal((m.text.match(/^commit;$/gmi)||[]).length,1)
      await db.query(m.text.replace(/^begin;\s*$/im,'').replace(/^commit;\s*$/im,''))
      await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[m.version,m.name,[m.text]])
    }
    await compareOriginal(db,before)
    const access=await verifyAccess(db),state=await checkDatabase(db,release,{after:true})
    await beforeCommit({before,history:state.history,access});await db.query('commit');begun=false
    return {before,history:state.history,access,preserved_tables:before.length}
  }catch(error){if(begun)await db.query('rollback').catch(()=>{});throw error}
}
