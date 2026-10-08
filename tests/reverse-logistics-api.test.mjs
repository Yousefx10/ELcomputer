import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClaimsHttpFixture } from './helpers/claimsHttpFixture.mjs'
import { attachReverseFixture, reverseFixtureRuntime } from './helpers/reverseFixture.mjs'

test('actual HTTP reverse staff/customer APIs, existing shipping worker and authenticated webhook use disposable SQL', async t => {
  const originalFetch=globalThis.fetch, originalRuntime=globalThis.useRuntimeConfig
  const f=await attachReverseFixture(await createClaimsHttpFixture({shipping:true})), requests=[]
  reverseFixtureRuntime.shippingWorkerSecret='reverse-fixture-worker-secret-over-32-characters'
  globalThis.useRuntimeConfig=()=>reverseFixtureRuntime
  const server=await f.start(), call=async(path,actor='owner',body=null)=>{
    const response=await originalFetch(server.url+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+actor,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()}
  }
  const body=async(claim,extra={})=>({revision:(await f.detail(claim,true)).claim.revision,idempotency_key:randomUUID(),...f.input(),...extra})
  const worker=async secret=>{const r=await originalFetch(server.url+'/api/internal/shipping/process',{method:'POST',headers:{'content-type':'application/json','x-shipping-worker-secret':secret},body:'{"limit":10}'});return{status:r.status,data:await r.json()}}
  let mockMode='success'
  globalThis.fetch=async(url,options)=>{
    if(!String(url).startsWith('https://clientsapi.pdc-eg.com/api/ClientUsers/V6/')) throw Error('Unexpected external request in fixture')
    const payload=JSON.parse(options.body);requests.push({url:String(url),payload,redirect:options.redirect})
    if(String(url).endsWith('SaveShipmentEx')) {
      if(mockMode==='timeout') throw Object.assign(Error('PRIVATE-PROVIDER-RESPONSE'),{name:'TimeoutError'})
      return new Response(JSON.stringify({generalResponse:{success:true},successResponses:[{success:true,ref:payload.shipments[0].toRef,awb:'FIXTURE-'+requests.length,errors:null}]}),{headers:{'content-type':'application/json'}})
    }
    if(String(url).endsWith('ExportPDF'))return new Response('%PDF-1.7\nFixture reverse label',{headers:{'content-type':'application/pdf'}})
    if(String(url).endsWith('GetShipmentsStatus'))return new Response(JSON.stringify([{Ref:payload.reFs,AWB:payload.awBs||'RECOVERED-HTTP',Status:'Picked Up',StatusID:12,StatusDate:new Date(Date.now()+1000).toISOString()}]),{headers:{'content-type':'application/json'}})
    throw Error('Unexpected provider operation')
  }
  try {
    const approved=await f.approve(), path='/api/admin-after-sales/claims/'+approved.id
    await t.test('dormant provider returns controlled failure without queue/AWB/status change; routes reject unauthenticated and unauthorized staff',async()=>{
      const input=await body(approved.id)
      assert.equal((await call(path+'/reverse','owner',input)).status,409);assert.equal((await f.view(approved.id)).jobs.length,0);assert.equal(requests.length,0)
      for(const actor of ['buyer','stranger','viewer','reviewer','manager','logisticsViewer'])assert.equal((await call(path+'/reverse',actor,input)).status,403)
      assert.equal((await call(path+'/reverse','missing')).status,401)
      assert.equal((await call('/api/account/after-sales/claims/'+approved.id+'/reverse','stranger')).status,404)
      assert.equal((await worker('invalid')).status,401);assert.equal(requests.length,0)
    })
    await f.configure()
    await t.test('approved booking validates pickup/mapping/fields, persists asynchronous intent and retries idempotently',async()=>{
      const input=await body(approved.id), before=await f.order(approved.item.order_id)
      assert.equal((await call(path+'/reverse','booker',{...input,pickup:{...input.pickup,phone:'123'}})).status,400)
      assert.equal((await call(path+'/reverse','booker',{...input,pickup:{...input.pickup,city_mapping_id:randomUUID()}})).status,409)
      assert.equal((await call(path+'/reverse','booker',{...input,awb:'FORGED'})).status,400)
      const first=await call(path+'/reverse','booker',input),again=await call(path+'/reverse','booker',input)
      assert.equal(first.status,200);assert.equal(again.status,200);assert.equal(first.data.id,again.data.id);assert.equal(requests.length,0);assert.equal((await f.detail(approved.id)).claim.status,'approved')
      assert.deepEqual(await f.order(approved.item.order_id),before)
      assert.equal((await worker(reverseFixtureRuntime.shippingWorkerSecret)).status,200);assert.equal(requests.length,1);assert.equal(requests[0].redirect,'error');assert.equal(requests[0].payload.shipments[0].shipmentTypeID,3)
      assert.equal((await f.detail(approved.id)).claim.status,'pickup_scheduled');assert.equal((await worker(reverseFixtureRuntime.shippingWorkerSecret)).status,200);assert.equal(requests.length,1)
      const own=await call('/api/account/after-sales/claims/'+approved.id+'/reverse','buyer');assert.equal(own.status,200);assert.equal(own.data.jobs[0].awb,'FIXTURE-1')
      const encoded=JSON.stringify(own.data);for(const privateField of ['access_token','settings_fingerprint','shipment_payload','confirmation_reason":"Confirmed','Fixture store destination','PRIVATE-PROVIDER'])assert.ok(!encoded.includes(privateField),privateField)
      assert.equal((await call(path+'/reverse','viewer')).data.jobs[0].pickup,null)
    })
    await t.test('existing webhook secret, REF/AWB validation and canonical transitions remain enforced',async()=>{
      const job=(await f.view(approved.id,true)).jobs[0], payload={AWB:job.awb,REF:job.to_ref,StatusID:12,CustomerStatusName:'Picked Up',ReasonName:'PRIVATE-PROVIDER-REASON',StatusDate:new Date(Date.now()+1000).toISOString()}
      const webhook=async(body,secret='reverse-fixture-webhook-secret-minimum-32-characters')=>{const r=await originalFetch(server.url+'/api/webhooks/pdc',{method:'POST',headers:{'content-type':'application/json','x-webhook-secret':secret},body:JSON.stringify(body)});return{status:r.status,data:await r.json()}}
      assert.equal((await webhook(payload,'wrong')).status,401);assert.equal((await webhook({...payload,AWB:'WRONG'})).status,409);assert.equal((await webhook(payload)).status,200)
      assert.equal((await f.detail(approved.id)).claim.status,'in_transit');const count=(await f.detail(approved.id)).events.length;assert.equal((await webhook(payload)).status,200);assert.equal((await f.detail(approved.id)).events.length,count)
      const privateProjection=JSON.stringify((await call('/api/account/after-sales/claims/'+approved.id+'/reverse','buyer')).data);assert.ok(!privateProjection.includes('PRIVATE-PROVIDER-REASON'))
      assert.ok(JSON.stringify((await call(path+'/reverse','diagnostician')).data).includes('PRIVATE-PROVIDER-REASON'));assert.ok(!JSON.stringify((await call(path+'/reverse','logisticsViewer')).data).includes('PRIVATE-PROVIDER-REASON'))
      assert.equal((await webhook({...payload,StatusID:5,StatusDate:new Date(Date.now()+5000).toISOString()})).status,200);assert.equal((await f.detail(approved.id)).claim.status,'received')
    })
    await t.test('staff label preparation is asynchronous, private and does not recreate the shipment',async()=>{
      const job=(await f.view(approved.id,true)).jobs[0], before=requests.filter(x=>x.url.endsWith('SaveShipmentEx')).length
      assert.equal((await call(path+'/reverse-actions','viewer',{job_id:job.id,action:'label'})).status,403)
      assert.equal((await call(path+'/reverse-actions','booker',{job_id:job.id,action:'label'})).status,200)
      assert.equal((await worker(reverseFixtureRuntime.shippingWorkerSecret)).status,200)
      const r=await originalFetch(server.url+path+'/reverse-label?job_id='+job.id,{headers:{authorization:'Bearer logisticsViewer'}});assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/pdf/);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.ok((await r.text()).startsWith('%PDF-'))
      assert.equal((await call(path+'/reverse-label?job_id='+job.id,'viewer')).status,403);assert.equal(requests.filter(x=>x.url.endsWith('SaveShipmentEx')).length,before)
      assert.equal((await call('/api/account/after-sales/claims/'+approved.id+'/reverse-label?job_id='+job.id,'buyer')).status,404)
    })
    await t.test('uncertain booking exposes recovery only to permitted staff, with stable REF and no duplicate shipment create',async()=>{
      const claim=await f.approve('warranty'), prefix='/api/admin-after-sales/claims/'+claim.id;mockMode='timeout'
      const booked=await call(prefix+'/reverse','owner',await body(claim.id,{handling_resolution:'repair'}));assert.equal(booked.status,200);await worker(reverseFixtureRuntime.shippingWorkerSecret)
      assert.equal((await f.job(booked.data.id)).state,'uncertain');const creates=requests.filter(x=>x.url.endsWith('SaveShipmentEx')).length
      assert.equal((await call(prefix+'/reverse-actions','booker',{job_id:booked.data.id,action:'recover'})).status,403)
      assert.equal((await call(prefix+'/reverse-actions','rebooker',{job_id:booked.data.id,action:'recover'})).status,200)
      assert.equal(requests.at(-1).payload.reFs,booked.data.to_ref);assert.equal(requests.at(-1).payload.awBs,'');assert.equal((await f.detail(claim.id)).claim.status,'in_transit');assert.equal(requests.filter(x=>x.url.endsWith('SaveShipmentEx')).length,creates)
      assert.equal((await call(prefix+'/reverse-actions','rebooker',{job_id:booked.data.id,action:'refresh'})).status,409)
    })
  } finally { globalThis.fetch=originalFetch;globalThis.useRuntimeConfig=originalRuntime; await server.close() }
})
