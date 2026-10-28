import { createHash } from 'node:crypto'
import { emailAddress, emailLine, emailBody } from '../../../app/utils/email.js'
import { projectCustomerPayment } from './customerStatus.js'

const copy = {
  en: {
    created: ['Order placed — awaiting payment', 'Your order is saved. Payment is not confirmed.'],
    paid: ['Payment confirmed', 'Your payment is verified. Order progress is shown separately.'],
    failed: ['Last payment attempt failed', 'Contact the store before trying another payment.'],
    pending: ['Payment needs verification', 'Payment is not confirmed. Contact the store before paying again.']
  },
  ar: {
    created: ['تم إنشاء الطلب — بانتظار الدفع', 'تم حفظ طلبك. لم يتم تأكيد الدفع.'],
    paid: ['تم تأكيد الدفع', 'تم التحقق من الدفع. حالة تجهيز الطلب منفصلة.'],
    failed: ['فشلت محاولة الدفع الأخيرة', 'تواصل مع المتجر قبل محاولة دفع أخرى.'],
    pending: ['الدفع يحتاج إلى تحقق', 'لم يتم تأكيد الدفع. تواصل مع المتجر قبل الدفع مجددًا.']
  }
}

// Preparation only: no hooks, queue, transport or SMTP access. A future outbox
// must bind these inputs to a durable business event and the existing email gate.
export const prepareCustomerPaymentNotification = ({ event, order, attempt, transactions = [], locale = 'en' }) => {
  const payment = projectCustomerPayment(order, attempt, transactions)
  if (!copy[locale]?.[event] || order.payment_method !== 'card' || order.is_preorder
    || event === 'paid' && payment.verified !== true
    || event === 'failed' && payment.status !== 'failed'
    || event === 'created' && payment.status !== 'awaiting_payment'
    || event === 'pending' && !['pending', 'provider_uncertain'].includes(payment.status)) throw Error('Notification does not match verified payment state.')
  const [subject, message] = copy[locale][event]
  // Existing transactional email accepts a stable UUID key. Deliberately do not
  // include locale: repeating the same event in another language is not new mail.
  const hash = createHash('sha256').update(`customer-payment-v1:${order.id}:${attempt?.id || 'none'}:${event}`).digest('hex')
  const idempotency_key = `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}`
  return { recipient: emailAddress(order.email), locale, subject: emailLine(subject),
    body: emailBody(`${emailLine(order.order_number)}\n\n${message}`), body_format: 'text',
    business_reference: emailLine(order.order_number, 120), idempotency_key }
}
