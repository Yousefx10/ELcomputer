import { createError, getQuery, sendStream, setHeader } from 'h3'
import { promises as fs } from 'node:fs'
import {
  createUploadReadStream,
  getAbsoluteUploadPathFromRelativePath,
  getBlankImageSvg,
  getUploadContentType
} from '../../utils/uploads'

export default defineEventHandler(async (event) => {
  const routePath = event.context.params?.path
  const relativePath = Array.isArray(routePath) ? routePath.join('/') : String(routePath || '')
  const query = getQuery(event)

  if (!relativePath.trim()) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Image not found.'
    })
  }

  try {
    const absolutePath = getAbsoluteUploadPathFromRelativePath(relativePath)
    const fileStats = await fs.stat(absolutePath)

    setHeader(event, 'Content-Type', getUploadContentType(relativePath))
    setHeader(event, 'Content-Length', String(fileStats.size))
    setHeader(event, 'Cache-Control', 'no-cache')

    if (String(query.download || '') === '1') {
      const filename = relativePath.split('/').pop() || 'image'
      setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
    }

    return sendStream(event, createUploadReadStream(relativePath))
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error
    }

    setHeader(event, 'Content-Type', 'image/svg+xml; charset=utf-8')
    setHeader(event, 'Cache-Control', 'no-store')
    return getBlankImageSvg()
  }
})
