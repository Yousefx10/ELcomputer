export const mergeChatMessages = (current = [], incoming = []) => {
  const items = new Map(current.map(message => [message.id, message]))
  for (const message of incoming) items.set(message.id, message)
  return [...items.values()].sort((a, b) => Number(a.sequence_number) - Number(b.sequence_number))
}

export const mergeChatEvents = (current = [], incoming = []) => {
  const items = new Map(current.map(entry => [entry.id, entry]))
  for (const entry of incoming) items.set(entry.id, entry)
  return [...items.values()].sort((a, b) =>
    b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
}

export const chatAuditDescription = (entry = {}) => {
  const actor = entry.actor_name || (entry.actor_kind === 'system' ? 'System' : 'Unknown actor')
  const from = entry.old_assignee_name || 'Unassigned'
  const to = entry.new_assignee_name || 'Unassigned'
  switch (entry.event_type) {
    case 'created': return `${actor} started this chat`
    case 'identified': return `${actor} identified this chat`
    case 'claimed': return `${actor} claimed this chat`
    case 'assigned': return `${actor} assigned ${to}`
    case 'transferred': return `${actor} transferred ${from} → ${to}`
    case 'agent_replied': return `${actor} replied`
    case 'closed': return `${actor} closed this chat`
    case 'reopened': return `${actor} reopened this chat`
    case 'status_changed': return `Status: ${entry.old_status || 'unknown'} → ${entry.new_status || 'unknown'}`
    case 'order_linked': return entry.old_order_id
      ? `${actor} changed order ${entry.old_order_id.slice(0, 8)} → ${entry.new_order_id?.slice(0, 8) || 'unknown'}`
      : `${actor} linked order ${entry.new_order_id?.slice(0, 8) || 'unknown'}`
    case 'order_unlinked': return `${actor} unlinked order ${entry.old_order_id?.slice(0, 8) || 'unknown'}`
    case 'ticket_created': return `${actor} created support ticket #${entry.ticket_reference || 'unknown'}`
    default: return entry.event_type ? entry.event_type.replaceAll('_', ' ') : 'Activity'
  }
}

export const chatSecondsRemaining = (sentAt, cooldownSeconds, now = Date.now()) => {
  if (!sentAt || !cooldownSeconds) return 0
  const end = new Date(sentAt).getTime() + Number(cooldownSeconds) * 1000
  return Math.max(0, Math.ceil((end - now) / 1000))
}

export const chatRetryAfterSeconds = (error) => {
  const header = error?.response?.headers?.get?.('retry-after')
  const values = [error?.data?.data?.retryAfter, error?.data?.retryAfter,
    error?.response?._data?.data?.retryAfter, header]
  const seconds = values.map(Number).find(value => Number.isFinite(value) && value > 0)
  return seconds ? Math.min(86400, Math.ceil(seconds)) : 0
}

export const chatSendWaitText = (seconds) => Number(seconds) <= 60
  ? `Send again in ${Math.max(1, Math.ceil(Number(seconds)))}s`
  : 'Sending is temporarily paused.'

export const chatMobileValid = value => /^\+?[0-9 ()-]{7,30}$/.test(String(value || '').trim())

export const chatContactValid = (name, email, mobile, rule = 'either') => {
  const cleanName = String(name || '').trim()
  const cleanEmail = String(email || '').trim()
  const cleanMobile = String(mobile || '').trim()
  const emailValid = !cleanEmail || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)
  const mobileValid = !cleanMobile || chatMobileValid(cleanMobile)
  if (!cleanName || cleanName.length > 160 || !emailValid || !mobileValid) return false
  if (rule === 'both') return Boolean(cleanEmail && cleanMobile)
  if (rule === 'email') return Boolean(cleanEmail)
  if (rule === 'mobile') return Boolean(cleanMobile)
  return Boolean(cleanEmail || cleanMobile)
}

export const chatDateText = (value, options = {}) => {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return '—'
  const { locale, timeZone } = options
  return new Intl.DateTimeFormat(locale, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    ...(timeZone ? { timeZone } : {})
  }).format(date)
}

export const chatDateTitle = (value, options = {}) => {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return ''
  const { locale, timeZone } = options
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
    ...(timeZone ? { timeZone } : {})
  }).format(date)
}
