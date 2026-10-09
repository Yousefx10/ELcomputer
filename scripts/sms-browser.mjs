// Actual Vue page and shared preferences under isolated fixtures. No accounts,
// production database, Vodafone network, or real credentials are used.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parse, compileScript, compileStyle } from '@vue/compiler-sfc'
import { build } from 'esbuild'
const { chromium } = await import(process.env.SMS_REVIEW_PLAYWRIGHT ? pathToFileURL(process.env.SMS_REVIEW_PLAYWRIGHT).href : 'playwright')
const base = resolve(new URL('..', import.meta.url).pathname)
const dir = process.env.SMS_REVIEW_ARTIFACTS || '/tmp/elcomputer-sms-review/browser'
await mkdir(dir, { recursive: true })
let pageStyle = ''
for (const [name, file] of Object.entries({ Sms: 'app/pages/dashboard/sms.vue', Launcher: 'app/components/live-chat/Launcher.vue', Preferences: 'app/components/UiPreferences.vue', OrderList: 'app/pages/dashboard/orders/index.vue', OrderDialog: 'app/components/dashboard/OrderDetailsDialog.vue', Checkout: 'app/pages/checkout/index.vue', PageIntro: 'app/components/dashboard/PageIntro.vue', SecondaryNav: 'app/components/dashboard/SecondaryNav.vue', StatCard: 'app/components/dashboard/StatCard.vue' })) {
  const { descriptor } = parse(await readFile(join(base, file), 'utf8'))
  await writeFile(join(dir, name + '.js'), compileScript(descriptor, { id: 'sms-' + name, inlineTemplate: true }).content)
  for (const style of descriptor.styles) pageStyle += compileStyle({ source: style.content, filename: file, id: 'data-v-sms-' + name, scoped: style.scoped }).code
}
await writeFile(join(dir, 'entry.js'), `
import { createApp,h,ref,shallowRef,reactive,computed,onMounted,onBeforeUnmount,watch,nextTick,Suspense,resolveComponent } from '${base}/node_modules/vue/dist/vue.esm-bundler.js'
import { createI18n } from '${base}/node_modules/vue-i18n/dist/vue-i18n.mjs'
import { useUiLocale } from '${base}/app/composables/useUiLocale.js'
import en from '${base}/i18n/locales/en.json'
import ar from '${base}/i18n/locales/ar.json'
import Sms from './Sms.js'
import Launcher from './Launcher.js'
import Preferences from './Preferences.js'
import OrderList from './OrderList.js'
import OrderDialog from './OrderDialog.js'
import Checkout from './Checkout.js'
import PageIntro from './PageIntro.js'
import SecondaryNav from './SecondaryNav.js'
import StatCard from './StatCard.js'
const i18n=createI18n({legacy:false,locale:'en',messages:{en,ar}})
const route=reactive({path:'/dashboard/sms',query:{tab:'settings'}})
const mode=reactive({preference:'light',value:'light'})
const cookie=ref('en')
const view=ref('sms')
const fixture=reactive({requests:[],permissions:null,enabled:false,ready:true,failSave:false,navigation:'',order:{id:'11111111-1111-4111-8111-111111111111',order_number:'ORD-BROWSER-ORDER',first_name:'Buyer',last_name:'Fixture',status:'pending_payment',payment_status:'pending',payment_method:'cash',phone:'01012345678',email:'buyer@example.invalid',street_address:'Street',city:'Cairo',governorate:'Cairo',currency:'EGP',subtotal_amount:100,total_amount:100,created_at:'2026-10-05T08:00:00Z'}})
const cartItems=ref([{id:'22222222-2222-4222-8222-222222222222',title:'Cart fixture',quantity:1,price:100,selling_mode:'normal'}])
const settings=reactive({id:'vodafone',is_enabled:false,api_mode:'production',base_url:'https://sms.example.invalid',port:null,notification_path:'/web2sms/sms/submit/Notification',campaign_path:'/web2sms/sms/submit',sender_names:['APP'],default_sender:'APP',expected_outbound_ip:'8.8.8.8',trusted_ip_confirmed:true,activation_confirmed:true,hash_protocol_confirmed:true,activation_notes:'Isolated fixture',timeout_ms:10000,preflight_retry_limit:2,batch_size:50,request_interval_ms:1000,default_country:'EG',allow_international:false,config_revision:0,account_id_configured:true,password_configured:true,hash_secret_configured:true,encryption_ready:true,readiness:{ready:true,missing:[]}})
const templates=reactive([{id:'template-fixture',code:'manual_fixture',name:'Manual fixture',category:'manual',text_en:'Hello {{name}}',text_ar:'مرحبا {{name}}',traffic_type:'notification',sender:'APP',is_enabled:true,variables:['name']}])
const orderEvents=reactive(['order_confirmed','payment_confirmed','processing','cancelled'].map((event_type,index)=>({event_type,is_enabled:false,template_en_id:'order-template-'+index,template_ar_id:'order-template-'+index,config_revision:0})))
templates.push(...orderEvents.map(item=>({id:item.template_en_id,code:'order_'+item.event_type,name:item.event_type,category:'orders',text_en:'Order {{order_number}}.',text_ar:'الطلب {{order_number}}.',traffic_type:'notification',sender:'APP',is_enabled:true,variables:['order_number']})))
const pdcEvents=reactive(['pdc_out_for_delivery','pdc_delivery_exception','pdc_delivered'].map((event_type,index)=>({event_type,is_enabled:false,template_en_id:'pdc-template-'+index,template_ar_id:'pdc-template-'+index,config_revision:0})))
orderEvents.push(...pdcEvents)
templates.push(...pdcEvents.map(item=>({id:item.template_en_id,code:item.event_type,name:item.event_type,category:'pdc',text_en:'PDC {{order_number}} {{awb}}.',text_ar:'PDC الطلب {{order_number}} {{awb}}.',traffic_type:'notification',sender:'APP',is_enabled:true,variables:['order_number','awb']})))
const orderHistory=[{id:'order-event-skipped',order_number:'ORD-BROWSER-SKIPPED',event_type:'order_confirmed',locale:'ar',template_id:'order-template-0',sender:'APP',recipient_masked:'••••••678',status:'suppressed',reason:'provider_disabled',created_at:'2026-10-05T08:00:00Z',sms_batches:null},{id:'order-event-submitted',order_number:'ORD-BROWSER-SUBMITTED',event_type:'processing',locale:'en',template_id:'order-template-2',sender:'APP',recipient_masked:'+201••••••678',status:'queued',reason:null,created_at:'2026-10-05T08:00:00Z',sms_batches:{id:'linked-batch',status:'submitted',external_trx_id:'ELC-order-browser-fixture',attempts:1,sms_messages:[{encoding:'utf16',units:50,segments:1,provider_status:'SUBMITTED'}]}}]
orderHistory.push({id:'pdc-event-skipped',order_number:'ORD-PDC-BROWSER-SKIPPED',shipment_awb:'AWB-BROWSER-SKIPPED',provider_event_at:'2026-10-06T08:00:00Z',event_type:'pdc_out_for_delivery',locale:'ar',template_id:'pdc-template-0',sender:'APP',recipient_masked:'••••••678',status:'suppressed',reason:'provider_disabled',created_at:'2026-10-06T08:00:01Z',sms_batches:null},{id:'pdc-event-submitted',order_number:'ORD-PDC-BROWSER-SUBMITTED',shipment_awb:'AWB-BROWSER-DELIVERED',provider_event_at:'2026-10-06T09:00:00Z',event_type:'pdc_delivered',locale:'en',template_id:'pdc-template-2',sender:'APP',recipient_masked:'+201••••••678',status:'queued',reason:null,created_at:'2026-10-06T09:00:01Z',sms_batches:{id:'pdc-linked-batch',status:'submitted',external_trx_id:'ELC-pdc-browser-fixture',attempts:1,sms_messages:[{encoding:'utf16',units:50,segments:1,provider_status:'SUBMITTED'}]}})
const history=[{id:'batch-fixture',traffic_type:'notification',triggered_by:'staff-fixture',trigger_source:'dashboard_manual',template_id:null,external_trx_id:'ELC-browser-fixture',status:'uncertain',attempts:1,created_at:'2026-10-05T08:00:00Z',submitted_at:null,error_code:9013,failure_category:'trusted_ip',sms_messages:[{id:'message-fixture',recipient:'+201••••••678',sender:'APP',status:'uncertain',provider_status:null,error_code:9013}],sms_attempts:[{attempt_number:1,status:'uncertain',failure_category:'provider_result_unknown',started_at:'2026-10-05T08:00:01Z'}]}]
const can=permission=>fixture.permissions===null||fixture.permissions.includes(permission)
const fetcher=async(path,options={})=>{
 fixture.requests.push({path,method:options.method||'GET',body:options.body})
 if(path==='/api/chat/status')return {enabled:true,available:true,cooldownSeconds:0,maxMessageLength:4000,attachmentPolicy:{enabled:false}}
 if(path==='/api/admin-orders')return {stats:{total:1,today:1,week:1,month:1},total:1,items:[{...fixture.order}],recentOrders:[{...fixture.order}]}
 if(path==='/api/admin-orders/'+fixture.order.id){if(options.method==='PATCH')fixture.order.status=options.body.status;return {order:{...fixture.order},items:[],customer:null,shipping:null}}
 if(path==='/api/checkout/quote')return {orderValue:100,requiredNow:100,paymentFee:0,lines:[{title:'Cart fixture',total:100}]}
 if(path==='/api/checkout')return {order:{id:fixture.order.id,paymentMethod:'cash'}}
 if(path==='/api/admin-sms/order-events'){
  if(options.method==='PATCH'){const item=orderEvents.find(row=>row.event_type===options.body.event_type);Object.assign(item,options.body);item.config_revision++;return {event:{...item}}}
  return {events:JSON.parse(JSON.stringify(orderEvents))}
 }
 if(path==='/api/admin-sms/capabilities')return {enabled:fixture.enabled,ready:fixture.ready,sender_names:settings.sender_names,default_sender:settings.default_sender,batch_size:settings.batch_size,default_country:settings.default_country,allow_international:settings.allow_international}
 if(path==='/api/admin-sms/settings'){
  if(options.method==='PATCH'){
   if(fixture.failSave)throw Error('SMS service is unavailable.')
   const body=options.body
   for(const key of Object.keys(settings))if(body[key]!==undefined)settings[key]=body[key]
   if(body.account_id||body.password||body.hash_secret){settings.is_enabled=false;settings.trusted_ip_confirmed=false;settings.activation_confirmed=false;settings.hash_protocol_confirmed=false}
   settings.config_revision++;fixture.enabled=settings.is_enabled
  }
  return {settings:JSON.parse(JSON.stringify(settings))}
 }
 if(path==='/api/admin-sms/templates'){
  if(options.method==='POST'){const item={...options.body,id:options.body.id||'new-fixture',variables:[]};const index=templates.findIndex(t=>t.id===item.id);if(index<0)templates.push(item);else templates[index]=item;return {template:item}}
  return {templates:JSON.parse(JSON.stringify(templates))}
 }
 if(path==='/api/admin-sms/history')return {page:1,total:1,batches:history,orderTotal:orderHistory.length,orderEvents:orderHistory}
 if(path==='/api/admin-sms/send')return {id:'queued-fixture',status:'queued',external_trx_id:'ELC-queued-browser-fixture'}
 throw Error('Unexpected fixture request')
}
const applyAppearance=()=>{
 mode.value=mode.preference==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):mode.preference
 document.documentElement.classList.toggle('dark',mode.value==='dark')
 document.documentElement.dir=i18n.global.locale.value==='ar'?'rtl':'ltr'
 document.documentElement.lang=i18n.global.locale.value
}
watch(()=>[mode.preference,i18n.global.locale.value],applyAppearance)
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyAppearance)
Object.assign(globalThis,{ref,shallowRef,onBeforeUnmount,reactive,computed,onMounted,watch,useUiLocale,useUiRoute:()=>route,useI18n:()=>({...i18n.global,setLocale:async value=>{i18n.global.locale.value=value}}),useNuxtApp:()=>({$i18n:i18n.global}),useAdminAccess:()=>({hasPermission:can}),useSupportClient:()=>({request:fetcher,errorText:(error,fallback)=>error.message||fallback}),useCookie:()=>cookie,useUiPreferences:()=>({setTheme:value=>{mode.preference=value}}),useColorMode:()=>mode,definePageMeta(){}})
Object.assign(globalThis,{useLiveChatClient:()=>({resolveActor:async()=>({kind:'guest',session:null}),hasStoredGuestSession:()=>false,request:async()=>({items:[]})}),$fetch:fetcher,nextTick,resolveComponent,useHead(){},useNuxtData:()=>({data:ref({mode:'built_in'})}),useDashboardLayout:()=>({dashboardLayout:ref('standard')}),useDashboardNavigation:()=>({secondaryItems:ref([])}),useDashboardCache:()=>({getSnapshot:()=>null,invalidate(){},isFresh:()=>false,setSnapshot(){}}),useSiteContent:async()=>({data:ref({settings:{payment_cash_enabled:true}})}),useFetch:async()=>({data:ref({card:{available:false}})}),useSupabaseUser:()=>ref({id:'buyer-fixture',email:'buyer@example.invalid'}),useSupabaseClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'browser-isolated-token'}}})},from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{full_name:'Buyer Fixture',address_line_1:'Street',city:'Cairo',state:'Cairo',phone:'01012345678',email:'buyer@example.invalid'}})})}),useUiNavigation:()=>({uiNavigateTo:async path=>{fixture.navigation=path}}),useStoreAnalytics:()=>({trackEvent(){}}),useCart:()=>({items:cartItems,cartId:ref('cart-fixture'),itemCount:computed(()=>cartItems.value.length),subtotal:ref(100),isEmpty:computed(()=>!cartItems.value.length),appliedCoupon:ref(null),clearCart(){cartItems.value=[]},setAppliedCoupon(){},resetCoupon(){},loadCart(){}})})
Sms.__scopeId='data-v-sms-Sms'
Launcher.__scopeId='data-v-sms-Launcher'
const app=createApp({render:()=>h(Suspense,null,{default:()=>h('main',{class:'mx-auto max-w-6xl p-4 text-gray-900 dark:text-gray-100'},[h('header',{class:'mb-4 flex justify-end'},h(Preferences)),h(view.value==='orders'?OrderList:view.value==='checkout'?Checkout:view.value==='chat'?Launcher:Sms)])})})
app.use(i18n)
app.config.globalProperties.$uiLabel=useUiLocale().uiLabel
app.config.globalProperties.$uiMessage=useUiLocale().uiMessage
app.config.globalProperties.$uiPluralSuffix=useUiLocale().uiPluralSuffix
app.component('DashboardOrderDetailsDialog',OrderDialog)
app.component('DashboardPageIntro',PageIntro)
app.component('DashboardSecondaryNav',SecondaryNav)
app.component('DashboardStatCard',StatCard)
app.component('PaymentProofUpload',{render(){return h('span')}})
app.component('Icon',{render(){return h('span',{'aria-hidden':'true'},'•')}})
app.component('NuxtLinkLocale',{props:['to'],setup(props,{slots}){return()=>h('a',{href:props.to,onClick:event=>{event.preventDefault();route.query.tab=new URL(props.to,location.origin).searchParams.get('tab')}},slots.default?.())}})
app.mount('#app');applyAppearance()
window.smsTest={fixture,settings,templates,orderEvents,pdcEvents,orderHistory,view,cartItems,route,mode,locale:i18n.global.locale,nextTick,applyAppearance}
`)
await build({ entryPoints: [join(dir, 'entry.js')], bundle: true, outfile: join(dir, 'bundle.js'), alias: { '~': join(base, 'app') }, nodePaths: [join(base, 'node_modules')], define: { 'process.env.NODE_ENV': '"test"', '__VUE_OPTIONS_API__': 'true', '__VUE_PROD_DEVTOOLS__': 'false', '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': 'false' } })
const css = (await Promise.all((await readdir(join(base, '.output/public/_nuxt'))).filter(file => file.endsWith('.css')).map(file => readFile(join(base, '.output/public/_nuxt', file), 'utf8')))).join('\n') + pageStyle
const server = createServer(async (request, response) => {
  response.setHeader('content-type', request.url === '/bundle.js' ? 'text/javascript' : 'text/html')
  response.end(request.url === '/bundle.js' ? await readFile(join(dir, 'bundle.js')) : `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body class="bg-gray-100 dark:bg-gray-950"><div id="app"></div><script src="/bundle.js"></script></body></html>`)
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const url = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({ executablePath: process.env.SMS_REVIEW_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
const errors = [], external = []
let assertions = 0, screens = 0
const check = (condition, message) => { assert.ok(condition, message); assertions++ }
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text()) })
await page.route('**/*', route => route.request().url().startsWith(url) ? route.continue() : (external.push(route.request().url()), route.abort()))
const goto = async tab => { await page.locator(`nav a[href$="tab=${tab}"]`).click(); await page.waitForTimeout(100); await page.locator('section').waitFor() }
try {
  await page.goto(url)
  await page.locator('section').waitFor()
  for (const language of ['en', 'ar']) for (const width of [1440, 390]) for (const theme of ['light', 'dark', 'system']) {
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ colorScheme: theme === 'system' ? 'dark' : theme })
    await page.evaluate(({ language, theme }) => { window.smsTest.locale.value = language; window.smsTest.mode.preference = theme; window.smsTest.applyAppearance() }, { language, theme })
    for (const tab of ['settings', 'templates', 'send', 'history']) {
      await goto(tab)
      check(await page.locator('nav a').count() === 4, 'Four authorized SMS tabs')
      check(await page.locator('html').getAttribute('dir') === (language === 'ar' ? 'rtl' : 'ltr'), 'Correct direction')
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No page overflow')
      check(!(await page.locator('main').innerText()).includes('sms.'), 'All labels resolved')
      check(await page.evaluate(() => document.documentElement.classList.contains('dark')) === (theme !== 'light'), 'Theme applied')
      check(await page.locator('.sms-panel').evaluate(node => getComputedStyle(node).backgroundColor) === (theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(17, 24, 39)'), 'Panel has readable theme background')
      await page.screenshot({ path: join(dir, `${language}-${width}-${theme}-${tab}.png`), fullPage: true, animations: 'disabled' }); screens++
    }
  }
  for (const language of ['en', 'ar']) {
    const labels = JSON.parse(await readFile(join(base, `i18n/locales/${language}.json`), 'utf8')).sms
    await page.evaluate(language => { window.smsTest.locale.value = language; window.smsTest.fixture.enabled = false; window.smsTest.settings.is_enabled = false }, language)
    await goto('send')
    check(await page.getByRole('button', { name: labels.queueSms, exact: true }).isDisabled(), 'Provider disabled blocks manual sending')
    await goto('settings')
    check(await page.locator('[data-order-event]:not([data-order-event^=pdc_])').count() === 4,'Four Dashboard-managed order events')
    check(await page.locator('[data-order-event^=pdc_]').count()===3,'Three separate PDC event controls')
    for(const form of await page.locator('[data-order-event^=pdc_]').all())check(!await form.locator('input[type=checkbox]').isChecked(),'PDC controls start off')
    const pdcForm=page.locator('[data-order-event=pdc_out_for_delivery]')
    const pdcRevision=await page.evaluate(()=>window.smsTest.pdcEvents[0].config_revision)
    await pdcForm.locator('input[type=checkbox]').check()
    await pdcForm.locator('select').first().selectOption('pdc-template-1')
    await pdcForm.locator('select').last().selectOption('pdc-template-2')
    await pdcForm.getByRole('button',{name:labels.saveOrderEvent,exact:true}).click()
    await page.waitForFunction(previous=>window.smsTest.pdcEvents[0].config_revision>previous,pdcRevision)
    check(await page.evaluate(()=>window.smsTest.pdcEvents[0].template_en_id)==='pdc-template-1','PDC English binding saved')
    check(await page.evaluate(()=>window.smsTest.pdcEvents[0].template_ar_id)==='pdc-template-2','PDC Arabic binding saved')
    await pdcForm.locator('input[type=checkbox]').uncheck()
    await pdcForm.getByRole('button',{name:labels.saveOrderEvent,exact:true}).click()
    await goto('templates');await goto('settings')
    check(!await pdcForm.locator('input[type=checkbox]').isChecked(),'PDC disable persists after reload')
    const orderForm=page.locator('[data-order-event=order_confirmed]')
    const priorRevision=await page.evaluate(()=>window.smsTest.orderEvents[0].config_revision)
    await orderForm.locator('input[type=checkbox]').check()
    await orderForm.locator('select').first().selectOption('order-template-1')
    await orderForm.locator('select').last().selectOption('order-template-2')
    await orderForm.getByRole('button',{name:labels.saveOrderEvent,exact:true}).click()
    await page.waitForFunction(previous=>window.smsTest.orderEvents[0].config_revision>previous,priorRevision)
    check(await page.evaluate(()=>window.smsTest.orderEvents[0].template_en_id)==='order-template-1','English binding saved')
    check(await page.evaluate(()=>window.smsTest.orderEvents[0].template_ar_id)==='order-template-2','Arabic binding saved')
    await orderForm.locator('input[type=checkbox]').uncheck()
    await orderForm.getByRole('button',{name:labels.saveOrderEvent,exact:true}).click()
    await page.waitForTimeout(100)
    await goto('templates');await goto('settings')
    check(!await orderForm.locator('input[type=checkbox]').isChecked(),'Disabled event persists after reload')
    check(await page.locator('input[type=password]').count() === 3, 'Account, password and hash secret replace-only fields')
    for (const input of await page.locator('input[type=password]').all()) check(await input.inputValue() === '', 'Secrets never read back')
    const hashInput = page.locator('input[type=password]').nth(2)
    await hashInput.fill('abcdef123456')
    check(!await hashInput.evaluate(node => node.checkValidity()), 'Lowercase hash secret rejected without conversion')
    await hashInput.fill('A1B2C3D4E5F6')
    check(await hashInput.evaluate(node => node.checkValidity()), 'Provider literal-key example accepted')
    await hashInput.fill('ABC')
    check(await hashInput.evaluate(node => node.checkValidity()), 'Literal key has no decoded-byte-pair restriction')
    await hashInput.fill('')
    check(await hashInput.evaluate(node => node.checkValidity()), 'Blank hash replacement preserves saved value')
    await page.locator('input[type=password]').nth(1).fill('browser-replacement-fixture')
    await page.getByRole('button', { name: labels.save, exact: true }).click()
    await page.getByRole('status').waitFor()
    check(await page.locator('input[type=password]').nth(1).inputValue() === '', 'Replacement cleared after save')
    check(!(await page.locator('main').innerText()).includes('browser-replacement-fixture'), 'No plaintext displayed')
    await page.evaluate(() => { window.smsTest.fixture.enabled = true; window.smsTest.settings.is_enabled = true; window.smsTest.settings.readiness.ready = true })
    await goto('send')
    await page.locator('select').filter({ has: page.locator('option[value=notification]') }).selectOption('notification')
    await page.locator('label:has(textarea)').first().locator('textarea').fill('01012345678')
    for (const text of ['^'.repeat(153), '😀'.repeat(67)]) {
      await page.locator('label:has(textarea)').last().locator('textarea').fill(text)
      check((await page.locator('main').innerText()).includes(labels.segments.replace('{count}', '3')), 'Multipart preview preserves character boundaries')
    }
    await page.locator('label:has(textarea)').last().locator('textarea').fill('مرحبا')
    check((await page.locator('main').innerText()).includes(labels.utf16), 'Arabic Unicode preview')
    check((await page.locator('main').innerText()).includes('+201012345678'), 'Normalized number preview')
    await page.getByRole('button', { name: labels.queueSms, exact: true }).click()
    await page.getByRole('status').waitFor()
    check(await page.getByRole('button', { name: labels.queueSms, exact: true }).isDisabled(), 'Logical send cannot be queued twice accidentally')
    check(await page.evaluate(() => window.smsTest.fixture.requests.filter(r => r.path.endsWith('/send')).at(-1).body.trafficType) === 'notification', 'Single notification path')
    await page.getByRole('button', { name: labels.newMessage, exact: true }).click()
    await page.locator('select').filter({ has: page.locator('option[value=campaign]') }).selectOption('campaign')
    await page.locator('label:has(textarea)').first().locator('textarea').fill('01012345678\n01112345678')
    check(await page.getByRole('button', { name: labels.queueSms, exact: true }).isDisabled(), 'Campaign requires explicit confirmation')
    await page.locator('input[type=checkbox]').check()
    await page.getByRole('button', { name: labels.queueSms, exact: true }).click()
    await page.getByRole('status').waitFor()
    check(await page.evaluate(() => window.smsTest.fixture.requests.filter(r => r.path.endsWith('/send')).at(-1).body.trafficType) === 'campaign', 'Campaign path retained')
    await goto('templates')
    await page.evaluate(()=>{window.smsTest.route.query.claimPurpose='approved'})
    await page.getByRole('button',{name:labels.newTemplate,exact:true}).click()
    check(await page.locator('fieldset input:not([type=checkbox])').nth(0).inputValue()==='claim_approved','Claims draft purpose key')
    check(await page.locator('fieldset input:not([type=checkbox])').nth(2).inputValue()==='claims:approved','Claims draft purpose category')
    check(!await page.locator('fieldset input[type=checkbox]').isChecked(),'Claims SMS draft defaults OFF')
    check((await page.locator('fieldset textarea').first().inputValue()).includes('{{claim_url}}'),'Claims draft includes canonical-link variable')
    check(await page.locator('fieldset select').first().inputValue()==='notification','Claims draft Notification only')
    await page.screenshot({path:join(dir,'claims-draft-'+language+'.png'),fullPage:true});screens++
    await page.evaluate(()=>{delete window.smsTest.route.query.claimPurpose})
    await page.getByRole('button', { name: labels.newTemplate, exact: true }).click()
    const inputs = page.locator('fieldset input:not([type=checkbox])')
    await inputs.nth(0).fill('browser_manual_' + language); await inputs.nth(1).fill('Browser fixture')
    await page.locator('fieldset textarea').first().fill('Hello')
    await page.getByRole('button', { name: labels.saveTemplate, exact: true }).click()
    await page.getByRole('status').waitFor()
    check((await page.locator('main').innerText()).includes('Browser fixture'), 'Template authoring saved')
    await goto('history'); await page.locator('details:not([data-order-history]) summary').click()
    check((await page.locator('main').innerText()).includes('9013'), 'Numeric provider diagnostics shown')
    check((await page.locator('main').innerText()).includes('••••••'), 'Phone history masked')
  }
  for(const language of ['en','ar'])for(const width of [1440,390])for(const theme of ['light','dark','system']){
    const catalog=JSON.parse(await readFile(join(base,'i18n/locales/'+language+'.json'),'utf8'))
    await page.setViewportSize({width,height:1000});await page.emulateMedia({colorScheme:theme==='system'?'dark':theme})
    await page.evaluate(({language,theme})=>{const f=window.smsTest;f.fixture.permissions=null;f.fixture.enabled=false;f.locale.value=language;f.mode.preference=theme;f.applyAppearance();f.view.value='sms';f.route.query.tab='history'}, {language,theme})
    await page.locator('[data-order-history]').first().waitFor()
    await page.locator('[data-order-history]').first().evaluate(node=>{node.open=true})
    check((await page.locator('main').innerText()).includes(catalog.sms.orderReasons.provider_disabled),'Skipped reason localized in shared history')
    await page.locator('[data-order-history]').filter({hasText:'ORD-BROWSER-SUBMITTED'}).evaluate(node=>{node.open=true})
    check((await page.locator('main').innerText()).includes('ELC-order-browser-fixture'),'Linked central transaction visible')
    check(!(await page.locator('main').innerText()).includes('01012345678'),'Order history masks phones')
    const pdcSkipped=page.locator('[data-order-history]').filter({hasText:'ORD-PDC-BROWSER-SKIPPED'})
    const pdcSubmitted=page.locator('[data-order-history]').filter({hasText:'ORD-PDC-BROWSER-SUBMITTED'})
    await pdcSkipped.evaluate(node=>{node.open=true});await pdcSubmitted.evaluate(node=>{node.open=true})
    check((await pdcSkipped.innerText()).includes(catalog.sms.orderEventNames.pdc_out_for_delivery),'PDC event is localized in shared history')
    check((await pdcSubmitted.innerText()).includes('AWB-BROWSER-DELIVERED'),'Customer AWB visible in staff history')
    check((await pdcSubmitted.innerText()).includes('ELC-pdc-browser-fixture'),'PDC links to central transaction diagnostics')
    check((await pdcSubmitted.innerText()).includes(catalog.sms.pdcEventTime),'Provider time is distinct from ingestion time')
    await page.screenshot({path:join(dir,language+'-'+width+'-'+theme+'-pdc-history.png'),fullPage:true});screens++
    const manualRequests=await page.evaluate(()=>window.smsTest.fixture.requests.filter(r=>r.path==='/api/admin-sms/send').length)
    await page.evaluate(()=>{const f=window.smsTest;f.fixture.order.status='pending_payment';f.route.query={};f.view.value='orders'})
    const orderButton=page.locator('button:visible').filter({hasText:'ORD-BROWSER-ORDER'}).first()
    await orderButton.waitFor()
    await page.screenshot({path:join(dir,language+'-'+width+'-'+theme+'-orders.png'),fullPage:true});screens++
    await orderButton.click()
    const dialog=page.locator('body > div.fixed')
    await dialog.getByRole('button',{name:catalog.common.updateStatus}).click()
    await dialog.getByRole('button',{name:catalog.common.processing,exact:true}).click()
    await page.waitForFunction(()=>window.smsTest.fixture.order.status==='processing')
    await dialog.getByRole('button',{name:catalog.common.cancelled,exact:true}).click()
    await page.waitForFunction(()=>window.smsTest.fixture.order.status==='cancelled')
    await page.screenshot({path:join(dir,language+'-'+width+'-'+theme+'-order-cancelled.png'),fullPage:true});screens++
    check(await page.evaluate(()=>window.smsTest.fixture.requests.filter(r=>r.path==='/api/admin-sms/send').length)===manualRequests,'Order UI only requests authoritative state updates')
    await dialog.getByRole('button',{name:catalog.common.close,exact:true}).click()
    await page.evaluate(()=>{const f=window.smsTest;f.cartItems.value=[{id:'22222222-2222-4222-8222-222222222222',title:'Cart fixture',quantity:1,price:100,selling_mode:'normal'}];f.fixture.navigation='';f.view.value='checkout'})
    await page.getByRole('button',{name:catalog.common.continueToPayment,exact:true}).click()
    await page.getByRole('button',{name:catalog.common.confirmCheckout,exact:true}).click()
    await page.waitForFunction(()=>window.smsTest.fixture.navigation.includes('/checkout/summary/'))
    const checkout=await page.evaluate(()=>window.smsTest.fixture.requests.filter(r=>r.path==='/api/checkout').at(-1).body)
    check(checkout.locale===language,'Checkout passes the transaction locale snapshot')
    check(checkout.address.phone==='01012345678','Checkout passes the order contact snapshot')
    check(await page.evaluate(()=>window.smsTest.fixture.requests.filter(r=>r.path==='/api/admin-sms/send').length)===manualRequests,'Disabled-provider checkout has no browser SMS trigger')
    await page.evaluate(()=>{window.smsTest.route.path='/';window.smsTest.view.value='chat'})
    await page.getByRole('button',{name:catalog.common.liveSupport,exact:true}).waitFor()
    await page.getByRole('button',{name:catalog.common.liveSupport,exact:true}).click()
    const chat=page.locator('#live-chat-panel')
    await chat.waitFor({state:'visible'})
    check(await chat.isVisible(),'Actual Live Chat launcher opens')
    check(await chat.evaluate(node=>getComputedStyle(node).position)==='fixed','Actual Live Chat scoped styles applied')
    check(!(await chat.innerText()).includes('livechat.'),'Live Chat labels resolve')
    await page.screenshot({path:join(dir,language+'-'+width+'-'+theme+'-chat.png'),fullPage:true});screens++
    await chat.locator('button.chat-header-close').click()
    await chat.waitFor({state:'hidden'})
    check(!await chat.isVisible(),'Actual Live Chat closes')
    await page.evaluate(()=>{window.smsTest.route.path='/dashboard/sms'})
    await page.evaluate(()=>{window.smsTest.view.value='sms';window.smsTest.route.query.tab='settings'})
  }
  await page.evaluate(() => { window.smsTest.fixture.permissions = ['sms.view', 'sms.settings.view']; window.smsTest.route.query.tab = 'settings' })
  await page.waitForTimeout(150)
  check(await page.locator('nav a').count() === 1, 'Restricted navigation')
  check(await page.locator('fieldset input').first().isDisabled(), 'Read-only settings permission')
  check(await page.locator('[data-order-event] button').count()===0,'Settings viewers cannot change automated order events')
  check(await page.locator('[data-order-event] input').first().isDisabled(),'Order event controls respect manage permission')
  check(await page.locator('[data-order-event^=pdc_] input').first().isDisabled(),'PDC controls respect manage permission')
  await page.evaluate(() => { window.smsTest.mode.preference = 'system'; window.smsTest.applyAppearance() })
  await page.emulateMedia({ colorScheme: 'light' }); await page.waitForTimeout(50)
  check(!await page.evaluate(() => document.documentElement.classList.contains('dark')), 'System switches to light')
  await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForTimeout(50)
  check(await page.evaluate(() => document.documentElement.classList.contains('dark')), 'System switches to dark')
  check(errors.length === 0, 'No console/runtime errors: ' + JSON.stringify(errors))
  check(external.length === 0, 'No external network')
  const report = { assertions, screenshots: screens, errors, external, scope: 'actual order/PDC SMS controls/templates/history, checkout, order Dashboard/dialog and Live Chat launcher; isolated API/auth fixtures; no production acceptance/provider calls' }
  await writeFile(join(dir, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
} catch (failure) {
  await writeFile(join(dir,'failure.json'),JSON.stringify({errors,external,text:await page.locator('body').innerText(),requests:await page.evaluate(()=>window.smsTest?.fixture.requests.map(r=>({path:r.path,method:r.method})))},null,2))
  await page.screenshot({path:join(dir,'failure.png'),fullPage:true})
  throw failure
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)) }
