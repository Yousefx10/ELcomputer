import { after, afterEach, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createResetDatabase } from './helpers/resetDatabase.mjs'

let db

const createOrder = async (status = 'pending_payment') => {
  const id = randomUUID()
  await db.query(`
    insert into public.customer_orders (
      id, first_name, phone, street_address, city, governorate, status
    ) values ($1, 'Daftra Test', '100', 'Test Street', 'Cairo', 'Cairo', $2)
  `, [id, status])
  return id
}

before(async () => { db = await createResetDatabase() })
after(async () => { await db?.close() })
beforeEach(async () => {
  await db.exec('begin')
  await db.query(`select set_config('request.jwt.claim.role', 'service_role', true)`)
  await db.query(`select set_config('app.serialized_inventory_write', 'on', true)`)
  await db.exec(`
    delete from public.erp_sync_jobs;
    insert into public.site_settings (key, erp_mode, daftra_connection_status)
    values ('default', 'built_in', 'disconnected')
    on conflict (key) do update set
      erp_mode = excluded.erp_mode,
      daftra_connection_status = excluded.daftra_connection_status;
  `)
})
afterEach(async () => { await db.exec('rollback') })

test('orders queue while Daftra owns ERP, including connection failures', async () => {
  await createOrder()
  assert.equal((await db.query('select count(*)::int as count from public.erp_sync_jobs')).rows[0].count, 0)

  await db.exec(`
    update public.site_settings
    set erp_mode = 'daftra', daftra_connection_status = 'error'
    where key = 'default'
  `)
  const orderId = await createOrder()
  let jobs = (await db.query('select * from public.erp_sync_jobs order by created_at')).rows

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].local_id, orderId)
  assert.equal(jobs[0].operation, 'order.export')

  await db.query('update public.customer_orders set first_name = $1 where id = $2', ['Changed', orderId])
  jobs = (await db.query('select * from public.erp_sync_jobs')).rows
  assert.equal(jobs.length, 1)

  await db.query('update public.customer_orders set status = $1 where id = $2', ['processing', orderId])
  jobs = (await db.query('select * from public.erp_sync_jobs order by created_at')).rows
  assert.equal(jobs.length, 2)
  await db.exec(`update public.site_settings set erp_mode='built_in' where key='default'`)
  await db.query('update public.customer_orders set status=$1 where id=$2',['completed',orderId])
  assert.equal((await db.query('select count(*)::int as count from public.erp_sync_jobs')).rows[0].count,2)
})

const fails = async (action,pattern) => {
  await db.exec('savepoint expected_failure')
  await assert.rejects(action,pattern)
  await db.exec('rollback to savepoint expected_failure')
}
const owner = async () => {
  const id=randomUUID()
  await db.query(`insert into auth.users(id,email) values($1,'erp-owner@test.invalid')`,[id])
  await db.query(`insert into public.admin_users(id,email,role) values($1,'erp-owner@test.invalid','owner')`,[id])
  await db.query(`select set_config('request.jwt.claim.sub',$1,true)`,[id])
  return id
}
const modeVersion=async ()=>(await db.query(`select erp_state_version from public.site_settings where key='default'`)).rows[0].erp_state_version
const changeMode=async (id,mode,choice,review=null)=>(await db.query(`select public.erp_change_mode($1,$2,$3,$4,$5) as value`,[id,mode,await modeVersion(),choice,review])).rows[0].value
const prepareCredentials=async id=>{
  await db.query(`select public.erp_save_daftra_credentials($1,'https://erp-test.daftra.com','test-only-ciphertext',null)`,[id])
  await db.query(`select public.erp_record_daftra_test(1,true,clock_timestamp())`)
}

test('credentials and successful tests do not activate Daftra; switching is audited',async()=>{
  const id=await owner()
  await prepareCredentials(id)
  assert.equal((await db.query(`select erp_mode from public.site_settings where key='default'`)).rows[0].erp_mode,'built_in')
  await fails(()=>db.query(`select public.erp_change_mode($1,'daftra',0,'switch_only',null)`,[id]),/settings changed/)
  await fails(()=>changeMode(id,'daftra','synchronize'),/review is required/)
  await changeMode(id,'daftra','switch_only')
  assert.equal((await db.query('select count(*)::int as count from public.erp_sync_jobs')).rows[0].count,0)
  await db.query(`select public.erp_record_daftra_test(1,false,clock_timestamp())`)
  assert.equal((await db.query(`select erp_mode from public.site_settings where key='default'`)).rows[0].erp_mode,'daftra')
  await changeMode(id,'built_in','without_import')
  const logs=(await db.query(`select metadata from public.admin_activity_logs where action_key='settings.erp.mode-update' order by created_at,id`)).rows
  assert.equal(logs.length,2)
  assert.deepEqual(new Set(logs.map(row=>row.metadata.mode)),new Set(['daftra','built_in']))
  await db.query(`select public.erp_save_daftra_credentials($1,'https://erp-test.daftra.com','test-only-new-ciphertext',null)`,[id])
  await fails(()=>changeMode(id,'daftra','switch_only'),/Test the saved/)
  await fails(()=>db.query(`select public.erp_record_daftra_test(1,true,clock_timestamp())`),/Credentials changed/)
})

test('a reviewed supported switch queues one migration run and preserves history',async()=>{
  const id=await owner()
  const historical=await createOrder()
  await prepareCredentials(id)
  const run=randomUUID()
  await db.query(`insert into public.erp_sync_runs(id,manifest,state_version,actor_id) values($1,'{"operation":"inventory.import","domains":[]}',$2,$3)`,[run,await modeVersion(),id])
  await db.query(`update public.erp_sync_runs set actor_id=null where id=$1`,[run])
  await fails(()=>changeMode(id,'daftra','synchronize',run),/review is required/)
  await db.query(`update public.erp_sync_runs set actor_id=$2,manifest='{}' where id=$1`,[run,id])
  await fails(()=>changeMode(id,'daftra','synchronize',run),/review is required/)
  await db.query(`update public.erp_sync_runs set manifest='{"operation":"inventory.import","domains":[]}' where id=$1`,[run])
  const transition=await changeMode(id,'daftra','synchronize',run)
  assert.equal(transition.syncRunId,run)
  assert.equal((await db.query(`select status from public.erp_sync_runs where id=$1`,[run])).rows[0].status,'queued')
  const jobs=(await db.query('select operation,local_id from public.erp_sync_jobs')).rows
  assert.deepEqual(jobs,[{operation:'inventory.import',local_id:run}])
  assert.equal((await db.query(`select erp_owner from public.customer_orders where id=$1`,[historical])).rows[0].erp_owner,'built_in')
  await fails(()=>db.query(`update public.customer_orders set erp_owner='daftra' where id=$1`,[historical]),/cannot change/)
})

test('leases block switching, recover stale jobs, and reject duplicate finishing',async()=>{
  const id=await owner();await prepareCredentials(id);await changeMode(id,'daftra','switch_only')
  await createOrder()
  const first=(await db.query('select * from public.claim_daftra_sync_job(null)')).rows[0]
  await fails(()=>changeMode(id,'built_in','without_import'),/current ERP job/)
  await db.query(`update public.erp_worker_leases set expires_at=clock_timestamp()-interval '1 second' where provider='daftra'`)
  await fails(()=>db.query(`select public.erp_validate_worker_lease($1)`,[first.lease_token]),/lease was lost/)
  const second=(await db.query('select * from public.claim_daftra_sync_job(null)')).rows[0]
  assert.equal(second.id,first.id);assert.equal(second.attempts,2);assert.notEqual(second.lease_token,first.lease_token)
  await fails(()=>db.query(`select public.erp_finish_daftra_job($1,$2,true,'{}',null,0)`,[first.id,first.lease_token]),/lease was lost/)
  await db.query(`select public.erp_finish_daftra_job($1,$2,false,'{}','Daftra unavailable',60)`,[second.id,second.lease_token])
  assert.equal((await db.query(`select * from public.claim_daftra_sync_job(null)`)).rows.length,0)
  await db.query(`select public.erp_retry_daftra_job($1)`,[second.id])
  assert.equal((await db.query(`select attempts from public.erp_sync_jobs where id=$1`,[second.id])).rows[0].attempts,0)
  await fails(()=>db.query(`select public.erp_retry_daftra_job($1)`,[second.id]),/Only failed/)
  await changeMode(id,'built_in','without_import')
  assert.equal((await db.query('select * from public.claim_daftra_sync_job(null)')).rows.length,0)
})

test('local ERP writes are blocked at database and RPC level while platform content remains editable',async()=>{
  const id=await owner(),product=randomUUID(),warehouse=randomUUID()
  await db.query(`insert into public.commerce_warehouses(id,name) values($1,'Retained warehouse')`,[warehouse])
  await db.query(`insert into public.products(id,title,slug,is_serialized,stock_quantity,cost_price,price) values($1,'Local title',($1::uuid)::text,false,7,40,100)`,[product])
  await db.query(`update public.site_settings set erp_mode='daftra',daftra_connection_status='error' where key='default'`)
  await fails(()=>db.query(`update public.products set stock_quantity=9 where id=$1`,[product]),/managed in Daftra/)
  await fails(()=>db.query(`update public.products set cost_price=50 where id=$1`,[product]),/managed in Daftra/)
  await fails(()=>db.query(`update public.commerce_warehouses set name='Changed' where id=$1`,[warehouse]),/managed in Daftra/)
  await fails(()=>db.query(`insert into public.commerce_crm_accounts(account_type,name) values('supplier','External supplier')`),/managed in Daftra/)
  await fails(()=>db.query(`select public.commerce_create_procurement_order(null,null,null,null,0,'[]')`),/managed in Daftra/)
  await fails(()=>db.query(`select public.commerce_create_sales_order(null,null,null,null,0,'[]')`),/managed in Daftra/)
  await fails(()=>db.query(`select public.treasury_record_supplier_payment(null,1,current_date,null,null)`),/managed in Daftra/)
  await fails(()=>db.query(`select public.system_reset_begin($1,'full',$2)`,[id,randomUUID()]),/managed in Daftra/)
  await db.query(`update public.products set title='Website title',price=120,description='Local content' where id=$1`,[product])
  await db.query(`insert into public.commerce_crm_accounts(account_type,name) values('customer','Website contact')`)
  assert.equal((await db.query(`select stock_quantity,price from public.products where id=$1`,[product])).rows[0].stock_quantity,7)
  await db.query(`update public.site_settings set erp_mode='built_in' where key='default'`)
  await db.query(`update public.commerce_warehouses set name='Built-in warehouse' where id=$1`,[warehouse])
  await db.query(`update public.products set stock_quantity=9 where id=$1`,[product])
})

test('browser clients cannot read connector storage or manufacture provider state',async()=>{
  await owner()
  await db.exec(`grant select,update on public.site_settings to authenticated;grant select on public.admin_users to authenticated;set local role authenticated`)
  await db.query(`select set_config('request.jwt.claim.role','authenticated',true)`)
  await fails(()=>db.query(`update public.site_settings set erp_mode='daftra' where key='default'`),/Use the ERP settings API/)
  await fails(()=>db.query(`select public.erp_record_daftra_test(0,true,clock_timestamp())`),/permission denied/)
  for(const table of ['erp_provider_settings','erp_inventory_cache','erp_remote_writes','erp_stock_reservations','erp_sync_runs']) await fails(()=>db.query(`select * from public.${table}`),/permission denied/)
  await db.exec('reset role')
})

test('authorized built-in procurement, stock, sales and treasury continue to work',async()=>{
  await owner()
  const product=randomUUID(),variant=randomUUID(),saleProduct=randomUUID(),warehouse=randomUUID(),supplier=randomUUID(),customer=randomUUID()
  await db.query(`insert into public.commerce_warehouses(id,name) values($1,'Built-in warehouse')`,[warehouse])
  await db.query(`insert into public.commerce_crm_accounts(id,account_type,name) values($1,'supplier','Local supplier'),($2,'customer','Local customer')`,[supplier,customer])
  await db.query(`insert into public.products(id,title,slug,is_serialized,price,primary_warehouse_id) values($1,'Local product',($1::uuid)::text,true,100,$2)`,[product,warehouse])
  await db.query(`insert into public.product_variants(id,product_id,name,code) values($1,$2,'Local model','LOCAL')`,[variant,product])
  await db.query(`insert into public.products(id,title,slug,is_serialized,price,stock_quantity) values($1,'Legacy product',($1::uuid)::text,false,100,2)`,[saleProduct])
  await db.query(`insert into public.commerce_warehouse_inventory(warehouse_id,product_id,quantity,average_cost) values($1,$2,2,40)`,[warehouse,saleProduct])
  const receipt=(await db.query(`select public.commerce_create_procurement_order($1,$2,'LOCAL-PURCHASE',null,0,$3::jsonb) as id`,[supplier,warehouse,JSON.stringify([{product_id:product,variant_id:variant,quantity:2,unit_cost:40}])])).rows[0].id
  assert.equal((await db.query(`select stock_quantity from public.products where id=$1`,[product])).rows[0].stock_quantity,2)
  await db.query(`select public.treasury_record_supplier_payment($1,30,current_date,'PAY-LOCAL',null)`,[receipt])
  const sale=(await db.query(`select public.commerce_create_sales_order($1,$2,'LOCAL-SALE',null,0,$3::jsonb) as id`,[customer,warehouse,JSON.stringify([{product_id:saleProduct,quantity:1,unit_price:100}])])).rows[0].id
  await db.query(`select public.treasury_record_customer_receipt($1,50,current_date,'RECEIPT-LOCAL',null)`,[sale])
  assert.equal((await db.query(`select stock_quantity from public.products where id=$1`,[saleProduct])).rows[0].stock_quantity,1)
  assert.equal((await db.query(`select count(*)::int as count from public.treasury_transactions`)).rows[0].count,2)
  assert.equal((await db.query(`select count(*)::int as count from public.erp_sync_jobs`)).rows[0].count,0)
})

const checkoutPayload=number=>({order_number:number,first_name:'Buyer',phone:'100',street_address:'Street',city:'Cairo',governorate:'Cairo',email:'buyer@test.invalid',payment_method:'cash'})
const checkout=async(user,product,quantity=1,cart=randomUUID(),variant=null)=>(await db.query(
  `select public.commerce_create_customer_order($1,$2::jsonb,$3::jsonb,false,$4) as value`,
  [user,JSON.stringify(checkoutPayload(`WEB-${cart}`)),JSON.stringify([{product_id:product,variant_id:variant,quantity,unit_price:0.01}]),cart]
)).rows[0].value
const cache=async(product,quantity,cost=60,variant=null)=>db.query(`select public.erp_apply_inventory_cache($1::jsonb,clock_timestamp())`,[
  JSON.stringify([{local_entity_type:variant?'product_variant':'product',local_id:variant || product,product_id:product,external_id:'101',quantity,cost,code:'SKU-TEST'}])
])

test('outage checkout commits once, reserves remote stock and never posts to built-in balances',async()=>{
  const user=await owner(),product=randomUUID(),cart=randomUUID(),warehouse=randomUUID()
  await db.query(`insert into public.commerce_warehouses(id,name) values($1,'Return destination')`,[warehouse])
  await db.query(`insert into public.products(id,title,slug,sku,is_serialized,stock_quantity,cost_price,price) values($1,'Website product',($1::uuid)::text,'SKU-TEST',false,7,40,100)`,[product])
  await db.query(`update public.shipping_provider_settings set is_enabled=true,auto_create_labels=true where id='pdc'`)
  await db.query(`update public.site_settings set erp_mode='daftra',daftra_connection_status='error' where key='default'`)
  await cache(product,3,0)
  assert.equal((await db.query(`select stock_quantity from public.storefront_products where id=$1`,[product])).rows[0].stock_quantity,3)
  const first=await checkout(user,product,2,cart)
  assert.equal(first.created,true);assert.equal(first.order.erp_owner,'daftra');assert.equal(Number(first.order.total_amount),200)
  assert.equal((await checkout(user,product,2,cart)).created,false)
  assert.equal((await db.query(`select count(*)::int as count from public.erp_sync_jobs where local_id=$1`,[first.order.id])).rows[0].count,1)
  await db.query(`update public.customer_orders set status='processing',payment_status='paid',shipping_review_status='approved' where id=$1`,[first.order.id])
  assert.equal((await db.query(`select count(*)::int as count from public.shipping_order_jobs where order_id=$1`,[first.order.id])).rows[0].count,1)
  assert.equal((await db.query(`select stock_quantity from public.storefront_products where id=$1`,[product])).rows[0].stock_quantity,1)
  const retained=(await db.query(`select stock_quantity,cost_price,price,title from public.products where id=$1`,[product])).rows[0]
  assert.equal(retained.stock_quantity,7);assert.equal(Number(retained.cost_price),40);assert.equal(Number(retained.price),100);assert.equal(retained.title,'Website product')
  assert.equal((await db.query(`select cost from public.erp_inventory_cache where local_id=$1`,[product])).rows[0].cost,'0.00')
  await fails(()=>checkout(user,product,2),/Not enough cached/)
  await cache(product,3)
  assert.equal((await db.query(`select stock_quantity from public.storefront_products where id=$1`,[product])).rows[0].stock_quantity,1)
  // An issued invoice and a later clock time do not establish stock posting.
  await db.query(`insert into public.erp_entity_links(provider,local_entity_type,local_id,external_entity_type,external_id,metadata) values('daftra','customer_order',$1,'invoice','201',jsonb_build_object('daftraDraft',false,'issuedAt',clock_timestamp()-interval '1 minute'))`,[first.order.id])
  await cache(product,3)
  assert.equal((await db.query('select count(*)::int as count from public.erp_stock_reservations')).rows[0].count,1)
  await db.query(`update public.erp_entity_links set metadata=metadata||jsonb_build_object('stockVerifiedAt',clock_timestamp()-interval '1 second') where local_id=$1`,[first.order.id])
  await cache(product,1)
  assert.equal((await db.query('select count(*)::int as count from public.erp_stock_reservations')).rows[0].count,0)
  const item=(await db.query(`select id from public.customer_order_items where order_id=$1`,[first.order.id])).rows[0].id
  const rid=(await db.query(`select public.commerce_create_order_return($1,$2,'Customer request',null,$3::jsonb) as value`,[first.order.id,warehouse,JSON.stringify([{order_item_id:item,quantity:1}])])).rows[0].value
  assert.equal((await db.query(`select erp_action_status from public.commerce_order_returns where id=$1`,[rid])).rows[0].erp_action_status,'manual_required')
  await fails(()=>db.query(`update public.commerce_order_returns set erp_action_status='completed' where id=$1`,[rid]),/manually in Daftra/)
  assert.equal((await db.query(`select stock_quantity from public.products where id=$1`,[product])).rows[0].stock_quantity,7)
  await db.query(`update public.site_settings set erp_mode='built_in' where key='default'`)
  assert.equal((await db.query(`select stock_quantity from public.storefront_products where id=$1`,[product])).rows[0].stock_quantity,7)
})

test('serialized checkout assigns physical QR units without changing retained stock or costs',async()=>{
  const user=await owner(),product=randomUUID(),variant=randomUUID(),warehouse=randomUUID(),unit=randomUUID()
  await db.query(`select set_config('app.serialized_inventory_write','on',true)`)
  await db.query(`insert into public.commerce_warehouses(id,name) values($1,'Physical warehouse')`,[warehouse])
  await db.query(`insert into public.products(id,title,slug,is_serialized,primary_warehouse_id,stock_quantity,cost_price,price) values($1,'Phone',($1::uuid)::text,true,$2,1,40,100)`,[product,warehouse])
  await db.query(`insert into public.product_variants(id,product_id,name,code,sku,stock_quantity,cost_price,price) values($1,$2,'Blue','BLUE','SKU-TEST',1,40,999)`,[variant,product])
  await db.query(`insert into public.commerce_warehouse_inventory(warehouse_id,product_id,quantity,average_cost) values($1,$2,1,40)`,[warehouse,product])
  await db.query(`insert into public.commerce_serialized_units(id,unit_code,product_id,variant_id,warehouse_id,unit_cost) values($1,'QR-TEST-1',$2,$3,$4,40)`,[unit,product,variant,warehouse])
  await db.query(`select set_config('app.serialized_inventory_write','off',true)`)
  await db.query(`update public.site_settings set erp_mode='daftra',daftra_connection_status='error' where key='default'`)
  await cache(product,10,60,variant)
  assert.equal((await db.query(`select stock_quantity from public.storefront_product_variants where id=$1`,[variant])).rows[0].stock_quantity,1)
  const order=await checkout(user,product,1,randomUUID(),variant)
  assert.equal(Number(order.order.total_amount),100);assert.equal(order.serialized_units_assigned,1)
  assert.equal((await db.query(`select status from public.commerce_serialized_units where id=$1`,[unit])).rows[0].status,'sold')
  assert.equal((await db.query(`select stock_quantity from public.products where id=$1`,[product])).rows[0].stock_quantity,1)
  assert.equal((await db.query(`select stock_quantity from public.product_variants where id=$1`,[variant])).rows[0].stock_quantity,1)
  assert.equal((await db.query(`select quantity from public.commerce_warehouse_inventory where product_id=$1`,[product])).rows[0].quantity,1)
  assert.equal((await db.query(`select stock_quantity from public.storefront_products where id=$1`,[product])).rows[0].stock_quantity,0)
  const returned=(await db.query(`select public.erp_record_external_unit_return($1,$2,'Customer request',null,$3) as value`,[unit,warehouse,user])).rows[0].value
  assert.equal((await db.query(`select public.erp_record_external_unit_return($1,$2,'Customer request',null,$3) as value`,[unit,warehouse,user])).rows[0].value,returned)
  assert.equal((await db.query(`select status from public.commerce_serialized_units where id=$1`,[unit])).rows[0].status,'sold')
})

test('public stock views respect publication and expose no private remote costs',async()=>{
  await owner()
  const product=randomUUID()
  await db.query(`insert into public.products(id,title,slug,sku,is_serialized,is_published,stock_quantity) values($1,'Private draft',($1::uuid)::text,'SKU-TEST',false,false,7)`,[product])
  await db.query(`update public.site_settings set erp_mode='daftra' where key='default'`)
  await cache(product,4,123)
  assert.equal((await db.query(`select stock_quantity from public.storefront_products where id=$1`,[product])).rows[0].stock_quantity,4)
  await db.exec(`grant select on public.products,public.product_variants,public.admin_users to anon;set local role anon`)
  await db.query(`select set_config('request.jwt.claim.role','anon',true)`)
  await db.query(`select set_config('request.jwt.claim.sub','',true)`)
  assert.equal((await db.query(`select * from public.storefront_products where id=$1`,[product])).rows.length,0)
  assert.equal((await db.query(`select public.erp_storefront_stock('product',$1,7) as quantity`,[product])).rows[0].quantity,0)
  await fails(()=>db.query(`select cost from public.erp_inventory_cache`),/permission denied/)
  await db.exec('reset role')
})

test('missing ERP settings fail closed', async () => {
  await db.exec(`delete from public.site_settings where key = 'default'`)
  await createOrder()
  assert.equal((await db.query('select count(*)::int as count from public.erp_sync_jobs')).rows[0].count, 0)
})

test('claiming a job is atomic and increments attempts', async () => {
  await db.exec(`
    update public.site_settings
    set erp_mode = 'daftra', daftra_connection_status = 'connected'
    where key = 'default'
  `)
  await createOrder()

  const claimed = (await db.query('select * from public.claim_daftra_sync_job(null)')).rows
  assert.equal(claimed.length, 1)
  assert.equal(claimed[0].status, 'processing')
  assert.equal(claimed[0].attempts, 1)
  assert.equal((await db.query('select count(*)::int as count from public.claim_daftra_sync_job(null)')).rows[0].count, 0)
})

test('ERP credentials use a private provider settings table', async () => {
  await db.query(`
    insert into public.erp_provider_settings (
      id, account_url, api_key_encrypted, client_id_encrypted
    ) values ('daftra', 'https://example.daftra.com', 'encrypted-key', 'encrypted-client')
  `)

  const settings = (await db.query(`
    select id, account_url, api_key_encrypted, client_id_encrypted
    from public.erp_provider_settings
    where id = 'daftra'
  `)).rows[0]

  assert.equal(settings.id, 'daftra')
  assert.equal(settings.account_url, 'https://example.daftra.com')
  assert.equal(settings.api_key_encrypted, 'encrypted-key')
})
