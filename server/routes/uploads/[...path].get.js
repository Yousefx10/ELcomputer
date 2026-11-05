import { createError, getQuery, getHeader, getMethod, sendStream, sendError, setHeader, setResponseStatus, removeResponseHeader } from 'h3'
import { openUploadImage, getBlankImageSvg, getUploadContentType } from '../../utils/uploads'
import { productVideoPattern, serveProductVideo } from '../../utils/productVideos'
import {publicImageCacheSettings,publicImageValidators,imageNotModified,recordPublicImageResponse} from '../../utils/publicImageCache'

export default defineEventHandler(async event => {
  setHeader(event,'Cache-Control','no-store')
  const routePath=event.context.params?.path
  const path=Array.isArray(routePath)?routePath.join('/'):String(routePath||'')
  if(productVideoPattern.test(path)) return serveProductVideo(event,path)
  try {
    const {handle,stat}=await openUploadImage(path)
    const config=await publicImageCacheSettings(),validators=publicImageValidators(stat,config)
    setHeader(event,'Content-Type',getUploadContentType(path))
    setHeader(event,'Content-Length',String(stat.size))
    setHeader(event,'Cache-Control',validators.cache)
    setHeader(event,'ETag',validators.etag)
    setHeader(event,'Last-Modified',validators.modified)
    setHeader(event,'X-Content-Type-Options','nosniff')
    // Existing SVGs remain images, with active content and external requests blocked.
    setHeader(event,'Content-Security-Policy',"sandbox; default-src 'none'; style-src 'unsafe-inline'")
    const download=String(getQuery(event).download||'')==='1'
    if(download){setHeader(event,'Cache-Control','no-store');setHeader(event,'Content-Disposition',`attachment; filename="${path.split('/').pop()}"`)}
    if(!download&&config.enabled&&imageNotModified(getHeader(event,'if-none-match'),validators.etag)){
      await handle.close();recordPublicImageResponse(304,stat.size,getMethod(event)==='HEAD');setResponseStatus(event,304);return null
    }
    // H3 maps null to 204. HEAD must preserve GET's 200 and image headers.
    if(getMethod(event)==='HEAD'){await handle.close();recordPublicImageResponse(200,stat.size,true);return ''}
    if(!download)recordPublicImageResponse(200,stat.size)
    return sendStream(event,handle.createReadStream())
  } catch(error) {
    setHeader(event,'Cache-Control','no-store')
    for(const header of ['ETag','Last-Modified','Content-Length'])removeResponseHeader(event,header)
    // Nitro's thrown-error renderer replaces this header with no-cache.
    // Complete the existing sanitized denial here to keep it unstoreable.
    if(error.code!=='ENOENT') return sendError(event,error.statusCode?error:createError({statusCode:404,statusMessage:'Image not found.'}))
    setHeader(event,'Content-Type','image/svg+xml; charset=utf-8')
    setHeader(event,'Cache-Control','no-store')
    setHeader(event,'X-Content-Type-Options','nosniff')
    setHeader(event,'Content-Security-Policy',"sandbox; default-src 'none'")
    return getBlankImageSvg()
  }
})
