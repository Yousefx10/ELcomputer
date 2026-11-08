import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { daftraProductCost, captureDaftraCosts } from '../server/utils/daftraSync.js'
import { daftraProductBody, createDaftraProduct } from '../server/utils/daftraProductCreate.js'

// Small in-memory stand-in for the Supabase admin client: equality filters, .or() on local_id,
// insert/update/delete and named RPC handlers.
const fakeDb = (tables, rpcs = {}) => {
  const calls = []
  const builder = (table) => {
    let rows = () => tables[table] || [], filters = [], op = 'select', values = null
    const run = () => {
      let list = rows().filter(row => filters.every(f => f(row)))
      if (op === 'insert') { (tables[table] ||= []).push(...[].concat(values)); return { data: values, error: null } }
      if (op === 'update') { list.forEach(row => Object.assign(row, values)); return { data: list, error: null } }
      if (op === 'delete') { tables[table] = rows().filter(row => !list.includes(row)); return { data: list, error: null } }
      return { data: list, error: null }
    }
    const api = {
      select: () => api, eq: (k, v) => { filters.push(row => String(row[k]) === String(v)); return api },
      or: expr => { const ids = expr.match(/[0-9a-f-]{36}/g) || []; filters.push(row => ids.includes(row.local_id)); return api },
      insert: v => { op = 'insert'; values = v; return api }, update: v => { op = 'update'; values = v; return api }, delete: () => { op = 'delete'; return api },
      maybeSingle: async () => { const r = run(); return { data: r.data[0] || null, error: null } },
      then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject)
    }
    return api
  }
  return { calls, from: table => builder(table), rpc: async (name, args) => { calls.push([name, args]); return rpcs[name] ? rpcs[name](args) : { data: null, error: { message: 'unexpected rpc ' + name } } } }
}

test('Daftra cost: purchase price, else average cost; invalid values are skipped', () => {
  assert.equal(daftraProductCost({ buy_price: '120.456', average_price: 99 }), 120.46)
  assert.equal(daftraProductCost({ buy_price: null, average_price: '80' }), 80)
  assert.equal(daftraProductCost({ buy_price: '', average_price: null }), null)
  assert.equal(daftraProductCost({ buy_price: -1 }), null)
  assert.equal(daftraProductCost({}), null)
})

test('costs are read once per Daftra product and saved for lines without a cost', async () => {
  const [a, b, c] = [randomUUID(), randomUUID(), randomUUID()], order = randomUUID(), saved = []
  const db = fakeDb({}, {
    order_item_costs_known: () => ({ data: [c], error: null }),
    order_item_costs_save: ({ p_rows }) => { saved.push(...p_rows); return { data: p_rows.length, error: null } }
  })
  const requests = []
  const request = async path => { requests.push(path); const id = path.match(/products\/(\d+)/)[1]; return { data: { Product: { id, buy_price: id === '7' ? '50' : null, average_price: id === '8' ? '30.5' : null } } } }
  const items = [{ id: a }, { id: b }, { id: c }]
  const result = await captureDaftraCosts(db, order, items, [{ external_id: '7' }, { external_id: '7' }, { external_id: '8' }], request)
  assert.deepEqual(requests, ['/products/7.json'], 'the line with a saved cost is not read again')
  assert.deepEqual(saved, [{ order_item_id: a, external_product_id: '7', unit_cost: 50 }, { order_item_id: b, external_product_id: '7', unit_cost: 50 }])
  assert.deepEqual(result, { saved: 2, missing: 0 })
})

test('a Daftra answer for another product is not saved as this line\'s cost', async () => {
  const db = fakeDb({}, { order_item_costs_known: () => ({ data: [], error: null }), order_item_costs_save: () => { throw new Error('nothing to save') } })
  const result = await captureDaftraCosts(db, randomUUID(), [{ id: randomUUID() }], [{ external_id: '7' }], async () => ({ data: { Product: { id: '9', buy_price: 1 } } }))
  assert.deepEqual(result, { saved: 0, missing: 1 })
})

test('new Daftra products copy the store\'s settings and let Daftra pick the code', () => {
  assert.deepEqual(daftraProductBody({ title: 'Owned keyboard', price: 1999 }, { name: 'Red switch', price: null }),
    { Product: { name: 'Owned keyboard Red switch', unit_price: 1999, track_stock: 1, type: 1, status: 0 } })
  assert.equal(daftraProductBody({ title: 'Owned mouse', price: 500 }, { name: 'Default', price: 650 }).Product.name, 'Owned mouse')
  assert.equal(daftraProductBody({ title: 'Owned mouse', price: 500 }, { name: 'Default', price: 650 }).Product.unit_price, 650)
  assert.equal('product_code' in daftraProductBody({ title: 'x', price: 1 }, { name: '' }).Product, false)
})

test('Create in Daftra: refuses duplicates and links, never posting twice', async t => {
  const product = randomUUID(), variant = randomUUID(), admin = randomUUID()
  const setup = (extra = {}) => {
    const tables = { product_variants: [{ id: variant, product_id: product, name: 'Default', price: null, is_active: true }], products: [{ id: product, title: 'Owned stand', price: 750 }],
      erp_entity_links: [], erp_remote_writes: [], ...extra }
    const links = []
    const db = fakeDb(tables, { erp_save_product_links: ({ p_links }) => { links.push(...p_links); return { data: { saved: 1, requeued: 0 }, error: null } } })
    return { tables, links, db }
  }
  const posts = []
  const request = async (path, options) => { if (options?.method === 'POST') { posts.push([path, options.body]); return { id: 4321 } } throw new Error('unexpected ' + path) }
  const catalog = names => async () => ({ products: names.map((name, i) => ({ id: String(i + 1), name, code: String(i + 1), active: true })) })

  await t.test('same name in Daftra → link instead', async () => {
    const { db } = setup()
    await assert.rejects(() => createDaftraProduct(db, { adminId: admin, variantId: variant }, { request, catalog: catalog(['OWNED  stand']) }), /already has a product with this name/)
    assert.equal(posts.length, 0)
  })
  await t.test('creates once, records the intent and links the option', async () => {
    const { db, tables, links } = setup()
    const result = await createDaftraProduct(db, { adminId: admin, variantId: variant }, { request, catalog: catalog(['Owned stand pro']) })
    assert.deepEqual(result, { daftraId: '4321', name: 'Owned stand', requeued: 0 })
    assert.deepEqual(posts, [['/products.json', { Product: { name: 'Owned stand', unit_price: 750, track_stock: 1, type: 1, status: 0 } }]])
    assert.deepEqual(tables.erp_remote_writes.map(w => [w.operation, w.local_id, w.state, w.external_id]), [['product.create', variant, 'confirmed', '4321']])
    assert.deepEqual(links, [{ variant_id: variant, daftra_id: '4321', daftra_code: null, source: 'owner' }])
  })
  await t.test('a confirmed earlier creation is linked again without a second product', async () => {
    const { db, links } = setup({ erp_remote_writes: [{ operation: 'product.create', local_id: variant, state: 'confirmed', external_id: '4321' }] })
    await createDaftraProduct(db, { adminId: admin, variantId: variant }, { request, catalog: async () => { throw new Error('no catalog read') } })
    assert.equal(posts.length, 1); assert.equal(links[0].daftra_id, '4321')
  })
  await t.test('an uncertain earlier attempt and an existing link both stop', async () => {
    const pending = setup({ erp_remote_writes: [{ operation: 'product.create', local_id: variant, state: 'submitted' }] })
    await assert.rejects(() => createDaftraProduct(pending.db, { adminId: admin, variantId: variant }, { request, catalog: catalog([]) }), /may already have this product/)
    const linked = setup({ erp_entity_links: [{ id: 1, provider: 'daftra', external_entity_type: 'product', local_entity_type: 'product_variant', local_id: variant }] })
    await assert.rejects(() => createDaftraProduct(linked.db, { adminId: admin, variantId: variant }, { request, catalog: catalog([]) }), /already linked/)
    assert.equal(posts.length, 1)
  })
})

test('endpoint and screen: staff with product editing only, Daftra mode only, confirm first', async () => {
  const endpoint = await readFile('server/api/admin-erp/product-create.post.js', 'utf8')
  assert.match(endpoint, /permission: 'products\.edit'/); assert.match(endpoint, /assertExternalErpDomain/)
  const screen = await readFile('app/components/dashboard/ErpProductLinks.vue', 'utf8')
  assert.match(screen, /confirmCreate === row\.variantId/); assert.match(screen, /\/api\/admin-erp\/product-create/)
})

test('native: costs stay private and reports count only fully costed orders', { timeout: 300000 }, async t => {
  const { emailNativeAvailable } = await import('./helpers/emailNativeDatabase.mjs')
  if (!emailNativeAvailable) return t.skip('native PostgreSQL is not configured')
  const { createPrivatePackingFixture } = await import('./helpers/privatePackingFixture.mjs')
  const f = await createPrivatePackingFixture()
  const q = (sql, args) => f.db.query(sql, args)
  try {
    const sql = await readFile('supabase/migrations/20261108050000_daftra_costs_reports.sql', 'utf8')
    assert.match(sql, /revoke all on table private\.order_item_costs from public,anon,authenticated/)
    await q("update public.site_settings set payment_card_enabled=true where key='default'")
    const { product_id: product, id: variant } = (await q('select id,product_id from public.product_variants limit 1')).rows[0]
    const order = async (items, status = 'processing') => {
      const id = randomUUID()
      await q(`insert into public.customer_orders(id,user_id,order_number,status,payment_method,payment_status,subtotal_amount,discount_amount,total_amount,first_name,phone,street_address,city,governorate,shipping_method)
        values($1,$2,$3,$4,'card','pending',0,10,0,'Owned buyer','01012345678','Owned street','Cairo','Cairo','shipping')`, [id, f.actors.customer, 'ORD-' + id.slice(0, 8), status])
      const lines = []
      for (const [price, quantity] of items) lines.push((await q("insert into public.customer_order_items(order_id,product_id,variant_id,product_title,unit_price,quantity,line_total) values($1,$2,$3,'Owned item',$4::numeric,$5::int,$4::numeric*$5::int) returning id", [id, product, variant, price, quantity])).rows[0].id)
      return { id, lines }
    }
    const full = await order([[100, 2], [50, 1]]), partial = await order([[300, 1], [20, 1]]), none = await order([[999, 1]]), cancelled = await order([[500, 1]], 'cancelled')
    const save = (o, rows) => q("select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true),set_config('role','service_role',true)").then(() =>
      q('select public.order_item_costs_save($1,$2::jsonb) n', [o, JSON.stringify(rows)]))
    await q('begin')
    await save(full.id, [{ order_item_id: full.lines[0], external_product_id: '7', unit_cost: 60 }, { order_item_id: full.lines[1], external_product_id: '8', unit_cost: 20 }])
    await save(partial.id, [{ order_item_id: partial.lines[0], external_product_id: '9', unit_cost: 200 }])
    await save(cancelled.id, [{ order_item_id: cancelled.lines[0], external_product_id: '9', unit_cost: 400 }])
    await assert.rejects(() => save(full.id, [{ order_item_id: none.lines[0], external_product_id: '9', unit_cost: 1 }]), /Unknown order line/)
    await q('rollback').catch(() => {})
    await q('begin')
    await save(full.id, [{ order_item_id: full.lines[0], external_product_id: '7', unit_cost: 60 }, { order_item_id: full.lines[1], external_product_id: '8', unit_cost: 20 }])
    await save(partial.id, [{ order_item_id: partial.lines[0], external_product_id: '9', unit_cost: 200 }])
    await save(cancelled.id, [{ order_item_id: cancelled.lines[0], external_product_id: '9', unit_cost: 400 }])
    await q('commit')
    await t.test('signed-in customers cannot save or read costs', async () => {
      const asCustomer = async sql => {
        await q('begin')
        try {
          await q("select set_config('request.jwt.claims',$1,true),set_config('request.jwt.claim.sub',$2,true),set_config('role','authenticated',true)", [JSON.stringify({ role: 'authenticated', sub: f.actors.customer }), f.actors.customer])
          return await q(sql, [full.id].slice(0, (sql.match(/\$1/g) || []).length))
        } finally { await q('rollback').catch(() => {}) }
      }
      await assert.rejects(() => asCustomer('select public.order_item_costs_known($1)'), /permission denied|Service role required/)
      await assert.rejects(() => asCustomer('select * from private.order_item_costs'), /permission denied/)
      await assert.rejects(() => asCustomer('select * from public.dashboard_get_analysis_profit(current_date,current_date)'), /Not authorized/)
    })
    await t.test('owner report: cost and profit from fully costed orders, with coverage', async () => {
      await q('begin')
      await q("select set_config('request.jwt.claims',$1,true),set_config('request.jwt.claim.sub',$2,true),set_config('role','authenticated',true)", [JSON.stringify({ role: 'authenticated', sub: f.actors.owner }), f.actors.owner])
      const rows = (await q("select * from public.dashboard_get_analysis_profit((now() at time zone 'Africa/Cairo')::date,(now() at time zone 'Africa/Cairo')::date)")).rows
      await q('rollback')
      assert.equal(rows.length, 1)
      const [r] = rows
      assert.equal(Number(r.orders), 3, 'cancelled orders are left out')
      assert.equal(Number(r.costed_orders), 1)
      assert.equal(Number(r.product_sales), 240, 'line totals 250 minus the 10 coupon discount')
      assert.equal(Number(r.cost), 140); assert.equal(Number(r.profit), 100)
    })
  } finally { await f.close() }
})
