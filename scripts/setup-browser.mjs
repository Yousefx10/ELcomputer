// Actual Setup Vue page, application CSS and actual H3/SQL commands. Auth is a
// fixture. All browser traffic is restricted to this owned loopback server.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { parse, compileScript, compileStyle } from '@vue/compiler-sfc'
import { defineEventHandler } from 'h3'
import { createSetupFixture, SETUP_CANARY } from '../tests/helpers/setupFixture.mjs'

const { chromium } = await import(pathToFileURL(process.env.SETUP_REVIEW_PLAYWRIGHT || '/private/tmp/elcomputer-final-browser-tools/node_modules/playwright/index.mjs').href)
const base = resolve('.'), dir = process.env.SETUP_REVIEW_ARTIFACTS || '/private/tmp/elcomputer-setup-browser'
await mkdir(dir, { recursive: true })
const { descriptor } = parse(await readFile('app/pages/dashboard/setup.vue', 'utf8'))
await writeFile(join(dir, 'Setup.js'), compileScript(descriptor, { id: 'setup-review', inlineTemplate: true }).content)
const componentCss = descriptor.styles.map(style => compileStyle({ source: style.content, filename: 'setup.vue', id: 'setup-review', scoped: style.scoped }).code).join('\n')
const f = await createSetupFixture()
const admins = Object.fromEntries((await f.db.query('select id,role,is_active from public.admin_users')).rows.map(row => [Object.keys(f.actors).find(key => f.actors[key] === row.id), row]))
await writeFile(join(dir, 'entry.js'), `
import{createApp,h,ref,computed,onMounted,watch,nextTick}from'vue';import{createI18n}from'vue-i18n';import Setup from './Setup.js';
import en from '${join(base, 'i18n/locales/en.json')}';import ar from '${join(base, 'i18n/locales/ar.json')}';import icons from '${join(base, 'node_modules/@iconify-json/lucide/icons.json')}';
Setup.__scopeId='data-v-setup-review';
const i18n=createI18n({legacy:false,locale:'en',messages:{en,ar}}),actor=ref('owner'),generation=ref(0),theme=ref('light'),admins=${JSON.stringify(admins)},requests=[],links=[];
const appearance=()=>{document.documentElement.lang=i18n.global.locale.value;document.documentElement.dir=i18n.global.locale.value==='ar'?'rtl':'ltr';document.documentElement.classList.toggle('dark',theme.value==='dark'||theme.value==='system'&&matchMedia('(prefers-color-scheme:dark)').matches)};matchMedia('(prefers-color-scheme:dark)').addEventListener('change',appearance);
const request=async(path,options={})=>{requests.push({path,method:options.method||'GET'});const response=await fetch(path,{method:options.method||'GET',headers:{authorization:'Bearer '+actor.value,'content-type':'application/json'},...(options.body?{body:JSON.stringify(options.body)}:{})});const data=await response.json();if(!response.ok){const error=Error('Fixture request rejected');error.statusCode=response.status;throw error}return data};
Object.assign(globalThis,{ref,computed,onMounted,watch,nextTick,definePageMeta:()=>{},useHead:()=>{},useI18n:()=>i18n.global,useSupportClient:()=>({request}),useAdminAccess:()=>({isOwner:computed(()=>admins[actor.value]?.role==='owner'),isActiveAdmin:computed(()=>admins[actor.value]?.is_active===true)})});
const app=createApp({render:()=>h('main',{class:'p-4 mx-auto max-w-7xl'},[h(Setup,{key:generation.value})])});app.use(i18n);
app.component('Icon',{props:['name'],setup(p,{attrs}){return()=>h('span',{...attrs,style:'display:inline-flex;width:1em;height:1em'},[h('svg',{viewBox:'0 0 24 24',width:'100%',height:'100%',innerHTML:icons.icons[p.name.replace('lucide:','')]?.body||''})])}});
app.component('NuxtLinkLocale',{props:['to'],setup(p,{slots}){return()=>h('a',{href:(i18n.global.locale.value==='ar'?'/ar':'')+p.to,onClick:e=>{e.preventDefault();links.push(p.to)}},slots.default?.())}});
app.mount('#app');appearance();window.setupTest={actor,theme,locale:i18n.global.locale,requests,links,appearance,show:async name=>{actor.value=name;generation.value++;await nextTick()}};
`)
await build({ entryPoints: [join(dir, 'entry.js')], bundle: true, outfile: join(dir, 'bundle.js'), alias: { '~': join(base, 'app') }, nodePaths: [join(base, 'node_modules')], define: { 'process.env.NODE_ENV': '"test"', __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' } })
const css = (await Promise.all((await readdir('.output/public/_nuxt')).filter(file => file.endsWith('.css')).map(file => readFile(join('.output/public/_nuxt', file), 'utf8')))).join('\n') + componentCss
const { url, close } = await f.start(defineEventHandler(async event => {
  event.node.res.setHeader('content-type', event.path === '/bundle.js' ? 'text/javascript' : 'text/html')
  return event.path === '/bundle.js' ? readFile(join(dir, 'bundle.js'), 'utf8') : `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="app"></div><script src="/bundle.js"></script></body></html>`
}))
const browser = await chromium.launch({ executablePath: process.env.SETUP_REVIEW_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = [], external = [], scans = [], pending = []
let assertions = 0, screens = 0
const check = (value, message) => { assert.ok(value, message); assertions++ }
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (['warning', 'error'].includes(m.type()) && !/^Failed to load resource: the server responded with a status of 409\b/.test(m.text())) errors.push(m.text()) })
await page.route('**/*', route => route.request().url().startsWith(url) ? route.continue() : (external.push(route.request().url()), route.abort()))
page.on('response', response => {
  if ((response.headers()['content-type'] || '').includes('json')) pending.push((async () => {
    const value = await response.text()
    check(!value.includes(SETUP_CANARY), 'Secret canary absent from API')
    check(!/_encrypted|api_key|supabaseServiceRoleKey|author_email|account_url/.test(value), 'Private fields absent from API')
    scans.push({ path: new URL(response.url()).pathname, status: response.status() })
  })())
})
const messages = Object.fromEntries(await Promise.all(['en', 'ar'].map(async lang => [lang, JSON.parse(await readFile('i18n/locales/' + lang + '.json', 'utf8')).quickSetup])))
let language = 'en'
const wait = () => page.getByRole('progressbar').waitFor()
const step = async id => { await page.getByRole('navigation', { name: messages[language].steps }).getByRole('button').filter({ hasText: messages[language].sections[id] }).click(); await page.getByRole('heading', { level: 2, name: messages[language].sections[id], exact: true }).waitFor() }
const inspect = async name => {
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow: ' + name)
  check(await page.locator('html').getAttribute('dir') === (language === 'ar' ? 'rtl' : 'ltr'), 'Correct direction: ' + name)
  const text = await page.locator('main').innerText()
  check(!text.includes('quickSetup.'), 'Translated copy: ' + name)
  check(!text.includes(SETUP_CANARY), 'No private rendered data: ' + name)
  check(await page.locator('form,input:not([data-setup-selection]),textarea,select').count() === 0, 'Guide edits only nonsecret setup metadata: ' + name)
  await page.screenshot({ path: join(dir, name + '.png'), fullPage: true }); screens++
}
try {
  const before = await f.snapshot()
  await page.goto(url); await wait()
  for (language of ['en', 'ar']) for (const width of [1440, 768, 390]) for (const theme of ['light', 'dark', 'system']) {
    await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ colorScheme: theme === 'light' ? 'light' : 'dark' })
    await page.evaluate(({ language, theme }) => { window.setupTest.locale.value = language; window.setupTest.theme.value = theme; window.setupTest.appearance() }, { language, theme })
    check(await page.locator('.setup-summary').evaluate(e => getComputedStyle(e).backgroundColor) === (theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(17, 24, 39)'), 'Actual theme surface changes')
    for (const id of ['system', 'store', 'payments', 'shipping', 'messages', 'authentication', 'readiness']) {
      await step(id); await inspect(language + '-' + width + '-' + theme + '-' + id)
      check(await page.getByRole('navigation', { name: messages[language].steps }).locator('[aria-current="step"]').count() === 1, 'One current step')
      check(await page.getByRole('heading', { level: 2 }).evaluate(e => document.activeElement === e), 'Step heading receives focus')
    }
    await step('store')
    for (const link of await page.locator('.setup-actions a').all()) {
      const href = await link.getAttribute('href'); check(href.startsWith(language === 'ar' ? '/ar/dashboard/' : '/dashboard/'), 'Localized existing editor link')
      await link.click()
    }
  }
  check(JSON.stringify(await f.snapshot()) === JSON.stringify(before), 'Browser status reads preserve every public table')
  language = 'en'; await page.evaluate(() => { window.setupTest.locale.value = 'en'; window.setupTest.appearance() })
  await page.setViewportSize({ width: 1440, height: 1000 }); await step('system')
  await page.getByRole('button', { name: messages.en.next, exact: true }).focus(); await page.keyboard.press('Enter')
  check(await page.getByRole('heading', { level: 2 }).innerText() === messages.en.sections.store, 'Keyboard advances the guide')
  await page.getByRole('button', { name: messages.en.previous, exact: true }).click()
  check(await page.getByRole('heading', { level: 2 }).innerText() === messages.en.sections.system, 'Previous step works')
  await step('payments'); check(await page.locator('[data-setup-item="paypal"] .setup-card-header .setup-badge').innerText() === messages.en.states.unsupported, 'PayPal accurately unsupported')
  await step('messages'); check(await page.locator('[data-setup-item="vodafone"]').innerText().then(t => t.includes(messages.en.disabled)), 'Disabled Vodafone shown')
  await step('readiness'); await page.getByRole('button', { name: messages.en.review, exact: true }).first().click()
  check(await page.getByRole('heading', { level: 2 }).innerText() === messages.en.sections.authentication, 'Readiness blocker opens relevant section')
  // Deliberate owner metadata writes against real isolated SQL; providers stay OFF.
  const unchangedProviderState = snapshot => Object.fromEntries(Object.entries(snapshot).filter(([key]) => !key.startsWith('quick_setup_') && key !== 'admin_activity_logs'))
  const mutationBefore = unchangedProviderState(await f.snapshot())
  const saved = async revision => {
    await page.waitForFunction(() => !document.querySelector('[data-setup-selection]:disabled') || !document.querySelector('[data-setup-selection]'))
    await page.waitForFunction(revision => window.setupTest.requests.filter(r => r.method === 'PATCH').length >= revision, revision)
    await page.getByText(messages.en.saving, { exact: true }).waitFor({ state: 'hidden' })
  }
  await step('messages')
  const choice = page.locator('[data-integration="vodafone"]')
  await choice.check(); await saved(1)
  check(await choice.isChecked(), 'Optional selection saved')
  check((await page.locator('[data-setup-item="vodafone"]').innerText()).includes(messages.en.disabled), 'Selection never enables Vodafone')
  await inspect('en-phase2-selected-off')
  await page.reload(); await wait(); await step('messages')
  check(await choice.isChecked(), 'Selection persists through reload')
  await page.locator('[data-evidence-item="vodafone"]').getByRole('button', { name: messages.en.saveCurrentCheck, exact: true }).click()
  await saved(1)
  check(await page.locator('[data-evidence-item="vodafone"] .setup-badge').innerText() === messages.en.states.unverified, 'Saving configuration remains unverified')
  await step('readiness')
  const authReview = page.locator('[data-acknowledgement="auth"]')
  await authReview.getByRole('button', { name: messages.en.confirmReview, exact: true }).click(); await saved(2)
  check((await authReview.innerText()).includes(messages.en.states.acknowledged), 'Owner review is separate from machine verification')
  check(await page.locator('.setup-history li').count() === 3, 'Immutable history lists owner actions')
  await inspect('en-phase2-readiness')
  language = 'ar'; await page.setViewportSize({ width: 390, height: 1000 })
  await page.evaluate(() => { window.setupTest.locale.value = 'ar'; window.setupTest.appearance() })
  await inspect('ar-phase2-mobile-readiness')
  await step('messages'); await inspect('ar-phase2-mobile-evidence')
  language = 'en'; await page.setViewportSize({ width: 1440, height: 1000 })
  await page.evaluate(() => { window.setupTest.locale.value = 'en'; window.setupTest.appearance() })
  f.runtime.smsWorkerSecret += '-rotated'
  await page.getByRole('button', { name: messages.en.refresh, exact: true }).click(); await wait()
  check(await page.locator('[data-evidence-item="vodafone"] .setup-badge').innerText() === messages.en.states.stale, 'Runtime configuration invalidates saved evidence')
  await inspect('en-phase2-stale')
  await step('readiness')
  await authReview.getByRole('button', { name: messages.en.withdrawAcknowledgement, exact: true }).click(); await saved(3)
  check((await authReview.innerText()).includes(messages.en.states.revoked), 'Owner can withdraw review without deleting history')
  // Simulate another owner tab changing the revision immediately before this save.
  await page.route('**/api/admin-setup/state', async route => {
    await f.db.query('select public.quick_setup_mutate($1,$2)', [f.actors.owner, { action:'selection', key:'brevo', selected:true, revision:4 }])
    await route.continue(); await page.unroute('**/api/admin-setup/state')
  })
  await authReview.getByRole('button', { name: messages.en.confirmReview, exact: true }).click(); await saved(4)
  check(await page.getByRole('alert').innerText() === messages.en.saveConflict, 'Conflict is explained without retrying a write')
  check(await page.locator('.setup-history li').count() === 5, 'Conflicting save adds no history')
  await inspect('en-phase2-conflict')
  check(JSON.stringify(unchangedProviderState(await f.snapshot())) === JSON.stringify(mutationBefore), 'Metadata writes leave provider controls, queues and business data unchanged')
  await f.db.query("insert into public.erp_provider_settings(id,account_url,api_key_encrypted) values('daftra','https://fixture.daftra.com','fixture-encrypted')")
  await f.db.query("update public.site_settings set daftra_connection_status='connected',daftra_last_checked_at=clock_timestamp(),daftra_tested_revision=1 where key='default'")
  await page.getByRole('button', { name: messages.en.refresh, exact: true }).click(); await wait(); await step('shipping')
  await page.locator('[data-evidence-item="daftra"]').getByRole('button', { name: messages.en.saveCurrentCheck, exact: true }).click(); await saved(5)
  check(await page.locator('[data-evidence-item="daftra"] .setup-badge').innerText() === messages.en.states.verified, 'Existing revision-bound Daftra test can be saved as verified')
  check((await page.locator('[data-setup-item="daftra"]').innerText()).includes(messages.en.builtInActive), 'Verified connection never activates ERP ownership')
  await inspect('en-phase2-verified-daftra')
  f.runtime.credentialsEncryptionKey += '-rotated'
  await page.getByRole('button', { name: messages.en.refresh, exact: true }).click(); await wait()
  await page.locator('[data-evidence-item="daftra"]').getByRole('button', { name: messages.en.saveCurrentCheck, exact: true }).click(); await saved(6)
  check(await page.locator('[data-evidence-item="daftra"] .setup-badge').innerText() === messages.en.states.stale, 'Saving an unchanged old test cannot renew stale verification')
  await inspect('en-phase2-old-test-stale')
  await f.db.exec('alter view public.quick_setup_snapshot rename to unavailable_snapshot')
  await page.getByRole('button', { name: messages.en.refresh, exact: true }).click(); await wait()
  check(await page.getByText(messages.en.persistenceUnavailable, { exact:true }).isVisible(), 'Missing migration preserves the read-only guide')
  check(await page.locator('[data-setup-selection],[data-evidence-item],[data-acknowledgement] button').count() === 0, 'Unavailable metadata has no write controls')
  await inspect('en-phase2-metadata-unavailable')
  await f.db.exec('alter view public.unavailable_snapshot rename to quick_setup_snapshot')
  // Selected, failed, stale and unavailable states use synthetic local records only.
  await f.db.query("select set_config('request.jwt.claim.role','service_role',false)")
  await f.db.query("update public.site_settings set erp_mode='daftra',daftra_connection_status='error',daftra_last_checked_at=now(),daftra_tested_revision=1 where key='default'")
  f.runtime.daftraAccountUrl = 'https://fixture.daftra.com'
  await page.getByRole('button', { name: messages.en.refresh, exact: true }).click(); await wait(); await step('shipping')
  check(await page.locator('[data-setup-item="daftra"]').innerText().then(t => t.includes(messages.en.states.failed)), 'Failed connection remains active Daftra')
  await inspect('en-daftra-failed')
  await f.db.query("update public.site_settings set daftra_last_checked_at=now()-interval '2 days' where key='default'")
  await page.getByRole('button', { name: messages.en.refresh, exact: true }).click(); await wait(); await step('shipping')
  check(await page.locator('[data-setup-item="daftra"]').innerText().then(t => t.includes(messages.en.states.stale)), 'Stale evidence shown')
  await inspect('en-daftra-stale')
  await f.activate()
  await f.db.query("update public.sms_provider_settings set is_enabled=true,base_url='https://sms.example.invalid',account_id_encrypted=$1,password_encrypted=$1,hash_secret_encrypted=$1,default_sender='Store',sender_names=array['Store'],expected_outbound_ip='203.0.113.4',trusted_ip_confirmed=true,activation_confirmed=true,hash_protocol_confirmed=true", [SETUP_CANARY])
  const selectedBefore = await f.snapshot()
  await page.getByRole('button', { name: messages.en.refresh, exact: true }).click(); await wait(); await step('messages')
  for (const id of ['vodafone', 'brevo']) {
    const card = page.locator('[data-setup-item="' + id + '"]')
    check(await card.locator('.setup-card-header .setup-badge').innerText() === messages.en.states.complete, 'Selected provider configuration complete')
    check((await card.innerText()).includes(messages.en.states.not_verified), 'Configured provider connection remains unverified')
  }
  await inspect('en-providers-configured')
  language = 'ar'; await page.evaluate(() => { window.setupTest.locale.value = 'ar'; window.setupTest.appearance() }); await inspect('ar-providers-configured')
  language = 'en'; await page.evaluate(() => { window.setupTest.locale.value = 'en'; window.setupTest.appearance() })
  check(JSON.stringify(await f.snapshot()) === JSON.stringify(selectedBefore), 'Selected provider status leaves configuration and queues unchanged')
  await f.db.exec('alter table public.email_provider_settings rename to fixture_unavailable_email_settings')
  await page.getByRole('button', { name: messages.en.refresh, exact: true }).click(); await wait(); await step('messages')
  check(await page.locator('[data-setup-item="brevo"] .setup-card-header .setup-badge').innerText() === messages.en.states.not_verified, 'Unavailable settings shown unverified')
  await inspect('en-email-unavailable')
  // A pending owner mutation response must not repopulate a revoked session.
  await step('payments')
  await page.route('**/api/admin-setup/state', async route => {
    const response = await route.fetch(); await new Promise(done => setTimeout(done, 200)); await route.fulfill({ response })
  })
  await page.locator('[data-integration="paypal"]').check()
  await page.evaluate(() => { window.setupTest.actor.value = 'viewer' }); await page.getByRole('alert').waitFor()
  await page.waitForTimeout(350)
  check(await page.getByRole('progressbar').count() === 0, 'Late mutation response cannot restore revoked setup data')
  await inspect('phase2-late-save-revoked')
  await page.unroute('**/api/admin-setup/state')
  await page.evaluate(() => window.setupTest.show('owner')); await wait()
  const requestsBefore = await page.evaluate(() => window.setupTest.requests.length)
  for (const actor of ['viewer', 'manager', 'customer', 'inactive']) {
    await page.evaluate(actor => window.setupTest.show(actor), actor)
    await page.getByRole('alert').waitFor(); check(await page.getByRole('progressbar').count() === 0, 'Denied page has no setup data')
    await inspect('denied-' + actor)
  }
  check(await page.evaluate(() => window.setupTest.requests.length) === requestsBefore, 'Denied pages never fetch setup data')
  await page.evaluate(() => window.setupTest.show('owner')); await wait()
  await page.evaluate(() => { window.setupTest.actor.value = 'viewer' }); await page.getByRole('alert').waitFor()
  check(await page.getByRole('progressbar').count() === 0, 'Role revocation clears private status')
  await inspect('role-revoked')
  await page.evaluate(() => window.setupTest.show('owner')); await wait()
  await page.route('**/api/admin-setup/status', async route => {
    const response = await route.fetch(); await new Promise(done => setTimeout(done, 200)); await route.fulfill({ response })
  })
  await page.getByRole('button', { name: messages.en.refresh, exact: true }).click()
  await page.evaluate(() => { window.setupTest.actor.value = 'viewer' }); await page.getByRole('alert').waitFor()
  await page.waitForTimeout(350)
  check(await page.getByRole('progressbar').count() === 0, 'Late owner response cannot restore private status after revocation')
  await page.unroute('**/api/admin-setup/status')
  const requests = await page.evaluate(() => window.setupTest.requests)
  check(requests.every(r => r.path === '/api/admin-setup/status' && r.method === 'GET' || r.path === '/api/admin-setup/state' && r.method === 'PATCH'), 'Only protected setup reads and deliberate metadata writes requested')
  await Promise.all(pending); check(errors.length === 0, 'No browser errors: ' + errors.join('; ')); check(external.length === 0, 'No external requests')
  const report = { assertions, screenshots: screens, jsonResponses: scans.length, requests, errors, external, realProviderCalls: 0, productionAccess: false, hostedAuthenticatedAcceptance: false }
  await writeFile(join(dir, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ ...report, requests: requests.length }))
} finally { await browser.close(); await close() }
