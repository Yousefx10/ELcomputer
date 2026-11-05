import {setHeader} from 'h3'
import {requireAdminRequest} from '../../utils/adminRequest'
import {publicImageCacheSettings,publicImageCacheDiagnostics} from '../../utils/publicImageCache'
export default defineEventHandler(async event=>{
  setHeader(event,'Cache-Control','private, no-store')
  await requireAdminRequest(event,{permission:'settings.view'})
  return {settings:await publicImageCacheSettings(),diagnostics:publicImageCacheDiagnostics(),configurationRefreshSeconds:15,validators:['ETag','Last-Modified'],
    delivery:'vps-originals',serverTransformationCache:false,browserStorageLimit:null,scope:'public-upload-images'}
})
