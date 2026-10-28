import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {join,resolve} from 'node:path'
import {createPrivatePackingFixture} from './helpers/privatePackingFixture.mjs'
import {emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'
import {encryptShippingSecret} from '../server/utils/shippingSecrets.js'
import {operatePdcOrder,processPdcOutboundQueue} from '../server/utils/pdcOrderShipping.js'
import {requirePdcReadAccess} from '../server/utils/pdcLookups.js'
import {processPdcReverseQueue} from '../server/utils/pdcReverseLogistics.js'

test('staff-approved Manual COD uses existing PDC Dashboard dispatch without prepaid or invented stock',{skip:!emailNativeAvailable},async t=>{
 const f=await createPrivatePackingFixture({extraRoutes:[
  ['get','/api/admin-orders/:id',resolve('server/api/admin-orders/[id].get.js')],
  ['patch','/api/admin-orders/:id',resolve('server/api/admin-orders/[id].patch.js')],
  ['post','/api/admin-shipping/orders/:id/booking',resolve('server/api/admin-shipping/orders/[id]/booking.post.js')],
  ['post','/api/admin-orders/:id/cod-cash',resolve('server/api/admin-orders/[id]/cod-cash.post.js')]
 ]})
 const previous=globalThis.useRuntimeConfig;globalThis.useRuntimeConfig=()=>f.config
 Object.assign(f.config,{shippingLiveRequestsEnabled:true,shippingDocumentsDir:join(f.directory,'private-documents'),shippingCredentialsEncryptionKey:'owned-isolated-shipping-key-over-32-characters'})
 const sent=[];let lost=false
 const fetcher=async(url,options)=>{
  const body=JSON.parse(options.body);sent.push({url:String(url),body});assert.equal(options.redirect,'error')
  if(String(url).endsWith('/SaveShipmentEx')){
   if(lost)throw Error('Owned ambiguous provider transport')
   return Response.json({generalResponse:{success:true},successResponses:[{success:true,ref:body.shipments[0].toRef,awb:'SYNTHETIC-'+sent.length}]})
  }
  if(String(url).endsWith('/ExportPDF'))return new Response('%PDF-1.7\nOwned synthetic label\n%%EOF',{headers:{'content-type':'application/pdf'}})
  throw Error('Unexpected synthetic provider request')
 }
 const posts=()=>sent.filter(x=>x.url.endsWith('/SaveShipmentEx')).length
 const order=async id=>(await f.db.query('select * from public.customer_orders where id=$1',[id])).rows[0]
 try{
  await f.db.query("update public.site_settings set inventory_tracking_required=false,payment_cash_fee=50,backorder_fulfillment_message='Delivery timing depends on your address.',backorder_fulfillment_message_ar='تختلف مدة التوصيل حسب العنوان.' where key='default'")
  await f.db.query("update public.commerce_shipping_companies set client_shipping_price=50,cod_collection_provider='pdc'")
  await f.db.query("update public.shipping_provider_settings set is_enabled=true,cod_enabled=true,auto_create_labels=false,company_id='123',product_id=64,origin_city_id=1,origin_address='Owned pickup street',origin_phone='01000000000',origin_contact_name='Owned pickup',cities_cache='[{\"id\":1},{\"id\":2}]',products_cache='[{\"id\":64}]',access_token_encrypted=$1,webhook_secret_encrypted=$2 where id='pdc'",[encryptShippingSecret('OWNED-TOKEN'),encryptShippingSecret('owned-independent-webhook-secret-over-32-characters')])
  await f.db.query('delete from public.shipping_city_mappings')
  await f.db.query("insert into public.shipping_city_mappings(provider,governorate,city,provider_city_id) values('pdc','Cairo','Fixture city',2)")
  const videoPath=join(f.directory,'owned.webm')
  await promisify(execFile)('ffmpeg',['-v','error','-f','lavfi','-i','color=c=blue:size=64x64:rate=10','-t','6','-an','-c:v','libvpx',videoPath])
  const bytes=await readFile(videoPath)
  const packed=async()=>{
   const pack=await f.newPack(1,'editor',{beforePack:async id=>{
    const approved=await f.call('/api/admin-orders/'+id,{actor:'owner',method:'PATCH',body:{status:'processing'}})
    assert.equal(approved.response.status,200,JSON.stringify(approved.body))
   }})
   const code=(await f.db.query('select variant_code from public.customer_order_items where order_id=$1',[pack.order])).rows[0].variant_code
   if(pack.units.length)await f.scan(pack)
   else assert.equal((await f.call(pack.path+'/scan',{method:'POST',body:{code}})).response.status,200)
   const started=Date.now()-1000,upload=await f.call(pack.path+'/video-upload',{method:'POST',body:{mimeType:'video/webm',sizeBytes:bytes.length,recordingStartedAt:new Date(started).toISOString(),recordingEndedAt:new Date(started+6000).toISOString()}})
   assert.equal(upload.response.status,200,JSON.stringify(upload.body))
   assert.equal((await f.call(upload.body.upload.url,{method:'PUT',body:bytes,raw:true,headers:{'Content-Type':'video/webm'}})).response.status,200)
   assert.equal((await f.call(pack.path+'/video-complete',{method:'POST',body:{}})).response.status,200)
   assert.equal((await f.call(pack.path+'/complete',{method:'POST',body:{}})).response.status,200)
   await f.call('/api/admin-orders/packing/work-session',{method:'POST',body:{action:'close'}})
   return pack.order
  }
  const ready=await packed(),before=await order(ready)
  await t.test('approved and packed order remains unpaid, untracked, with immutable total and available Dashboard PDC action',async()=>{
   assert.equal(before.status,'ready_to_deliver');assert.equal(before.payment_status,'pending');assert.equal(Number(before.amount_paid),0)
   assert.equal(before.stock_fulfillment_state,'untracked');assert.equal(Number(before.total_amount),200)
   assert.equal((await f.db.query('select count(*)::int n from public.commerce_serialized_units where customer_order_id=$1',[ready])).rows[0].n,0)
   const detail=await f.call('/api/admin-orders/'+ready,{actor:'owner'});assert.equal(detail.response.status,200,JSON.stringify(detail.body))
   assert.deepEqual(detail.body.shipping,{provider:'pdc',state:'not_booked',awb:null,label_ready:false,events:[]})
   const mode=await processPdcOutboundQueue({supabaseAdmin:f.client,runtime:f.config,fetcher});assert.equal(mode.active,false);assert.equal(sent.length,0)
  })
  await t.test('only authorized staff can request a shipment; browser COD amounts are rejected',async()=>{
   for(const actor of [null,'invalid','customer','viewer','disabled']){
    const response=await f.call('/api/admin-shipping/orders/'+ready+'/booking',{actor,method:'POST',body:{action:'book'}})
    assert.equal(response.response.status,!actor||actor==='invalid'?401:403)
   }
   assert.equal((await f.call('/api/admin-shipping/orders/'+ready+'/booking',{actor:'owner',method:'POST',body:{action:'book',cod:1}})).response.status,400)
   assert.equal(sent.length,0)
  })
  await t.test('PDC fulfillment is explicit; other stores keep employee collection by default',async()=>{
   const unused=(await f.db.query("insert into public.commerce_shipping_companies(name,provider) values('Independent manual collection','manual') returning id,cod_collection_provider")).rows[0]
   assert.equal(unused.cod_collection_provider,'manual')
   const id=before.shipping_company_id
   await f.db.query("update public.commerce_shipping_companies set cod_collection_provider='manual' where id=$1",[id])
   const detail=await f.call('/api/admin-orders/'+ready,{actor:'owner'});assert.equal(detail.body.shipping,null)
   await assert.rejects(operatePdcOrder({db:f.client,adminId:f.actors.owner,orderId:ready,action:'book',runtime:f.config,fetcher}))
   assert.equal(posts(),0)
   await f.db.query("update public.commerce_shipping_companies set cod_collection_provider='pdc' where id=$1",[id])
   await f.db.query('delete from public.commerce_shipping_companies where id=$1',[unused.id])
  })
  await t.test('actual Dashboard request creates one exact full-total COD shipment without charging or repricing',async()=>{
   const original=globalThis.fetch
   globalThis.fetch=(url,options)=>String(url).startsWith(f.url+'/')?original(url,options):fetcher(url,options)
   try{
    const path='/api/admin-shipping/orders/'+ready+'/booking'
    const response=await f.call(path,{actor:'owner',method:'POST',body:{action:'book'}})
    assert.equal(response.response.status,200,JSON.stringify(response.body));assert.equal(response.body.state,'ready')
    assert.equal((await f.call(path,{actor:'owner',method:'POST',body:{action:'book'}})).response.status,200)
   }finally{globalThis.fetch=original}
   assert.equal(posts(),1);const shipment=sent.find(x=>x.url.endsWith('/SaveShipmentEx')).body.shipments[0]
   assert.equal(shipment.cod,200);assert.equal(shipment.toCityID,2);assert.equal(shipment.toRef,'ORD-'+ready)
   const after=await order(ready)
   for(const key of ['shipping_company_id','shipping_fee_amount','payment_method','payment_fee_amount','total_amount','amount_paid','payment_status','stock_fulfillment_state'])assert.equal(after[key],before[key],key)
   assert.equal((await f.db.query('select count(*)::int n from public.payment_attempts')).rows[0].n,0)
   assert.equal((await f.db.query('select count(*)::int n from public.order_cod_collections')).rows[0].n,0)
   assert.equal((await f.db.query('select count(*)::int n from public.order_cod_reconciliations')).rows[0].n,0)
  })
  await t.test('missing capability, uncovered or ambiguous city, missing packing and disabled runtime never dispatch',async()=>{
   const fresh=await packed(),count=posts()
   for(const [change,undo] of [["update public.shipping_provider_settings set cod_enabled=false","update public.shipping_provider_settings set cod_enabled=true"],["update public.commerce_shipping_companies set cod_collection_enabled=false","update public.commerce_shipping_companies set cod_collection_enabled=true"],["update public.commerce_shipping_companies set checkout_governorates=array['Giza']","update public.commerce_shipping_companies set checkout_governorates=array['Cairo']"],["update public.order_packing_videos set status='failed'","update public.order_packing_videos set status='ready'"]]){
    await f.db.query(change);await assert.rejects(operatePdcOrder({db:f.client,adminId:f.actors.owner,orderId:fresh,action:'book',runtime:f.config,fetcher}));await f.db.query(undo)
   }
   f.config.shippingLiveRequestsEnabled=false;await assert.rejects(operatePdcOrder({db:f.client,adminId:f.actors.owner,orderId:fresh,action:'book',runtime:f.config,fetcher}));f.config.shippingLiveRequestsEnabled=true
   await f.db.query("insert into public.shipping_city_mappings(provider,governorate,city,city_arabic,provider_city_id) values('pdc','Cairo','Other city','Fixture city',3)")
   await assert.rejects(operatePdcOrder({db:f.client,adminId:f.actors.owner,orderId:fresh,action:'book',runtime:f.config,fetcher}))
   await f.db.query("delete from public.shipping_city_mappings where city='Other city'")
   const unpacked=await f.newPack(1)
   await assert.rejects(operatePdcOrder({db:f.client,adminId:f.actors.owner,orderId:unpacked.order,action:'book',runtime:f.config,fetcher}))
   await f.call(unpacked.path+'/release',{method:'POST',body:{}});await f.call('/api/admin-orders/packing/work-session',{method:'POST',body:{action:'close'}})
   assert.equal(posts(),count)
  })
  await t.test('PDC collection validates the offline destination and capability before accepting new COD orders',async()=>{
   const total=(await f.db.query('select count(*)::int n from public.customer_orders')).rows[0].n,count=posts()
   await f.db.query('update public.shipping_provider_settings set cod_enabled=false')
   await assert.rejects(f.newPack(1),/Selected courier is unavailable/)
   await f.db.query('update public.shipping_provider_settings set cod_enabled=true')
   await f.db.query("update public.shipping_city_mappings set city='Unmatched city'")
   await assert.rejects(f.newPack(1),/Selected courier destination is unavailable/)
   await f.db.query("update public.shipping_city_mappings set city='Fixture city'")
   assert.equal((await f.db.query('select count(*)::int n from public.customer_orders')).rows[0].n,total)
   assert.equal(posts(),count)
  })
  await t.test('ambiguous booking is retained once and cannot become a second provider POST',async()=>{
   const fresh=await packed(),count=posts();lost=true
   const response=await operatePdcOrder({db:f.client,adminId:f.actors.owner,orderId:fresh,action:'book',runtime:f.config,fetcher});lost=false
   assert.equal(response.state,'uncertain')
   await operatePdcOrder({db:f.client,adminId:f.actors.owner,orderId:fresh,action:'book',runtime:f.config,fetcher});assert.equal(posts(),count+1)
   assert.equal((await f.db.query('select count(*)::int n from private.pdc_dispatches where order_id=$1',[fresh])).rows[0].n,1)
   assert.equal((await order(fresh)).payment_status,'pending')
  })
  await t.test('tracked COD retains real serial allocation',async()=>{
   await f.db.query("update public.site_settings set inventory_tracking_required=true where key='default'")
   const tracked=await packed(),snapshot=await order(tracked),count=posts()
   assert.equal(snapshot.stock_fulfillment_state,'ready')
   assert.equal((await f.db.query('select count(*)::int n from public.commerce_serialized_units where customer_order_id=$1',[tracked])).rows[0].n,1)
   assert.equal((await operatePdcOrder({db:f.client,adminId:f.actors.owner,orderId:tracked,action:'book',runtime:f.config,fetcher})).state,'ready');assert.equal(posts(),count+1)
   await f.db.query("update public.site_settings set inventory_tracking_required=false where key='default'")
  })
  await t.test('PDC collection proof pays customer balance; separate full remittance alone reaches Treasury',async()=>{
   const changed=await f.call('/api/admin-orders/'+ready,{actor:'owner',method:'PATCH',body:{status:'delivered'}});assert.equal(changed.response.status,200,JSON.stringify(changed.body))
   assert.equal((await order(ready)).payment_status,'pending')
   const receiptDate=(await f.db.query('select current_date::text receipt_date')).rows[0].receipt_date
   const receive={command_id:randomUUID(),action:'receive',collection_id:null,amount:'200',reference:'SYNTHETIC-PDC-COLLECTION',received_on:receiptDate,confirmed:true}
   const response=await f.call('/api/admin-orders/'+ready+'/cod-cash',{actor:'owner',method:'POST',body:receive});assert.equal(response.response.status,200,JSON.stringify(response.body))
   assert.equal((await order(ready)).payment_status,'paid');assert.equal((await f.db.query('select count(*)::int n from public.treasury_transactions where customer_order_id=$1',[ready])).rows[0].n,0)
   const remit={command_id:randomUUID(),action:'reconcile',collection_id:response.body.collection_id,amount:'200',reference:'SYNTHETIC-PDC-REMITTANCE',received_on:receiptDate,confirmed:true}
   const posted=await f.call('/api/admin-orders/'+ready+'/cod-cash',{actor:'owner',method:'POST',body:remit});assert.equal(posted.response.status,200,JSON.stringify(posted.body))
   assert.equal((await f.db.query('select count(*)::int n from public.treasury_transactions where customer_order_id=$1',[ready])).rows[0].n,1)
  })
  await t.test('staff COD switch allows only explicit COD booking and PDF while global PDC remains paused',async()=>{
   const fresh=await packed(),count=posts();f.config.shippingLiveRequestsEnabled=false;f.config.pdcManualCodEnabled=true
   assert.equal((await processPdcOutboundQueue({supabaseAdmin:f.client,runtime:f.config,fetcher})).active,false)
   assert.equal((await processPdcReverseQueue({supabaseAdmin:f.client,runtime:f.config,fetcher})).active,false)
   assert.throws(()=>requirePdcReadAccess({is_enabled:true},f.config),/disabled/)
   await assert.rejects(operatePdcOrder({db:f.client,adminId:f.actors.owner,orderId:fresh,action:'recover',runtime:f.config,fetcher}),/disabled/)
   await assert.rejects(operatePdcOrder({db:f.client,adminId:f.actors.owner,orderId:randomUUID(),action:'book',runtime:f.config,fetcher}),/unavailable/)
   assert.equal(posts(),count)
   const original=globalThis.fetch
   globalThis.fetch=(url,options)=>String(url).startsWith(f.url+'/')?original(url,options):fetcher(url,options)
   try{
    const path='/api/admin-shipping/orders/'+fresh+'/booking'
    assert.equal((await f.call(path,{actor:'customer',method:'POST',body:{action:'book'}})).response.status,403)
    const response=await f.call(path,{actor:'owner',method:'POST',body:{action:'book'}})
    assert.equal(response.response.status,200,JSON.stringify(response.body));assert.equal(response.body.state,'ready')
   }finally{globalThis.fetch=original}
   assert.equal(posts(),count+1);assert.equal((await order(fresh)).payment_status,'pending')
   assert.equal(f.config.shippingLiveRequestsEnabled,false)
   f.config.pdcManualCodEnabled=false;f.config.shippingLiveRequestsEnabled=true
  })
 }finally{globalThis.useRuntimeConfig=previous;await f.close()}
})
