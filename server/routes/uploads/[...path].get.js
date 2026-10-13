import { createError, getQuery, sendStream, setHeader } from 'h3'
import { openUploadImage, getBlankImageSvg, getUploadContentType } from '../../utils/uploads'

export default defineEventHandler(async event => {
  const routePath=event.context.params?.path
  const path=Array.isArray(routePath)?routePath.join('/'):String(routePath||'')
  try {
    const {handle,stat}=await openUploadImage(path)
    setHeader(event,'Content-Type',getUploadContentType(path))
    setHeader(event,'Content-Length',String(stat.size))
    setHeader(event,'Cache-Control','no-cache')
    setHeader(event,'X-Content-Type-Options','nosniff')
    // Existing SVGs remain images, with active content and external requests blocked.
    setHeader(event,'Content-Security-Policy',"sandbox; default-src 'none'; style-src 'unsafe-inline'")
    if(String(getQuery(event).download||'')==='1') setHeader(event,'Content-Disposition',`attachment; filename="${path.split('/').pop()}"`)
    return sendStream(event,handle.createReadStream())
  } catch(error) {
    if(error.code!=='ENOENT') throw error.statusCode?error:createError({statusCode:404,statusMessage:'Image not found.'})
    setHeader(event,'Content-Type','image/svg+xml; charset=utf-8')
    setHeader(event,'Cache-Control','no-store')
    setHeader(event,'X-Content-Type-Options','nosniff')
    setHeader(event,'Content-Security-Policy',"sandbox; default-src 'none'")
    return getBlankImageSvg()
  }
})
