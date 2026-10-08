import { exact, claimError, claimUuid } from './afterSalesClaimValidation.js'

const clean = (value, maximum) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum || /[\x00-\x1f\x7f]/.test(value)) claimError('pickup')
  return value.trim()
}
export const validateReverseBooking = body => {
  exact(body, ['revision', 'idempotency_key', 'pickup', 'handling_resolution', 'reason', 'return_required', 'previous_job_id'])
  if (!Number.isInteger(body.revision) || body.revision < 1 || body.return_required !== true || !['repair', 'replacement', 'refund'].includes(body.handling_resolution)) claimError('input')
  exact(body.pickup, ['name', 'phone', 'address', 'city_mapping_id'])
  const phone = clean(body.pickup.phone, 40).replace(/\s+/g, '')
  if (!/^01\d{9}$/.test(phone)) claimError('pickup')
  return { key: claimUuid(body.idempotency_key), revision: body.revision, input: {
    pickup: { name: clean(body.pickup.name, 100), phone, address: clean(body.pickup.address, 1000), city_mapping_id: claimUuid(body.pickup.city_mapping_id) },
    handling_resolution: body.handling_resolution, reason: clean(body.reason, 1000), return_required: true,
    ...(body.previous_job_id ? { previous_job_id: claimUuid(body.previous_job_id) } : {})
  } }
}
export const validateReverseOperation = body => {
  exact(body, ['job_id', 'action'])
  if (!['refresh', 'recover', 'label'].includes(body.action)) claimError('input')
  return { job: claimUuid(body.job_id), action: body.action }
}
