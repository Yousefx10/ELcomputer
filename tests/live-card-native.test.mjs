import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, createHmac } from 'node:crypto'
import { createCodCheckoutFixture } from './helpers/codCheckoutFixture.mjs'
import { emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'
import { initiateOrderPayment } from '../server/utils/payments/index.js'
import { getPaymobConfig, hmacMessage } from '../server/utils/payments/paymob.js'

const runtime = () => ({ paymobEnabled: true, paymobLiveRequestsEnabled: true, paymobMode: 'live', paymobCardIntegrationMode: 'live',
  paymobSecretKey: 'egy_sk_live_owned_fixture', paymobPublicKey: 'egy_pk_live_owned_fixture', paymobHmacSecret: 'owned-isolated-hmac',
  paymobCardIntegrationId: '12345', public: { siteUrl: 'https://orchid.example.invalid' } })
const address = { first_name: 'Synthetic', last_name: 'Buyer', email: 'customer@product-save.example.invalid', phone: '01012345678', street_address: 'Owned fixture street', city: 'Fixture city', governorate: 'Cairo' }
const receive = async (f, quantity = 6) => {
  const product = (await f.db.query("insert into public.products(title,slug,price,is_serialized,is_published,primary_warehouse_id) values('Synthetic card item',$1,100,true,true,$2) returning id", ['card-'+randomUUID(),f.warehouse])).rows[0].id
  const variant = (await f.db.query('select id from public.product_variants where product_id=$1',[product])).rows[0].id
  if (!quantity) return { product, variant }
  const r = await f.client.rpc('commerce_create_procurement_order', { p_supplier_id: f.supplier, p_warehouse_id: f.warehouse,
    p_invoice_number: randomUUID(), p_notes: 'Isolated physical receipt', p_paid_amount: 0,
    p_items: [{ product_id: product, variant_id: variant, quantity, unit_cost: 60 }] })
  assert.equal(r.error, null, JSON.stringify(r.error));return { product, variant }
}
const transaction = (order, amount, id = 70001, success = true) => ({ amount_cents: amount, created_at: '2026-10-21T01:00:00', currency: 'EGP', error_occured: false,
  has_parent_transaction: false, id, integration_id: 12345, is_3d_secure: true, is_auth: false, is_capture: false,
  is_refunded: false, is_standalone_payment: true, is_voided: false, order: { id: order }, owner: 333, pending: false,
  source_data: { pan: '2346', sub_type: 'MasterCard', type: 'card' }, success })

test('live card uses trusted physical stock/delivery and only signed authoritative receipts', { skip: !emailNativeAvailable }, async t => {
  const config = runtime(), f = await createCodCheckoutFixture({ runtime: config, routes: [
    ['post','/api/payments/paymob/webhook','server/api/payments/paymob/webhook.post.js']
  ] })
  try {
    await f.db.query('update public.site_settings set payment_cash_enabled=true,payment_card_enabled=true,payment_card_fee=3,allow_out_of_stock_purchases=true')
    const stock = await receive(f)
    const company = (await f.db.query("insert into public.commerce_shipping_companies(name,client_shipping_price,checkout_enabled,checkout_governorates) values('Owned delivery fixture',40,true,array['Cairo']) returning id")).rows[0].id
    const input = (s = stock) => ({ cart_id: randomUUID(), items: [{ id: s.product, variant_id: s.variant, quantity: 1 }], address, payment_method: 'card', shipping_company_id: company })
    const quote = async body => { const r = await f.call('/api/checkout/quote', { method: 'POST', body });assert.equal(r.response.status,200,JSON.stringify(r.body));return { ...body, quote_id: r.body.quoteId } }
    let orderId, providerOrder = 987654, posts = 0
    const fetcher = async (url, options) => {
      assert.equal(url,'https://accept.paymob.com/v1/intention/');posts++
      const p = JSON.parse(options.body)
      assert.equal(p.amount,14300);assert.equal(p.notification_url,'https://orchid.example.invalid/api/payments/paymob/webhook')
      await new Promise(r => setTimeout(r,30))
      return new Response(JSON.stringify({ id:'pi_live_'+randomUUID(),intention_order_id:providerOrder,client_secret:'egy_csk_live_owned_fixture',intention_detail:{amount:p.amount,currency:'EGP'},special_reference:p.special_reference }))
    }
    const initiate = (id = orderId) => initiateOrderPayment({ db:f.client,userId:f.actors.customer,orderId:id,runtime:config,fetcher })
    const callback = async (tx, signed = true) => {
      const signature = signed ? createHmac('sha512',config.paymobHmacSecret).update(hmacMessage(tx)).digest('hex') : '0'.repeat(128)
      return f.call('/api/payments/paymob/webhook?hmac='+signature,{method:'POST',body:{type:'TRANSACTION',obj:tx}})
    }
    await t.test('card quote includes delivery and configured fee; exact replay allocates stock once', async () => {
      const body = await quote(input())
      const responses = await Promise.all(Array.from({length:6},()=>f.call('/api/checkout',{method:'POST',body})))
      assert.ok(responses.every(r=>r.response.status===200),JSON.stringify(responses.map(r=>r.body)))
      assert.equal(new Set(responses.map(r=>r.body.order.id)).size,1)
      const order = responses[0].body.order;orderId=order.id
      assert.equal(order.shippingFeeAmount,40);assert.equal(order.paymentFeeAmount,3);assert.equal(order.totalAmount,143)
      const saved=(await f.db.query('select * from public.customer_orders where id=$1',[orderId])).rows[0]
      assert.equal(saved.card_checkout_verified,true);assert.equal(saved.payment_status,'pending');assert.equal(Number(saved.amount_paid),0)
      assert.equal((await f.db.query('select count(*)::int n from public.commerce_serialized_units where customer_order_id=$1',[orderId])).rows[0].n,1)
    })
    await t.test('missing delivery, changed fees and forged totals fail without another order', async () => {
      assert.equal((await f.call('/api/checkout/quote',{method:'POST',body:{...input(),shipping_company_id:undefined}})).response.status,409)
      const body=await quote(input())
      await f.db.query('update public.commerce_shipping_companies set client_shipping_price=41 where id=$1',[company])
      assert.equal((await f.call('/api/checkout',{method:'POST',body})).response.status,409)
      await f.db.query('update public.commerce_shipping_companies set client_shipping_price=40 where id=$1',[company])
      assert.equal((await f.call('/api/checkout',{method:'POST',body:{...body,total_amount:1}})).response.status,400)
    })
    await t.test('card rejects zero physical stock and unconfirmed customer even with backorders enabled', async () => {
      const empty=await receive(f,0)
      assert.equal((await f.call('/api/checkout/quote',{method:'POST',body:input(empty)})).response.status,409)
      await f.db.query('update auth.users set email_confirmed_at=null where id=$1',[f.actors.customer])
      assert.equal((await f.call('/api/checkout/quote',{method:'POST',body:input()})).response.status,403)
      await f.db.query('update auth.users set email_confirmed_at=now() where id=$1',[f.actors.customer])
    })
    await t.test('separate outbound gate and matching mode are required; supported prefixes are portable', async () => {
      config.paymobLiveRequestsEnabled=false;await assert.rejects(initiate,/live_requests_disabled/);assert.equal(posts,0)
      config.paymobLiveRequestsEnabled=true
      assert.throws(()=>getPaymobConfig({...config,paymobPublicKey:'egy_pk_test_fixture'}))
      assert.equal(getPaymobConfig({...config,paymobSecretKey:'sk_live_fixture',paymobPublicKey:'pk_live_fixture',public:{siteUrl:'https://cedar.example.invalid'}}).origin,'https://cedar.example.invalid')
    })
    await t.test('concurrent initiations create one provider intention and a stable saved session', async () => {
      const results=await Promise.allSettled(Array.from({length:8},()=>initiate()))
      assert.ok(results.some(r=>r.status==='fulfilled'));assert.equal(posts,1)
      assert.equal((await initiate()).clientSecret,'egy_csk_live_owned_fixture');assert.equal(posts,1)
      assert.equal((await f.db.query('select count(*)::int n from public.payment_attempts')).rows[0].n,1)
    })
    await t.test('invalid HMAC and correctly signed wrong amount cannot settle', async () => {
      assert.equal((await callback(transaction(providerOrder,14300),false)).response.status,401)
      assert.equal((await callback(transaction(providerOrder,14200))).response.status,409)
      assert.equal((await f.db.query('select payment_status from public.customer_orders where id=$1',[orderId])).rows[0].payment_status,'pending')
    })
    await t.test('signed failure then success reconcile once, including while initiation is paused', async () => {
      assert.equal((await callback(transaction(providerOrder,14300,70001,false))).response.status,200)
      assert.equal((await f.db.query('select payment_status from public.customer_orders where id=$1',[orderId])).rows[0].payment_status,'failed')
      config.paymobEnabled=false;config.paymobLiveRequestsEnabled=false
      const tx=transaction(providerOrder,14300)
      for(let i=0;i<4;i++)assert.equal((await callback(tx)).response.status,200)
      assert.equal((await callback({...tx,success:false})).response.status,200)
      const row=(await f.db.query('select payment_status,amount_paid,status from public.customer_orders where id=$1',[orderId])).rows[0]
      assert.equal(row.payment_status,'paid');assert.equal(Number(row.amount_paid),143);assert.equal(row.status,'processing')
      assert.equal((await f.db.query('select count(*)::int n from public.payment_transactions')).rows[0].n,1)
      assert.equal((await f.db.query('select count(*)::int n from public.treasury_transactions')).rows[0].n,0)
      assert.equal((await f.db.query('select count(*)::int n from public.shipping_order_jobs')).rows[0].n,0)
    })
    await t.test('saved financial/shipping attestation cannot be altered', async () => {
      await assert.rejects(()=>f.db.query('update public.customer_orders set shipping_fee_amount=1 where id=$1',[orderId]),/context cannot change/)
      await assert.rejects(()=>f.db.query('update public.customer_orders set card_checkout_verified=false where id=$1',[orderId]),/context cannot change/)
    })
    await t.test('gateway commands and durable dispatch barrier are unavailable to browser roles', async () => {
      for(const role of ['anon','authenticated']){
        assert.equal((await f.db.query("select has_function_privilege($1,'public.commerce_claim_payment_attempt(uuid,uuid,text,bigint)','execute') allowed",[role])).rows[0].allowed,false)
        assert.equal((await f.db.query("select has_table_privilege($1,'private.pdc_dispatches','insert') allowed",[role])).rows[0].allowed,false)
      }
    })
  } finally { await f.close() }
})
