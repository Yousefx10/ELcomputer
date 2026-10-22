import { getHeader } from 'h3'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import { pdpId, privatePresentationResponse, presentationError, readPresentationBytes, PDP_MAX_VIDEO_BYTES } from '../../../../utils/productPresentation'
import { saveProductVideo } from '../../../../utils/productVideos'

export default defineEventHandler(async event => {
  privatePresentationResponse(event)
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'products.edit' })
  const productId = pdpId(event.context.params?.id), assetId = pdpId(event.context.params?.assetId)
  // Authorize this current product before reading or writing a potentially large file.
  const access = await supabaseAdmin.rpc('catalog_product_presentation', { p_admin_id: adminUser.id, p_product_id: productId })
  if (access.error) presentationError(access.error)
  const bytes = await readPresentationBytes(event, PDP_MAX_VIDEO_BYTES), mime = String(getHeader(event, 'content-type') || '').split(';')[0].trim()
  const proof = await saveProductVideo(bytes, assetId, mime)
  const { data, error } = await supabaseAdmin.rpc('catalog_register_product_video', {
    p_admin_id: adminUser.id, p_product_id: productId, p_id: assetId, p_mime_type: proof.mime_type,
    p_size_bytes: proof.size_bytes, p_sha256: proof.sha256, p_duration: proof.duration_seconds
  })
  if (error) presentationError(error)
  return data
})
