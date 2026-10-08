import { claimError } from './afterSalesClaimValidation.js'

const rpcMessages = {
  'Reverse provider not ready.': 'reverseNotReady', 'Invalid pickup details.': 'pickup', 'Reverse city mapping required.': 'reverseCity',
  'Reverse booking conflict.': 'reverseConflict', 'Reverse item return required.': 'reverseReturn', 'Reverse response mismatch.': 'reverseMatch', 'Reverse refresh throttled.': 'reverseThrottle',
  'Claim eligibility denied.': 'eligibility', 'Claim transition denied.': 'transition', 'Claim resolution denied.': 'resolution',
  'Claim serial review required.': 'serialRequired', 'Claim evidence disabled.': 'evidenceDisabled', 'Claim evidence limit.': 'evidenceLimit',
  'Claim evidence unavailable.': 'evidence', 'Claim retry conflict.': 'conflict', 'Invalid claim input.': 'input'
}
export const runClaimRpc = async (db, name, args) => {
  const { data, error } = await db.rpc(name, args)
  if (error) {
    if (error.code === 'P0002') claimError('notFound', 404)
    if (error.code === '42501') claimError('forbidden', 403)
    if (error.code === '23505') claimError('duplicate', 409)
    if (error.code === '40001') claimError('conflict', 409)
    if (rpcMessages[error.message]) claimError(rpcMessages[error.message], error.code === '23514' ? 409 : 400)
    claimError('unavailable', 503)
  }
  return data
}
