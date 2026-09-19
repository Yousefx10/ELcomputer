import { createError } from 'h3'

// Database diagnostics belong in server logs, not in authentication responses.
export const throwRequestDatabaseError = (accountType, error) => {
  console.error(`${accountType} account lookup failed`, {
    code: error?.code || 'unknown',
    message: error?.message || 'unknown database error'
  })
  throw createError({
    statusCode: 500,
    statusMessage: 'Could not verify your account. Please try again.'
  })
}
