// Real public widget, exact installed artifact, isolated Auth fixture. No real
// credentials, Auth mutations, Siteverify secret or production application traffic.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { inventory } from '../publish/inventory.mjs'
const work = resolve(process.argv[2]), load = async p => JSON.parse(await readFile(p, 'utf8'))
const spec = await load(work + '/spec.private.json'), widget = await load(spec.widget_file), originalInventory = await load(spec.deployed_inventory)
assert.deepEqual(await inventory(spec.deployed_output), originalInventory)
assert.equal(widget.mode, 'managed'); assert.ok(widget.allowed_hostnames.includes(new URL(spec.target.origin).hostname))
const virtualOrigin = spec.target.origin, attempt = work + '/public-key-preview-' + Date.now(); await mkdir(attempt, { mode: 0o700 })
const headed = process.env.TURNSTILE_PREVIEW_HEADED === 'true'
const backend = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1'); res.setHeader('access-control-allow-origin', req.headers.origin || '*'); res.setHeader('access-control-allow-headers', '*'); res.setHeader('access-control-allow-private-network', 'true')
  res.setHeader('content-type', 'application/json'); if (req.method === 'OPTIONS') { res.end(); return }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; res.end('{}'); return }
  if (u.pathname === '/auth/v1/settings') { res.end(JSON.stringify({ disable_signup: false, mailer_autoconfirm: false, external: { email: true } })); return }
  const rows = u.pathname.endsWith('/site_settings') ? [{ key: 'default', site_name: 'Local CAPTCHA preview', auth_page_layout: 'centered', footer_style: 'classic', hero_enabled: false }] : []
  res.end(JSON.stringify(String(req.headers.accept).includes('application/vnd.pgrst.object+json') ? rows[0] || null : rows))
})
await new Promise(done => backend.listen(0, '127.0.0.1', done)); const backendOrigin = 'http://127.0.0.1:' + backend.address().port
const probe = createServer(); await new Promise(done => probe.listen(0, '127.0.0.1', done)); const port = probe.address().port; await new Promise(done => probe.close(done))
const preload = attempt + '/loopback.cjs'
await writeFile(preload, "const original=globalThis.fetch;globalThis.fetch=(input,options)=>{const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(u.hostname!=='127.0.0.1')throw Error('EXTERNAL_SERVER_FETCH_FORBIDDEN');return original(input,options)};\n", { flag: 'wx', mode: 0o600 })
const runtimeOrigin = 'http://127.0.0.1:' + port, child = spawn(process.execPath, [spec.deployed_output + '/server/index.mjs'], { cwd: spec.deployed_output, env: {
  PATH: dirname(process.execPath) + ':/usr/bin:/bin', HOME: process.env.HOME, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port), NODE_OPTIONS: '--require=' + preload,
  NUXT_PUBLIC_SUPABASE_URL: backendOrigin, NUXT_PUBLIC_SUPABASE_KEY: 'synthetic-public', NUXT_SUPABASE_SERVICE_ROLE_KEY: 'synthetic-server', NUXT_PUBLIC_SITE_URL: virtualOrigin,
  NUXT_PUBLIC_AUTH_CAPTCHA_PROVIDER: 'turnstile', NUXT_PUBLIC_TURNSTILE_SITE_KEY: widget.site_key, NUXT_PUBLIC_RETURNING_CUSTOMER_NOTICE_ENABLED: 'false',
  NUXT_PUBLIC_PURCHASING_ENABLED: 'false', NUXT_PUBLIC_BETA_PURCHASING_ENABLED: 'false', NUXT_CONTROLLED_PURCHASE: '{}', NUXT_PAYMOB_ENABLED: 'false', NUXT_PAYMOB_LIVE_REQUESTS_ENABLED: 'false', NUXT_SHIPPING_LIVE_REQUESTS_ENABLED: 'false', PDC_LIVE_REQUESTS_ENABLED: 'false'
}, stdio: ['ignore', 'pipe', 'pipe'] })
const chunks = []; child.stdout.on('data', v => chunks.push(v)); child.stderr.on('data', v => chunks.push(v)); const ended = new Promise(done => child.once('exit', done))
let browser, page, cloudflareRequests = 0, blockedMutations = 0; const checks = [], pageErrors = [], cloudflareResponses = [], widgetErrorCodes = []
try {
  let ready = false
  for (let i = 0; i < 100; i++) { try { const r = await fetch(runtimeOrigin + '/_nuxt/builds/latest.json'); await r.body?.cancel(); if (r.ok) { ready = true; break } } catch {} assert.equal(child.exitCode, null); await new Promise(done => setTimeout(done, 100)) }
  assert.ok(ready)
  const { chromium } = await import(process.env.TURNSTILE_REVIEW_PLAYWRIGHT)
  browser = await chromium.launch({ headless: !headed, channel: 'chrome' })
  const context = await browser.newContext()
  if (headed) await context.addInitScript(() => {
    const disableCredentials = () => document.querySelectorAll('input[type=email],input[type=password],input[autocomplete=name]').forEach(input => { input.disabled = true })
    new MutationObserver(disableCredentials).observe(document, { childList: true, subtree: true }); addEventListener('DOMContentLoaded', disableCredentials)
  })
  // Interception is installed before any navigation. The canonical hostname is
  // fulfilled from the local exact artifact, never forwarded to the public site.
  await context.route('**/*', async route => {
    const req = route.request(), u = new URL(req.url())
    if (u.protocol === 'https:' && u.hostname === 'challenges.cloudflare.com') { cloudflareRequests++; return route.continue() }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method())) { blockedMutations++; return route.abort() }
    if (u.origin === backendOrigin) return route.continue()
    if (u.origin !== virtualOrigin) return route.abort()
    const r = await fetch(runtimeOrigin + u.pathname + u.search, { method: req.method(), headers: { accept: req.headers().accept || '*/*' } })
    const headers = Object.fromEntries([...r.headers].filter(([k]) => !['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(k)))
    return route.fulfill({ status: r.status, headers, body: Buffer.from(await r.arrayBuffer()) })
  })
  page = await context.newPage(); page.on('pageerror', e => pageErrors.push({ name: e.name }))
  page.on('response', r => { if (new URL(r.url()).hostname === 'challenges.cloudflare.com') cloudflareResponses.push({ status: r.status() }) })
  page.on('console', msg => { for (const code of msg.text().match(/\b(?:110|200|300|600)[0-9]{3}\b/g) || []) widgetErrorCodes.push(code) })
  const cases = [{ path: '/login', locale: 'en', width: 1280, theme: 'light' }, ...headed ? [] : [{ path: '/ar/login?mode=signup', locale: 'ar', width: 320, theme: 'dark' }, { path: '/login?mode=forgot', locale: 'en', width: 390, theme: 'system' }, { path: '/dashboard/login', locale: 'en', width: 1280, theme: 'dark' }]]
  for (const c of cases) {
    await page.setViewportSize({ width: c.width, height: 1000 }); await context.addCookies([{ name: 'elcomputer-theme-choice', value: c.theme, url: virtualOrigin }]); await page.emulateMedia({ colorScheme: c.theme === 'light' ? 'light' : 'dark' })
    await page.goto(virtualOrigin + c.path); await page.waitForFunction(() => !!window.turnstile?.render, null, { timeout: 20000 })
    const selector = c.path.startsWith('/dashboard') ? 'form:has(input[type=password]) button[type=submit]' : '.auth-submit'
    let solved = true
    try { await page.waitForFunction(selector => document.querySelector(selector)?.disabled === false, selector, { timeout: headed ? 300000 : 45000 }) } catch { solved = false }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    assert.equal(await page.locator('.auth-security').getAttribute('modelvalue'), null)
    await page.screenshot({ path: attempt + '/' + checks.length + '-' + c.locale + '-' + c.width + '.png', fullPage: true })
    checks.push({ ...c, widget_api_loaded: true, challenge_frame_present: page.frames().some(f => { try { return new URL(f.url()).hostname === 'challenges.cloudflare.com' } catch { return false } }), token_observed_as_boolean_only: solved, auth_submissions: 0 })
    if (!solved) break // Managed challenges can require an actual human. No automatic challenge retry.
  }
  assert.deepEqual(pageErrors, [])
  const proof = { result: checks.length === cases.length && checks.every(c => c.token_observed_as_boolean_only) ? 'PUBLIC_KEY_FRONTEND_PASS' : 'MANUAL_CHALLENGE_PENDING', headed, exact_artifact: spec.deployed_archive_sha256, virtual_hostname: new URL(virtualOrigin).hostname, transport: 'CANONICAL_ORIGIN_INTERCEPTED_TO_LOCAL_ARTIFACT', local_auth_fixture_only: true, checks, widget_error_codes: [...new Set(widgetErrorCodes)], cloudflare_client_requests: cloudflareRequests, blocked_fixture_telemetry_mutations: blockedMutations, production_application_requests: 0, hosted_supabase_connections: 0, auth_submissions: 0, siteverify_calls: 0, secret_key_seen: false, token_values_recorded: false, production_writes: 0, hosted_enforcement_tested: false, page_errors: pageErrors }
  await writeFile(work + (headed ? '/public-key-headed-preview.json' : '/public-key-preview.json'), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); console.log(JSON.stringify(proof))
} catch (error) {
  const diagnosis = { result: 'PUBLIC_KEY_PREVIEW_INCOMPLETE', type: error.name, checks, page_errors: pageErrors, cloudflare_responses: cloudflareResponses,
    dom: page ? await page.evaluate(() => ({ title: document.title, security_text: document.querySelector('.auth-security')?.innerText, widget_present: !!document.querySelector('.auth-security'), iframe_count: document.querySelectorAll('.auth-security iframe').length, api_loaded: !!window.turnstile?.render, provider: window.__NUXT__?.config?.public?.authCaptchaProvider, sitekey_present: !!window.__NUXT__?.config?.public?.turnstileSiteKey })) : null,
    hosted_supabase_connections: 0, production_application_requests: 0, secret_key_seen: false, token_values_recorded: false }
  if (page) await page.screenshot({ path: attempt + '/incomplete.png', fullPage: true })
  await writeFile(work + '/public-key-preview-incomplete-' + Date.now() + '.json', JSON.stringify(diagnosis, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
  console.log(JSON.stringify(diagnosis)); process.exitCode = 1
} finally {
  await browser?.close(); child.kill('SIGTERM'); const timer = setTimeout(() => child.kill('SIGKILL'), 3000); await ended; clearTimeout(timer)
  await writeFile(attempt + '/local-server.log', Buffer.concat(chunks), { flag: 'wx', mode: 0o600 }); backend.closeAllConnections(); await new Promise(done => backend.close(done))
}
