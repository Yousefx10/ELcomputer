import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createEmailNativeDatabase,emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
import {schemaState} from '../scripts/footer-release/database.mjs'
import {snapshot} from '../scripts/commerce-release/database.mjs'
const file='20261022150000_pdc_lookup_rpc_access.sql',names=['shipping_claim_pdc_lookup()','shipping_claim_pdc_refresh(uuid)']
test('PDC lookup RPC correction restores only intended server grants over schema89',{skip:!emailNativeAvailable,timeout:90000},async()=>{
 const db=await createEmailNativeDatabase({stopBefore:file}),sql=await readFile('supabase/migrations/'+file,'utf8')
 try{
  const permissions=async role=>(await db.query("select has_function_privilege($1,'public.shipping_claim_pdc_lookup()','EXECUTE') lookup,has_function_privilege($1,'public.shipping_claim_pdc_refresh(uuid)','EXECUTE') refresh",[role])).rows[0]
  for(const role of ['anon','authenticated','service_role'])assert.deepEqual(await permissions(role),{lookup:false,refresh:false})
  const before=await schemaState(db),data=await snapshot(db)
  await db.exec(sql)
  assert.deepEqual(await permissions('service_role'),{lookup:true,refresh:true})
  for(const role of ['anon','authenticated'])assert.deepEqual(await permissions(role),{lookup:false,refresh:false})
  const after=await schemaState(db)
  for(const name of names){const old=before.functions.find(f=>f.signature===name),now=after.functions.find(f=>f.signature===name);assert.ok(old&&now);assert.deepEqual({...now,acl:old.acl},old);assert.ok(now.acl.includes('service_role=X/'))}
  assert.deepEqual({...after,functions:after.functions.map(f=>names.includes(f.signature)?before.functions.find(old=>old.signature===f.signature):f)},before)
  assert.deepEqual(await snapshot(db),data)
  const server=await db.connect('service_role')
  try{
   assert.equal((await server.query('select public.shipping_claim_pdc_lookup() ok')).rows[0].ok,true)
   assert.equal((await server.query('select public.shipping_claim_pdc_lookup() ok')).rows[0].ok,false)
   for(const role of ['anon','authenticated']){await server.query("select set_config('request.jwt.claim.role',$1,false)",[role]);await assert.rejects(()=>server.query('select public.shipping_claim_pdc_lookup()'),/Service role required/)}
   await server.query("select set_config('request.jwt.claim.role','service_role',false)")
  }finally{await server.end()}
  await assert.rejects(()=>db.exec(sql),/Unexpected PDC lookup RPC access baseline/)
 }finally{await db.close()}
})
