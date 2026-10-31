import { createError, defineEventHandler, sendRedirect, setHeader } from 'h3'
import { publicSeoClient } from '../utils/publicSeo.js'
import { legacyProductQueryIntent, resolveLegacyProductQuery } from '../utils/legacyProductQuery.js'

export default defineEventHandler(async event => {
  const intent = legacyProductQueryIntent(event.node.req.url, event.method)
  if (!intent) return
  setHeader(event, 'Cache-Control', 'no-store')
  const result = await resolveLegacyProductQuery(intent, async slug => {
    const { client } = publicSeoClient(event)
    const response = await client.from('products').select('slug,is_published').eq('slug', slug).eq('is_published', true).abortSignal(AbortSignal.timeout(5000)).maybeSingle()
    if (response.error) throw createError({ statusCode: 503, statusMessage: 'Public content is unavailable.' })
    return response.data
  }).catch(error => {
    setHeader(event, 'X-Robots-Tag', 'noindex,follow')
    throw error
  })
  if (result.status === 301) return sendRedirect(event, result.location, 301)
  setHeader(event, 'X-Robots-Tag', 'noindex,follow')
  throw createError({ statusCode: 404, statusMessage: 'Product not found.' })
})
