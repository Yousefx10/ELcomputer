// Owned loopback runtime fixture. Never accepts production credentials.
import assert from 'node:assert/strict'
import { createServer, get, request } from 'node:http'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const [output, node, caddy, kit, uploads, evidence] = process.argv.slice(2)
assert.ok(evidence && uploads && kit && caddy && node && output)
const cfg = JSON.parse(await readFile(join(kit, 'config.json')))
const requests = []
const actors = Object.fromEntries(['owner', 'viewer', 'disabled', 'customer'].map((name, i) => [name, `00000000-0000-4000-8000-00000000000${i + 1}`]))
const backend = createServer((req, res) => {
  requests.push({ method: req.method, path: req.url.split('?')[0] })
  const url = new URL(req.url, 'http://fixture.invalid')
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) { res.writeHead(405); res.end('{}'); return }
  let data = []
  if (url.pathname === '/auth/v1/user') {
    const actor = String(req.headers.authorization || '').replace('Bearer ', '')
    if (!actors[actor]) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end('{"message":"Invalid fixture token"}'); return }
    data = { id: actors[actor], email: actor + '@fixture.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} }
  }
  if (url.pathname === '/rest/v1/admin_users') {
    const actor = Object.keys(actors).find(name => url.searchParams.get('id') === 'eq.' + actors[name])
    const record = actor && actor !== 'customer' ? { id: actors[actor], role: actor === 'owner' ? 'owner' : 'admin', is_active: actor !== 'disabled', permissions: { 'products.view': true } } : null
    data = req.headers.accept?.includes('object') ? record : record ? [record] : []
  }
  if (url.pathname === '/rest/v1/site_settings') {
    const settings = { key: 'default', site_name: 'Local fixture', seo_site_url: `https://${cfg.domain}`, customer_registration_enabled: false,
      payment_cash_enabled: false, payment_card_enabled: false, payment_bank_transfer_enabled: false, payment_instapay_enabled: false, payment_paypal_enabled: false }
    data = req.headers.accept?.includes('object') ? settings : [settings]
  }
  res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Range': '0-0/0' }); res.end(JSON.stringify(data))
})
backend.listen(0, '127.0.0.1'); await once(backend, 'listening')
const guard = join(evidence, 'deny-external.mjs')
await writeFile(guard, `const original=globalThis.fetch;globalThis.fetch=(input,init)=>{const u=new URL(typeof input==='string'||input instanceof URL?input:input.url);if(!['127.0.0.1','localhost','[::1]'].includes(u.hostname))throw Error('External fixture request denied');return original(input,init)}\n`, { flag: 'wx', mode: 0o600 })
const children = []
function child(executable, args, env, name) {
  const c = spawn(executable, args, { env, cwd: resolve(output), stdio: ['ignore', 'pipe', 'pipe'] })
  let log = ''; c.stdout.on('data', b => log += b); c.stderr.on('data', b => log += b)
  c.savedLog = async () => writeFile(join(evidence, name + '.log'), log, { flag: 'wx', mode: 0o600 })
  children.push(c); return c
}
try {
  child(node, ['--import', guard, join(output, 'server/index.mjs')], {
    PATH: '/usr/bin:/bin', LANG: 'C', NODE_ENV: 'production', HOST: '127.0.0.1', NITRO_HOST: '127.0.0.1', PORT: String(cfg.port), NITRO_PORT: String(cfg.port),
    NUXT_PUBLIC_SITE_URL: 'https://' + cfg.domain, NUXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${backend.address().port}`, NUXT_PUBLIC_SUPABASE_KEY: 'local-fixture-only',
    NUXT_SUPABASE_SERVICE_ROLE_KEY: 'local-fixture-only', NUXT_UPLOADS_DIR: uploads, UPLOADS_DIR: uploads, NUXT_PAYMOB_ENABLED: 'false', NUXT_SHIPPING_LIVE_REQUESTS_ENABLED: 'false'
  }, 'nuxt')
  child(caddy, ['run', '--config', join(evidence, 'Caddyfile'), '--adapter', 'caddyfile'], { PATH: '/usr/bin:/bin', HOME: evidence, XDG_DATA_HOME: evidence, XDG_CONFIG_HOME: evidence }, 'caddy')
  const port = Number((await readFile(join(evidence, 'fixture-port'), 'utf8')).trim())
  let ready = false
  for (let i = 0; i < 100; i++) {
    try {
      const status = await new Promise((resolve, reject) => {
        const r = get(`http://127.0.0.1:${port}/api/admin-products/list`, { headers: { Host: cfg.domain } }, response => { response.resume(); response.on('end', () => resolve(response.statusCode)) })
        r.on('error', reject)
      })
      if (status === 401) { ready = true; break }
    } catch {}
    await new Promise(r => setTimeout(r, 100))
  }
  assert.ok(ready, 'Caddy and exact reviewed Nuxt start locally')
  let authorizationChecks = 0
  for (const actor of ['owner', 'viewer', 'disabled', 'customer', 'invalid']) {
    for (const [method, path] of [['POST', '/api/admin-products'], ['PATCH', '/api/admin-products/00000000-0000-4000-8000-000000000001'], ['POST', '/api/admin-products/bulk']]) {
      const status = await new Promise((resolve, reject) => {
        const r = request(`http://127.0.0.1:${port}${path}`, { method, headers: { Host: cfg.domain, Authorization: 'Bearer ' + actor, 'Content-Type': 'application/json' } }, response => { response.resume(); response.on('end', () => resolve(response.statusCode)) })
        r.on('error', reject); r.end('{}')
      })
      assert.equal(status, actor === 'owner' ? 400 : actor === 'invalid' ? 401 : 403, actor + ' ' + method + ' ' + path)
      authorizationChecks++
    }
  }
  const check = spawn('python3', [join(kit, 'health.py'), kit, '--origin', `http://127.0.0.1:${port}`, '--fixture'], { stdio: ['ignore', 'pipe', 'pipe'] })
  let out = '', error = ''; check.stdout.on('data', b => out += b); check.stderr.on('data', b => error += b)
  assert.equal((await once(check, 'close'))[0], 0, error)
  assert.ok(requests.every(r => ['GET', 'HEAD', 'OPTIONS'].includes(r.method)))
  const finalResults = out.trim().split('\n').map(line => JSON.parse(line)).filter(event => event.result)
  assert.equal(finalResults.length, 1, 'One final health result after progress')
  assert.equal(finalResults[0].result, 'PASS')
  const result = { ...finalResults[0], authorization_checks: authorizationChecks, actual_caddy: '2.11.7', actual_node: '22.23.1', exact_sealed_nuxt: true, backend: 'isolated synthetic Auth and read-only data fixture', production_connected: false,
    external_fetches_blocked: true, backend_mutations: 0, ubuntu_systemd_reboot_acceptance: 'not exercised by this loopback fixture' }
  await writeFile(join(evidence, 'CADDY-NUXT-RESTORE.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
  console.log(JSON.stringify(result))
} finally {
  for (const c of children.reverse()) {
    if (c.exitCode === null) { const exited = once(c, 'exit'); c.kill('SIGTERM'); await exited }
    await c.savedLog()
  }
  backend.closeAllConnections(); await new Promise(r => backend.close(r))
}
