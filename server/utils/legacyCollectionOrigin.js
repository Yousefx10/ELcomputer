import { createError } from 'h3'
import { publicSeoClient, readSeoSettings } from './publicSeo.js'
import { publicSiteUrl } from '../../app/utils/seo.js'
export async function legacyCollectionOrigin(event) {
  const { client, config } = publicSeoClient(event)
  const settings = await readSeoSettings(client, { signal: event.context.legacyCollectionSignal })
  const origin = publicSiteUrl(settings, config.public.siteUrl)
  if (!origin) throw createError({ statusCode: 503, statusMessage: 'Public content is unavailable.' })
  return origin
}
