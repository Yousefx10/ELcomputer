import { createError, readBody } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { recordAdminActivity } from '../../utils/adminLogs'
import {
  getDocumentRecord,
  normalizeDocumentId,
  requireDocumentFolderAccess,
  throwDocumentsDataError
} from '../../utils/documents'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'documents.manage'
  })
  const body = await readBody(event)
  const type = String(body?.type || '').trim()
  const id = normalizeDocumentId(body?.id, { label: type === 'folder' ? 'Folder' : 'Document' })

  if (!['file', 'folder'].includes(type)) {
    throw createError({ statusCode: 400, statusMessage: 'Choose a file or folder.' })
  }

  const tagIds = [...new Set((Array.isArray(body?.tag_ids) ? body.tag_ids : [])
    .map((tagId) => normalizeDocumentId(tagId, { label: 'Tag' })))]
  let itemName = ''

  if (type === 'file') {
    const document = await getDocumentRecord(supabaseAdmin, id)
    await requireDocumentFolderAccess({ supabaseAdmin, adminUser, folderId: document.folder_id, write: true })
    itemName = document.name
  } else {
    const access = await requireDocumentFolderAccess({ supabaseAdmin, adminUser, folderId: id, write: true })
    itemName = access.folder.name
  }

  if (tagIds.length) {
    const { data, error } = await supabaseAdmin.from('document_tags').select('id').in('id', tagIds)
    if (error) throwDocumentsDataError(error, 'Could not verify the tags.')
    if ((data || []).length !== tagIds.length) {
      throw createError({ statusCode: 400, statusMessage: 'One or more tags no longer exist.' })
    }
  }

  const { error: updateError } = await supabaseAdmin.rpc('document_set_item_tags', {
    p_item_type: type,
    p_item_id: id,
    p_tag_ids: tagIds,
    p_admin_user_id: adminUser.id
  })
  if (updateError) throwDocumentsDataError(updateError, 'Could not update the tags.')

  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: `documents.${type}.tags`,
    description: `Updated tags for ${itemName}.`,
    metadata: { [`${type === 'file' ? 'document' : 'folder'}_id`]: id, tag_ids: tagIds }
  })

  return { id, type, tag_ids: tagIds }
})
