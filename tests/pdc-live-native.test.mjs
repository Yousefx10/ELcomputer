import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, stat, writeFile, symlink, unlink, chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { createPrivatePackingFixture } from './helpers/privatePackingFixture.mjs'
import { emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'
import { encryptShippingSecret } from '../server/utils/shippingSecrets.js'
import { operatePdcOrder, processPdcOrderJob, processPdcOutboundQueue } from '../server/utils/pdcOrderShipping.js'
import { getPdcSettings } from '../server/utils/pdcShipping.js'
import { saveShippingDocument, readShippingDocument, getShippingDocumentsRoot, MAX_SHIPPING_DOCUMENT_BYTES } from '../server/utils/privateShippingDocuments.js'

test('PDC selected-courier dispatch, uncertain recovery and private persistent PDFs', {skip:!emailNativeAvailable, timeout:180000}, async t=>{
  const f=await createPrivatePackingFixture({extraRoutes:[
    ['get','/api/admin-shipping/orders/:id/label','../../admin-shipping/orders/[id]/label.get.js'],
    ['post','/api/admin-shipping/orders/:id/booking','../../admin-shipping/orders/[id]/booking.post.js']
  ]}), previous=globalThis.useRuntimeConfig
  Object.assign(f.config,{shippingLiveRequestsEnabled:true,shippingDocumentsDir:join(f.directory,'private-documents'),shippingCredentialsEncryptionKey:'owned-isolated-shipping-key-over-32-characters'})
  globalThis.useRuntimeConfig=()=>f.config
  const requests=[], pdf=Buffer.from('%PDF-1.7\nOwned synthetic shipping document\n%%EOF'), rpc=async(name,args)=>{
    const r=await f.client.rpc(name,args);if(r.error)throw Error(r.error.message);return r.data
  }
  let mode='success', pdfFailure=false, delay=false, lookupMode='matched'
  const fetcher=async(url,options)=>{
    assert.match(url,/^https:\/\/clientsapi\.pdc-eg\.com\/api\/ClientUsers\/V6\//);assert.equal(options.redirect,'error')
    const body=JSON.parse(options.body);requests.push({url,body})
    if(delay)await new Promise(r=>setTimeout(r,30))
    if(url.endsWith('SaveShipmentEx')){
      if(mode==='timeout')throw Error('Isolated ambiguous network acknowledgement')
      if(mode==='mismatch')return Response.json({generalResponse:{success:true},successResponses:[{success:true,ref:'wrong-ref',awb:'WRONG'}]})
      return Response.json({generalResponse:{success:true},successResponses:[{success:true,ref:body.shipments[0].toRef,awb:'OWNED-'+requests.length}]})
    }
    if(url.endsWith('ExportPDF'))return new Response(pdfFailure?'unavailable':pdf,{status:pdfFailure?503:200,headers:{'content-type':'application/pdf'}})
    if(url.endsWith('GetShipmentsStatus')){
      const row={Ref:lookupMode==='wrong-ref'?'wrong':body.reFs,AWB:'RECOVERED-'+requests.length}
      return Response.json(lookupMode==='missing'?[]:lookupMode==='duplicate'?[row,row]:[row])
    }
    throw Error('Unexpected fixture operation')
  }
  const posts=()=>requests.filter(r=>r.url.endsWith('SaveShipmentEx')).length
  const operate=(orderId,action='book',adminId=f.actors.owner)=>operatePdcOrder({db:f.client,adminId,orderId,action,runtime:f.config,fetcher})
  const row=async order=>(await f.db.query('select * from public.shipping_order_jobs where order_id=$1',[order])).rows[0]
  try{
    const path=join(f.directory,'synthetic.webm')
    await promisify(execFile)('ffmpeg',['-v','error','-f','lavfi','-i','color=c=blue:size=64x64:rate=10','-t','6','-an','-c:v','libvpx',path],{timeout:15000})
    const video=await readFile(path)
    await f.db.query("update public.shipping_provider_settings set is_enabled=true,cod_enabled=true,auto_create_labels=false,company_id='123',product_id=64,origin_city_id=1,origin_address='Owned pickup street',origin_phone='01000000000',origin_contact_name='Owned pickup',cities_cache='[{\"id\":1,\"name\":\"Origin\"},{\"id\":2,\"name\":\"Destination\"}]',products_cache='[{\"id\":64,\"name\":\"Owned product\"}]',access_token_encrypted=$1,webhook_secret_encrypted=$2 where id='pdc'",[encryptShippingSecret('OWNED-TOKEN'),encryptShippingSecret('owned-independent-webhook-secret-over-32-characters')])
    await f.db.query("delete from public.shipping_city_mappings")
    await f.db.query("insert into public.shipping_city_mappings(provider,governorate,city,provider_city_id) values('pdc','Cairo','Fixture city',2)")
    await f.db.query("update public.commerce_shipping_companies set provider='pdc'")
    const packed=async(options={})=>{
      const pack=await f.newPack(1,'editor',options);await f.scan(pack)
      const started=Date.now()-1000
      const prepared=await f.call(pack.path+'/video-upload',{method:'POST',body:{mimeType:'video/webm',sizeBytes:video.length,recordingStartedAt:new Date(started).toISOString(),recordingEndedAt:new Date(started+6000).toISOString()}})
      assert.equal(prepared.response.status,200,JSON.stringify(prepared.body))
      const uploaded=await f.call(prepared.body.upload.url,{method:'PUT',body:video,raw:true,headers:{'content-type':'video/webm'}});assert.equal(uploaded.response.status,200,JSON.stringify(uploaded.body))
      const done=await f.call(pack.path+'/complete',{method:'POST',body:{}});assert.equal(done.response.status,200,JSON.stringify(done.body))
      await f.call('/api/admin-orders/packing/work-session',{method:'POST',body:{action:'close'}})
      return pack.order
    }
    let ready
    await t.test('manual booking works with automation off; exact COD total and selected city are server snapshots',async()=>{
      ready=await packed();const before=posts()
      assert.equal((await processPdcOutboundQueue({supabaseAdmin:f.client,runtime:f.config,fetcher})).active,false)
      delay=true;await Promise.all(Array.from({length:6},()=>operate(ready)));delay=false
      assert.equal(posts(),before+1)
      const sent=requests.find(r=>r.url.endsWith('SaveShipmentEx')).body.shipments[0]
      assert.equal(sent.cod,107);assert.equal(sent.toCityID,2);assert.equal(sent.shipmentTypeID,1)
      const job=await row(ready);assert.equal(job.state,'ready');assert.match(job.label_storage_path,/^vps-v1\/orders\//)
      assert.deepEqual(await readShippingDocument({path:job.label_storage_path,sha256:job.label_sha256,size_bytes:job.label_size_bytes}),pdf)
      assert.equal((await stat(join(f.config.shippingDocumentsDir,job.label_storage_path))).mode&0o777,0o600)
      assert.equal((await f.db.query('select payment_status,amount_paid from public.customer_orders where id=$1',[ready])).rows[0].payment_status,'pending')
      await operate(ready);assert.equal(posts(),before+1);assert.equal(f.controls.storageCalls,0)
    })
    await t.test('staff label and booking endpoints enforce existing RBAC and order binding',async()=>{
      const base='/api/admin-shipping/orders/'+ready
      for(const actor of [null,'invalid','customer','viewer','disabled']){
        const expected=!actor||actor==='invalid'?401:403
        assert.equal((await f.call(base+'/label',{actor})).response.status,expected)
        assert.equal((await f.call(base+'/booking',{actor,method:'POST',body:{action:'book'}})).response.status,expected)
      }
      const r=await f.call(base+'/label',{actor:'owner'});assert.equal(r.response.status,200);assert.deepEqual(r.body,pdf)
      assert.equal(r.response.headers.get('cache-control'),'private, no-store');assert.match(r.response.headers.get('content-disposition'),/^attachment/)
      assert.equal((await f.call('/api/admin-shipping/orders/'+randomUUID()+'/label',{actor:'owner'})).response.status,404)
      assert.equal((await f.call(base+'/booking',{actor:'owner',method:'POST',body:{action:'book',cod:1}})).response.status,400)
      await assert.rejects(()=>operate(ready,'book',f.actors.viewer))
    })
    await t.test('actual authorized booking HTTP handler persists one shipment and replays without provider duplication',async()=>{
      const id=await packed(),before=posts(),original=globalThis.fetch
      globalThis.fetch=(url,options)=>String(url).startsWith(f.url+'/')?original(url,options):fetcher(String(url),options)
      try{
        const path='/api/admin-shipping/orders/'+id+'/booking'
        const result=await f.call(path,{actor:'owner',method:'POST',body:{action:'book'}})
        assert.equal(result.response.status,200,JSON.stringify(result.body));assert.equal(result.body.state,'ready')
        assert.equal((await f.call(path,{actor:'owner',method:'POST',body:{action:'book'}})).response.status,200)
        assert.equal(posts(),before+1);assert.equal((await row(id)).state,'ready')
      }finally{globalThis.fetch=original}
    })
    await t.test('unpacked orders, disabled COD, manual couriers, uncovered and ambiguous destinations never book',async()=>{
      const pack=await f.newPack(1), before=posts();await assert.rejects(()=>operate(pack.order));await f.call(pack.path+'/release',{method:'POST',body:{}});await f.call('/api/admin-orders/packing/work-session',{method:'POST',body:{action:'close'}})
      const id=await packed()
      for(const [change,undo] of [["update public.shipping_provider_settings set cod_enabled=false","update public.shipping_provider_settings set cod_enabled=true"],["update public.commerce_shipping_companies set provider='manual'","update public.commerce_shipping_companies set provider='pdc'"],["update public.commerce_shipping_companies set checkout_governorates=array['Giza']","update public.commerce_shipping_companies set checkout_governorates=array['Cairo']"],["update public.shipping_provider_settings set cities_cache='[]'","update public.shipping_provider_settings set cities_cache='[{\"id\":1},{\"id\":2}]'"],["update public.shipping_provider_settings set origin_phone=null","update public.shipping_provider_settings set origin_phone='01000000000'"]]){
        await f.db.query(change);await assert.rejects(()=>operate(id));await f.db.query(undo)
      }
      await f.db.query("insert into public.shipping_city_mappings(provider,governorate,city,city_arabic,provider_city_id) values('pdc','Cairo','Other city','Fixture city',3)")
      await assert.rejects(()=>operate(id));assert.equal(posts(),before)
      await f.db.query("delete from public.shipping_city_mappings where city='Other city'")
      f.config.shippingLiveRequestsEnabled=false;await assert.rejects(()=>operate(id));f.config.shippingLiveRequestsEnabled=true;assert.equal(posts(),before)
      await assert.rejects(()=>operate(id,'book',f.actors.viewer))
    })
    await t.test('checkout itself rejects disabled PDC COD or unknown destination before order/stock creation',async()=>{
      const before=(await f.db.query('select count(*)::int n from public.customer_orders')).rows[0].n
      await f.db.query('update public.shipping_provider_settings set cod_enabled=false')
      await assert.rejects(()=>f.newPack(1),/courier is unavailable/)
      await f.db.query('update public.shipping_provider_settings set cod_enabled=true')
      await f.db.query("update public.shipping_city_mappings set city='Not the order destination'")
      await assert.rejects(()=>f.newPack(1),/destination is unavailable/)
      await f.db.query("update public.shipping_city_mappings set city='Fixture city'")
      assert.equal((await f.db.query('select count(*)::int n from public.customer_orders')).rows[0].n,before)
    })
    await t.test('timeout is durable uncertainty; repeat requests do not rebook; REF lookup recovers only labels',async()=>{
      const id=await packed(), before=posts();mode='timeout';await operate(id);mode='success'
      assert.equal((await row(id)).state,'uncertain')
      await Promise.all([operate(id),operate(id)]);assert.equal(posts(),before+1)
      await assert.rejects(()=>f.db.query("update public.customer_orders set city='Changed' where id=$1",[id]),/Reconcile/)
      for(const outcome of ['missing','wrong-ref','duplicate']){lookupMode=outcome;await assert.rejects(()=>operate(id,'recover'));assert.equal((await row(id)).state,'uncertain');assert.equal(posts(),before+1)}
      lookupMode='matched'
      await operate(id,'recover');assert.equal(posts(),before+1);assert.equal((await row(id)).state,'ready')
      assert.equal((await f.db.query('select count(*)::int n from private.pdc_dispatches where order_id=$1',[id])).rows[0].n,1)
    })
    await t.test('a mismatched provider reference never binds an AWB or authorizes another booking POST',async()=>{
      const id=await packed(),before=posts();mode='mismatch';await operate(id);mode='success'
      const job=await row(id);assert.equal(job.state,'uncertain');assert.equal(job.awb,null)
      await operate(id);assert.equal(posts(),before+1)
    })
    await t.test('lost successful SQL acknowledgement cannot repeat a booking; stale tokens cannot replace recovered evidence',async()=>{
      const id=await packed(), original=f.client.rpc, before=posts();let token
      f.client.rpc=async(name,args)=>{
        if(name==='shipping_order_finish'&&args.p_state==='created'){token=args.p_token;return{error:{code:'08006',message:'Isolated lost commit'}}}
        return original(name,args)
      }
      await operate(id);f.client.rpc=original
      await operate(id);assert.equal(posts(),before+1)
      await operate(id,'recover');assert.equal(posts(),before+1)
      const job=await row(id);await assert.rejects(()=>rpc('shipping_order_finish',{p_job:job.id,p_token:token,p_state:'created',p_awb:'STALE'}),/lease changed/)
    })
    await t.test('label failure retries PDF only, and label action never creates an unbooked shipment',async()=>{
      const id=await packed(),before=posts();await assert.rejects(()=>operate(id,'label'));assert.equal(posts(),before)
      pdfFailure=true;await operate(id);pdfFailure=false;assert.equal((await row(id)).state,'label_pending')
      await operate(id,'label');assert.equal((await row(id)).state,'ready');assert.equal(posts(),before+1)
    })
    await t.test('paid live card ships with zero collection, while changed actor/configuration cannot dispatch queued work',async()=>{
      await f.db.query('update public.site_settings set payment_card_enabled=true,payment_card_fee=0')
      const id=await packed({paymentMethod:'card',beforePack:async orderId=>{
        const claim=await rpc('commerce_claim_payment_attempt',{p_order_id:orderId,p_user_id:f.actors.customer,p_mode:'live',p_integration_id:12345})
        const providerOrder=String(Date.now())
        await rpc('commerce_store_payment_intention',{p_attempt_id:claim.attempt.id,p_intention_id:'pi_live_'+randomUUID(),p_provider_order_id:providerOrder,p_client_secret:'egy_csk_live_owned_fixture'})
        await rpc('commerce_reconcile_payment_transaction',{p_transaction:{provider_order_id:providerOrder,transaction_id:providerOrder,mode:'live',integration_id:12345,amount_minor:10700,currency:'EGP',status:'succeeded'}})
      }})
      const before=posts();await operate(id);assert.equal(posts(),before+1)
      assert.equal(requests.filter(r=>r.url.endsWith('SaveShipmentEx')).at(-1).body.shipments[0].cod,0)
      const other=await packed(),job=await rpc('shipping_order_prepare',{p_admin:f.actors.editor,p_order:other}),settings=await getPdcSettings(f.client)
      await f.db.query('update public.admin_users set is_active=false where id=$1',[f.actors.editor])
      await assert.rejects(()=>processPdcOrderJob({supabaseAdmin:f.client,jobId:job.id,settings,runtime:f.config,fetcher}))
      await f.db.query('update public.admin_users set is_active=true where id=$1',[f.actors.editor])
      await f.db.query("update public.shipping_provider_settings set origin_address='Changed after claim'")
      await assert.rejects(()=>processPdcOrderJob({supabaseAdmin:f.client,jobId:job.id,settings,runtime:f.config,fetcher}))
      await f.db.query("update public.shipping_provider_settings set origin_address='Owned pickup street'")
      assert.equal(posts(),before+1)
    })
    await t.test('private PDF validation rejects invalid roots, traversal, oversized bytes, symlinks and tampering',async()=>{
      const key='vps-v1/orders/'+randomUUID()+'/'+randomUUID()+'.pdf',root=f.config.shippingDocumentsDir
      for(const bad of ['',process.cwd(),f.config.uploadsDir,'relative']){f.config.shippingDocumentsDir=bad;await assert.rejects(()=>getShippingDocumentsRoot({create:true}))};f.config.shippingDocumentsDir=root
      await assert.rejects(()=>saveShippingDocument('../public/file.pdf',pdf));await assert.rejects(()=>saveShippingDocument(key,Buffer.from('not pdf')))
      await assert.rejects(()=>saveShippingDocument(key,Buffer.alloc(MAX_SHIPPING_DOCUMENT_BYTES+1)))
      const saved=await saveShippingDocument(key,pdf);assert.deepEqual(await saveShippingDocument(key,Buffer.from('%PDF-new-generation')),saved)
      const path=join(root,key);await writeFile(path,'%PDF-tampered');await assert.rejects(()=>readShippingDocument(saved))
      await unlink(path);await symlink(join(f.directory,'synthetic.webm'),path);await assert.rejects(()=>readShippingDocument(saved));await unlink(path)
      await saveShippingDocument(key,pdf);await chmod(path,0o644);await assert.rejects(()=>readShippingDocument(saved))
    })
    await t.test('canonical RPCs and retained dispatch evidence cannot be written by browser/service transports',async()=>{
      for(const role of ['anon','authenticated'])assert.equal((await f.db.query("select has_function_privilege($1,'public.shipping_order_take(uuid,boolean,jsonb)','execute') allowed",[role])).rows[0].allowed,false)
      assert.equal((await f.db.query("select has_table_privilege('service_role','public.shipping_order_jobs','update') allowed")).rows[0].allowed,false)
      assert.equal((await f.db.query("select has_table_privilege('service_role','private.pdc_dispatches','delete') allowed")).rows[0].allowed,false)
      assert.equal(f.controls.storageCalls,0)
      const before=posts()
      await f.db.query('delete from public.shipping_order_jobs where order_id=$1',[ready])
      await assert.rejects(()=>operate(ready),/saved booking/)
      assert.equal(posts(),before)
      assert.equal((await f.db.query('select count(*)::int n from private.pdc_dispatches where order_id=$1',[ready])).rows[0].n,1)
    })
  }finally{globalThis.useRuntimeConfig=previous;await f.close()}
})
