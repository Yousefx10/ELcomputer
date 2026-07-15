import { createError, readBody } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { deleteUploadedImageByPublicPath } from '../../utils/uploads'

export default defineEventHandler(async (event) => {
  await requireAdminRequest(event, {
    permission: 'settings.edit'
  })

  const body = await readBody(event)
  const publicPath = String(body?.path || '').trim()

  if (!publicPath) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Image path is required.'
    })
  }

  return await deleteUploadedImageByPublicPath(publicPath)
})
