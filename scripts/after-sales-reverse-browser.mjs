// Actual Vue components + built CSS + real H3/RBAC/disposable SQL. Auth and
// Storage transport are fixtures; no production credentials or external calls.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { parse, compileScript } from '@vue/compiler-sfc'
import { defineEventHandler } from 'h3'
import { attachReverseFixture, reverseFixtureRuntime } from '../tests/helpers/reverseFixture.mjs'
import { processPdcReverseQueue } from '../server/utils/pdcReverseLogistics.js'
import { createClaimsHttpFixture } from '../tests/helpers/claimsHttpFixture.mjs'
const { chromium } = await import(pathToFileURL(process.env.CLAIMS_REVIEW_PLAYWRIGHT || '/private/tmp/elcomputer-pdc-review-tools/node_modules/playwright/index.mjs').href)
const base = resolve(new URL('..', import.meta.url).pathname), dir = process.env.REVERSE_REVIEW_ARTIFACTS || '/tmp/elcomputer-after-sales-reverse-browser'
await mkdir(dir, { recursive: true })
const components = { Communications: 'after-sales/Communications.vue', ReverseLogistics: 'after-sales/ReverseLogistics.vue', Center: 'after-sales/Center.vue', Detail: 'after-sales/Detail.vue', ClaimForm: 'after-sales/ClaimForm.vue', EvidencePicker: 'after-sales/EvidencePicker.vue', Timeline: 'after-sales/Timeline.vue', ItemWarranty: 'account/ItemWarranty.vue', Navigation: 'account/Navigation.vue' }
for (const [name, file] of Object.entries(components)) {
  const { descriptor } = parse(await readFile(join(base, 'app/components', file), 'utf8'))
  await writeFile(join(dir, name + '.js'), compileScript(descriptor, { id: 'claims-' + name, inlineTemplate: true }).content)
}
const originalFetch = globalThis.fetch
const f = await attachReverseFixture(await createClaimsHttpFixture({ shipping: true })), providerCalls = []
reverseFixtureRuntime.shippingWorkerSecret = 'reverse-browser-worker-secret-over-32-characters'
await f.configure()
const providerMock = async (url, options) => {
  if (!String(url).startsWith('https://clientsapi.pdc-eg.com/api/ClientUsers/V6/')) throw Error('Unexpected external fixture request')
  const body = JSON.parse(options.body); providerCalls.push({ url: String(url), body })
  if (String(url).endsWith('SaveShipmentEx')) return new Response(JSON.stringify({ generalResponse: { success: true }, successResponses: [{ ref: body.shipments[0].toRef, awb: 'REVERSE-BROWSER-' + providerCalls.length, success: true, errors: null }] }), { headers: { 'content-type': 'application/json' } })
  if (String(url).endsWith('ExportPDF')) return new Response('%PDF-1.7\nBrowser reverse label', { headers: { 'content-type': 'application/pdf' } })
  if (String(url).endsWith('GetShipmentsStatus')) return new Response(JSON.stringify([{ Ref: body.reFs, AWB: body.awBs || 'RECOVERED-BROWSER', Status: 'In Transit', StatusID: 82, StatusDate: new Date(Date.now()+1000).toISOString() }]), { headers: { 'content-type': 'application/json' } })
  throw Error('Unexpected provider operation')
}
globalThis.fetch = providerMock
const approved = await f.approve(), warranty = await f.approve('warranty')
const prepare = async (type = 'return', status = null) => {
  const claim = await f.approve(type), scheduled = await f.schedule(claim.id, f.input({ handling_resolution: type === 'return' ? 'refund' : 'repair' }))
  await processPdcReverseQueue({ supabaseAdmin: f.client, fetcher: providerMock, runtime: reverseFixtureRuntime })
  const job = await f.job(scheduled.id); if (status) await f.record(f.event(job, status))
  return claim
}
const booked = await prepare(), exception = await prepare('return',15), received = await prepare('warranty',5)
const uncertain = await f.approve(), uncertainStage = await f.schedule(uncertain.id), uncertainWork = (await f.take()).find(x=>x.id===uncertainStage.id)
await f.finish(uncertainWork,'uncertain',null,'timeout')
const admins = Object.fromEntries((await f.db.query('select id,role,is_active,permissions from public.admin_users')).rows.map(row => [Object.keys(f.actors).find(name => f.actors[name] === row.id), row]))
await writeFile(join(dir, 'entry.js'), `
import {createApp,h,ref,reactive,computed,onMounted,onBeforeUnmount,watch,nextTick,resolveComponent} from 'vue';import{createI18n}from'vue-i18n';
${Object.keys(components).map(name => `import ${name} from './${name}.js'`).join(';')};
import en from '${join(base, 'i18n/locales/en.json')}';import ar from '${join(base, 'i18n/locales/ar.json')}';
import{useUiLocale}from'${join(base, 'app/composables/useUiLocale.js')}';import{hasAdminPermission}from'${join(base, 'app/utils/adminPermissions.js')}';
const i18n=createI18n({legacy:false,locale:'en',messages:{en,ar}}),actor=ref('buyer'),staff=ref(false),view=ref('center'),claimId=ref(''),generation=ref(0),theme=ref('light'),downloads=[],admins=${JSON.stringify(admins)};
const route=reactive({path:'/account/after-sales',query:{},params:{}});
const appearance=()=>{document.documentElement.lang=i18n.global.locale.value;document.documentElement.dir=i18n.global.locale.value==='ar'?'rtl':'ltr';document.documentElement.classList.toggle('dark',theme.value==='dark'||theme.value==='system'&&matchMedia('(prefers-color-scheme:dark)').matches)};matchMedia('(prefers-color-scheme:dark)').addEventListener('change',appearance);
const show=async(kind,isStaff=false,id='',name=isStaff?'owner':'buyer')=>{actor.value=name;staff.value=isStaff;view.value=kind;claimId.value=id;route.path=(isStaff?'/dashboard/after-sales':'/account/after-sales')+(id?'/'+id:'');generation.value++;appearance();await nextTick()};
const navigate=to=>{const path=typeof to==='string'?to:to.path;const id=/after-sales\\/([a-f0-9-]{36})/.exec(path)?.[1]||'';return show(id?'detail':'center',path.startsWith('/dashboard'),id,path.startsWith('/dashboard')?actor.value:'buyer')};
const request=async(path,options={})=>{if(path==='/api/support/unread')return{unreadTicketCount:0};const url=path+(options.query?'?'+new URLSearchParams(options.query):'');const isForm=options.body instanceof FormData;const response=await fetch(url,{method:options.method||'GET',headers:{authorization:'Bearer '+actor.value,...(isForm?{}:{'content-type':'application/json'})},...(options.body?{body:isForm?options.body:JSON.stringify(options.body)}:{})});const data=await response.json();if(!response.ok)throw{statusCode:response.status,data};return data};
const downloadFrom=async(path,name)=>{const response=await fetch(path,{headers:{authorization:'Bearer '+actor.value}});if(!response.ok)throw{data:await response.json()};downloads.push({name,bytes:(await response.arrayBuffer()).byteLength})};
Object.assign(globalThis,{ref,reactive,computed,onMounted,onBeforeUnmount,watch,nextTick,resolveComponent,useI18n:()=>i18n.global,useNuxtApp:()=>({$i18n:i18n.global}),useUiLocale,useUiRoute:()=>route,useUiNavigation:()=>({uiNavigateTo:navigate}),useSupportClient:()=>({request,downloadFrom}),useAdminAccess:()=>({hasPermission:key=>hasAdminPermission(admins[actor.value],key)})});
const app=createApp({render:()=>h('main',{class:'p-4 mx-auto max-w-6xl '+(staff.value?'dashboard-modern':'account-modern')},[!staff.value?h(Navigation,{variant:'modern',key:'nav'+generation.value}):null,view.value==='center'?h(Center,{staff:staff.value,key:generation.value}):h(Detail,{staff:staff.value,id:claimId.value,key:generation.value})])});app.use(i18n);for(const[name,component]of Object.entries({AfterSalesCenter:Center,AfterSalesDetail:Detail,AfterSalesClaimForm:ClaimForm,AfterSalesEvidencePicker:EvidencePicker,AfterSalesTimeline:Timeline,AfterSalesCommunications:Communications,AfterSalesReverseLogistics:ReverseLogistics,AccountItemWarranty:ItemWarranty}))app.component(name,component);app.component('NuxtLinkLocale',{props:['to'],setup(props,{slots}){return()=>h('a',{href:'#',onClick:event=>{event.preventDefault();navigate(props.to)}},slots.default?.())}});app.component('Icon',{render(){return h('span',{'aria-hidden':'true'},'•')}});app.config.globalProperties.$uiLabel=value=>useUiLocale().uiLabel(value);app.config.globalProperties.$uiMessage=value=>useUiLocale().uiMessage(value);app.mount('#app');appearance();window.claimsTest={show,locale:i18n.global.locale,theme,appearance,downloads};
`)
await build({ entryPoints: [join(dir, 'entry.js')], bundle: true, outfile: join(dir, 'bundle.js'), alias: { '~': join(base, 'app') }, nodePaths: [join(base, 'node_modules')], define: { 'process.env.NODE_ENV': '"test"', __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' } })
const css = (await Promise.all((await readdir(join(base, '.output/public/_nuxt'))).filter(file => file.endsWith('.css')).map(file => readFile(join(base, '.output/public/_nuxt', file), 'utf8')))).join('\n')
const { url, close } = await f.start(defineEventHandler(async event => { event.node.res.setHeader('content-type', event.path === '/bundle.js' ? 'text/javascript' : 'text/html'); return event.path === '/bundle.js' ? readFile(join(dir, 'bundle.js'), 'utf8') : `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body class="bg-slate-100"><div id="app"></div><script src="/bundle.js"></script></body></html>` }))
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true }), page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = [], external = [], scans = []
let assertions = 0, screens = 0, states = 0
const check = (value, message) => { assert.ok(value, message); assertions++ }
page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (['warning','error'].includes(message.type())) errors.push(message.text()) })
await page.route('**/*', route => route.request().url().startsWith(url) ? route.continue() : (external.push(route.request().url()), route.abort()))
page.on('response', response => { if ((response.headers()['content-type'] || '').includes('json')) scans.push({ path: new URL(response.url()).pathname, status: response.status() }) })
const show = async (view, staff = false, id = '', actor = staff ? 'owner' : 'buyer') => { await page.evaluate(args => window.claimsTest.show(...args), [view, staff, id, actor]); await page.locator(view === 'center' ? '[data-claim-row]' : '[data-claim-timeline]').first().waitFor(); await page.waitForFunction(() => document.querySelector('[data-reverse-logistics]')?.getAttribute('aria-busy') === 'false'); await page.waitForTimeout(50) }
const inspect = async label => { check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No overflow: ' + label); check(!/(?<![@\w.])(?:claims|reverse|shipment)\.[A-Za-z]/.test(await page.locator('main').innerText()), 'All labels translated: ' + label); check(await page.locator('html').getAttribute('dir') === (await page.evaluate(() => window.claimsTest.locale.value) === 'ar' ? 'rtl' : 'ltr'), 'Direction: ' + label); await page.screenshot({ path: join(dir, label + '.png'), fullPage: true }); screens++; states++ }
const en = await readFile(join(base, 'i18n/locales/en.json'), 'utf8'), ar = await readFile(join(base, 'i18n/locales/ar.json'), 'utf8'), messages = { en: JSON.parse(en), ar: JSON.parse(ar) }
const button = (key, language = 'en') => page.getByRole('button', { name: messages[language].claims[key], exact: true })
const staffAction = async (action, text = 'Browser staff decision', resolution = null, requireFile = false) => {
  await page.locator('[data-claim-action]').selectOption(action); const form = page.locator('form').last(); await form.locator('textarea').fill(text)
  if (resolution) await page.locator('[data-claim-resolution]').selectOption(resolution)
  if (action === 'request_information' && requireFile) await form.getByRole('checkbox').check()
  await button('saveAction').click(); await page.getByRole('status').filter({ hasText: messages.en.claims.saved }).waitFor(); await page.waitForTimeout(80)
}
const reverseButton = (key, language='en') => page.getByRole('button',{name:messages[language].reverse[key],exact:true})
const openPickup = async () => { await page.locator('[data-reverse-begin]').click(); await page.locator('[data-reverse-form]').waitFor() }
const fillPickup = async () => {
  const form=page.locator('[data-reverse-form]'); await form.locator('input').nth(0).fill('Current Browser Buyer'); await form.locator('input').nth(1).fill('01012345678')
  await form.locator('select').first().selectOption(f.mapping.id); await form.locator('textarea').first().fill('Current browser alternate pickup address')
  await form.locator('textarea').nth(1).fill('Customer confirmed the pickup details.'); await form.getByRole('checkbox').check()
}
const runWorker = async () => { const response=await originalFetch(url+'/api/internal/shipping/process',{method:'POST',headers:{'content-type':'application/json','x-shipping-worker-secret':reverseFixtureRuntime.shippingWorkerSecret},body:'{"limit":10}'}); check(response.status===200,'Existing authenticated worker'); return response.json() }
const refreshClaim = async () => { await page.locator('[data-claim-detail] > header button').click(); await page.waitForFunction(()=>document.querySelector('[data-reverse-logistics]')?.getAttribute('aria-busy')==='false'); await page.waitForTimeout(80) }
try {
  await page.goto(url)
  for(const language of ['en','ar']) for(const width of [1440,390]) for(const theme of ['light','dark','system']) {
    const label=language+'-'+width+'-'+theme
    await page.setViewportSize({width,height:1000}); await page.emulateMedia({colorScheme:theme==='light'?'light':'dark'})
    await page.evaluate(({language,theme})=>{window.claimsTest.locale.value=language;window.claimsTest.theme.value=theme;window.claimsTest.appearance()},{language,theme})
    reverseFixtureRuntime.shippingLiveRequestsEnabled=false
    await show('detail',true,approved.id);check(await page.locator('[data-reverse-disabled]').count()===1,'Provider disabled shown');check(await page.locator('[data-reverse-begin]').isDisabled(),'Dormant pickup cannot start');await inspect(label+'-provider-disabled')
    reverseFixtureRuntime.shippingLiveRequestsEnabled=true
    await show('detail',true,approved.id);await openPickup();check(await page.locator('[data-reverse-form] input').nth(0).inputValue()==='Buyer Fixture','Order contact prefilled');await inspect(label+'-return-confirmation')
    await show('detail',true,warranty.id);await openPickup();check(await page.locator('[data-reverse-form] select').nth(1).locator('option[value="service_center"]').count()===0,'Service-center path cannot book pickup');await inspect(label+'-warranty-confirmation')
    await show('detail',true,booked.id);check(await page.locator('[data-reverse-awb]').count()===1,'Booked AWB shown');check(await page.locator('[data-reverse-begin]').count()===0,'Active booking cannot duplicate');await inspect(label+'-staff-booked')
    await show('detail',false,booked.id);check(await page.locator('[data-reverse-awb]').count()===1,'Customer safe AWB');check(await page.locator('[data-reverse-form]').count()===0,'Customer cannot book');check(!(await page.locator('main').innerText()).includes('PRIVATE-PROVIDER'),'Raw diagnostics hidden');await inspect(label+'-customer-booked')
    await show('detail',true,exception.id);check((await f.detail(exception.id)).claim.status==='pickup_scheduled','Exception preserves claim');await inspect(label+'-exception')
    await show('detail',false,received.id);check((await f.detail(received.id)).claim.status==='received','Provider receipt mapped');await inspect(label+'-received')
    await show('detail',true,uncertain.id);check(await reverseButton('recover',language).count()===1,'Uncertain has recovery');check(await page.locator('[data-reverse-begin]').count()===0,'Uncertain cannot rebook');await inspect(label+'-uncertain')
    await show('detail',true,approved.id,'viewer');check(await page.locator('[data-reverse-begin]').count()===0,'View-only staff cannot schedule');check((await page.locator('main').innerText()).includes(messages[language].reverse.restricted),'Granular logistics permission');await inspect(label+'-read-only')
  }
  await page.evaluate(()=>{window.claimsTest.locale.value='en';window.claimsTest.theme.value='system';window.claimsTest.appearance()})
  await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>!document.documentElement.classList.contains('dark'));check(true,'System tracks OS light')
  await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.classList.contains('dark'));check(true,'System tracks OS dark')
  await show('detail',true,approved.id,'booker');await openPickup();await fillPickup()
  const form=page.locator('[data-reverse-form]');await form.locator('input').nth(1).fill('123');await form.locator('button[type="submit"]').click();check(await form.locator('input').nth(1).evaluate(el=>!el.validity.valid),'Invalid phone blocks form');check((await f.view(approved.id)).jobs.length===0,'Invalid form has no intent')
  await form.locator('input').nth(1).fill('01012345678');const originalOrder=await f.order(approved.item.order_id);const creates=providerCalls.filter(x=>x.url.endsWith('SaveShipmentEx')).length
  await form.locator('button[type="submit"]').click();await page.waitForFunction(()=>document.querySelector('[data-reverse-job]')?.textContent.includes('Awaiting booking'))
  check(providerCalls.filter(x=>x.url.endsWith('SaveShipmentEx')).length===creates,'Dashboard only queues intent');check((await f.detail(approved.id)).claim.status==='approved','Queue does not confirm pickup')
  await runWorker();await refreshClaim();check((await f.detail(approved.id)).claim.status==='pickup_scheduled','Mocked worker confirms Pickup Scheduled');check(providerCalls.filter(x=>x.url.endsWith('SaveShipmentEx')).length===creates+1,'Exactly one creation')
  check((await f.view(approved.id)).jobs[0].pickup.address==='Current browser alternate pickup address','Alternate pickup persisted');assert.deepEqual(await f.order(approved.item.order_id),originalOrder);check(true,'Original shipping snapshot unchanged')
  await reverseButton('prepareLabel').click();await runWorker();await refreshClaim();await reverseButton('downloadLabel').click();await page.waitForFunction(()=>window.claimsTest.downloads.some(x=>x.name.startsWith('PDC-')&&x.bytes>5));check(true,'Private label retrieved through authorized API')
  await show('detail',true,approved.id,'rebooker');await reverseButton('refresh').click();await page.waitForTimeout(180);await refreshClaim();check((await f.detail(approved.id)).claim.status==='in_transit','Reconciliation advances transit');await inspect('actual-transit')
  const job=(await f.view(approved.id)).jobs[0], payload={AWB:job.awb,REF:job.to_ref,StatusID:5,CustomerStatusName:'Delivered',ReasonName:'PRIVATE-BROWSER-PROVIDER-REASON',StatusDate:new Date(Date.now()+5000).toISOString()}
  const response=await originalFetch(url+'/api/webhooks/pdc',{method:'POST',headers:{'content-type':'application/json','x-webhook-secret':'reverse-fixture-webhook-secret-minimum-32-characters'},body:JSON.stringify(payload)});check(response.status===200,'Existing webhook accepts reverse reference')
  await show('detail',false,approved.id);check((await f.detail(approved.id)).claim.status==='received','Webhook confirms Received');check(!(await page.locator('main').innerText()).includes('PRIVATE-BROWSER'),'Customer diagnostics remain private');await inspect('actual-received')
  await show('detail',true,approved.id);await staffAction('inspect','Received item inspection started');check((await f.detail(approved.id)).claim.status==='under_inspection','Existing Claims inspection continues')
  await show('detail',true,uncertain.id,'rebooker');const recoverCreates=providerCalls.filter(x=>x.url.endsWith('SaveShipmentEx')).length;await reverseButton('recover').click();await page.waitForTimeout(160);await refreshClaim();check((await f.detail(uncertain.id)).claim.status==='in_transit','Uncertain recovery uses reference');check(providerCalls.filter(x=>x.url.endsWith('SaveShipmentEx')).length===recoverCreates,'Recovery never recreates')
  for(const table of ['shipping_order_jobs','sms_batches','sms_messages','payment_transactions','commerce_order_returns'])check(Number((await f.db.query('select count(*) n from public.'+table)).rows[0].n)===0,'No outbound/finance/inventory/communication ledger: '+table)
  check(errors.length===0,'No browser errors: '+errors.join('\n'));check(external.length===0,'No external browser requests')
  await writeFile(join(dir,'results.json'),JSON.stringify({assertions,states,screens,responseScans:scans.length,errors,external,mockedProviderOperations:providerCalls.length,authentication:'Fixture only; actual Vue/H3/RBAC/disposable SQL'},null,2));console.log(JSON.stringify({assertions,states,screens,responseScans:scans.length,errors,external,mockedProviderOperations:providerCalls.length}))
} catch(error) {await page.screenshot({path:join(dir,'failure.png'),fullPage:true});await writeFile(join(dir,'failure.json'),JSON.stringify({message:error.message,assertions,states,errors,external},null,2));throw error}
finally {globalThis.fetch=originalFetch;await browser.close();await close()}
