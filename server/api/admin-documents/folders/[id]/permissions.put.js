import { getRouterParam, readBody } from 'h3'
import { recordAdminActivity } from '../../../../utils/adminLogs'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import {
  getDocumentsAccessOptions,
  normalizeDocumentId,
  normalizeFolderMembers,
  requireDocumentFolderAccess,
  throwDocumentsDataError
} from '../../../../utils/documents'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event)
  const folderId = normalizeDocumentId(getRouterParam(event, 'id'), { label: 'Folder' })
  const body = await readBody(event)
  const isRestricted = Boolean(body?.is_restricted)
  let members = isRestricted ? normalizeFolderMembers(body?.members) : []

  const access = await requireDocumentFolderAccess({
    supabaseAdmin,
    adminUser,
    folderId,
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

  const { data: existingPermissions, error: existingError } = await supabaseAdmin
    .from('document_folder_permissions')
    .select('admin_user_id')
    .eq('folder_id', folderId)

  if (existingError) {
    throwDocumentsDataError(existingError, 'Could not update folder access.')
  }

  if (!isRestricted) {
    const { error: folderError } = await supabaseAdmin
      .from('document_folders')
      .update({
        is_restricted: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', folderId)

    if (folderError) {
      throwDocumentsDataError(folderError, 'Could not update folder access.')
    }
  }

  if (members.length) {
    const { error: upsertError } = await supabaseAdmin
      .from('document_folder_permissions')
      .upsert(members.map((member) => ({
        ...member,
        folder_id: folderId,
        granted_by: adminUser.id,
        updated_at: new Date().toISOString()
      })), {
        onConflict: 'folder_id,admin_user_id'
      })

    if (upsertError) {
      throwDocumentsDataError(upsertError, 'Could not update folder access.')
    }
  }

  const desiredMemberIds = new Set(members.map((member) => member.admin_user_id))
  const removedMemberIds = (existingPermissions || [])
    .map((permission) => permission.admin_user_id)
    .filter((adminUserId) => !desiredMemberIds.has(adminUserId))

  if (removedMemberIds.length) {
    const { error: removeError } = await supabaseAdmin
      .from('document_folder_permissions')
      .delete()
      .eq('folder_id', folderId)
      .in('admin_user_id', removedMemberIds)

    if (removeError) {
      throwDocumentsDataError(removeError, 'Could not update folder access.')
    }
  }

  if (isRestricted) {
    const { error: folderError } = await supabaseAdmin
      .from('document_folders')
      .update({
        is_restricted: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', folderId)

    if (folderError) {
      throwDocumentsDataError(folderError, 'Could not update folder access.')
    }
  }

  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: 'documents.folder.permissions',
    description: `Updated access for document folder ${access.folder.name}.`,
    metadata: {
      folder_id: folderId,
      restricted: isRestricted,
      member_count: members.length
    }
  })

  return { success: true }
})
