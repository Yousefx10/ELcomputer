import { createError, getHeader } from 'h3'
import { promises as fs } from 'node:fs'
import { resolve } from 'node:path'
import { hasAdminPermission } from '../../app/utils/adminPermissions.js'
import {
  TABLES,
  guideRows,
  TRANSFER_LIMITS as L,
  UUID_RE,
  semanticCell,
  failTransfer,
} from './catalogTransferContract.js'
import { readCsv, writeCsv } from './catalogTransferCsv.js'
import { readXlsx, writeXlsx } from './catalogTransferXlsx.js'
import { collectMatches, snapshotTables, previewCatalog } from './catalogTransferPreview.js'
import { productListQuery } from './productList.js'
import { assertSafeUploadPath, getRelativeUploadPathFromPublicPath } from './uploads.js'
export const transferFormats = ['csv', 'xlsx']
export function throwTransfer(error) {
  const code =
    error?.catalogTransfer ||
    error?.message?.match(/^transfer:([a-z_]+)$/)?.[1] ||
    (error?.code === '42501' ? 'permission' : 'unavailable')
  const statusCode =
    code === 'permission' ? 403 : code === 'limit' ? 413 : code === 'unavailable' ? 503 : 400
  throw createError({
    statusCode,
    statusMessage:
      statusCode === 403
        ? 'You do not have access to this catalog operation.'
        : statusCode === 503
          ? 'Catalog preparation is unavailable. Try again.'
          : statusCode === 413
            ? 'This catalog file or selection exceeds the limits.'
            : 'Check the catalog file and format.',
    data: { catalogTransferError: code },
  })
}
export async function transferSnapshot(
  client,
  adminUser,
  { purpose, scope = 'none', ids = [], filters = {}, match = {}, media = {} },
) {
  const { data, error } = await client
    .rpc('catalog_transfer_snapshot', {
      p_admin_id: adminUser.id,
      p_purpose: purpose,
      p_scope: scope,
      p_ids: ids,
      p_filters: filters,
      p_match: match,
      p_media: media,
    })
    .abortSignal(AbortSignal.timeout(15000))
  if (error) throwTransfer(error)
  if (!data?.products || !data?.variants || !data?.categories) throwTransfer({})
  return data
}
export function transferExportInput(body) {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    JSON.stringify(body).length > 20000 ||
    Object.keys(body).some((k) => !['format', 'scope', 'ids', 'filters'].includes(k)) ||
    !transferFormats.includes(body.format) ||
    !['selected', 'filtered'].includes(body.scope) ||
    !Array.isArray(body.ids) ||
    body.ids.some((id) => typeof id !== 'string' || !UUID_RE.test(id)) ||
    new Set(body.ids.map((s) => s.toLowerCase())).size !== body.ids.length ||
    (body.scope === 'selected'
      ? body.ids.length < 1 || body.ids.length > 25
      : body.ids.length !== 0)
  )
    throwTransfer({ catalogTransfer: 'invalid' })
  const q = productListQuery(body.filters || {})
  delete q.page
  return {
    format: body.format,
    scope: body.scope,
    ids: body.ids.map((s) => s.toLowerCase()),
    filters: q,
  }
}
export function transferBytes(snapshot, format) {
  try {
    const tables = snapshotTables(snapshot, guideRows())
    return format === 'csv' ? writeCsv(tables) : writeXlsx(tables)
  } catch (error) {
    throwTransfer(error)
  }
}
// Source is private request memory only. It is never written to media/Storage/disk,
// returned for downloading, or retained for an Apply operation.
export async function readTransferUpload(event, limit = L.upload) {
  const tooLarge = () =>
    createError({
      statusCode: 413,
      statusMessage: 'The file or request exceeds the limits.',
      data: { catalogTransferError: 'limit' },
    })
  const declared = getHeader(event, 'content-length')
  if (declared !== undefined && (!/^\d+$/.test(declared) || Number(declared) > limit))
    throw tooLarge()
  if (event._requestBody) {
    if (!Buffer.isBuffer(event._requestBody) || event._requestBody.length > limit) throw tooLarge()
    return event._requestBody
  }
  return new Promise((accept, reject) => {
    let size = 0,
      done = false
    const chunks = [],
      request = event.node.req
    const finish = (error) => {
      if (done) return
      done = true
      clearTimeout(timer)
      chunks.length = 0
      reject(error)
    }
    const timer = setTimeout(
      () =>
        finish(
          createError({
            statusCode: 408,
            statusMessage: 'Upload timed out.',
            data: { catalogTransferError: 'upload' },
          }),
        ),
      15000,
    )
    timer.unref?.()
    request
      .on('data', (chunk) => {
        if (done) return
        size += chunk.length
        if (size > limit) finish(tooLarge())
        else chunks.push(chunk)
      })
      .once('aborted', () => finish(Error('Upload aborted')))
      .once('error', finish)
      .once('end', () => {
        if (done) return
        done = true
        clearTimeout(timer)
        const body = Buffer.concat(chunks)
        chunks.length = 0
        accept(body)
      })
  })
}
export function parseTransfer(bytes, format) {
  try {
    return format === 'csv' ? readCsv(bytes) : readXlsx(bytes)
  } catch (error) {
    throwTransfer(error.catalogTransfer ? error : { catalogTransfer: 'content' })
  }
}
export function ensureTransferPreviewPermission(admin) {
  if (!hasAdminPermission(admin, 'products.edit') && !hasAdminPermission(admin, 'products.add'))
    throwTransfer({ catalogTransfer: 'permission' })
}
export async function validateTransferMedia(tables, snapshot) {
  const invalid = new Set(),
    urls = new Set()
  for (const table of ['Products', 'Images'])
    for (const row of tables[table])
      for (const field of ['image_url', 'seo_image_url']) {
        const c = semanticCell(row[field] || '')
        if (c.kind === 'value' && c.value) urls.add(c.value)
      }
  if (urls.size > 1000) failTransfer('limit')
  for (const value of urls) {
    let safe = true
    try {
      if (!/^(https?:\/\/|\/(?!\/))[^\s<>"']+$/.test(value) || value.length > 2048) safe = false
      else if (value.startsWith('/uploads/')) {
        const relative = getRelativeUploadPathFromPublicPath(value)
        await assertSafeUploadPath(relative)
        if (snapshot.unavailable_media.includes(value.toLowerCase())) safe = false
      } else if (value.startsWith('/images/')) {
        if (
          !/^\/images\/[A-Za-z0-9_/-]+\.(?:png|jpe?g|webp|gif|avif|svg)$/i.test(value) ||
          value.split('/').some((p) => p === '..')
        )
          safe = false
        else {
          const root = resolve('public'),
            path = resolve(root, '.' + value)
          if ((await fs.realpath(path)) !== path || !(await fs.lstat(path)).isFile()) safe = false
        }
      } else if (value.startsWith('/')) safe = false
      else {
        const url = new URL(value)
        if (url.username || url.password || /\/storage\/v1\/object\//i.test(url.pathname))
          safe = false
        const path = url.pathname.toLowerCase()
        if (path.startsWith('/uploads/') && snapshot.unavailable_media.includes(path)) safe = false
      }
    } catch {
      safe = false
    }
    if (!safe) invalid.add(value)
  }
  for (const entry of snapshot.media_fields || []) {
    try {
      await assertSafeUploadPath(getRelativeUploadPathFromPublicPath(entry.source_path))
      if (snapshot.unavailable_media.includes(entry.path)) throw Error('Unavailable image')
    } catch {
      const raw = tables[entry.table]?.[entry.index]?.[entry.field]
      if (typeof raw === 'string') invalid.add(semanticCell(raw).value)
    }
  }
  return invalid
}
export async function transferPreview(client, admin, tables) {
  const media = Object.fromEntries(
    ['Products', 'Variants', 'Specifications', 'Images'].map((name) => [
      name,
      tables[name].map((row) => Object.fromEntries(TABLES[name].map((f) => [f, row[f]]))),
    ]),
  )
  const snapshot = await transferSnapshot(client, admin, {
    purpose: 'preview',
    scope: 'matching',
    match: collectMatches(tables),
    media,
  })
  const invalidMedia = await validateTransferMedia(tables, snapshot)
  const result = previewCatalog(tables, snapshot, { invalidMedia })
  if (Buffer.byteLength(JSON.stringify(result)) > L.output)
    throwTransfer({ catalogTransfer: 'limit' })
  return result
}
