import { requireAdminRequest } from '../../../utils/adminRequest'
import { pdpId, privatePresentationResponse, presentationError, readPresentationBytes, presentationCommand } from '../../../utils/productPresentation'

export default defineEventHandler(async event => {
  privatePresentationResponse(event)
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'products.edit' })
  let body
  try { body = JSON.parse((await readPresentationBytes(event)).toString('utf8')) } catch (error) { if (error.statusCode) throw error; presentationError({ message: 'pdp:invalid' }) }
  const { data, error } = await supabaseAdmin.rpc('catalog_save_product_presentation', {
    p_admin_id: adminUser.id, p_product_id: pdpId(event.context.params?.id), ...presentationCommand(body)
  })
  if (error) presentationError(error)
  return data
})
