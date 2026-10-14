import { requireAdminRequest } from '../../../../utils/adminRequest'
import { privateProductResponse } from '../../../../utils/productSave'
import { ensureTransferPreviewPermission } from '../../../../utils/catalogTransfer'
import { importInput, importRpc, readImportAction } from '../../../../utils/catalogImport'
export default defineEventHandler(async (event) => {
  privateProductResponse(event)
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'products.view',
  })
  ensureTransferPreviewPermission(adminUser)
  const input = importInput(
    await readImportAction(event),
    ['job_id', 'review_hash'],
    ['job_id', 'review_hash'],
  )

  return importRpc(supabaseAdmin, 'catalog_import_cancel', {
    p_admin_id: adminUser.id,
    p_job_id: input.job_id,
    p_review: input.review_hash,
  })
})
