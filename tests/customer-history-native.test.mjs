import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createEmailNativeDatabase,emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'

test('native PostgreSQL serializes concurrent history batches and claims on full application schema',{skip:!emailNativeAvailable},async t=>{
 const db=await createEmailNativeDatabase();t.after(db.close)
 const a=await db.connect(),b=await db.connect(),source=randomUUID(),batch=randomUUID(),user=randomUUID()
 await db.query(`insert into auth.users(id,email,email_confirmed_at) values($1,'native-history@example.test',now())`,[user])
 const p={customers:[{legacy_id:'1',email:'native-history@example.test',profile:{},billing_address:{},shipping_address:{},claim_approved:true,review_evidence:'a'.repeat(64)}],orders:[{legacy_id:'10',customer_legacy_id:'1',kind:'shop_order',total:'2.00',currency:'EGP'}],items:[]}
 const before=(await db.query('select count(*)::int n from public.customer_orders')).rows[0].n
 const args=[source,'native-history','b'.repeat(64),batch,p],sql='select public.customer_history_import_batch($1,$2,$3,$4,$5) value'
 const results=await Promise.all([a.query(sql,args),b.query(sql,args)]);assert.deepEqual(results[0].rows,results[1].rows)
 await Promise.all([a.query('select public.customer_history_claim($1)',[user]),b.query('select public.customer_history_claim($1)',[user])])
 assert.equal((await db.query('select count(*)::int n from customer_history_private.customers where auth_user_id=$1',[user])).rows[0].n,1)
 assert.equal((await db.query('select count(*)::int n from customer_history_private.batches')).rows[0].n,1)
 assert.equal((await db.query('select count(*)::int n from public.customer_orders')).rows[0].n,before)
})
