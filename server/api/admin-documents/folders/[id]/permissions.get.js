import { getRouterParam } from 'h3'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import {
  getDocumentsAccessOptions,
  normalizeDocumentId,
  requireDocumentFolderAccess,
  throwDocumentsDataError
} from '../../../../utils/documents'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event)
  const folderId = normalizeDocumentId(getRouterParam(event, 'id'), { label: 'Folder' })
  const access = await requireDocumentFolderAccess({
    supabaseAdmin,
    adminUser,
    folderId,
    write: true
  })
  const [{ data: permissions, error }, users] = await Promise.all([
    supabaseAdmin
      .from('document_folder_permissions')
      .select('admin_user_id, access_level')
      .eq('folder_id', folderId),
    getDocumentsAccessOptions(supabaseAdmin)
  ])

  if (error) {
    throwDocumentsDataError(error, 'Could not load folder access.')
  }

  const permissionsByUser = new Map(
    (permissions || []).map((permission) => [permission.admin_user_id, permission.access_level])
  )

  return {
    folder: {
      id: access.folder.id,
      name: access.folder.name,
      is_restricted: access.folder.is_restricted
    },
    users: users.map((user) => ({
      ...user,
      access_level: permissionsByUser.get(user.id) || 'none'
    }))
  }
})
