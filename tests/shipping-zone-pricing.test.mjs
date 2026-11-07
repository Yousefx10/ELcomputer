import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { customerFee, courierCost, savedZonePricing, zonePricingErrors, editableZonePricing } from '../app/utils/shippingZonePricing.js'
import { checkoutDeliveryOptions } from '../app/utils/deliveryOptions.js'
import { attachedAwbReference } from '../server/utils/pdcLookups.js'

const migration = '20261107210000_shipping_zone_pricing.sql'
const rateCard = { version: '1', vat_percent: '14', round_to: '5', support: '25', zones: { 1: '60', 2: '65', 3: '75', 4: '85', 5: '95', 6: '105' }, governorates: {} }

test('PDC rate card prices: VAT, round up to 5 EGP, minus 25 EGP store support', () => {
  assert.deepEqual(['1', '2', '3', '4', '5', '6'].map(zone => customerFee(rateCard, zone)), [45, 50, 65, 75, 85, 95])
  assert.equal(Math.round(courierCost(rateCard, '1') * 100) / 100, 68.4)
  assert.equal(customerFee({ ...rateCard, support: '500' }, '1'), 0)
  assert.equal(customerFee(rateCard, ''), null)
})

test('only offered governorates with a priced zone are saved; missing zones are reported', () => {
  const editable = editableZonePricing({ ...rateCard, governorates: { Cairo: '1', Giza: '1', Aswan: '5' } })
  assert.deepEqual(savedZonePricing(editable, ['Cairo', 'Giza']).governorates, { Cairo: '1', Giza: '1' })
  assert.deepEqual(zonePricingErrors(editable, ['Cairo', 'Luxor']), ['zones'])
  assert.deepEqual(zonePricingErrors({ ...editable, vat_percent: 'x' }, ['Cairo']), ['vat'])
})

test('checkout shows the governorate price and hides a courier without one', () => {
  const options = [{ id: 'a', price: 50, governorates: ['Cairo', 'Aswan'], cashAvailable: true, prices: { cairo: 45 } }, { id: 'b', price: 70, governorates: ['Cairo'], cashAvailable: true }]
  assert.deepEqual(checkoutDeliveryOptions(options, 'Cairo', 'cash').map(o => [o.id, o.price]), [['a', 45], ['b', 70]])
  assert.deepEqual(checkoutDeliveryOptions(options, 'Aswan', 'cash').map(o => o.id), [])
})

test('portal airway bills track by AWB only through their AWB: reference', () => {
  assert.equal(attachedAwbReference('AWB:EDC123EG', 'EDC123EG'), true)
  assert.equal(attachedAwbReference('ORD-1', 'EDC123EG'), false)
  assert.equal(attachedAwbReference('AWB:EDC123EG', ''), false)
})

test('migration guards pricing and leaves the shipped email/booking rules alone', async () => {
  const sql = await readFile('supabase/migrations/' + migration, 'utf8')
  assert.doesNotMatch(sql, /erp_owner|capture_order_email|order_email_reason|pdc_order_eligibility/)
  assert.match(sql, /create trigger guard_checkout_pricing/)
  assert.match(sql, /grant execute on function public\.checkout_shipping_prices\(\),public\.shipping_order_attach_existing_awb\(uuid,uuid,text\) to service_role/)
  assert.doesNotMatch(await readFile('server/utils/pdcOrderShipping.js', 'utf8'), /erp_owner/)
})

test('native schema prices by governorate and drops the built-in-only rules', { timeout: 240000 }, async t => {
  const { createEmailNativeDatabase, emailNativeAvailable } = await import('./helpers/emailNativeDatabase.mjs')
  if (!emailNativeAvailable) return t.skip('native PostgreSQL is not configured')
  const { createProductSaveFixture } = await import('./helpers/productSaveFixture.mjs')
  const db = await createEmailNativeDatabase()
  try {
    await createProductSaveFixture({ database: db })
    for (const sig of ['private.capture_order_email()', 'private.order_email_reason(public.order_email_events)', 'private.pdc_order_eligibility(uuid)']) {
      const body = (await db.query('select pg_get_functiondef($1::regprocedure) d', [sig])).rows[0].d
      assert.doesNotMatch(body, /erp_owner/, sig)
    }
    const pricing = { ...rateCard, governorates: { Cairo: '1', Aswan: '5' } }
    const company = (await db.query(`insert into public.commerce_shipping_companies(name,provider,client_shipping_price,checkout_enabled,checkout_governorates,is_active,checkout_pricing)
      values('Zone courier','manual',50,true,array['Cairo','Aswan','Luxor'],true,$1) returning id`, [JSON.stringify(pricing)])).rows[0].id
    const fee = async area => Number((await db.query('select (private.cod_shipping($1,$2))->>\'fee\' f', [company, area])).rows[0].f)
    assert.equal(await fee('Cairo'), 45)
    assert.equal(await fee(' aswan '), 85)
    await assert.rejects(() => fee('Luxor'), /checkout:delivery/)
    const prices = (await db.query('select public.checkout_shipping_prices() p')).rows[0].p
    assert.deepEqual(prices[company], { cairo: 45, aswan: 85 })
    await assert.rejects(() => db.query('update public.commerce_shipping_companies set checkout_pricing=$2 where id=$1', [company, JSON.stringify({ ...pricing, governorates: { Cairo: '9' } })]), /invalid/)
    await db.query('update public.commerce_shipping_companies set checkout_pricing=null where id=$1', [company])
    assert.equal(await fee('Luxor'), 50)
    await assert.rejects(() => db.query("select public.shipping_order_attach_existing_awb(gen_random_uuid(),gen_random_uuid(),'EDC1EG')"), /permission/i)
  } finally { await db.close() }
})
