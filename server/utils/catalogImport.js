import { createHash } from 'node:crypto'
import { createError } from 'h3'
import { TABLES, UUID_RE, semanticCell } from './catalogTransferContract.js'
import { transferPreviewContext, readTransferUpload } from './catalogTransfer.js'
import { getAllowedMediaSections, getUploadSectionDefinition } from './uploads.js'

export const IMPORT_BATCH_SIZE = 5
export async function readImportAction(event) {
  const bytes = await readTransferUpload(event, 2048)
  try {
    return JSON.parse(bytes.toString('utf8'))
  } catch {
    importError('invalid')
  } finally {
    bytes.fill(0)
    delete event._requestBody
  }
}
export function importError(code = 'unavailable') {
  const statusCode =
    code === 'permission'
      ? 403
      : code === 'missing'
        ? 404
        : ['stale', 'reused', 'source', 'expired'].includes(code)
          ? 409
          : code === 'unavailable'
            ? 503
            : 400
  throw createError({
    statusCode,
    statusMessage: 'Catalog import could not continue.',
    data: { catalogImportError: code },
  })
}
export async function importRpc(client, name, args) {
  const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(30000))
  if (error)
    importError(
      error.message?.match(/^import:([a-z_]+)$/)?.[1] ||
        (error.code === '42501' ? 'permission' : 'unavailable'),
    )
  return data
}
export function importInput(value, keys, required = []) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !keys.includes(k)) ||
    required.some((k) => typeof value[k] !== 'string' || !value[k])
  )
    importError('invalid')
  for (const k of ['job_id', 'warehouse_id', 'retry_of'])
    if (value[k] !== undefined && (typeof value[k] !== 'string' || !UUID_RE.test(value[k])))
      importError('invalid')
  for (const k of ['review_hash'])
    if (
      value[k] !== undefined &&
      (typeof value[k] !== 'string' || !/^[a-f0-9]{64}$/.test(value[k]))
    )
      importError('invalid')
  if (value.format !== undefined && !['csv', 'xlsx'].includes(value.format)) importError('invalid')
  return value
}
// Equivalent CSV/XLSX text and row reordering share one identity. Spreadsheet
// types remain part of the identity; numbers must never masquerade as text IDs.
export function importSource(tables) {
  const prepared = Object.fromEntries(
    Object.keys(TABLES).map((table) => [table, tables[table].map((row) => ({ ...row }))]),
  )
  for (const row of prepared.Products)
    if (!row.product_id && !row.is_published) row.is_published = 'false'
  return prepared
}
export function sourceHash(tables) {
  return createHash('sha256')
    .update(
      JSON.stringify(
        Object.entries(TABLES).map(([table, fields]) => [
          table,
          tables[table]
            .map((row) => [
              fields.map((f) => row[f] || ''),
              fields.map((f) =>
                row[f] && row._types?.[f] && row._types[f] !== 'text' ? row._types[f] : '',
              ),
            ])
            .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en')),
        ]),
      ),
    )
    .digest('hex')
}
export function importGraph(snapshot, id) {
  return Object.fromEntries(
    ['variants', 'specifications', 'images'].map((table) => [
      table,
      snapshot[table]
        .filter((row) => row.product_key === id)
        .map((row) => ({ id: row.id, hash: row.expected_hash }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    ]),
  )
}
export function importCommand(preview, productKey) {
  const rows = preview.items.filter(
    (row) =>
      row.product_key === productKey &&
      ['Products', 'Variants', 'Specifications', 'Images'].includes(row.table),
  )
  const fields = (row) =>
    Object.fromEntries(row.changes.map((change) => [change.field, change.after]))
  const root = rows.find((row) => row.table === 'Products')
  return {
    fields: fields(root),
    variants: rows
      .filter((row) => row.table === 'Variants')
      .sort((a, b) => a.entity_key.localeCompare(b.entity_key))
      .map((row) => ({ key: row.entity_key, id: row.id || null, fields: fields(row) })),
    specifications: rows
      .filter((row) => row.table === 'Specifications')
      .sort((a, b) => a.entity_key.localeCompare(b.entity_key))
      .map((row) => ({ key: row.entity_key, id: row.id || null, fields: fields(row) })),
    images: rows
      .filter((row) => row.table === 'Images')
      .sort((a, b) => a.entity_key.localeCompare(b.entity_key))
      .map((row) => ({ key: row.entity_key, id: row.id || null, fields: fields(row) })),
  }
}
// Imports cannot introduce arbitrary remote URLs. Unchanged external references
// on an existing product survive a round trip, but new references use public media
// that this staff member can browse. No Storage URLs or remote requests.
async function reviewImport(client, admin, tables) {
  const context = await transferPreviewContext(client, admin, tables)
  const { snapshot, result } = context
  let allowed
  try {
    allowed = getAllowedMediaSections(admin)
  } catch {
    allowed = { keys: [], legacy: false }
  }
  const directories = allowed.keys
    .map((key) => getUploadSectionDefinition(key).directory)
    .sort((a, b) => b.length - a.length)
  const allowedPath = (path) => {
    if (path.startsWith('/images/')) return true // Checked real public asset by the existing validator.
    if (!path.startsWith('/uploads/')) return false
    const rest = path.slice(9)
    return (
      directories.some(
        (dir) => rest.startsWith(dir + '/') && !rest.slice(dir.length + 1).includes('/'),
      ) ||
      (allowed.legacy && !rest.includes('/'))
    )
  }
  const bad = new Map()
  for (const row of result.items) {
    if (!['Products', 'Images'].includes(row.table)) continue
    const current =
      row.table === 'Products'
        ? snapshot.products.find((p) => p.product_id === row.id)
        : snapshot.images.find((i) => i.id === row.id)
    for (const change of row.changes.filter(
      (c) => ['image_url', 'seo_image_url'].includes(c.field) && c.after,
    )) {
      if (!allowedPath(change.after) && change.after !== current?.[change.field])
        bad.set(row, change.field)
    }
  }
  for (const entry of snapshot.media_fields || []) {
    if (allowedPath(entry.source_path)) continue
    const raw = tables[entry.table][entry.index]
    const row = result.items.find(
      (row) =>
        row.table === entry.table &&
        row.product_key === raw.product_key &&
        (entry.table === 'Products' || row.entity_key === raw.entity_key),
    )
    // Retaining a reference is safe; adding a protected reference is not.
    if (row?.changes.some((c) => c.field === entry.field)) bad.set(row, entry.field)
  }
  for (const [row, field] of bad) {
    row.errors.push({ field, code: 'image' })
    row.status = 'invalid'
    const parent = result.items.find(
      (r) => r.table === 'Products' && r.product_key === row.product_key,
    )
    if (parent && parent !== row) {
      parent.errors.push({ field: 'related', code: 'related' })
      parent.status = 'invalid'
    }
  }
  for (const [scope, rows] of [
    ['products', result.items.filter((r) => r.table === 'Products')],
    ['rows', result.items],
  ])
    for (const status of ['create', 'update', 'unchanged', 'invalid', 'conflicted'])
      result[scope][status] = rows.filter((r) => r.status === status).length
  return context
}
export async function stageImport(client, admin, tables, input) {
  const prepared = importSource(tables),
    digest = sourceHash(prepared)
  if (input.retry_of) {
    const parent = await importRpc(client, 'catalog_import_status', {
      p_admin_id: admin.id,
      p_job_id: input.retry_of,
    })
    if (parent.counts.pending) importError('retry')
    const committed = new Set(
      parent.items
        .filter((i) => ['succeeded', 'unchanged'].includes(i.status))
        .map((i) => i.product_key),
    )
    for (const table of ['Products', 'Variants', 'Specifications', 'Images'])
      prepared[table] = prepared[table].filter((row) => !committed.has(row.product_key))
  }
  const warehouse = prepared.Products.some((row) => !row.product_id)
    ? input.warehouse_id || null
    : null
  // A duplicate/recovered job must return its receipts before previewing already
  // committed creates (whose identifiers now correctly exist in the catalog).
  const existing = await importRpc(client, 'catalog_import_find', {
    p_admin_id: admin.id,
    p_job_id: input.job_id,
    p_source: digest,
    p_warehouse: warehouse,
    p_retry_of: input.retry_of || null,
  })
  if (existing && (existing.approved || existing.closed_reason || !existing.counts.pending))
    return { preview: null, job: existing }
  const { result, snapshot } = await reviewImport(client, admin, prepared)
  if (!result.product_count || result.rows.invalid || result.rows.conflicted)
    return { preview: result, job: existing || null }
  const roots = result.items.filter((row) => row.table === 'Products')
  if (roots.some((row) => row.new) && !input.warehouse_id) importError('warehouse')
  const items = roots.map((row) => ({
    key: row.product_key,
    id: row.id || null,
    revision: row.new
      ? null
      : Number(
          semanticCell(
            prepared.Products.find((r) => r.product_key === row.product_key).expected_revision,
          ).value,
        ),
    graph: importGraph(snapshot, row.id),
    command: importCommand(result, row.product_key),
    publish: row.changes.some((c) => c.field === 'is_published' && c.after === true),
  }))
  const job = await importRpc(client, 'catalog_import_stage', {
    p_admin_id: admin.id,
    p_job_id: input.job_id,
    p_source: digest,
    p_warehouse: warehouse,
    p_retry_of: input.retry_of || null,
    p_items: items,
    p_row_count: result.row_count,
  })
  return { preview: result, job }
}
export async function applyImport(client, admin, tables, input) {
  const prepared = importSource(tables),
    digest = sourceHash(prepared)
  let job = await importRpc(client, 'catalog_import_status', {
    p_admin_id: admin.id,
    p_job_id: input.job_id,
  })
  if (job.source_hash !== digest) importError('source')
  if (job.review_hash !== input.review_hash) importError('stale')
  if (!job.approved) importError('approval')
  for (const item of job.items.filter((i) => i.status === 'pending').slice(0, IMPORT_BATCH_SIZE)) {
    // Validate one product against a fresh database snapshot. Related omissions
    // remain omissions. No full-form normalizer or stock reconciliation runs.
    const scoped = Object.fromEntries(
      Object.keys(TABLES).map((table) => [
        table,
        ['Products', 'Variants', 'Specifications', 'Images'].includes(table)
          ? prepared[table].filter((row) => row.product_key === item.product_key)
          : [],
      ]),
    )
    scoped.Guide = prepared.Guide
    const { result } = await reviewImport(client, admin, scoped)
    const errors = result.items.flatMap((row) => row.errors)
    const failure = errors.length
      ? errors.some((e) => e.code === 'conflict')
        ? 'conflict'
        : errors.some((e) => e.code === 'image')
          ? 'media'
          : 'validation'
      : null
    await importRpc(client, 'catalog_import_apply_item', {
      p_admin_id: admin.id,
      p_job_id: input.job_id,
      p_key: item.product_key,
      p_source: digest,
      p_review: input.review_hash,
      p_command: failure ? null : importCommand(result, item.product_key),
      p_failure: failure,
    })
  }
  job = await importRpc(client, 'catalog_import_status', {
    p_admin_id: admin.id,
    p_job_id: input.job_id,
  })
  return job
}
