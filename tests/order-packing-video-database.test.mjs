import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createResetDatabase } from './helpers/resetDatabase.mjs'

let db

const fails = async (action, pattern) => {
  await db.exec('savepoint expected_failure')
  await assert.rejects(action, pattern)
  await db.exec('rollback to savepoint expected_failure')
}

before(async () => {
  db = await createResetDatabase()
})

after(async () => {
  await db?.close()
})

test('packing requires an operator session and a video covering every scan', async () => {
  const adminId = randomUUID()
  const customerId = randomUUID()
  const productId = randomUUID()
  const orderId = randomUUID()
  const orderItemId = randomUUID()
  const workSessionId = randomUUID()
  const packingSessionId = randomUUID()

  await db.exec('begin')
  await db.query(`select set_config('request.jwt.claim.role', 'service_role', true)`)
  await db.query(
    `insert into auth.users(id,email) values($1,'packer@test.invalid'),($2,'buyer@test.invalid')`,
    [adminId, customerId]
  )
  await db.query(
    `insert into public.admin_users(id,email,full_name,role) values($1,'packer@test.invalid','Test Packer','owner')`,
    [adminId]
  )
  await db.query(`select set_config('app.serialized_inventory_write', 'on', true)`)
  await db.query(
    `insert into public.products(id,title,slug,sku,is_serialized) values($1,'Mouse',$2,'MOUSE-1',false)`,
    [productId, productId]
  )
  await db.query(`select set_config('app.serialized_inventory_write', 'off', true)`)
  await db.query(
    `insert into public.customer_orders(id,user_id,order_number,first_name,phone,street_address,city,governorate) values($1,$2,'ORD-100','Buyer','123','Street','Cairo','Cairo')`,
    [orderId, customerId]
  )
  await db.query(
    `insert into public.customer_order_items(id,order_id,product_id,product_title,product_sku,quantity) values($1,$2,$3,'Mouse','MOUSE-1',1)`,
    [orderItemId, orderId, productId]
  )

  await fails(
    () => db.query(
      `insert into public.order_packing_sessions(id,order_id,admin_user_id,processor_name) values($1,$2,$3,'Test Packer')`,
      [packingSessionId, orderId, adminId]
    ),
    /Start a packing session/
  )

  await db.query(
    `insert into public.order_packing_work_sessions(id,admin_user_id,operator_name) values($1,$2,'Test Packer')`,
    [workSessionId, adminId]
  )
  await db.query(
    `insert into public.order_packing_sessions(id,order_id,admin_user_id,work_session_id,processor_name) values($1,$2,$3,$4,'Test Packer')`,
    [packingSessionId, orderId, adminId, workSessionId]
  )
  await db.query(
    `insert into public.order_packing_scans(session_id,order_item_id,scanned_code,scanned_by) values($1,$2,'MOUSE-1',$3)`,
    [packingSessionId, orderItemId, adminId]
  )

  await fails(
    () => db.query(
      `select public.complete_order_packing_session($1,$2,'ready_to_deliver',null,null,'Test Packer')`,
      [packingSessionId, adminId]
    ),
    /Upload the packing video/
  )

  await db.query(
    `insert into public.order_packing_videos(
      packing_session_id,work_session_id,order_id,recorded_by,storage_path,file_name,mime_type,
      size_bytes,duration_seconds,status,recording_started_at,recording_ended_at,uploaded_at
    ) values($1,$2,$3,$4,$5,'ORD-100.webm','video/webm',100,120,'ready',now() + interval '1 minute',now() + interval '3 minutes',now())`,
    [packingSessionId, workSessionId, orderId, adminId, `${adminId}/${orderId}/${packingSessionId}/ORD-100.webm`]
  )

  await fails(
    () => db.query(
      `select public.complete_order_packing_session($1,$2,'ready_to_deliver',null,null,'Test Packer')`,
      [packingSessionId, adminId]
    ),
    /cover every item scan/
  )

  await db.query(
    `update public.order_packing_videos set recording_started_at=now() - interval '1 minute', recording_ended_at=now() + interval '1 minute' where packing_session_id=$1`,
    [packingSessionId]
  )
  const result = await db.query(
    `select public.complete_order_packing_session($1,$2,'ready_to_deliver',null,null,'Test Packer') as value`,
    [packingSessionId, adminId]
  )

  assert.equal(result.rows[0].value.order_status, 'ready_to_deliver')
  assert.equal(result.rows[0].value.already_completed, false)

  await db.query(
    `update public.order_packing_work_sessions set status='closed',closed_at=now(),updated_at=now() where id=$1`,
    [workSessionId]
  )
  const workSession = await db.query(
    `select status from public.order_packing_work_sessions where id=$1`,
    [workSessionId]
  )

  assert.equal(workSession.rows[0].status, 'closed')
  await db.exec('rollback')
})

test('closing a work session releases its order and writes one log', async () => {
  const adminId = randomUUID()
  const customerId = randomUUID()
  const orderId = randomUUID()
  const workSessionId = randomUUID()
  const packingSessionId = randomUUID()

  await db.exec('begin')
  await db.query(`select set_config('request.jwt.claim.role', 'service_role', true)`)
  await db.query(
    `insert into auth.users(id,email) values($1,'closer@test.invalid'),($2,'buyer2@test.invalid')`,
    [adminId, customerId]
  )
  await db.query(
    `insert into public.admin_users(id,email,full_name,role) values($1,'closer@test.invalid','Session Closer','owner')`,
    [adminId]
  )
  await db.query(
    `insert into public.customer_orders(id,user_id,order_number,first_name,phone,street_address,city,governorate) values($1,$2,'ORD-200','Buyer','123','Street','Cairo','Cairo')`,
    [orderId, customerId]
  )
  await db.query(
    `insert into public.order_packing_work_sessions(id,admin_user_id,operator_name) values($1,$2,'Session Closer')`,
    [workSessionId, adminId]
  )
  await db.query(
    `insert into public.order_packing_sessions(id,order_id,admin_user_id,work_session_id,processor_name) values($1,$2,$3,$4,'Session Closer')`,
    [packingSessionId, orderId, adminId, workSessionId]
  )

  const closeResult = await db.query(
    `select public.close_order_packing_work_session($1,$2,'Session Closer','closer@test.invalid','owner') as value`,
    [workSessionId, adminId]
  )
  const packingSession = await db.query(
    `select status from public.order_packing_sessions where id=$1`,
    [packingSessionId]
  )
  const workSession = await db.query(
    `select status from public.order_packing_work_sessions where id=$1`,
    [workSessionId]
  )
  const logs = await db.query(
    `select description,metadata from public.admin_activity_logs where action_key='orders.packing.work_session.close' and admin_user_id=$1`,
    [adminId]
  )

  assert.equal(closeResult.rows[0].value.released_order_id, orderId)
  assert.equal(packingSession.rows[0].status, 'cancelled')
  assert.equal(workSession.rows[0].status, 'closed')
  assert.equal(logs.rows.length, 1)
  assert.equal(logs.rows[0].description, 'Closed packing session. Order ORD-200 returned to the queue.')
  assert.equal(logs.rows[0].metadata.packing_progress_cleared, true)
  await db.exec('rollback')
})
