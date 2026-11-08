import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { getPaymentMethodFee } from '../app/utils/paymentMethods.js'

// Owner request (Phase 4): cash on delivery adds a percent of the order value, set in the Dashboard.
test('checkout estimate: fixed fee plus the COD percent, rounded up to a whole pound', () => {
  const settings = { payment_cash_fee: 0, payment_cash_fee_percent: 0.5, payment_card_fee: 0 }
  assert.equal(getPaymentMethodFee(settings, 'cash', 2539), 13)
  assert.equal(getPaymentMethodFee(settings, 'cash', 1000), 5)
  assert.equal(getPaymentMethodFee(settings, 'cash', 1200.8), 7)
  assert.equal(getPaymentMethodFee({ ...settings, payment_cash_fee: 10 }, 'cash', 1000), 15)
  assert.equal(getPaymentMethodFee(settings, 'card', 2539), 0, 'only cash on delivery uses the percent')
  assert.equal(getPaymentMethodFee({ payment_cash_fee: 10 }, 'cash', 2539), 10, 'no percent keeps the fixed fee')
  assert.equal(getPaymentMethodFee({ ...settings, payment_cash_fee_percent: 50 }, 'cash', 1000), 100, 'capped at 10%')
})

test('migration keeps quotes unchanged at 0% and charges the same base in quote and order', async () => {
  const sql = await readFile('supabase/migrations/20261108040000_cod_percent_fee.sql', 'utf8')
  assert.match(sql, /check \(payment_cash_fee_percent between 0 and 10\)/)
  assert.match(sql, /alter function private\.checkout_review\(jsonb\) rename to checkout_review_before_cod_percent/)
  assert.match(sql, /if fee<=0 then return review;end if;/)
  assert.match(sql, /ceil\(base\*pct\/100\)/)
  assert.match(sql, /ceil\(new\.total_amount \* v_settings\.payment_cash_fee_percent \/ 100\)/)
  assert.match(sql, /revoke all on function private\.checkout_review_before_cod_percent\(jsonb\),private\.checkout_review\(jsonb\) from public,anon,authenticated,service_role/)
})

test('native: COD orders and quotes carry the percent fee; card orders do not', { timeout: 300000 }, async t => {
  const { emailNativeAvailable } = await import('./helpers/emailNativeDatabase.mjs')
  if (!emailNativeAvailable) return t.skip('native PostgreSQL is not configured')
  const { createPrivatePackingFixture } = await import('./helpers/privatePackingFixture.mjs')
  const { encryptShippingSecret } = await import('../server/utils/shippingSecrets.js')
  const f = await createPrivatePackingFixture()
  const previous = globalThis.useRuntimeConfig; globalThis.useRuntimeConfig = () => f.config
  Object.assign(f.config, { shippingCredentialsEncryptionKey: 'owned-isolated-shipping-key-over-32-characters' })
  const q = (sql, args) => f.db.query(sql, args)
  try {
    await q("update public.shipping_provider_settings set is_enabled=true,cod_enabled=true,auto_create_labels=false,company_id='123',product_id=64,origin_city_id=1,origin_address='Owned pickup street',origin_phone='01000000000',origin_contact_name='Owned pickup',cities_cache='[{\"id\":1},{\"id\":2}]',products_cache='[{\"id\":64}]',access_token_encrypted=$1,webhook_secret_encrypted=$2 where id='pdc'",
      [encryptShippingSecret('OWNED-TOKEN'), encryptShippingSecret('owned-independent-webhook-secret-over-32-characters')])
    await q('delete from public.shipping_city_mappings')
    await q("insert into public.shipping_city_mappings(provider,governorate,city,provider_city_id) values('pdc','Cairo','Fixture city',2)")
    await q("insert into private.delivery_location_cities(code,governorate_code,name_en,name_ar,is_active) values('owned-fixture-city','eg-cairo','Fixture city','مدينة اختبار',true) on conflict do nothing")
    await q("update public.site_settings set inventory_tracking_required=false,allow_out_of_stock_purchases=true,payment_card_enabled=true,payment_cash_enabled=true,payment_cash_fee=10,payment_cash_fee_percent=0,backorder_fulfillment_message='Ships soon.' where key='default'")
    await q("update public.commerce_shipping_companies set cod_collection_provider='pdc',cod_collection_enabled=true")
    const company = (await q('select id from public.commerce_shipping_companies limit 1')).rows[0].id
    const order = async method => {
      const id = randomUUID()
      await q(`insert into public.customer_orders(id,user_id,order_number,status,payment_method,payment_status,subtotal_amount,total_amount,first_name,phone,street_address,city,governorate,shipping_company_id,shipping_method,stock_fulfillment_state)
        values($1,$2,$3,'processing',$4,'pending',2499,2499,'Owned buyer','01012345678','Owned street','Fixture city','Cairo',$5,'shipping','untracked')`,
        [id, f.actors.customer, 'ORD-' + id.slice(0, 8), method, company])
      return (await q('select payment_fee_amount::numeric fee,shipping_fee_amount::numeric ship,total_amount::numeric total from public.customer_orders where id=$1', [id])).rows[0]
    }

    await t.test('0% keeps today\'s fixed fee', async () => {
      const o = await order('cash')
      assert.equal(Number(o.fee), 10); assert.equal(Number(o.total), 2499 + Number(o.ship) + 10)
    })

    await t.test('0.5% of products plus delivery, rounded up, added to the fixed fee', async () => {
      await q("update public.site_settings set payment_cash_fee=0,payment_cash_fee_percent=0.5 where key='default'")
      const o = await order('cash'), base = 2499 + Number(o.ship)
      assert.equal(Number(o.fee), Math.ceil(base * 0.005)); assert.equal(Number(o.total), base + Number(o.fee))
      await q("update public.site_settings set payment_cash_fee=10 where key='default'")
      const both = await order('cash')
      assert.equal(Number(both.fee), 10 + Math.ceil(base * 0.005))
    })

    await t.test('card orders ignore the COD percent', async () => {
      const o = await order('card')
      assert.equal(Number(o.fee), 0)
    })

    await t.test('the settings column refuses values over 10%', async () => {
      await assert.rejects(() => q("update public.site_settings set payment_cash_fee_percent=10.5 where key='default'"), /payment_cash_fee_percent_check/)
    })

    await t.test('quote and placed order show the same COD fee; card quotes are unchanged', async () => {
      await q("update public.site_settings set payment_cash_fee=0,payment_cash_fee_percent=0.5 where key='default'")
      const { product_id: product, id: variant } = (await q('select id,product_id from public.product_variants limit 1')).rows[0]
      await q("update public.products set price=2499,is_published=true where id=$1", [product])
      const p_items = [{ product_id: product, variant_id: variant, quantity: 1 }]
      const p_order = method => ({ first_name: 'Owned', last_name: 'Buyer', email: 'buyer@fixture.invalid', phone: '01012345678', street_address: 'Owned street', city: 'Fixture city', governorate: 'Cairo', shipping_method: 'shipping', shipping_company_id: company, payment_method: method, locale: 'en' })
      const carts = {}
      const quote = async method => { carts[method] = randomUUID(); const r = await f.client.rpc('commerce_checkout_quote', { p_user_id: f.actors.customer, p_cart_id: carts[method], p_order: p_order(method), p_items }); assert.equal(r.error, null, JSON.stringify(r.error)); return r.data }
      const cash = await quote('cash'), card = await quote('card')
      const base = 2499 + Number(cash.shippingFee || 0)
      assert.equal(Number(cash.paymentFee), Math.ceil(base * 0.005)); assert.equal(Number(cash.totalAmount), base + Math.ceil(base * 0.005))
      const placed = await f.client.rpc('commerce_checkout_command', { p_user_id: f.actors.customer, p_cart_id: carts.cash, p_quote_id: cash.quoteId, p_order: p_order('cash'), p_items })
      assert.equal(placed.error, null, JSON.stringify(placed.error))
      assert.equal(Number(placed.data.order.payment_fee_amount), Number(cash.paymentFee)); assert.equal(Number(placed.data.order.total_amount), Number(cash.totalAmount))
      assert.equal(Number(card.paymentFee), 0)
      await q("update public.site_settings set payment_cash_fee_percent=0 where key='default'")
      const plain = await quote('cash')
      assert.equal(Number(plain.paymentFee), 0); assert.equal(plain.codFee, undefined)
    })
  } finally { globalThis.useRuntimeConfig = previous; await f.close() }
})
