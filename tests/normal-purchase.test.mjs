import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { build } from 'esbuild'
import { resolve } from 'node:path'
import { checkoutAddressFromProfile, checkoutProfileAddress, checkoutStreetAddress } from '../app/utils/checkoutAddress.js'
const bundle = await build({ entryPoints: [resolve('server/utils/normalPurchase.js')], bundle: true, write: false, format: 'esm', platform: 'node', alias: { '~': resolve('app') }, plugins: [{ name: 'absolute-h3', setup(b) { b.onResolve({ filter: /^h3$/ }, () => ({ path: import.meta.resolve('h3'), external: true })) } }] })
const { authorizeNormalCheckout, authorizeNormalQuote, normalPaymentAuthorization, normalPurchaseScope } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))
const user = { id: randomUUID(), email_confirmed_at: '2026-01-01T00:00:00Z', is_anonymous: false }
const order = { first_name: 'Synthetic', last_name: 'Buyer', email: 'fixture@example.invalid', phone: '01012345678', street_address: 'Fixture street, Fixture floor', city: 'Fixture city', governorate: 'Cairo', payment_method: 'card', shipping_method: 'shipping', shipping_company_id: randomUUID(), coupon_code: null }
const { createHash } = await import('node:crypto')
const addressHash = createHash('sha256').update(JSON.stringify(['first_name','last_name','email','phone','street_address','city','governorate'].map(k => order[k]))).digest('hex')
const scope = { enabled: true, customer_id: user.id, cart_id: randomUUID(), product_id: randomUUID(), variant_id: randomUUID(), shipping_company_id: order.shipping_company_id, total_minor: 11000, address_sha256: addressHash, starts_at: new Date(Date.now()-1000).toISOString(), expires_at: new Date(Date.now()+600000).toISOString(), payment_enabled: true, review_key: '33'.repeat(32) }
const items = [{ product_id: scope.product_id, variant_id: scope.variant_id, quantity: 1 }]
const runtime = { controlledPurchase: scope, paymobMode: 'live', paymobCardIntegrationMode: 'live', paymobEnabled: false, paymobLiveRequestsEnabled: false, public: { purchasingEnabled: false } }

test('saved address lines survive prefill, order composition and repeated profile saves', () => {
  const profile = { full_name: 'Synthetic Buyer', email: order.email, address_line_1: ' Fixture street ', address_line_2: ' Fixture floor ', city: order.city, state: order.governorate, phone: order.phone }
  const address = checkoutAddressFromProfile(profile)
  assert.equal(checkoutStreetAddress(address),order.street_address)
  for(let i=0;i<3;i++) {
    Object.assign(profile,checkoutProfileAddress(address))
    assert.equal(checkoutStreetAddress(checkoutAddressFromProfile(profile)),order.street_address)
  }
  assert.equal(profile.address_line_1,'Fixture street');assert.equal(profile.address_line_2,'Fixture floor')
  assert.deepEqual(checkoutProfileAddress({street_address:'Legacy client line'}),{address_line_1:'Legacy client line'})
  assert.deepEqual(checkoutProfileAddress({street_address:'Edited line',address_line_2:''}),{address_line_1:'Edited line',address_line_2:null})
})

test('normal requests fail closed before side effects for every out-of-scope command', () => {
  const input = { runtime,user,cartId:randomUUID(),order,items }
  assert.throws(()=>normalPurchaseScope({},user))
  for(const change of [{payment_method:'cash'},{payment_method:'bank_transfer'},{payment_method:'instapay'},{payment_method:'paypal'},{coupon_code:'OTHER'},{phone:'01099999999'},{street_address:'Changed'},{shipping_company_id:randomUUID()}])assert.throws(()=>authorizeNormalCheckout({...input,order:{...order,...change}}))
  for(const changed of [[{...items[0],quantity:2}],[{...items[0],variant_id:randomUUID()}],[{...items[0],product_id:randomUUID()}],[]])assert.throws(()=>authorizeNormalCheckout({...input,items:changed}))
  for(const actor of [null,{...user,id:randomUUID()},{...user,is_anonymous:true},{...user,email_confirmed_at:null}])assert.throws(()=>authorizeNormalCheckout({...input,user:actor}))
  for(const change of [{enabled:false},{expires_at:new Date(Date.now()-1).toISOString()}])assert.throws(()=>authorizeNormalCheckout({...input,runtime:{...runtime,controlledPurchase:{...scope,...change}}}))
  assert.equal(runtime.paymobEnabled,false);assert.equal(runtime.paymobLiveRequestsEnabled,false)
})

test('normal reviews bind the unchanged browser cart and one durable grant identity', () => {
  const cartId = randomUUID()
  const context = authorizeNormalCheckout({runtime,user,cartId,order,items})
  assert.equal(context.cartId,scope.cart_id);assert.equal(context.browserCartId,cartId)
  const raw = {quoteId:randomUUID(),totalAmount:110,isPreorder:false,lines:[{productId:scope.product_id,variantId:scope.variant_id,quantity:1}]}
  const review = authorizeNormalQuote(context,raw)
  assert.equal(review.reviewToken.length,64)
  const commit = {runtime,user,cartId,order,items,commit:true,quoteId:review.quoteId,signature:review.reviewToken}
  assert.equal(authorizeNormalCheckout(commit).cartId,scope.cart_id)
  for(const change of [{cartId:randomUUID()},{quoteId:randomUUID()},{signature:'0'.repeat(64)},{signature:undefined}])assert.throws(()=>authorizeNormalCheckout({...commit,...change}))
  assert.throws(()=>authorizeNormalQuote(context,{...raw,totalAmount:111}))
  assert.throws(()=>authorizeNormalQuote(context,{...raw,isPreorder:true}))
  assert.throws(()=>authorizeNormalCheckout({...commit,runtime:{...runtime,controlledPurchase:{...scope,total_minor:11100}}}))
  assert.equal(JSON.stringify(review).includes(scope.review_key),false)
})

test('payment authorization stays separate; public purchasing remains configurable', () => {
  assert.throws(()=>normalPaymentAuthorization({runtime:{...runtime,controlledPurchase:{...scope,payment_enabled:false}},user,db:{}}))
  const grant = normalPaymentAuthorization({runtime,user,db:{}})
  assert.equal(grant.runtime.paymobEnabled,true);assert.equal(runtime.paymobEnabled,false)
  for(const enabled of [true,'true']) {
    const publicRuntime={...runtime,controlledPurchase:'{}',public:{purchasingEnabled:enabled}}
    assert.equal(normalPurchaseScope(publicRuntime,null),null)
    const body={runtime:publicRuntime,user,cartId:randomUUID(),order:{payment_method:'cash'},items:[]}
    const context=authorizeNormalCheckout(body)
    assert.equal(context.cartId,body.cartId);assert.equal(context.runtime,publicRuntime)
    assert.deepEqual(normalPaymentAuthorization({runtime:publicRuntime,user,db:{}}),{runtime:publicRuntime})
  }
})
