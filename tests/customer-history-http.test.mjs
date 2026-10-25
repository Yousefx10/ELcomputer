import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {createServer} from 'node:http'
import {resolve} from 'node:path'
import {build} from 'esbuild'
import {PGlite} from '@electric-sql/pglite'
import {createApp,createRouter,toNodeListener} from 'h3'

test('actual history routes enforce bearer, confirmed identity, body limits and owned source/order',async t=>{
 const db=new PGlite(),actors={alice:randomUUID(),bob:randomUUID(),pending:randomUUID()},source=randomUUID()
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);create table public.customer_profiles(id uuid primary key,is_active boolean default true);`)
 await db.exec(await readFile('supabase/migrations/20261025120000_customer_history.sql','utf8'))
 for(const [name,id]of Object.entries(actors)){await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)',[id,name+'@example.test',name==='pending'?null:'2026-01-01T00:00:00Z']);await db.query('insert into public.customer_profiles(id) values($1)',[id])}
 const payload={customers:[{legacy_id:'1',email:'alice@example.test',profile:{},billing_address:{},shipping_address:{},claim_approved:true,review_evidence:'c'.repeat(64)}],orders:[{legacy_id:'10',customer_legacy_id:'1',kind:'shop_order',total:'1.00',currency:'EGP'}],items:[]}
 await db.query('select public.customer_history_import_batch($1,$2,$3,$4,$5)',[source,'fixture','a'.repeat(64),randomUUID(),payload])
 const key='__history_'+randomUUID().replaceAll('-','')
 globalThis[key]={auth:{getUser:async token=>({data:{user:actors[token]?{id:actors[token],is_anonymous:false,email_confirmed_at:token==='pending'?null:'2026-01-01'}:null}})},
  from:()=>({select:()=>({eq:(_,id)=>({maybeSingle:async()=>({data:{id,is_active:true}})})})}),
  rpc:async(name,args)=>{try{const keys=Object.keys(args),r=await db.query('select public.'+name+'('+keys.map((k,i)=>k+'=> $'+(i+1)).join(',')+') value',Object.values(args));return {data:r.rows[0].value,error:null}}catch{return {data:null,error:{message:'PRIVATE DATABASE DIAGNOSTIC'}}}}
 }
 globalThis.defineEventHandler=value=>value
 const router=createRouter()
 for(const[method,path,file]of [['get','/api/account/history','server/api/account/history/index.get.js'],['post','/api/account/history/claim','server/api/account/history/claim.post.js'],['get','/api/account/history/:sourceId/:orderId','server/api/account/history/[sourceId]/[orderId].get.js']]){
  const out=await build({entryPoints:[resolve(file)],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'owned-transport',setup(b){b.onResolve({filter:/\/supabaseAdmin$/},()=>({path:key,namespace:key}));b.onLoad({filter:/.*/,namespace:key},()=>({contents:`export const getSupabaseAdminClient=()=>globalThis[${JSON.stringify(key)}]`}));b.onResolve({filter:/^h3$/},()=>({path:import.meta.resolve('h3'),external:true}))}}]})
  const handler=(await import('data:text/javascript;base64,'+Buffer.from(out.outputFiles[0].text).toString('base64'))).default;router[method](path,handler)
 }
 const server=createServer(toNodeListener(createApp({debug:false}).use(router)));await new Promise(r=>server.listen(0,'127.0.0.1',r))
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));delete globalThis[key];await db.close()})
 const call=async(path,actor='alice',body)=>{const r=await fetch('http://127.0.0.1:'+server.address().port+path,{method:body?'POST':'GET',headers:{...(actor?{authorization:'Bearer '+actor}:{}),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json(),cache:r.headers.get('cache-control')}}
 assert.equal((await call('/api/account/history',null)).status,401)
 assert.equal((await call('/api/account/history','pending')).status,403)
 assert.equal((await call('/api/account/history?offset=-1')).status,400)
 assert.equal((await call('/api/account/history/claim','alice',{confirmed:true,p_user_id:actors.bob})).status,400)
 assert.equal((await call('/api/account/history/claim','alice',{confirmed:true})).status,200)
 let r=await call('/api/account/history');assert.equal(r.body.total,1);assert.match(r.cache,/private.*no-store/)
 assert.equal((await call('/api/account/history/'+source+'/10','bob')).status,404)
 assert.equal((await call('/api/account/history/'+source+'/10')).body.order.total,'1.00')
 assert.equal((await call('/api/account/history/claim','alice',{confirmed:true,extra:'x'.repeat(1000)})).status,400)
})
