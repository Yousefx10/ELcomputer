import { getQuery } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { listUploadedImages } from '../../utils/uploads'

export default defineEventHandler(async (event) => {
  await requireAdminRequest(event, {
    permission: 'settings.view'
  })

  const query = getQuery(event)
  const searchTerm = String(query.q || '').trim()
  const items = await listUploadedImages(searchTerm)

  return {
    items
  }
})
