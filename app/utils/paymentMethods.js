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

export const normalizeCardNumber = value => String(value || '').replace(/\D/g, '').slice(0, 19)

export const formatCardNumber = value => normalizeCardNumber(value).replace(/(.{4})/g, '$1 ').trim()

export const getCardBrand = value => {
  const number = normalizeCardNumber(value)
  if (/^4/.test(number)) return 'Visa'
  if (/^(5[1-5]|2[2-7])/.test(number)) return 'Mastercard'
  if (/^3[47]/.test(number)) return 'American Express'
  return 'Card'
}

const passesLuhnCheck = value => {
  const digits = normalizeCardNumber(value)
  if (digits.length < 12) return false

  let sum = 0
  let doubleDigit = false

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index])
    if (doubleDigit) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    doubleDigit = !doubleDigit
  }

  return sum % 10 === 0
}

export const validatePaymentCard = (card = {}, now = new Date()) => {
  if (!String(card.cardholder || '').trim()) return 'Enter the name shown on the card.'
  if (!passesLuhnCheck(card.number)) return 'Enter a valid card number.'

  const expiryMatch = String(card.expiry || '').trim().match(/^(0[1-9]|1[0-2])\s*\/\s*(\d{2})$/)
  if (!expiryMatch) return 'Enter expiry as MM/YY.'

  const expiryMonth = Number(expiryMatch[1])
  const expiryYear = 2000 + Number(expiryMatch[2])
  const expiryBoundary = new Date(expiryYear, expiryMonth, 1)
  const currentBoundary = new Date(now.getFullYear(), now.getMonth(), 1)
  if (expiryBoundary <= currentBoundary) return 'The card has expired.'

  if (!/^\d{3,4}$/.test(String(card.securityCode || '').trim())) return 'Enter a valid security code.'
  return ''
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
