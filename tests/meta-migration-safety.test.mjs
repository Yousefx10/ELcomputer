import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createEmailNativeDatabase,emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
import {schemaState} from '../scripts/footer-release/database.mjs'
import {snapshot} from '../scripts/commerce-release/database.mjs'
const name='20261105132000_meta_commerce_tracking.sql'
test('Meta migration is inactive, additive and transactionally reversible on the current schema114 candidate chain',{skip:!emailNativeAvailable,timeout:120000},async()=>{
 const db=await createEmailNativeDatabase({stopBefore:name})
 try{
  const before=await schemaState(db),rows=await snapshot(db),sql=await readFile('supabase/migrations/'+name,'utf8')
  await db.query('begin');await db.exec(sql.replace(/^begin;\s*$/im,'').replace(/^commit;\s*$/im,''))
  const after=await schemaState(db),current=await snapshot(db)
  for(const row of rows)assert.deepEqual(current.find(x=>x.schema===row.schema&&x.name===row.name),row,'Existing data changed: '+row.schema+'.'+row.name)
  for(const f of before.functions)assert.deepEqual(after.functions.find(x=>x.signature===f.signature),f,'Existing function changed: '+f.signature)
  for(const key of ['policies','columns','indexes','constraints'])for(const row of before[key])assert.ok(after[key].some(x=>JSON.stringify(x)===JSON.stringify(row)),'Existing schema contract changed: '+key)
  assert.equal((await db.query('select enabled,capi_enabled,revision,token_encrypted from private.meta_settings')).rows[0].enabled,false)
  assert.equal((await db.query('select count(*)::int n from private.meta_event_outbox')).rows[0].n,0)
  await db.query('rollback');assert.deepEqual(await schemaState(db),before);assert.deepEqual(await snapshot(db),rows)
 }finally{await db.close()}
})
