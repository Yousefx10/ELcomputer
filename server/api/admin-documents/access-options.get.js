import { requireAdminRequest } from '../../utils/adminRequest'
import {
  getDocumentsAccessOptions,
  requireDocumentsPermission
} from '../../utils/documents'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event)

  requireDocumentsPermission(adminUser, { write: true })

  return {
    items: await getDocumentsAccessOptions(supabaseAdmin)
  }
})
