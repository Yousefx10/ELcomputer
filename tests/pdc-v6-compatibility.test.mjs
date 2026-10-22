import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {normalizePdcLookup,requestPdcLookup} from '../server/utils/pdcLookups.js'
import {inspectPdcLookupBytes} from '../scripts/lib/pdcLookupSchema.mjs'
import {encryptShippingSecret} from '../server/utils/shippingSecrets.js'
import {createClaimsHttpFixture} from './helpers/claimsHttpFixture.mjs'
const products=JSON.parse(readFileSync(new URL('./fixtures/pdc-v6-products.json',import.meta.url)))
const expected=[{id:36,name:'General'},{id:40,name:'High Value(elc)'}]
const normalize=value=>normalizePdcLookup(value,'GetProducts')
const inspect=(value,productId=40)=>inspectPdcLookupBytes(Buffer.from(JSON.stringify(value)),{companyId:'123456',productId})
const runtime={shippingCredentialsEncryptionKey:'isolated-pdc-v6-encryption-key-at-least-32-characters',shippingLiveRequestsEnabled:true}

test('support-confirmed shipping services remain distinct; city aliases stay documented',()=>{
 assert.deepEqual(normalize(products),expected)
 for(const rows of [[{id:36,name:'General'},{ID:40,Name:'High Value(elc)'}],[{id:null,ID:36,name:null,Name:'General'},{productID:'40',productName:'High Value(elc)'}]])assert.deepEqual(normalize(rows),expected)
 assert.deepEqual(normalizePdcLookup([{id:1,name:'Cairo'}],'GetCities'),[{id:1,name:'Cairo'}])
 assert.throws(()=>normalizePdcLookup(products,'GetCities'))
 for(const row of [{ProductID:36,ProductName:'General'},{productId:36,productName:'General'},{productID:36,title:'General'},{id:0,productID:36,name:'General'},{productID:36,name:'',productName:'General'}])assert.throws(()=>normalize([row]))
})

test('provider IDs reject coercion, invalid bounds and duplicate services',()=>{
 for(const id of [true,false,[36],[[36]],{},null,'',' ','0x24','3.6e1','36.0',0,-1,36.5,2147483648,Infinity,NaN])assert.throws(()=>normalize([{productID:id,productName:'General'}]),e=>e.statusCode===502)
 for(const id of [36,'36','036',' 36 ',2147483647])assert.equal(normalize([{productID:id,productName:'General'}])[0].id,Number(id))
 for(const duplicate of [{id:36,name:'Other'},{ID:'036',Name:'Other'},{productID:36,productName:'Other'}])assert.throws(()=>normalize([products[0],duplicate]))
 for(const name of [null,'',' ','x'.repeat(201),{},[],true,'a\0b'])assert.throws(()=>normalize([{productID:36,productName:name}]),e=>e.statusCode===502&&!e.message.includes('General'))
})

test('lookup envelopes retain completeness, row bounds and atomic rejection',()=>{
 for(const key of ['data','items','shipments'])assert.deepEqual(normalize({[key]:products}),expected)
 for(const body of [{products},{data:products,hasMore:true},{data:products,nextPage:2},{data:products,totalCount:3},{data:{}},[null],[[36,'General']]])assert.throws(()=>normalize(body))
 assert.equal(normalize(Array.from({length:5000},(_,i)=>({productID:i+1,productName:'Service'}))).length,5000)
 assert.throws(()=>normalize(Array.from({length:5001},(_,i)=>({productID:i+1,productName:'Service'}))))
})

test('schema stages distinguish normalization, echo types, echo mismatch and saved selection',()=>{
 const accepted=inspect(products);assert.equal(accepted.classification,'LOOKUP_SCHEMA_ACCEPTED');assert.equal(accepted.company_echo,'ABSENT');assert.equal(accepted.saved_product,'MATCH')
 for(const id of [36,40])assert.equal(inspect(products,id).saved_product,'MATCH')
 assert.equal(inspect(products,64).classification,'SAVED_PRODUCT_MISMATCH')
 const malformed=inspect([{...products[0],CompanyID:{toString:null}},products[1]])
 assert.equal(malformed.normalization,'PASS');assert.equal(malformed.company_echo,'UNSUPPORTED_TYPE');assert.equal(malformed.classification,'COMPANY_ECHO_TYPE_REJECTED')
 assert.equal(inspect([{...products[0],CompanyID:'654321'},products[1]]).classification,'COMPANY_ECHO_MISMATCH')
 const both=inspect([{productID:true,productName:'General',CompanyID:{toString:null}}]);assert.equal(both.normalization,'REJECTED');assert.equal(both.company_echo,'UNSUPPORTED_TYPE');assert.equal(both.classification,'NORMALIZATION_REJECTED');assert.equal(both.saved_product,'NOT_EVALUATED')
 assert.equal(inspect({products}).classification,'ROW_EXTRACTION_REJECTED')
 for(const value of ['General','High Value(elc)','123456','654321'])assert.equal(JSON.stringify(malformed).includes(value),false)
 assert.equal(accepted.account_ownership,'UNPROVEN');assert.equal(accepted.provider_authentication,'UNPROVEN')
})

test('GET transport needs no cookie or body and masks upstream failures without retry',async()=>{
 const previous=globalThis.useRuntimeConfig;globalThis.useRuntimeConfig=()=>runtime
 try{
  const settings={api_mode:'production',base_url:'https://clientsapi.pdc-eg.com/api/ClientUsers/V6/',company_id:'123456',access_token_encrypted:encryptShippingSecret('FICTIONAL-PDC-V6-TOKEN')}
  let requests=0
  const result=await requestPdcLookup(settings,'GetProducts',undefined,async(url,options)=>{
   requests++;assert.equal(url,settings.base_url+'GetProducts');assert.equal(options.method,'GET');assert.equal(options.body,undefined);assert.equal(options.headers.AccessToken,'FICTIONAL-PDC-V6-TOKEN');assert.equal(options.headers.CompanyID,'123456');assert.equal(Object.keys(options.headers).some(k=>k.toLowerCase()==='cookie'),false);assert.equal(options.redirect,'error');return Response.json(products)
  });assert.deepEqual(normalize(result),expected);assert.equal(requests,1)
  for(const status of [401,403,429,500,502]){requests=0;await assert.rejects(()=>requestPdcLookup(settings,'GetProducts',undefined,async()=>{requests++;return new Response('PRIVATE_UPSTREAM_CANARY',{status})}),e=>e.statusCode===502&&!e.message.includes('CANARY'));assert.equal(requests,1)}
  for(const reply of [()=>new Response('{'),()=>new Response('[]',{headers:{'content-length':'1048577'}}),()=>new Response('x'.repeat(1048577))])await assert.rejects(()=>requestPdcLookup(settings,'GetProducts',undefined,async()=>reply()))
 }finally{globalThis.useRuntimeConfig=previous}
})

test('Dashboard handlers accept confirmed products and preserve IDs, aliases, gates and private configuration',async t=>{
 const originalFetch=globalThis.fetch,originalRuntime=globalThis.useRuntimeConfig
 globalThis.useRuntimeConfig=()=>runtime
 const f=await createClaimsHttpFixture({extraDirectories:['server/api/admin-shipping']})
 const server=await f.start(),requests=[]
 let productReply=products,cityReply=[{id:1,name:'Cairo'},{id:2,name:'Destination'}],onCity=()=>{},enabled=true
 const call=async(action,actor='owner')=>{
  const r=await originalFetch(server.url+'/api/admin-shipping/lookups',{method:'POST',headers:{authorization:'Bearer '+actor,'content-type':'application/json'},body:JSON.stringify({action})});return {status:r.status,body:await r.json()}
 }
 const state=async()=> (await f.db.query("select * from public.shipping_provider_settings where id='pdc'")).rows[0]
 const reset=()=>f.db.query("update public.shipping_provider_settings set lookup_attempted_at=null where id='pdc'")
 try{
  const secret=encryptShippingSecret('FICTIONAL-PDC-V6-TOKEN')
  await f.db.query("update public.shipping_provider_settings set product_id=40,origin_city_id=1,company_id='123456',access_token_encrypted=$1,is_enabled=false,auto_create_labels=false,reverse_enabled=false where id='pdc'",[secret])
  const initial=await state(),aliases=(await f.db.query('select * from public.shipping_city_mappings order by id')).rows
  globalThis.useRuntimeConfig=()=>({...runtime,shippingLiveRequestsEnabled:enabled})
  globalThis.fetch=async(input,options)=>{
   const url=new URL(String(input));assert.equal(url.origin,'https://clientsapi.pdc-eg.com');assert.equal(options.method,'GET');assert.equal(options.body,undefined);requests.push(url.pathname)
   if(url.pathname.endsWith('/GetProducts'))return Response.json(productReply)
   assert.ok(url.pathname.endsWith('/GetCities'));await onCity();return Response.json(cityReply)
  }
  await t.test('operator and permission denials make zero provider requests',async()=>{
   enabled=false;assert.equal((await call('test')).status,503);enabled=true
   assert.equal((await call('test','viewer')).status,403);assert.equal(requests.length,0)
  })
  await t.test('test reports two services without writing caches or selecting a service',async()=>{
   const response=await call('test');assert.equal(response.status,200);assert.equal(response.body.product_count,2);assert.equal(requests.length,1)
   const current=await state();for(const key of ['product_id','origin_city_id','products_cache','cities_cache','access_token_encrypted','is_enabled','auto_create_labels','reverse_enabled'])assert.deepEqual(current[key],initial[key])
   assert.equal((await call('test')).status,429);assert.equal(requests.length,1)
  })
  await t.test('sync writes normalized caches together while preserving saved service and cities',async()=>{
   await reset();assert.equal((await call('sync')).status,200)
   const current=await state();assert.deepEqual(current.products_cache,expected);assert.equal(current.product_id,40);assert.equal(current.origin_city_id,1);assert.equal(current.access_token_encrypted,secret);assert.equal(current.is_enabled,false)
   assert.deepEqual((await f.db.query('select * from public.shipping_city_mappings order by id')).rows,aliases)
  })
  await t.test('a temporarily absent saved service survives sync',async()=>{
   productReply=[products[0]];await reset();assert.equal((await call('sync')).status,200);assert.equal((await state()).product_id,40)
  })
  await t.test('invalid products stop before cities and leave caches intact',async()=>{
   const before=await state(),count=requests.length;productReply=[products[0],products[0]];await reset();assert.equal((await call('sync')).status,502);assert.equal(requests.length,count+1);assert.deepEqual((await state()).products_cache,before.products_cache)
  })
  await t.test('invalid cities cannot partially save products',async()=>{
   productReply=products;cityReply=[{productID:1,productName:'Unconfirmed city alias'}];const before=await state();await reset();assert.equal((await call('sync')).status,502);assert.deepEqual((await state()).products_cache,before.products_cache)
  })
  await t.test('concurrent configuration change refuses the cache write',async()=>{
   cityReply=[{id:1,name:'Cairo'}];onCity=()=>f.db.query("update public.shipping_provider_settings set updated_at=clock_timestamp() where id='pdc'");await reset();assert.equal((await call('sync')).status,409)
  })
  assert.equal((await f.db.query('select count(*)::int n from public.shipping_order_jobs')).rows[0].n,0);assert.equal(f.storageCalls.length,0)
  const audits=JSON.stringify((await f.db.query("select metadata from public.admin_activity_logs where action_key like 'shipping.pdc.%'")).rows)
  for(const value of ['FICTIONAL-PDC-V6-TOKEN',secret,'123456'])assert.equal(audits.includes(value),false)
 }finally{globalThis.fetch=originalFetch;globalThis.useRuntimeConfig=originalRuntime;await server.close()}
})
