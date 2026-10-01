import { getResponseHeader } from 'h3'
import { aiLinkHeader } from '../../app/utils/aiReadiness.js'
import { isPrivateSeoPath } from '../../app/utils/seo.js'

export default defineNitroPlugin(nitroApp => {
  nitroApp.hooks.hook('render:response', (response, { event }) => {
    if (response.statusCode !== 200 || isPrivateSeoPath(event.path)) return
    if (!String(response.headers?.['content-type'] || '').startsWith('text/html')) return
    // SEO provides the final, publication-aware relationships after SSR.
    const links = event.context.publicAiLinks || []
    if (!links.length) return
    const existing = [getResponseHeader(event, 'Link'), response.headers.link].filter(Boolean)
    response.headers.link = [...new Set([...existing, aiLinkHeader(links)])].join(', ')
  })
})
