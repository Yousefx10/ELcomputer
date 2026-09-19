export const supportStatuses = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'waiting_for_customer', label: 'Waiting for you' },
  { value: 'waiting_for_support', label: 'Waiting for support' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' }
]

export const supportPriorities = ['low', 'normal', 'high', 'urgent']
export const supportStatusLabel = (value, audience = 'customer') => {
  if (audience === 'staff' && value === 'waiting_for_customer') return 'Waiting for customer'
  return supportStatuses.find(item => item.value === value)?.label || 'Open'
}
export const supportReference = value => `SUP-${String(value || 0).padStart(6, '0')}`
export const supportDate = value => value ? new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium', timeStyle: 'short'
}).format(new Date(value)) : '—'
