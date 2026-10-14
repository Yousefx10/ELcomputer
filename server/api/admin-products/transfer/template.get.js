import { getQuery, send, setHeader } from 'h3'
import { requireAdminRequest } from '../../../utils/adminRequest'
import { privateProductResponse } from '../../../utils/productSave'
import {
  transferFormats,
  transferSnapshot,
  transferBytes,
  throwTransfer,
} from '../../../utils/catalogTransfer'
export default defineEventHandler(async (event) => {
  privateProductResponse(event)
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
      permission: 'products.view',
    }),
    query = getQuery(event)
  if (Object.keys(query).length !== 1 || !transferFormats.includes(query.format))
    throwTransfer({ catalogTransfer: 'invalid' })
  const snapshot = await transferSnapshot(supabaseAdmin, adminUser, { purpose: 'template' }),
    bytes = transferBytes(snapshot, query.format)
  setHeader(
    event,
    'Content-Type',
    query.format === 'csv'
      ? 'text/csv; charset=utf-8'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  setHeader(
    event,
    'Content-Disposition',
    `attachment; filename="catalog-v1-template.${query.format}"`,
  )
  return send(event, bytes)
})
