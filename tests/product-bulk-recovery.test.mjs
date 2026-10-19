import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { ofetch } from 'ofetch'
import { createBulkRecoveryFixture, actors, product, storageKey, deferred, receipt } from './helpers/productBulkRecoveryFixture.mjs'

const methods = f => f.requests.map(request => request.method || 'GET')
const saved = f => JSON.parse(f.storage.get(storageKey(f.adminUser.value.id)))
const marker = f => JSON.parse(f.storage.get(storageKey(f.adminUser.value.id) + ':submission'))
const checkOnly = f => {
  assert.ok(f.bulk.pending.value); assert.equal(f.bulk.retryAllowed.value, false)
  assert.equal(f.hasButton('productBulk.retry'), false)
  assert.ok(f.hasButton('productBulk.check'))
}
const verifyGet = (request, command, actor = actors[0]) => {
  assert.equal(request.method, undefined); assert.equal(request.body, undefined)
  assert.deepEqual(request.query, { request_id: command.request_id })
  assert.equal(request.headers.authorization, 'Synthetic actor ' + actor)
  assert.equal(request.retry, 0); assert.equal(request.timeout, 15000)
}

test('real HTTP 405: show refusal, retain immutable batch and offer GET-only recovery', async t => {
  const ingress = []
  const server = createServer(async (request, response) => {
    ingress.push(request.method)
    for await (const chunk of request) { /* consume only the synthetic request */ }
    response.writeHead(405, { 'content-type': 'text/html', allow: 'GET' }); response.end('<p>Method Not Allowed</p>')
  })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  t.after(() => new Promise(resolve => server.close(resolve)))
  const client = ofetch.create({ baseURL: 'http://127.0.0.1:' + server.address().port })
  const f = createBulkRecoveryFixture({ transport: (path, options) => client(path, options) }); t.after(f.unmount)
  const command = await f.submit()
  assert.deepEqual(ingress, ['POST']); assert.equal(f.requests[0].retry, 0); assert.equal(f.requests[0].timeout, 65000)
  assert.equal(f.bulk.submission.value, 'method'); assert.equal(f.bulk.error.value, '')
  assert.equal(f.bulk.outcome.value, null); assert.deepEqual(saved(f), JSON.parse(JSON.stringify(command)))
  assert.deepEqual(marker(f), { request_id: command.request_id, state: 'method' })
  assert.ok(f.text().includes(f.t('productBulk.methodDenied')))
  assert.ok(f.text().includes(f.t('productBulk.saved', { count: 1 })))
  assert.ok(!f.text().includes(f.t('productBulk.unknown'))); checkOnly(f)
  await f.bulk.retry(); await f.bulk.confirm(); f.bulk.review()
  assert.deepEqual(methods(f), ['POST']); assert.equal(f.bulk.reviewing.value, false)
  f.transport = async () => ({ result: null })
  await f.bulk.check(); await f.flush()
  assert.equal(f.bulk.error.value, 'noReceipt'); assert.deepEqual(saved(f), JSON.parse(JSON.stringify(command)))
  assert.ok(f.text().includes(f.t('productBulk.methodDenied'))); checkOnly(f)
  assert.deepEqual(methods(f), ['POST', 'GET']); verifyGet(f.requests[1], command)
})

for (const [name, failure] of [
  ['401 statusCode', { statusCode: 401 }], ['403 response status', { response: { status: 403 } }],
]) test(name + ': definite access denial never offers another POST', async t => {
  const f = createBulkRecoveryFixture({ transport: async () => { throw failure } }); t.after(f.unmount)
  const command = await f.submit(); assert.equal(f.bulk.submission.value, 'permission')
  assert.ok(f.text().includes(f.t('productBulk.accessDenied'))); checkOnly(f)
  f.transport = async () => ({ result: null }); await f.bulk.check(); await f.flush()
  await f.bulk.retry(); assert.deepEqual(methods(f), ['POST', 'GET']); verifyGet(f.requests[1], command)
  assert.deepEqual(saved(f), JSON.parse(JSON.stringify(command)))
})

for (const [name, failure] of [
  ['lost response', new TypeError('Synthetic connection closed')],
  ['network timeout', Object.assign(new Error('Synthetic timeout'), { name: 'TimeoutError' })],
  ...[400, 404, 408, 429, 500, 502, 503, 504].map(statusCode => ['HTTP ' + statusCode, { statusCode }]),
]) test(name + ': keep outcome uncertain and never retry automatically', async t => {
  const f = createBulkRecoveryFixture({ transport: async () => { throw failure } }); t.after(f.unmount)
  const command = await f.submit(); assert.equal(f.bulk.submission.value, 'unknown')
  assert.equal(f.bulk.error.value, 'unknown'); assert.equal(f.bulk.outcome.value, null)
  assert.equal(f.bulk.retryAllowed.value, true); assert.deepEqual(methods(f), ['POST'])
  f.transport = async () => { throw new TypeError('Synthetic recovery failure') }
  await f.bulk.check(); assert.deepEqual(methods(f), ['POST', 'GET']); verifyGet(f.requests[1], command)
  assert.deepEqual(saved(f), JSON.parse(JSON.stringify(command)))
})

test('explicit retry after uncertainty uses identical UUID, assignment and revisions', async t => {
  const f = createBulkRecoveryFixture({ transport: async () => { throw Error('Synthetic lost response') } }); t.after(f.unmount)
  const command = await f.submit('category', '00000000-0000-4000-8000-000000000004')
  f.bulk.operation.value = 'publish'; f.bulk.reference.value = ''
  f.transport = async (path, options) => receipt(options.body, { replayed: true })
  await f.bulk.retry(); await f.flush()
  assert.deepEqual(f.requests[1].body, f.requests[0].body)
  assert.equal(f.requests[1].body.request_id, command.request_id)
  assert.equal(f.requests[1].body.operation, 'category')
  assert.equal(f.bulk.pending.value, null); assert.equal(f.bulk.outcome.value.replayed, true)
  assert.equal(f.storage.size, 0); assert.deepEqual(methods(f), ['POST', 'POST'])
})

test('405 on a later dispatch does not declare the earlier timed-out dispatch failed', async t => {
  const f = createBulkRecoveryFixture({ transport: async () => { throw Error('Synthetic lost response') } }); t.after(f.unmount)
  const command = await f.submit(); f.transport = async () => { throw { statusCode: 405 } }
  await f.bulk.retry(); await f.flush(); checkOnly(f)
  assert.deepEqual(f.requests[0].body, f.requests[1].body)
  assert.ok(f.text().includes(f.t('productBulk.deniedHelp')))
  f.transport = async () => ({ result: receipt(command) }); await f.bulk.check(); await f.flush()
  assert.equal(f.bulk.pending.value, null); assert.equal(f.bulk.outcome.value.succeeded, 1)
  assert.equal(f.storage.size, 0); assert.equal(f.loads, 1)
  assert.deepEqual(f.invalidations, ['dashboard:products:', 'dashboard:home'])
  assert.deepEqual(methods(f), ['POST', 'POST', 'GET'])
})

test('valid GET receipt is the only event that clears denial and unlocks selection', async t => {
  const f = createBulkRecoveryFixture(); t.after(f.unmount)
  const command = await f.submit(); assert.equal(f.bulk.locked.value, true)
  f.transport = async () => ({ result: receipt(command) }); await f.bulk.check(); await f.flush()
  assert.equal(f.bulk.pending.value, null); assert.equal(f.bulk.submission.value, '')
  assert.equal(f.bulk.locked.value, false); assert.equal(f.storage.size, 0)
  assert.equal(f.bulk.outcome.value.succeeded, 1); assert.deepEqual(methods(f), ['POST', 'GET'])
  verifyGet(f.requests[1], command)
})

for (const kind of ['missing result property', 'null', 'wrong UUID', 'wrong operation', 'wrong product', 'wrong counts', 'invalid revision']) {
  test('GET receipt ' + kind + ': retain original evidence and POST denial', async t => {
    const f = createBulkRecoveryFixture(); t.after(f.unmount)
    const command = await f.submit(), original = f.storage.get(storageKey(actors[0]))
    let result = receipt(command)
    if (kind === 'wrong UUID') result.request_id = actors[1]
    if (kind === 'wrong operation') result.operation = 'publish'
    if (kind === 'wrong product') result.items[0].id = actors[1]
    if (kind === 'wrong counts') result.succeeded = 2
    if (kind === 'invalid revision') result.items[0].revision = null
    f.transport = async () => kind === 'missing result property' ? {} : { result: kind === 'null' ? null : result }
    await f.bulk.check(); await f.flush(); checkOnly(f)
    assert.equal(f.bulk.error.value, kind === 'null' ? 'noReceipt' : 'unknown')
    assert.equal(f.storage.get(storageKey(actors[0])), original)
    assert.equal(f.bulk.pending.value.request_id, command.request_id)
    assert.equal(f.bulk.submission.value, 'method'); assert.equal(f.bulk.outcome.value, null)
    await f.bulk.retry(); assert.deepEqual(methods(f), ['POST', 'GET'])
  })
}

for (const statusCode of [401, 403, 405, 503]) test('GET HTTP ' + statusCode + ' preserves the known POST restriction', async t => {
  const f = createBulkRecoveryFixture(); t.after(f.unmount)
  const command = await f.submit(); f.transport = async () => { throw { statusCode } }
  await f.bulk.check(); await f.flush(); checkOnly(f)
  assert.equal(f.bulk.submission.value, 'method'); assert.equal(marker(f).state, 'method')
  await f.bulk.retry(); assert.deepEqual(methods(f), ['POST', 'GET']); verifyGet(f.requests[1], command)
})

test('a GET authorization denial pauses manual POST retry after an uncertain dispatch', async t => {
  const f = createBulkRecoveryFixture({ transport: async () => { throw Error('Synthetic timeout') } }); t.after(f.unmount)
  await f.submit(); f.transport = async () => { throw { statusCode: 403 } }
  await f.bulk.check(); await f.flush(); checkOnly(f)
  assert.equal(marker(f).state, 'permission'); await f.bulk.retry()
  assert.deepEqual(methods(f), ['POST', 'GET'])
})

test('repeated confirm, retry and check clicks cannot duplicate an in-flight dispatch', async t => {
  const wait = deferred(), f = createBulkRecoveryFixture({ transport: () => wait.promise }); t.after(f.unmount)
  const started = f.submit(); await f.flush()
  for (let index = 0; index < 3; index++) { await f.bulk.confirm(); await f.bulk.retry(); await f.bulk.check() }
  assert.deepEqual(methods(f), ['POST']); const command = saved(f)
  wait.reject(Error('Synthetic lost response')); await started
  const status = deferred(); f.transport = () => status.promise
  const checking = f.bulk.check(); await f.flush()
  for (let index = 0; index < 3; index++) { await f.bulk.check(); await f.bulk.retry(); await f.bulk.confirm() }
  assert.deepEqual(methods(f), ['POST', 'GET'])
  status.resolve({ result: receipt(command) }); await checking
  assert.equal(f.bulk.pending.value, null)
})

test('actor switch ignores a late receipt and never exposes another actor recovery entry', async t => {
  const wait = deferred(), f = createBulkRecoveryFixture({ transport: () => wait.promise }); t.after(f.unmount)
  const started = f.submit(); await f.flush(); const command = saved(f)
  f.adminUser.value = { id: actors[1], role: 'owner', is_active: true }; await f.flush()
  assert.equal(f.bulk.pending.value, null); assert.equal(f.bulk.outcome.value, null)
  await f.bulk.check(); assert.deepEqual(methods(f), ['POST'])
  wait.resolve(receipt(command)); await started
  assert.ok(f.storage.has(storageKey(actors[0]))); assert.equal(f.bulk.outcome.value, null)
  f.adminUser.value = { id: actors[0], role: 'owner', is_active: true }; await f.flush()
  assert.equal(f.bulk.pending.value.request_id, command.request_id); checkOnly(f)
  f.transport = async () => ({ result: receipt(command) }); await f.bulk.check()
  verifyGet(f.requests[1], command, actors[0]); assert.equal(f.storage.size, 0)
})

test('permission revocation blocks both transports and retains actor-owned evidence', async t => {
  const f = createBulkRecoveryFixture({ transport: async () => { throw Error('Synthetic timeout') } }); t.after(f.unmount)
  const command = await f.submit(); f.canEdit.value = false
  f.adminUser.value = { ...f.adminUser.value, permissions: { 'products.edit': false } }; await f.flush()
  await f.bulk.retry(); await f.bulk.check(); assert.deepEqual(methods(f), ['POST'])
  assert.equal(f.bulk.pending.value.request_id, command.request_id)
  f.canEdit.value = true; f.transport = async () => ({ result: receipt(command) })
  await f.bulk.check(); verifyGet(f.requests[1], command)
})

for (const state of ['method', 'permission', 'unknown', 'awaiting']) test('reload restores ' + state + ' without any request or new batch', async t => {
  const storage = new Map(), f = createBulkRecoveryFixture({ storage })
  const command = await f.submit(); f.unmount()
  storage.set(storageKey(actors[0]) + ':submission', JSON.stringify({ request_id: command.request_id, state }))
  const restored = createBulkRecoveryFixture({ storage }); t.after(restored.unmount)
  await restored.flush()
  assert.deepEqual(methods(restored), []); assert.deepEqual(saved(restored), JSON.parse(JSON.stringify(command)))
  assert.equal(restored.bulk.submission.value, state)
  assert.equal(restored.bulk.retryAllowed.value, state === 'unknown')
  if (state !== 'unknown') { checkOnly(restored); await restored.bulk.retry(); assert.equal(restored.requests.length, 0) }
  restored.transport = async () => ({ result: receipt(command) }); await restored.bulk.check()
  assert.deepEqual(methods(restored), ['GET']); verifyGet(restored.requests[0], command)
})

test('legacy raw command restores unchanged and GET failures cannot create a replacement', async t => {
  const f = createBulkRecoveryFixture(), command = await f.submit(); f.unmount()
  f.storage.delete(storageKey(actors[0]) + ':submission')
  const restored = createBulkRecoveryFixture({ storage: f.storage, transport: async () => ({ result: null }) }); t.after(restored.unmount)
  assert.equal(restored.bulk.submission.value, 'unknown'); assert.equal(restored.requests.length, 0)
  await restored.bulk.check(); restored.bulk.toggle(product); restored.bulk.review(); await restored.bulk.confirm()
  assert.equal(restored.bulk.pending.value.request_id, command.request_id)
  assert.deepEqual(methods(restored), ['GET']); assert.deepEqual(saved(restored), JSON.parse(JSON.stringify(command)))
})

test('failure to save a denial leaves a durable GET-only pause across reload', async t => {
  const f = createBulkRecoveryFixture()
  f.failSet = (key, value) => key.endsWith(':submission') && JSON.parse(value).state === 'method'
  const command = await f.submit(); assert.equal(f.bulk.submission.value, 'method')
  assert.equal(f.bulk.error.value, 'storage'); assert.equal(marker(f).state, 'awaiting'); checkOnly(f)
  f.unmount(); const restored = createBulkRecoveryFixture({ storage: f.storage }); t.after(restored.unmount)
  await restored.flush()
  checkOnly(restored); await restored.bulk.retry(); assert.equal(restored.requests.length, 0)
  assert.equal(restored.bulk.pending.value.request_id, command.request_id)
})

test('initial storage failure sends nothing; pre-POST pause failure retains the command', async t => {
  const f = createBulkRecoveryFixture(); t.after(f.unmount)
  f.failSet = () => true; await f.submit()
  assert.equal(f.requests.length, 0); assert.equal(f.bulk.pending.value, null); assert.equal(f.bulk.error.value, 'storage')
  f.failSet = key => key.endsWith(':submission'); f.bulk.review(); await f.bulk.confirm(); await f.flush()
  assert.ok(f.bulk.pending.value); assert.equal(f.bulk.retryAllowed.value, false)
  assert.equal(f.requests.length, 0); assert.equal(f.bulk.error.value, 'storage')
})

for (const corruption of ['command', 'state JSON', 'wrong request', 'unknown state']) test('corrupt saved ' + corruption + ' cannot be overwritten by a new batch', async t => {
  const f = createBulkRecoveryFixture(), command = await f.submit(); f.unmount()
  const key = storageKey(actors[0]), metadata = key + ':submission'
  if (corruption === 'command') f.storage.set(key, '{invalid')
  if (corruption === 'state JSON') f.storage.set(metadata, '{invalid')
  if (corruption === 'wrong request') f.storage.set(metadata, JSON.stringify({ request_id: actors[1], state: 'unknown' }))
  if (corruption === 'unknown state') f.storage.set(metadata, JSON.stringify({ request_id: command.request_id, state: 'allowed' }))
  const before = [...f.storage], restored = createBulkRecoveryFixture({ storage: f.storage }); t.after(restored.unmount)
  assert.equal(restored.bulk.recoveryBlocked.value, true); assert.equal(restored.bulk.locked.value, true)
  restored.bulk.toggle(product); restored.bulk.review(); await restored.bulk.confirm(); await restored.bulk.retry()
  assert.deepEqual([...f.storage], before); assert.equal(restored.requests.length, 0)
})

test('navigation and unload retain unresolved denial evidence', async t => {
  const f = createBulkRecoveryFixture(); t.after(f.unmount)
  await f.submit(); for (const guard of f.hooks) assert.equal(guard(), false)
  const event = { preventDefault() { this.prevented = true } }; f.listeners.get('beforeunload')(event)
  assert.equal(event.prevented, true); assert.equal(event.returnValue, '')
  await f.flush(); assert.ok(f.text().includes(f.t('productBulk.methodDenied')))
  assert.ok(!f.text().includes(f.t('productBulk.retry')))
})

for (const locale of ['en', 'ar']) test(locale + ' toolbar renders denial and result checks without a retry action', async t => {
  const f = createBulkRecoveryFixture({ locale }); t.after(f.unmount)
  await f.submit(); checkOnly(f)
  for (const key of ['methodDenied', 'deniedHelp']) assert.ok(f.text().includes(f.t('productBulk.' + key)))
  f.transport = async () => ({ result: null }); await f.bulk.check(); await f.flush()
  assert.ok(f.text().includes(f.t('productBulk.noReceipt')))
})

test('a failed list refresh cannot turn an acknowledged batch into an unknown outcome', async t => {
  const f = createBulkRecoveryFixture({ transport: async (path, options) => receipt(options.body) }); t.after(f.unmount)
  f.load = async () => { throw Error('Synthetic listing failure') }; await f.submit()
  assert.equal(f.bulk.pending.value, null); assert.equal(f.bulk.outcome.value.succeeded, 1)
  assert.equal(f.bulk.error.value, ''); assert.equal(f.storage.size, 0); assert.deepEqual(methods(f), ['POST'])
})

for (const kind of ['missing', 'malformed']) test(kind + ' POST acknowledgement stays uncertain without inventing failure', async t => {
  const f = createBulkRecoveryFixture({ transport: async (path, options) => kind === 'missing' ? null : receipt(options.body, { failed: 1 }) }); t.after(f.unmount)
  const command = await f.submit()
  assert.equal(f.bulk.submission.value, 'unknown'); assert.equal(f.bulk.error.value, 'unknown')
  assert.equal(f.bulk.outcome.value, null); assert.deepEqual(saved(f), JSON.parse(JSON.stringify(command)))
  assert.deepEqual(methods(f), ['POST'])
})

test('Auth header acquisition failure cannot erase the command or dispatch a request', async t => {
  const f = createBulkRecoveryFixture(); t.after(f.unmount)
  f.auth = async () => { throw Error('Synthetic unavailable session') }
  const command = await f.submit()
  assert.equal(f.requests.length, 0); assert.equal(f.bulk.error.value, 'unknown')
  assert.deepEqual(saved(f), JSON.parse(JSON.stringify(command)))
  await f.bulk.check(); assert.equal(f.requests.length, 0)
})

test('a failed uncertainty-state write also reloads GET-only', async t => {
  const f = createBulkRecoveryFixture({ transport: async () => { throw Error('Synthetic lost response') } })
  f.failSet = (key, value) => key.endsWith(':submission') && JSON.parse(value).state === 'unknown'
  await f.submit(); assert.equal(f.bulk.submission.value, 'awaiting'); assert.equal(f.bulk.error.value, 'storage')
  f.unmount(); const restored = createBulkRecoveryFixture({ storage: f.storage }); t.after(restored.unmount)
  await restored.flush(); checkOnly(restored); await restored.bulk.retry(); assert.equal(restored.requests.length, 0)
})

test('receipt cleanup failure preserves the original batch rather than permitting replacement', async t => {
  const f = createBulkRecoveryFixture(); t.after(f.unmount)
  const command = await f.submit(), original = f.storage.get(storageKey(actors[0]))
  f.transport = async () => ({ result: receipt(command) })
  f.failRemove = key => key === storageKey(actors[0])
  await f.bulk.check(); await f.flush(); checkOnly(f)
  assert.equal(f.storage.get(storageKey(actors[0])), original); assert.equal(f.bulk.outcome.value, null)
  assert.equal(marker(f).state, 'method')
  f.failRemove = () => false; await f.bulk.check()
  assert.equal(f.bulk.pending.value, null); assert.equal(f.storage.size, 0)
  assert.deepEqual(methods(f), ['POST', 'GET', 'GET'])
})

test('marker cleanup failure cannot hide a verified receipt or restore an orphan as a command', async t => {
  const f = createBulkRecoveryFixture(), command = await f.submit()
  f.failRemove = key => key.endsWith(':submission')
  f.transport = async () => ({ result: receipt(command) }); await f.bulk.check()
  assert.equal(f.bulk.pending.value, null); assert.equal(f.bulk.outcome.value.succeeded, 1)
  assert.equal(f.storage.has(storageKey(actors[0])), false); assert.equal(f.storage.size, 1)
  f.unmount(); const restored = createBulkRecoveryFixture({ storage: f.storage }); t.after(restored.unmount)
  assert.equal(restored.bulk.pending.value, null); assert.equal(restored.requests.length, 0)
})

test('actor change while acquiring headers prevents dispatch with stale authority', async t => {
  const wait = deferred(), f = createBulkRecoveryFixture(); t.after(f.unmount)
  f.auth = () => wait.promise; const started = f.submit(); await f.flush()
  const command = saved(f); assert.equal(f.requests.length, 0)
  f.adminUser.value = { id: actors[1], role: 'owner', is_active: true }; await f.flush()
  wait.resolve({ authorization: 'Synthetic stale actor' }); await started
  assert.equal(f.requests.length, 0); assert.equal(f.bulk.pending.value, null)
  assert.equal(JSON.parse(f.storage.get(storageKey(actors[0]))).request_id, command.request_id)
})

test('recovery uses only the current actor entry and ignores a late GET receipt after switching actors', async t => {
  const f = createBulkRecoveryFixture(), command = await f.submit()
  const other = { ...JSON.parse(JSON.stringify(command)), request_id: '00000000-0000-4000-8000-000000000005' }
  f.storage.set(storageKey(actors[1]), JSON.stringify(other))
  const wait = deferred(); f.transport = () => wait.promise
  const checking = f.bulk.check(); await f.flush()
  f.adminUser.value = { id: actors[1], role: 'owner', is_active: true }; await f.flush()
  wait.resolve({ result: receipt(command) }); await checking
  assert.equal(f.bulk.pending.value.request_id, other.request_id); assert.equal(f.bulk.outcome.value, null)
  assert.ok(f.storage.has(storageKey(actors[0])))
  f.transport = async () => ({ result: null }); await f.bulk.check()
  verifyGet(f.requests[2], other, actors[1]); assert.deepEqual(methods(f), ['POST', 'GET', 'GET'])
  assert.ok(f.storage.has(storageKey(actors[0]))); assert.ok(f.storage.has(storageKey(actors[1])))
})
