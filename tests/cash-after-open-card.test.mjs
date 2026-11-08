import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'
import { paymentFirstFixture } from './helpers/paymentFirstFixture.mjs'

// Owner report 8 Nov 2026: an abandoned card attempt blocked cash on the same items forever.
test('the checkout explains an open card payment and links to it', async () => {
  for (const file of ['app/components/checkout/Modern.vue', 'app/components/checkout/Classic.vue']) assert.match(await readFile(file, 'utf8'), /affectedPayment\.blocking \|\|/)
  assert.match(await readFile('app/composables/useCheckoutFlow.js', 'utf8'), /blocking:true\};orderError\.value=t\('paymentInterface\.openCardPayment'\)/)
})
test('native: cash waits only while a card attempt can still be paid', { skip: !emailNativeAvailable, timeout: 240000 }, async t => {
  const f = await paymentFirstFixture({})
  const q = (sql, args) => f.db.query(sql, args)
  try {
    await q("update public.site_settings set payment_cash_enabled=true,payment_cash_fee=0,payment_cash_fee_percent=0 where key='default'")
    await q('update public.commerce_shipping_companies set cod_collection_enabled=true')
    const s = await f.prepare({ quantity: 1 })
    await q("alter table private.payment_checkout_attempts disable trigger user"); await q("alter table private.payment_checkout_sessions disable trigger user")
    await q("update private.payment_checkout_attempts set interface_state='submitted' where session_id=$1", [s.session.id])
    await q("alter table private.payment_checkout_attempts enable trigger user"); await q("alter table private.payment_checkout_sessions enable trigger user")
    const order = { ...s.order, payment_method: 'cash' }
    const place = async () => { const cart = randomUUID(); const quote = await f.rpc('commerce_checkout_quote', [s.actor.id, cart, order, s.items]); return f.rpc('commerce_checkout_command', [s.actor.id, cart, quote.quoteId, order, s.items]) }
    await t.test('an open card attempt still blocks cash', async () => { await assert.rejects(place, /payment_first:existing/) })
    const setSession = async (sql, args) => { await q('alter table private.payment_checkout_sessions disable trigger user'); await q(sql, args); await q('alter table private.payment_checkout_sessions enable trigger user') }
    await t.test('a session under review still blocks after expiry', async () => {
      await setSession("update private.payment_checkout_sessions set state='review',expires_at=now()-interval '1 minute' where id=$1", [s.session.id])
      await assert.rejects(place, /payment_first:existing/)
    })
    await t.test('an expired abandoned attempt no longer blocks cash', async () => {
      await setSession("update private.payment_checkout_sessions set state='pending',expires_at=now()-interval '1 minute' where id=$1", [s.session.id])
      const placed = await place(); assert.ok(placed.order?.id, JSON.stringify(placed).slice(0, 200))
    })
  } finally { await f.close() }
})
