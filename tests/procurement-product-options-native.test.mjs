import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { PostgrestClient } from '@supabase/postgrest-js'
import { createCatalogRestFixture } from './helpers/catalogRestFixture.mjs'
import { emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'
import { catalogMigration } from './helpers/catalogFixture.mjs'

const component = new URL('../app/components/dashboard/commerce/ProcurementTab.vue', import.meta.url)
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const loadOptions = source => {
  const match = source.match(/const loadProductOptions = async \(\) => \{([\s\S]*?)\n\}\n\nconst loadRecentProcurements/)
  assert.ok(match, 'Execute the existing component loader, including its real query and normalization')
  return new AsyncFunction('supabase', 'productSearchQuery', 'items', 'productOptions', match[1])
}

test('Procurement projection/order, embeddings and access through actual disposable PostgREST', {
  skip: !emailNativeAvailable || !process.env.CATALOG_REVIEW_POSTGREST_BIN,
  timeout: 60000
}, async t => {
  const f = await createCatalogRestFixture({ afterCatalog: async db => {
    // Keep the existing security fixture, then apply every remaining immutable
    // migration before PostgREST starts and builds its relationship cache.
    const directory = new URL('../supabase/migrations/', import.meta.url)
    const all = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()
    assert.equal(all.length, 82, 'Exercise the complete current 82-migration application schema')
    const remaining = all.filter(name => name > catalogMigration)
    for (const name of remaining) await db.exec(await readFile(new URL(name, directory), 'utf8'))
  } })
  try {
    const source = await readFile(component, 'utf8'), fixed = loadOptions(source)
    assert.equal(source.split('\n      created_at,\n').length, 2)
    const historical = loadOptions(source.replace('\n      created_at,\n', '\n'))
    const rows = []
    for (let i = 0; i < 36; i++) {
      const id = randomUUID(), merchant = i % 2 ? 'Orchard' : 'متجر مستقل'
      const row = { id, title: `${merchant} fixture ${i}`, slug: `native-procurement-${i}`, sku: `NATIVE-${i}`, created_at: new Date(Date.UTC(2024, 0, i + 1)).toISOString() }
      await f.db.query(`insert into public.products(id,title,slug,sku,created_at,is_serialized,is_published,primary_warehouse_id,price)
        values($1,$2,$3,$4,$5,true,$6,$7,125.50)`, [id, row.title, row.slug, row.sku, row.created_at, i !== 35, f.warehouse])
      rows.unshift(row)
    }
    const newest = rows[0]
    await f.db.query("insert into public.product_variants(product_id,name,code,is_active) values($1,'Z inactive','NATIVE-INACTIVE',false),($1,'A active','NATIVE-ACTIVE',true)", [newest.id])
    const client = actor => new PostgrestClient(f.url, { headers: actor ? { authorization: 'Bearer ' + f.token(actor) } : {} })
    const run = async (actor, search = '', retained = [], items = [], loader = fixed) => {
      const options = { value: retained }
      await loader(client(actor), { value: search }, { value: items }, options)
      return options.value
    }
    const snapshot = async () => {
      const result = {}
      for (const table of ['products', 'product_variants', 'admin_users', 'commerce_warehouses', 'customer_orders', 'commerce_serialized_units', 'commerce_inventory_movements']) {
        result[table] = (await f.db.query('select to_jsonb(t) value from public.' + table + ' t order by to_jsonb(t)::text')).rows
      }
      return result
    }
    const before = await snapshot()

    await t.test('original projection reproduces 42703 on the real RPC plan', async () => {
      await assert.rejects(() => run('owner', '', [], [], historical), error => error.code === '42703' && error.message.includes('created_at'))
    })
    await t.test('owner gets the newest 30 serialized products and active embedded options', async () => {
      const actual = await run('owner')
      assert.equal(actual.length, 30)
      assert.deepEqual(actual.map(p => p.id), rows.slice(0, 30).map(p => p.id))
      assert.deepEqual(actual.map(p => new Date(p.created_at).toISOString()), rows.slice(0, 30).map(p => p.created_at))
      assert.ok(!actual.some(p => [f.published, f.draft].includes(p.id)), 'Nonserialized products stay excluded')
      assert.ok(actual[0].variants.some(v => v.code === 'NATIVE-ACTIVE'))
      assert.ok(actual[0].variants.every(v => v.is_active))
      const names = actual[0].variants.map(v => v.name)
      assert.deepEqual(names, [...names].sort((a, b) => String(a || '').localeCompare(String(b || ''))))
      assert.ok(!Object.hasOwn(actual[0], 'cost_price'))
      assert.ok(actual[0].variants.every(v => !Object.hasOwn(v, 'cost_price')))
    })
    await t.test('existing title, SKU and slug search survives for independent store data', async () => {
      for (const query of [rows[0].title, rows[0].sku, rows[0].slug, rows[1].title]) {
        const actual = await run('owner', query)
        assert.ok(actual.length > 0 && actual.length <= 30)
        assert.ok(actual.every(p => [p.title, p.sku, p.slug].some(v => String(v).toLowerCase().includes(query.toLowerCase()))))
      }
    })
    await t.test('selected products remain retained when a bounded search excludes them', async () => {
      const selected = { ...rows.at(-1), variants: [] }
      const actual = await run('owner', newest.sku, [selected], [{ product_id: selected.id }])
      assert.deepEqual(actual.map(p => p.id), [selected.id, newest.id])
    })
    await t.test('existing products.view draft scope and commerce published scope stay intact', async () => {
      assert.ok((await run('editor')).some(p => p.id === newest.id))
      const commerce = await run('commerce')
      assert.equal(commerce.length, 30)
      assert.ok(!commerce.some(p => p.id === newest.id))
      assert.deepEqual(commerce.map(p => p.id), rows.slice(1, 31).map(p => p.id))
    })
    for (const actor of [null, 'customer', 'inactive']) await t.test((actor || 'anonymous') + ' remains denied by existing staff RPC authorization', async () => {
      await assert.rejects(() => run(actor), error => error.code === '42501')
    })
    await t.test('all RPC reads leave catalog, permissions and business rows unchanged', async () => {
      assert.deepEqual(await snapshot(), before)
    })
  } finally { await f.close() }
})
