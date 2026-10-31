import { createError, defineEventHandler, sendRedirect, setHeader, getRequestURL } from 'h3'
import { legacyCollectionIntent, resolveLegacyCollection } from '../utils/legacyCollection.js'
import { legacyCollectionOrigin } from '../utils/legacyCollectionOrigin.js'
import { legacyCollectionCount } from '../utils/legacyCollectionCatalog.js'
export default defineEventHandler(async event => {
  const raw = event.node.req.url
  if (!['GET', 'HEAD'].includes(event.method)) return
  const action = raw.split('?')[0].match(/^(\/ar)?\/(contact|request-refund)\/$/)
  if (action) {
    event.context.legacyCollectionSignal = AbortSignal.timeout(5000)
    return sendRedirect(event, new URL(`${action[1] || ''}/${action[2]}`, await legacyCollectionOrigin(event)).href, 301)
  }
  const intent = legacyCollectionIntent(raw, event.method)
  if (!intent) return
  if (intent.invalid) { setHeader(event, 'X-Robots-Tag', 'noindex,follow'); throw createError({ statusCode: 404, statusMessage: 'Page not found.' }) }
  event.context.legacyCollectionSignal = AbortSignal.timeout(5000)
  if (intent.canonical) {
    const origin = await legacyCollectionOrigin(event)
    if (getRequestURL(event, { xForwardedProto: true }).origin !== origin) return sendRedirect(event, new URL(intent.target, origin).href, 301)
    return
  }
  setHeader(event, 'Cache-Control', 'no-store')
  const result = await resolveLegacyCollection(intent, query => legacyCollectionCount(event, query)).catch(error => { setHeader(event, 'X-Robots-Tag', 'noindex,follow'); throw error })
  if (result.status === 301) return sendRedirect(event, new URL(result.location, await legacyCollectionOrigin(event)).href, 301)
  if (result.status !== 200) { setHeader(event, 'X-Robots-Tag', 'noindex,follow'); throw createError({ statusCode: result.status, statusMessage: result.status === 404 ? 'Page not found.' : 'Public content is unavailable.' }) }
})
