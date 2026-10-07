// Form metadata only. Policy merging, date resolution and eligibility are server-owned.
export const afterSalesDateBases = ['delivery_date', 'invoice_date', 'payment_date', 'order_date']
export const afterSalesResolutions = ['repair', 'replacement', 'refund', 'service_center']
export const afterSalesEvidence = ['disabled', 'optional', 'required']
export const afterSalesShipping = ['elcomputer', 'customer', 'reason', 'manual']
export const afterSalesFields = [
  { key: 'warranty_enabled', group: 'warranty', type: 'boolean' },
  { key: 'warranty_start_basis', group: 'warranty', type: 'enum', options: afterSalesDateBases },
  { key: 'warranty_fallback_bases', group: 'warranty', type: 'list', options: afterSalesDateBases },
  { key: 'warranty_resolutions', group: 'warranty', type: 'list', options: afterSalesResolutions },
  { key: 'warranty_evidence', group: 'warranty', type: 'enum', options: afterSalesEvidence },
  { key: 'warranty_serial', group: 'warranty', type: 'enum', options: afterSalesEvidence },
  { key: 'warranty_shipping', group: 'warranty', type: 'enum', options: afterSalesShipping },
  { key: 'return_enabled', group: 'returns', type: 'boolean' },
  { key: 'return_window_days', group: 'returns', type: 'integer', min: 1, max: 365 },
  { key: 'return_start_basis', group: 'returns', type: 'enum', options: afterSalesDateBases },
  { key: 'return_fallback_bases', group: 'returns', type: 'list', options: afterSalesDateBases },
  { key: 'return_opened', group: 'returns', type: 'enum', options: ['allowed', 'not_allowed', 'reason', 'manual'] },
  { key: 'return_packaging', group: 'returns', type: 'enum', options: ['not_required', 'preferred', 'required'] },
  { key: 'return_evidence', group: 'returns', type: 'enum', options: afterSalesEvidence },
  { key: 'return_shipping', group: 'returns', type: 'enum', options: afterSalesShipping },
  { key: 'policy_timezone', group: 'shared', type: 'timezone' }
]
