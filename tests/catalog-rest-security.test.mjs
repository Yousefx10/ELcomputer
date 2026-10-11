import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createCatalogRestFixture } from './helpers/catalogRestFixture.mjs'
import { emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'
import { confidentialColumns } from './helpers/catalogFixture.mjs'

test('actual PostgREST catalog ACLs, invoker views, embeddings, staff RPCs and writes', { skip: !emailNativeAvailable || !process.env.CATALOG_REVIEW_POSTGREST_BIN, timeout: 60000 }, async t => {
  const f = await createCatalogRestFixture()
  try {
    for (const actor of [null, 'customer', 'inactive']) await t.test((actor || 'anonymous') + ' cannot retrieve internal catalog values through REST', async () => {
      for (const [table, columns] of Object.entries(confidentialColumns)) {
        const star = await f.request('/' + table + '?select=*', { actor })
        // Servers may reject wildcard reads or omit inaccessible fields. Both
        // are safe; explicit column/filter requests must fail in every case.
        if (star.status < 300) for (const row of star.body) for (const c of columns) assert.ok(!Object.hasOwn(row, c))
        else assert.ok([401, 403].includes(star.status))
        for (const column of columns) for (const suffix of ['?select=id,' + column, '?select=id&' + column + '=not.is.null']) {
          const denied = await f.request('/' + table + suffix, { actor })
          assert.ok([401, 403].includes(denied.status), JSON.stringify(denied))
          assert.equal(denied.body.code, '42501')
        }
      }
      for (const rpc of ['catalog_staff_products', 'catalog_staff_product_variants']) assert.ok([401, 403, 404].includes((await f.request('/rpc/' + rpc, { actor, method: 'POST', body: {} })).status))
      for (const view of ['storefront_products', 'storefront_product_variants']) {
        const result = await f.request('/' + view + '?select=*', { actor })
        assert.equal(result.status, 200)
        assert.equal(result.body.length, 1)
        for (const row of result.body) for (const c of ['cost_price', 'default_supplier_id', 'primary_warehouse_id']) assert.ok(!Object.hasOwn(row, c))
        assert.equal((await f.request('/' + view + '?select=cost_price', { actor })).status, 400)
      }
      const embedded = await f.request('/storefront_products?select=id,price,stock_quantity,storefront_product_variants(id,name,sku,color_name,stock_quantity),category:categories(id,name,slug)', { actor })
      assert.equal(embedded.status, 200, JSON.stringify(embedded))
      assert.equal(embedded.body[0].storefront_product_variants[0].id, f.variant)
      assert.equal(embedded.body[0].price, 125.5)
      assert.equal((await f.request('/products?select=id&is_published=eq.false', { actor })).body.length, 0)
      assert.equal((await f.request('/product_images?select=id,product_id,variant_id', { actor })).status, 200)
      assert.equal((await f.request('/product_specifications?select=id,label,value', { actor })).status, 200)
      const nestedSecret = await f.request('/storefront_products?select=id,product_variants(cost_price)', { actor })
      assert.ok([401, 403].includes(nestedSecret.status), JSON.stringify(nestedSecret))
      const write = await f.request('/products?id=eq.' + f.published, { actor, method: 'PATCH', body: { title: 'Unauthorized change' } })
      assert.ok([204, 401, 403].includes(write.status))
      assert.equal((await f.db.query('select title from public.products where id=$1', [f.published])).rows[0].title, 'Catalog fixture')
    })
    for (const actor of ['owner', 'editor', 'commerce']) await t.test(actor + ' retains filtered RPC reads and PostgREST FK embedding', async () => {
      const result = await f.request('/rpc/catalog_staff_products?select=*,product_variants(id,name,code,sku,is_active)&order=created_at.desc&limit=30', { actor, method: 'POST', body: {} })
      assert.equal(result.status, 200, JSON.stringify(result))
      assert.equal(result.body.length, actor === 'commerce' ? 1 : 2)
      for (const row of result.body) {
        assert.equal(row.cost_price, 991.37)
        assert.equal(row.primary_warehouse_id, f.warehouse)
        assert.equal(row.default_supplier_id, f.supplier)
        assert.equal(row.product_variants.length, 1)
      }
      const variants = await f.request('/rpc/catalog_staff_product_variants?select=*&product_id=eq.' + f.published + '&is_active=eq.true&order=name.asc,id.asc', { actor, method: 'POST', body: {} })
      assert.equal(variants.status, 200)
      assert.equal(variants.body[0].cost_price, 882.43)
    })
    await t.test('authorized Dashboard product editing and canonical inventory costs remain compatible', async () => {
      const edit = await f.request('/products?id=eq.' + f.draft, { actor: 'editor', method: 'PATCH', body: { title: 'Staff edited draft' } })
      assert.equal(edit.status, 204)
      const result = await f.request('/rpc/catalog_staff_products?id=eq.' + f.draft, { actor: 'editor', method: 'POST', body: {} })
      assert.equal(result.body[0].title, 'Staff edited draft')
      assert.equal(result.body[0].cost_price, 991.37)
    })
    await t.test('existing staff procurement RPC still receives physical inventory and projects private costs', async () => {
      const product = randomUUID()
      await f.db.query("insert into public.products(id,title,slug,is_serialized,primary_warehouse_id,price) values($1::uuid,'Synthetic received product',$1::uuid::text,true,$2,150)", [product, f.warehouse])
      const variant = (await f.db.query('select id from public.product_variants where product_id=$1', [product])).rows[0].id
      const receipt = await f.request('/rpc/commerce_create_procurement_order', { actor: 'commerce', method: 'POST', body: {
        p_supplier_id: f.supplier, p_warehouse_id: f.warehouse, p_invoice_number: 'CATALOG-LOCAL-RECEIPT', p_notes: null, p_paid_amount: 0,
        p_items: [{ product_id: product, variant_id: variant, quantity: 2, unit_cost: 49.5 }]
      } })
      assert.equal(receipt.status, 200, JSON.stringify(receipt))
      assert.equal((await f.db.query('select count(*)::int n from public.commerce_serialized_units where product_id=$1', [product])).rows[0].n, 2)
      const staff = await f.request('/rpc/catalog_staff_products?id=eq.' + product, { actor: 'commerce', method: 'POST', body: {} })
      assert.equal(staff.body[0].cost_price, 49.5)
      assert.equal(staff.body[0].stock_quantity, 2)
      assert.equal((await f.request('/products?select=id,cost_price&id=eq.' + product, { actor: 'customer' })).status, 403)
    })
    await t.test('staff revocation takes effect without changing database grants or cached tokens', async () => {
      await f.db.query('update public.admin_users set is_active=false where id=$1', [f.actors.editor])
      for (const rpc of ['catalog_staff_products', 'catalog_staff_product_variants']) {
        const denied = await f.request('/rpc/' + rpc, { actor: 'editor', method: 'POST', body: {} })
        assert.equal(denied.status, 403)
        assert.equal(denied.body.code, '42501')
      }
    })
  } finally { await f.close() }
})
