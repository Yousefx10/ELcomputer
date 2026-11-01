const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
// Paymob's documented Egypt hosted path. No merchant secret, billing or amount in the URL.
// This is a new-session handoff, never payment recovery or settlement evidence.
export function hostedPaymentUrl(session) {
  if (!session || session.provider !== 'paymob' || !['live', 'test'].includes(session.mode)
    || !new RegExp(`^(egy_)?pk_${session.mode}_[A-Za-z0-9_-]+$`).test(session.publicKey || '')
    || !new RegExp(`^(egy_)?csk_${session.mode}_[A-Za-z0-9_-]+$`).test(session.clientSecret || '')
    || session.publicKey.length > 512 || session.clientSecret.length > 512) throw Error('Hosted payment unavailable')
  const url = new URL('https://accept.paymob.com/unifiedcheckout/')
  url.searchParams.set('publicKey', session.publicKey); url.searchParams.set('clientSecret', session.clientSecret)
  return url.href
}
export async function confirmedCardHandoff({ enabled, explicit, created, order, locale, scope }) {
  if (!enabled || !explicit || created !== true || order?.paymentMethod !== 'card' || !uuid.test(order.id)) return null
  scope.assertCurrent()
  const session = await scope.request('/api/payments/intentions', { method: 'POST', retry: 0, timeout: 15000, body: { order_id: order.id, locale } })
  scope.assertCurrent()
  if (session.orderId !== order.id) throw Error('Payment order mismatch')
  return hostedPaymentUrl(session)
}
