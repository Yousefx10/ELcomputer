import { getQuery, setHeader } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { listUploadedImages } from '../../utils/uploads'

export default defineEventHandler(async (event) => {
  const { adminUser } = await requireAdminRequest(event)
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')

  const query = getQuery(event)
  const searchTerm = String(query.q || '').trim()
  const page = Number.parseInt(String(query.page || '1'), 10)
  const limit = Number.parseInt(String(query.limit || '24'), 10)
  const result = await listUploadedImages(searchTerm, {
    page,
    limit,
    adminUser,
    section: query.section
  })

  return result
})
