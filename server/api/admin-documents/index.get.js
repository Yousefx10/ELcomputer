import { getQuery } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import {
  getAccessibleChildFolders,
  mapDocumentRecord,
  requireDocumentFolderAccess,
  throwDocumentsDataError
} from '../../utils/documents'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'documents.view'
  })
  const query = getQuery(event)
  const folderId = String(query.folderId || '').trim() || null
  const search = String(query.search || '').trim().slice(0, 100)
  const access = await requireDocumentFolderAccess({
    supabaseAdmin,
    adminUser,
    folderId
  })

  const foldersPromise = getAccessibleChildFolders({
    supabaseAdmin,
    adminUser,
    parentId: access.folderId,
    parentAccessLevel: access.accessLevel,
    search
  })

  let documentsQuery = supabaseAdmin
    .from('documents')
    .select('id, folder_id, name, mime_type, size_bytes, created_by, created_at, updated_at')
    .order('updated_at', { ascending: false })

  documentsQuery = access.folderId
    ? documentsQuery.eq('folder_id', access.folderId)
    : documentsQuery.is('folder_id', null)

  if (search) {
    documentsQuery = documentsQuery.ilike('name', `%${search}%`)
  }

  const [folders, { data: documents, error: documentsError }] = await Promise.all([
    foldersPromise,
    documentsQuery
  ])

  if (documentsError) {
    throwDocumentsDataError(documentsError, 'Could not load documents.')
  }

  const items = [
    ...folders,
    ...(documents || []).map((document) => mapDocumentRecord(document, access.canEdit))
  ]

  return {
    access: {
      level: access.accessLevel,
      can_edit: access.canEdit
    },
    breadcrumbs: access.breadcrumbs.map((folder) => ({
      id: folder.id,
      name: folder.name
    })),
    currentFolder: access.folder
      ? {
          id: access.folder.id,
          name: access.folder.name,
          is_restricted: access.folder.is_restricted,
          can_edit: access.canEdit,
          can_manage_access: access.canEdit
        }
      : null,
    items,
    summary: {
      files: documents?.length || 0,
      folders: folders.length,
      size_bytes: (documents || []).reduce((total, document) => {
        return total + Number(document.size_bytes || 0)
      }, 0)
    }
  }
})
