// Merchant integration configuration is separate from implemented flows and device capability.
// Setting an integration ID for a future method never advertises it as usable.
export const paymobMethodRegistry = [
  { method: 'card', pixelMethod: 'card', flowImplemented: true, express: false },
  { method: 'apple_pay', pixelMethod: 'apple-pay', flowImplemented: true, express: true },
  { method: 'google_pay', pixelMethod: 'google-pay', flowImplemented: false, express: true },
  { method: 'mobile_wallet', pixelMethod: null, flowImplemented: false, express: false }
]
export const configuredPaymobMethods = (runtime, mode) => {
  const input = JSON.parse(String(runtime.paymobIntegrationIds || '{}'))
  if (!input || Array.isArray(input) || typeof input !== 'object'
    || Object.keys(input).some(key => !paymobMethodRegistry.some(method => method.method === key) || key === 'card')) throw new Error('Invalid method registry')
  return paymobMethodRegistry.map(method => {
    const entry = method.method === 'card'
      ? { id: Number(runtime.paymobCardIntegrationId), mode: runtime.paymobCardIntegrationMode, enabled: true }
      : input[method.method]
    if (entry && (!Number.isSafeInteger(entry.id) || entry.id < 1 || entry.mode !== mode || typeof entry.enabled !== 'boolean'
      || entry.hosted !== undefined && typeof entry.hosted !== 'boolean'
      || entry.customerIds !== undefined && !(Array.isArray(entry.customerIds) && entry.customerIds.length <= 100
        && entry.customerIds.every(id => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id))))) throw new Error('Invalid method configuration')
    const merchantReady = method.method !== 'apple_pay' || mode === 'live'
      && entry?.pixelVerified === true && entry?.certificatesVerified === true
      && entry?.verifiedOrigin === String(runtime.public?.siteUrl || '').replace(/\/$/, '')
    // Hosted Apple Pay runs on Paymob's page, so Paymob owns its domain and certificates.
    const hostedReady = method.method === 'apple_pay' && mode === 'live' && entry?.hosted === true
    const configured = method.flowImplemented && entry?.enabled === true && entry.mode === mode
    return { ...method, integrationId: entry?.id || null, enabled: entry?.enabled === true,
      hosted: configured && hostedReady, available: configured && (merchantReady || hostedReady),
      // Optional reviewed test accounts for hosted Apple Pay. Absent or empty means everyone.
      customerIds: method.method === 'apple_pay' ? entry?.customerIds || [] : [] }
  })
}

// Card follows the customer's Pixel rollout. Hosted Apple Pay always uses
// Paymob's page; embedded Apple Pay keeps its merchant verification gates.
export const paymobExperience = (method, embedded, customerId = '') => {
  if (!method?.available) return null
  if (method.method !== 'apple_pay') return embedded ? 'embedded' : 'redirect'
  if (method.hosted) return !method.customerIds?.length || method.customerIds.includes(customerId) ? 'redirect' : null
  return embedded ? 'embedded' : null
}

// A reviewed rollout changes presentation only; customer authorization still
// comes from the existing checkout contracts. Empty IDs permit public rollout.
export const pixelEnabledFor = (runtime, customerId) => {
  if (![true, 'true'].includes(runtime.paymobPixelEnabled)) return false
  try {
    const ids = JSON.parse(String(runtime.paymobPixelCustomerIds || '[]'))
    return Array.isArray(ids) && ids.length <= 100 && ids.every(id => /^[0-9a-f-]{36}$/i.test(id))
      && !!customerId && (!ids.length || ids.includes(customerId))
  } catch { return false }
}
