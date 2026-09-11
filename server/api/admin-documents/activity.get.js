import { createError, getQuery } from 'h3'
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
  const query = getQuery(event)
  const type = String(query.type || '').trim()
  const id = normalizeDocumentId(query.id, {
    label: type === 'folder' ? 'Folder' : 'Document'
  })

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

  const metadataKey = type === 'folder' ? 'folder_id' : 'document_id'
  const { data, error } = await supabaseAdmin
    .from('admin_activity_logs')
    .select('id, admin_user_id, author_name, author_email, action_key, description, created_at')
    .like('action_key', `documents.${type === 'folder' ? 'folder' : 'file'}.%`)
    .contains('metadata', { [metadataKey]: id })
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) throwDocumentsDataError(error, 'Could not load item activity.')

  return {
    items: (data || []).map((item) => ({
      id: item.id,
      action: String(item.action_key || '').split('.').at(-1) || 'updated',
      description: item.description,
      author: item.author_name || item.author_email || 'Admin',
      createdAt: item.created_at
    }))
  }
})
