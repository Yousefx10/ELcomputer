import { createError, getRouterParam } from 'h3'
import { recordAdminActivity } from '../../../utils/adminLogs'
import { requireAdminRequest } from '../../../utils/adminRequest'
import {
  normalizeDocumentId,
  requireDocumentFolderAccess,
  throwDocumentsDataError
} from '../../../utils/documents'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event)
  const folderId = normalizeDocumentId(getRouterParam(event, 'id'), { label: 'Folder' })
  const access = await requireDocumentFolderAccess({
    supabaseAdmin,
    adminUser,
    folderId,
    write: true
  })

  const [childrenResult, documentsResult] = await Promise.all([
    supabaseAdmin
      .from('document_folders')
      .select('*', { count: 'exact', head: true })
      .eq('parent_id', folderId),
    supabaseAdmin
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('folder_id', folderId)
  ])

  if (childrenResult.error) {
    throwDocumentsDataError(childrenResult.error, 'Could not inspect the folder.')
  }

  if (documentsResult.error) {
    throwDocumentsDataError(documentsResult.error, 'Could not inspect the folder.')
  }

  if ((childrenResult.count || 0) > 0 || (documentsResult.count || 0) > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'This folder is not empty. Remove its files and subfolders first.'
    })
  }

  const { error } = await supabaseAdmin
    .from('document_folders')
    .delete()
    .eq('id', folderId)

  if (error) {
    throwDocumentsDataError(error, 'Could not delete the folder.')
  }

  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: 'documents.folder.delete',
    description: `Deleted document folder ${access.folder?.name || folderId}.`,
    metadata: { folder_id: folderId }
  })

  return { success: true }
})
