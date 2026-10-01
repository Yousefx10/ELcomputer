import { readPublicSeoDiscovery, sitemapDocument } from '../utils/publicSeo'

export default defineEventHandler(async event => {
  const discovery = await readPublicSeoDiscovery()
  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=60')
  return sitemapDocument(discovery)
})
