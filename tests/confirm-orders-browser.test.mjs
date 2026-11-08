import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, readdir, mkdir } from 'node:fs/promises'
import { resolve, dirname, join } from 'node:path'
import { build } from 'esbuild'
import { parse, compileScript } from '@vue/compiler-sfc'

const playwright = process.env.COD_REVIEW_PLAYWRIGHT
const cssDir = process.env.CONFIRM_REVIEW_CSS_DIR, shots = process.env.CONFIRM_REVIEW_SHOTS
const helper = `import {createApp,h,ref,reactive,computed,shallowRef,watch,nextTick,onMounted,onBeforeUnmount,Suspense} from 'vue';
import Page from './app/pages/dashboard/orders/confirm.vue';import Panel from './app/components/dashboard/OrderCourierPanel.vue';
const locale=window.__fixture.locale,dict=window.__fixture.dict;
const look=key=>key.split('.').reduce((a,k)=>a?.[k],dict);
const translate=(key,args={})=>String(look(key)??key).replace(/\\{(\\w+)\\}/g,(m,k)=>args[k]??m);
Object.assign(globalThis,{ref,reactive,computed,shallowRef,watch,nextTick,onMounted,onBeforeUnmount,onBeforeRouteLeave:()=>{},definePageMeta:()=>{},
 useUiLocale:()=>({uiLabel:x=>x,intlLocale:ref(locale==='ar'?'ar-EG':'en-US')}),useI18n:()=>({t:translate}),
 useSupabaseClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'fixture'}}})}}),useSiteContent:async()=>({data:ref({settings:{site_name:'Store'}})}),
 useNuxtData:()=>({data:ref({mode:window.__fixture.erp})}),
 $fetch:async(url,options={})=>{const query=options.query?'?'+new URLSearchParams(options.query):'';const body=options.body;const blob=body instanceof Blob;
  const r=await fetch(url+query,{method:options.method||'GET',headers:{...(blob?{}:{'content-type':'application/json'}),...options.headers},...(body?{body:blob?body:JSON.stringify(body)}:{})});
  const data=(r.headers.get('content-type')||'').includes('json')?await r.json():await r.blob();if(!r.ok)throw Object.assign(Error(data.statusMessage||'HTTP '+r.status),{statusCode:r.status,data});return data}});
const Stub=(tag,cls='')=>({inheritAttrs:false,setup:(_,{slots,attrs})=>()=>h(tag,{...attrs,class:[cls,attrs.class]},slots.default?.())});
const app=createApp({render:()=>h(Suspense,null,{default:()=>h(Page)})});
app.component('NuxtLinkLocale',Stub('a'));app.component('Icon',{props:['name','size'],setup:p=>()=>h('i',{'data-icon':p.name,style:{display:'inline-block',width:(p.size||16)+'px',height:(p.size||16)+'px'}})});
app.component('DashboardOrderCourierPanel',Panel);app.component('DashboardShippingLabelPreview',Stub('div'));
app.config.globalProperties.$t=translate;app.config.globalProperties.$uiMessage=x=>x;app.config.globalProperties.$uiLabel=x=>x;app.mount('#app');`
const bundle = async () => build({ stdin: { contents: helper, sourcefile: 'confirm-fixture.js', resolveDir: resolve('.') }, bundle: true, write: false, format: 'iife', platform: 'browser', alias: { '~': resolve('app') }, define: { 'import.meta.client': 'true', 'process.env.NODE_ENV': '"test"', __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' }, target: 'es2022', plugins: [{ name: 'vue', setup(b) { b.onLoad({ filter: /\.vue$/ }, async ({ path }) => ({ contents: compileScript(parse(await readFile(path, 'utf8'), { filename: path }).descriptor, { id: path, inlineTemplate: true }).content, loader: 'js', resolveDir: dirname(path) })) } }] })

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const items = quantity => [
 { id: uuid(11), product_title: 'Fantech GO W190 Dual-Mode Wireless Mouse', variant_name: 'Default', quantity, can_check: true, scans: [], remaining: quantity, is_complete: false },
 { id: uuid(12), product_title: 'AULA F75 Wireless Mechanical Keyboard - Gradient Grey Switch Reaper', variant_name: 'Black', quantity: 1, can_check: true, scans: [], remaining: 1, is_complete: false },
 { id: uuid(13), product_title: 'Logitech G435 Lightspeed Headset', variant_name: 'Default', quantity: 1, can_check: true, scans: [], remaining: 1, is_complete: false }]
const state = () => ({ work: null, detail: null, queue: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => ({ id: uuid(n), order_number: `ORD-20261108-${String(n).padStart(4, '0')}`, first_name: n % 2 ? 'Mona' : 'Ahmed', last_name: 'Hassan', total_quantity: 3, active_session: n === 2 ? { processor_name: 'Karim', can_take_over: true, is_current_admin: false } : n === 3 ? { processor_name: 'Sara', can_take_over: false, is_current_admin: false } : null })), courier: { provider: 'pdc', state: 'not_booked', awb: null, label_ready: false, default_weight_kg: 1.5 }, bill: null, booked: null, heartbeat: 0, conflict: false, activeId: '', moved: false, cancelled: false, uploaded: 0 })
let fixture, dict
const json = (res, status, body) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)) }
const read = async req => { const chunks = []; for await (const c of req) chunks.push(c); return Buffer.concat(chunks) }
const handle = async (req, res, js) => {
 const url = new URL(req.url, 'http://fixture.invalid'), path = url.pathname
 if (path === '/fixture.js') { res.setHeader('content-type', 'text/javascript'); res.end(js); return }
 if (path === '/api/admin-orders/packing/work-session') {
  if (req.method === 'GET') return json(res, 200, { workSession: fixture.work, activePackingSessionId: fixture.activeId || null })
  const body = JSON.parse(await read(req))
  if (body.action === 'heartbeat') { fixture.heartbeat++; if (fixture.moved) return json(res, 409, { statusMessage: 'moved', data: { code: 'moved' } }); return json(res, 200, { ok: true }) }
  if (body.action === 'close') { fixture.work = null; return json(res, 200, { workSession: null }) }
  if (fixture.conflict && !body.force) return json(res, 409, { statusMessage: 'elsewhere', data: { code: 'open_elsewhere' } })
  fixture.work = { id: uuid(900), status: 'active', operator_name: 'Hesham', started_at: new Date(Date.now() - 720000).toISOString() }
  return json(res, 200, { workSession: fixture.work })
 }
 if (path === '/api/admin-orders/packing' && req.method === 'GET') { if (url.searchParams.get('view') === 'confirmed') return json(res, 200, { total: 1, orders: [{ session_id: uuid(800), order_id: uuid(1), order_number: 'ORD-20261108-0001', customer_name: 'Mona Hassan', processor_name: 'Hesham', completed_at: new Date().toISOString(), courier_state: 'ready', awb: 'E7663BB000', label_ready: true }] }); return json(res, 200, { orders: fixture.queue, total: fixture.queue.length, currentSessionId: fixture.activeId || null }) }
 if (path === '/api/admin-orders/packing' && req.method === 'POST') {
  const body = JSON.parse(await read(req)); fixture.lastClaim = body
  fixture.activeId = uuid(800)
  fixture.detail = { session: { id: uuid(800), status: 'active' }, order: { id: body.orderId, order_number: 'ORD-20261108-0001', first_name: 'Mona', last_name: 'Hassan', phone: '01012345678', street_address: '12 Tahrir Street, Apartment 4', city: 'Dokki', governorate: 'Giza', total_amount: 3061, payment_method: 'cash', payment_status: 'pending', currency: 'EGP' }, customer: {}, items: items(2), messages: [], video: null, progress: {} }
  return json(res, 200, { detail: fixture.detail, session: fixture.detail.session })
 }
 const session = path.match(/^\/api\/admin-orders\/packing\/[0-9a-f-]{36}(?:\/([\w-]+))?$/)
 if (session) {
  const action = session[1]
  if (!action) return json(res, 200, fixture.detail || { session: { id: uuid(800), status: 'active' }, order: { order_number: 'ORD-OLD' }, items: [], video: null })
  if (action === 'scan') { const body = JSON.parse(await read(req)); const item = fixture.detail.items.find(x => x.id === body.itemId); assert.ok(item, 'Tap sends the item id'); item.scans = Array.from({ length: item.quantity }, () => ({})); item.remaining = 0; item.is_complete = true; return json(res, 200, { detail: fixture.detail, lastScan: { message: `${item.product_title} checked.` } }) }
  if (action === 'video-upload') { await read(req); fixture.detail.video = { status: 'uploading' }; return json(res, 200, { video: fixture.detail.video, upload: { url: `/api/admin-orders/packing/${uuid(800)}/video-content?upload=x` } }) }
  if (action === 'video-content') { fixture.uploaded = (await read(req)).length; return json(res, 200, { video: { status: 'ready' } }) }
  if (action === 'video-complete') { fixture.detail.video = { status: 'ready', file_name: 'v.webm' }; return json(res, 200, { video: fixture.detail.video }) }
  if (action === 'complete') { fixture.detail.session.status = 'completed'; fixture.detail.order.status = 'ready_to_deliver'; fixture.activeId = ''; return json(res, 200, { detail: fixture.detail }) }
  if (action === 'release') { fixture.released = true; fixture.activeId = ''; return json(res, 200, { ok: true }) }
  if (action === 'cancel-order') { fixture.cancelled = true; fixture.activeId = ''; return json(res, 200, { order: {} }) }
 }
 if (/^\/api\/admin-shipping\/orders\/[0-9a-f-]{36}\/booking$/.test(path)) { fixture.booked = JSON.parse(await read(req)); fixture.courier = { provider: 'pdc', state: 'label_pending', awb: 'E7663BB000', label_ready: false, default_weight_kg: 1.5 }; return json(res, 200, { state: 'label_pending' }) }
 if (/^\/api\/admin-orders\/[0-9a-f-]{36}$/.test(path)) return json(res, 200, { order: { status: fixture.detail?.order?.status || 'ready_to_deliver' }, shipping: fixture.courier, bill: fixture.bill })
 res.setHeader('content-type', 'text/html')
 const css = fixture.css || ''
 res.end(`<!doctype html><html lang="${fixture.locale}" dir="${fixture.locale === 'ar' ? 'rtl' : 'ltr'}" class="${fixture.dark ? 'dark' : ''}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body style="margin:0"><div style="padding:1rem"><div id="app"></div></div><script>window.__fixture=${JSON.stringify({ locale: fixture.locale, dict, erp: 'daftra' })}</script><script src="/fixture.js"></script></body></html>`)
}

test('Confirm Orders in a real browser with a fake camera', { skip: !playwright, timeout: 240000 }, async t => {
 const { chromium } = await import(playwright)
 const js = (await bundle()).outputFiles[0].text
 let css = ''
 if (cssDir) for (const name of await readdir(cssDir)) if (name.endsWith('.css')) css += await readFile(join(cssDir, name), 'utf8')
 const en = JSON.parse(await readFile('i18n/locales/en.json', 'utf8')), ar = JSON.parse(await readFile('i18n/locales/ar.json', 'utf8'))
 const server = createServer((req, res) => handle(req, res, js).catch(error => json(res, 500, { statusMessage: String(error.message) })))
 await new Promise(r => server.listen(0, '127.0.0.1', r))
 const origin = 'http://127.0.0.1:' + server.address().port
 const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] })
 const open = async ({ locale = 'en', width = 1440, height = 900, dark = false, prepare = () => {} } = {}) => {
  fixture = { ...state(), locale, dark, css }; dict = locale === 'ar' ? ar : en; prepare()
  const context = await browser.newContext({ viewport: { width, height }, permissions: ['camera'] }), page = await context.newPage(), errors = []
  page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept())
  await page.goto(origin)
  return { context, page, errors }
 }
 const shot = async (page, name) => { if (shots) { await mkdir(shots, { recursive: true }); await page.waitForTimeout(250); await page.screenshot({ path: join(shots, name + '.png') }) } }
 try {
  for (const [locale, width, height, dark] of [['en', 1440, 900, false], ['en', 1280, 720, false], ['ar', 1440, 900, false], ['en', 1440, 900, true], ['en', 390, 844, false]]) await t.test(`${locale} ${width}x${height}${dark ? ' dark' : ''}: start, tap each item, finish and book in one press`, async () => {
   const name = `${locale}-${width}${dark ? '-dark' : ''}`, L = locale === 'ar' ? ar.confirmOrders : en.confirmOrders
   const { context, page, errors } = await open({ locale, width, height, dark })
   await page.getByRole('button', { name: (locale === 'ar' ? ar : en).common.startSession }).click()
   await page.waitForFunction(() => document.querySelector('video')?.srcObject?.active)
   await page.getByText(L.chooseOrder).waitFor(); await shot(page, name + '-1-idle')
   await page.getByText('ORD-20261108-0001').first().click()
   await page.getByRole('button', { name: L.check, exact: true }).first().waitFor(); await shot(page, name + '-2-packing')
   assert.equal(await page.getByLabel((locale === 'ar' ? ar : en).pdcParcel.weight).inputValue(), '1.5', 'The default weight is filled in')
   assert.equal(await page.getByRole('button', { name: L.finishBook }).isDisabled(), true, 'Finish waits for every item')
   if (css && width >= 1280) assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 40), true, 'No page scrolling on desktop')
   for (let i = 0; i < 3; i++) await page.getByRole('button', { name: L.check, exact: true }).first().click(), await page.waitForTimeout(120)
   await page.getByText(L.progress.replace('{value0}', '4').replace('{value1}', '4')).waitFor(); await shot(page, name + '-3-checked')
   await page.getByRole('button', { name: L.finishBook }).click()
   await page.getByText(L.doneTitle).waitFor(); await page.getByText('E7663BB000').first().waitFor(); await shot(page, name + '-4-done')
   assert.ok(fixture.uploaded > 0, 'The video was uploaded'); assert.deepEqual(fixture.booked, { action: 'book', actual_weight_kg: 1.5, weight_confirmed: true })
   if (css) assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'No sideways scrolling')
   await page.getByRole('tab', { name: L.tabDone }).click(); await page.getByText('ORD-20261108-0001').last().waitFor(); await shot(page, name + '-5-confirmed')
   assert.deepEqual(errors, []); await context.close()
  })
  await t.test('a reload loses the recording, so the unfinished order goes back and says why', async () => {
   const { context, page, errors } = await open({ prepare: () => { fixture.work = { id: uuid(900), status: 'active', operator_name: 'Hesham', started_at: new Date().toISOString() }; fixture.activeId = uuid(800) } })
   await page.getByText(en.confirmOrders.interrupted.replace('{value0}', 'ORD-OLD')).waitFor()
   assert.equal(fixture.released, true); assert.deepEqual(errors, []); await context.close()
  })
  await t.test('a second screen must choose, and a moved session stops this one', async () => {
   const { context, page, errors } = await open({ prepare: () => { fixture.work = { id: uuid(900), status: 'active', operator_name: 'Hesham', started_at: new Date().toISOString() }; fixture.conflict = true } })
   await page.getByText(en.confirmOrders.elsewhereTitle).waitFor(); await shot(page, 'elsewhere')
   await page.getByRole('button', { name: en.confirmOrders.useHere }).click()
   await page.getByText(en.confirmOrders.chooseOrder).waitFor()
   assert.deepEqual(errors, []); await context.close()
  })
  await t.test('takeover asks first and claims with the takeover flag', async () => {
   const { context, page } = await open()
   await page.getByRole('button', { name: en.common.startSession }).click()
   await page.waitForFunction(() => document.querySelector('video')?.srcObject?.active)
   await page.getByRole('button', { name: en.confirmOrders.takeover }).click()
   await page.getByRole('button', { name: en.confirmOrders.check, exact: true }).first().waitFor()
   assert.equal(fixture.lastClaim.takeover, true); await context.close()
  })
  await t.test('Cancel order is inside the problem panel', async () => {
   const { context, page } = await open()
   await page.getByRole('button', { name: en.common.startSession }).click()
   await page.waitForFunction(() => document.querySelector('video')?.srcObject?.active)
   await page.getByText('ORD-20261108-0001').first().click()
   await page.getByRole('button', { name: en.confirmOrders.problem, exact: true }).click(); await shot(page, 'problem')
   await page.getByRole('button', { name: en.confirmOrders.cancelOrder }).click()
   await page.getByText(en.confirmOrders.cancelled.replace('{value0}', 'ORD-20261108-0001')).waitFor()
   assert.equal(fixture.cancelled, true); await context.close()
  })
 } finally { await browser.close(); await new Promise(r => server.close(r)) }
})
