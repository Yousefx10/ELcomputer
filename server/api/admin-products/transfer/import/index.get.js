import { getQuery } from 'h3'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import { privateProductResponse } from '../../../../utils/productSave'
import { ensureTransferPreviewPermission } from '../../../../utils/catalogTransfer'
import { importInput, importRpc } from '../../../../utils/catalogImport'
export default defineEventHandler(async (event) => {
  privateProductResponse(event)
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'products.view',
  })
  ensureTransferPreviewPermission(adminUser)
  const input = importInput(getQuery(event), ['job_id'])
  return input.job_id
    ? importRpc(supabaseAdmin, 'catalog_import_status', {
        p_admin_id: adminUser.id,
        p_job_id: input.job_id,
      })
    : importRpc(supabaseAdmin, 'catalog_import_options', { p_admin_id: adminUser.id })
})
