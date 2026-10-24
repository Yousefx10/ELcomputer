// Start the exact retained artifact with synthetic credentials and closed gates.
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { resolve, dirname } from 'node:path'

const work = resolve(process.argv[2]), probe = createServer()
await new Promise(done => probe.listen(0, '127.0.0.1', done))
const port = probe.address().port; await new Promise(done => probe.close(done))
const guard = work + '/artifact-loopback-only.cjs'
await writeFile(guard, "const original=globalThis.fetch;globalThis.fetch=(url,options)=>{const u=new URL(typeof url==='string'?url:url.url||url.href);if(u.hostname!=='127.0.0.1')throw Error('PROVIDER_NETWORK_FORBIDDEN');return original(url,options)};\n", { flag: 'wx', mode: 0o600 })
const env = { PATH: dirname(process.execPath) + ':/usr/bin:/bin', HOME: process.env.HOME, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port),
  NUXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9', NUXT_PUBLIC_SUPABASE_KEY: 'offline-anon', NUXT_SUPABASE_SERVICE_ROLE_KEY: 'offline-service-role', NUXT_PUBLIC_SITE_URL: 'https://fixture.invalid',
  NUXT_PUBLIC_PURCHASING_ENABLED: 'false', NUXT_CONTROLLED_PURCHASE: '{}', NUXT_PAYMOB_ENABLED: 'false', NUXT_PAYMOB_LIVE_REQUESTS_ENABLED: 'false', NUXT_SHIPPING_LIVE_REQUESTS_ENABLED: 'false', PDC_LIVE_REQUESTS_ENABLED: 'false', NODE_OPTIONS: '--require=' + guard }
const child = spawn(process.execPath, [work + '/readback/server/index.mjs'], { cwd: work + '/readback', env, stdio: ['ignore', 'pipe', 'pipe'] })
const chunks = []; child.stdout.on('data', bytes => chunks.push(bytes)); child.stderr.on('data', bytes => chunks.push(bytes))
const ended = new Promise(done => child.once('exit', done))
try {
  let ready = false
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch('http://127.0.0.1:' + port + '/api/admin-products/list')).status === 401) { ready = true; break } } catch {}
    if (child.exitCode !== null) break
    await new Promise(done => setTimeout(done, 100))
  }
  assert.ok(ready, 'Exact artifact failed startup')
  const checks = []
  for (const path of ['/api/admin-products/list', '/api/checkout/controlled', '/api/checkout/shipping', '/api/payments/status?order_id=00000000-0000-4000-8000-000000000001', '/api/admin-shipping/companies/00000000-0000-4000-8000-000000000001/tariffs']) {
    const response = await fetch('http://127.0.0.1:' + port + path)
    assert.equal(response.status, 401, path); checks.push({ path, status: response.status })
  }
  await writeFile(work + '/http-qualification.json', JSON.stringify({ result: 'PASS', exact_artifact_startup: true, checks, synthetic_credentials: true, provider_calls: 0, production_changes: 0 }, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
} finally {
  if (child.exitCode === null) child.kill('SIGTERM')
  await ended
  await writeFile(work + '/http-qualification.log', Buffer.concat(chunks), { flag: 'wx', mode: 0o600 })
}
