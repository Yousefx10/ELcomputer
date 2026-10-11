import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createResetDatabase } from './resetDatabase.mjs'

export const catalogMigration = '20261011120000_catalog_confidentiality.sql'
export const confidentialColumns = { products: ['cost_price', 'default_supplier_id', 'primary_warehouse_id'], product_variants: ['cost_price'] }
export const correctedTables = ['brands', 'categories', 'product_images', 'product_specifications', 'products', 'site_hero_banners', 'site_links', 'site_settings', 'site_top_bar_messages']
export const migrateCatalog = async db => db.exec(await readFile(new URL('../../supabase/migrations/' + catalogMigration, import.meta.url), 'utf8'))

// Reproduce the reviewed correction in disposable fixtures, never execute its
// production approval/baseline guards or open any external connection.
export const reproduceCatalogCorrection = async db => {
  const original = await readFile(new URL('../../docs/security/20261010-nine-table-correction.sql', import.meta.url), 'utf8')
  const policies = (await db.query("select tablename,policyname from pg_policies where schemaname='public' and tablename=any($1)", [correctedTables])).rows
  for (const p of policies) await db.exec(`drop policy "${p.policyname}" on public."${p.tablename}"`)
  await db.exec(original.match(/CREATE POLICY[^;]+;/g).join('\n'))
  for (const table of correctedTables) await db.exec(`alter table public.${table} enable row level security; revoke all on public.${table} from public,anon,authenticated; grant select on public.${table} to anon; grant select,insert,update,delete on public.${table} to authenticated`)
}

export const createCatalogFixture = async ({ database = null } = {}) => {
  const db = database || await createResetDatabase({ stopBefore: catalogMigration })
  // The schema-only reference omits hosted Supabase's existing role grants.
  // Match the reviewed effective baseline before testing role-switched reads.
  await db.exec('grant select on public.admin_users to authenticated; grant all on public.products to service_role; grant select on public.product_variants to service_role')
  const actors = Object.fromEntries(['customer', 'owner', 'editor', 'commerce', 'inactive'].map(key => [key, randomUUID()]))
  for (const [name, id] of Object.entries(actors)) {
    await db.query('insert into auth.users(id,email) values($1,$2)', [id, name + '@catalog.example.invalid'])
    if (name === 'customer') continue
    await db.query('insert into public.admin_users(id,email,role,permissions,is_active) values($1,$2,$3,$4,$5)', [id, name + '@catalog.example.invalid', name === 'owner' ? 'owner' : 'admin', JSON.stringify(name === 'editor' ? { 'products.view': true, 'products.add': true, 'products.edit': true } : {}), name !== 'inactive'])
  }
  const warehouse = randomUUID(), supplier = randomUUID(), published = randomUUID(), draft = randomUUID()
  await db.query("insert into public.commerce_warehouses(id,name) values($1,'Private catalog warehouse')", [warehouse])
  await db.query("insert into public.commerce_crm_accounts(id,account_type,name) values($1,'supplier','Private catalog supplier')", [supplier])
  await db.exec("select set_config('app.serialized_inventory_write','on',false)")
  for (const [id, isPublished] of [[published, true], [draft, false]]) {
    await db.query("insert into public.products(id,title,slug,price,cost_price,primary_warehouse_id,default_supplier_id,is_published,is_serialized,stock_quantity) values($1::uuid,'Catalog fixture',$1::uuid::text,125.5,991.37,$2,$3,$4,false,8)", [id, warehouse, supplier, isPublished])
    await db.query('update public.product_variants set cost_price=882.43,stock_quantity=8 where product_id=$1', [id])
  }
  await db.exec("select set_config('app.serialized_inventory_write','',false)")
  const variants = (await db.query('select id,product_id from public.product_variants where product_id=any($1)', [[published, draft]])).rows
  const variant = variants.find(v => v.product_id === published).id
  await db.query("insert into public.product_images(product_id,variant_id,image_url) values($1,$2,'/images/catalog-fixture.webp')", [published, variant])
  await db.query("insert into public.product_specifications(product_id,label,value) values($1,'Fixture specification','Public fixture')", [published])
  // A historical order proves the migration does not rewrite business data.
  await db.query("insert into public.customer_orders(order_number,first_name,phone,street_address,city,governorate) values('CATALOG-HISTORICAL','Synthetic','100','Fixture','Fixture','Fixture')")
  const asRole = async (role, actor, action) => {
    await db.exec('begin')
    try {
      await db.exec('set local role ' + role)
      await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)", [actor || '', role])
      return await action()
    } finally { await db.exec('rollback') }
  }
  return { db, actors, warehouse, supplier, published, draft, variant, asRole }
}

export const catalogDataSnapshot = async db => {
  const names = (await db.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows
  return Object.fromEntries(await Promise.all(names.map(async ({ tablename }) => [tablename, (await db.query('select to_jsonb(t) as row from public.' + tablename + ' t order by to_jsonb(t)::text')).rows])))
}
