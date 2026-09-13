import { createError, getQuery } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import {
  enrichDocumentTags,
  getDocumentRecord,
  mapDocumentRecord,
  normalizeDocumentId,
  requireDocumentFolderAccess,
  throwDocumentsDataError
} from '../../utils/documents'

const resolveItem = async ({ supabaseAdmin, adminUser, type, id }) => {
  try {
    if (type === 'file') {
      const document = await getDocumentRecord(supabaseAdmin, id)
      const { storage_path: _storagePath, ...safeDocument } = document
      const access = await requireDocumentFolderAccess({ supabaseAdmin, adminUser, folderId: document.folder_id })
      return {
        ...mapDocumentRecord(safeDocument, access.canEdit),
        location: access.breadcrumbs.map((folder) => folder.name).join(' / ') || 'All documents'
      }
    }

    const access = await requireDocumentFolderAccess({ supabaseAdmin, adminUser, folderId: id })
    return {
      ...access.folder,
      access_level: access.accessLevel,
      can_edit: access.canEdit,
      can_manage_access: access.canEdit,
      type: 'folder',
      location: access.breadcrumbs.slice(0, -1).map((folder) => folder.name).join(' / ') || 'All documents'
    }
  } catch (error) {
    if ([403, 404].includes(Number(error?.statusCode))) return null
    throw error
  }
}

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'documents.view' })
  const tagId = normalizeDocumentId(getQuery(event).tagId, { label: 'Tag' })
  const { data: tag, error: tagError } = await supabaseAdmin
    .from('document_tags')
    .select('id, name, color')
    .eq('id', tagId)
    .maybeSingle()

  if (tagError) throwDocumentsDataError(tagError, 'Could not load the tag.')
  if (!tag) throw createError({ statusCode: 404, statusMessage: 'Tag not found.' })

  const [fileResult, folderResult] = await Promise.all([
    supabaseAdmin.from('document_file_tags').select('document_id').eq('tag_id', tagId).limit(200),
    supabaseAdmin.from('document_folder_tags').select('folder_id').eq('tag_id', tagId).limit(200)
  ])
  if (fileResult.error) throwDocumentsDataError(fileResult.error, 'Could not load tagged files.')
  if (folderResult.error) throwDocumentsDataError(folderResult.error, 'Could not load tagged folders.')

  const items = await Promise.all([
    ...(folderResult.data || []).map((row) => resolveItem({ supabaseAdmin, adminUser, type: 'folder', id: row.folder_id })),
    ...(fileResult.data || []).map((row) => resolveItem({ supabaseAdmin, adminUser, type: 'file', id: row.document_id }))
  ])

  return { tag, items: await enrichDocumentTags(supabaseAdmin, items.filter(Boolean)) }
})
