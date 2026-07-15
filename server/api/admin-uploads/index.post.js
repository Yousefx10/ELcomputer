import { createError, readMultipartFormData } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import {
  ensureAdminUploadPermission,
  saveUploadedImageFile
} from '../../utils/uploads'

export default defineEventHandler(async (event) => {
  const { adminUser } = await requireAdminRequest(event)
  const formData = await readMultipartFormData(event)
  const section = String(formData?.find((entry) => entry.name === 'section')?.data?.toString() || '').trim()
  const file = formData?.find((entry) => entry.name === 'file' && entry.filename)

  if (!section) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Upload section is required.'
    })
  }

  ensureAdminUploadPermission(adminUser, section)

  if (!file) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Image file is required.'
    })
  }

  return await saveUploadedImageFile(file, section)
})
