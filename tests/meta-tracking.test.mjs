import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {build} from 'esbuild'
import {metaPublicPath} from '../app/utils/metaTracking.js'
const compiled=await build({entryPoints:[resolve('server/utils/metaTracking.js')],bundle:true,write:false,format:'esm',platform:'node',alias:{'~':resolve('app')},plugins:[{name:'meta-isolation',setup(b){
 b.onResolve({filter:/\/supabaseAdmin(?:\.js)?$/},()=>({path:'db',namespace:'meta'}));b.onLoad({filter:/.*/,namespace:'meta'},()=>({contents:'export const getSupabaseAdminClient=()=>{throw Error("No database in provider-independent tests")}',loader:'js'}));b.onResolve({filter:/^h3$/},()=>({path:import.meta.resolve('h3'),external:true}))
}}]})
const {dispatchMetaEvent,metaEventPayload}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'))
const context={revision:1,pixelId:'123456789',tokenEncrypted:'opaque-fixture',graphVersion:'v26.0',testEventCode:'TEST_LOCAL',event:{event_name:'ViewContent',event_id:'purchase:local-fixture',event_time:1793700000,action_source:'website',source_path:'/checkout',user_data:{external_id:['a'.repeat(64)]},custom_data:{currency:'EGP',value:150.35}}}
test('private paths, query credentials and external source URLs stay out of browser tracking',()=>{for(const path of ['/account/orders/uuid','/sms/unsubscribe','/ar/sms/unsubscribe','/sms%2Funsubscribe','/ar/dashboard','/checkout/session/uuid','/%61ccount/orders/private','/checkout%2Fsession%2Fuuid','//foreign.invalid'])assert.equal(metaPublicPath(path),null);assert.equal(metaPublicPath('/products/item?token=private#secret'),'/products/item');assert.throws(()=>metaEventPayload({...context,event:{...context.event,source_path:'//foreign.invalid'}},'https://shop.example.invalid'))})
test('disabled Meta controls cannot reach a database or provider',async()=>{let calls=0;const result=await dispatchMetaEvent({db:{rpc:()=>{calls++;throw Error()}},runtime:{metaTrackingEnabled:false},fetcher:()=>{calls++;throw Error()}});assert.equal(result.state,'disabled');assert.equal(calls,0)})
for(const scenario of ['accepted','transient','rejected','uncertain'])test('provider '+scenario+' retains the same durable event and never leaks the token',async()=>{
 const commands=[],calls=[],db={rpc:async(name,args)=>{commands.push({name,args});return {data:name==='commerce_meta_claim'?{id:'event-fixture',lease:'lease-fixture'}:name==='commerce_meta_dispatch'?context:true,error:null}}}
 const result=await dispatchMetaEvent({db,runtime:{metaTrackingEnabled:true,metaDispatchEnabled:true,metaTestRevision:1,public:{siteUrl:'https://another-store.example.invalid'}},decrypt:()=> 'PRIVATE_TOKEN_CANARY',fetcher:async(url,options)=>{
  calls.push({url,options});if(scenario==='uncertain')throw Error('Lost acknowledgement PRIVATE_TOKEN_CANARY');const status={accepted:200,transient:429,rejected:400}[scenario];return new Response(JSON.stringify({events_received:1}),{status})
 }})
 assert.equal(result.state,scenario);assert.equal(calls.length,1);assert.equal(calls[0].url,'https://graph.facebook.com/v26.0/123456789/events');assert.equal(calls[0].options.redirect,'error');assert.ok(!calls[0].url.includes('PRIVATE_TOKEN_CANARY'))
 const payload=JSON.parse(calls[0].options.body);assert.equal(payload.data[0].event_id,context.event.event_id);assert.equal(payload.data[0].event_source_url,'https://another-store.example.invalid/checkout');assert.equal(payload.test_event_code,'TEST_LOCAL');assert.ok(!JSON.stringify(commands).includes('PRIVATE_TOKEN_CANARY'));assert.equal(commands.at(-1).args.p_outcome,scenario)
})
test('final consent/configuration denial prevents an outbound request',async()=>{let calls=0;const db={rpc:async name=>({data:name==='commerce_meta_claim'?{id:'x',lease:'y'}:null,error:null})};assert.equal((await dispatchMetaEvent({db,runtime:{metaTrackingEnabled:true,metaDispatchEnabled:true},fetcher:()=>calls++})).state,'held');assert.equal(calls,0)})

for(const scenario of ['wrong-revision','Purchase','CODOrderPlaced'])test('bounded Test Events hold '+scenario+' before any provider fetch',async()=>{
 let calls=0,finished;const c={...context,event:{...context.event,event_name:scenario==='wrong-revision'?'PageView':scenario}},db={rpc:async(name,args)=>{if(name==='commerce_meta_finish')finished=args;return{data:name==='commerce_meta_claim'?{id:'x',lease:'y'}:name==='commerce_meta_dispatch'?c:true,error:null}}}
 const result=await dispatchMetaEvent({db,runtime:{metaTrackingEnabled:true,metaDispatchEnabled:true,metaTestRevision:scenario==='wrong-revision'?2:1},fetcher:()=>{calls++;throw Error('Forbidden external request')}})
 assert.equal(result.state,'held');assert.equal(calls,0);assert.equal(finished.p_outcome,'rejected')
})

test('ad-click URLs stay eligible while other query strings stay private',async()=>{
 const {metaSafeSearch}=await import('../app/utils/metaTracking.js')
 for(const ok of ['','?fbclid=abc','?utm_source=fb&utm_campaign=x&fbclid=abc'])assert.equal(metaSafeSearch(ok),true,ok)
 for(const bad of ['?q=keyboard','?fbclid=abc&email=a@b.c','?order=123'])assert.equal(metaSafeSearch(bad),false,bad)
})
