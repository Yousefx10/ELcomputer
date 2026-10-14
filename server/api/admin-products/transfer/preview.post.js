import { getQuery } from 'h3'
import { requireAdminRequest } from '../../../utils/adminRequest'
import { privateProductResponse } from '../../../utils/productSave'
import {
  transferFormats,
  ensureTransferPreviewPermission,
  readTransferUpload,
  parseTransfer,
  transferPreview,
  throwTransfer,
} from '../../../utils/catalogTransfer'
export default defineEventHandler(async (event) => {
  privateProductResponse(event)
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'products.view',
  })
  ensureTransferPreviewPermission(adminUser)
  const query = getQuery(event)
  if (Object.keys(query).length !== 1 || !transferFormats.includes(query.format))
    throwTransfer({ catalogTransfer: 'invalid' })
  let bytes = await readTransferUpload(event)
  try {
    const tables = parseTransfer(bytes, query.format)
    return await transferPreview(supabaseAdmin, adminUser, tables)
  } finally {
    bytes.fill(0)
    bytes = null
    delete event._requestBody
  }
})
