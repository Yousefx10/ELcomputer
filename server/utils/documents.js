import { extname } from 'node:path'
import { createError } from 'h3'
import { hasAdminPermission } from '~/utils/adminPermissions'

export const DOCUMENTS_BUCKET = 'admin-documents'
export const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ALLOWED_EXTENSIONS = new Set([
  '.7z', '.avif', '.bmp', '.csv', '.doc', '.docx', '.gif', '.heic', '.jpeg',
  '.jpg', '.json', '.md', '.ods', '.odt', '.pdf', '.png', '.ppt', '.pptx',
  '.rar', '.rtf', '.svg', '.text', '.tif', '.tiff', '.txt', '.webp', '.xls',
  '.xlsx', '.xml', '.zip'
])
const MIME_TYPES_BY_EXTENSION = {
  '.7z': 'application/x-7z-compressed',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.csv': 'text/csv',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.rar': 'application/vnd.rar',
  '.rtf': 'application/rtf',
  '.svg': 'image/svg+xml',
  '.text': 'text/plain',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.txt': 'text/plain',
  '.webp': 'image/webp',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xml': 'application/xml',
  '.zip': 'application/zip'
}

const schemaErrorCodes = new Set(['42P01', 'PGRST205'])

export const throwDocumentsDataError = (error, fallbackMessage = 'Could not complete the document request.') => {
  if (schemaErrorCodes.has(error?.code)) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Documents is not set up yet. Run the latest Supabase migration, then try again.'
    })
  }

  throw createError({
    statusCode: 500,
    statusMessage: error?.message || fallbackMessage
  })
}

export const normalizeDocumentId = (value, { optional = false, label = 'Folder' } = {}) => {
  const normalizedValue = String(value || '').trim()

  if (!normalizedValue && optional) {
    return null
  }

  if (!UUID_PATTERN.test(normalizedValue)) {
    throw createError({
      statusCode: 400,
      statusMessage: `${label} id is invalid.`
    })
  }

  return normalizedValue
}

export const normalizeDocumentName = (value, { file = false } = {}) => {
  const maximumLength = file ? 240 : 120
  const itemLabel = file ? 'File' : 'Folder'
  const normalizedName = String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()

  if (!normalizedName || normalizedName.length > maximumLength) {
    throw createError({
      statusCode: 400,
      statusMessage: `${itemLabel} name must be between 1 and ${maximumLength} characters.`
    })
  }

  if (normalizedName === '.' || normalizedName === '..' || /[/\\]/.test(normalizedName)) {
    throw createError({
      statusCode: 400,
      statusMessage: `${itemLabel} name cannot contain slashes.`
    })
  }

  return normalizedName
}

export const ensureDocumentFileIsAllowed = (file) => {
  if (!file?.data?.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Choose a document to upload.'
    })
  }

  if (file.data.length > MAX_DOCUMENT_SIZE) {
    throw createError({
      statusCode: 413,
      statusMessage: 'Documents must be 25 MB or smaller.'
    })
  }

  const normalizedName = normalizeDocumentName(file.filename, { file: true })
  const extension = extname(normalizedName).toLowerCase()

  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'This file type is not supported. Upload a document, image, spreadsheet, presentation, or archive.'
    })
  }

  return {
    extension,
    mimeType: MIME_TYPES_BY_EXTENSION[extension] || 'application/octet-stream',
    name: normalizedName
  }
}

export const requireDocumentsPermission = (adminUser, { write = false } = {}) => {
  if (!hasAdminPermission(adminUser, 'documents.view')) {
    throw createError({
      statusCode: 403,
      statusMessage: 'You do not have access to Documents.'
    })
  }

  if (write && !hasAdminPermission(adminUser, 'documents.manage')) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Your Documents access is view-only.'
    })
  }
}

const getFolderRecord = async (supabaseAdmin, folderId) => {
  const { data, error } = await supabaseAdmin
    .from('document_folders')
    .select('id, parent_id, name, is_restricted, created_by, created_at, updated_at')
    .eq('id', folderId)
    .maybeSingle()

  if (error) {
    throwDocumentsDataError(error, 'Could not load the folder.')
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Folder not found.'
    })
  }

  return data
}

const getFolderLineage = async (supabaseAdmin, folderId) => {
  if (!folderId) {
    return []
  }

  const lineage = []
  const seenFolderIds = new Set()
  let nextFolderId = folderId

  while (nextFolderId) {
    if (seenFolderIds.has(nextFolderId) || lineage.length >= 50) {
      throw createError({
        statusCode: 500,
        statusMessage: 'The folder hierarchy is invalid.'
      })
    }

    seenFolderIds.add(nextFolderId)
    const folder = await getFolderRecord(supabaseAdmin, nextFolderId)
    lineage.unshift(folder)
    nextFolderId = folder.parent_id
  }

  return lineage
}

const getUserFolderPermissions = async (supabaseAdmin, adminUserId, folderIds) => {
  if (!folderIds.length) {
    return new Map()
  }

  const { data, error } = await supabaseAdmin
    .from('document_folder_permissions')
    .select('folder_id, access_level')
    .eq('admin_user_id', adminUserId)
    .in('folder_id', folderIds)

  if (error) {
    throwDocumentsDataError(error, 'Could not verify folder access.')
  }

  return new Map((data || []).map((permission) => [permission.folder_id, permission.access_level]))
}

const applyFolderRestriction = (currentAccess, folder, permissionLevel) => {
  if (!folder.is_restricted) {
    return currentAccess
  }

  if (!permissionLevel) {
    return null
  }

  if (currentAccess === 'viewer' || permissionLevel === 'viewer') {
    return 'viewer'
  }

  return 'editor'
}

export const requireDocumentFolderAccess = async ({
  supabaseAdmin,
  adminUser,
  folderId = null,
  write = false
}) => {
  requireDocumentsPermission(adminUser, { write })

  const normalizedFolderId = normalizeDocumentId(folderId, {
    optional: true,
    label: 'Folder'
  })

  if (adminUser.role === 'owner') {
    const lineage = await getFolderLineage(supabaseAdmin, normalizedFolderId)

    return {
      accessLevel: 'editor',
      breadcrumbs: lineage,
      canEdit: true,
      folder: lineage.at(-1) || null,
      folderId: normalizedFolderId
    }
  }

  const lineage = await getFolderLineage(supabaseAdmin, normalizedFolderId)
  const restrictedFolderIds = lineage
    .filter((folder) => folder.is_restricted)
    .map((folder) => folder.id)
  const permissionsByFolder = await getUserFolderPermissions(
    supabaseAdmin,
    adminUser.id,
    restrictedFolderIds
  )

  let accessLevel = hasAdminPermission(adminUser, 'documents.manage') ? 'editor' : 'viewer'

  for (const folder of lineage) {
    accessLevel = applyFolderRestriction(
      accessLevel,
      folder,
      permissionsByFolder.get(folder.id)
    )

    if (!accessLevel) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You do not have access to this folder.'
      })
    }
  }

  const canEdit = accessLevel === 'editor' && hasAdminPermission(adminUser, 'documents.manage')

  if (write && !canEdit) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Your access to this folder is view-only.'
    })
  }

  return {
    accessLevel,
    breadcrumbs: lineage,
    canEdit,
    folder: lineage.at(-1) || null,
    folderId: normalizedFolderId
  }
}

export const getAccessibleChildFolders = async ({
  supabaseAdmin,
  adminUser,
  parentId,
  parentAccessLevel,
  search = ''
}) => {
  let query = supabaseAdmin
    .from('document_folders')
    .select('id, parent_id, name, is_restricted, created_by, created_at, updated_at')
    .order('name', { ascending: true })

  query = parentId ? query.eq('parent_id', parentId) : query.is('parent_id', null)

  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    throwDocumentsDataError(error, 'Could not load folders.')
  }

  const folders = data || []

  if (adminUser.role === 'owner') {
    return folders.map((folder) => ({
      ...folder,
      access_level: 'editor',
      can_edit: true,
      can_manage_access: true,
      type: 'folder'
    }))
  }

  const restrictedFolderIds = folders
    .filter((folder) => folder.is_restricted)
    .map((folder) => folder.id)
  const permissionsByFolder = await getUserFolderPermissions(
    supabaseAdmin,
    adminUser.id,
    restrictedFolderIds
  )

  return folders.reduce((accessibleFolders, folder) => {
    const accessLevel = applyFolderRestriction(
      parentAccessLevel,
      folder,
      permissionsByFolder.get(folder.id)
    )

    if (!accessLevel) {
      return accessibleFolders
    }

    const canEdit = accessLevel === 'editor' && hasAdminPermission(adminUser, 'documents.manage')

    accessibleFolders.push({
      ...folder,
      access_level: accessLevel,
      can_edit: canEdit,
      can_manage_access: canEdit,
      type: 'folder'
    })

    return accessibleFolders
  }, [])
}

export const getDocumentsAccessOptions = async (supabaseAdmin) => {
  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('id, email, full_name, role, permissions, is_active')
    .eq('is_active', true)
    .order('full_name', { ascending: true, nullsFirst: false })

  if (error) {
    throwDocumentsDataError(error, 'Could not load admin users.')
  }

  return (data || [])
    .filter((adminUser) => hasAdminPermission(adminUser, 'documents.view'))
    .map((adminUser) => ({
      can_manage: hasAdminPermission(adminUser, 'documents.manage'),
      id: adminUser.id,
      email: adminUser.email,
      full_name: adminUser.full_name,
      role: adminUser.role
    }))
}

export const normalizeFolderMembers = (members = []) => {
  if (!Array.isArray(members)) {
    return []
  }

  const membersById = new Map()

  members.forEach((member) => {
    const adminUserId = normalizeDocumentId(member?.admin_user_id || member?.id, {
      label: 'Admin user'
    })
    const accessLevel = member?.access_level === 'editor' ? 'editor' : 'viewer'

    membersById.set(adminUserId, {
      admin_user_id: adminUserId,
      access_level: accessLevel
    })
  })

  return [...membersById.values()]
}

export const mapDocumentRecord = (document, canEdit) => ({
  ...document,
  can_edit: Boolean(canEdit),
  type: 'file'
})

export const getDocumentRecord = async (supabaseAdmin, documentId) => {
  const normalizedDocumentId = normalizeDocumentId(documentId, { label: 'Document' })
  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('id, folder_id, name, storage_path, mime_type, size_bytes, created_by, created_at, updated_at')
    .eq('id', normalizedDocumentId)
    .maybeSingle()

  if (error) {
    throwDocumentsDataError(error, 'Could not load the document.')
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Document not found.'
    })
  }

  return data
}

export const getDocumentStorageExtension = (name = '') => {
  const extension = extname(String(name || '')).toLowerCase()
  return ALLOWED_EXTENSIONS.has(extension) ? extension : ''
}
