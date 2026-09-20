import { before, after, beforeEach, afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createResetDatabase } from './helpers/resetDatabase.mjs'
import { systemResetScopes } from '../server/utils/systemResetScopes.js'

let db, owner, customer
const value = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value
const beginReset = (scope, id = randomUUID()) => value('select public.system_reset_begin($1,$2,$3) as value', [owner, scope, id])
const finishReset = (id) => value('select public.system_reset_finish($1,$2) as value', [owner, id])
const count = (table) => value(`select count(*)::int as value from public.${table}`)
const fails = async (action, pattern) => {
  await db.exec('savepoint expected_failure')
  await assert.rejects(action, pattern)
  await db.exec('rollback to savepoint expected_failure')
}
const seedProduct = async (serialized = true) => {
  const id = randomUUID(), warehouse = randomUUID()
  await db.query(`insert into public.commerce_warehouses(id,name) values($1,'Product warehouse')`, [warehouse])
  await db.query(`insert into public.products(id,title,slug,is_serialized,image_url,primary_warehouse_id) values ($1,'Keyboard',$2,$3,'/uploads/products/keyboard.png',$4)`, [id, id, serialized, warehouse])
  return id
}
const seedOrder = async (productId) => {
  const id = randomUUID(), itemId = randomUUID()
  await db.query(`insert into public.customer_orders(id,user_id,first_name,phone,street_address,city,governorate) values($1,$2,'Buyer','123','Street','Cairo','Cairo')`, [id,customer])
  await db.query(`insert into public.customer_order_items(id,order_id,product_id,product_title,image_url,quantity) values($1,$2,$3,'Keyboard','/uploads/products/keyboard.png',1)`, [itemId,id,productId])
  return {id,itemId}
}

before(async () => { db = await createResetDatabase() })
after(async () => { await db?.close() })
beforeEach(async () => {
  owner=randomUUID();customer=randomUUID()
  await db.exec('begin')
  await db.query(`select set_config('request.jwt.claim.role','service_role',true)`)
  await db.query(`insert into auth.users(id,email,created_at) values($1,'owner@test.invalid',now()-interval '1 year'),($2,'customer@test.invalid',now()-interval '1 year')`, [owner,customer])
  await db.query(`insert into public.admin_users(id,email,full_name,role) values($1,'owner@test.invalid','Test Owner','owner')`, [owner])
})
afterEach(async () => { await db.exec('rollback') })

test('database reset scopes match the server allowlist', async () => {
  for(const scope of systemResetScopes) {
    assert.deepEqual(await value('select public.system_reset_tables($1) as value', [scope.key]), scope.tables)
  }
})

test('public clients and non-owners cannot call the destructive function', async () => {
  await db.exec('set local role authenticated')
  await fails(() => beginReset('full'), /permission denied/)
  await db.exec('reset role')
  await db.query(`select set_config('request.jwt.claim.role','authenticated',true)`)
  await fails(() => beginReset('full'), /Server authorization/)
  await db.query(`select set_config('request.jwt.claim.role','service_role',true)`)
  await db.query(`update public.admin_users set role='admin' where id=$1`, [owner])
  await fails(() => beginReset('full'), /Active owner/)
})

test('password attempt throttling is stored in PostgreSQL', async () => {
  for(let index=0; index<5; index++) assert.equal(await value('select public.system_reset_check_attempt($1) as value',[owner]),true)
  assert.equal(await value('select public.system_reset_check_attempt($1) as value',[owner]),false)
})

test('orders reset preserves products, customers and old logs; completion appends exactly once', async () => {
  const product = await seedProduct()
  await seedOrder(product)
  await db.query(`insert into public.admin_activity_logs(author_name,author_email,description) values('Earlier','earlier@test.invalid','Existing entry')`)
  const run = await beginReset('orders')
  assert.equal(await count('customer_orders'),0)
  assert.equal(await count('customer_order_items'),0)
  assert.equal(await count('products'),1)
  assert.equal(await count('admin_activity_logs'),1)
  assert.equal(run.status,'cleanup_pending')
  await finishReset(run.id)
  await finishReset(run.id)
  assert.equal(await count('admin_activity_logs'),2)
  const log = await value(`select to_jsonb(l) as value from public.admin_activity_logs l where action_key='settings.system_reset.completed'`)
  assert.equal(log.admin_user_id,owner)
  assert.equal(log.author_name,'Test Owner')
  assert.equal(log.metadata.scope,'orders')
  // Replaying a completed request must not erase new orders.
  await seedOrder(product)
  await beginReset('orders',run.id)
  assert.equal(await count('customer_orders'),1)
})

test('pending cleanup blocks other resets without deleting new data', async () => {
  await beginReset('documents')
  await seedProduct()
  await fails(() => beginReset('products'), /Finish the pending reset/)
  assert.equal(await count('products'),1)
})

test('a failed completion log leaves the reset pending and can be retried', async () => {
  const run = await beginReset('documents')
  await db.exec(`create function public.test_reject_reset_log() returns trigger language plpgsql as $$ begin raise exception 'log write failed'; end; $$;
    create trigger reset_log_failure before insert on public.admin_activity_logs for each statement execute function public.test_reject_reset_log();`)
  await fails(() => finishReset(run.id), /log write failed/)
  assert.equal(await value('select status as value from public.system_reset_runs where id=$1', [run.id]), 'cleanup_pending')
  assert.equal(await count('admin_activity_logs'), 0)
  await db.exec('drop trigger reset_log_failure on public.admin_activity_logs')
  await finishReset(run.id)
  assert.equal(await value('select status as value from public.system_reset_runs where id=$1', [run.id]), 'completed')
  assert.equal(await count('admin_activity_logs'), 1)
})

test('serialized order dependencies block orders reset and commerce reset clears them atomically', async () => {
  const product = await seedProduct(true)
  const order = await seedOrder(product)
  const warehouse=randomUUID(),unit=randomUUID()
  const variant = await value('select id as value from public.product_variants where product_id=$1',[product])
  await db.query(`insert into public.commerce_warehouses(id,name) values($1,'Main')`,[warehouse])
  await db.query(`insert into public.commerce_serialized_units(id,unit_code,product_id,variant_id,warehouse_id,status,customer_order_id,customer_order_item_id,sold_at) values($1,'TEST-001',$2,$3,$4,'sold',$5,$6,now())`,[unit,product,variant,warehouse,order.id,order.itemId])
  await db.query(`insert into public.commerce_serialized_unit_movements(unit_id,product_id,variant_id,warehouse_id,movement_type,to_status,customer_order_id) values($1,$2,$3,$4,'sold','sold',$5)`,[unit,product,variant,warehouse,order.id])
  const plan = await value('select public.system_reset_plan($1,$2) as value',[owner,'orders'])
  assert.ok(plan.blockers.some(blocker=>blocker.table==='commerce_serialized_units'))
  await fails(() => beginReset('orders'), /Linked records/)
  assert.equal(await count('customer_orders'),1)
  const run=await beginReset('commerce')
  assert.equal(await count('customer_orders'),0)
  assert.equal(await count('commerce_serialized_units'),0)
  assert.equal(await count('commerce_serialized_unit_movements'),0)
  assert.equal(await count('products'),1)
  assert.equal(await value('select stock_quantity as value from public.products where id=$1',[product]),0)
  const trigger = await value(`select tgenabled as value from pg_trigger where tgname='commerce_serialized_movements_immutable_rows'`)
  assert.equal(trigger,'O')
  await finishReset(run.id)
})

test('product reset preserves historical order snapshots and clears the catalog', async () => {
  const product=await seedProduct()
  const order=await seedOrder(product)
  await beginReset('products')
  assert.equal(await count('products'),0)
  assert.equal(await count('customer_orders'),1)
  const item=await value('select to_jsonb(i) as value from public.customer_order_items i where id=$1',[order.itemId])
  assert.equal(item.product_id,null)
  assert.equal(item.product_title,'Keyboard')
})

test('media reset clears uploaded references but preserves external images and products', async () => {
  const product=await seedProduct()
  const external=await seedProduct()
  await db.query(`update public.products set image_url='https://example.test/image.png' where id=$1`,[external])
  await beginReset('media')
  assert.equal(await count('products'),2)
  assert.equal(await value('select image_url as value from public.products where id=$1',[product]),'')
  assert.equal(await value('select image_url as value from public.products where id=$1',[external]),'https://example.test/image.png')
})

test('documents reset clears quick access and recent files', async () => {
  const folder = randomUUID(), document = randomUUID(), tag = randomUUID()
  await db.query(`insert into public.document_folders(id,name,created_by) values($1,'Pinned folder',$2)`, [folder, owner])
  await db.query(`insert into public.documents(id,folder_id,name,storage_path,created_by) values($1,$2,'Recent.pdf',$3,$4)`, [document, folder, `${folder}/recent.pdf`, owner])
  await db.query(`insert into public.document_quick_access(admin_user_id,folder_id) values($1,$2)`, [owner, folder])
  await db.query(`insert into public.document_recent_items(admin_user_id,document_id) values($1,$2)`, [owner, document])
  await db.query(`insert into public.document_tags(id,name,created_by) values($1,'Finance',$2)`, [tag, owner])
  await db.query(`insert into public.document_file_tags(document_id,tag_id,added_by) values($1,$2,$3)`, [document, tag, owner])
  await db.query(`insert into public.document_folder_tags(folder_id,tag_id,added_by) values($1,$2,$3)`, [folder, tag, owner])
  await beginReset('documents')
  assert.equal(await count('document_file_tags'), 0)
  assert.equal(await count('document_folder_tags'), 0)
  assert.equal(await count('document_tags'), 0)
  assert.equal(await count('document_quick_access'), 0)
  assert.equal(await count('document_recent_items'), 0)
  assert.equal(await count('documents'), 0)
  assert.equal(await count('document_folders'), 0)
})

test('document tags replace atomically', async () => {
  const document = randomUUID(), firstTag = randomUUID(), secondTag = randomUUID()
  await db.query(`insert into public.documents(id,name,storage_path,created_by) values($1,'Tagged.pdf',$2,$3)`, [document, `${document}.pdf`, owner])
  await db.query(`insert into public.document_tags(id,name,created_by) values($1,'Finance',$3),($2,'Signed',$3)`, [firstTag, secondTag, owner])
  await db.query(`select public.document_set_item_tags('file',$1,$2::uuid[],$3)`, [document, [firstTag], owner])
  assert.deepEqual(await value(`select array_agg(tag_id order by tag_id)::text[] as value from public.document_file_tags where document_id=$1`, [document]), [firstTag])
  await db.query(`select public.document_set_item_tags('file',$1,$2::uuid[],$3)`, [document, [secondTag], owner])
  assert.deepEqual(await value(`select array_agg(tag_id order by tag_id)::text[] as value from public.document_file_tags where document_id=$1`, [document]), [secondTag])

  await fails(
    () => db.query(`select public.document_set_item_tags('file',$1,$2::uuid[],$3)`, [document, [randomUUID()], owner]),
    /foreign key/
  )
  assert.deepEqual(await value(`select array_agg(tag_id order by tag_id)::text[] as value from public.document_file_tags where document_id=$1`, [document]), [secondTag])
})

test('content reset erases custom pages and preserves catalog data', async () => {
  await seedProduct()
  await db.query(`insert into public.site_pages(title,path,is_published) values('Store policy','store-policy',true)`)
  await beginReset('content')
  assert.equal(await count('site_pages'), 0)
  assert.equal(await count('products'), 1)
})

test('content reset removes Help Center content without removing customer tickets', async () => {
  const category = await value("select id as value from public.help_categories where slug='orders'")
  await db.query("insert into public.help_articles(category_id,title,slug,status) values($1,'Order help','order-help','published')", [category])
  const ticket = await value("select public.support_create_ticket($1,null,$2,'Order issue','Please help',$3) as value", [customer, category, randomUUID()])
  const chat = await value(`insert into public.chat_conversations(customer_id,contact_name,contact_email,creation_key)
    values($1,'Customer','customer@test.invalid',$2) returning id as value`, [customer, randomUUID()])
  await beginReset('content')
  assert.equal(await count('help_articles'), 0)
  assert.equal(await count('help_categories'), 0)
  assert.equal(await count('support_tickets'), 1)
  assert.equal(await value('select category_id as value from public.support_tickets where id=$1', [ticket]), null)
  assert.equal(await value('select id as value from public.chat_conversations where id=$1', [chat]), chat)
  assert.equal(await count('chat_settings'), 1)
})

test('full reset captures private support and chat objects and clears their rows', async () => {
  const ticket = await value("select public.support_create_ticket($1,null,null,'File issue','Please help',$2) as value", [customer, randomUUID()])
  const message = await value('select id as value from public.support_ticket_messages where ticket_id=$1', [ticket])
  const path = `${ticket}/${message}/evidence.pdf`
  await db.query("insert into storage.objects(bucket_id,name) values('support-attachments',$1)", [path])
  await db.query("insert into public.support_ticket_attachments(ticket_id,message_id,original_name,storage_path,mime_type,size_bytes) values($1,$2,'evidence.pdf',$3,'application/pdf',100)", [ticket, message, path])
  const chat = await value(`insert into public.chat_conversations(customer_id,contact_name,contact_email,creation_key)
    values($1,'Customer','customer@test.invalid',$2) returning id as value`, [customer, randomUUID()])
  const chatMessage = await value(`insert into public.chat_messages(conversation_id,sender_id,sender_kind,sender_name,body,idempotency_key)
    values($1,$2,'customer','Customer','Chat file',$3) returning id as value`, [chat, customer, randomUUID()])
  const chatPath = `${chat}/${chatMessage}/evidence.pdf`
  await db.query("insert into storage.objects(bucket_id,name) values('chat-attachments',$1)", [chatPath])
  await db.query(`insert into public.chat_attachments(conversation_id,message_id,original_name,storage_path,mime_type,size_bytes)
    values($1,$2,'evidence.pdf',$3,'application/pdf',100)`, [chat, chatMessage, chatPath])
  const run = await beginReset('full')
  assert.deepEqual(run.manifest.support, [path])
  assert.deepEqual(run.manifest.chat, [chatPath])
  assert.equal(await count('support_ticket_attachments'), 0)
  assert.equal(await count('support_ticket_messages'), 0)
  assert.equal(await count('support_tickets'), 0)
  assert.equal(await count('chat_attachments'), 0)
  assert.equal(await count('chat_messages'), 0)
  assert.equal(await count('chat_conversations'), 0)
  // Storage bytes are deleted later by the application using the captured path.
  assert.equal(await value("select count(*)::int as value from storage.objects where bucket_id='support-attachments'"), 1)
  assert.equal(await value("select count(*)::int as value from storage.objects where bucket_id='chat-attachments'"), 1)
})

test('public visitors only read published site pages', async () => {
  await db.query(`insert into public.site_pages(title,path,is_published) values('Public policy','public-policy',true),('Draft policy','draft-policy',false)`)
  await db.exec('set local role anon')
  assert.equal(await count('site_pages'), 1)
  await fails(
    () => db.query(`insert into public.site_pages(title,path) values('Blocked','blocked')`),
    /permission denied/
  )
  await db.exec('reset role')
})

test('full reset preserves only the current owner; the new log survives', async () => {
  await seedOrder(await seedProduct())
  await db.query(`insert into public.site_pages(title,path,is_published) values('Full reset page','full-reset-page',true)`)
  await db.query(`insert into public.admin_users(id,email,role) values($1,'customer@test.invalid','owner')`,[customer])
  await db.query(`insert into storage.objects(bucket_id,name) values('admin-documents','root/test.pdf')`)
  await db.query(`insert into public.admin_activity_logs(author_name,author_email,description) values('Earlier','earlier@test.invalid','Old entry')`)
  const run=await beginReset('full')
  assert.equal(await count('products'),0)
  assert.equal(await count('customer_orders'),0)
  assert.equal(await count('site_pages'),0)
  assert.equal(await count('admin_users'),1)
  assert.equal(await value('select id as value from public.admin_users'),owner)
  assert.equal(await count('admin_activity_logs'),0)
  assert.deepEqual(run.manifest.users,[customer])
  assert.deepEqual(run.manifest.documents,['root/test.pdf'])
  // Auth and object bytes are removed through their APIs before the server calls finish.
  await finishReset(run.id)
  assert.equal(await count('admin_activity_logs'),1)
  assert.equal(await value(`select metadata->>'scope' as value from public.admin_activity_logs`),'full')
})

test('unknown tables stop full reset and leave existing records untouched', async () => {
  await seedProduct()
  await db.exec('create table public.unreviewed_data(id integer)')
  await fails(() => beginReset('full'), /Unrecognized tables/)
  assert.equal(await count('products'),1)
})

test('a deletion failure rolls back all changes and restores trigger states', async () => {
  await seedProduct()
  // A new FK with no rows is included in preflight but a statement trigger forces failure.
  await db.exec(`create function public.test_reject_reset() returns trigger language plpgsql as $$ begin raise exception 'forced failure'; end; $$;
    create trigger reset_failure before delete on public.products for each statement execute function public.test_reject_reset();`)
  // Mark as internal so reset does not suspend it (simulates a constraint/engine failure).
  await db.exec(`update pg_trigger set tgisinternal=true where tgname='reset_failure'`)
  await fails(() => beginReset('products'), /forced failure/)
  assert.equal(await count('products'),1)
  assert.equal(await count('system_reset_runs'),0)
  assert.equal(await value(`select tgenabled as value from pg_trigger where tgname='products_guard_serialized_stock'`),'O')
})
