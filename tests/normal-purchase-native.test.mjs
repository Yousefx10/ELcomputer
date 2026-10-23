import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, createHmac, randomUUID } from 'node:crypto'
import { createCodCheckoutFixture } from './helpers/codCheckoutFixture.mjs'
import { emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'
import { checkoutStreetAddress } from '../app/utils/checkoutAddress.js'
import { hmacMessage } from '../server/utils/payments/paymob.js'

test('ordinary checkout uses the existing scoped grant with native durable SQL and signed late receipts', { skip: !emailNativeAvailable }, async t => {
  const runtime = { paymobEnabled: false, paymobLiveRequestsEnabled: false, paymobMode: 'live', paymobCardIntegrationMode: 'live', paymobSecretKey: 'sk_live_isolated_normal', paymobPublicKey: 'pk_live_isolated_normal', paymobHmacSecret: 'isolated-normal-hmac', paymobCardIntegrationId: '12345', public: { purchasingEnabled: false, siteUrl: 'https://orchid.example.invalid' } }
  const f = await createCodCheckoutFixture({ runtime, routes: [
    ['get','/api/payments/capabilities','server/api/payments/capabilities.get.js'],
    ['post','/api/payments/intentions','server/api/payments/intentions.post.js'],
    ['get','/api/payments/status','server/api/payments/status.get.js'],
    ['post','/api/payments/paymob/webhook','server/api/payments/paymob/webhook.post.js']
  ] })
  const originalFetch = globalThis.fetch
  let providerCalls = 0
  globalThis.fetch = async (url, options) => {
    if (String(url) === 'https://accept.paymob.com/v1/intention/') {
      providerCalls++
      const payload = JSON.parse(options.body)
      assert.equal(payload.amount,11000)
      assert.equal(payload.billing_data.street,'Isolated street, Isolated floor')
      assert.equal(payload.notification_url,'https://orchid.example.invalid/api/payments/paymob/webhook')
      assert.match(payload.redirection_url,/\/ar\/checkout\/payment-result\?order_id=/)
      return new Response(JSON.stringify({ id:'pi_live_normal_fixture',intention_order_id:987654,client_secret:'csk_live_normal_fixture',intention_detail:{amount:11000,currency:'EGP'},special_reference:payload.special_reference }))
    }
    assert.ok(String(url).startsWith('http://127.0.0.1:'),'Unexpected external request')
    return originalFetch(url,options)
  }
  try {
    f.client.auth.getUser = async actor => ({data:{user:f.actors[actor] ? {id:f.actors[actor],email:actor+'@product-save.example.invalid',is_anonymous:false,email_confirmed_at:'2026-01-01T00:00:00Z'} : null},error:null})
    await f.db.query('update public.site_settings set payment_card_enabled=true,payment_card_fee=0')
    const product = (await f.db.query("insert into public.products(title,slug,price,is_serialized,is_published,primary_warehouse_id) values('Normal isolated item',$1,100,true,true,$2) returning id",['normal-'+randomUUID(),f.warehouse])).rows[0].id
    const variant = (await f.db.query('select id from public.product_variants where product_id=$1',[product])).rows[0].id
    assert.equal((await f.client.rpc('commerce_create_procurement_order',{p_supplier_id:f.supplier,p_warehouse_id:f.warehouse,p_invoice_number:randomUUID(),p_notes:'Isolated fixture',p_paid_amount:0,p_items:[{product_id:product,variant_id:variant,quantity:3,unit_cost:60}]})).error,null)
    const company = (await f.db.query("insert into public.commerce_shipping_companies(name,provider,client_shipping_price,checkout_enabled,checkout_governorates) values('Isolated normal PDC','pdc',10,true,array['Cairo']) returning id")).rows[0].id
    await f.db.query("update public.shipping_provider_settings set is_enabled=true,product_id=40,origin_city_id=1,origin_address='Isolated pickup',origin_contact_name='Isolated sender',origin_phone='01000000000',access_token_encrypted='fixture',webhook_secret_encrypted='independent-fixture',cod_enabled=false,auto_create_labels=false,cities_cache='[{\"id\":1,\"name\":\"Origin\"},{\"id\":2,\"name\":\"Destination\"}]',products_cache='[{\"id\":40,\"name\":\"Fixture high value\"}]'")
    await f.db.query('delete from public.shipping_city_mappings')
    await f.db.query("insert into public.shipping_city_mappings(provider,governorate,city,provider_city_id) values('pdc','Cairo','Fixture city',2)")
    const address = {first_name:'Synthetic',last_name:'Buyer',email:'customer@product-save.example.invalid',phone:'01012345678',street_address:'Isolated street',address_line_2:'Isolated floor',city:'Fixture city',governorate:'Cairo'}
    const fields = ['first_name','last_name','email','phone','street_address','city','governorate']
    const normalized = {...address,street_address:checkoutStreetAddress(address)}
    const grant = { enabled:true,customer_id:f.actors.customer,cart_id:randomUUID(),product_id:product,variant_id:variant,shipping_company_id:company,total_minor:11000,address_sha256:createHash('sha256').update(JSON.stringify(fields.map(k=>normalized[k]))).digest('hex'),starts_at:new Date(Date.now()-1000).toISOString(),expires_at:new Date(Date.now()+600000).toISOString(),payment_enabled:true,review_key:'44'.repeat(32) }
    const body = {cart_id:randomUUID(),items:[{id:product,variant_id:variant,quantity:1}],address,shipping_method:'shipping',shipping_company_id:company,payment_method:'card',locale:'ar'}
    const post = (path,input,actor='customer')=>f.call(path,{method:'POST',body:input,actor})
    const counts = async () => (await f.db.query('select (select count(*)::int from public.customer_orders) orders,(select count(*)::int from public.payment_attempts) attempts,(select count(*)::int from public.shipping_order_jobs) jobs')).rows[0]

    await t.test('default, anonymous and other-account normal routes remain closed',async()=>{
      runtime.controlledPurchase='{}'
      assert.equal((await f.call('/api/payments/capabilities',{actor:null})).body.purchase.available,false)
      assert.equal((await post('/api/checkout/quote',body)).response.status,403)
      runtime.controlledPurchase=grant
      assert.equal((await post('/api/checkout/quote',body,null)).response.status,401)
      assert.equal((await post('/api/checkout/quote',body,'owner')).response.status,403)
      assert.equal((await f.call('/api/checkout/shipping',{actor:'owner'})).response.status,403)
      const capability=(await f.call('/api/payments/capabilities')).body
      assert.equal(capability.purchase.restricted,true);assert.equal(capability.card.available,true)
      assert.equal(JSON.stringify(capability).includes(grant.review_key),false)
      assert.equal(JSON.stringify(capability).includes(grant.address_sha256),false)
      assert.equal(JSON.stringify(capability).includes(grant.cart_id),false)
      assert.deepEqual((await f.call('/api/checkout/shipping')).body.options.map(x=>x.id),[company])
      assert.equal(providerCalls,0)
    })
    await t.test('changed methods, item, address or amount cannot create an order',async()=>{
      for(const change of [{payment_method:'cash'},{payment_method:'bank_transfer'},{coupon_code:'OTHER'},{items:[{...body.items[0],quantity:2}]},{address:{...address,address_line_2:''}}]) {
        assert.ok((await post('/api/checkout/quote',{...body,...change})).response.status>=400)
      }
      await f.db.query('update public.commerce_shipping_companies set client_shipping_price=11 where id=$1',[company])
      assert.equal((await post('/api/checkout/quote',body)).response.status,409)
      await f.db.query('update public.commerce_shipping_companies set client_shipping_price=10 where id=$1',[company])
      assert.deepEqual(await counts(),{orders:0,attempts:0,jobs:0})
    })
    let command,orderId
    await t.test('a lost acknowledgement and concurrent recovery preserve one order and both profile lines',async()=>{
      const quote=await post('/api/checkout/quote',body);assert.equal(quote.response.status,200,JSON.stringify(quote.body))
      command={...body,quote_id:quote.body.quoteId,review_token:quote.body.reviewToken}
      assert.equal((await post('/api/checkout',{...command,cart_id:randomUUID()})).response.status,409)
      f.controls.loseResponse=true
      await assert.rejects(post('/api/checkout',command))
      const results=await Promise.all(Array.from({length:5},()=>post('/api/checkout',command)))
      assert.ok(results.every(x=>x.response.status===200),JSON.stringify(results.map(x=>x.body)))
      orderId=results[0].body.order.id
      assert.equal(new Set(results.map(x=>x.body.order.id)).size,1)
      const stored=(await f.db.query('select checkout_cart_id,street_address from public.customer_orders where id=$1',[orderId])).rows[0]
      assert.equal(stored.checkout_cart_id,grant.cart_id);assert.equal(stored.street_address,normalized.street_address)
      assert.notEqual(body.cart_id,grant.cart_id)
      const profile=(await f.db.query('select address_line_1,address_line_2 from public.customer_profiles where id=$1',[f.actors.customer])).rows[0]
      assert.deepEqual(profile,{address_line_1:'Isolated street',address_line_2:'Isolated floor'})
      assert.equal((await f.db.query('select count(*)::int n from public.commerce_serialized_units where customer_order_id=$1',[orderId])).rows[0].n,1)
      assert.deepEqual(await counts(),{orders:1,attempts:0,jobs:0});assert.equal(providerCalls,0)
    })
    await t.test('a fresh browser cart cannot create a second order under the same grant',async()=>{
      const other={...body,cart_id:randomUUID()}
      const quote=await post('/api/checkout/quote',other);assert.equal(quote.response.status,200)
      assert.equal((await post('/api/checkout',{...other,quote_id:quote.body.quoteId,review_token:quote.body.reviewToken})).response.status,409)
      assert.equal((await counts()).orders,1)
    })
    await t.test('normal Paymob action checks separate approval and sends one synthetic intention',async()=>{
      runtime.controlledPurchase={...grant,payment_enabled:false}
      assert.equal((await post('/api/payments/intentions',{order_id:orderId,locale:'ar'})).response.status,403)
      assert.equal((await f.call('/api/payments/capabilities')).body.card.initiationAvailable,false)
      assert.equal(providerCalls,0);runtime.controlledPurchase=grant
      assert.ok((await post('/api/payments/intentions',{order_id:randomUUID(),locale:'ar'})).response.status>=400)
      const results=await Promise.all(Array.from({length:5},()=>post('/api/payments/intentions',{order_id:orderId,locale:'ar'})))
      assert.ok(results.some(x=>x.response.status===200),JSON.stringify(results.map(x=>x.body)))
      assert.equal(providerCalls,1);assert.deepEqual(await counts(),{orders:1,attempts:1,jobs:0})
      assert.equal(runtime.paymobEnabled,false);assert.equal(runtime.public.purchasingEnabled,false)
    })
    await t.test('outbound expiry/revocation preserves owned reads and signed late duplicate-safe payment',async()=>{
      runtime.controlledPurchase={...grant,starts_at:new Date(Date.now()-1200000).toISOString(),expires_at:new Date(Date.now()-600000).toISOString()}
      assert.equal((await post('/api/checkout/quote',body)).response.status,403)
      assert.equal((await post('/api/payments/intentions',{order_id:orderId})).response.status,403)
      runtime.controlledPurchase='{}'
      assert.equal((await post('/api/checkout',command)).response.status,403)
      assert.equal((await f.call('/api/payments/status?order_id='+orderId)).response.status,200)
      assert.equal((await f.call('/api/payments/status?order_id='+orderId,{actor:'owner'})).response.status,404)
      const tx={amount_cents:11000,created_at:'2026-10-23T00:00:00',currency:'EGP',error_occured:false,has_parent_transaction:false,id:7777,integration_id:12345,is_3d_secure:true,is_auth:false,is_capture:false,is_refunded:false,is_standalone_payment:true,is_voided:false,order:{id:987654},owner:333,pending:false,source_data:{pan:'2346',sub_type:'MasterCard',type:'card'},success:true}
      assert.equal((await post('/api/payments/paymob/webhook?hmac='+'0'.repeat(128),{type:'TRANSACTION',obj:tx},null)).response.status,401)
      const signature=createHmac('sha512',runtime.paymobHmacSecret).update(hmacMessage(tx)).digest('hex')
      for(let i=0;i<2;i++)assert.equal((await post('/api/payments/paymob/webhook?hmac='+signature,{type:'TRANSACTION',obj:tx},null)).response.status,200)
      assert.equal((await f.call('/api/payments/status?order_id='+orderId)).body.status,'paid')
      assert.equal((await f.db.query('select count(*)::int n from public.payment_transactions')).rows[0].n,1)
      assert.equal((await counts()).jobs,0);assert.equal(providerCalls,1)
    })
    await t.test('ordinary public capabilities remain portable and configurable',async()=>{
      runtime.public={purchasingEnabled:true,siteUrl:'https://cedar.example.invalid'}
      runtime.paymobEnabled=true;runtime.paymobLiveRequestsEnabled=true
      const result=await f.call('/api/payments/capabilities',{actor:null})
      assert.equal(result.body.purchase.restricted,false);assert.equal(result.body.card.available,true)
      assert.equal(providerCalls,1)
    })
  } finally { globalThis.fetch=originalFetch;await f.close() }
})
