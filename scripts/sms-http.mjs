// Read-only acceptance against a built localhost server; never accepts a remote URL.
import assert from 'node:assert/strict'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
const origin = new URL(process.env.SMS_REVIEW_LOCAL_URL || 'http://127.0.0.1:3187')
assert.ok(origin.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(origin.hostname), 'Localhost only')
const forbidden = [
  'sms-local-http-master-fixture-at-least-32-characters',
  'sms-local-http-worker-fixture-at-least-32-characters',
  'sms-local-http-service-role-fixture',
  'api-account-fixture', 'api-password-fixture', 'replacement-fixture',
  '0BAF4EACBFB84A1A87574DFEFC41525F'
]
let assertions = 0, requests = 0, files = 0
const check = (condition, message) => { assert.ok(condition, message); assertions++ }
const scan = (value, label) => { for (const secret of forbidden) check(!value.includes(secret), 'No private fixture in ' + label) }
const walk = async dir => {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name)
    if (entry.isDirectory()) await walk(file)
    else if (/\.(js|mjs|json|html|css|txt)$/.test(entry.name)) { scan(await readFile(file, 'utf8'), 'public artifact'); files++ }
  }
}
await walk(resolve('.output/public'))
for (const path of ['settings', 'capabilities', 'templates', 'history', 'order-events', 'send']) {
  const response = await fetch(new URL('/api/admin-sms/' + path, origin), { method: path === 'send' ? 'POST' : 'GET' })
  requests++
  check(response.status === 401, 'Anonymous SMS API denied')
  check(response.headers.get('cache-control') === 'private, no-store', 'SMS API no-store')
  scan(await response.text(), 'SMS API error')
}
for (const [path, method] of [['/api/admin-shipping/settings','GET'],['/api/admin-shipping/mappings','PATCH'],['/api/admin-shipping/orders/11111111-1111-4111-8111-111111111111/refresh','POST'],['/api/webhooks/pdc','POST']]) {
  const response=await fetch(new URL(path,origin),{method})
  requests++
  check(response.status===401,'Anonymous PDC API/unsigned webhook denied')
  scan(await response.text(),'PDC API error')
}
const worker = await fetch(new URL('/api/internal/sms/process', origin), { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
requests++
check(worker.status === 401, 'Anonymous worker denied')
scan(await worker.text(), 'worker error')
const invalidWorker = await fetch(new URL('/api/internal/sms/process', origin), { method: 'POST', headers: { 'content-type': 'application/json', 'x-sms-worker-secret': 'invalid-worker-fixture' }, body: '{}' })
requests++
check(invalidWorker.status === 401, 'Invalid worker secret denied')
check(invalidWorker.headers.get('cache-control') === 'private, no-store', 'Worker errors no-store')
scan(await invalidWorker.text(), 'invalid worker error')
for (const prefix of ['', '/ar']) for (const tab of ['settings', 'templates', 'send', 'history']) {
  const response = await fetch(new URL(prefix + '/dashboard/sms?tab=' + tab, origin))
  requests++
  check(response.status === 200, 'Dashboard login response rendered')
  check(new URL(response.url).pathname.includes('/dashboard/login'), 'SMS route requires staff login')
  scan(await response.text(), 'dashboard SSR/login')
}
const report = { assertions, requests, publicFilesScanned: files, privateFixtureTypes: forbidden.length, exposures: 0, scope: 'built localhost anonymous route/SSR guards and public artifact scan; no real credentials or provider calls' }
await writeFile('/tmp/elcomputer-sms-review/http-report.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify(report))
