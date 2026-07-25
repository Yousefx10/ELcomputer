export const CRM_REPORTING_TIME_ZONE = 'Asia/Riyadh'
export const CRM_REPORTING_PERIODS = new Set([
  'today',
  'this_week',
  'last_week',
  'this_month'
])

const RIYADH_OFFSET_HOURS = 3

const getRiyadhCalendarDate = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: CRM_REPORTING_TIME_ZONE,
    year: 'numeric'
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return {
    year: Number(values.year),
    monthIndex: Number(values.month) - 1,
    day: Number(values.day)
  }
}

const riyadhMidnightIso = (year, monthIndex, day) => {
  return new Date(Date.UTC(
    year,
    monthIndex,
    day,
    -RIYADH_OFFSET_HOURS
  )).toISOString()
}

export const getCrmReportingPeriodRange = (period, now = new Date()) => {
  const normalizedPeriod = CRM_REPORTING_PERIODS.has(period) ? period : 'today'
  const { year, monthIndex, day } = getRiyadhCalendarDate(now)
  const calendarDay = new Date(Date.UTC(year, monthIndex, day))
  const weekday = calendarDay.getUTCDay()
  let start
  let end

  if (normalizedPeriod === 'this_week') {
    start = riyadhMidnightIso(year, monthIndex, day - weekday)
    end = riyadhMidnightIso(year, monthIndex, day + (7 - weekday))
  } else if (normalizedPeriod === 'last_week') {
    start = riyadhMidnightIso(year, monthIndex, day - weekday - 7)
    end = riyadhMidnightIso(year, monthIndex, day - weekday)
  } else if (normalizedPeriod === 'this_month') {
    start = riyadhMidnightIso(year, monthIndex, 1)
    end = riyadhMidnightIso(year, monthIndex + 1, 1)
  } else {
    start = riyadhMidnightIso(year, monthIndex, day)
    end = riyadhMidnightIso(year, monthIndex, day + 1)
  }

  return {
    start,
    end
  }
}
