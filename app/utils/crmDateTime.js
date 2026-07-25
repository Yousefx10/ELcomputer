export const CRM_TIME_ZONE = 'Asia/Riyadh'

const RIYADH_OFFSET_MILLISECONDS = 3 * 60 * 60 * 1000

export const formatCrmDate = (value) => {
  if (!value) {
    return 'Recently'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: CRM_TIME_ZONE
  }).format(new Date(value))
}

export const toCrmDateTimeInputValue = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value)

  if (!Number.isFinite(date.getTime())) {
    return ''
  }

  return new Date(date.getTime() + RIYADH_OFFSET_MILLISECONDS)
    .toISOString()
    .slice(0, 16)
}

export const parseCrmDateTimeInput = (value, label) => {
  const normalizedValue = String(value || '').trim()
  const match = normalizedValue.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  )

  if (!match) {
    throw new Error(`${label} is required.`)
  }

  const [, year, month, day, hour, minute, second = '0'] = match
  const calendarTimestamp = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  )
  const calendarDate = new Date(calendarTimestamp)
  const isValid = calendarDate.getUTCFullYear() === Number(year)
    && calendarDate.getUTCMonth() === Number(month) - 1
    && calendarDate.getUTCDate() === Number(day)
    && calendarDate.getUTCHours() === Number(hour)
    && calendarDate.getUTCMinutes() === Number(minute)
    && calendarDate.getUTCSeconds() === Number(second)

  if (!isValid) {
    throw new Error(`${label} is invalid.`)
  }

  return new Date(calendarTimestamp - RIYADH_OFFSET_MILLISECONDS).toISOString()
}

export const toCrmDateBoundary = (value, dayOffset = 0) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return undefined

  const [, year, month, day] = match
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day) + dayOffset
    ) - RIYADH_OFFSET_MILLISECONDS
  ).toISOString()
}
