import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir, mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import { createCatalogRestFixture } from './helpers/catalogRestFixture.mjs'
import { createProductSaveFixture } from './helpers/productSaveFixture.mjs'
import { createDashboardAccessFixture } from './helpers/dashboardAccessFixture.mjs'
import { createDashboardReadIngress } from './helpers/dashboardReadIngress.mjs'
import { emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'
import { pngImage } from './helpers/mediaFixture.mjs'

const policy = JSON.parse(await readFile(new URL('../scripts/nginx/dashboard_read_policy.json', import.meta.url), 'utf8'))
const uuid = '25d1c5ed-213d-4f50-8c1a-0eb18c36262f'
const sample = path => path.replaceAll(':id', uuid).replaceAll(':sessionId', uuid).replaceAll(':token', 'UNIT-001')

test('dashboard read registry, current-ADM upgrade and two-store actual Nginx matrix', async () => {
  const { stdout, stderr } = await promisify(execFile)('/usr/bin/python3', ['-B', 'tests/dashboard_reads_test.py'],
    { env: process.env, maxBuffer: 1000000 })
  assert.match(stdout + stderr, /OK/)
})

test('real Nginx, H3 guards and native PostgREST preserve dashboard read authorization', {
  skip: !emailNativeAvailable || !process.env.CATALOG_REVIEW_POSTGREST_BIN || !process.env.DASHBOARD_REVIEW_NGINX,
  timeout: 120000,
}, async t => {
  const rest = await createCatalogRestFixture({ afterCatalog: async db => {
    const dir = new URL('../supabase/migrations/', import.meta.url)
    for (const name of (await readdir(dir)).filter(n => n.endsWith('.sql') && n > '20261011120000_catalog_confidentiality.sql').sort()) await db.exec(await readFile(new URL(name, dir), 'utf8'))
    // The schema-only fixture omits managed Supabase's service SELECT grants.
    // Adapt only disposable platform scaffolding; no authenticated/anon grants
    // or application RLS/SQL changes. Hosted grant acceptance remains pending.
    await db.exec('grant select on all tables in schema public to service_role')
  } })
  t.after(() => rest.close())
  const fixture = await createProductSaveFixture({ database: rest.db })
  const originalFetch = globalThis.fetch
  const blockedExternal = []
  globalThis.fetch = async (url, init) => {
    const parsed = new URL(typeof url === 'string' || url instanceof URL ? url : url.url)
    if (parsed.hostname !== '127.0.0.1') { blockedExternal.push(parsed.origin); throw Error('External provider request refused by test') }
    return originalFetch(url, init)
  }
  t.after(() => { globalThis.fetch = originalFetch })
  const nativeClient = createClient(rest.url, 'fixture-public-key', { global: {
    headers: { authorization: 'Bearer ' + rest.token('service') },
    // Native PostgREST has no hosted Supabase /rest/v1 gateway prefix.
    fetch: (url, init) => {
      const parsed = new URL(url)
      assert.equal(parsed.origin, rest.url)
      assert.ok(parsed.pathname.startsWith('/rest/v1/'), 'No Storage or other hosted service transport')
      parsed.pathname = parsed.pathname.slice('/rest/v1'.length)
      return globalThis.fetch(parsed, init)
    },
  }, auth: { persistSession: false, autoRefreshToken: false } })
  const root = await realpath(await mkdtemp(join(tmpdir(), 'dashboard-read-media-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  const canary = 'private-runtime-canary-never-return-1234567890'
  const runtime = { uploadsDir: root, supabaseServiceRoleKey: canary, credentialsEncryptionKey: canary,
    shippingCredentialsEncryptionKey: canary, daftraApiKey: canary, paymobEnabled: false,
    public: { siteUrl: 'https://orchard.example.test', supabaseUrl: 'https://backend.example.test' } }
  const f = await createDashboardAccessFixture({ fixture, readPolicy: true, runtime, nativeClient })
  t.after(() => f.close())
  const edge = await createDashboardReadIngress(f.origin)
  t.after(() => edge.close())
  const { db, actors } = f
  const saved = await f.save(f.body({ title: 'Private merchandising fixture' }))
  await db.query("update public.admin_users set permissions=$2 where id=$1", [actors.restricted, JSON.stringify({ 'users.view': true })])
  const customer = actors.customer
  await db.query("update public.customer_profiles set is_internal=false,full_name='Confidential buyer',phone='01012345678' where id=$1", [customer])
  await db.exec("update public.site_settings set payment_cash_enabled=true where key='default'")
  const order = (await db.query("insert into public.customer_orders(user_id,order_number,first_name,phone,street_address,city,governorate,email) values($1,'READ-PRIVATE-001','Confidential buyer','01012345678','Private street','Fixture','Fixture','buyer@example.invalid') returning id", [customer])).rows[0].id
  await db.exec("update public.site_settings set payment_cash_enabled=false where key='default'")
  const folder = randomUUID()
  await db.query("insert into public.document_folders(id,name,is_restricted,created_by) values($1,'Restricted fixture',true,$2)", [folder, actors.owner])
  const document = randomUUID()
  await db.query("insert into public.documents(id,folder_id,name,storage_path,created_by) values($1,$2,'Confidential.pdf','never-download.pdf',$3)", [document, folder, actors.owner])
  await db.query("update public.admin_users set permissions=$2 where id=$1", [actors.editor, JSON.stringify({ 'products.view': true, 'products.edit': true, 'documents.view': true, 'documents.manage': true, 'dashboard.view': true, 'dashboard.orders': true })])
  await mkdir(join(root, 'products'), { recursive: true }); await mkdir(join(root, 'settings/site-logo'), { recursive: true })
  await writeFile(join(root, 'products/visible.png'), pngImage())
  await writeFile(join(root, 'settings/site-logo/hidden.png'), pngImage())
  const receiptInput = f.body({ title: 'Receipt isolation fixture' })
  const receiptProduct = await f.save(receiptInput)
  const accessibleFolder = randomUUID()
  await db.query("insert into public.document_folders(id,name,is_restricted,created_by) values($1,'Viewer fixture',true,$2)", [accessibleFolder, actors.owner])
  await db.query("insert into public.document_folder_permissions(folder_id,admin_user_id,access_level) values($1,$2,'viewer')", [accessibleFolder, actors.editor])
  const snapshot = async () => {
    const tables = (await db.query("select schemaname,tablename from pg_tables where schemaname not in ('pg_catalog','information_schema') and schemaname not like 'pg_%' order by schemaname,tablename")).rows
    return Object.fromEntries(await Promise.all(tables.map(async ({ schemaname, tablename }) => [schemaname + '.' + tablename,
      (await db.query(`select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) hash from ${schemaname}.${tablename} t`)).rows[0].hash])))
  }
  const before = await snapshot()
  const readQueries = {
    '/api/admin-after-sales/catalog': '?kind=product',
    '/api/admin-crm/activities/open-cases': '?accountId=' + f.supplier,
    '/api/admin-documents/tagged': '?tagId=' + uuid,
    '/api/admin-email/events': '?id=' + uuid,
    '/api/admin-email/preferences': '?recipient=reader@example.invalid',
    '/api/admin-products/filter-options': '?kind=category',
    '/api/admin-products/bulk': '?request_id=' + uuid,
    '/api/admin-products': '?request_id=' + receiptInput.request_id,
    '/api/admin-products/transfer/template': '?format=csv',
  }

  await t.test('every allowed handler denies missing, invalid, expired, inactive and non-admin actors', async () => {
    for (const route of policy.routes.filter(r => r.decision === 'allow')) {
      for (const [token, status] of [[undefined, 401], ['invalid', 401], ['expired', 401], ['disabled', 403], ['customer', 403]]) {
        const response = await edge.call(sample(route.path), { token, headers: { 'x-user-id': actors.owner, 'x-role': 'owner' } })
        assert.equal(response.status, status, route.path + ' ' + token)
        assert.ok(!JSON.stringify(response.data).includes('Confidential buyer'))
      }
    }
  })

  await t.test('owner reads Users, customer PII, orders, Setup and Image Manager through existing authorization', async () => {
    for (const path of ['/api/admin-users?page=1&pageSize=10', '/api/customer-users', '/api/customer-users/' + customer,
      '/api/admin-orders', '/api/admin-orders/' + order, '/api/admin-orders/packing', '/api/admin-orders/packing/work-session',
      '/api/admin-setup/status', '/api/admin-gallery', '/api/admin-logs', '/api/admin-products/list', '/api/admin-products/' + saved.id]) {
      const response = await edge.call(path, { token: 'owner' })
      assert.equal(response.status, 200, path + ' ' + JSON.stringify(response.data))
      assert.equal(response.headers.get('cache-control'), 'private, no-store')
      assert.ok(!JSON.stringify(response.data).includes(canary))
    }
    assert.equal((await edge.call('/api/admin-orders/' + order, { token: 'owner' })).data.order.email, 'buyer@example.invalid')
    assert.ok((await edge.call('/api/customer-users/' + customer, { token: 'owner' })).data.item.full_name.includes('Confidential'))
  })

  await t.test('every allowed read reaches its actual read or missing-resource branch for the owner', async () => {
    const branches = {}
    for (const route of policy.routes.filter(r => r.decision === 'allow')) {
      const path = sample(route.path) + (readQueries[route.path] || '')
      const response = await edge.call(path, { token: 'owner' })
      assert.ok([200, 404].includes(response.status), path + ' ' + response.status + ' ' + JSON.stringify(response.data))
      assert.ok(!JSON.stringify(response.data).includes(canary))
      branches[response.status] = (branches[response.status] || 0) + 1
    }
    assert.equal((await edge.call('/api/admin-users', { token: 'owner', method: 'HEAD' })).status, 405)
    assert.equal((await edge.call('/api/admin-setup/status', { token: 'owner', method: 'HEAD' })).status, 405)
    t.diagnostic('Owner read branches: ' + JSON.stringify(branches))
  })

  await t.test('staff without each module permission cannot reach its sensitive read', async () => {
    const existingViewerReads = new Set(['/api/admin-erp/state', '/api/admin-dashboard/summary', '/api/admin-reviews',
      '/api/admin-products/list', '/api/admin-products/filter-options', '/api/admin-products/transfer/template',
      '/api/admin-inventory/items', '/api/admin-inventory/options'])
    for (const route of policy.routes.filter(r => r.decision === 'allow' && !r.path.startsWith('/api/admin-crm/') && !existingViewerReads.has(r.path))) {
      assert.equal((await edge.call(sample(route.path) + (readQueries[route.path] || ''), { token: 'viewer' })).status, 403, route.path)
    }
    // Existing coarse active-admin contracts remain explicit, without invented RBAC.
    for (const path of ['/api/admin-crm/contacts', '/api/admin-reviews']) assert.equal((await edge.call(path, { token: 'viewer' })).status, 200)
  })

  await t.test('staff permissions, owner-only status, confidential projections and media sections remain enforced', async () => {
    for (const path of ['/api/admin-users', '/api/customer-users', '/api/customer-users/' + customer, '/api/admin-orders', '/api/admin-orders/' + order]) {
      assert.equal((await edge.call(path, { token: 'viewer' })).status, 403, path)
    }
    assert.equal((await edge.call('/api/admin-users', { token: 'restricted' })).status, 200)
    assert.equal((await edge.call('/api/customer-users/' + customer, { token: 'restricted' })).status, 200)
    assert.equal((await edge.call('/api/admin-orders/' + order, { token: 'restricted' })).status, 403)
    assert.equal((await edge.call('/api/admin-orders/' + order, { token: 'editor' })).status, 200)
    for (const token of ['viewer', 'editor', 'restricted']) assert.equal((await edge.call('/api/admin-setup/status', { token })).status, 403)
    assert.equal((await edge.call('/api/admin-gallery', { token: 'viewer' })).status, 403)
    const gallery = await edge.call('/api/admin-gallery', { token: 'editor' })
    assert.equal(gallery.status, 200)
    assert.deepEqual(gallery.data.items.map(i => i.name), ['visible.png'])
    assert.equal((await edge.call('/api/admin-gallery?section=site_logo', { token: 'editor' })).status, 403)
    const list = await edge.call('/api/admin-products/list', { token: 'viewer' })
    assert.equal(list.status, 200)
    for (const secret of ['cost_price', 'default_supplier_id', 'primary_warehouse_id']) assert.ok(!JSON.stringify(list.data).includes(secret))
  })

  await t.test('document folder ACL and actor-owned receipt recovery cannot leak another resource', async () => {
    assert.equal((await edge.call('/api/admin-documents?folderId=' + folder, { token: 'owner' })).status, 200)
    const denied = await edge.call('/api/admin-documents?folderId=' + folder, { token: 'editor' })
    assert.equal(denied.status, 403)
    assert.ok(!JSON.stringify(denied.data).includes('Confidential.pdf'))
    assert.equal((await edge.call('/api/admin-documents/folders/' + folder + '/permissions', { token: 'editor' })).status, 403)
    assert.equal((await edge.call('/api/admin-documents?folderId=' + accessibleFolder, { token: 'editor' })).status, 200)
    assert.equal((await edge.call('/api/admin-documents/folders/' + accessibleFolder + '/permissions', { token: 'editor' })).status, 403)
    const ownerReceipt = await edge.call('/api/admin-products?request_id=' + receiptInput.request_id, { token: 'owner' })
    assert.equal(ownerReceipt.status, 200)
    assert.equal(ownerReceipt.data.result.id, receiptProduct.id)
    assert.equal((await edge.call('/api/admin-products?request_id=' + receiptInput.request_id, { token: 'editor' })).data.result, null)
  })

  await t.test('held GETs and every administrative write handler remain blocked at Nginx', async () => {
    for (const route of policy.routes.filter(r => r.decision === 'hold')) assert.equal((await edge.call(sample(route.path), { token: 'owner' })).status, 403)
    assert.equal((await edge.call('/api/admin-products/transfer/import?job_id=' + uuid, { token: 'owner' })).status, 403)
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      for (const route of policy.routes) {
        if (method === 'POST' && route.path === '/api/admin-logs') continue
        assert.equal((await edge.call(sample(route.path), { token: 'owner', method })).status, 405)
      }
    }
  })
  assert.deepEqual(await snapshot(), before, 'Every fixture record remains unchanged after HTTP reads and denials')
  assert.deepEqual(blockedExternal, [], 'No provider requests')
  t.diagnostic('Unchanged fixture tables across all application/platform fixture schemas: ' + Object.keys(before).length)

  await t.test('held import status has a real expiry write, demonstrated only in a rolled-back local transaction', async () => {
    const job = randomUUID()
    await db.exec('begin')
    try {
      await db.query("insert into catalog_private.import_jobs(id,actor_id,source_hash,review_hash,erp_mode,needs_add,needs_edit,publish_count,row_count,expires_at) values($1,$2,$3,'fixture-review','built_in',true,false,0,1,clock_timestamp()-interval '1 minute')", [job, actors.owner, 'a'.repeat(64)])
      await db.query("insert into catalog_private.import_items(job_id,product_key,graph_hash,command_hash) values($1,'fixture',decode('aa','hex'),decode('bb','hex'))", [job])
      await db.query('select public.catalog_import_status($1,$2)', [actors.owner, job])
      assert.equal((await db.query('select closed_reason from catalog_private.import_jobs where id=$1', [job])).rows[0].closed_reason, 'expired')
      assert.equal((await db.query('select status from catalog_private.import_items where job_id=$1', [job])).rows[0].status, 'failed')
    } finally { await db.exec('rollback') }
    assert.deepEqual(await snapshot(), before)
  })
})
