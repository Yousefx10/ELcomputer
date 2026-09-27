import assert from 'node:assert/strict'
import test from 'node:test'
import { createResetDatabase } from './helpers/resetDatabase.mjs'
import {
  normalizeSpecPhrase, specificationKey, parseSpecificationAliases, matchSpecificationDefinitions,
  duplicateSpecificationCandidates, parsePastedSpecifications,
  groupProductSpecifications, productHighlights, descriptionBlocks
} from '../app/utils/specificationLibrary.js'

const definitions = [
  { id: 'color', key: 'color', name: 'Color', aliases: ['Colour', 'Product Color'], sort_order: 1, is_active: true },
  { id: 'sensor', key: 'sensor-type', name: 'Sensor Type', aliases: ['Sensor'], sort_order: 2, is_active: true },
  { id: 'ram', key: 'ram', name: 'RAM', aliases: [], sort_order: 3, is_active: true }
]

test('canonical search catches aliases and common misspellings without creating names', () => {
  assert.equal(normalizeSpecPhrase(' Product Colour '), 'productcolor')
  assert.equal(specificationKey('Polling Rate'), 'polling-rate')
  assert.deepEqual(parseSpecificationAliases(' Colour, colour, Product Color,  '), ['Colour', 'Product Color'])
  assert.equal(matchSpecificationDefinitions(definitions, 'colo')[0].definition.id, 'color')
  assert.equal(matchSpecificationDefinitions(definitions, 'colour')[0].exact, true)
  assert.equal(matchSpecificationDefinitions(definitions, 'colorr')[0].definition.id, 'color')
  assert.equal(matchSpecificationDefinitions(definitions, 'sensor')[0].definition.id, 'sensor')
  assert.equal(duplicateSpecificationCandidates(definitions, 'Colour')[0].exact, true)
  assert.deepEqual(duplicateSpecificationCandidates(definitions, 'ROM'), [])
})

test('paste review parses only clear label/value lines', () => {
  assert.deepEqual(parsePastedSpecifications('Brand: Logitech\nWi-Fi - 6E\nA normal sentence\nDPI: 100 - 25,600'), [
    { label: 'Brand', value: 'Logitech' },
    { label: 'Wi-Fi', value: '6E' },
    { label: 'DPI', value: '100 - 25,600' }
  ])
})

test('grouping and highlights reuse factual rows and keep legacy labels', () => {
  const rows = [
    { id: 'one', label: 'DPI', value: '3600 DPI', is_highlight: true, definition_id: 'dpi', definition: { name: 'DPI', group_name: 'Performance' } },
    { id: 'two', label: 'Sensor', value: 'Optical', is_highlight: true, definition_id: 'sensor', definition: { name: 'Sensor Type', group_name: 'Performance' } },
    { id: 'three', label: 'Cable length', value: '1.5 m braided USB', is_highlight: false },
    { id: 'empty', label: 'Unused', value: '  ', is_highlight: true }
  ]
  const groups = groupProductSpecifications(rows)
  assert.deepEqual(groups.map((group) => group.name), ['Performance', ''])
  assert.deepEqual(groups[0].items.map((item) => item.displayLabel), ['DPI', 'Sensor Type'])
  assert.equal(groups[1].items[0].displayLabel, 'Cable length')
  assert.deepEqual(groupProductSpecifications([rows[0], rows[2], rows[1]]).map((group) => group.name), ['Performance', '', 'Performance'])
  assert.deepEqual(productHighlights(rows).map((item) => item.label), ['DPI', 'Sensor Type'])
  assert.deepEqual(productHighlights([rows[0]]), [])
})

test('description presentation recognizes prose, bullets, and obvious details as escaped text', () => {
  const blocks = descriptionBlocks('Quiet everyday mouse.\n\nDetails:\n- Silent clicks\n- Comfortable grip\n\nPolling Rate: 1000 Hz\nVisit https://example.com')
  assert.deepEqual(blocks.map((block) => block.type), ['paragraph', 'heading', 'list', 'detail', 'paragraph'])
  assert.equal(blocks[3].label, 'Polling Rate')
  assert.equal(blocks[3].value, '1000 Hz')
  assert.equal(blocks[4].text, 'Visit https://example.com')
})

test('migration keeps legacy specs and enforces canonical links with scoped reads', async () => {
  const db = await createResetDatabase()
  try {
    await db.exec(`
      insert into public.categories(id,name,slug) values ('10000000-0000-4000-8000-000000000001','Mice','mice');
      insert into public.commerce_warehouses(id,name) values ('40000000-0000-4000-8000-000000000001','Main');
      insert into public.products(id,title,slug,price,category_id,is_published,primary_warehouse_id)
      values ('20000000-0000-4000-8000-000000000001','Mouse','mouse',100,'10000000-0000-4000-8000-000000000001',true,'40000000-0000-4000-8000-000000000001'),
        ('20000000-0000-4000-8000-000000000002','Private','private',100,'10000000-0000-4000-8000-000000000001',false,'40000000-0000-4000-8000-000000000001');
      insert into public.product_specifications(id,product_id,label,value)
      values ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Colour','Black');
    `)
    const color = (await db.query("select id from public.specification_definitions where key='color'")).rows[0]
    const dpi = (await db.query("select id from public.specification_definitions where key='dpi'")).rows[0]
    assert.ok(color?.id && dpi?.id)
    await db.query(`insert into public.product_specifications(product_id,definition_id,label,value,is_highlight)
      values ('20000000-0000-4000-8000-000000000001',$1,'DPI','3600',true)`, [dpi.id])
    await assert.rejects(() => db.query(`insert into public.product_specifications(product_id,definition_id,label,value)
      values ('20000000-0000-4000-8000-000000000001',$1,'DPI','8000')`, [dpi.id]), /duplicate key/)
    const legacy = (await db.query("select label,value,definition_id from public.product_specifications where id='30000000-0000-4000-8000-000000000001'")).rows[0]
    assert.equal(legacy.label, 'Colour')
    assert.equal(legacy.value, 'Black')
    assert.equal(legacy.definition_id, null)
    await db.query('insert into public.category_specification_templates(category_id,definition_id,sort_order) values ($1,$2,10)', ['10000000-0000-4000-8000-000000000001', color.id])
    const templates = (await db.query("select count(*)::int as n from public.category_specification_templates where category_id='10000000-0000-4000-8000-000000000001'")).rows[0]
    assert.equal(templates.n, 1)
    await db.exec(`insert into public.product_features(product_id,body)
      values ('20000000-0000-4000-8000-000000000001','Quiet clicking'),
      ('20000000-0000-4000-8000-000000000002','Hidden product feature');`)
    for (const role of ['anon', 'authenticated']) {
      const allowed = (await db.query('select has_table_privilege($1,$2,$3) as allowed', [role, 'public.category_specification_templates', 'SELECT'])).rows[0]
      assert.equal(allowed.allowed, role === 'authenticated')
    }
    // The schema backup omits Supabase's platform default public-products grant.
    await db.exec('grant select on public.products, public.admin_users to anon')
    await db.exec('set role anon')
    assert.equal((await db.query('select count(*)::int as n from public.specification_definitions')).rows[0].n, 31)
    assert.equal((await db.query('select count(*)::int as n from public.product_features')).rows[0].n, 1)
    await db.exec('reset role')
  } finally {
    await db.close()
  }
})
