import { setHeader } from 'h3'
// Protect successful payment pages/API responses at the boundary; APIs also sanitize errors in paymentHandler.
export default defineNitroPlugin(nitro => {
  nitro.hooks.hook('beforeResponse', event => {
    const path = event.path.split('?')[0]
    if (path.startsWith('/api/payments/') || /^\/(?:ar\/)?checkout\/payment(?:\/|-result(?:\/|$)|$)/.test(path)) {
      setHeader(event, 'Cache-Control', 'private, no-store')
      setHeader(event, 'Referrer-Policy', 'no-referrer')
    }
  })
})
