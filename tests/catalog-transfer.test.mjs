import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile, writeFile, mkdtemp, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  TABLES,
  guideRows,
  semanticCell,
  TRANSFER_LIMITS as L,
  CSV_HEADERS,
} from '../server/utils/catalogTransferContract.js'
import { readCsv, writeCsv } from '../server/utils/catalogTransferCsv.js'
import { readXlsx, writeXlsx } from '../server/utils/catalogTransferXlsx.js'
import { readZip, writeZip } from '../server/utils/catalogTransferZip.js'
import {
  collectMatches,
  previewCatalog,
  snapshotTables,
} from '../server/utils/catalogTransferPreview.js'
import { createProductSaveHttpFixture } from './helpers/productSaveHttpFixture.mjs'
import { createMediaFixture } from './helpers/mediaFixture.mjs'
import { createEmailNativeDatabase, emailNativeAvailable } from './helpers/emailNativeDatabase.mjs'
import {
  createStorageNativeDatabase,
  storageNativeAvailable,
} from './helpers/storageNativeDatabase.mjs'
import { createCatalogRestFixture } from './helpers/catalogRestFixture.mjs'
import { nativeWaitFor } from './helpers/emailNativeDatabase.mjs'
import { createProductSaveFixture } from './helpers/productSaveFixture.mjs'
const tables = () => ({
  ...Object.fromEntries(Object.keys(TABLES).map((n) => [n, []])),
  Guide: guideRows(),
})
const zipParts = (bytes) =>
  Object.fromEntries(
    [...readZip(bytes)].map(([name, data]) => [
      name === '[content_types].xml'
        ? '[Content_Types].xml'
        : name === 'xl/sharedstrings.xml'
          ? 'xl/sharedStrings.xml'
          : name,
      data,
    ]),
  )
const rejects = (fn, code) =>
  assert.throws(fn, (e) => Boolean(e.catalogTransfer) && (!code || e.catalogTransfer === code))
const fresh = () => {
  const t = tables()
  t.Products.push({
    product_key: 'new_1',
    title: 'منتج مؤلف',
    slug: 'authored-product',
    sku: '000012',
    price: '19.90',
    selling_mode: 'normal',
    is_published: false,
    warranty_status: 'unknown',
  })
  t.Variants.push({
    product_key: 'new_1',
    entity_key: 'option_1',
    name: 'Default',
    code: 'DEFAULT',
    sku: '000013',
    is_active: true,
  })
  return t
}
const roundTrip = (t, format = 'csv') =>
  format === 'csv' ? readCsv(writeCsv(t)) : readXlsx(writeXlsx(t))
const snapshot = {
  products: [],
  variants: [],
  specifications: [],
  images: [],
  categories: [],
  brands: [],
  definitions: [],
  product_collisions: [],
  variant_collisions: [],
  can_create: true,
  can_update: true,
  has_active_warehouse: true,
  unavailable_media: [],
}

test('catalog transfer file contract and hostile parsing', async (t) => {
  for (const format of ['csv', 'xlsx'])
    await t.test(
      format + ' round-trip preserves Arabic, protected text, leading zeros and precision',
      () => {
        const source = fresh()
        Object.assign(source.Products[0], {
          description: '=SUM(1,2)\nمرحبا, "نص"',
          long_description: "'literal apostrophe",
          seo_title: '#CLEAR',
          price: '9999999999.99',
        })
        const decoded = roundTrip(source, format)
        assert.equal(decoded.Products[0].sku, '000012')
        assert.equal(decoded.Products[0].price, '9999999999.99')
        assert.equal(decoded.Products[0].description, source.Products[0].description)
        assert.equal(decoded.Products[0].long_description, source.Products[0].long_description)
        assert.equal(decoded.Products[0].seo_title, '##CLEAR')
        assert.equal(previewCatalog(decoded, snapshot).products.create, 1)
      },
    )
  await t.test('blank, explicit clearing and literal markers remain distinct', () => {
    const s = fresh()
    s.Products[0].description = null
    s.Products[0].long_description = ''
    const p = previewCatalog(roundTrip(s), snapshot).items[0]
    assert.ok(p.changes.some((c) => c.field === 'description' && c.kind === 'clear'))
    assert.ok(p.changes.some((c) => c.field === 'long_description' && c.after === ''))
    assert.ok(!p.changes.some((c) => c.field === 'category_id'))
  })
  await t.test('CSV rejects unprotected formulas, bad UTF-8, headers, columns and versions', () => {
    const csv = writeCsv(fresh()).toString()
    rejects(() => readCsv(Buffer.from(csv.replace('"منتج مؤلف"', '"=1+1"'))), 'formula')
    rejects(() => readCsv(Buffer.from([0xff])), 'encoding')
    rejects(() => readCsv(Buffer.from(csv.replace('"record_type"', '"unknown"'))), 'headers')
    rejects(
      () => readCsv(Buffer.from(csv.replace('elcomputer_catalog_1', 'unsupported'))),
      'version',
    )
    rejects(() => readCsv(Buffer.from('"unfinished')), 'csv')
    rejects(() => readCsv(Buffer.alloc(L.upload + 1)), 'limit')
    assert.ok(CSV_HEADERS.length <= 64)
  })
  const workbook = writeXlsx(fresh())
  for (const [name, mutate] of [
    [
      'formula',
      (p) =>
        (p['xl/worksheets/sheet1.xml'] = p['xl/worksheets/sheet1.xml']
          .toString()
          .replace(
            '<sheetData>',
            '<sheetData><row r="5999"><c r="A5999"><f>HYPERLINK("https://evil.invalid")</f><v>1</v></c></row>',
          )),
    ],
    [
      'external relationship',
      (p) =>
        (p['xl/_rels/workbook.xml.rels'] = p['xl/_rels/workbook.xml.rels']
          .toString()
          .replace(
            '</Relationships>',
            '<Relationship Id="evil" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="https://evil.invalid" TargetMode="External"/></Relationships>',
          )),
    ],
    [
      'DTD',
      (p) =>
        (p['xl/styles.xml'] = p['xl/styles.xml']
          .toString()
          .replace(
            '<styleSheet',
            '<!DOCTYPE x [<!ENTITY x SYSTEM "file:///etc/passwd">]><styleSheet',
          )),
    ],
    ['macro part', (p) => (p['xl/vbaProject.bin'] = 'MZ')],
    [
      'hidden sheet',
      (p) =>
        (p['xl/workbook.xml'] = p['xl/workbook.xml']
          .toString()
          .replace('name="Products"', 'name="Products" state="hidden"')),
    ],
    [
      'duplicate value',
      (p) =>
        (p['xl/worksheets/sheet1.xml'] = p['xl/worksheets/sheet1.xml']
          .toString()
          .replace(
            '</sheetData>',
            '<row r="5999"><c r="A5999"><v>1</v><v>2</v></c></row></sheetData>',
          )),
    ],
    [
      'cell outside row',
      (p) =>
        (p['xl/worksheets/sheet1.xml'] = p['xl/worksheets/sheet1.xml']
          .toString()
          .replace('<sheetData>', '<sheetData><c r="A5999"><v>1</v></c>')),
    ],
    [
      'unsupported sheet',
      (p) =>
        (p['xl/workbook.xml'] = p['xl/workbook.xml']
          .toString()
          .replace('name="Products"', 'name="Private"')),
    ],
    [
      'oversized dimension',
      (p) =>
        (p['xl/worksheets/sheet1.xml'] = p['xl/worksheets/sheet1.xml']
          .toString()
          .replace('<sheetData>', '<dimension ref="A1:ZZ6000"/><sheetData>')),
    ],
  ])
    await t.test('XLSX rejects ' + name, () => {
      const parts = zipParts(workbook)
      mutate(parts)
      rejects(() => readXlsx(writeZip(parts)))
    })
  await t.test('ZIP rejects CRC corruption, hidden bytes, symlinks and inflated limits', () => {
    const crc = Buffer.from(workbook)
    crc[14] ^= 1
    rejects(() => readXlsx(crc))
    rejects(() => readXlsx(Buffer.concat([workbook, Buffer.from('hidden')])))
    const sym = Buffer.from(workbook),
      central = sym.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]))
    sym.writeUInt32LE(0xa0000000, central + 38)
    rejects(() => readXlsx(sym))
    const bomb = Buffer.from(workbook)
    bomb.writeUInt32LE(L.part + 1, central + 24)
    rejects(() => readXlsx(bomb))
  })
  await t.test('numeric SKU cells are rejected instead of reconstructing lost zeros', () => {
    const parts = zipParts(workbook)
    parts['xl/worksheets/sheet1.xml'] = parts['xl/worksheets/sheet1.xml']
      .toString()
      .replace(
        '<c r="G2" s="1" t="inlineStr"><is><t xml:space="preserve">000012</t></is></c>',
        '<c r="G2" t="n"><v>12</v></c>',
      )
    const result = previewCatalog(readXlsx(writeZip(parts)), snapshot)
    assert.ok(result.items[0].errors.some((e) => e.field === 'sku' && e.code === 'text_required'))
  })
  await t.test('counts, integer and money bounds are enforced without truncation', () => {
    for (const price of ['', '1.234', '-1', '1e2', 'NaN', '10000000000.00']) {
      const source = fresh()
      source.Products[0].price = price
      assert.equal(previewCatalog(roundTrip(source), snapshot).products.invalid, 1, price)
    }
    const s = fresh()
    s.Specifications.push({
      product_key: 'new_1',
      entity_key: 'spec_1',
      label: 'Known',
      value: 'Authored',
      sort_order: '1.5',
      is_highlight: true,
    })
    assert.equal(previewCatalog(roundTrip(s), snapshot).products.invalid, 1)
    const large = fresh()
    large.Products = Array.from({ length: 251 }, () => large.Products[0])
    rejects(() => writeCsv(large), 'limit')
  })
  await t.test('exact references and duplicates are reported without fuzzy matching', () => {
    const source = fresh()
    source.Products[0].category_id = randomUUID()
    source.Products.push({ ...source.Products[0], product_key: 'new_2' })
    source.Variants.push({ ...source.Variants[0], product_key: 'new_2' })
    const r = previewCatalog(roundTrip(source), snapshot)
    assert.equal(r.products.invalid, 2)
    assert.ok(r.missing_references >= 2)
    assert.ok(r.duplicates >= 2)
    assert.deepEqual(collectMatches(roundTrip(source)).ids, [])
  })
})

test('shared-string rich text is exact and phonetic/malformed text is rejected', () => {
  const source = fresh(),
    parts = zipParts(writeXlsx(source)),
    S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
  parts['xl/worksheets/sheet1.xml'] = parts['xl/worksheets/sheet1.xml']
    .toString()
    .replace(
      '<c r="G2" s="1" t="inlineStr"><is><t xml:space="preserve">000012</t></is></c>',
      '<c r="G2" t="s"><v>0</v></c>',
    )
  parts['xl/sharedStrings.xml'] =
    '<sst xmlns="' + S + '"><si><r><t>000</t></r><r><t>012</t></r></si></sst>'
  assert.equal(readXlsx(writeZip(parts)).Products[0].sku, '000012')
  parts['xl/sharedStrings.xml'] =
    '<sst xmlns="' + S + '"><si><t>000012</t><rPh><t>different</t></rPh></si></sst>'
  rejects(() => readXlsx(writeZip(parts)), 'workbook')
  parts['xl/sharedStrings.xml'] = '<sst xmlns="' + S + '"><t>outside item</t></sst>'
  rejects(() => readXlsx(writeZip(parts)), 'workbook')
})

test('unchanged legacy aggregate options retain their existing active-count rule', () => {
  const id = randomUUID(),
    s = {
      ...snapshot,
      products: [
        {
          product_id: id,
          product_key: id,
          tracking_mode: 'aggregate',
          expected_revision: 1,
          title: 'Legacy',
          slug: 'legacy',
          price: '10.00',
          selling_mode: 'normal',
          is_published: false,
          warranty_status: 'unknown',
        },
      ],
      variants: Array.from({ length: 101 }, (_, i) => ({
        id: randomUUID(),
        product_key: id,
        name: 'Default',
        code: 'OPTION_' + i,
        is_active: true,
      })),
    }
  const source = tables()
  source.Products = [{ product_key: id, product_id: id, expected_revision: 1 }]
  assert.equal(previewCatalog(roundTrip(source), s).products.unchanged, 1)
})

test('exports reject invalid text rather than creating a broken workbook', () => {
  const source = fresh()
  source.Products[0].description = 'Bad\u0001text'
  rejects(() => writeCsv(source), 'content')
  rejects(() => writeXlsx(source), 'content')
  source.Products[0].description = 'Bad\ufffftext'
  rejects(() => writeXlsx(source), 'content')
})

test('actual transfer HTTP, authorization and read-only catalog integrity', async (t) => {
  const f = await createProductSaveHttpFixture()
  const media = await createMediaFixture({ fixture: f })
  f.client.__ownedUploadsDir = media.root
  t.after(async () => {
    await media.close()
    await f.close()
  })
  const product = await f.save(
      f.body({
        title: 'منتج محفوظ',
        sku: '000012',
        description: 'Known description',
        long_description: 'Known authored text',
      }),
    ),
    edit = await f.snapshot(product.id)
  await media.addFile('products/transfer.png')
  await f.db.query('update public.products set image_url=$1 where id=$2', [
    '/uploads/products/transfer.png',
    product.id,
  ])
  const gallery = (
    await f.db.query(
      'insert into public.product_images(product_id,variant_id,image_url,sort_order) values($1,$2,$3,0) returning id',
      [product.id, edit.variants[0].id, '/uploads/products/transfer.png'],
    )
  ).rows[0].id
  const invariants = async () => {
    const rows = {}
    for (const table of [
      'products',
      'product_variants',
      'product_images',
      'product_specifications',
      'commerce_warehouses',
      'commerce_crm_accounts',
      'commerce_serialized_units',
      'commerce_sales_orders',
      'site_settings',
      'admin_activity_logs',
    ])
      rows[table] = (
        await f.db.query(
          'select to_jsonb(t) row from public.' + table + ' t order by to_jsonb(t)::text',
        )
      ).rows
    for (const table of [
      'product_revisions',
      'product_save_receipts',
      'product_bulk_receipts',
      'media_paths',
    ])
      rows[table] = (
        await f.db.query(
          'select to_jsonb(t) row from catalog_private.' + table + ' t order by to_jsonb(t)::text',
        )
      ).rows
    return rows
  }
  const before = await invariants()
  const request = async (path, { actor = 'owner', body, method = 'POST', raw = false } = {}) =>
    fetch(f.url + path, {
      method,
      headers: {
        authorization: actor ? 'Bearer ' + actor : '',
        'content-type': raw ? 'application/octet-stream' : 'application/json',
      },
      ...(body ? { body: raw ? body : JSON.stringify(body) } : {}),
    })
  const exportFile = async (format = 'csv', actor = 'owner', extras = {}) => {
    const r = await request('/api/admin-products/transfer/export', {
      actor,
      body: { format, scope: 'selected', ids: [product.id], filters: {}, ...extras },
    })
    assert.equal(r.status, 200, await r.clone().text())
    assert.equal(r.headers.get('cache-control'), 'private, no-store')
    return { r, bytes: Buffer.from(await r.arrayBuffer()) }
  }
  const preview = async (source, format = 'csv', actor = 'owner') => {
    const r = await request('/api/admin-products/transfer/preview?format=' + format, {
      actor,
      body: Buffer.isBuffer(source)
        ? source
        : format === 'csv'
          ? writeCsv(source)
          : writeXlsx(source),
      raw: true,
    })
    return { r, body: await r.json() }
  }
  let exported
  for (const format of ['csv', 'xlsx'])
    await t.test(
      format + ' export, template and preview use real data and matching revisions',
      async () => {
        const { bytes } = await exportFile(format)
        const data = format === 'csv' ? readCsv(bytes) : readXlsx(bytes)
        assert.equal(data.Products.length, 1)
        assert.equal(data.Products[0].sku, '000012')
        assert.equal(data.Products[0].price, '125.50')
        assert.equal(data.Images[0].id, gallery)
        assert.equal(data.Variants[0].entity_key, edit.variants[0].id)
        assert.ok(
          !/cost_price|stock_quantity|default_supplier_id|primary_warehouse_id|password|secret/.test(
            Object.values(TABLES).flat().join(','),
          ),
        )
        const r = await preview(bytes, format)
        assert.equal(r.r.status, 200, JSON.stringify(r.body))
        assert.equal(r.body.products.unchanged, 1)
        assert.equal(r.body.rows.unchanged, 3)
        assert.equal(r.body.items[0].changes.length, 0)
        assert.equal(
          Object.values(r.body.rows).reduce((a, b) => a + b, 0),
          r.body.row_count,
        )
        const template = await request('/api/admin-products/transfer/template?format=' + format, {
          method: 'GET',
        })
        assert.equal(template.status, 200)
        const parsed =
          format === 'csv'
            ? readCsv(Buffer.from(await template.arrayBuffer()))
            : readXlsx(Buffer.from(await template.arrayBuffer()))
        assert.equal(parsed.Products.length, 0)
        assert.equal(parsed.Variants.length, 0)
        assert.ok(parsed.Categories.some((c) => c.id === f.category))
        assert.ok(parsed.Guide.some((g) => g.en && g.ar))
        if (format === 'csv')
          exported = Object.fromEntries(
            Object.entries(data).map(([name, rows]) => [
              name,
              rows.map((row) =>
                Object.fromEntries(
                  TABLES[name].map((field) => [field, semanticCell(row[field]).value]),
                ),
              ),
            ]),
          )
      },
    )
  await t.test(
    'sparse updates, explicit clearing and new records never change catalog data',
    async () => {
      const source = tables()
      source.Products.push({
        product_key: product.id,
        product_id: product.id,
        expected_revision: (await f.snapshot(product.id)).revision,
        title: 'Known change',
        description: null,
      })
      const r = await preview(source)
      assert.equal(r.body.products.update, 1)
      assert.equal(r.body.items[0].changes.length, 2)
      const newSource = fresh()
      newSource.Products[0].sku = '000099'
      const created = await preview(newSource)
      assert.equal(created.body.products.create, 1)
      assert.deepEqual(await invariants(), before)
    },
  )
  await t.test(
    'existing IDs cannot match by SKU/slug, stale revisions and related hashes conflict',
    async () => {
      const source = structuredClone(exported)
      source.Products[0].product_id = randomUUID()
      const missing = await preview(writeCsv(source))
      assert.equal(missing.body.products.invalid, 1)
      assert.ok(missing.body.items[0].errors.some((e) => e.code === 'missing'))
      source.Products[0].product_id = product.id
      source.Products[0].expected_revision = '0'
      assert.equal((await preview(writeCsv(source))).body.products.conflicted, 1)
      source.Products[0].expected_revision = exported.Products[0].expected_revision
      source.Images[0].expected_hash = '0'.repeat(64)
      assert.equal((await preview(writeCsv(source))).body.products.conflicted, 1)
    },
  )
  await t.test('private, absent, traversal and deleting image references are invalid', async () => {
    for (const image_url of [
      '/uploads/../secret.png',
      '/uploads/products/missing.png',
      'https://store.invalid/storage/v1/object/public/customer-private/x.png',
    ]) {
      const source = fresh()
      source.Products[0].image_url = image_url
      const r = await preview(source)
      assert.equal(r.body.products.invalid, 1, image_url)
      assert.ok(r.body.items[0].errors.some((e) => e.code === 'image'))
    }
    await f.db.query(
      "update catalog_private.media_paths set state='deleting' where path='/uploads/products/transfer.png'",
    )
    const p = await preview(writeCsv(exported))
    assert.equal(p.body.products.invalid, 1)
    await f.db.query(
      "update catalog_private.media_paths set state='active' where path='/uploads/products/transfer.png'",
    )
  })
  await t.test(
    'viewers export/select without import permission; unrelated staff and revoked users are denied',
    async () => {
      await exportFile('csv', 'viewer')
      assert.equal((await preview(fresh(), 'csv', 'viewer')).r.status, 403)
      assert.equal((await preview(fresh(), 'xlsx', 'editor')).r.status, 200)
      for (const actor of [null, 'disabled', 'customer']) {
        const r = await request('/api/admin-products/transfer/export', {
          actor,
          body: { format: 'csv', scope: 'selected', ids: [product.id], filters: {} },
        })
        assert.ok([401, 403].includes(r.status), actor)
        assert.ok([401, 403].includes((await preview(fresh(), 'csv', actor)).r.status))
      }
      await f.db.query("update public.admin_users set permissions='{}' where id=$1", [
        f.actors.editor,
      ])
      assert.equal((await preview(fresh(), 'csv', 'editor')).r.status, 403)
      await f.db.query('update public.admin_users set permissions=$1 where id=$2', [
        JSON.stringify({ 'products.view': true, 'products.add': true, 'products.edit': true }),
        f.actors.editor,
      ])
    },
  )
  await t.test(
    'actual content, unknown fields and bounded scope are enforced before processing',
    async () => {
      const r = await request('/api/admin-products/transfer/export', {
        body: { format: 'csv', scope: 'all', ids: [], filters: {} },
      })
      assert.equal(r.status, 400)
      assert.equal(
        (
          await request('/api/admin-products/transfer/export', {
            body: { format: 'csv', scope: 'selected', ids: [product.id, product.id], filters: {} },
          })
        ).status,
        400,
      )
      assert.equal((await preview(Buffer.from('MZ invalid'), 'xlsx')).r.status, 400)
      assert.equal((await preview(Buffer.alloc(L.upload + 1), 'csv')).r.status, 413)
      assert.equal(
        (
          await request('/api/admin-products/transfer/template?format=csv&apply=true', {
            method: 'GET',
          })
        ).status,
        400,
      )
      assert.equal((await request('/api/admin-products/transfer/apply', { body: {} })).status, 404)
    },
  )
  await t.test(
    'embedded media, legacy unassigned galleries and readonly variant prices remain safe',
    async () => {
      const source = fresh()
      source.Products[0].sku = '000099'
      source.Products[0].long_description = '<img src="/uploads/products/missing.png">'
      const invalid = await preview(source)
      assert.ok(
        invalid.body.items[0].errors.some(
          (e) => e.field === 'long_description' && e.code === 'image',
        ),
      )
      const aliases = structuredClone(exported)
      aliases.Variants[0].entity_key = 'known_alias'
      aliases.Images[0].variant_key = 'known_alias'
      const same = await preview(aliases)
      assert.equal(same.body.products.unchanged, 1)
      assert.equal(same.body.items.find((item) => item.table === 'Images').changes.length, 0)
      const options = structuredClone(exported)
      options.Variants[0].price = '999.00'
      const result = await preview(options)
      assert.ok(
        result.body.items.some(
          (item) =>
            item.table === 'Variants' &&
            item.errors.some((e) => e.field === 'price' && e.code === 'readonly'),
        ),
      )
      // Simulate a pre-guard legacy row only in this owned fixture.
      await f.db.exec(
        'alter table public.product_images disable trigger product_images_validate_variant;alter table public.product_images drop constraint product_images_variant_required_check',
      )
      await f.db.query('update public.product_images set variant_id=null where id=$1', [gallery])
      await f.db.exec(
        'alter table public.product_images enable trigger product_images_validate_variant;alter table public.product_images add constraint product_images_variant_required_check check(variant_id is not null) not valid',
      )
      const file = await exportFile()
      const legacy = await preview(file.bytes)
      assert.equal(legacy.body.products.unchanged, 1)
      await f.db.query('update public.product_images set variant_id=$1 where id=$2', [
        edit.variants[0].id,
        gallery,
      ])
    },
  )
  await t.test(
    'all exports/previews leave business data, receipts and audit events unchanged',
    async () => assert.deepEqual(await invariants(), before),
  )
})

test(
  'snapshot is permitted in a native read-only transaction with service-only ACL',
  { skip: !emailNativeAvailable },
  async (t) => {
    const db = await createEmailNativeDatabase()
    t.after(() => db.close())
    const f = await createProductSaveFixture({ database: db })
    const p = await f.save(f.body())
    const c = await db.connect('service_role')
    await c.query('begin read only')
    const result = await c.query(
      "select public.catalog_transfer_snapshot($1,'export','selected',$2::jsonb,'{}','{}','{}') snapshot",
      [f.actors.viewer, JSON.stringify([p.id])],
    )
    assert.equal(result.rows[0].snapshot.products.length, 1)
    await c.query('rollback')
    for (const role of ['anon', 'authenticated']) {
      const user = await db.connect(role)
      await assert.rejects(
        () =>
          user.query(
            "select public.catalog_transfer_snapshot($1,'template','none','[]','{}','{}','{}')",
            [f.actors.owner],
          ),
        /permission denied/,
      )
    }
  },
)

test(
  'oversized saved fields fail before snapshot JSON construction',
  { skip: !emailNativeAvailable },
  async (t) => {
    const db = await createEmailNativeDatabase()
    t.after(() => db.close())
    const f = await createProductSaveFixture({ database: db }),
      p = await f.save(f.body())
    await db.query("update public.products set sku=repeat('X',10000) where id=$1", [p.id])
    await assert.rejects(
      () =>
        db.query(
          "select public.catalog_transfer_snapshot($1,'export','selected',$2::jsonb,'{}','{}','{}')",
          [f.actors.owner, JSON.stringify([p.id])],
        ),
      /transfer:limit/,
    )
    await db.query("update public.products set sku='VALID' where id=$1", [p.id])
    await db.query("update public.categories set name=repeat('X',10000) where id=$1", [f.category])
    await assert.rejects(
      () =>
        db.query(
          "select public.catalog_transfer_snapshot($1,'template','none','[]','{}','{}','{}')",
          [f.actors.owner],
        ),
      /transfer:limit/,
    )
  },
)

test(
  'migration 77 preserves existing native non-superuser schema/grants and is additive',
  { skip: !storageNativeAvailable },
  async (t) => {
    const db = await createStorageNativeDatabase({
      stopBefore: '20261014120000_catalog_transfer.sql',
    })
    t.after(() => db.close())
    const collect = async () =>
      (
        await db.query(
          "select n.nspname,p.proname,p.proargtypes::text,p.proacl::text,p.prosrc,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','catalog_private') order by 1,2,3",
        )
      ).rows
    const before = await collect()
    await db.exec(await readFile('supabase/migrations/20261014120000_catalog_transfer.sql', 'utf8'))
    const after = await collect()
    assert.deepEqual(
      after.filter((p) => !['transfer_product', 'catalog_transfer_snapshot'].includes(p.proname)),
      before,
    )
    assert.equal(after.length, before.length + 2)
  },
)

test(
  '250-product export is bounded within a 10,000-product native catalog',
  { skip: !emailNativeAvailable },
  async (t) => {
    const db = await createEmailNativeDatabase()
    t.after(() => db.close())
    const f = await createProductSaveFixture({ database: db })
    await db.exec("set statement_timeout='30s'") // Fixture seeding, outside measured requests.
    await db.query(
      "with added as (insert into public.products(title,slug,sku,price,is_serialized,is_published,primary_warehouse_id) select 'Transfer catalog '||i,'transfer-large-'||i,'TRANSFER-'||i,10,true,false,$1 from generate_series(1,10000) i returning id) insert into public.product_variants(product_id,name,code,is_active) select id,'Default','DEFAULT',true from added",
      [f.warehouse],
    )
    await db.query(
      'update public.products set category_id=$1 where id in (select id from public.products order by id limit 250)',
      [f.category],
    )
    await db.exec("set statement_timeout='10s'")
    const args = [f.actors.viewer, JSON.stringify({ q: 'TRANSFER-9999' })]
    const started = performance.now()
    const r = await db.query(
      "select public.catalog_transfer_snapshot($1,'export','filtered','[]',$2::jsonb,'{}','{}') snapshot",
      args,
    )
    const one = r.rows[0].snapshot
    assert.equal(one.products.length, 1)
    assert.equal(one.variants.length, 1)
    assert.equal(readXlsx(writeXlsx(snapshotTables(one, guideRows()))).Products.length, 1)
    await assert.rejects(
      () =>
        db.query(
          "select public.catalog_transfer_snapshot($1,'export','filtered','[]','{}','{}','{}')",
          [f.actors.viewer],
        ),
      /transfer:limit/,
    )
    const boundary = (
      await db.query(
        "select public.catalog_transfer_snapshot($1,'export','filtered','[]',$2::jsonb,'{}','{}') snapshot",
        [f.actors.viewer, JSON.stringify({ category: f.category })],
      )
    ).rows[0].snapshot
    assert.equal(boundary.products.length, 250)
    assert.equal((await db.query('select count(*)::int n from public.products')).rows[0].n, 10000)
    const report = {
      catalog: 10000,
      matched: one.products.length,
      filtered: boundary.products.length,
      ms: Math.round(performance.now() - started),
      bytes: JSON.stringify(one).length,
      unbounded_export_rejected: true,
      read_only: true,
    }
    assert.ok(report.ms < 15000)
    if (process.env.CATALOG_TRANSFER_REVIEW_ARTIFACTS)
      await writeFile(
        join(process.env.CATALOG_TRANSFER_REVIEW_ARTIFACTS, 'performance.json'),
        JSON.stringify(report, null, 2) + '\n',
      )
  },
)

test(
  'PostgREST reload exposes only the service RPC after additive migration 77',
  { skip: !emailNativeAvailable },
  async (t) => {
    const rest = await createCatalogRestFixture()
    t.after(() => rest.close())
    for (const name of (await readdir('supabase/migrations'))
      .filter(
        (n) =>
          n.endsWith('.sql') &&
          n > '20261011120000_catalog_confidentiality.sql' &&
          n < '20261014120000_catalog_transfer.sql',
      )
      .sort())
      await rest.db.exec(await readFile('supabase/migrations/' + name, 'utf8'))
    const f = await createProductSaveFixture({ database: rest.db })
    Object.assign(rest.actors, f.actors)
    const body = {
      p_admin_id: f.actors.viewer,
      p_purpose: 'template',
      p_scope: 'none',
      p_ids: [],
      p_filters: {},
      p_match: {},
      p_media: {},
    }
    assert.equal(
      (
        await rest.request('/rpc/catalog_transfer_snapshot', {
          actor: 'service',
          method: 'POST',
          body,
        })
      ).status,
      404,
    )
    await rest.db.exec(
      await readFile('supabase/migrations/20261014120000_catalog_transfer.sql', 'utf8'),
    )
    await nativeWaitFor(
      async () =>
        (
          await rest.request('/rpc/catalog_transfer_snapshot', {
            actor: 'service',
            method: 'POST',
            body,
          })
        ).status !== 404,
    )
    const r = await rest.request('/rpc/catalog_transfer_snapshot', {
      actor: 'service',
      method: 'POST',
      body,
    })
    assert.equal(r.status, 200)
    assert.equal(r.body.products.length, 0)
    for (const actor of [null, 'customer', 'viewer', 'editor', 'owner'])
      assert.notEqual(
        (await rest.request('/rpc/catalog_transfer_snapshot', { actor, method: 'POST', body }))
          .status,
        200,
      )
  },
)
