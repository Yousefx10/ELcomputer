import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createResetDatabase } from './helpers/resetDatabase.mjs'

test('populated ownership migration preserves records and existing Daftra invoice mappings',async()=>{
  const migration='20261003120000_erp_ownership.sql'
  const db=await createResetDatabase({stopBefore:migration})
  try {
    const local=randomUUID(),external=randomUUID(),product=randomUUID()
    await db.query(`select set_config('request.jwt.claim.role','service_role',false)`)
    await db.query(`select set_config('app.serialized_inventory_write','on',false)`)
    await db.query(`insert into public.site_settings(key,erp_mode) values('default','built_in') on conflict(key) do update set erp_mode='built_in'`)
    await db.query(`insert into public.products(id,title,slug,is_serialized,stock_quantity,cost_price,price) values($1,'Retained product',($1::uuid)::text,false,7,40,100)`,[product])
    await db.query(`insert into public.customer_orders(id,first_name,phone,street_address,city,governorate) values($1,'Local','100','Street','Cairo','Cairo'),($2,'External','100','Street','Cairo','Cairo')`,[local,external])
    await db.query(`insert into public.erp_entity_links(provider,local_entity_type,local_id,external_entity_type,external_id) values('daftra','customer_order',$1,'invoice','42')`,[external])
    await db.exec(await readFile(new URL(`../supabase/migrations/${migration}`,import.meta.url),'utf8'))
    assert.equal((await db.query(`select erp_owner from public.customer_orders where id=$1`,[local])).rows[0].erp_owner,'built_in')
    assert.equal((await db.query(`select erp_owner from public.customer_orders where id=$1`,[external])).rows[0].erp_owner,'daftra')
    const record=(await db.query(`select title,stock_quantity,cost_price,price from public.products where id=$1`,[product])).rows[0]
    assert.equal(record.title,'Retained product');assert.equal(record.stock_quantity,7);assert.equal(Number(record.cost_price),40);assert.equal(Number(record.price),100)
    assert.equal((await db.query(`select count(*)::int as count from public.erp_sync_jobs`)).rows[0].count,0)
  } finally {await db.close()}
})
