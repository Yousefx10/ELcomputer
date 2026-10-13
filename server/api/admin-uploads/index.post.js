import { createError, readMultipartFormData } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { readBoundedUpload } from '../../utils/uploadRequest'
import {
  ensureAdminUploadPermission,
  getAllowedMediaSections,
  saveUploadedImageFile
} from '../../utils/uploads'

export default defineEventHandler(async (event) => {
  const { adminUser } = await requireAdminRequest(event)
  getAllowedMediaSections(adminUser)
  await readBoundedUpload(event)
  const formData = await readMultipartFormData(event)
  if (formData?.length !== 2 || formData.filter(entry => entry.name === 'section').length !== 1 || formData.filter(entry => entry.name === 'file').length !== 1) {
    throw createError({ statusCode: 400, statusMessage: 'Choose one image and an upload section.', data: { code: 'MEDIA_FORM_INVALID' } })
  }
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
