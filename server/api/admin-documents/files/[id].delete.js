import { getRouterParam } from 'h3'
import { recordAdminActivity } from '../../../utils/adminLogs'
import { requireAdminRequest } from '../../../utils/adminRequest'
import {
  DOCUMENTS_BUCKET,
  getDocumentRecord,
  requireDocumentFolderAccess,
  throwDocumentsDataError
} from '../../../utils/documents'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event)
  const document = await getDocumentRecord(supabaseAdmin, getRouterParam(event, 'id'))

  await requireDocumentFolderAccess({
    supabaseAdmin,
    adminUser,
    folderId: document.folder_id,
    write: true
  })

  const { error: storageError } = await supabaseAdmin.storage
    .from(DOCUMENTS_BUCKET)
    .remove([document.storage_path])

  if (storageError) {
    throwDocumentsDataError(storageError, 'Could not remove the stored document.')
  }

  const { error } = await supabaseAdmin
    .from('documents')
    .delete()
    .eq('id', document.id)

  if (error) {
    throwDocumentsDataError(error, 'Could not delete the document record.')
  }

  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: 'documents.file.delete',
    description: `Deleted document ${document.name}.`,
    metadata: {
      document_id: document.id,
      folder_id: document.folder_id
    }
  })

  return { success: true }
})
