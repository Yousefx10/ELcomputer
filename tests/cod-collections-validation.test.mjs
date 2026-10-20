import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createRenderer, computed, reactive, ref, h, nextTick } from 'vue'
import { codCashCommand, throwCodCashError } from '../server/utils/codCollections.js'
import { useCodCash } from '../app/composables/useCodCash.js'

const input = () => ({ command_id: randomUUID(), action: 'receive', collection_id: null, amount: '10.01', reference: 'CASH-123', received_on: '2026-10-20', confirmed: true })
test('COD boundary requires exact cents, calendar dates and verified input without forged authority', () => {
  const id = randomUUID()
  for (const change of [{ command_id: null }, { amount: false }, { amount: [] }, { amount: {} }, { amount: NaN },
    { amount: Infinity }, { amount: '1e2' }, { amount: '0' }, { amount: '0.001' }, { amount: '10000000000' },
    { confirmed: false }, { received_on: '2026-02-30' }, { received_on: '0000-01-01' }, { reference: ' ' },
    { reference: 'a'.repeat(121) }, { actor_id: randomUUID() }, { payment_status: 'paid' }, { total: 10 },
    { action: 'refund' }, { action: 'reconcile', collection_id: null }, { collection_id: randomUUID() }]) {
    assert.throws(() => codCashCommand(id, { ...input(), ...change }), e => e.statusCode === 400)
  }
  for (const body of [null, [], {}, 'cash']) assert.throws(() => codCashCommand(id, body))
  assert.throws(() => codCashCommand('not-an-order', input()))
  const command = input(); command.command_id = command.command_id.toUpperCase(); command.reference = ' CASH-123 '
  assert.equal(codCashCommand(id, command).command_id, command.command_id.toLowerCase())
  assert.equal(codCashCommand(id, command).reference, 'CASH-123')
  assert.throws(() => throwCodCashError({ message: 'private financial data', code: 'XX000' }), e => e.statusCode === 503 && !e.message.includes('private financial'))
})

const renderer = createRenderer({
  createElement: () => ({ children: [] }), createText: text => ({ text }), createComment: () => ({}),
  insert: (node, parent) => parent.children.push(node), remove() {}, setText() {}, setElementText() {}, patchProp() {},
  parentNode: () => null, nextSibling: () => null
})
const formValues = () => ({ action: 'receive', collection_id: '', amount: '10.01', reference: 'CASH-123', received_on: '2026-10-20', confirmed: true })

test('dashboard cash command survives lost responses and reloads without silently issuing another receipt', async () => {
  const saved = new Map(), admin = ref({ id: randomUUID() }), order = ref(randomUUID()), permission = ref(true)
  const names = ['useAdminAccess', 'useAdminLogs', '$fetch', 'sessionStorage']
  const prior = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name))
  let mode = 'lost', calls = [], commits = 0, notifications = 0, mounted
  const results = new Map()
  Object.assign(globalThis, { useAdminAccess: () => ({ adminUser: admin }), useAdminLogs: () => ({ getAdminAuthHeaders: async () => ({ authorization: 'Bearer fixture' }) }),
    sessionStorage: { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) },
    $fetch: async (path, options) => {
      calls.push(JSON.parse(JSON.stringify({ path, options })))
      const command = options.body
      if (mode === 'denied') throw { data: { data: { codCashError: 'balance' } } }
      if (!results.has(command.command_id)) {
        commits++; results.set(command.command_id, { status: 'committed', command_id: command.command_id, entry_id: randomUUID(), audit_id: randomUUID() })
      }
      if (mode === 'lost') throw Error('Owned lost acknowledgement')
      return results.get(command.command_id)
    }
  })
  const mount = () => {
    const form = reactive(formValues()); let controls
    const app = renderer.createApp({ setup() {
      controls = useCodCash({ orderId: order, form, canSubmit: computed(() => permission.value), onCommitted: async () => { notifications++ } })
      return () => h('span')
    } })
    app.mount({ children: [] }); mounted = app
    return { form, controls, app }
  }
  try {
    let c = mount()
    await c.controls.submit()
    const original = JSON.parse(JSON.stringify(c.controls.command.value))
    assert.equal(c.controls.error.value, 'unknown'); assert.equal(commits, 1)
    c.controls.clear(); assert.equal(c.controls.command.value.command_id, original.command_id)
    c.app.unmount(); c = mount()
    assert.deepEqual({ ...c.controls.command.value }, original); assert.equal(c.controls.locked.value, true)
    c.form.amount = '999' // Even a programmatic field edit cannot change a retained command.
    mode = 'ok'; await c.controls.submit()
    assert.equal(commits, 1); assert.equal(notifications, 1); assert.equal(c.controls.outcome.value.status, 'committed')
    assert.deepEqual(calls[0].options.body, calls[1].options.body); assert.equal(calls[0].options.retry, 0)
    c.controls.clear(); assert.equal(c.controls.command.value, null); assert.equal(saved.size, 0); assert.equal(c.form.confirmed, false)
    mode = 'denied'; Object.assign(c.form, formValues()); await c.controls.submit()
    assert.equal(c.controls.error.value, 'balance'); c.controls.clear(); assert.equal(c.controls.command.value, null)
    mode = 'ok'; Object.assign(c.form, formValues()); permission.value = false
    const count = calls.length; await c.controls.submit(); assert.equal(calls.length, count)
    permission.value = true; await c.controls.submit(); assert.equal(commits, 2)
    const ownKey = [...saved.keys()][0]
    admin.value = { id: randomUUID() }; await nextTick()
    assert.equal(c.controls.command.value, null); assert.equal(saved.has(ownKey), true)
    const originalSet = sessionStorage.setItem
    sessionStorage.setItem = () => { throw Error('Owned tab storage failure') }
    const total = calls.length; await c.controls.submit(); assert.equal(c.controls.error.value, 'storage'); assert.equal(calls.length, total)
    sessionStorage.setItem = originalSet
  } finally {
    mounted?.unmount()
    names.forEach((name, i) => { if (prior[i]) Object.defineProperty(globalThis, name, prior[i]); else delete globalThis[name] })
  }
})
