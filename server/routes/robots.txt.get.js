import { publicSeoClient, readSeoSettings } from '../utils/publicSeo'
import { publicSiteUrl, robotsText } from '../../app/utils/seo.js'

export default defineCachedEventHandler(async event => {
  const { client, config } = publicSeoClient(event)
  const settings = await readSeoSettings(client)
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  return robotsText(publicSiteUrl(settings, config.public.siteUrl))
}, { maxAge: 60, swr: false })
