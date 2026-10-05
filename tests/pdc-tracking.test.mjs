import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { createServer, request } from 'node:http'
import { createApp, toNodeListener, createError, defineEventHandler } from 'h3'
import { createI18n } from 'vue-i18n'
import { getPdcSettings, findShipmentResult, validatePdcBaseUrl, PDC_PRODUCTION_BASE_URL, PDC_TEST_BASE_URL } from '../server/utils/pdcShipping.js'
import { encryptShippingSecret, decryptShippingSecret, shippingSecretsMatch } from '../server/utils/shippingSecrets.js'
import { parsePdcStatusDate, parsePdcWebhook, pdcEventKey } from '../server/utils/pdcTracking.js'
import { handlePdcWebhook } from '../server/utils/pdcWebhook.js'
import { requirePdcReadAccess, requestPdcLookup, normalizePdcLookup, reconcilePdcShipment } from '../server/utils/pdcLookups.js'
import { validatePdcSettings } from '../server/utils/pdcSettings.js'
import { presentCustomerShipment } from '../server/utils/customerShipment.js'
import { shipmentTimeline, shipmentReasonKey, shipmentStateKey, shippingStates } from '../app/utils/shipmentTracking.js'

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const secret = 'fixture-webhook-secret-abcdefghijklmnopqrstuvwxyz'
globalThis.useRuntimeConfig = () => ({ shippingCredentialsEncryptionKey: 'fixture-encryption-key-abcdefghijklmnopqrstuvwxyz', shippingLiveRequestsEnabled: false })
const settings = () => ({ is_enabled: true, api_mode: 'production', base_url: PDC_PRODUCTION_BASE_URL, company_id: '123456', product_id: 64, status_timezone: 'Africa/Cairo', access_token_encrypted: encryptShippingSecret('fixture-access-token'), webhook_secret_encrypted: encryptShippingSecret(secret) })
const payload = () => ({ AWB: 'EDC-FIXTURE', REF: 'ORDER-FIXTURE', StatusID: '4', CustomerStatusName: 'Out For Delivery', StatusDate: '2026-10-05T10:42:00+03:00', ReasonName: '' })
const builder = result => ({ select() { return this }, eq() { return this }, maybeSingle() { return this }, abortSignal() { return Promise.resolve(result) } })
const dbFixture = (config = settings(), response = { received: true }) => {
  const writes = []
  return { writes, from() { return builder({ data: config }) }, rpc(name, args) { writes.push({ name, args }); return { abortSignal() { return Promise.resolve({ data: response }) } } } }
}

// Run the real HTTP handler and streaming body reader; provider/database calls stay isolated.
const withWebhook = async (run, config = settings(), response) => {
  const db = dbFixture(config, response)
  const app = createApp()
  app.use('/pdc', defineEventHandler(event => handlePdcWebhook(event, db)))
  const server = createServer(toNodeListener(app))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}/pdc`
  const send = (data = payload(), headers = {}, method = 'POST') => fetch(base, { method, headers: { 'content-type': 'application/json', 'x-webhook-secret': secret, ...headers }, ...(method === 'GET' ? {} : { body: typeof data === 'string' ? data : JSON.stringify(data) }) })
  try { await run({ send, db, server }) } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
}

test('shipping settings retrieval remains encrypted and errors reveal no database/provider details', async () => {
  const config = settings()
  assert.deepEqual(await getPdcSettings(dbFixture(config)), config)
  await assert.rejects(() => getPdcSettings({ from() { return builder({ error: { message: 'PRIVATE_DATABASE_CANARY' } }) } }), error => error.statusCode === 500 && !error.message.includes('CANARY'))
})

test('shipping secrets use authenticated encryption, independent credentials and constant-time comparison', () => {
  const one = encryptShippingSecret(secret), two = encryptShippingSecret(secret)
  assert.notEqual(one, two); assert.equal(decryptShippingSecret(one), secret)
  const pieces = one.split('.'); pieces[3] = 'AAAA'
  assert.throws(() => decryptShippingSecret(pieces.join('.')), /could not be opened/)
  assert.equal(shippingSecretsMatch(secret, secret), true); assert.equal(shippingSecretsMatch(secret, ''), false)
  assert.equal(shippingSecretsMatch('fixture-access-token', secret), false)
})

test('dashboard validates explicit mode/URL, merchant IDs, booleans and secrets without hardcoded merchant defaults', () => {
  const current = settings()
  const body = { ...current, display_name: 'PDC', origin_city_id: 12, origin_phone: '01000000000', origin_address: 'Fixture street', origin_contact_name: 'Store', default_weight_kg: 1, shipment_type_id: 1, label_template_id: 1, allow_open_shipment: false, all_must_valid: true, auto_create_labels: false, access_token: '', webhook_secret: '' }
  const update = validatePdcSettings(body, current)
  assert.equal(update.company_id, '123456'); assert.equal(update.product_id, 64); assert.equal(update.is_enabled, true)
  assert.equal(Object.hasOwn(update, 'access_token_encrypted'), false)
  assert.equal(validatePdcSettings({ ...body, api_mode: 'test', base_url: PDC_TEST_BASE_URL }, current).base_url, PDC_TEST_BASE_URL)
  for (const change of [{ base_url: 'https://localhost/' }, { api_mode: 'test' }, { company_id: '' }, { company_id: '1\r\nX: secret' }, { product_id: 0 }, { webhook_secret: 'short' }, { is_enabled: 'false' }, { status_timezone: 'not-a-zone' }]) assert.throws(() => validatePdcSettings({ ...body, ...change }, current))
  const replaced = validatePdcSettings({ ...body, access_token: 'new-private-token', webhook_secret: secret }, current)
  assert.equal(decryptShippingSecret(replaced.access_token_encrypted), 'new-private-token')
  assert.equal(decryptShippingSecret(replaced.webhook_secret_encrypted), secret)
  assert.deepEqual(replaced.cities_cache, [])
})

test('PDC URLs use exact configured official hosts, with no automatic hostname replacement', () => {
  assert.equal(validatePdcBaseUrl(PDC_PRODUCTION_BASE_URL), PDC_PRODUCTION_BASE_URL)
  assert.equal(validatePdcBaseUrl(PDC_TEST_BASE_URL, 'test'), PDC_TEST_BASE_URL)
  for (const url of [PDC_TEST_BASE_URL, 'https://clientsapi.pdc-eg.com.attacker.test/api/ClientUsers/V6/', `${PDC_PRODUCTION_BASE_URL}?x=1`, 'http://clientsapi.pdc-eg.com/api/ClientUsers/V6/']) assert.throws(() => validatePdcBaseUrl(url))
})

test('dates retain provider event time and use configured Cairo timezone for timezone-free examples', () => {
  assert.equal(parsePdcStatusDate('2026-10-05T10:42:00+03:00'), '2026-10-05T07:42:00.000Z')
  assert.equal(parsePdcStatusDate('2026-10-05T10:42:00'), '2026-10-05T07:42:00.000Z')
  assert.equal(parsePdcStatusDate('2026-10-05T10:42:00.1234567'), '2026-10-05T07:42:00.123Z')
  assert.equal(parsePdcStatusDate('2026-01-05T10:42:00'), '2026-01-05T08:42:00.000Z')
  for (const date of ['', null, 0, 'bad', '2026-02-30T00:00:00Z', '2026-13-01T00:00:00Z', '2026-01-01T24:00:00Z', '2026-01-01T01:00:00+25:00']) assert.throws(() => parsePdcStatusDate(date))
  assert.throws(() => parsePdcStatusDate('2026-04-24T00:30:00', 'Africa/Cairo'))
})

test('webhook schema rejects malformed/missing identifiers, invalid status ID/date and unbounded fields', () => {
  assert.equal(parsePdcWebhook(payload()).status_id, 4)
  for (const body of [[], null, { ...payload(), AWB: '' }, { ...payload(), REF: '' }, { ...payload(), StatusID: null }, { ...payload(), StatusID: true }, { ...payload(), StatusID: 0 }, { ...payload(), StatusID: 1.5 }, { ...payload(), StatusID: '2147483648' }, { ...payload(), StatusDate: '' }, { ...payload(), ReasonName: 'x'.repeat(501) }]) assert.throws(() => parsePdcWebhook(body))
  assert.equal(parsePdcWebhook({ ...payload(), StatusID: 999999 }).status_id, 999999)
})

test('idempotency uses AWB+StatusID regardless of timestamp/name/reason', () => {
  const one = parsePdcWebhook(payload())
  assert.equal(pdcEventKey(one), pdcEventKey({ ...one, status_date: 'different', status_name: 'different', reason: 'different' }))
  assert.notEqual(pdcEventKey(one), pdcEventKey({ ...one, awb: 'other' }))
})

test('valid webhook responds quickly after persistence, drops unsolicited payload fields and never returns secrets', async () => {
  await withWebhook(async ({ send, db }) => {
    const started = Date.now(); const response = await send({ ...payload(), AccessToken: 'PRIVATE_CANARY', address: 'PRIVATE_ADDRESS' })
    assert.equal(response.status, 200); assert.ok(Date.now() - started < 1000)
    const text = await response.text(); assert.equal(text.includes(secret), false); assert.equal(text.includes('CANARY'), false)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(db.writes[0].name, 'shipping_record_pdc_event')
    assert.equal(JSON.stringify(db.writes).includes('PRIVATE_'), false)
    assert.equal(db.writes[0].args.p_update.status_date, '2026-10-05T07:42:00.000Z')
  })
})

test('invalid/missing/token-as-webhook-secret are rejected before reading or processing payload', async () => {
  await withWebhook(async ({ send, db }) => {
    for (const value of ['', 'wrong', 'fixture-access-token']) assert.equal((await send('{broken', { 'x-webhook-secret': value })).status, 401)
    assert.equal(db.writes.length, 0)
  })
})

test('webhook rejects methods, wrong media type, malformed JSON and bad dates', async () => {
  await withWebhook(async ({ send, db }) => {
    assert.equal((await send('', {}, 'GET')).status, 405)
    assert.equal((await send(payload(), { 'content-type': 'text/plain' })).status, 415)
    assert.equal((await send('{broken')).status, 400)
    assert.equal((await send({ ...payload(), StatusDate: 'bad' })).status, 400)
    assert.equal(db.writes.length, 0)
  })
})

test('missing configured webhook secret and disabled provider fail closed without event writes', async () => {
  await withWebhook(async ({ send, db }) => { assert.equal((await send()).status, 503); assert.equal(db.writes.length, 0) }, { ...settings(), webhook_secret_encrypted: null })
  await withWebhook(async ({ send, db }) => { assert.equal((await send()).status, 503); assert.equal(db.writes.length, 0) }, { ...settings(), is_enabled: false })
})

test('unknown REF and mismatched AWB receive retryable non-success, duplicate returns success', async () => {
  for (const [result, status] of [[{ error: 'unknown_ref' },404],[{ error: 'awb_mismatch' },409],[{ received: true, duplicate: true },200]]) {
    await withWebhook(async ({ send }) => assert.equal((await send()).status, status), settings(), result)
  }
})

test('database failure is not acknowledged and emits no raw database error', async () => {
  const db = dbFixture(); db.rpc = () => ({ abortSignal: () => Promise.resolve({ error: { message: 'PRIVATE_CANARY' } }) })
  const app = createApp(); app.use('/pdc', defineEventHandler(event => handlePdcWebhook(event, db)))
  const server = createServer(toNodeListener(app)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/pdc`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-webhook-secret': secret }, body: JSON.stringify(payload()) })
    assert.equal(response.status, 503); assert.equal((await response.text()).includes('CANARY'), false)
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
})

test('streaming webhook reader rejects oversized declared/chunked bodies without waiting for full upload', async () => {
  await withWebhook(async ({ db, server }) => {
    const send = headers => new Promise((resolve, reject) => {
      const req = request({ host: '127.0.0.1', port: server.address().port, path: '/pdc', method: 'POST', headers: { 'content-type': 'application/json', 'x-webhook-secret': secret, ...headers } }, res => { res.resume(); res.on('end', () => { req.destroy(); resolve(res.statusCode) }) })
      req.on('error', reject); req.write('x'.repeat(8193))
    })
    assert.equal(await send({ 'content-length': '999999' }), 413)
    assert.equal(await send({ 'transfer-encoding': 'chunked' }), 413)
    assert.equal(db.writes.length, 0)
  })
})

test('lookup gate preserves disabled server/provider behavior and does not depend on auto-label settings', () => {
  assert.throws(() => requirePdcReadAccess(settings()), /disabled/)
  assert.doesNotThrow(() => requirePdcReadAccess({ ...settings(), auto_create_labels: false }, { shippingLiveRequestsEnabled: true }))
  assert.throws(() => requirePdcReadAccess({ ...settings(), is_enabled: false }, { shippingLiveRequestsEnabled: true }), /disabled/)
})

test('mocked city/product requests use configured headers and GET, with bounded duplicate-safe cache normalization', async () => {
  for (const operation of ['GetCities', 'GetProducts']) {
    const rows = await requestPdcLookup(settings(), operation, undefined, async (url, options) => {
      assert.equal(url, PDC_PRODUCTION_BASE_URL + operation); assert.equal(options.method, 'GET'); assert.equal(options.body, undefined)
      assert.equal(options.headers.AccessToken, 'fixture-access-token'); assert.equal(options.headers.CompanyID, '123456'); assert.equal(options.redirect, 'error')
      return new Response(JSON.stringify([{ id: 64, name: 'Fixture' }]))
    })
    assert.deepEqual(normalizePdcLookup(rows), [{ id: 64, name: 'Fixture' }])
  }
  assert.throws(() => normalizePdcLookup([{ id: 1, name: 'A' }, { id: 1, name: 'B' }]))
  assert.throws(() => normalizePdcLookup({ data: [{ id: 1, name: 'A' }], totalCount: 100 }))
  await assert.rejects(() => requestPdcLookup(settings(), 'SaveShipmentEx', {}))
  await assert.rejects(() => requestPdcLookup(settings(), 'GetProducts', undefined, async () => new Response('PRIVATE_CANARY', { status: 401 })), error => !error.message.includes('CANARY'))
  await assert.rejects(() => requestPdcLookup(settings(), 'GetCities', undefined, async () => new Response('x'.repeat(1048577))))
})

test('reconciliation filters by original REF and AWB, uses no made-up StatusID or provider timestamp', async () => {
  const writes = []
  const db = { rpc(name,args) { writes.push({ name,args }); return { abortSignal: async () => ({ data: name === 'shipping_claim_pdc_refresh' ? { awb: 'EDC-FIXTURE', ref: 'ORDER-FIXTURE', observed_at: '2026-10-05T08:00:00Z' } : { received: true } }) } } }
  const fetcher = async (_url, options) => {
    assert.equal(options.method, 'POST'); assert.deepEqual(JSON.parse(options.body), { awBs: 'EDC-FIXTURE', reFs: 'ORDER-FIXTURE' })
    return new Response(JSON.stringify([{ AWB: 'EDC-FIXTURE', Ref: 'ORDER-FIXTURE', Status: 'Delivered', Reason: '' }]))
  }
  assert.equal((await reconcilePdcShipment(db, settings(), 'order-fixture', fetcher)).received, true)
  assert.equal(writes[1].args.p_update.status_id, null); assert.equal(writes[1].args.p_update.status_date, null)
  await assert.rejects(() => reconcilePdcShipment(db, settings(), 'order-fixture', async () => new Response(JSON.stringify([{ AWB: 'other', Ref: 'ORDER-FIXTURE', Status: 'Delivered' }]))), error => error.statusCode === 409)
  assert.equal(writes.filter(w => w.name === 'shipping_record_pdc_event').length, 1)
})

test('safe customer projection deduplicates old history and returns no raw provider fields or secrets', () => {
  const mappings = [{ provider_status_id: 4, normalized_state: 'out_for_delivery', provider_label: 'Out For Delivery', provider_aliases: [] }]
  const event = { id: '1', event_key: 'key', provider_status_id: 4, provider_status_name: 'RAW_INTERNAL_CANARY', status_date: '2026-10-05T08:00:00Z', received_at: '2026-10-05T09:00:00Z', reason_name: 'Not Delivered-Not Home', source: 'webhook' }
  const shipping = presentCustomerShipment({ provider: 'pdc', awb: 'A', provider_status_id: 4, provider_status_name: 'RAW_INTERNAL_CANARY', provider_status_at: event.status_date }, [event,{ ...event,id:'2' }],mappings)
  assert.equal(shipping.events.length, 1); assert.equal(shipping.current_state, 'out_for_delivery'); assert.equal(shipping.events[0].reason_key, 'shipment.reasons.r1')
  assert.equal(JSON.stringify(shipping).includes('CANARY'), false)
  assert.equal(presentCustomerShipment(null, [], []), null)
  assert.equal(presentCustomerShipment({ provider_status_id: 999 }, [], mappings).current_state, 'unknown')
})

test('customer order API checks ownership before shipment reads, denying changed ID/AWB/REF', async () => {
  let handler, shipmentReads = 0
  const id = '00000000-0000-4000-8000-000000000001'
  const db = { from() { return { select() { return this }, eq(key,value) { if(key === 'user_id') assert.equal(value,'customer-a'); return this }, async maybeSingle() { return { data: null } } } } }
  const source = read('server/api/account/orders/[id].get.js').replace(/import[^\n]+\n/g,'').replace('export default defineEventHandler','capture')
  runInNewContext(source, { capture: fn => { handler=fn }, createError, setHeader() {}, getRouterParam: () => id,
    requireCustomerRequest: async () => ({ authUser: { id: 'customer-a' }, supabaseAdmin: db }), readCustomerShipment: async () => { shipmentReads++; return {} }, throwRequestDatabaseError() {} })
  await assert.rejects(() => handler({ query: { AWB:'foreign',REF:'foreign' } }), error => error.statusCode===404)
  assert.equal(shipmentReads,0)
})

test('English/Arabic timelines merge dated order evidence and courier history without fabricated pickup', () => {
  const en=JSON.parse(read('i18n/locales/en.json')), ar=JSON.parse(read('i18n/locales/ar.json'))
  const i18n=createI18n({legacy:false,locale:'en',messages:{en,ar}})
  const order={created_at:'2026-10-01T08:00:00Z',payment_status:'paid',paid_at:'2026-10-01T09:00:00Z',packing_completed_at:'2026-10-01T10:00:00Z'}
  const shipping={events:[{id:'later',state:'out_for_delivery',status_at:'2026-10-02T10:00:00Z'},{id:'earlier',state:'in_transit',status_at:'2026-10-01T11:00:00Z'}]}
  const steps=shipmentTimeline(order,shipping)
  assert.deepEqual(steps.map(s=>s.id),['placed','paid','packed','earlier','later'])
  assert.ok(!steps.some(s=>s.label_key===shipmentStateKey('picked_up')))
  assert.deepEqual(shipmentTimeline({created_at:order.created_at},null).map(s=>s.id),['placed'])
  for(const locale of ['en','ar']) { i18n.global.locale.value=locale; for(const state of shippingStates) assert.notEqual(i18n.global.t(shipmentStateKey(state)),shipmentStateKey(state)) }
  assert.equal(shipmentReasonKey('Consingee Moved'),shipmentReasonKey('Consignee Moved')); assert.equal(shipmentReasonKey('PRIVATE_CUSTOMER_PAYLOAD'),null)
})

test('settings/browser responses expose credential presence only and private realtime has no send policy', () => {
  const source=read('server/api/admin-shipping/settings.get.js')
  const returned=source.slice(source.indexOf('  return {'))
  assert.doesNotMatch(returned,/decryptShippingSecret|access_token_encrypted:|webhook_secret_encrypted:/)
  assert.doesNotMatch(read('app/components/dashboard/commerce/ShippingTab.vue'),/280533|product_id: 40/)
  assert.match(read('app/composables/useShipmentUpdates.js'),/private: true/)
  assert.match(read('app/composables/useShipmentUpdates.js'),/removeChannel/)
  assert.doesNotMatch(read('supabase/migrations/20261005120000_pdc_customer_tracking.sql'),/for insert to authenticated/)
})

const routeHandler = (file, scope) => {
  let handler
  const source=read(file).replace(/import[\s\S]*?from ['"][^'"]+['"]\n/g,'').replace('export default defineEventHandler','capture')
  runInNewContext(source,{capture:fn=>{handler=fn},createError,setHeader() {},useRuntimeConfig:globalThis.useRuntimeConfig,AbortSignal,console,...scope})
  return handler
}

test('actual dashboard settings GET returns masked presence flags without ciphertext/plaintext',async()=>{
  const config=settings()
  const db={from(table){return {select(){return this},eq(){return this},in(){return this},order(){return this},then(resolve){resolve({count:382,data:table==='shipping_status_mappings'?[{provider_status_id:4,normalized_state:'out_for_delivery'}]:null})}}}}
  const handler=routeHandler('server/api/admin-shipping/settings.get.js',{
    requireAdminRequest:async(_event,options)=>{assert.equal(options.permission,'settings.edit');return {supabaseAdmin:db}},getPdcSettings:async()=>config,isShippingEncryptionReady:()=>true
  })
  const result=await handler({})
  assert.equal(result.settings.access_token_configured,true);assert.equal(result.settings.webhook_secret_configured,true)
  assert.equal(JSON.stringify(result).includes(config.access_token_encrypted),false)
  assert.equal(JSON.stringify(result).includes(secret),false)
})

test('actual dashboard PATCH retains dashboard merchant configuration with server calls disabled and encrypts replacements',async()=>{
  const config=settings(),writes=[],logs=[]
  const body={...config,default_weight_kg:1,shipment_type_id:1,label_template_id:1,allow_open_shipment:false,all_must_valid:true,auto_create_labels:false,access_token:'new-fixture-token',webhook_secret:secret}
  const db={from(){return {update(value){writes.push(value);return this},eq(){return this},select(){return this},single:async()=>({data:writes[0]})}},rpc(){throw new Error('No queue expected')}}
  const handler=routeHandler('server/api/admin-shipping/settings.patch.js',{
    requireAdminRequest:async()=>({supabaseAdmin:db,adminUser:{id:'admin'}}),getPdcSettings:async()=>config,validatePdcSettings,readPaymentCallbackBody:async()=>JSON.stringify(body),recordAdminActivity:async value=>logs.push(value)
  })
  const result=await handler({})
  assert.equal(writes[0].is_enabled,true);assert.equal(writes[0].company_id,'123456');assert.equal(writes[0].product_id,64)
  assert.equal(decryptShippingSecret(writes[0].access_token_encrypted),'new-fixture-token')
  assert.equal(JSON.stringify(result).includes(secret),false);assert.equal(JSON.stringify(logs[0].metadata).includes(secret),false)
})

test('actual lookup sync atomically caches both canonical lists, preserves address aliases and uses configured revision',async()=>{
  const config=settings(),calls=[],writes=[],filters=[]
  const db={rpc:()=>({abortSignal:async()=>({data:true})}),from(table){assert.equal(table,'shipping_provider_settings');return {update(value){writes.push(value);return this},eq(key,value){filters.push([key,value]);return this},select(){return this},maybeSingle:async()=>({data:{id:'pdc'}})}}}
  const handler=routeHandler('server/api/admin-shipping/lookups.post.js',{
    requireAdminRequest:async()=>({supabaseAdmin:db,adminUser:{id:'admin'}}),getPdcSettings:async()=>({...config,updated_at:'revision'}),requirePdcReadAccess:()=>{},readPaymentCallbackBody:async()=>JSON.stringify({action:'sync'}),requestPdcLookup:async(_settings,operation)=>{calls.push(operation);return [{id:64,name:operation==='GetCities'?'City':'Product'}]},normalizePdcLookup,recordAdminActivity:async()=>{}
  })
  assert.equal((await handler({})).connected,true);assert.deepEqual(calls,['GetProducts','GetCities'])
  assert.equal(writes.length,1);assert.equal(writes[0].cities_cache[0].name,'City');assert.equal(writes[0].products_cache[0].name,'Product')
  assert.deepEqual(filters,[['id','pdc'],['updated_at','revision']])
  assert.equal(Object.hasOwn(writes[0],'product_id'),false)
})

test('actual mapping PATCH remains configurable and never changes broad order/payment mapping fields',async()=>{
  const writes=[]
  const handler=routeHandler('server/api/admin-shipping/mappings.patch.js',{
    requireAdminRequest:async(_event,options)=>{assert.equal(options.permission,'settings.edit');return {supabaseAdmin:{from(table){assert.equal(table,'shipping_status_mappings');return {upsert:async value=>{writes.push(value);return {}}}}},adminUser:{id:'admin'}}},readPaymentCallbackBody:async()=>JSON.stringify({provider_status_id:97,provider_label:'Confirmed hub state',normalized_state:'arrived_at_hub',provider_aliases:['Hub']}),shippingStates,recordAdminActivity:async()=>{}
  })
  assert.equal((await handler({})).saved,true);assert.equal(writes[0].normalized_state,'arrived_at_hub');assert.equal(Object.hasOwn(writes[0],'order_status'),false)
})

test('stalled uploads and stalled settings retrieval return failure comfortably before the provider deadline',async()=>{
  await withWebhook(async({server,db})=>{
    const started=Date.now()
    const status=await new Promise((resolve,reject)=>{
      const req=request({host:'127.0.0.1',port:server.address().port,path:'/pdc',method:'POST',headers:{'content-type':'application/json','x-webhook-secret':secret,'transfer-encoding':'chunked'}},res=>{res.resume();res.on('end',()=>{req.destroy();resolve(res.statusCode)})})
      req.on('error',reject);req.write('{')
    })
    assert.equal(status,408);assert.ok(Date.now()-started<3000);assert.equal(db.writes.length,0)
  })
  const db={from(){return {select(){return this},eq(){return this},maybeSingle(){return this},abortSignal(){return new Promise(()=>{})}}}}
  const app=createApp();app.use('/pdc',defineEventHandler(event=>handlePdcWebhook(event,db)))
  const server=createServer(toNodeListener(app));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  try{
    const started=Date.now()
    const response=await fetch(`http://127.0.0.1:${server.address().port}/pdc`,{method:'POST',headers:{'content-type':'application/json','x-webhook-secret':secret},body:JSON.stringify(payload())})
    assert.equal(response.status,503);assert.ok(Date.now()-started<9000)
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
})


test('existing creation cannot persist an AWB echoed for a different toRef',()=>{
  assert.equal(findShipmentResult({successResponses:[{ref:'expected',awb:'AWB-MATCH',success:true}]},'expected').awb,'AWB-MATCH')
  assert.throws(()=>findShipmentResult({successResponses:[{ref:'unrelated',awb:'AWB-OTHER',success:true}]},'expected'))
  assert.throws(()=>findShipmentResult({successResponses:[{ref:'expected',awb:'AWB-FAILED',success:false}]},'expected'))
  assert.throws(()=>findShipmentResult({AWB:'AWB-UNMATCHED'},'expected'))
})


test('an assigned shipment with no provider events exposes its AWB and the pending-update fallback only',()=>{
  const shipment=presentCustomerShipment({provider:'pdc',awb:'AWB-PENDING'},[],[])
  assert.equal(shipment.awb,'AWB-PENDING');assert.equal(shipment.has_update,false)
  assert.equal(shipment.current_state,'unknown');assert.deepEqual(shipment.events,[])
  assert.deepEqual(shipmentTimeline({created_at:'2026-10-01T00:00:00Z'},shipment).map(step=>step.id),['placed'])
})
