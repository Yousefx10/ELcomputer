import { readPublicSeoDiscovery, SITEMAP_PAGE_SIZE } from '../../utils/publicSeo'
import { sitemapXml } from '../../../app/utils/seo.js'

export default defineEventHandler(async event => {
  // Nitro treats suffixes inside dynamic segment names as part of the parameter.
  // Match the whole filename, then validate and remove its extension.
  const filename = getRouterParam(event, 'page')
  if (!/^[1-9]\d*\.xml$/.test(filename || '')) throw createError({ statusCode: 404, statusMessage: 'Sitemap not found.' })
  const value = filename.slice(0, -4)
  const { base, routes } = await readPublicSeoDiscovery()
  const offset = (Number(value) - 1) * SITEMAP_PAGE_SIZE
  if (offset >= routes.length) throw createError({ statusCode: 404, statusMessage: 'Sitemap not found.' })
  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=60')
  return sitemapXml(routes.slice(offset, offset + SITEMAP_PAGE_SIZE), base)
})
