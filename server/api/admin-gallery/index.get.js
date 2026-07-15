import { getQuery } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { listUploadedImages } from '../../utils/uploads'

export default defineEventHandler(async (event) => {
  await requireAdminRequest(event, {
    permission: 'settings.view'
  })

  const query = getQuery(event)
  const searchTerm = String(query.q || '').trim()
  const page = Number.parseInt(String(query.page || '1'), 10)
  const limit = Number.parseInt(String(query.limit || '24'), 10)
  const result = await listUploadedImages(searchTerm, {
    page,
    limit
  })

  return result
})
