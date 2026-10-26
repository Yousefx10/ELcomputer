// Browser-only configuration on the genuine public origin. Fresh anonymous
// Chrome profile, interception before navigation, no Auth submission or secret.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
const work = resolve(process.argv[2]), load = async p => JSON.parse(await readFile(p, 'utf8')), spec = await load(work + '/spec.private.json'), widget = await load(spec.widget_file)
const profile = await mkdtemp(work + '/anonymous-chrome-'), probe = createServer(); await new Promise(done => probe.listen(0, '127.0.0.1', done)); const port = probe.address().port; await new Promise(done => probe.close(done))
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--remote-debugging-address=127.0.0.1', '--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' })
let browser, page; const allowedReads = [], blocked = [], codes = [], errors = []; let cf = 0
try {
  let ready = false
  for (let i = 0; i < 80; i++) { try { if ((await fetch('http://127.0.0.1:' + port + '/json/version')).ok) { ready = true; break } } catch {} await new Promise(done => setTimeout(done, 100)) }
  assert.ok(ready)
  const { chromium } = await import(process.env.TURNSTILE_REVIEW_PLAYWRIGHT); browser = await chromium.connectOverCDP('http://127.0.0.1:' + port)
  const context = browser.contexts()[0], authOrigin = 'https://' + spec.target.project_ref + '.supabase.co'
  await context.route('**/*', route => {
    const req = route.request(), u = new URL(req.url())
    if (u.protocol === 'https:' && u.hostname === 'challenges.cloudflare.com') { cf++; return route.continue() }
    const publicPath = /^\/(?:ar\/)?login$/.test(u.pathname) || /^\/(?:_nuxt|uploads)\//.test(u.pathname) || u.pathname === '/api/storefront/content'
    const authSettings = u.origin === authOrigin && u.pathname === '/auth/v1/settings'
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method()) && (u.origin === spec.target.origin && publicPath || authSettings)) { allowedReads.push({ path: u.pathname, method: req.method() }); return route.continue() }
    blocked.push({ path: u.pathname, method: req.method() }); return route.abort()
  })
  await context.addInitScript(() => {
    const lock = () => document.querySelectorAll('input[type=email],input[type=password],input[autocomplete=name]').forEach(input => { input.disabled = true })
    new MutationObserver(lock).observe(document, { childList: true, subtree: true }); addEventListener('DOMContentLoaded', lock)
  })
  page = await context.newPage(); page.on('pageerror', e => errors.push(e.name)); page.on('console', m => { codes.push(...m.text().match(/\b(?:110|200|300|600)[0-9]{3}\b/g) || []) })
  await page.goto(spec.target.origin + '/login'); await page.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false)
  const patched = await page.evaluate(siteKey => {
    const nuxt = document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$nuxt
    nuxt.$config.public.turnstileSiteKey = siteKey; nuxt.$config.public.authCaptchaProvider = 'turnstile'
    const banner = document.createElement('p'); banner.textContent = 'CAPTCHA CHECK ONLY — credential entry disabled'; banner.style.cssText = 'padding:12px;background:#fff3cd;color:#333;text-align:center'; document.body.prepend(banner)
    return { provider_set_in_this_tab: nuxt.$config.public.authCaptchaProvider === 'turnstile', key_set_in_this_tab: nuxt.$config.public.turnstileSiteKey === siteKey }
  }, widget.site_key)
  assert.ok(patched.provider_set_in_this_tab && patched.key_set_in_this_tab)
  await page.locator('.auth-security').waitFor({ timeout: 15000 }); let solved = true
  try { await page.waitForFunction(() => document.querySelector('.auth-submit')?.disabled === false, null, { timeout: 120000 }) } catch { solved = false }
  await page.screenshot({ path: work + '/live-tab-preview.png', fullPage: true })
  const proof = { result: solved ? 'LIVE_TAB_WIDGET_PASS' : 'LIVE_TAB_WIDGET_PENDING', live_origin: spec.target.origin, browser_profile: 'FRESH_ANONYMOUS', browser_config_only: true, runtime_file_changed: false, interception_before_navigation: true, credential_inputs_disabled: true, token_observed_as_boolean_only: solved, token_values_recorded: false, auth_submissions: 0, secret_key_seen: false, captcha_enforcement_changed: false, cloudflare_client_requests: cf, widget_error_codes: [...new Set(codes)], page_errors: errors, allowed_public_reads: allowedReads, blocked_requests: blocked, production_writes: 0 }
  await writeFile(work + '/live-tab-preview.json', JSON.stringify(proof, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); console.log(JSON.stringify({ ...proof, allowed_public_reads: allowedReads.length, blocked_requests: blocked.length }))
} catch (e) {
  if (page) await page.screenshot({ path: work + '/live-tab-preview-incomplete.png', fullPage: true })
  const proof = { result: 'LIVE_TAB_PREVIEW_INCOMPLETE', type: e.name, widget_error_codes: [...new Set(codes)], page_errors: errors, production_writes: 0, auth_submissions: 0, secret_key_seen: false }
  await writeFile(work + '/live-tab-preview-incomplete.json', JSON.stringify(proof, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); console.log(JSON.stringify(proof)); process.exitCode = 1
} finally {
  await browser?.close()
  if (chrome.exitCode === null) {
    const stopped = new Promise(done => chrome.once('exit', done)); chrome.kill('SIGTERM')
    await Promise.race([stopped, new Promise(done => setTimeout(done, 2000))])
  }
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
}
