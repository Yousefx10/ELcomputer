export const NPS_MIN_SCORE = 0
export const NPS_MAX_SCORE = 10
export const NPS_FEEDBACK_MAX_LENGTH = 999
export const NPS_PERIOD_DAYS = 90

const normalizeNonNegativeCount = (value) => {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0
  }

  return Math.floor(numericValue)
}

const roundNpsScore = (value) => {
  return value < 0
    ? -Math.round(Math.abs(value))
    : Math.round(value)
}

export const calculateNpsFromCounts = ({
  total,
  promoters,
  passives,
  detractors
} = {}) => {
  const normalizedPromoters = normalizeNonNegativeCount(promoters)
  const normalizedPassives = normalizeNonNegativeCount(passives)
  const normalizedDetractors = normalizeNonNegativeCount(detractors)
  const categorizedTotal = normalizedPromoters + normalizedPassives + normalizedDetractors
  const normalizedTotal = Math.max(normalizeNonNegativeCount(total), categorizedTotal)

  return {
    score: normalizedTotal
      ? roundNpsScore(
          (
            (normalizedPromoters / normalizedTotal)
            - (normalizedDetractors / normalizedTotal)
          ) * 100
        )
      : null,
    total: normalizedTotal,
    promoters: normalizedPromoters,
    passives: normalizedPassives,
    detractors: normalizedDetractors
  }
}

export const calculateNps = (responses = []) => {
  const scores = Array.isArray(responses)
    ? responses
        .map((response) => Number(
          typeof response === 'object' && response !== null
            ? response.score
            : response
        ))
        .filter((score) => (
          Number.isInteger(score)
          && score >= NPS_MIN_SCORE
          && score <= NPS_MAX_SCORE
        ))
    : []

  const promoters = scores.filter((score) => score >= 9).length
  const passives = scores.filter((score) => score >= 7 && score <= 8).length
  const detractors = scores.filter((score) => score <= 6).length

  return calculateNpsFromCounts({
    total: scores.length,
    promoters,
    passives,
    detractors
  })
}
