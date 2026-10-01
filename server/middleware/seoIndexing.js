import { isPrivateSeoPath } from '../../app/utils/seo.js'

export default defineEventHandler(event => {
  // Also covers authentication redirects, which have no HTML head.
  if (isPrivateSeoPath(event.path)) setHeader(event, 'X-Robots-Tag', 'noindex,follow')
})
