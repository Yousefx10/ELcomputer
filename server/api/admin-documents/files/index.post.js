import { randomUUID } from 'node:crypto'
import { createError, readMultipartFormData } from 'h3'
import { recordAdminActivity } from '../../../utils/adminLogs'
import { requireAdminRequest } from '../../../utils/adminRequest'
import {
  DOCUMENTS_BUCKET,
  ensureDocumentFileIsAllowed,
  getDocumentStorageExtension,
  normalizeDocumentId,
  requireDocumentFolderAccess,
  throwDocumentsDataError
} from '../../../utils/documents'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event)
  const formData = await readMultipartFormData(event)
  const folderId = normalizeDocumentId(
    formData?.find((entry) => entry.name === 'folder_id')?.data?.toString(),
    { optional: true, label: 'Folder' }
  )
  const file = formData?.find((entry) => entry.name === 'file' && entry.filename)

  if (!file) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Choose a document to upload.'
    })
  }

  const normalizedFile = ensureDocumentFileIsAllowed(file)

  await requireDocumentFolderAccess({
    supabaseAdmin,
    adminUser,
    folderId,
    write: true
  })

  const storagePath = `${folderId || 'root'}/${randomUUID()}${getDocumentStorageExtension(normalizedFile.name)}`
  const { error: uploadError } = await supabaseAdmin.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, file.data, {
      cacheControl: '3600',
      contentType: normalizedFile.mimeType,
      upsert: false
    })

  if (uploadError) {
    const missingBucket = /bucket.*not found/i.test(uploadError.message || '')

    throw createError({
      statusCode: missingBucket ? 503 : 500,
      statusMessage: missingBucket
        ? 'Documents storage is not set up yet. Run the latest Supabase migration, then try again.'
        : uploadError.message || 'Could not upload the document.'
    })
  }

  const { data: document, error: documentError } = await supabaseAdmin
    .from('documents')
    .insert({
      folder_id: folderId,
      name: normalizedFile.name,
      storage_path: storagePath,
      mime_type: normalizedFile.mimeType,
      size_bytes: file.data.length,
      created_by: adminUser.id
    })
    .select('id, folder_id, name, mime_type, size_bytes, created_by, created_at, updated_at')
    .single()

  if (documentError) {
    await supabaseAdmin.storage.from(DOCUMENTS_BUCKET).remove([storagePath])
    throwDocumentsDataError(documentError, 'Could not save the uploaded document.')
  }

  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: 'documents.file.upload',
    description: `Uploaded document ${normalizedFile.name}.`,
    metadata: {
      document_id: document.id,
      folder_id: folderId,
      size_bytes: file.data.length
    }
  })

  return {
    item: {
      ...document,
      can_edit: true,
      type: 'file'
    }
  }
})
