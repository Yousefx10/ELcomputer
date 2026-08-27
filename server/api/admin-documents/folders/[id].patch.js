import { createError, getRouterParam, readBody } from 'h3'
import { recordAdminActivity } from '../../../utils/adminLogs'
import { requireAdminRequest } from '../../../utils/adminRequest'
import {
  normalizeDocumentId,
  normalizeDocumentName,
  requireDocumentFolderAccess,
  throwDocumentsDataError
} from '../../../utils/documents'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event)
  const folderId = normalizeDocumentId(getRouterParam(event, 'id'), { label: 'Folder' })
  const body = await readBody(event)
  const name = normalizeDocumentName(body?.name)

  await requireDocumentFolderAccess({
    supabaseAdmin,
    adminUser,
    folderId,
    write: true
  })

  const { data, error } = await supabaseAdmin
    .from('document_folders')
    .update({
      name,
      updated_at: new Date().toISOString()
    })
    .eq('id', folderId)
    .select('id, parent_id, name, is_restricted, created_by, created_at, updated_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw createError({
        statusCode: 409,
        statusMessage: 'A folder with this name already exists here.'
      })
    }

    throwDocumentsDataError(error, 'Could not rename the folder.')
  }

  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: 'documents.folder.rename',
    description: `Renamed a document folder to ${name}.`,
    metadata: { folder_id: folderId }
  })

  return {
    item: {
      ...data,
      can_edit: true,
      can_manage_access: true,
      type: 'folder'
    }
  }
})
