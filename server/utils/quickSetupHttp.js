import { setHeader, setResponseStatus } from 'h3'
export const setupPrivacyHeaders = event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
}
export const setupSafeError = (event, error) => {
  const statusCode = [400, 401, 403, 409, 429].includes(error?.statusCode) ? error.statusCode : 503
  const statusMessage = { 400: 'Invalid setup request.', 401: 'Owner access is required.', 403: 'Owner access is required.', 409: 'Setup changed. Refresh before saving.', 429: 'Too many setup updates. Try again shortly.', 503: 'Setup status is unavailable.' }[statusCode]
  setResponseStatus(event, statusCode)
  return { error: true, statusCode, statusMessage }
}
