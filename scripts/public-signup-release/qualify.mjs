// Qualify an extracted archive against loopback fixtures. Never contacts hosted Auth.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { randomUUID, createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { inventory } from '../publish/inventory.mjs'

const work = resolve(process.argv[2]), load = async name => JSON.parse(await readFile(work + '/' + name, 'utf8'))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const artifact = await load('artifact.json'), entries = await load('inventory.json')
assert.equal(hash(await readFile(work + '/application.tar.gz')), artifact.archive_sha256)
assert.deepEqual(await inventory(work + '/readback'), entries)
const attempt = work + '/browser-' + Date.now(); await mkdir(attempt, { mode: 0o700 })
let registrationOpen = true, failure = 'invalid_credentials', signupFailure = null, backendOrigin, requireCaptcha = false, allowTurnstile = false, turnstileTestRequests = 0
const requests = [], forbidden = [], suppressedTelemetry = [], pageErrors = [], checks = []
const id = randomUUID(), now = Math.floor(Date.now() / 1000)
const user = { id, aud: 'authenticated', role: 'authenticated', email: 'original@example.test', email_confirmed_at: '2026-01-01T00:00:00Z', is_anonymous: false,
  app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { full_name: 'Synthetic Customer' } }
const token = () => [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: id, email: user.email, aud: 'authenticated', role: 'authenticated', exp: now + 86400, iat: now, iss: backendOrigin + '/auth/v1', app_metadata: user.app_metadata, user_metadata: user.user_metadata })).toString('base64url'), 'c3ludGhldGlj'].join('.')
const profile = { id, email: user.email, is_active: true, full_name: 'Synthetic Customer', wallet_balance: 0 }
const backend = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')
  res.setHeader('access-control-allow-origin', req.headers.origin || '*'); res.setHeader('access-control-allow-headers', '*'); res.setHeader('access-control-allow-methods', 'GET,HEAD,POST,OPTIONS')
  if (req.method === 'OPTIONS') { res.end(); return }
  res.setHeader('content-type', 'application/json')
  res.setHeader('x-supabase-api-version', '2024-01-01'); res.setHeader('access-control-expose-headers', 'X-Supabase-Api-Version')
  const send = (body, status = 200) => { res.statusCode = status; res.end(JSON.stringify(body)) }
  const body = req.method === 'POST' ? JSON.parse(await new Promise(resolve => { const chunks = []; req.on('data', v => chunks.push(v)); req.on('end', () => resolve(Buffer.concat(chunks).toString() || '{}')) })) : null
  requests.push({ method: req.method, path: url.pathname, captcha_present: !!body?.gotrue_meta_security?.captcha_token, ...(body && url.pathname === '/auth/v1/signup' ? { email: body.email, redirect: url.searchParams.get('redirect_to'), pkce: !!body.code_challenge } : {}) })
  if (requireCaptcha && ['/auth/v1/signup', '/auth/v1/token', '/auth/v1/recover'].includes(url.pathname) && !body?.gotrue_meta_security?.captcha_token) return send({ code: 'captcha_failed' }, 400)
  if (url.pathname === '/auth/v1/settings') return send({ disable_signup: !registrationOpen, mailer_autoconfirm: false, external: { email: true } })
  if (url.pathname === '/auth/v1/signup') return signupFailure ? send({ code: signupFailure, msg: 'Synthetic private error' }, signupFailure.includes('rate') ? 429 : 422) : send({ user: { ...user, email_confirmed_at: null }, session: null })
  if (url.pathname === '/auth/v1/token') return failure ? send({ code: failure, msg: 'Synthetic private error' }, 400) : send({ user, access_token: token(), refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 86400, expires_at: now + 86400 })
  if (url.pathname === '/auth/v1/user') return send(user)
  if (url.pathname === '/auth/v1/logout' || url.pathname === '/auth/v1/recover') return send({})
  if (url.pathname === '/rest/v1/rpc/store_analytics_is_internal_user') return send(false)
  if (url.pathname === '/rest/v1/rpc/support_customer_unread_ticket_count') return send(0)
  if (url.pathname === '/rest/v1/store_analytics_sessions') { suppressedTelemetry.push(url.pathname); return send({ message: 'Fixture telemetry suppressed' }, 503) }
  if (!['GET', 'HEAD'].includes(req.method)) { forbidden.push({ path: url.pathname, method: req.method }); return send({ message: 'Fixture mutation forbidden' }, 500) }
  const table = url.pathname.split('/').at(-1)
  let rows = table === 'site_settings' ? [{ key: 'default', site_name: 'Independent fixture store', footer_style: 'classic', hero_enabled: false }] : table === 'customer_profiles' ? [profile] : []
  res.setHeader('content-range', '0-' + Math.max(0, rows.length - 1) + '/' + rows.length)
  if (req.method === 'HEAD') { res.end(); return }
  send(String(req.headers.accept).includes('application/vnd.pgrst.object+json') ? rows[0] || null : rows)
})
await new Promise(done => backend.listen(0, '127.0.0.1', done)); backendOrigin = 'http://127.0.0.1:' + backend.address().port
const preload = attempt + '/loopback.cjs'
await writeFile(preload, "const original=globalThis.fetch;globalThis.fetch=(input,options)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(url.hostname!=='127.0.0.1')throw Error('EXTERNAL_FETCH_FORBIDDEN');return original(input,options)};\n", { flag: 'wx', mode: 0o600 })
let runtime, browser
async function start(flag, captcha = false) {
  const probe = createServer(); await new Promise(done => probe.listen(0, '127.0.0.1', done)); const port = probe.address().port; await new Promise(done => probe.close(done))
  const child = spawn(process.execPath, [work + '/readback/server/index.mjs'], { cwd: work + '/readback', env: {
    PATH: dirname(process.execPath) + ':/usr/bin:/bin', HOME: process.env.HOME, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port), NODE_OPTIONS: '--require=' + preload,
    NUXT_PUBLIC_SUPABASE_URL: backendOrigin, NUXT_PUBLIC_SUPABASE_KEY: 'synthetic-public', NUXT_SUPABASE_SERVICE_ROLE_KEY: 'synthetic-private', NUXT_PUBLIC_SITE_URL: 'https://independent.example.invalid',
    NUXT_PUBLIC_RETURNING_CUSTOMER_NOTICE_ENABLED: flag, NUXT_PUBLIC_PURCHASING_ENABLED: 'false', NUXT_PUBLIC_BETA_PURCHASING_ENABLED: 'false', NUXT_CONTROLLED_PURCHASE: '{}',
    NUXT_PUBLIC_AUTH_CAPTCHA_PROVIDER: captcha ? 'turnstile' : '', NUXT_PUBLIC_TURNSTILE_SITE_KEY: captcha ? '1x00000000000000000000AA' : '',
    NUXT_PAYMOB_ENABLED: 'false', NUXT_PAYMOB_LIVE_REQUESTS_ENABLED: 'false', NUXT_SHIPPING_LIVE_REQUESTS_ENABLED: 'false', PDC_LIVE_REQUESTS_ENABLED: 'false'
  }, stdio: ['ignore', 'pipe', 'pipe'] })
  const logs = []; child.stdout.on('data', v => logs.push(v)); child.stderr.on('data', v => logs.push(v))
  const ended = new Promise(done => child.once('exit', done)), origin = 'http://127.0.0.1:' + port
  let ready = false
  for (let i = 0; i < 100; i++) { try { const r = await fetch(origin + '/_nuxt/builds/latest.json'); await r.body?.cancel(); if (r.ok) { ready = true; break } } catch {} assert.equal(child.exitCode, null); await new Promise(done => setTimeout(done, 100)) }
  assert.ok(ready)
  return { origin, async stop() { child.kill('SIGTERM'); const timer = setTimeout(() => child.kill('SIGKILL'), 3000); await ended; clearTimeout(timer); const log = Buffer.concat(logs).toString(); await writeFile(attempt + '/server-' + flag + '-' + captcha + '.log', log); assert.equal(log.includes('EXTERNAL_FETCH_FORBIDDEN'), false) } }
}
try {
  const { chromium } = await import(process.env.SIGNUP_REVIEW_PLAYWRIGHT)
  browser = await chromium.launch({ headless: true, channel: 'chrome' })
  runtime = await start('false')
  let context = await browser.newContext()
  async function guard(ctx) {
    await ctx.route('**/*', route => {
      const req = route.request(), url = new URL(req.url())
      if (allowTurnstile && url.protocol === 'https:' && url.hostname === 'challenges.cloudflare.com') { turnstileTestRequests++; return route.continue() }
      const auth = url.origin === backendOrigin && /^\/auth\/v1\/(signup|token|logout|recover)$/.test(url.pathname)
      const allowed = [runtime.origin, backendOrigin].includes(url.origin) && (['GET', 'HEAD', 'OPTIONS'].includes(req.method()) || auth)
      if (!allowed) return route.abort()
      return route.continue()
    })
  }
  await guard(context)
  let page = await context.newPage(); page.on('pageerror', e => pageErrors.push(e.message))
  const visit = async path => { await page.goto(runtime.origin + path); await page.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false); await page.waitForTimeout(150) }
  await visit('/login'); assert.equal(await page.locator('.auth-returning').count(), 0); checks.push('other_store_notice_off')
  await context.close(); await runtime.stop(); runtime = await start('true')
  context = await browser.newContext(); await guard(context); page = await context.newPage(); page.on('pageerror', e => pageErrors.push(e.message))
  let screenshots = 0
  for (const locale of ['en', 'ar']) for (const width of [390, 1280]) for (const theme of ['light', 'dark', 'system']) for (const mode of ['login', 'signup']) {
    await page.setViewportSize({ width, height: 1100 }); await context.addCookies([{ name: 'elcomputer-theme-choice', value: theme, url: runtime.origin }]); await page.emulateMedia({ colorScheme: theme === 'light' ? 'light' : 'dark' })
    await visit((locale === 'ar' ? '/ar' : '') + '/login' + (mode === 'signup' ? '?mode=signup' : ''))
    await page.locator('.auth-returning').waitFor()
    assert.equal(await page.locator('html').getAttribute('dir'), locale === 'ar' ? 'rtl' : 'ltr')
    assert.equal(await page.locator('html').evaluate(node => node.classList.contains('dark')), theme !== 'light')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    await page.locator('.auth-returning button').first().focus(); assert.equal(await page.locator('.auth-returning button').first().evaluate(node => node === document.activeElement), true)
    await page.screenshot({ path: attempt + '/' + locale + '-' + width + '-' + theme + '-' + mode + '.png', fullPage: true }); screenshots++
  }
  checks.push('EN_AR_RTL_three_themes_mobile_desktop_keyboard')
  await visit('/login'); await page.locator('.auth-returning button').first().click(); await page.waitForURL(/mode=signup/)
  await page.locator('#customer-full-name').waitFor(); await page.locator('.auth-returning button').click(); await page.waitForURL(/mode=forgot/)
  assert.equal(await page.locator('.auth-returning').count(), 0); await visit('/login?mode=recovery'); assert.equal(await page.locator('.auth-returning').count(), 0); checks.push('notice_actions_and_recovery_modes')
  const errors = []
  for (const [email, code] of [['unknown@example.test', 'invalid_credentials'], ['original@example.test', 'invalid_credentials'], ['current@example.test', 'email_not_confirmed']]) {
    failure = code; await visit('/login'); const before = requests.length
    await page.locator('#customer-email').fill(email); await page.locator('#customer-password').fill('Synthetic-password'); await page.locator('.auth-submit').click(); await page.locator('[role=alert]').waitFor()
    errors.push(await page.locator('[role=alert]').innerText() + await page.locator('.auth-login-help').innerText())
    assert.deepEqual(requests.slice(before).map(r => r.path), ['/auth/v1/token'])
  }
  assert.equal(new Set(errors).size, 1); checks.push('failed_login_identical_no_existence_lookup')
  for (const locale of ['en', 'ar']) {
    signupFailure = null; await visit((locale === 'ar' ? '/ar' : '') + '/login?mode=signup')
    await page.locator('#customer-email').fill('original@example.test'); await page.locator('#customer-password').fill('Synthetic-password'); await page.locator('.auth-submit').click(); await page.locator('.auth-feedback--success').waitFor()
    const request = requests.filter(r => r.path === '/auth/v1/signup').at(-1); assert.equal(request.email, 'original@example.test'); assert.equal(request.redirect, runtime.origin + (locale === 'ar' ? '/ar' : '') + '/login'); assert.equal(request.pkce, true)
    assert.equal(await page.locator('#customer-password').inputValue(), '')
  }
  checks.push('ordinary_original_email_signup_pkce_localized_confirmation_request')
  signupFailure = 'user_already_exists'; await visit('/login?mode=signup'); await page.locator('#customer-email').fill('current@example.test'); await page.locator('#customer-password').fill('Synthetic-password'); await page.locator('.auth-submit').click(); await page.locator('.auth-feedback--success').waitFor(); checks.push('duplicate_signup_generic_guidance')
  signupFailure = 'over_email_send_rate_limit'; await visit('/login?mode=signup'); await page.locator('#customer-email').fill('original@example.test'); await page.locator('#customer-password').fill('Synthetic-password'); await page.locator('.auth-submit').click(); await page.locator('[role=alert]').waitFor(); assert.match(await page.locator('[role=alert]').innerText(), /Too many/); checks.push('provider_rate_denial_preserved')
  registrationOpen = false; await visit('/login'); assert.equal(await page.locator('.auth-returning').count(), 0); assert.equal(await page.locator('.auth-switch').count(), 0)
  await visit('/login?mode=signup'); assert.equal(await page.locator('.auth-submit').isDisabled(), true); checks.push('closed_signup_no_notice_or_submission')
  registrationOpen = true; failure = null; await visit('/login'); await page.locator('#customer-email').fill(user.email); await page.locator('#customer-password').fill('Synthetic-password'); await page.locator('.auth-submit').click(); await page.waitForURL(/\/account$/); checks.push('confirmed_customer_signin_to_account_fixture')
  let assets = 0, next = 0; const files = entries.filter(e => e.type === 'file' && e.path.startsWith('public/_nuxt/'))
  await Promise.all(Array.from({ length: 8 }, async () => { while (next < files.length) { const e = files[next++], r = await fetch(runtime.origin + '/' + e.path.slice(7)); assert.equal(r.status, 200, e.path); assert.equal(hash(Buffer.from(await r.arrayBuffer())), e.sha256, e.path); assets++ } }))
  const capability = await fetch(runtime.origin + '/api/payments/capabilities').then(r => r.json()); assert.equal(capability.purchase.available, false); assert.equal(capability.card.available, false); checks.push('purchasing_and_card_initiation_closed')
  await context.close(); await runtime.stop(); runtime = await start('true', true)
  requireCaptcha = true; allowTurnstile = true; failure = 'invalid_credentials'; signupFailure = null
  context = await browser.newContext(); await guard(context); page = await context.newPage(); page.on('pageerror', e => pageErrors.push(e.message))
  for (const locale of ['en', 'ar']) for (const width of [320, 1280]) for (const theme of ['light', 'dark', 'system']) {
    await page.setViewportSize({ width, height: 1100 }); await context.addCookies([{ name: 'elcomputer-theme-choice', value: theme, url: runtime.origin }]); await page.emulateMedia({ colorScheme: theme === 'light' ? 'light' : 'dark' })
    await visit((locale === 'ar' ? '/ar' : '') + '/login?mode=signup')
    await page.waitForFunction(() => document.querySelector('.auth-submit')?.disabled === false, null, { timeout: 20000 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    assert.equal(await page.locator('.auth-security').getAttribute('modelvalue'), null)
    await page.screenshot({ path: attempt + '/captcha-' + locale + '-' + width + '-' + theme + '.png', fullPage: true }); screenshots++
  }
  checks.push('official_Turnstile_test_widget_EN_AR_themes_320_desktop')
  for (const mode of ['signup', 'login', 'forgot']) {
    await visit('/login' + (mode === 'login' ? '' : '?mode=' + mode))
    await page.waitForFunction(() => document.querySelector('.auth-submit')?.disabled === false, null, { timeout: 20000 })
    await page.locator('#customer-email').fill('original@example.test'); if (mode !== 'forgot') await page.locator('#customer-password').fill('Synthetic-password')
    const before = requests.length; await page.locator('.auth-submit').click()
    await page.locator(mode === 'login' ? '.auth-feedback--error' : '.auth-feedback--success').waitFor()
    const auth = requests.slice(before).filter(r => ['/auth/v1/signup', '/auth/v1/token', '/auth/v1/recover'].includes(r.path))
    assert.equal(auth.length, 1); assert.equal(auth[0].captcha_present, true)
  }
  checks.push('real_test_widget_token_sent_by_SDK_signup_login_reset')
  await visit('/dashboard/login')
  await page.waitForFunction(() => document.querySelector('form button[type=submit]')?.disabled === false, null, { timeout: 20000 })
  await page.locator('input[type=email]').fill('staff@example.test'); await page.locator('input[type=password]').fill('Synthetic-password')
  const dashboardBefore = requests.length; await page.locator('form button[type=submit]').click(); await page.locator('p[role=alert]').waitFor()
  assert.equal(requests.slice(dashboardBefore).filter(r => r.path === '/auth/v1/token').length, 1)
  assert.equal(requests.slice(dashboardBefore).find(r => r.path === '/auth/v1/token').captcha_present, true)
  checks.push('Dashboard_password_login_receives_test_Captcha_token')
  await visit('/login?mode=recovery'); assert.equal(await page.locator('.auth-security').count(), 0); checks.push('password_update_mode_preserved_without_Captcha')
  const denied = await fetch(backendOrigin + '/auth/v1/token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); assert.equal(denied.status, 400); checks.push('fixture_direct_auth_missing_token_denied')
  assert.deepEqual(forbidden, []); assert.deepEqual(pageErrors, [])
  const proof = { result: 'EXACT_ARCHIVE_LOCAL_PASS', archive_sha256: artifact.archive_sha256, checks, screenshots, static_asset_byte_checks: assets, page_errors: pageErrors, forbidden_backend_mutations: forbidden, suppressed_fixture_telemetry: suppressedTelemetry.length, hosted_auth_signup: 'NOT_EXERCISED', email_delivery: 'NOT_EXERCISED', production_writes: 0, payment_shipping_provider_calls: 0, hosted_supabase_connections: 0, external_Cloudflare_public_test_widget_requests: turnstileTestRequests, hosted_Captcha_enforcement: 'NOT_EXERCISED' }
  await writeFile(work + '/browser-qualification.json', JSON.stringify(proof, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); console.log(JSON.stringify(proof))
} finally {
  await writeFile(attempt + '/diagnostics.json', JSON.stringify({ requests, forbidden, pageErrors, checks }, null, 2))
  await browser?.close(); if (runtime) await runtime.stop(); backend.closeAllConnections(); await new Promise(done => backend.close(done))
}
