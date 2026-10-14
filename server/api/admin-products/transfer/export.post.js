import { send, setHeader } from 'h3'
import { requireAdminRequest } from '../../../utils/adminRequest'
import { privateProductResponse } from '../../../utils/productSave'
import {
  transferExportInput,
  transferSnapshot,
  transferBytes,
  readTransferUpload,
  throwTransfer,
} from '../../../utils/catalogTransfer'
export default defineEventHandler(async (event) => {
  privateProductResponse(event)
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'products.view',
  })
  let bytesIn = await readTransferUpload(event, 20000),
    body
  try {
    body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytesIn))
  } catch {
    throwTransfer({ catalogTransfer: 'invalid' })
  } finally {
    bytesIn.fill(0)
    bytesIn = null
    delete event._requestBody
  }
  const input = transferExportInput(body),
    snapshot = await transferSnapshot(supabaseAdmin, adminUser, { purpose: 'export', ...input }),
    bytes = transferBytes(snapshot, input.format)
  setHeader(
    event,
    'Content-Type',
    input.format === 'csv'
      ? 'text/csv; charset=utf-8'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  setHeader(
    event,
    'Content-Disposition',
    `attachment; filename="catalog-v1-${input.scope}.${input.format}"`,
  )
  return send(event, bytes)
})
