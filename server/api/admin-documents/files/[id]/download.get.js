import { Buffer } from 'node:buffer'
import { getRouterParam, send, setHeader } from 'h3'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import {
  DOCUMENTS_BUCKET,
  getDocumentRecord,
  requireDocumentFolderAccess,
  touchRecentDocument,
  throwDocumentsDataError
} from '../../../../utils/documents'

const getContentDisposition = (filename) => {
  const fallbackName = String(filename || 'document')
    .replace(/[^a-z0-9._ -]/gi, '_')
    .replace(/["\\]/g, '_')
    .slice(0, 180) || 'document'

  return `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event)
  const document = await getDocumentRecord(supabaseAdmin, getRouterParam(event, 'id'))

  await requireDocumentFolderAccess({
    supabaseAdmin,
    adminUser,
    folderId: document.folder_id
  })

  const { data, error } = await supabaseAdmin.storage
    .from(DOCUMENTS_BUCKET)
    .download(document.storage_path)

  if (error || !data) {
    throwDocumentsDataError(error, 'Could not download the document.')
  }

  await touchRecentDocument(supabaseAdmin, adminUser.id, document.id)

  const fileBuffer = Buffer.from(await data.arrayBuffer())

  setHeader(event, 'Content-Type', document.mime_type || 'application/octet-stream')
  setHeader(event, 'Content-Length', String(fileBuffer.length))
  setHeader(event, 'Content-Disposition', getContentDisposition(document.name))
  setHeader(event, 'Cache-Control', 'private, no-store')

  return send(event, fileBuffer)
})
