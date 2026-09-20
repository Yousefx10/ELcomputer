export const mergeChatMessages = (current = [], incoming = []) => {
  const items = new Map(current.map(message => [message.id, message]))
  for (const message of incoming) items.set(message.id, message)
  return [...items.values()].sort((a, b) => Number(a.sequence_number) - Number(b.sequence_number))
}

export const chatSecondsRemaining = (sentAt, cooldownSeconds, now = Date.now()) => {
  if (!sentAt || !cooldownSeconds) return 0
  const end = new Date(sentAt).getTime() + Number(cooldownSeconds) * 1000
  return Math.max(0, Math.ceil((end - now) / 1000))
}

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
