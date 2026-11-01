import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {join} from 'node:path'
import {createPrivatePackingFixture} from './helpers/privatePackingFixture.mjs'
import {emailNativeAvailable} from './helpers/emailNativeDatabase.mjs'

test('verified transfer reuses genuine local packing evidence and staff-only zero-COD readiness',{skip:!emailNativeAvailable,timeout:180000},async()=>{
 const f=await createPrivatePackingFixture(),rpc=async(name,args={})=>{const r=await f.client.rpc(name,args);assert.equal(r.error,null,JSON.stringify(r.error));return r.data}
 try{
 if(process.env.PAYMENT_FIRST_FFPROBE)f.config.packingVideoProbePath=process.env.PAYMENT_FIRST_FFPROBE
 await f.db.query("update public.site_settings set payment_instapay_enabled=true,inventory_tracking_required=false,backorder_fulfillment_message='Delivery depends on the address.',backorder_fulfillment_message_ar='التوصيل حسب العنوان.' where key='default'")
 await rpc('commerce_transfer_configure',{p_actor:f.actors.owner,p_revision:0,p_config:{enabled:true,recipient_name:'Fixture bank',recipient_address:'owned@fixture.invalid',recipient_verified:true,instructions_en:'Transfer the exact amount.',instructions_ar:'حوّل المبلغ المحدد.',mime_types:['image/png'],max_bytes:5242880,max_proofs:3}})
 const city=(await f.db.query("select name_en from private.delivery_location_cities where governorate_code='eg-cairo' order by code limit 1")).rows[0].name_en
 const company=(await f.db.query("insert into public.commerce_shipping_companies(name,provider,checkout_enabled,checkout_governorates,client_shipping_price,cod_collection_enabled,cod_collection_provider) values('Transfer delivery','manual',true,array['Cairo'],50,true,'pdc') returning id")).rows[0].id
 const product=(await f.db.query("insert into public.products(title,slug,price,is_serialized,is_published,primary_warehouse_id) values('Transfer parcel',$1,100.35,true,true,$2) returning id",['transfer-'+randomUUID(),f.warehouse])).rows[0].id,variant=(await f.db.query('select id from public.product_variants where product_id=$1',[product])).rows[0].id
 await f.db.query("update public.shipping_provider_settings set is_enabled=true,cod_enabled=false,auto_create_labels=false,shipment_type_id=1,company_id='123',product_id=64,origin_city_id=1,origin_address='Owned origin',origin_phone='01000000000',origin_contact_name='Owned sender',cities_cache='[{\"id\":1},{\"id\":2}]',products_cache='[{\"id\":64}]',access_token_encrypted='inert-fixture-only',webhook_secret_encrypted='inert-fixture-only' where id='pdc'")
 await f.db.query("delete from public.shipping_city_mappings")
 await f.db.query("insert into public.shipping_city_mappings(provider,governorate,city,provider_city_id) values('pdc','Cairo',$1,2)",[city])
 const user=f.actors.customer,cart=randomUUID(),order={first_name:'Owned buyer',email:'customer@product-save.example.invalid',street_address:'Owned street',city,governorate:'Cairo',phone:'01012345678',shipping_method:'shipping',shipping_company_id:company,payment_method:'instapay',locale:'ar'},items=[{product_id:product,variant_id:variant,quantity:1}],q=await rpc('commerce_checkout_quote',{p_user_id:user,p_cart_id:cart,p_order:order,p_items:items})
 const s=(await rpc('commerce_prepare_transfer_checkout',{p_user_id:user,p_cart_id:cart,p_quote_id:q.quoteId,p_order:order,p_items:items,p_cart_revision:randomUUID(),p_cart_lines:[]})).checkout
 assert.equal((await f.db.query('select count(*)::int n from public.customer_orders')).rows[0].n,0)
 const request=randomUUID(),proof=await rpc('commerce_transfer_reserve_proof',{p_user_id:user,p_session_id:s.id,p_request_id:request,p_revision:0,p_sha256:'a'.repeat(64),p_size:100,p_mime:'image/png'})
 await rpc('commerce_transfer_finish_proof',{p_user_id:user,p_proof_id:proof.id,p_sha256:'a'.repeat(64)})
 await rpc('commerce_transfer_submit',{p_user_id:user,p_session_id:s.id,p_request_id:request,p_revision:0,p_proof_id:proof.id,p_reference:''})
 assert.equal((await f.db.query('select count(*)::int n from public.shipping_order_jobs')).rows[0].n,0)
 const accepted=await rpc('commerce_transfer_review',{p_actor:f.actors.owner,p_session_id:s.id,p_request_id:randomUUID(),p_revision:1,p_action:'verify',p_evidence:{bank_credit_verified:true,recipient:'owned@fixture.invalid',recipient_revision:1,amount_minor:15035,currency:'EGP',bank_received_at:new Date().toISOString(),bank_reference:'BANK-FULFILLMENT-FIXTURE'}})
 assert.equal(accepted.state,'verified');const id=accepted.order_id
 await assert.rejects(f.db.query('select private.pdc_order_eligibility($1)',[id]),/not ready/)
 const pack=await f.claimOrder(id),code=(await f.db.query('select variant_code from public.customer_order_items where order_id=$1',[id])).rows[0].variant_code
 assert.equal((await f.call(pack.path+'/scan',{method:'POST',body:{code}})).response.status,200)
 const videoPath=join(f.directory,'owned-bank.webm');if(!process.env.PAYMENT_FIRST_VIDEO_FIXTURE)await promisify(execFile)('ffmpeg',['-v','error','-f','lavfi','-i','color=c=blue:size=64x64:rate=10','-t','6','-an','-c:v','libvpx',videoPath]);const bytes=await readFile(process.env.PAYMENT_FIRST_VIDEO_FIXTURE||videoPath),started=Date.now()-1000
 const upload=await f.call(pack.path+'/video-upload',{method:'POST',body:{mimeType:'video/webm',sizeBytes:bytes.length,recordingStartedAt:new Date(started).toISOString(),recordingEndedAt:new Date(started+6000).toISOString()}});assert.equal(upload.response.status,200,JSON.stringify(upload.body))
 assert.equal((await f.call(upload.body.upload.url,{method:'PUT',body:bytes,raw:true,headers:{'Content-Type':'video/webm'}})).response.status,200)
 assert.equal((await f.call(pack.path+'/video-complete',{method:'POST',body:{}})).response.status,200)
 const completed=await f.call(pack.path+'/complete',{method:'POST',body:{}});assert.equal(completed.response.status,200,JSON.stringify(completed.body))
 const eligibility=(await f.db.query('select private.pdc_order_eligibility($1) v',[id])).rows[0].v;assert.equal(eligibility.cod_amount_minor,0);assert.equal(eligibility.order.payment_status,'paid');assert.equal(eligibility.order.stock_fulfillment_state,'untracked')
 assert.equal((await f.db.query('select count(*)::int n from private.pdc_dispatches')).rows[0].n,0);assert.equal((await f.db.query('select count(*)::int n from public.shipping_order_jobs')).rows[0].n,0)
 }finally{await f.close()}
})
