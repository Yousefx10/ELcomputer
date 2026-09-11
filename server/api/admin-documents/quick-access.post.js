import { createError, readBody } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import {
  getDocumentRecord,
  normalizeDocumentId,
  requireDocumentFolderAccess,
  throwDocumentsDataError
} from '../../utils/documents'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'documents.view'
  })
  const body = await readBody(event)
  const type = String(body?.type || '').trim()
  const id = normalizeDocumentId(body?.id, {
    label: type === 'folder' ? 'Folder' : 'Document'
  })
  const pinned = body?.pinned === true

  if (!['file', 'folder'].includes(type)) {
    throw createError({ statusCode: 400, statusMessage: 'Choose a file or folder.' })
  }

  if (type === 'file') {
    const document = await getDocumentRecord(supabaseAdmin, id)
    await requireDocumentFolderAccess({
      supabaseAdmin,
      adminUser,
      folderId: document.folder_id
    })
  } else {
    await requireDocumentFolderAccess({ supabaseAdmin, adminUser, folderId: id })
  }

  const itemColumn = type === 'folder' ? 'folder_id' : 'document_id'

  if (pinned) {
    const { error } = await supabaseAdmin
      .from('document_quick_access')
      .insert({
        admin_user_id: adminUser.id,
        [itemColumn]: id
      })

    if (error) throwDocumentsDataError(error, 'Could not add this item to quick access.')
  } else {
    const { error } = await supabaseAdmin
      .from('document_quick_access')
      .delete()
      .eq('admin_user_id', adminUser.id)
      .eq(itemColumn, id)

    if (error) throwDocumentsDataError(error, 'Could not update quick access.')
  }

  return { id, type, pinned }
})
