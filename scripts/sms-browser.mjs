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
for (const [name, file] of Object.entries({ Sms: 'app/pages/dashboard/sms.vue', Preferences: 'app/components/UiPreferences.vue' })) {
  const { descriptor } = parse(await readFile(join(base, file), 'utf8'))
  await writeFile(join(dir, name + '.js'), compileScript(descriptor, { id: 'sms-' + name, inlineTemplate: true }).content)
  for (const style of descriptor.styles) pageStyle += compileStyle({ source: style.content, filename: file, id: 'data-v-sms-' + name, scoped: style.scoped }).code
}
await writeFile(join(dir, 'entry.js'), `
import { createApp,h,ref,reactive,computed,onMounted,watch,nextTick } from '${base}/node_modules/vue/dist/vue.esm-bundler.js'
import { createI18n } from '${base}/node_modules/vue-i18n/dist/vue-i18n.mjs'
import { useUiLocale } from '${base}/app/composables/useUiLocale.js'
import en from '${base}/i18n/locales/en.json'
import ar from '${base}/i18n/locales/ar.json'
import Sms from './Sms.js'
import Preferences from './Preferences.js'
const i18n=createI18n({legacy:false,locale:'en',messages:{en,ar}})
const route=reactive({path:'/dashboard/sms',query:{tab:'settings'}})
const mode=reactive({preference:'light',value:'light'})
const cookie=ref('en')
const fixture=reactive({requests:[],permissions:null,enabled:false,ready:true,failSave:false})
const settings=reactive({id:'vodafone',is_enabled:false,api_mode:'production',base_url:'https://sms.example.invalid',port:null,notification_path:'/web2sms/sms/submit/Notification',campaign_path:'/web2sms/sms/submit',sender_names:['APP'],default_sender:'APP',expected_outbound_ip:'8.8.8.8',trusted_ip_confirmed:true,activation_confirmed:true,hash_protocol_confirmed:true,activation_notes:'Isolated fixture',timeout_ms:10000,preflight_retry_limit:2,batch_size:50,request_interval_ms:1000,default_country:'EG',allow_international:false,config_revision:0,account_id_configured:true,password_configured:true,hash_secret_configured:true,encryption_ready:true,readiness:{ready:true,missing:[]}})
const templates=reactive([{id:'template-fixture',code:'manual_fixture',name:'Manual fixture',category:'manual',text_en:'Hello {{name}}',text_ar:'مرحبا {{name}}',traffic_type:'notification',sender:'APP',is_enabled:true,variables:['name']}])
const history=[{id:'batch-fixture',traffic_type:'notification',triggered_by:'staff-fixture',trigger_source:'dashboard_manual',template_id:null,external_trx_id:'ELC-browser-fixture',status:'uncertain',attempts:1,created_at:'2026-10-05T08:00:00Z',submitted_at:null,error_code:9013,failure_category:'trusted_ip',sms_messages:[{id:'message-fixture',recipient:'+201••••••678',sender:'APP',status:'uncertain',provider_status:null,error_code:9013}],sms_attempts:[{attempt_number:1,status:'uncertain',failure_category:'provider_result_unknown',started_at:'2026-10-05T08:00:01Z'}]}]
const can=permission=>fixture.permissions===null||fixture.permissions.includes(permission)
const fetcher=async(path,options={})=>{
 fixture.requests.push({path,method:options.method||'GET',body:options.body})
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
 if(path==='/api/admin-sms/history')return {page:1,total:1,batches:history}
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
Object.assign(globalThis,{ref,reactive,computed,onMounted,watch,useUiLocale,useUiRoute:()=>route,useI18n:()=>({...i18n.global,setLocale:async value=>{i18n.global.locale.value=value}}),useNuxtApp:()=>({$i18n:i18n.global}),useAdminAccess:()=>({hasPermission:can}),useSupportClient:()=>({request:fetcher,errorText:(error,fallback)=>error.message||fallback}),useCookie:()=>cookie,useUiPreferences:()=>({setTheme:value=>{mode.preference=value}}),useColorMode:()=>mode,definePageMeta(){}})
Sms.__scopeId='data-v-sms-Sms'
const app=createApp({render:()=>h('main',{class:'mx-auto max-w-6xl p-4 text-gray-900 dark:text-gray-100'},[h('header',{class:'mb-4 flex justify-end'},h(Preferences)),h(Sms)])})
app.use(i18n)
app.component('Icon',{render(){return h('span',{'aria-hidden':'true'},'•')}})
app.component('NuxtLinkLocale',{props:['to'],setup(props,{slots}){return()=>h('a',{href:props.to,onClick:event=>{event.preventDefault();route.query.tab=new URL(props.to,location.origin).searchParams.get('tab')}},slots.default?.())}})
app.mount('#app');applyAppearance()
window.smsTest={fixture,settings,templates,route,mode,locale:i18n.global.locale,nextTick,applyAppearance}
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
    check(await page.locator('input[type=password]').count() === 3, 'Account, password and hash secret replace-only fields')
    for (const input of await page.locator('input[type=password]').all()) check(await input.inputValue() === '', 'Secrets never read back')
    await page.locator('input[type=password]').nth(1).fill('browser-replacement-fixture')
    await page.getByRole('button', { name: labels.save, exact: true }).click()
    await page.getByRole('status').waitFor()
    check(await page.locator('input[type=password]').nth(1).inputValue() === '', 'Replacement cleared after save')
    check(!(await page.locator('main').innerText()).includes('browser-replacement-fixture'), 'No plaintext displayed')
    await page.evaluate(() => { window.smsTest.fixture.enabled = true; window.smsTest.settings.is_enabled = true; window.smsTest.settings.readiness.ready = true })
    await goto('send')
    await page.locator('select').filter({ has: page.locator('option[value=notification]') }).selectOption('notification')
    await page.locator('label:has(textarea)').first().locator('textarea').fill('01012345678')
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
    await page.getByRole('button', { name: labels.newTemplate, exact: true }).click()
    const inputs = page.locator('fieldset input:not([type=checkbox])')
    await inputs.nth(0).fill('browser_manual_' + language); await inputs.nth(1).fill('Browser fixture')
    await page.locator('fieldset textarea').first().fill('Hello')
    await page.getByRole('button', { name: labels.saveTemplate, exact: true }).click()
    await page.getByRole('status').waitFor()
    check((await page.locator('main').innerText()).includes('Browser fixture'), 'Template authoring saved')
    await goto('history'); await page.locator('details summary').click()
    check((await page.locator('main').innerText()).includes('9013'), 'Numeric provider diagnostics shown')
    check((await page.locator('main').innerText()).includes('••••••'), 'Phone history masked')
  }
  await page.evaluate(() => { window.smsTest.fixture.permissions = ['sms.view', 'sms.settings.view']; window.smsTest.route.query.tab = 'settings' })
  await page.waitForTimeout(150)
  check(await page.locator('nav a').count() === 1, 'Restricted navigation')
  check(await page.locator('fieldset input').first().isDisabled(), 'Read-only settings permission')
  await page.evaluate(() => { window.smsTest.mode.preference = 'system'; window.smsTest.applyAppearance() })
  await page.emulateMedia({ colorScheme: 'light' }); await page.waitForTimeout(50)
  check(!await page.evaluate(() => document.documentElement.classList.contains('dark')), 'System switches to light')
  await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForTimeout(50)
  check(await page.evaluate(() => document.documentElement.classList.contains('dark')), 'System switches to dark')
  check(errors.length === 0, 'No console/runtime errors: ' + JSON.stringify(errors))
  check(external.length === 0, 'No external network')
  const report = { assertions, screenshots: screens, errors, external, scope: 'actual SMS Vue page and preferences; isolated API/auth fixtures; no production authenticated acceptance' }
  await writeFile(join(dir, 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)) }
