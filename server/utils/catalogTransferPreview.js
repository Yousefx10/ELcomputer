import {
  TABLES,
  UUID_RE,
  KEY_RE,
  semanticCell,
  TRANSFER_LIMITS as L,
} from './catalogTransferContract.js'
import { normalizeProductMoney } from './adminProducts.js'
import { normalizeProductWarranty } from '../../app/utils/warranty.js'
const editable = {
  Products: TABLES.Products.slice(4),
  Variants: TABLES.Variants.slice(4).filter((field) => field !== 'price'),
  Specifications: TABLES.Specifications.slice(4),
  Images: TABLES.Images.slice(4),
}
const nullable = new Set([
  'sku',
  'description',
  'long_description',
  'category_id',
  'brand_id',
  'old_price',
  'image_url',
  'color_name',
  'color_hex',
  'seo_title',
  'seo_description',
  'seo_image_url',
  'warranty_duration_value',
  'warranty_duration_unit',
  'expected_availability_date',
  'availability_message',
  'preorder_starts_at',
  'preorder_ends_at',
  'preorder_deposit_percent',
  'preorder_total_limit',
  'preorder_customer_limit',
  'definition_id',
  'alt_text',
  'variant_key',
])
const numeric = new Set([
  'price',
  'old_price',
  'warranty_duration_value',
  'preorder_deposit_percent',
  'preorder_total_limit',
  'preorder_customer_limit',
  'sort_order',
  'expected_revision',
])
const booleans = new Set(['is_published', 'is_active', 'is_highlight', 'preorder_active'])
const textLimits = {
  title: 500,
  description: 10000,
  long_description: 100000,
  slug: 200,
  sku: 120,
  name: 120,
  code: 80,
  label: 200,
  value: 100000,
  color_name: 120,
  color_hex: 7,
  seo_title: 1000,
  seo_description: 10000,
  availability_message: 500,
  alt_text: 1000,
  image_url: 2048,
  seo_image_url: 2048,
}
export function collectMatches(tables) {
  const unique = (name, table, field, max = 200) => [
    ...new Set(
      tables[table]
        .map((r) => semanticCell(r[field] || ''))
        .filter((c) => c.kind === 'value' && typeof c.value === 'string' && c.value.length <= max)
        .map((c) => c.value)
        .filter((v) => (name.endsWith('ids') ? UUID_RE.test(v) : Boolean(v))),
    ),
  ]
  return {
    ids: unique('ids', 'Products', 'product_id'),
    slugs: unique('slugs', 'Products', 'slug'),
    product_skus: unique('product_skus', 'Products', 'sku', 120),
    variant_skus: unique('variant_skus', 'Variants', 'sku', 120),
    variant_ids: unique('variant_ids', 'Variants', 'id'),
    spec_ids: unique('spec_ids', 'Specifications', 'id'),
    image_ids: unique('image_ids', 'Images', 'id'),
  }
}
export function snapshotTables(snapshot, guide) {
  const source = {
    Products: snapshot.products,
    Variants: snapshot.variants,
    Specifications: snapshot.specifications,
    Images: snapshot.images,
    Categories: snapshot.categories,
    Brands: snapshot.brands,
    Definitions: snapshot.definitions,
    Guide: guide,
  }
  return Object.fromEntries(
    Object.keys(TABLES).map((table) => [
      table,
      (source[table] || []).map((row) =>
        Object.fromEntries(
          TABLES[table].map((field) => [
            field,
            ['price', 'old_price', 'preorder_deposit_percent'].includes(field) && row[field] != null
              ? (() => {
                  try {
                    return canonicalMoney(row[field])
                  } catch {
                    return row[field]
                  }
                })()
              : row[field],
          ]),
        ),
      ),
    ]),
  )
}
const canonicalMoney = (value) => {
  normalizeProductMoney(value, 'price')
  const [a, b = ''] = String(value).split('.')
  return a + '.' + b.padEnd(2, '0')
}
const equal = (field, a, b) => {
  if (a == null || b == null) return a === b
  if (['price', 'old_price', 'preorder_deposit_percent'].includes(field)) {
    try {
      return canonicalMoney(a) === canonicalMoney(b)
    } catch {
      return String(a) === String(b)
    }
  }
  return String(a) === String(b)
}
export function previewCatalog(tables, snapshot, { invalidMedia = new Set() } = {}) {
  const products = new Map(snapshot.products.map((p) => [p.product_id, p])),
    variants = new Map(snapshot.variants.map((v) => [v.id, v])),
    specs = new Map(snapshot.specifications.map((s) => [s.id, s])),
    images = new Map(snapshot.images.map((i) => [i.id, i]))
  const refs = {
    category_id: new Map(snapshot.categories.map((r) => [r.id, r])),
    brand_id: new Map(snapshot.brands.map((r) => [r.id, r])),
    definition_id: new Map(snapshot.definitions.map((r) => [r.id, r])),
  }
  const results = [],
    roots = new Map(),
    related = new Map(),
    recordIds = new Map(),
    entityKeys = new Map()
  const addError = (row, field, code) => {
    if (!row.errors.some((e) => e.field === field && e.code === code))
      row.errors.push({ field, code })
  }
  const parse = (table, raw) => {
    const row = {
      table,
      row: raw._row || 2,
      sheet: raw._sheet || table,
      product_key: raw.product_key || '',
      entity_key: raw.entity_key || '',
      id: raw.id || raw.product_id || null,
      title: raw.title || '',
      status: 'unchanged',
      errors: [],
      fields: {},
      raw,
      current: null,
      new: false,
    }
    results.push(row)
    for (const field of editable[table]) {
      const c = semanticCell(raw[field] || '')
      if (c.kind === 'omit') continue
      let value = c.value
      if (
        raw._types?.[field] &&
        raw._types[field] !== 'text' &&
        !numeric.has(field) &&
        !booleans.has(field)
      ) {
        addError(row, field, 'text_required')
        continue
      }
      if (c.kind === 'clear' && !nullable.has(field)) {
        addError(row, field, 'cannot_clear')
        continue
      }
      if (typeof value === 'string' && invalidMedia.has(value)) addError(row, field, 'image')
      if (value !== null) {
        if (textLimits[field] !== undefined && value.length > textLimits[field])
          addError(row, field, 'length')
        if (
          ['slug', 'sku', 'code', 'name', 'title', 'label'].includes(field) &&
          (value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value))
        )
          addError(row, field, 'text')
        if (field === 'slug' && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value))
          addError(row, field, 'slug')
        if (field === 'code' && !/^[A-Z0-9_-]+$/.test(value)) addError(row, field, 'code')
        if (field === 'color_hex' && !/^#[0-9a-f]{6}$/i.test(value)) addError(row, field, 'color')
        if (['price', 'old_price', 'preorder_deposit_percent'].includes(field)) {
          try {
            value = canonicalMoney(value)
          } catch {
            addError(row, field, 'money')
          }
        } else if (numeric.has(field)) {
          if (
            !/^(0|[1-9]\d*)$/.test(value) ||
            !Number.isSafeInteger(Number(value)) ||
            Number(value) > 2147483647
          )
            addError(row, field, 'integer')
          else value = Number(value)
        }
        if (booleans.has(field)) {
          if (!['true', 'false'].includes(value)) addError(row, field, 'boolean')
          else value = value === 'true'
        }
        if (refs[field]) {
          if (!UUID_RE.test(value)) addError(row, field, 'reference_id')
          else {
            value = value.toLowerCase()
            if (!refs[field].has(value)) addError(row, field, 'reference_missing')
          }
        }
        if (field === 'selling_mode' && !['normal', 'coming_soon', 'preorder'].includes(value))
          addError(row, field, 'mode')
        if (field === 'preorder_payment_mode' && !['full', 'deposit'].includes(value))
          addError(row, field, 'payment_mode')
        if (field === 'warranty_status' && !['unknown', 'included', 'none'].includes(value))
          addError(row, field, 'warranty')
        if (field === 'warranty_duration_unit' && !['months', 'years'].includes(value))
          addError(row, field, 'warranty')
        if (
          field === 'expected_availability_date' &&
          (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
            !Number.isFinite(Date.parse(value + 'T00:00:00Z')) ||
            new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value)
        )
          addError(row, field, 'date')
        if (
          ['preorder_starts_at', 'preorder_ends_at'].includes(field) &&
          (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
            value,
          ) ||
            !Number.isFinite(Date.parse(value)) ||
            new Date(value.slice(0, 10) + 'T00:00:00Z').toISOString().slice(0, 10) !==
              value.slice(0, 10))
        )
          addError(row, field, 'date')
        if (['image_url', 'seo_image_url'].includes(field) && invalidMedia.has(value))
          addError(row, field, 'image')
      }
      row.fields[field] = value
    }
    for (const f of [
      'product_key',
      'entity_key',
      'id',
      'product_id',
      'expected_hash',
      'tracking_mode',
    ])
      if (raw[f] && raw._types?.[f] && raw._types[f] !== 'text') addError(row, f, 'text_required')
    if (!KEY_RE.test(row.product_key)) addError(row, 'product_key', 'key')
    return row
  }
  for (const raw of tables.Products) {
    const r = parse('Products', raw)
    if (roots.has(r.product_key)) {
      addError(r, 'product_key', 'duplicate')
      addError(roots.get(r.product_key), 'product_key', 'duplicate')
    } else roots.set(r.product_key, r)
    const id = semanticCell(raw.product_id || ''),
      revision = semanticCell(raw.expected_revision || '')
    if (id.kind === 'clear' || (id.kind === 'value' && !UUID_RE.test(id.value)))
      addError(r, 'product_id', 'id')
    r.new = id.kind === 'omit'
    if (!r.new && UUID_RE.test(id.value || '')) {
      r.id = id.value.toLowerCase()
      r.current = products.get(r.id)
      if (!r.current) addError(r, 'product_id', 'missing')
      if (recordIds.has(r.id)) {
        addError(r, 'product_id', 'duplicate')
        addError(recordIds.get(r.id), 'product_id', 'duplicate')
      }
      recordIds.set(r.id, r)
    }
    if (r.new) {
      if (!snapshot.can_create) addError(r, 'product_id', 'permission')
      if (revision.kind !== 'omit') addError(r, 'expected_revision', 'unexpected')
      if (!snapshot.has_active_warehouse) addError(r, 'product_id', 'warehouse')
      for (const field of ['title', 'slug', 'price', 'selling_mode', 'is_published'])
        if (!Object.hasOwn(r.fields, field) || r.fields[field] === null || r.fields[field] === '')
          addError(r, field, 'required')
    } else {
      if (!snapshot.can_update) addError(r, 'product_id', 'permission')
      if (
        revision.kind !== 'value' ||
        !/^\d+$/.test(revision.value) ||
        !Number.isSafeInteger(Number(revision.value))
      )
        addError(r, 'expected_revision', 'revision')
      else if (r.current && Number(revision.value) !== r.current.expected_revision)
        addError(r, 'expected_revision', 'conflict')
    }
    const tracking = semanticCell(raw.tracking_mode || '')
    if (
      tracking.kind !== 'omit' &&
      (tracking.kind !== 'value' ||
        tracking.value !== (r.new ? 'serialized' : r.current?.tracking_mode))
    )
      addError(r, 'tracking_mode', 'readonly')
    const merged = { ...r.current, ...r.fields }
    r.merged = merged
    if (!String(merged.title || '').trim() || String(merged.title).length > 500)
      addError(r, 'title', 'required')
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(merged.slug || '') || String(merged.slug).length > 200)
      addError(r, 'slug', 'slug')
    try {
      canonicalMoney(merged.price)
      if (merged.old_price != null) canonicalMoney(merged.old_price)
    } catch {
      addError(r, 'price', 'money')
    }
    if (!['normal', 'coming_soon', 'preorder'].includes(merged.selling_mode))
      addError(r, 'selling_mode', 'mode')
    if (merged.is_published === true && r.current?._operational_ready === false)
      addError(r, 'is_published', 'readiness')
    if (merged.selling_mode === 'preorder') {
      if (!(Number(merged.price) > 0)) addError(r, 'price', 'money')
      if (r.new)
        for (const field of ['preorder_active', 'preorder_payment_mode'])
          if (!Object.hasOwn(r.fields, field)) addError(r, field, 'required')
    }
    if (
      merged.preorder_payment_mode === 'deposit' &&
      !(
        Number(merged.preorder_deposit_percent) > 0 && Number(merged.preorder_deposit_percent) < 100
      )
    )
      addError(r, 'preorder_deposit_percent', 'percent')
    if (
      merged.preorder_starts_at &&
      merged.preorder_ends_at &&
      Date.parse(merged.preorder_ends_at) <= Date.parse(merged.preorder_starts_at)
    )
      addError(r, 'preorder_ends_at', 'date')
    for (const field of [
      'preorder_total_limit',
      'preorder_customer_limit',
      'warranty_duration_value',
    ])
      if (merged[field] != null && Number(merged[field]) < 1) addError(r, field, 'integer')
    try {
      normalizeProductWarranty(merged)
    } catch {
      addError(r, 'warranty_status', 'warranty')
    }
    for (const p of snapshot.product_collisions) {
      if (
        p.id !== r.id &&
        ((merged.slug && p.slug === merged.slug) ||
          (merged.sku && p.sku?.toLowerCase() === merged.sku.toLowerCase()))
      )
        addError(r, p.slug === merged.slug ? 'slug' : 'sku', 'duplicate')
    }
    r.status = r.new
      ? 'create'
      : Object.entries(r.fields).some(([f, v]) => !equal(f, v, r.current?.[f]))
        ? 'update'
        : 'unchanged'
  }
  for (const table of ['Variants', 'Specifications', 'Images'])
    for (const raw of tables[table]) {
      const r = parse(table, raw),
        parent = roots.get(r.product_key)
      if (!parent) addError(r, 'product_key', 'parent')
      else {
        const list = related.get(r.product_key) || []
        list.push(r)
        related.set(r.product_key, list)
      }
      if (!KEY_RE.test(r.entity_key)) addError(r, 'entity_key', 'key')
      const entity = table + ':' + r.product_key + ':' + r.entity_key
      if (entityKeys.has(entity)) {
        addError(r, 'entity_key', 'duplicate')
        addError(entityKeys.get(entity), 'entity_key', 'duplicate')
      }
      entityKeys.set(entity, r)
      const id = semanticCell(raw.id || ''),
        hash = semanticCell(raw.expected_hash || '')
      r.new = id.kind === 'omit'
      if (!r.new) {
        if (id.kind !== 'value' || !UUID_RE.test(id.value)) addError(r, 'id', 'id')
        else {
          r.id = id.value.toLowerCase()
          r.current = { Variants: variants, Specifications: specs, Images: images }[table].get(r.id)
          if (!r.current || r.current.product_key !== parent?.id) addError(r, 'id', 'parent')
          const key = table + ':' + r.id
          if (recordIds.has(key)) {
            addError(r, 'id', 'duplicate')
            addError(recordIds.get(key), 'id', 'duplicate')
          }
          recordIds.set(key, r)
        }
        if (hash.kind !== 'value' || !/^[0-9a-f]{64}$/.test(hash.value))
          addError(r, 'expected_hash', 'hash')
        else if (r.current && hash.value !== r.current.expected_hash)
          addError(r, 'expected_hash', 'conflict')
      } else if (hash.kind !== 'omit') addError(r, 'expected_hash', 'unexpected')
      if (r.new)
        for (const f of {
          Variants: ['name', 'code', 'is_active'],
          Specifications: ['label', 'value', 'sort_order', 'is_highlight'],
          Images: ['variant_key', 'image_url', 'sort_order'],
        }[table]) {
          const cell = semanticCell(raw[f] || '')
          if (cell.kind !== 'value' || cell.value === '') addError(r, f, 'required')
        }
      r.merged = { ...r.current, ...r.fields }
      r.status = r.new
        ? 'create'
        : Object.entries(r.fields).some(([f, v]) => !equal(f, v, r.current?.[f]))
          ? 'update'
          : 'unchanged'
      if (table === 'Variants') {
        const priceCell = semanticCell(raw.price || '')
        if (priceCell.kind !== 'omit' && !equal('price', priceCell.value, r.current?.price ?? null))
          addError(r, 'price', 'readonly')

        if (r.new && r.merged.is_active !== true) addError(r, 'is_active', 'active')
        if (r.current?._gallery_reference && r.merged.is_active === false)
          addError(r, 'is_active', 'gallery')
        if (parent?.current?.tracking_mode === 'aggregate' && r.status !== 'unchanged')
          addError(r, 'id', 'legacy')
        for (const v of snapshot.variant_collisions)
          if (
            r.merged.is_active &&
            r.merged.sku &&
            v.id !== r.id &&
            v.sku?.toLowerCase() === r.merged.sku.toLowerCase()
          )
            addError(r, 'sku', 'duplicate')
      }
      if (
        table === 'Specifications' &&
        r.merged.definition_id &&
        refs.definition_id.get(r.merged.definition_id)?.is_active === false &&
        !equal('definition_id', r.merged.definition_id, r.current?.definition_id)
      )
        addError(r, 'definition_id', 'reference_missing')
    }
  // Duplicate prospective root identifiers, active option codes/SKUs and definitions.
  const checkUnique = (rows, get, field) => {
    const seen = new Map()
    for (const r of rows) {
      const v = get(r)
      if (!v) continue
      if (seen.has(v)) {
        addError(r, field, 'duplicate')
        addError(seen.get(v), field, 'duplicate')
      } else seen.set(v, r)
    }
  }
  checkUnique([...roots.values()], (r) => r.merged.slug, 'slug')
  checkUnique([...roots.values()], (r) => r.merged.sku?.toLowerCase(), 'sku')
  const activeAll = []
  for (const root of roots.values()) {
    const children = related.get(root.product_key) || [],
      provided = children.filter((r) => r.table === 'Variants'),
      next = new Map(
        snapshot.variants
          .filter((v) => v.product_key === root.id)
          .map((v) => [v.id, { merged: v, current: v, errors: [], fields: {} }]),
      )
    for (const r of provided) next.set(r.new ? r.entity_key : r.id, r)
    const active = [...next.values()].filter((r) => r.merged.is_active)
    for (const option of active) {
      if (
        !String(option.merged.name || '').trim() ||
        String(option.merged.name).length > 120 ||
        !/^[A-Z0-9_-]{1,80}$/.test(option.merged.code || '')
      )
        addError(root, 'variants', 'options')
    }
    if (active.length < 1 || (root.current?.tracking_mode !== 'aggregate' && active.length > 100))
      addError(root, 'variants', 'options')
    checkUnique(active, (r) => r.merged.code?.toLowerCase(), 'code')
    if (active.some((r) => r.errors.length)) addError(root, 'variants', 'options')
    activeAll.push(...active)
    const nextSpecs = new Map(
      snapshot.specifications
        .filter((s) => s.product_key === root.id)
        .map((s) => [s.id, { merged: s, errors: [] }]),
    )
    for (const r of children.filter((c) => c.table === 'Specifications'))
      nextSpecs.set(r.new ? r.entity_key : r.id, r)
    checkUnique([...nextSpecs.values()], (r) => r.merged.definition_id, 'definition_id')
    for (const r of children.filter((r) => r.table === 'Images')) {
      const c = semanticCell(r.raw.variant_key || '')
      if (
        (c.kind === 'omit' && r.current) ||
        (c.kind === 'clear' && r.current?.variant_key == null)
      ) {
        continue
      }
      if (c.kind === 'clear') addError(r, 'variant_key', 'cannot_clear')
      const linked =
        provided.find((v) => v.entity_key === c.value) ||
        [...next.values()].find((v) => v.current?.entity_key === c.value)
      if (c.kind !== 'value' || !linked || !linked.merged.is_active)
        addError(r, 'variant_key', 'variant')
      else {
        // Resolve the explicitly declared file key to its existing option ID.
        // Changing an alias alone does not change the stored relationship.
        r.fields.variant_key = linked.new ? c.value : linked.id || linked.current?.id
        r.status = r.new
          ? 'create'
          : Object.entries(r.fields).some(
                ([field, value]) => !equal(field, value, r.current?.[field]),
              )
            ? 'update'
            : 'unchanged'
      }
    }
    for (const r of children)
      if (r.errors.length)
        r.status = r.errors.some((e) => e.code === 'conflict') ? 'conflicted' : 'invalid'
    if (children.some((r) => r.status === 'invalid')) addError(root, 'related', 'related')
    if (children.some((r) => r.status === 'conflicted')) addError(root, 'related', 'conflict')
    if (root.errors.length)
      root.status = root.errors.some((e) => e.code === 'conflict') ? 'conflicted' : 'invalid'
    else if (!root.new && children.some((r) => ['create', 'update'].includes(r.status)))
      root.status = 'update'
  }
  checkUnique(activeAll, (r) => r.merged.sku?.toLowerCase(), 'sku')
  for (const root of roots.values()) {
    const children = related.get(root.product_key) || []
    if (children.some((r) => r.errors.some((e) => e.code !== 'conflict')))
      addError(root, 'related', 'related')
    if (children.some((r) => r.errors.some((e) => e.code === 'conflict')))
      addError(root, 'related', 'conflict')
  }
  for (const r of results) {
    if (r.errors.length)
      r.status = r.errors.some((e) => e.code === 'conflict') ? 'conflicted' : 'invalid'
  }
  // Lookup rows describe current references, never create or rename them.
  for (const [table, lookup] of [
    ['Categories', refs.category_id],
    ['Brands', refs.brand_id],
    ['Definitions', refs.definition_id],
  ]) {
    const ids = new Map()
    for (const raw of tables[table]) {
      const r = {
        table,
        row: raw._row || 2,
        sheet: raw._sheet || table,
        product_key: '',
        entity_key: '',
        id: raw.id,
        title: raw.name || '',
        status: 'reference',
        errors: [],
      }
      results.push(r)
      const id = raw.id
      if (!UUID_RE.test(id || '')) addError(r, 'id', 'reference_id')
      else {
        const current = lookup.get(id.toLowerCase())
        if (!current) addError(r, 'id', 'reference_missing')
        else
          for (const f of TABLES[table].filter((f) => f !== 'id')) {
            const c = semanticCell(raw[f] || '')
            if (c.kind !== 'omit' && !equal(f, c.value, current[f])) addError(r, f, 'readonly')
          }
        if (ids.has(id.toLowerCase())) {
          addError(r, 'id', 'duplicate')
          addError(ids.get(id.toLowerCase()), 'id', 'duplicate')
        }
        ids.set(id.toLowerCase(), r)
      }
      if (r.errors.length) r.status = 'invalid'
    }
  }
  for (const row of results)
    if (row.errors.length)
      row.status = row.errors.some((error) => error.code === 'conflict') ? 'conflicted' : 'invalid'
  const counted = (rows) =>
    Object.fromEntries(
      ['create', 'update', 'unchanged', 'invalid', 'conflicted'].map((status) => [
        status,
        rows.filter((r) => r.status === status).length,
      ]),
    )
  const rootRows = results.filter((r) => r.table === 'Products'),
    allErrors = results.flatMap((r) => r.errors)
  return {
    version: 'elcomputer_catalog_1',
    read_only: true,
    products: counted(rootRows),
    rows: {
      ...counted(results),
      reference: results.filter((r) => r.status === 'reference').length,
    },
    product_count: rootRows.length,
    row_count: results.length,
    missing_references: allErrors.filter((e) => e.code === 'reference_missing').length,
    duplicates: allErrors.filter((e) => e.code === 'duplicate').length,
    items: results.map(({ raw, current, merged, fields, ...r }) => ({
      ...r,
      changes: Object.entries(fields || {})
        .filter(([field, value]) => !current || !equal(field, value, current[field]))
        .map(([field, value]) => ({
          field,
          kind: value === null ? 'clear' : 'set',
          before: current?.[field] ?? null,
          after: value,
        })),
    })),
  }
}
