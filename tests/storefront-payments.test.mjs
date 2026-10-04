import { expandUiSource } from './helpers/readUiSource.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createResetDatabase } from './helpers/resetDatabase.mjs'
import {
  getAvailablePaymentMethods,
  getPaymentMethodFee,
  paymentMethodNeedsProof
} from '../app/utils/paymentMethods.js'

const read = path => expandUiSource(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'))

test('payment settings default safely and database applies enabled method fees', async () => {
  const db = await createResetDatabase()

  try {
    await db.exec(`
      select set_config('request.jwt.claim.role','service_role',false);
      insert into public.site_settings (key)
      values ('default')
      on conflict (key) do update set key = excluded.key;

      update public.site_settings
      set payment_bank_transfer_enabled = true,
          payment_bank_transfer_fee = 12.50
      where key = 'default';

      insert into auth.users (id, email)
      values ('10000000-0000-4000-8000-000000000001', 'payments@example.com');
    `)

    const cash = (await db.query(`
      insert into public.customer_orders (
        user_id, first_name, phone, street_address, city, governorate,
        payment_method, subtotal_amount, total_amount
      ) values (
        '10000000-0000-4000-8000-000000000001', 'Cash', '01000000000',
        'Street', 'Cairo', 'Cairo', 'cash', 100, 100
      ) returning payment_method, payment_fee_amount, payment_proof_status, total_amount
    `)).rows[0]

    assert.equal(cash.payment_method, 'cash')
    assert.equal(Number(cash.payment_fee_amount), 0)
    assert.equal(cash.payment_proof_status, 'not_required')
    assert.equal(Number(cash.total_amount), 100)

    const legacy = (await db.query(`
      insert into public.customer_orders (
        user_id, first_name, phone, street_address, city, governorate,
        subtotal_amount, total_amount
      ) values (
        '10000000-0000-4000-8000-000000000001', 'Legacy', '01000000000',
        'Street', 'Cairo', 'Cairo', 50, 50
      ) returning payment_method, total_amount
    `)).rows[0]

    assert.equal(legacy.payment_method, 'cash')
    assert.equal(Number(legacy.total_amount), 50)

    const transfer = (await db.query(`
      insert into public.customer_orders (
        user_id, first_name, phone, street_address, city, governorate,
        payment_method, subtotal_amount, total_amount
      ) values (
        '10000000-0000-4000-8000-000000000001', 'Transfer', '01000000000',
        'Street', 'Cairo', 'Cairo', 'bank_transfer', 100, 100
      ) returning payment_fee_amount, payment_proof_status, total_amount
    `)).rows[0]

    assert.equal(Number(transfer.payment_fee_amount), 12.5)
    assert.equal(transfer.payment_proof_status, 'pending_upload')
    assert.equal(Number(transfer.total_amount), 112.5)

    await assert.rejects(() => db.exec(`
      insert into public.customer_orders (
        user_id, first_name, phone, street_address, city, governorate,
        payment_method, subtotal_amount, total_amount
      ) values (
        '10000000-0000-4000-8000-000000000001', 'Card', '01000000000',
        'Street', 'Cairo', 'Cairo', 'card', 100, 100
      )
    `), /not available/)

    await assert.rejects(() => db.exec("update public.site_settings set payment_cash_fee = -1 where key = 'default'"))

    await db.exec("delete from public.site_settings where key = 'default'")
    const resetSafeOrder = (await db.query(`
      insert into public.customer_orders (
        user_id, first_name, phone, street_address, city, governorate,
        subtotal_amount, total_amount
      ) values (
        '10000000-0000-4000-8000-000000000001', 'Reset fixture', '01000000000',
        'Street', 'Cairo', 'Cairo', 25, 25
      ) returning payment_method, payment_fee_amount, total_amount
    `)).rows[0]
    assert.equal(resetSafeOrder.payment_method, 'cash')
    assert.equal(Number(resetSafeOrder.payment_fee_amount), 0)
    assert.equal(Number(resetSafeOrder.total_amount), 25)
  } finally {
    await db.close()
  }
})

test('payment utilities expose enabled methods, fees, and proof rules', () => {
  const settings = {
    payment_card_enabled: true,
    payment_card_fee: '4.50',
    payment_cash_enabled: true,
    payment_cash_fee: 0
  }

  assert.deepEqual(getAvailablePaymentMethods(settings).map(method => method.value), ['card', 'cash'])
  assert.equal(getPaymentMethodFee(settings, 'card'), 4.5)
  assert.equal(paymentMethodNeedsProof('bank_transfer'), true)
  assert.equal(paymentMethodNeedsProof('cash'), false)

})

test('checkout delegates card fields to Paymob and provides proof continuation UI', () => {
  const checkout = read('app/pages/checkout/index.vue')
  const checkoutServer = read('server/api/checkout/index.post.js')
  const orderPage = read('app/pages/account/orders/[id].vue')
  const settings = read('app/pages/dashboard/settings.vue')
  const cart = read('app/pages/cart.vue')

  assert.match(checkout, /checkoutStep === 'shipping'/)
  assert.match(checkout, /Choose a payment method/)
  assert.doesNotMatch(checkout, /savedCardPreviews|autocomplete="cc-|card\.securityCode/)
  assert.match(checkout, /api\/payments\/capabilities/)
  assert.match(checkout, /PaymentProofUpload/)
  assert.match(checkout, /payment_method: selectedPaymentMethod\.value/)
  assert.doesNotMatch(checkoutServer, /card_number|securityCode|security_code/)
  assert.match(checkoutServer, /payment_\$\{paymentMethod\}_enabled/)
  assert.match(orderPage, /Proof of payment/)
  assert.match(orderPage, /Secure file submission is intentionally waiting/)
  assert.match(settings, /section === 'paymentSettings'/)
  assert.match(settings, /Save Payment Methods/)
  assert.match(cart, /Delivery option/)
  assert.match(cart, /sticky bottom-3/)
})
