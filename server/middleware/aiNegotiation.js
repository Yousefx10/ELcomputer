import { appendResponseHeader, createError, getHeader, getQuery, getRequestURL } from 'h3'
import { aiHtmlResource, prefersAiMarkdown } from '../../app/utils/aiReadiness.js'
import { publicAiHandler, servePublicAiResource } from '../utils/publicAi.js'

export default defineEventHandler(async event => {
  if (!['GET', 'HEAD'].includes(event.method)) return
  const url = getRequestURL(event)
  // H3 sanitizes prototype-like query names. Check raw names too so they cannot
  // silently bypass the same strict query policy as explicit Markdown URLs.
  const match = aiHtmlResource(url.pathname, getQuery(event), [...url.searchParams.keys()])
  if (!match) return
  // Both HTML and Markdown vary, including failures. Never key on bot identity.
  appendResponseHeader(event, 'Vary', 'Accept')
  if (!prefersAiMarkdown(getHeader(event, 'Accept'))) return
  return publicAiHandler(async event => {
    if (match.invalidQuery) throw createError({ statusCode: 400 })
    return servePublicAiResource(event, match.resource)
  })(event)
})
