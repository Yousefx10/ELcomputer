// Actual Vue components + built CSS + real H3/RBAC/disposable SQL. Auth and
// Storage transport are fixtures; no production credentials or external calls.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { parse, compileScript } from '@vue/compiler-sfc'
import { defineEventHandler } from 'h3'
import { createClaimsHttpFixture } from '../tests/helpers/claimsHttpFixture.mjs'
const { chromium } = await import(pathToFileURL(process.env.CLAIMS_REVIEW_PLAYWRIGHT || '/private/tmp/elcomputer-pdc-review-tools/node_modules/playwright/index.mjs').href)
const base = resolve(new URL('..', import.meta.url).pathname), dir = process.env.CLAIMS_REVIEW_ARTIFACTS || '/tmp/elcomputer-claims-core-browser'
await mkdir(dir, { recursive: true })
const components = { Center: 'after-sales/Center.vue', Detail: 'after-sales/Detail.vue', ClaimForm: 'after-sales/ClaimForm.vue', EvidencePicker: 'after-sales/EvidencePicker.vue', Timeline: 'after-sales/Timeline.vue', ItemWarranty: 'account/ItemWarranty.vue', Navigation: 'account/Navigation.vue' }
for (const [name, file] of Object.entries(components)) {
  const { descriptor } = parse(await readFile(join(base, 'app/components', file), 'utf8'))
  await writeFile(join(dir, name + '.js'), compileScript(descriptor, { id: 'claims-' + name, inlineTemplate: true }).content)
}
const f = await createClaimsHttpFixture()
const draft = await f.purchase(), eligible = await (async () => { await f.enable(); return f.purchase(2) })()
const expired = await f.purchase(); await f.db.query("update public.customer_orders set created_at=clock_timestamp()-interval '2 years' where id=$1", [expired.order_id])
const requestItem = await f.purchase(), requested = await f.create(f.body(requestItem))
await f.action(requested.id, 'review'); await f.action(requested.id, 'note', { text: 'BROWSER-INTERNAL-NOTE-MUST-STAY-PRIVATE' }); await f.action(requested.id, 'request_information', { text: 'Please provide more details.', require_evidence: false })
await f.enable({ warranty: { warranty_resolutions: ['repair'] } }); const repairItem = await f.purchase(), repairClaim = await f.create(f.body(repairItem, 'warranty', { serials: ['UNVERIFIED-BROWSER-SERIAL'] }))
await f.enable({ warranty: { warranty_evidence: 'required', warranty_serial: 'required' }, returns: { return_evidence: 'required' } }); const required = await f.purchase()
await f.enable({ warranty: { warranty_evidence: 'disabled', warranty_serial: 'disabled' }, returns: { return_evidence: 'disabled' } }); const disabled = await f.purchase()
await f.enable()
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
const app=createApp({render:()=>h('main',{class:'p-4 mx-auto max-w-6xl '+(staff.value?'dashboard-modern':'account-modern')},[!staff.value?h(Navigation,{variant:'modern',key:'nav'+generation.value}):null,view.value==='center'?h(Center,{staff:staff.value,key:generation.value}):h(Detail,{staff:staff.value,id:claimId.value,key:generation.value})])});app.use(i18n);for(const[name,component]of Object.entries({AfterSalesCenter:Center,AfterSalesDetail:Detail,AfterSalesClaimForm:ClaimForm,AfterSalesEvidencePicker:EvidencePicker,AfterSalesTimeline:Timeline,AccountItemWarranty:ItemWarranty}))app.component(name,component);app.component('NuxtLinkLocale',{props:['to'],setup(props,{slots}){return()=>h('a',{href:'#',onClick:event=>{event.preventDefault();navigate(props.to)}},slots.default?.())}});app.component('Icon',{render(){return h('span',{'aria-hidden':'true'},'•')}});app.config.globalProperties.$uiLabel=value=>useUiLocale().uiLabel(value);app.config.globalProperties.$uiMessage=value=>useUiLocale().uiMessage(value);app.mount('#app');appearance();window.claimsTest={show,locale:i18n.global.locale,theme,appearance,downloads};
`)
await build({ entryPoints: [join(dir, 'entry.js')], bundle: true, outfile: join(dir, 'bundle.js'), alias: { '~': join(base, 'app') }, nodePaths: [join(base, 'node_modules')], define: { 'process.env.NODE_ENV': '"test"', __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' } })
const css = (await Promise.all((await readdir(join(base, '.output/public/_nuxt'))).filter(file => file.endsWith('.css')).map(file => readFile(join(base, '.output/public/_nuxt', file), 'utf8')))).join('\n')
const { url, close } = await f.start(defineEventHandler(async event => { event.node.res.setHeader('content-type', event.path === '/bundle.js' ? 'text/javascript' : 'text/html'); return event.path === '/bundle.js' ? readFile(join(dir, 'bundle.js'), 'utf8') : `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body class="bg-slate-100"><div id="app"></div><script src="/bundle.js"></script></body></html>` }))
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true }), page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = [], external = [], scans = []
const workflowOnly = process.argv.includes('--workflow-only')
let assertions = 0, screens = 0, states = 0
if (workflowOnly) { const matrix = JSON.parse(await readFile(join(dir, 'matrix.json'), 'utf8')); assertions = matrix.assertions; screens = matrix.screens; states = matrix.states }
const check = (value, message) => { assert.ok(value, message); assertions++ }
page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (['warning','error'].includes(message.type())) errors.push(message.text()) })
await page.route('**/*', route => route.request().url().startsWith(url) ? route.continue() : (external.push(route.request().url()), route.abort()))
page.on('response', response => { if ((response.headers()['content-type'] || '').includes('json')) scans.push({ path: new URL(response.url()).pathname, status: response.status() }) })
const show = async (view, staff = false, id = '', actor = staff ? 'owner' : 'buyer') => { await page.evaluate(args => window.claimsTest.show(...args), [view, staff, id, actor]); await page.locator(view === 'center' ? '[data-claim-row]' : '[data-claim-timeline]').first().waitFor(); await page.waitForTimeout(60) }
const inspect = async label => { check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No overflow: ' + label); check(!/\bclaims\.[A-Za-z]/.test(await page.locator('main').innerText()), 'All labels translated: ' + label); check(await page.locator('html').getAttribute('dir') === (await page.evaluate(() => window.claimsTest.locale.value) === 'ar' ? 'rtl' : 'ltr'), 'Direction: ' + label); await page.screenshot({ path: join(dir, label + '.png'), fullPage: true }); screens++; states++ }
const begin = async (item, type) => { await page.locator(`[data-purchased-item="${item.id}"] [data-start-claim="${type}"]`).click(); await page.locator('[data-claim-form]').waitFor() }
const fill = async (type, serials = '') => { const form = page.locator('[data-claim-form]'); await form.locator('textarea').first().fill('Browser fixture issue description'); if (type === 'return') { await form.locator('select').nth(0).selectOption('changed_mind'); await form.locator('select').nth(1).selectOption('no'); await form.locator('select').nth(2).selectOption('yes') } else if (serials) await form.locator('textarea').nth(1).fill(serials) }
const en = await readFile(join(base, 'i18n/locales/en.json'), 'utf8'), ar = await readFile(join(base, 'i18n/locales/ar.json'), 'utf8'), messages = { en: JSON.parse(en), ar: JSON.parse(ar) }
const button = (key, language = 'en') => page.getByRole('button', { name: messages[language].claims[key], exact: true })
const staffAction = async (action, text = 'Browser staff decision', resolution = null, requireFile = false) => {
  await page.locator('[data-claim-action]').selectOption(action); const form = page.locator('form').last(); await form.locator('textarea').fill(text)
  if (resolution) await page.locator('[data-claim-resolution]').selectOption(resolution)
  if (action === 'request_information' && requireFile) await form.getByRole('checkbox').check()
  await button('saveAction').click(); await page.getByRole('status').filter({ hasText: messages.en.claims.saved }).waitFor(); await page.waitForTimeout(80)
}
try {
  await page.goto(url)
  if (!workflowOnly) for (const language of ['en','ar']) for (const width of [1440,390]) for (const theme of ['light','dark','system']) {
    const label = language + '-' + width + '-' + theme
    await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ colorScheme: theme === 'light' ? 'light' : 'dark' })
    await page.evaluate(({ language, theme }) => { window.claimsTest.locale.value = language; window.claimsTest.theme.value = theme; window.claimsTest.appearance() }, { language, theme })
    await show('center'); await inspect(label + '-customer-center')
    for (const item of [draft,expired]) check(await page.locator(`[data-purchased-item="${item.id}"] [data-start-claim]`).count() === 0, 'Unknown/expired has no claim actions')
    await begin(eligible, 'return'); await fill('return'); await inspect(label + '-return-form'); await button('reviewSubmission', language).click(); await page.locator('[data-claim-confirmation]').waitFor(); await inspect(label + '-confirmation'); await button('close', language).click()
    await begin(eligible, 'warranty'); await fill('warranty', 'CUSTOMER-UNVERIFIED'); check((await page.locator('[data-claim-form]').innerText()).includes(messages[language].claims.serialUnverified), 'Customer serial provenance shown'); await inspect(label + '-warranty-form'); await button('close', language).click()
    await begin(required, 'return'); check((await page.locator('[data-claim-evidence]').innerText()).includes(messages[language].claims.evidenceModes.required), 'Required evidence state'); await inspect(label + '-required-evidence'); await button('close', language).click()
    await begin(disabled, 'warranty'); check(await page.locator('[data-claim-form] input[type="file"]').count() === 0, 'Disabled uploads absent'); check(await page.locator('[data-claim-form] textarea').count() === 1, 'Disabled serial input absent'); await inspect(label + '-disabled-evidence'); await button('close', language).click()
    await show('detail', false, requested.id); check(!(await page.locator('main').innerText()).includes('BROWSER-INTERNAL-NOTE'), 'Private staff note hidden'); check(await button('sendResponse', language).count() === 1, 'Requested information action'); await inspect(label + '-customer-history')
    await show('center', true); await inspect(label + '-staff-center'); await show('detail', true, requested.id); check((await page.locator('main').innerText()).includes('BROWSER-INTERNAL-NOTE'), 'Internal staff note visible'); await inspect(label + '-staff-detail')
    await show('detail', true, requested.id, 'viewer'); check(await page.locator('[data-claim-action]').count() === 0, 'Read-only role has no mutation controls'); await inspect(label + '-staff-read-only')
    console.log(JSON.stringify({ progress: label, assertions, states, errors: errors.length }))
  }
  if (!workflowOnly) await writeFile(join(dir, 'matrix.json'), JSON.stringify({ assertions, states, screens, errors, external }, null, 2))
  await page.evaluate(() => { window.claimsTest.theme.value = 'system'; window.claimsTest.appearance() })
  await page.emulateMedia({ colorScheme: 'light' }); await page.waitForFunction(() => !document.documentElement.classList.contains('dark')); check(true, 'System follows OS light')
  await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForFunction(() => document.documentElement.classList.contains('dark')); check(true, 'System follows OS dark')
  await page.evaluate(() => { window.claimsTest.locale.value = 'en'; window.claimsTest.theme.value = 'light'; window.claimsTest.appearance() }); await page.setViewportSize({ width: 1440, height: 1000 })
  await show('center'); await begin(eligible, 'return'); await fill('return'); await button('reviewSubmission').click(); await page.locator('[data-claim-confirmation]').waitFor(); await button('submit').click(); await page.locator('[data-claim-timeline]').waitFor()
  const createdReturn = await page.evaluate(() => document.querySelector('[data-claim-detail]')?.textContent.match(/AS-R-[A-F0-9]{16}/)?.[0]); check(!!createdReturn, 'Actual Return form submitted through H3/SQL')
  const returnId = (await f.db.query('select id from public.after_sales_claims where reference=$1', [createdReturn])).rows[0].id
  await show('center'); await begin(eligible, 'warranty'); await fill('warranty', 'CUSTOMER-FORM-SERIAL'); await button('reviewSubmission').click(); await page.locator('[data-claim-confirmation]').waitFor(); await button('submit').click(); await page.locator('[data-claim-timeline]').waitFor(); check((await page.locator('main').innerText()).includes('AS-W-'), 'Actual Warranty form submitted')
  await show('detail', true, returnId); await staffAction('review'); await staffAction('note', 'PRIVATE-FINAL-BROWSER-NOTE'); await staffAction('request_information', 'Please add a clear photo.', null, true)
  await show('detail', false, returnId); check(!(await page.locator('main').innerText()).includes('PRIVATE-FINAL-BROWSER-NOTE'), 'Internal note stays private after actions'); await page.locator('textarea').fill('Customer response from actual component')
  await page.locator('input[type="file"]').setInputFiles({ name: 'browser-evidence.png', mimeType: 'image/png', buffer: Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]) }); await page.getByText('browser-evidence.png', { exact: true }).waitFor(); await button('sendResponse').click(); await page.getByRole('status').filter({ hasText: messages.en.claims.saved }).waitFor()
  await show('detail', true, returnId); await page.getByRole('button', { name: /browser-evidence.png/ }).click(); await page.waitForFunction(() => window.claimsTest.downloads.at(-1)?.bytes === 8); check(await page.evaluate(() => window.claimsTest.downloads.at(-1)?.bytes === 8), 'Private evidence download uses actual API')
  for (const action of ['approve','receive','inspect']) await staffAction(action)
  await staffAction('select_resolution', 'Refund decision only; no gateway execution', 'refund'); await staffAction('resolve', 'Case decision recorded'); check((await page.locator('main').innerText()).includes(messages.en.claims.refundNotice), 'Refund execution not implied')
  await show('detail', true, repairClaim.id); await staffAction('review'); await staffAction('verify_serial', 'Serial checked by staff'); await staffAction('approve'); await staffAction('receive'); await staffAction('inspect'); await page.locator('[data-claim-action]').selectOption('select_resolution'); check(await page.locator('[data-claim-resolution] option').count() === 2, 'Only purchased repair resolution available'); await staffAction('select_resolution', 'Purchased repair decision', 'repair'); await staffAction('resolve')
  check((await f.order(eligible.order_id)).payment_status !== 'refunded', 'No financial mutation')
  for (const table of ['shipping_order_jobs','sms_batches','sms_messages','payment_transactions','commerce_order_returns']) check(Number((await f.db.query('select count(*) n from public.' + table)).rows[0].n) === 0, 'No external/inventory ledger: ' + table)
  check(errors.length === 0, 'No browser errors: ' + errors.join('\n')); check(external.length === 0, 'No external requests')
  await writeFile(join(dir, 'results.json'), JSON.stringify({ assertions, states, screens, responseScans: scans.length, errors, external, localAuthentication: 'Fixture only; actual H3/RBAC/disposable SQL', actualReturnAndWarrantyForms: true, privateEvidence: true, staffWorkflow: true }, null, 2)); console.log(JSON.stringify({ assertions, states, screens, responseScans: scans.length, errors, external }))
} catch (error) { await page.screenshot({ path: join(dir, 'failure.png'), fullPage: true }); await writeFile(join(dir, 'failure.json'), JSON.stringify({ message: error.message, assertions, states, errors, external }, null, 2)); throw error }
finally { await browser.close(); await close() }
