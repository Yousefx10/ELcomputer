import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

// Owner brief 7 Nov 2026: stock lives only in Daftra; the website only sells orders.
test('native: Daftra mode with tracking off can quote and place orders with an empty stock copy', { timeout: 300000 }, async t => {
  const { emailNativeAvailable } = await import('./helpers/emailNativeDatabase.mjs')
  if (!emailNativeAvailable) return t.skip('native PostgreSQL is not configured')
  const { createPrivatePackingFixture } = await import('./helpers/privatePackingFixture.mjs')
  const { encryptShippingSecret } = await import('../server/utils/shippingSecrets.js')
  const f = await createPrivatePackingFixture()
  const previous = globalThis.useRuntimeConfig; globalThis.useRuntimeConfig = () => f.config
  Object.assign(f.config, { shippingCredentialsEncryptionKey: 'owned-isolated-shipping-key-over-32-characters' })
  const q = (sql, args) => f.db.query(sql, args)
  try {
    await q("update public.shipping_provider_settings set is_enabled=true,cod_enabled=true,auto_create_labels=false,company_id='123',product_id=64,origin_city_id=1,origin_address='Owned pickup street',origin_phone='01000000000',origin_contact_name='Owned pickup',cities_cache='[{\"id\":1},{\"id\":2}]',products_cache='[{\"id\":64}]',access_token_encrypted=$1,webhook_secret_encrypted=$2 where id='pdc'", [encryptShippingSecret('OWNED-TOKEN'), encryptShippingSecret('owned-independent-webhook-secret-over-32-characters')])
    await q('delete from public.shipping_city_mappings')
    await q("insert into public.shipping_city_mappings(provider,governorate,city,provider_city_id) values('pdc','Cairo','Fixture city',2)")
    await q("insert into private.delivery_location_cities(code,governorate_code,name_en,name_ar,is_active) values('owned-fixture-city','eg-cairo','Fixture city','مدينة اختبار',true) on conflict do nothing")
    await q("update public.site_settings set inventory_tracking_required=false,allow_out_of_stock_purchases=true,payment_card_enabled=true,payment_cash_enabled=true,payment_cash_fee=0,payment_cash_fee_percent=0.5,backorder_fulfillment_message='Ships soon.' where key='default'")
    await q("update public.commerce_shipping_companies set cod_collection_provider='pdc',cod_collection_enabled=true")
    const company = (await q('select id from public.commerce_shipping_companies limit 1')).rows[0].id
    const { product_id: product, id: variant } = (await q('select id,product_id from public.product_variants limit 1')).rows[0]
    await q('update public.products set price=2499,is_published=true where id=$1', [product])
    await q('delete from public.erp_inventory_cache')
    await q('alter table public.site_settings disable trigger user'); await q("update public.site_settings set erp_mode='daftra' where key='default'"); await q('alter table public.site_settings enable trigger user')
    assert.equal((await q('select public.get_active_erp_mode() m')).rows[0].m, 'daftra')
    const p_items = [{ product_id: product, variant_id: variant, quantity: 1 }]
    const p_order = method => ({ first_name: 'Owned', last_name: 'Buyer', email: 'buyer@fixture.invalid', phone: '01012345678', street_address: 'Owned street', city: 'Fixture city', governorate: 'Cairo', shipping_method: 'shipping', shipping_company_id: company, payment_method: method, locale: 'en' })
    const carts = {}
    const quote = method => { carts[method] = randomUUID(); return f.client.rpc('commerce_checkout_quote', { p_user_id: f.actors.customer, p_cart_id: carts[method], p_order: p_order(method), p_items }) }
    await t.test('cash and card both get a quote with the COD fee only on cash', async () => {
      const cash = await quote('cash'), card = await quote('card')
      assert.equal(cash.error, null, JSON.stringify(cash.error)); assert.equal(card.error, null, JSON.stringify(card.error))
      const base = 2499 + Number(cash.data.shippingFee || 0)
      assert.equal(Number(cash.data.paymentFee), Math.ceil(base * 0.005)); assert.equal(Number(card.data.paymentFee), 0)
      assert.equal(cash.data.stockFulfillmentState, 'untracked')
      const placed = await f.client.rpc('commerce_checkout_command', { p_user_id: f.actors.customer, p_cart_id: carts.cash, p_quote_id: cash.data.quoteId, p_order: p_order('cash'), p_items })
      assert.equal(placed.error, null, JSON.stringify(placed.error))
      assert.equal(Number(placed.data.order.total_amount), Number(cash.data.totalAmount)); assert.equal(placed.data.order.erp_owner, 'daftra')
    })
    await t.test('when the store requires tracking, the Daftra stock copy still decides', async () => {
      await q("update public.site_settings set inventory_tracking_required=true where key='default'")
      const blocked = await quote('cash')
      assert.match(blocked.error?.message || '', /checkout:unavailable/)
      await q("update public.site_settings set inventory_tracking_required=false where key='default'")
    })
  } finally { globalThis.useRuntimeConfig = previous; await f.close() }
})

test('native: a paid card checkout in Daftra mode with tracking off becomes an order', { timeout: 300000 }, async t => {
  const { emailNativeAvailable } = await import('./helpers/emailNativeDatabase.mjs')
  if (!emailNativeAvailable) return t.skip('native PostgreSQL is not configured')
  const { paymentFirstFixture } = await import('./helpers/paymentFirstFixture.mjs')
  const f = await paymentFirstFixture({}); let n = 0
  const next = () => String(30000 + (++n))
  try {
    await f.db.query("update public.site_settings set inventory_tracking_required=false,allow_out_of_stock_purchases=true,backorder_fulfillment_message='Ships soon.' where key='default'")
    await f.db.query('alter table public.site_settings disable trigger user'); await f.db.query("update public.site_settings set erp_mode='daftra' where key='default'"); await f.db.query('alter table public.site_settings enable trigger user')
    await f.db.query('delete from public.erp_inventory_cache')
    const s = await f.prepare()
    const a = await f.claim(s), p = next(); await f.store(a, p); await f.callback(a, { id: next(), provider: p, status: 'succeeded' })
    const rows = (await f.db.query("select erp_owner,payment_status,stock_fulfillment_state from public.customer_orders where user_id=$1", [s.actor.id])).rows
    assert.deepEqual(rows, [{ erp_owner: 'daftra', payment_status: 'paid', stock_fulfillment_state: 'untracked' }])
  } finally { await f.close() }
})
