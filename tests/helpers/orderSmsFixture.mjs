import { randomUUID } from 'node:crypto'
import { createResetDatabase } from './resetDatabase.mjs'
import { smsDatabaseClient } from './smsDatabase.mjs'
import { validateSmsSettings, smsDefaults } from '../../server/utils/sms/settings.js'

export const createOrderSmsFixture = async (options = {}) => {
  const db = await createResetDatabase(options)
  const client = smsDatabaseClient(db)
  const customer = randomUUID(), owner = randomUUID(), product = randomUUID(), preorderProduct = randomUUID()
  await db.query("select set_config('request.jwt.claim.role','service_role',false)")
  await db.query("insert into auth.users(id,email) values($1,'order-buyer@example.invalid'),($2,'order-owner@example.invalid')", [customer, owner])
  await db.query("insert into public.admin_users(id,email,role) values($1,'order-owner@example.invalid','owner')", [owner])
  await db.exec("insert into public.site_settings(key,payment_cash_enabled,payment_card_enabled,payment_bank_transfer_enabled,payment_cash_fee,payment_bank_transfer_fee,erp_mode) values('default',true,true,true,5,5,'built_in') on conflict(key) do update set payment_cash_enabled=true,payment_card_enabled=true,payment_bank_transfer_enabled=true,payment_cash_fee=5,payment_bank_transfer_fee=5,erp_mode='built_in'")
  await db.query("select set_config('app.serialized_inventory_write','on',false)")
  await db.query("insert into public.products(id,title,slug,price,stock_quantity,is_serialized,selling_mode,preorder_payment_mode) values($1,'Order fixture',($1::uuid)::text,125.50,100,false,'normal','full'),($2,'Preorder fixture',($2::uuid)::text,125.50,0,false,'preorder','full')", [product, preorderProduct])
  await db.query("select set_config('app.serialized_inventory_write','off',false)")
  const checkout = async ({ locale = 'en', method = 'cash', cart = randomUUID(), preorder = false } = {}) => {
    const order = { order_number: 'ORD-' + cart, first_name: 'Buyer', last_name: 'Fixture', phone: '01012345678', street_address: 'Street', city: 'Cairo', governorate: 'Cairo', payment_method: method, locale }
    const items = [{ product_id: preorder ? preorderProduct : product, quantity: 1 }]
    const call = preorder ? 'public.commerce_create_preorder($1,$2::jsonb,$3::jsonb,$4)' : 'public.commerce_create_customer_order($1,$2::jsonb,$3::jsonb,false,$4)'
    const result = (await db.query('select ' + call + ' as result', [customer, JSON.stringify(order), JSON.stringify(items), cart])).rows[0].result
    return result.order || result
  }
  const enable = async () => {
    const encrypted = validateSmsSettings({ account_id: 'isolated-account', password: 'isolated-password', hash_secret: 'AB'.repeat(16) }, smsDefaults)
    const { error } = await client.from('sms_provider_settings').update({ ...encrypted, is_enabled: true, base_url: 'https://sms.example.invalid',
      sender_names: ['APP'], default_sender: 'APP', expected_outbound_ip: '8.8.8.8', trusted_ip_confirmed: true,
      activation_confirmed: true, hash_protocol_confirmed: true }).eq('id', 'vodafone')
    if (error) throw Error(error.message)
    await db.exec("update public.sms_templates set is_enabled=true where category='orders'; update public.sms_order_event_settings set is_enabled=true where event_type not like 'pdc_%'")
  }
  const events = async id => (await db.query('select * from public.sms_order_events where order_id=$1 order by created_at,id', [id])).rows
  const order = async id => (await db.query('select * from public.customer_orders where id=$1', [id])).rows[0]
  const batches = async () => (await db.query('select * from public.sms_batches order by created_at,id')).rows
  return { db, client, customer, owner, product, checkout, enable, events, order, batches }
}
