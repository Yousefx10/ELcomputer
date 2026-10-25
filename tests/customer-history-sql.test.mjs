import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
const sql=await readFile(new URL('../supabase/migrations/20261025120000_customer_history.sql',import.meta.url),'utf8')
const alice=randomUUID(),bob=randomUUID(),unconfirmed=randomUUID(),source=randomUUID(),batch=randomUUID()
async function fixture(){
 const db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);create table public.customer_profiles(id uuid primary key,is_active boolean default true,address text);create table public.live_effects(kind text primary key,value integer);insert into public.live_effects values('orders',1),('payments',1),('inventory',1),('shipping',1),('notifications',1);`)
 await db.exec(sql)
 await db.query(`insert into auth.users(id,email,email_confirmed_at) values($1,'alice@example.test',now()),($2,'bob@example.test',now()),($3,'unconfirmed@example.test',null)`,[alice,bob,unconfirmed])
 await db.query(`insert into public.customer_profiles(id,address) values($1,'New address'),($2,'B address'),($3,'Unconfirmed')`,[alice,bob,unconfirmed])
 return db
}
const customer=()=>({legacy_id:'1',email:'alice@example.test',profile:{first_name:'Alice'},billing_address:{address_1:'Old address'},shipping_address:{},claim_approved:true,review_evidence:'b'.repeat(64)})
const order=(id='10',owner='1')=>({legacy_id:id,customer_legacy_id:owner,kind:'shop_order',total:'19.00',currency:'EGP',status:'wc-completed',created_at:'2025-01-01T00:00:00Z'})
const payload=()=>({customers:[customer()],orders:[order(),{...order('11',null),billing_address:{email:'alice@example.test'}}],items:[{legacy_id:'100',order_legacy_id:'10',kind:'line_item',title:'Original item',quantity:'1'}]})
const apply=(db,p=payload(),command=batch,sha='a'.repeat(64))=>db.query('select public.customer_history_import_batch($1,$2,$3,$4,$5) receipt',[source,'fixture-source',sha,command,p]).then(r=>r.rows[0].receipt)
const read=(db,user,src=null,id=null)=>db.query('select public.customer_history_read($1,$2,$3,0) value',[user,src,id]).then(r=>r.rows[0].value)

test('historical import/recovery retains live state; exact retries return durable receipt',async()=>{
 const db=await fixture();try{
  const before=(await db.query('select * from public.live_effects order by kind')).rows
  const receipt=await apply(db);assert.equal(receipt.orders,2);assert.deepEqual(await apply(db),receipt)
  const changed=payload();changed.orders[0].total='20.00';await assert.rejects(apply(db,changed),/command changed/)
  await assert.rejects(apply(db,payload(),randomUUID(),'c'.repeat(64)),/source requires review/)
  assert.deepEqual((await db.query('select * from public.live_effects order by kind')).rows,before)
  assert.equal((await db.query('select address from public.customer_profiles where id=$1',[alice])).rows[0].address,'New address')
  assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,3)
 }finally{await db.close()}
})
test('only verified owner-reviewed registered associations expose orders; guest stays unlinked',async()=>{
 const db=await fixture();try{
  await apply(db);assert.equal((await read(db,alice)).total,0)
  await assert.rejects(db.query('select public.customer_history_claim($1)',[unconfirmed]),/Verified customer/)
  await db.query('select public.customer_history_claim($1)',[alice]);await db.query('select public.customer_history_claim($1)',[alice])
  assert.equal((await read(db,alice)).total,1);assert.equal((await read(db,bob)).total,0)
  assert.equal(await read(db,bob,source,'10'),null);assert.equal(await read(db,alice,source,'11'),null)
  assert.equal((await read(db,alice,source,'10')).items[0].title,'Original item')
  await db.query('update auth.users set email=$1 where id=$2',['changed@example.test',alice]);assert.equal((await read(db,alice)).total,0)
 }finally{await db.close()}
})
test('claims default closed; hidden-source rollback stops access without touching customer data',async()=>{
 const db=await fixture();try{
  const p=payload();p.customers[0].claim_approved=false;p.customers[0].review_evidence=null
  await apply(db,p);assert.equal((await db.query('select public.customer_history_claim($1) value',[alice])).rows[0].value.connected,0)
  await db.query('select public.customer_history_hide_source($1,$2)',[source,'a'.repeat(64)])
  assert.equal((await read(db,alice)).total,0);await assert.rejects(apply(db),/source requires review/)
  assert.equal((await db.query('select address from public.customer_profiles where id=$1',[alice])).rows[0].address,'New address')
 }finally{await db.close()}
})
test('an eligible verified customer without orders connects archived profile only',async()=>{
 const db=await fixture();try{
  const p=payload();p.orders=[];p.items=[];await apply(db,p)
  const result=(await db.query('select public.customer_history_claim($1) value',[alice])).rows[0].value
  assert.equal(result.connected,1)
  const history=await read(db,alice)
  assert.equal(history.total,0);assert.deepEqual(history.orders,[])
  assert.equal(history.profiles.length,1);assert.equal(history.profiles[0].profile.first_name,'Alice')
  assert.equal((await read(db,bob)).profiles.length,0)
  assert.equal(await read(db,alice,source,'10'),null)
  assert.equal((await db.query('select address from public.customer_profiles where id=$1',[alice])).rows[0].address,'New address')
 }finally{await db.close()}
})
test('unreviewed/oversized/malformed commands roll back atomically; browser grants deny commands',async()=>{
 const db=await fixture();try{
  const missing=payload();missing.customers[0].review_evidence=null;await assert.rejects(apply(db,missing))
  assert.equal((await db.query('select count(*)::int n from customer_history_private.sources')).rows[0].n,0)
  const bad=payload();bad.items[0].order_legacy_id='999';await assert.rejects(apply(db,bad))
  assert.equal((await db.query('select count(*)::int n from customer_history_private.orders')).rows[0].n,0)
  const oversized=payload();oversized.customers=Array(51).fill(customer());await assert.rejects(apply(db,oversized),/too large/)
  for(const role of ['anon','authenticated']){
   assert.equal((await db.query(`select has_function_privilege($1,'public.customer_history_claim(uuid)','execute') allowed`,[role])).rows[0].allowed,false)
   assert.equal((await db.query(`select has_table_privilege($1,'customer_history_private.orders','select') allowed`,[role])).rows[0].allowed,false)
  }
  assert.equal((await db.query(`select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='customer_history_private' and c.relkind='r' and not c.relrowsecurity`)).rows[0].n,0)
 }finally{await db.close()}
})
