// An independent reader/writer verifies the standard XLSX envelope. The Python
// dependency is validation tooling only, installed outside the application.
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { TABLES, guideRows } from '../server/utils/catalogTransferContract.js'
import { writeXlsx, readXlsx } from '../server/utils/catalogTransferXlsx.js'
const python = process.env.CATALOG_REVIEW_PYTHON
if (!python) throw Error('Provide an owned Python environment with openpyxl 3.1.5.')
const dir = await mkdtemp(join(tmpdir(), 'catalog-interop-'))
try {
  const tables = {
    ...Object.fromEntries(Object.keys(TABLES).map((n) => [n, []])),
    Guide: guideRows(),
  }
  tables.Products = [
    {
      product_key: 'new_1',
      title: 'Authored Arabic: مرحبا',
      sku: '000012',
      price: '9999999999.99',
      description: '=SUM(1,2)',
    },
  ]
  await writeFile(join(dir, 'original.xlsx'), writeXlsx(tables))
  const script = `import sys, openpyxl\nfrom pathlib import Path\np=Path(sys.argv[1])\nw=openpyxl.load_workbook(p/'original.xlsx',data_only=False)\nassert w.sheetnames==['Products','Variants','Specifications','Images','Categories','Brands','Definitions','Guide']\ns=w['Products']\nassert s['G2'].value=='000012' and s['G2'].data_type=='s'\nassert s['L2'].value=='9999999999.99' and s['L2'].data_type=='s'\nassert s['H2'].value=='=SUM(1,2)' and s['H2'].data_type=='s'\nassert s['E2'].value=='Authored Arabic: مرحبا'\nw.save(p/'resaved.xlsx')\nprint(openpyxl.__version__)\n`
  await writeFile(join(dir, 'review.py'), script)
  const r = await promisify(execFile)(python, [join(dir, 'review.py'), dir])
  await writeFile(
    '../product-manager-task6a-review-20261014/interop-resaved.xlsx',
    await readFile(join(dir, 'resaved.xlsx')),
  )
  const parsed = readXlsx(await readFile(join(dir, 'resaved.xlsx')))
  assert.equal(parsed.Products[0].sku, '000012')
  assert.equal(parsed.Products[0].price, '9999999999.99')
  assert.equal(parsed.Products[0].description, '=SUM(1,2)')
  console.log(
    JSON.stringify({
      reader: 'openpyxl',
      version: r.stdout.trim(),
      round_trip: true,
      arabic: true,
      text_sku: true,
      text_money: true,
      formula_text: true,
      retained_source_files: false,
    }),
  )
} finally {
  await rm(dir, { recursive: true, force: true })
}
