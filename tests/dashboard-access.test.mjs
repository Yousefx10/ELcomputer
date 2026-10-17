import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createDashboardAccessFixture } from './helpers/dashboardAccessFixture.mjs'

const run = promisify(execFile)

test('ADM-01 renderer portability and isolated Nginx route/method regressions', async () => {
  const { stdout, stderr } = await run('/usr/bin/python3', ['tests/dashboard_access_test.py'],
    { env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, maxBuffer: 100000 })
  assert.match(stdout + stderr, /OK/)
})

test('existing dashboard handlers retain authentication, active-admin checks and RBAC', async t => {
  const f = await createDashboardAccessFixture()
  t.after(() => f.close())
  const saved = await f.save(f.body({ title: 'Independent fixture catalog', price: '125.50' }))
  const paths = ['/api/admin-erp/state', '/api/admin-dashboard/summary', '/api/admin-products/list',
    '/api/admin-products/filter-options?kind=category', '/api/admin-products/' + saved.id,
    '/api/admin-inventory/items', '/api/admin-inventory/options']

  await t.test('anonymous, forged, inactive and customer actors cannot read dashboard APIs', async () => {
    for (const path of paths) {
      for (const [token, expected] of [[undefined, 401], ['forged-owner-token', 401], ['disabled', 403], ['customer', 403]]) {
        const response = await f.call(path, { token, headers: { 'x-user-id': f.actors.owner, 'x-role': 'owner' } })
        assert.equal(response.status, expected, path + ' ' + token)
        assert.equal(JSON.stringify(response.data).includes('Independent fixture catalog'), false)
      }
    }
  })

  await t.test('owner reads real product SQL without weakening staff permissions', async () => {
    for (const path of paths) assert.equal((await f.call(path, { token: 'owner' })).status, 200, path)
    const detail = await f.call('/api/admin-products/' + saved.id, { token: 'owner' })
    assert.equal(detail.data.product.title, 'Independent fixture catalog')
    assert.equal(Number(detail.data.product.price), 125.50)
    assert.equal(detail.headers.get('cache-control'), 'private, no-store')
    assert.equal((await f.call('/api/admin-products/list', { token: 'viewer' })).status, 200)
    assert.equal((await f.call('/api/admin-products/' + saved.id, { token: 'viewer' })).status, 403)
    assert.equal((await f.call('/api/admin-products/' + saved.id, { token: 'editor' })).status, 200)
    assert.equal((await f.call('/api/admin-products/list', { token: 'restricted' })).status, 403)
    for (const path of ['/api/admin-inventory/items', '/api/admin-inventory/options']) {
      assert.equal((await f.call(path, { token: 'viewer' })).status, 200)
      assert.equal((await f.call(path, { token: 'restricted' })).status, 403)
    }
    assert.equal((await f.call('/api/admin-inventory/items', { token: 'owner' })).data.pagination.total, 0)
    const summary = await f.call('/api/admin-dashboard/summary', { token: 'restricted' })
    assert.equal(summary.status, 200)
    assert.equal(summary.data.catalog.products, 0)
    assert.equal(summary.data.users.customers, 0)
    assert.equal(summary.data.orders.total, 0)
  })

  await t.test('login auditing binds the verified actor and rejects unauthenticated impersonation', async () => {
    const body = { actionKey: 'dashboard.login', description: 'Signed in to the dashboard.', admin_user_id: f.actors.owner, author_role: 'owner' }
    const count = async () => (await f.db.query("select count(*)::int n from public.admin_activity_logs where action_key='dashboard.login'")).rows[0].n
    const before = await count()
    for (const [token, expected] of [[undefined, 401], ['forged-owner-token', 401], ['disabled', 403], ['customer', 403]]) {
      assert.equal((await f.call('/api/admin-logs', { token, body })).status, expected)
    }
    assert.equal(await count(), before)
    const response = await f.call('/api/admin-logs', { token: 'viewer', body })
    assert.equal(response.status, 200)
    assert.equal(response.data.success, true)
    const row = (await f.db.query("select admin_user_id,author_role from public.admin_activity_logs where action_key='dashboard.login'")).rows[0]
    assert.equal(row.admin_user_id, f.actors.viewer)
    assert.equal(row.author_role, 'admin')
    assert.equal((await f.call('/api/admin-logs', { token: 'owner', body })).data.success, true)
    assert.equal((await f.call('/api/admin-logs', { token: 'owner', body: { ...body, actionKey: 'treasury.salary_payment.created' } })).status, 400)
    assert.equal(await count(), before + 2)
  })

  await t.test('direct customer reads of admin records remain denied in the isolated schema', async () => {
    await f.db.exec('begin')
    try {
      await f.db.query("select set_config('request.jwt.claim.sub',$1,true)", [f.actors.customer])
      await f.db.exec("set local role authenticated; select set_config('request.jwt.claim.role','authenticated',true)")
      // The schema fixture omits hosted default table grants. Preserve that
      // denial; do not grant rights merely to make a test pass. Hosted owner
      // RLS/session acceptance remains a separate post-deployment check.
      await assert.rejects(f.db.query('select id from public.admin_users'), { code: '42501' })
    } finally { await f.db.exec('rollback') }
  })
})
