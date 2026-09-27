export const defaultSellingConfig = () => ({
  selling_mode: 'normal', expected_availability_date: '', availability_message: '',
  preorder_active: true, preorder_starts_at: '', preorder_ends_at: '',
  preorder_payment_mode: 'full', preorder_deposit_percent: '25',
  preorder_total_limit: '', preorder_customer_limit: ''
})

export const serializeSellingConfig = config => ({
  ...config,
  preorder_starts_at: config.preorder_starts_at ? new Date(config.preorder_starts_at).toISOString() : null,
  preorder_ends_at: config.preorder_ends_at ? new Date(config.preorder_ends_at).toISOString() : null
})

export const preorderEligibility = (product, now = new Date()) => {
  if (product?.selling_mode === 'coming_soon') return { available: false, reason: 'Coming Soon' }
  if (product?.selling_mode !== 'preorder') return { available: true, reason: '' }
  if (!product.preorder_active) return { available: false, reason: 'Pre-order unavailable' }
  if (product.preorder_starts_at && now < new Date(product.preorder_starts_at)) return { available: false, reason: 'Pre-order opens later' }
  if (product.preorder_ends_at && now >= new Date(product.preorder_ends_at)) return { available: false, reason: 'Pre-order closed' }
  return { available: true, reason: '' }
}

export const calculatePreorderAmounts = (price, quantity, paymentMode, percent) => {
  const decimal = (value, scale) => {
    const text = String(value ?? '').trim()
    if (!/^\d+(\.\d+)?$/.test(text)) throw new Error('Invalid monetary value.')
    const [whole, fraction = ''] = text.split('.')
    return BigInt(whole) * BigInt(scale) + BigInt(fraction.slice(0, 2).padEnd(2, '0')) + (Number(fraction[2] || 0) >= 5 ? 1n : 0n)
  }
  const lineCents = decimal(price, 100) * BigInt(quantity)
  const dueCents = paymentMode === 'deposit'
    ? (lineCents * decimal(percent, 100) + 5000n) / 10000n
    : lineCents
  return { total: Number(lineCents) / 100, due: Number(dueCents) / 100, balance: Number(lineCents - dueCents) / 100 }
}

export const expectedAvailabilityLabel = value => {
  if (!value) return ''
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00Z`)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
}
