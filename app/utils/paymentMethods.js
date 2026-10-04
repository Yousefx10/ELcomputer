export const paymentMethodDefinitions = [
  { value: 'card', label: 'Credit or debit card', description: 'Enter card details securely.', icon: 'lucide:credit-card' },
  { value: 'bank_transfer', label: 'Bank transfer', description: 'Transfer first, then attach your receipt.', icon: 'lucide:landmark' },
  { value: 'instapay', label: 'InstaPay', description: 'Pay with InstaPay and attach your receipt.', icon: 'lucide:smartphone' },
  { value: 'paypal', label: 'PayPal', description: 'Continue with your PayPal account.', icon: 'lucide:badge-dollar-sign' },
  { value: 'cash', label: 'Cash', description: 'Pay when your order is delivered.', icon: 'lucide:banknote' }
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

export const getPaymentMethodFee = (settings = {}, method = '') => {
  const normalized = normalizePaymentMethod(method)
  if (!normalized) return 0
  return Math.max(0, Number(settings[`payment_${normalized}_fee`] || 0))
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
