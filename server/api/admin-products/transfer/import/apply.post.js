import { getQuery } from 'h3'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import { privateProductResponse } from '../../../../utils/productSave'
import {
  ensureTransferPreviewPermission,
  readTransferUpload,
  parseTransfer,
} from '../../../../utils/catalogTransfer'
import { importInput, applyImport } from '../../../../utils/catalogImport'
export default defineEventHandler(async (event) => {
  privateProductResponse(event)
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'products.view',
  })
  ensureTransferPreviewPermission(adminUser)
  const input = importInput(
    getQuery(event),
    ['format', 'job_id', 'review_hash'],
    ['format', 'job_id', 'review_hash'],
  )
  let bytes = await readTransferUpload(event)
  try {
    return await applyImport(supabaseAdmin, adminUser, parseTransfer(bytes, input.format), input)
  } finally {
    bytes.fill(0)
    bytes = null
    delete event._requestBody
  }
})
