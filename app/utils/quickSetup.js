// Navigation and copy identifiers only. Configuration stays in existing modules.
export const setupSections = [
  { id: 'system', icon: 'server', items: ['application', 'infrastructure'] },
  { id: 'store', icon: 'store', items: ['branding', 'contact', 'policies'] },
  { id: 'payments', icon: 'credit-card', items: ['payment_methods', 'paymob', 'paypal', 'express_payments'] },
  { id: 'shipping', icon: 'truck', items: ['shipping', 'daftra'] },
  { id: 'messages', icon: 'mail', items: ['vodafone', 'brevo', 'automation'] },
  { id: 'authentication', icon: 'shield-check', items: ['authentication', 'oauth', 'live_chat'] },
  { id: 'readiness', icon: 'clipboard-check', items: [] }
]

export const setupLinks = {
  application: [{ label: 'store_settings', to: '/dashboard/settings' }],
  branding: [{ label: 'branding', to: '/dashboard/settings?tab=general' }, { label: 'media', to: '/dashboard/settings?tab=gallery' }],
  contact: [{ label: 'contact', to: '/dashboard/settings?tab=footer' }],
  policies: [{ label: 'policies', to: '/dashboard/settings?tab=after-sales' }],
  payment_methods: [{ label: 'payments', to: '/dashboard/settings?tab=payments' }],
  paymob: [{ label: 'payments', to: '/dashboard/settings?tab=payments' }],
  paypal: [{ label: 'payments', to: '/dashboard/settings?tab=payments' }],
  shipping: [{ label: 'shipping', to: '/dashboard/commerce?tab=shipping' }],
  daftra: [{ label: 'erp', to: '/dashboard/settings?tab=erp' }],
  vodafone: [{ label: 'sms', to: '/dashboard/sms?tab=settings' }],
  brevo: [{ label: 'email', to: '/dashboard/email?tab=settings' }],
  automation: [{ label: 'sms', to: '/dashboard/sms?tab=settings' }, { label: 'communications', to: '/dashboard/after-sales?tab=communications' }],
  authentication: [{ label: 'authentication', to: '/dashboard/settings?tab=authentication' }],
  oauth: [{ label: 'authentication', to: '/dashboard/settings?tab=authentication' }],
  live_chat: [{ label: 'live_chat', to: '/dashboard/settings?tab=live-chat' }]
}

export const setupOptionalIntegrations = ['pdc', 'daftra', 'vodafone', 'brevo', 'paymob', 'paypal', 'oauth', 'live_chat']
export const setupAcceptanceChecks = ['auth', 'storage', 'commerce', 'providers', 'workers', 'backup', 'migration_history']
export const setupItemIds = setupSections.flatMap(section => section.items)
export const setupVerificationDomains = Object.fromEntries(setupItemIds.map(key => [key,
  key === 'paymob' ? ['paymob', 'payment_methods'] : key === 'vodafone' || key === 'brevo' ? [key, 'automation'] : [key]
]))
export const setupAcceptanceDomains = {
  auth: ['authentication', 'oauth'], storage: ['application', 'authentication', 'infrastructure'],
  commerce: ['application', 'payment_methods', 'paymob', 'shipping', 'daftra', 'policies'],
  providers: ['shipping', 'daftra', 'vodafone', 'brevo', 'paymob', 'paypal', 'oauth', 'live_chat', 'automation'],
  workers: ['shipping', 'daftra', 'vodafone', 'brevo', 'automation'],
  backup: ['infrastructure'], migration_history: ['application']
}
