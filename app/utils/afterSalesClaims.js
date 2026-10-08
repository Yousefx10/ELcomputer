// Presentation metadata only. The database owns admission and transitions.
export const claimTypes = ['return', 'warranty']
export const claimStatuses = ['submitted', 'under_review', 'more_information_required', 'approved', 'rejected', 'pickup_scheduled', 'in_transit', 'received', 'under_inspection', 'resolution_in_progress', 'resolved', 'cancelled']
export const claimTerminalStatuses = ['resolved', 'rejected', 'cancelled']
export const claimResolutions = ['repair', 'replacement', 'refund', 'service_center']
export const claimActionPermissions = {
  review: 'claims.review', request_information: 'claims.review', verify_serial: 'claims.review',
  approve: 'claims.decide', reject: 'claims.decide', receive: 'claims.manage', inspect: 'claims.manage',
  select_resolution: 'claims.resolution', resolve: 'claims.resolution', cancel: 'claims.manage', note: 'claims.notes'
}
export const claimDate = (value, locale = 'en-GB') => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date) : '—'
}
export const claimErrorKey = error => `claims.errors.${error?.data?.data?.code || error?.data?.code || 'unavailable'}`
