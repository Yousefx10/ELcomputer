import { emailAddress, emailBody, emailLine } from '../../app/utils/email.js'
import { prepareCustomerPaymentNotification } from './payments/customerNotification.js'
import { createEmailService } from './email/service.js'
import { getEmailSettings, emailReadiness } from './email/settings.js'
import { emailFail } from './email/core.js'

const check = result => { if (result.error) emailFail('Order email storage is unavailable.', 503); return result.data }
export const prepareOrderEmail = row => {
  if (!row || row.copy_version !== 1 || !['en', 'ar'].includes(row.locale)
    || !['order_received', 'payment_verified'].includes(row.event_type)
    || !/^[0-9a-f-]{36}$/i.test(row.id || '') || row.payload?.currency !== 'EGP') throw Error('Invalid order email event.')
  const o = row.payload, ar = row.locale === 'ar'
  if (!['card', 'cash','instapay'].includes(o.payment_method) || !/^\d{1,10}\.\d{2}$/.test(o.total_amount)) throw Error('Invalid order email amount.')
  const reference = emailLine(o.order_number, 120), total = o.total_amount + ' EGP'
  let subject, message
  if (row.event_type === 'order_received' && o.payment_method === 'card') {
    // Reuse the existing preparation-only payment copy; SQL binds its truth state.
    const draft = prepareCustomerPaymentNotification({ event: 'created', locale: row.locale,
      order: { ...o, email: row.recipient, payment_status: 'pending', status: 'pending_payment', is_preorder: false }, attempt: null })
    subject = draft.subject; message = draft.body.split('\n\n').slice(1).join('\n\n')
  } else if (row.event_type === 'order_received') {
    if(o.payment_method==='instapay')throw Error('Unverified transfer receipt is not an order.')
    subject = ar ? 'تم استلام الطلب — الدفع عند الاستلام' : 'Order received — cash on delivery'
    message = ar ? 'لم يتم تحصيل المبلغ. طلبك بانتظار مراجعة المتجر.' : 'Payment is not collected. Your order awaits store review.'
  } else {
    if (!['card','instapay'].includes(o.payment_method)) throw Error('Cash collection notification is not qualified.')
    subject = ar ? 'تم تأكيد الدفع' : 'Payment confirmed'
    message = ar ? 'تم التحقق من الدفع. حالة تجهيز الطلب منفصلة.' : 'Your payment is verified. Order progress is shown separately.'
  }
  return { recipient: emailAddress(row.recipient), locale: row.locale, subject: emailLine(subject),
    body: emailBody(reference + '\n\n' + message + '\n\n' + (ar ? 'الإجمالي: ' : 'Total: ') + total),
    body_format: 'html', business_reference: reference, idempotency_key: row.id, priority: 5 }
}
export const processOrderEmailNotifications = async (db, { limit = 1, authorize = () => {} } = {}) => {
  const processed = []
  for (let i = 0; i < Math.min(3, Math.max(1, limit)); i++) {
    await authorize()
    const row = check(await db.rpc('order_email_take'))
    if (!row) break
    let reason = 'invalid_content'
    try {
      const input = prepareOrderEmail(row)
      reason = 'provider_unavailable'
      const settings = await getEmailSettings(db)
      if (!settings.config.is_enabled || !emailReadiness(settings).ready) throw Error('Email unavailable.')
      await authorize(); reason = 'storage_error'
      const result = await createEmailService(db).sendTransactional(input, { orderNotification: { id: row.id, token: row.work_token, event_type: row.event_type } })
      processed.push({ id: row.id, state: result.state })
    } catch (error) {
      check(await db.rpc('order_email_finish', { p_id: row.id, p_token: row.work_token, p_reason: reason }))
      if (error.statusCode === 401) throw error
      processed.push({ id: row.id, state: reason === 'storage_error' ? 'deferred' : 'suppressed' })
    }
  }
  return { processed }
}
