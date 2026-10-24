// Exact extracted application; all Auth/REST data is synthetic and loopback-only.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { randomUUID, createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { inventory } from '../publish/inventory.mjs'
import { digest } from './operator.mjs'

const work = resolve(process.argv[2]), load = async name => JSON.parse(await readFile(work + '/' + name, 'utf8'))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const attempt = work + '/qualification-' + Date.now()
await mkdir(attempt, { mode: 0o700 })
const artifact = await load('artifact.json'), entries = await load('inventory.json')
assert.equal(hash(await readFile(work + '/application.tar.gz')), artifact.archive_sha256)
assert.equal(digest(await inventory(work + '/readback')), artifact.inventory_sha256)
const a = randomUUID(), b = randomUUID(), orderId = randomUUID(), product = randomUUID(), now = Math.floor(Date.now() / 1000)
let backendOrigin
const users = Object.fromEntries([a, b].map((id, index) => [id, { id, aud: 'authenticated', role: 'authenticated', email: (index ? 'bob' : 'alice') + '@example.invalid',
  email_confirmed_at: '2026-01-01T00:00:00Z', confirmed_at: '2026-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z', is_anonymous: false,
  app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { full_name: index ? 'BOB_PRIVATE' : 'ALICE_PRIVATE' } }]))
const profiles = Object.fromEntries([a, b].map((id, index) => [id, { id, email: users[id].email, is_active: true,
  full_name: users[id].user_metadata.full_name, phone: '01012345678', address_line_1: index ? 'BOB_PRIVATE_STREET' : 'ALICE_PRIVATE_STREET', city: 'Cairo', state: 'Cairo', country: 'Egypt', wallet_balance: index ? 200 : 100 }]))
const orders = [{ id: orderId, user_id: a, order_number: 'ALICE_PRIVATE_ORDER', first_name: 'ALICE_PRIVATE', street_address: 'ALICE_PRIVATE_STREET',
  phone: '01012345678', email: users[a].email, city: 'Cairo', governorate: 'Cairo', status: 'processing', payment_status: 'paid', payment_method: 'card', total_amount: 100, currency: 'EGP', created_at: '2026-01-01T00:00:00Z' }]
const settings = { key: 'default', site_name: 'Synthetic store', account_dashboard_style: 'modern', footer_style: 'classic', hero_enabled: false,
  payment_card_enabled: false, payment_cash_enabled: false, payment_bank_transfer_enabled: false, payment_instapay_enabled: false, payment_paypal_enabled: false }
const token = id => [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: id, aud: 'authenticated', role: 'authenticated', email: users[id].email, is_anonymous: false, exp: now + 86400, iat: now, iss: backendOrigin + '/auth/v1', app_metadata: users[id].app_metadata, user_metadata: users[id].user_metadata })).toString('base64url'), 'c3ludGhldGlj'].join('.')
const actor = req => { try { return JSON.parse(Buffer.from(String(req.headers.authorization || '').split(' ')[1].split('.')[1], 'base64url')).sub } catch { return null } }
const backendRequests = [], unexpectedWrites = [], suppressedTelemetry = []
const backend = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1'), id = actor(req)
  res.setHeader('access-control-allow-origin', req.headers.origin || '*')
  res.setHeader('access-control-allow-headers', '*'); res.setHeader('access-control-allow-methods', 'GET,HEAD,POST,OPTIONS')
  if (req.method === 'OPTIONS') { res.end(); return }
  backendRequests.push({ method: req.method, path: url.pathname })
  res.setHeader('content-type', 'application/json; charset=utf-8')
  const send = value => res.end(JSON.stringify(value))
  if (url.pathname === '/auth/v1/settings') return send({ disable_signup: true, mailer_autoconfirm: false, external: { email: true } })
  if (url.pathname === '/auth/v1/token' && req.method === 'POST') {
    const chunks = []; for await (const chunk of req) chunks.push(chunk)
    const body = JSON.parse(Buffer.concat(chunks).toString()), userId = body.email === users[b].email ? b : a
    return send({ access_token: token(userId), refresh_token: 'synthetic-' + userId, token_type: 'bearer', expires_in: 86400, expires_at: now + 86400, user: users[userId] })
  }
  if (url.pathname === '/auth/v1/logout' && req.method === 'POST') return send({})
  if (url.pathname === '/auth/v1/user' && req.method === 'GET') {
    if (!users[id]) { res.statusCode = 401; return send({ message: 'Synthetic denial' }) }
    return send(users[id])
  }
  if (url.pathname === '/rest/v1/rpc/after_sales_order_entitlements' && req.method === 'POST'
    && req.headers.authorization === 'Bearer isolated-service-role-key') return send([])
  if (url.pathname === '/rest/v1/rpc/store_analytics_is_internal_user' && req.method === 'POST') return send(false)
  if (url.pathname === '/rest/v1/store_analytics_sessions' && req.method === 'POST') {
    suppressedTelemetry.push({ method: req.method, path: url.pathname }); res.statusCode = 503; return send({ message: 'Synthetic analytics write suppressed' })
  }
  if (!['GET', 'HEAD'].includes(req.method)) { unexpectedWrites.push({ method: req.method, path: url.pathname }); res.statusCode = 500; return send({ message: 'Synthetic mutation forbidden' }) }
  const table = url.pathname.split('/').at(-1), requested = (url.searchParams.get('id') || '').replace(/^eq\./, '')
  let rows = []
  if (table === 'site_settings') rows = [settings]
  if (table === 'customer_profiles' && profiles[requested] && (id === requested || req.headers.authorization === 'Bearer isolated-service-role-key')) rows = [profiles[requested]]
  if (table === 'customer_orders') {
    const owner = id || (req.headers.authorization === 'Bearer isolated-service-role-key' ? (url.searchParams.get('user_id') || '').replace(/^eq\./, '') : null)
    rows = orders.filter(order => order.user_id === owner && (!requested || order.id === requested))
  }
  if (table === 'storefront_products') rows = [{ id: product, title: 'Synthetic available product', slug: 'synthetic-product', price: 100, stock_quantity: 1, is_published: true, is_serialized: false, selling_mode: 'normal' }]
  res.setHeader('content-range', '0-' + Math.max(0, rows.length - 1) + '/' + rows.length)
  if (req.method === 'HEAD') { res.end(); return }
  if (String(req.headers.accept).includes('application/vnd.pgrst.object+json')) return send(rows[0] || null)
  send(rows)
})
await new Promise(done => backend.listen(0, '127.0.0.1', done)); backendOrigin = 'http://127.0.0.1:' + backend.address().port
const preload = attempt + '/loopback-only.cjs'
await writeFile(preload, "const original=globalThis.fetch;globalThis.fetch=(input,options)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.hostname!=='127.0.0.1')throw Error('EXTERNAL_FETCH_FORBIDDEN');return original(input,options)};\n", { flag: 'wx', mode: 0o600 })
const checks = [], blockedBrowserRequests = [], pageErrors = [], consoleErrors = []
let runtime, browser
async function start(publicFixture) {
  const { createServer: portProbe } = await import('node:net'), probe = portProbe()
  await new Promise(done => probe.listen(0, '127.0.0.1', done)); const port = probe.address().port; await new Promise(done => probe.close(done))
  const env = { PATH: dirname(process.execPath) + ':/usr/bin:/bin', HOME: process.env.HOME, LANG: 'C', NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port),
    NUXT_PUBLIC_SUPABASE_URL: backendOrigin, NUXT_PUBLIC_SUPABASE_KEY: 'isolated-anon-key', NUXT_SUPABASE_SERVICE_ROLE_KEY: 'isolated-service-role-key',
    NUXT_PUBLIC_SITE_URL: 'https://orchid.example.invalid', NUXT_PUBLIC_PURCHASING_ENABLED: publicFixture ? 'true' : 'false',
    NUXT_PAYMOB_ENABLED: 'false', NUXT_PAYMOB_LIVE_REQUESTS_ENABLED: 'false', NUXT_SHIPPING_LIVE_REQUESTS_ENABLED: 'false', PDC_LIVE_REQUESTS_ENABLED: 'false',
    NUXT_CONTROLLED_PURCHASE: '{}', NODE_OPTIONS: '--require=' + preload }
  const child = spawn(process.execPath, [work + '/readback/server/index.mjs'], { cwd: work + '/readback', env, stdio: ['ignore', 'pipe', 'pipe'] })
  const logs = []; child.stdout.on('data', bytes => logs.push(bytes)); child.stderr.on('data', bytes => logs.push(bytes))
  const ended = new Promise(done => child.once('exit', done)), origin = 'http://127.0.0.1:' + port
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(origin + '/_nuxt/builds/latest.json')).status === 200) break } catch {}
    assert.equal(child.exitCode, null); await new Promise(done => setTimeout(done, 100))
  }
  return { child, origin, async stop(name) { child.kill('SIGTERM'); const timer = setTimeout(() => child.kill('SIGKILL'), 3000); await ended; clearTimeout(timer); const text = Buffer.concat(logs).toString(); await writeFile(attempt + '/' + name + '.log', text, { flag: 'wx', mode: 0o600 }); assert.equal(text.includes('EXTERNAL_FETCH_FORBIDDEN'), false) } }
}
try {
  runtime = await start(false)
  for (const [path, method, expected] of [['/api/payments/capabilities', 'GET', 200], ['/api/checkout/shipping', 'GET', 401], ['/api/checkout/quote', 'POST', 401], ['/api/checkout', 'POST', 401], ['/api/payments/intentions', 'POST', 401]]) {
    const response = await fetch(runtime.origin + path, { method, headers: { 'content-type': 'application/json' }, ...(method === 'POST' ? { body: '{}' } : {}) })
    assert.equal(response.status, expected)
    if (path === '/api/payments/capabilities') { const value = await response.json(); assert.equal(value.card.available, false); assert.equal(value.purchase.available, false) }
    else await response.body?.cancel()
    checks.push({ path, method, status: expected })
  }
  let assetsChecked = 0
  const files = entries.filter(entry => entry.type === 'file' && entry.path.startsWith('public/_nuxt/')); let next = 0
  await Promise.all(Array.from({ length: 8 }, async () => { while (next < files.length) { const entry = files[next++], response = await fetch(runtime.origin + '/' + entry.path.slice(7)); assert.equal(response.status, 200, entry.path); assert.equal(hash(Buffer.from(await response.arrayBuffer())), entry.sha256); assetsChecked++ } }))
  await runtime.stop('compiled-default'); runtime = null
  // Synthetic local purchasing flag permits inspection of private Vue state;
  // no order/payment endpoint is allowed by the browser transport below.
  runtime = await start(true)
  const { chromium } = await import(process.env.PDC_REVIEW_PLAYWRIGHT)
  browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await context.route('**/*', route => {
    const req = route.request(), url = new URL(req.url())
    const local = [runtime.origin, backendOrigin].includes(url.origin)
    const auth = url.origin === backendOrigin && /^\/auth\/v1\/(token|logout)$/.test(url.pathname)
    const allowedApi = /^\/api\/(storefront\/|payments\/capabilities|account\/orders\/|checkout\/shipping)/.test(url.pathname)
    if (!local || !['GET', 'HEAD', 'OPTIONS'].includes(req.method()) && !auth || url.origin === runtime.origin && url.pathname.startsWith('/api/') && !allowedApi) {
      blockedBrowserRequests.push({ method: req.method(), path: url.pathname }); return route.abort()
    }
    return route.continue()
  })
  const page = await context.newPage(), second = await context.newPage()
  for (const p of [page, second]) { p.on('pageerror', cause => pageErrors.push(cause.message)); p.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) }); p.setDefaultTimeout(15000) }
  const login = async (p, id) => {
    await p.goto(runtime.origin + '/login?redirect=/account/profile')
    await p.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false)
    await p.locator('#customer-email').fill(users[id].email); await p.locator('#customer-password').fill('Synthetic-password-only')
    await p.locator('.auth-form button[type=submit]').click()
    await p.locator('input[autocomplete=address-line1]').waitFor().catch(async error => {
      await writeFile(attempt + '/login-failure.json', JSON.stringify({ url: p.url(), visible_text: await p.locator('body').innerText(), backend_requests: backendRequests.slice(-25), page_errors: pageErrors, console_errors: consoleErrors.slice(-10), blocked: blockedBrowserRequests.slice(-10) }, null, 2))
      throw error
    })
    await p.waitForFunction(expected => document.querySelector('input[autocomplete=address-line1]')?.value === expected, profiles[id].address_line_1)
  }
  await login(page, a); checks.push({ browser: 'actual_auth_signin_A', result: 'PASS' })
  await second.goto(runtime.origin + '/account/profile')
  await second.waitForFunction(() => document.querySelector('input[autocomplete=address-line1]')?.value === 'ALICE_PRIVATE_STREET')
  await page.goto(runtime.origin + '/account/orders/' + orderId)
  await page.getByText('ALICE_PRIVATE_ORDER', { exact: true }).first().waitFor()
  // Sign-out through the existing account layout, broadcasting to the other tab.
  await second.getByRole('button', { name: /^(Log Out|Sign Out)$/i }).click()
  await second.waitForURL(runtime.origin + '/')
  await login(second, b)
  await page.waitForFunction(() => !document.querySelector('main')?.textContent?.includes('ALICE_PRIVATE_ORDER') && !document.body.innerText.includes('ALICE_PRIVATE_STREET'))
  await page.goto(runtime.origin + '/account/profile')
  await page.waitForFunction(() => document.querySelector('input[autocomplete=address-line1]')?.value === 'BOB_PRIVATE_STREET')
  checks.push({ browser: 'two_tab_A_signout_B_signin_no_A_order_or_address', result: 'PASS' })
  // Existing old browser cart remains unclaimed by B in the exact compiled app.
  await page.evaluate(() => localStorage.setItem('elcomputer-cart-state-v2', JSON.stringify({ version: 2, items: [{ id: crypto.randomUUID(), title: 'ALICE_UNOWNED_CART', stock_quantity: 1, price: 1, quantity: 1 }] })))
  await page.goto(runtime.origin + '/cart')
  await page.waitForTimeout(150)
  assert.equal((await page.locator('body').innerText()).includes('ALICE_UNOWNED_CART'), false)
  checks.push({ browser: 'legacy_cart_not_adopted', result: 'PASS' })
  let screenshots = 0
  for (const locale of ['en', 'ar']) for (const width of [1280, 390]) for (const theme of ['light', 'dark', 'system']) {
    await page.setViewportSize({ width, height: 1000 })
    await context.addCookies([{ name: 'elcomputer-theme-choice', value: theme, url: runtime.origin }])
    await page.evaluate(theme => localStorage.setItem('nuxt-color-mode', theme), theme)
    await page.emulateMedia({ colorScheme: theme === 'light' ? 'light' : 'dark' })
    await page.goto(runtime.origin + (locale === 'ar' ? '/ar' : '') + '/account/profile')
    await page.waitForFunction(() => document.querySelector('input[autocomplete=address-line1]')?.value === 'BOB_PRIVATE_STREET')
    assert.equal(await page.locator('html').getAttribute('dir'), locale === 'ar' ? 'rtl' : 'ltr')
    assert.equal(await page.locator('html').evaluate(node => node.classList.contains('dark')), theme !== 'light')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    await page.screenshot({ path: attempt + '/profile-' + locale + '-' + width + '-' + theme + '.png' }); screenshots++
  }
  checks.push({ browser: 'EN_AR_RTL_themes_mobile', screenshots, result: 'PASS' })
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(unexpectedWrites, [])
  const proof = { result: 'PASS', attempt_directory: attempt, archive_sha256: artifact.archive_sha256, inventory_sha256: artifact.inventory_sha256, checks, static_asset_byte_checks: assetsChecked,
    browser_checks: checks.filter(row => row.browser).length + screenshots, page_errors: pageErrors, expected_blocked_browser_requests: blockedBrowserRequests,
    console_errors: consoleErrors, backend_requests: backendRequests, suppressed_fixture_telemetry: suppressedTelemetry, unexpected_fixture_mutations: 0, hosted_connections: 0, transactional_provider_requests: 0, production_writes: 0 }
  await writeFile(work + '/exact-archive-qualification.json', JSON.stringify(proof, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
  console.log(JSON.stringify({ result: 'EXACT_ARCHIVE_PASS', http_checks: checks.length, assets: assetsChecked, browser_checks: proof.browser_checks, screenshots, page_errors: 0 }))
} finally { await writeFile(attempt + '/transport-diagnostics.json', JSON.stringify({ backendRequests, unexpectedWrites, pageErrors, blockedBrowserRequests }, null, 2)); await browser?.close(); if (runtime) await runtime.stop('compiled-browser'); backend.closeAllConnections(); await new Promise(done => backend.close(done)) }
