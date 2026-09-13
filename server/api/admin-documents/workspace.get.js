import { requireAdminRequest } from '../../utils/adminRequest'
import {
  enrichDocumentTags,
  getDocumentRecord,
  mapDocumentRecord,
  requireDocumentFolderAccess,
  throwDocumentsDataError
} from '../../utils/documents'

const enrichCreators = async (supabaseAdmin, items) => {
  const creatorIds = [...new Set(items.map((item) => item.created_by).filter(Boolean))]

  if (!creatorIds.length) return items

  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('id, full_name, email')
    .in('id', creatorIds)

  if (error) throwDocumentsDataError(error, 'Could not load document owners.')

  const creators = new Map((data || []).map((creator) => [creator.id, creator]))

  return items.map((item) => {
    const creator = creators.get(item.created_by)
    return {
      ...item,
      created_by_name: creator?.full_name || creator?.email || 'Unknown admin'
    }
  })
}

const resolveWorkspaceItem = async ({ supabaseAdmin, adminUser, row, pinned = false }) => {
  try {
    if (row.document_id) {
      const document = await getDocumentRecord(supabaseAdmin, row.document_id)
      const { storage_path: _storagePath, ...safeDocument } = document
      const access = await requireDocumentFolderAccess({
        supabaseAdmin,
        adminUser,
        folderId: document.folder_id
      })

      return {
        ...mapDocumentRecord(safeDocument, access.canEdit),
        location: access.breadcrumbs.map((folder) => folder.name).join(' / ') || 'All documents',
        is_pinned: pinned,
        pinned_at: pinned ? row.created_at : null,
        last_opened_at: row.last_opened_at || null
      }
    }

    const access = await requireDocumentFolderAccess({
      supabaseAdmin,
      adminUser,
      folderId: row.folder_id
    })
    const folder = access.folder

    return {
      ...folder,
      access_level: access.accessLevel,
      can_edit: access.canEdit,
      can_manage_access: access.canEdit,
      type: 'folder',
      location: access.breadcrumbs.slice(0, -1).map((entry) => entry.name).join(' / ') || 'All documents',
      is_pinned: pinned,
      pinned_at: pinned ? row.created_at : null
    }
  } catch (error) {
    if ([403, 404].includes(Number(error?.statusCode))) return null
    throw error
  }
}

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'documents.view'
  })
  const [quickResult, recentResult] = await Promise.all([
    supabaseAdmin
      .from('document_quick_access')
      .select('folder_id, document_id, created_at')
      .eq('admin_user_id', adminUser.id)
      .order('created_at', { ascending: false })
      .limit(8),
    supabaseAdmin
      .from('document_recent_items')
      .select('document_id, last_opened_at')
      .eq('admin_user_id', adminUser.id)
      .order('last_opened_at', { ascending: false })
      .limit(8)
  ])

  if (quickResult.error) throwDocumentsDataError(quickResult.error, 'Could not load quick access.')
  if (recentResult.error) throwDocumentsDataError(recentResult.error, 'Could not load recent files.')

  const [quickItems, recentItems] = await Promise.all([
    Promise.all((quickResult.data || []).map((row) => resolveWorkspaceItem({
      supabaseAdmin,
      adminUser,
      row,
      pinned: true
    }))),
    Promise.all((recentResult.data || []).map((row) => resolveWorkspaceItem({
      supabaseAdmin,
      adminUser,
      row
    })))
  ])

  const [quickAccess, recentFiles] = await Promise.all([
    enrichCreators(supabaseAdmin, quickItems.filter(Boolean)),
    enrichCreators(supabaseAdmin, recentItems.filter(Boolean))
  ])

  return {
    quickAccess: await enrichDocumentTags(supabaseAdmin, quickAccess),
    recentFiles: await enrichDocumentTags(supabaseAdmin, recentFiles)
  }
})
