import { randomUUID } from 'node:crypto'
import { createResetDatabase } from './resetDatabase.mjs'
import { smsDatabaseClient } from './smsDatabase.mjs'
import { saveProduct } from '../../server/utils/productSave.js'

export const productSaveMigration = '20261013120000_atomic_product_saves.sql'
export async function createProductSaveFixture({ database, ...options } = {}) {
  const db = database || await createResetDatabase(options)
  const client = smsDatabaseClient(db)
  const actors = Object.fromEntries(['owner', 'editor', 'viewer', 'disabled', 'customer'].map(key => [key, randomUUID()]))
  await db.exec("select set_config('request.jwt.claim.role','service_role',false)")
  await db.exec("insert into public.site_settings(key) values('default') on conflict(key) do nothing")
  for (const [name, id] of Object.entries(actors)) {
    await db.query('insert into auth.users(id,email) values($1,$2)', [id, name + '@product-save.example.invalid'])
    if (name === 'customer') continue
    const permissions = { 'products.view': true, ...(name === 'editor' ? { 'products.add': true, 'products.edit': true } : {}) }
    await db.query('insert into public.admin_users(id,email,role,permissions,is_active) values($1,$2,$3,$4,$5)',
      [id, name + '@product-save.example.invalid', name === 'owner' ? 'owner' : 'admin', JSON.stringify(permissions), name !== 'disabled'])
  }
  const warehouse = randomUUID(), otherWarehouse = randomUUID(), supplier = randomUUID(), category = randomUUID(), brand = randomUUID()
  await db.query("insert into public.commerce_warehouses(id,name,is_active) values($1,'Save warehouse',true),($2,'Other warehouse',true)", [warehouse, otherWarehouse])
  await db.query("insert into public.commerce_crm_accounts(id,name,account_type,is_active) values($1,'Save supplier','supplier',true)", [supplier])
  await db.query("insert into public.categories(id,name,slug) values($1,'Save category','save-category')", [category])
  await db.query("insert into public.brands(id,name,slug) values($1,'Save brand','save-brand')", [brand])
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actors.owner])
  const body = overrides => ({
    request_id: randomUUID(), title: 'Product save fixture', slug: 'save-' + randomUUID(),
    price: '125.50', old_price: '', is_serialized: true, is_published: false,
    primary_warehouse_id: warehouse, default_supplier_id: supplier, category_id: category, brand_id: brand,
    sku: 'PRODUCT-' + randomUUID(), variants: [{ name: 'Default', code: 'DEFAULT', sku: 'OPTION-' + randomUUID() }],
    ...overrides
  })
  const save = (input, { actor = 'owner', operation = 'create', id = null, transport = client } = {}) =>
    saveProduct(transport, { id: actors[actor] }, input, operation, id)
  const snapshot = async id => {
    const { data, error } = await client.rpc('catalog_product_edit_snapshot', { p_admin_id: actors.owner, p_product_id: id })
    if (error) throw Error(error.message)
    return data
  }
  const counts = async () => (await db.query(`select
    (select count(*)::int from public.products) products,
    (select count(*)::int from public.product_variants) variants,
    (select count(*)::int from public.admin_activity_logs where action_key in ('products.create','products.update')) audits,
    (select count(*)::int from catalog_private.product_save_receipts) receipts`)).rows[0]
  return { db, client, actors, warehouse, otherWarehouse, supplier, category, brand, body, save, snapshot, counts }
}
