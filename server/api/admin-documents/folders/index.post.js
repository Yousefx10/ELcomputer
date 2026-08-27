import { createError, readBody } from 'h3'
import { recordAdminActivity } from '../../../utils/adminLogs'
import { requireAdminRequest } from '../../../utils/adminRequest'
import {
  getDocumentsAccessOptions,
  normalizeDocumentId,
  normalizeDocumentName,
  normalizeFolderMembers,
  requireDocumentFolderAccess,
  throwDocumentsDataError
} from '../../../utils/documents'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event)
  const body = await readBody(event)
  const parentId = normalizeDocumentId(body?.parent_id, {
    optional: true,
    label: 'Parent folder'
  })
  const name = normalizeDocumentName(body?.name)
  const isRestricted = Boolean(body?.is_restricted)
  let members = isRestricted ? normalizeFolderMembers(body?.members) : []

  await requireDocumentFolderAccess({
    supabaseAdmin,
    adminUser,
    folderId: parentId,
    write: true
  })

  if (isRestricted) {
    const accessOptionsByAdminId = new Map(
      (await getDocumentsAccessOptions(supabaseAdmin)).map((user) => [user.id, user])
    )

    members = members
      .filter((member) => accessOptionsByAdminId.has(member.admin_user_id))
      .map((member) => ({
        ...member,
        access_level: member.access_level === 'editor'
          && accessOptionsByAdminId.get(member.admin_user_id).can_manage
          ? 'editor'
          : 'viewer'
      }))

    if (adminUser.role !== 'owner') {
      members = members.filter((member) => member.admin_user_id !== adminUser.id)
      members.push({
        admin_user_id: adminUser.id,
        access_level: 'editor'
      })
    }
  }

  const { data: folder, error: folderError } = await supabaseAdmin
    .from('document_folders')
    .insert({
      parent_id: parentId,
      name,
      is_restricted: isRestricted,
      created_by: adminUser.id
    })
    .select('id, parent_id, name, is_restricted, created_by, created_at, updated_at')
    .single()

  if (folderError) {
    if (folderError.code === '23505') {
      throw createError({
        statusCode: 409,
        statusMessage: 'A folder with this name already exists here.'
      })
    }

    throwDocumentsDataError(folderError, 'Could not create the folder.')
  }

  if (isRestricted && members.length) {
    const { error: permissionError } = await supabaseAdmin
      .from('document_folder_permissions')
      .insert(members.map((member) => ({
        ...member,
        folder_id: folder.id,
        granted_by: adminUser.id
      })))

    if (permissionError) {
      await supabaseAdmin.from('document_folders').delete().eq('id', folder.id)
      throwDocumentsDataError(permissionError, 'Could not save folder access.')
    }
  }

  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: 'documents.folder.create',
    description: `Created document folder ${name}.`,
    metadata: {
      folder_id: folder.id,
      parent_id: parentId,
      restricted: isRestricted
    }
  })

  return {
    item: {
      ...folder,
      access_level: 'editor',
      can_edit: true,
      can_manage_access: true,
      type: 'folder'
    }
  }
})
