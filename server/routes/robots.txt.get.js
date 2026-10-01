import { publicSeoClient, readSeoSettings } from '../utils/publicSeo'
import { publicSiteUrl } from '../../app/utils/seo.js'
import { aiRobotsText } from '../../app/utils/aiReadiness.js'

export default defineCachedEventHandler(async event => {
  const { client, config } = publicSeoClient(event)
  const settings = await readSeoSettings(client)
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  return aiRobotsText(publicSiteUrl(settings, config.public.siteUrl), config)
}, { maxAge: 60, swr: false })
