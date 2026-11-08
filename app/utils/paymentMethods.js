export const paymentMethodDefinitions = [
  { value: 'card', label: 'Credit or debit card', description: 'Enter card details securely.', icon: 'lucide:credit-card' },
  { value: 'bank_transfer', label: 'Bank transfer', description: 'Transfer first, then attach your receipt.', icon: 'lucide:landmark' },
  { value: 'instapay', label: 'InstaPay', description: 'Pay with InstaPay and attach your receipt.', icon: 'lucide:smartphone' },
  { value: 'paypal', label: 'PayPal', description: 'Continue with your PayPal account.', icon: 'lucide:badge-dollar-sign' },
  { value: 'cash', label: 'Cash on delivery', description: 'Pay when your order is delivered.', icon: 'lucide:banknote' }
]

export const normalizePaymentMethod = value => {
  const normalized = String(value || '').trim().toLowerCase()
  return paymentMethodDefinitions.some(method => method.value === normalized) ? normalized : ''
}

export const getPaymentMethodLabel = value => {
  const normalized = normalizePaymentMethod(value)
  return paymentMethodDefinitions.find(method => method.value === normalized)?.label || 'Payment method'
}

export const getAvailablePaymentMethods = (settings = {}) => {
  return paymentMethodDefinitions.filter(method => settings[`payment_${method.value}_enabled`] === true)
}

// Cash on delivery may add a percent of the order value (products after discounts plus
// delivery), rounded up to a whole pound. The server quote is the final amount.
export const getPaymentMethodFee = (settings = {}, method = '', orderValue = 0) => {
  const normalized = normalizePaymentMethod(method)
  if (!normalized) return 0
  const fixed = Math.max(0, Number(settings[`payment_${normalized}_fee`] || 0))
  const percent = normalized === 'cash' ? Math.min(10, Math.max(0, Number(settings.payment_cash_fee_percent || 0))) : 0
  const base = Math.max(0, Number(orderValue) || 0)
  return fixed + (percent > 0 && base > 0 ? Math.ceil(Number((base * percent / 100).toFixed(6))) : 0)
}

export const paymentMethodNeedsProof = value => {
  return ['bank_transfer', 'instapay'].includes(normalizePaymentMethod(value))
}

export const paymentProofStatusLabel = value => ({
  pending_upload: 'Proof needed',
  under_review: 'Payment under review',
  approved: 'Payment approved',
  rejected: 'Proof needs attention',
  not_required: 'No proof required'
})[value] || 'Payment proof status unavailable'

export const paymentProofStatusClass = value => ({
  pending_upload: 'bg-amber-50 text-amber-800',
  under_review: 'bg-blue-50 text-blue-800',
  approved: 'bg-emerald-50 text-emerald-800',
  rejected: 'bg-red-50 text-red-800',
  not_required: 'bg-slate-100 text-slate-700'
})[value] || 'bg-slate-100 text-slate-700'
