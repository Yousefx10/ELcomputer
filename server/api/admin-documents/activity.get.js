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

  if (!type && !query.id) {
    const { data, error } = await supabaseAdmin
      .from('admin_activity_logs')
      .select('id, admin_user_id, author_name, author_email, action_key, description, metadata, created_at')
      .like('action_key', 'documents.%')
      .order('created_at', { ascending: false })
      .limit(80)

    if (error) throwDocumentsDataError(error, 'Could not load document activity.')

    const visibleItems = await Promise.all((data || []).map(async (item) => {
      const actionKey = String(item.action_key || '')
      const itemType = actionKey.startsWith('documents.folder.') ? 'folder'
        : actionKey.startsWith('documents.file.') ? 'file'
          : null
      const itemId = itemType === 'folder' ? item.metadata?.folder_id : item.metadata?.document_id

      if (!itemType || !itemId) return item

      try {
        if (itemType === 'file') {
          const document = await getDocumentRecord(supabaseAdmin, itemId)
          await requireDocumentFolderAccess({ supabaseAdmin, adminUser, folderId: document.folder_id })
        } else {
          await requireDocumentFolderAccess({ supabaseAdmin, adminUser, folderId: itemId })
        }
        return item
      } catch (accessError) {
        if (adminUser.role === 'owner' && Number(accessError?.statusCode) === 404) return item
        if ([403, 404].includes(Number(accessError?.statusCode))) return null
        throw accessError
      }
    }))

    return {
      items: visibleItems.filter(Boolean).slice(0, 40).map((item) => ({
        id: item.id,
        action: String(item.action_key || '').split('.').at(-1) || 'updated',
        description: item.description,
        author: item.author_name || item.author_email || 'Admin',
        createdAt: item.created_at
      }))
    }
  }

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
