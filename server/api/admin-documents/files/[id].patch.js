import { getRouterParam, readBody } from 'h3'
import { recordAdminActivity } from '../../../utils/adminLogs'
import { requireAdminRequest } from '../../../utils/adminRequest'
import {
  getDocumentRecord,
  normalizeDocumentName,
  requireDocumentFolderAccess,
  throwDocumentsDataError
} from '../../../utils/documents'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event)
  const document = await getDocumentRecord(supabaseAdmin, getRouterParam(event, 'id'))
  const body = await readBody(event)
  const name = normalizeDocumentName(body?.name, { file: true })

  await requireDocumentFolderAccess({
    supabaseAdmin,
    adminUser,
    folderId: document.folder_id,
    write: true
  })

  const { data, error } = await supabaseAdmin
    .from('documents')
    .update({
      name,
      updated_at: new Date().toISOString()
    })
    .eq('id', document.id)
    .select('id, folder_id, name, mime_type, size_bytes, created_by, created_at, updated_at')
    .single()

  if (error) {
    throwDocumentsDataError(error, 'Could not rename the document.')
  }

  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: 'documents.file.rename',
    description: `Renamed document ${document.name} to ${name}.`,
    metadata: {
      document_id: document.id,
      folder_id: document.folder_id
    }
  })

  return {
    item: {
      ...data,
      can_edit: true,
      type: 'file'
    }
  }
})
