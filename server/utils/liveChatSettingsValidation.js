import { createError } from 'h3'

const mimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const timePattern = /^([01][0-9]|2[0-3]):[0-5][0-9]$/
const boolean = (value, label) => {
  if (typeof value !== 'boolean') throw createError({ statusCode: 400, statusMessage: `${label} is invalid.` })
  return value
}
const integer = (value, label, minimum, maximum) => {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw createError({ statusCode: 400, statusMessage: `${label} is invalid.` })
  }
  return value
}
const text = (value, label, minimum, maximum) => {
  const result = String(value || '').trim()
  if (result.length < minimum || result.length > maximum) {
    throw createError({ statusCode: 400, statusMessage: `${label} is invalid.` })
  }
  return result
}
const choice = (value, label, choices) => {
  if (!choices.includes(value)) throw createError({ statusCode: 400, statusMessage: `${label} is invalid.` })
  return value
}
const weeklyHours = (source) => {
  if (!source || typeof source !== 'object' || Array.isArray(source)
    || Object.keys(source).sort().join(',') !== '0,1,2,3,4,5,6') {
    throw createError({ statusCode: 400, statusMessage: 'Business hours are invalid.' })
  }
  return Object.fromEntries([...Array(7).keys()].map((day) => {
    const slots = source[String(day)]
    if (!Array.isArray(slots) || slots.length > 3) {
      throw createError({ statusCode: 400, statusMessage: 'Business hours are invalid.' })
    }
    let previousEnd = ''
    const normalized = slots.map((slot) => {
      if (!Array.isArray(slot) || slot.length !== 2
        || !slot.every(value => typeof value === 'string' && timePattern.test(value))
        || slot[0] >= slot[1] || (previousEnd && slot[0] < previousEnd)) {
        throw createError({ statusCode: 400, statusMessage: 'Business hours overlap or are invalid.' })
      }
      previousEnd = slot[1]
      return [slot[0], slot[1]]
    })
    return [String(day), normalized]
  }))
}

export const normalizeChatSettings = (body = {}) => {
  const allowed = Array.isArray(body.allowed_attachment_mimes)
    ? [...new Set(body.allowed_attachment_mimes)] : []
  if (!allowed.length || allowed.length > mimes.length || allowed.some(item => !mimes.includes(item))) {
    throw createError({ statusCode: 400, statusMessage: 'Attachment types are invalid.' })
  }
  const ticketConversion = boolean(body.ticket_conversion_enabled, 'Ticket conversion')
  const offlineBehavior = choice(body.offline_behavior, 'Offline behavior', ['conversation', 'ticket'])
  if (offlineBehavior === 'ticket' && !ticketConversion) {
    throw createError({ statusCode: 400, statusMessage: 'Enable ticket conversion before ticket-based offline intake.' })
  }
  return {
    is_enabled: boolean(body.is_enabled, 'Chat status'),
    availability_override: choice(body.availability_override, 'Availability', ['auto', 'online', 'offline']),
    business_timezone: (() => {
      const value = text(body.business_timezone, 'Timezone', 3, 64)
      if (!/^[A-Za-z0-9_+./-]+$/.test(value)) throw createError({ statusCode: 400, statusMessage: 'Timezone is invalid.' })
      return value
    })(),
    weekly_hours: weeklyHours(body.weekly_hours),
    welcome_message: text(body.welcome_message, 'Welcome message', 1, 500),
    offline_message: text(body.offline_message, 'Offline message', 1, 500),
    guest_contact_rule: choice(body.guest_contact_rule, 'Guest contact rule', ['either', 'email', 'mobile', 'both']),
    customer_send_cooldown_seconds: integer(body.customer_send_cooldown_seconds, 'Send delay', 0, 60),
    max_message_length: integer(body.max_message_length, 'Message length', 100, 10000),
    attachments_enabled: boolean(body.attachments_enabled, 'Attachments'),
    allowed_attachment_mimes: allowed,
    max_attachment_bytes: integer(body.max_attachment_bytes, 'Attachment size', 1024, 5242880),
    max_attachments_per_message: integer(body.max_attachments_per_message, 'Attachment count', 0, 5),
    transfers_enabled: boolean(body.transfers_enabled, 'Transfers'),
    reopen_enabled: boolean(body.reopen_enabled, 'Reopening'),
    offline_behavior: offlineBehavior,
    ticket_conversion_enabled: ticketConversion
  }
}
