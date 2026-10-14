import sax from 'sax'
import { readZip, writeZip } from './catalogTransferZip.js'
import { utf8 } from './catalogTransferCsv.js'
import {
  TABLES,
  TRANSFER_LIMITS as L,
  encodeCell,
  assertTables,
  badXmlText,
  failTransfer,
} from './catalogTransferContract.js'
const S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
  R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  P = 'http://schemas.openxmlformats.org/package/2006/relationships',
  C = 'http://schemas.openxmlformats.org/package/2006/content-types'
const xml = (s) => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + s
const esc = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\r', '&#13;')
const letter = (n) => {
  let s = ''
  for (; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}
export function writeXlsx(tables) {
  assertTables(tables)
  const parts = {},
    names = Object.keys(TABLES),
    content = [],
    relationships = []
  parts['_rels/.rels'] = xml(
    `<Relationships xmlns="${P}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  )
  for (let i = 0; i < names.length; i++) {
    const name = names[i],
      rows = [
        TABLES[name],
        ...tables[name].map((row) => TABLES[name].map((f) => encodeCell(row[f]))),
      ]
    let body = ''
    for (let n = 0; n < rows.length; n++) {
      let cells = ''
      for (let j = 0; j < rows[n].length; j++) {
        const value = rows[n][j]
        if (badXmlText(value)) failTransfer('content')
        if (value.length > L.excelCell) failTransfer('excel_cell')
        cells += `<c r="${letter(j + 1)}${n + 1}" s="1" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`
      }
      body += `<row r="${n + 1}">${cells}</row>`
    }
    parts[`xl/worksheets/sheet${i + 1}.xml`] = xml(
      `<worksheet xmlns="${S}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${body}</sheetData></worksheet>`,
    )
    relationships.push(
      `<Relationship Id="rId${i + 1}" Type="${R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    content.push(
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
  }
  parts['xl/workbook.xml'] = xml(
    `<workbook xmlns="${S}" xmlns:r="${R}"><sheets>${names.map((name, i) => `<sheet name="${name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
  )
  parts['xl/_rels/workbook.xml.rels'] = xml(
    `<Relationships xmlns="${P}">${relationships.join('')}<Relationship Id="styles" Type="${R}/styles" Target="styles.xml"/></Relationships>`,
  )
  parts['xl/styles.xml'] = xml(
    `<styleSheet xmlns="${S}"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf numFmtId="49" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
  )
  parts['[Content_Types].xml'] = xml(
    `<Types xmlns="${C}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${content.join('')}</Types>`,
  )
  return writeZip(parts)
}
const forbidden = new Set([
  'f',
  'definedName',
  'externalLinks',
  'externalLink',
  'connections',
  'oleObjects',
  'controls',
  'webPublishObjects',
  'extLst',
  'hyperlinks',
  'dataValidations',
  'tableParts',
  'drawing',
  'legacyDrawing',
  'AlternateContent',
  'vbaProject',
])
export function parseXml(bytes, handlers = {}) {
  const text = utf8(bytes)
  if (/<!\s*(DOCTYPE|ENTITY)|<\?[^x]|<\?xml[^>]*encoding\s*=\s*["'](?!utf-8["'])/i.test(text))
    failTransfer('workbook')
  const parser = sax.parser(true, { xmlns: true, strictEntities: true })
  let depth = 0,
    nodes = 0
  parser.onerror = () => failTransfer('workbook')
  parser.ondoctype = () => failTransfer('workbook')
  parser.onsgmldeclaration = () => failTransfer('workbook')
  parser.onprocessinginstruction = (pi) => {
    if (pi.name !== 'xml') failTransfer('workbook')
  }
  parser.onopentag = (tag) => {
    if (
      ++depth > 24 ||
      ++nodes > L.cells * 6 ||
      Object.keys(tag.attributes).length > 32 ||
      forbidden.has(tag.local)
    )
      failTransfer('workbook')
    handlers.open?.(tag)
  }
  parser.onclosetag = (tag) => {
    handlers.close?.(tag)
    depth--
  }
  parser.ontext = (t) => handlers.text?.(t)
  parser.oncdata = (t) => handlers.text?.(t)
  try {
    parser.write(text).close()
  } catch (error) {
    if (error.catalogTransfer) throw error
    failTransfer('workbook')
  }
}
const attrs = (tag) =>
  Object.fromEntries(
    Object.values(tag.attributes)
      .filter((a) => a.uri !== 'http://www.w3.org/2000/xmlns/')
      .map((a) => [a.local, a.value]),
  )
function relationships(bytes, base, parts) {
  const result = new Map()
  let root = false
  parseXml(bytes, {
    open(tag) {
      if (!root) {
        if (tag.local !== 'Relationships' || tag.uri !== P) failTransfer('workbook')
        root = true
      } else if (tag.local === 'Relationship' && tag.uri === P) {
        const a = attrs(tag)
        if (
          !a.Id ||
          typeof a.Type !== 'string' ||
          typeof a.Target !== 'string' ||
          result.has(a.Id) ||
          (a.TargetMode && a.TargetMode !== 'Internal') ||
          !(
            a.Type === P + '/metadata/core-properties' ||
            (a.Type.startsWith(R + '/') &&
              [
                'worksheet',
                'styles',
                'sharedStrings',
                'theme',
                'officeDocument',
                'extended-properties',
              ].includes(a.Type.slice(R.length + 1)))
          )
        )
          failTransfer('workbook')
        const path = (a.Target.startsWith('/') ? a.Target.slice(1) : base + a.Target).toLowerCase()
        if (!parts.has(path)) failTransfer('workbook')
        result.set(a.Id, { path, type: a.Type })
      } else failTransfer('workbook')
    },
  })
  return result
}
export function readXlsx(bytes) {
  const parts = readZip(bytes)
  for (const name of [
    '[content_types].xml',
    '_rels/.rels',
    'xl/workbook.xml',
    'xl/_rels/workbook.xml.rels',
  ])
    if (!parts.has(name)) failTransfer('workbook')
  // Parse every part, including unused styling/properties. No DTD or executable XML.
  for (const data of parts.values()) parseXml(data)
  const rootRels = relationships(parts.get('_rels/.rels'), '', parts)
  if (
    [...rootRels.values()].filter(
      (r) => r.type === R + '/officeDocument' && r.path === 'xl/workbook.xml',
    ).length !== 1
  )
    failTransfer('workbook')
  const types = new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml',
    'application/vnd.openxmlformats-officedocument.theme+xml',
    'application/vnd.openxmlformats-package.core-properties+xml',
    'application/vnd.openxmlformats-officedocument.extended-properties+xml',
  ])
  let typeRoot = false
  parseXml(parts.get('[content_types].xml'), {
    open(tag) {
      if (!typeRoot) {
        if (tag.uri !== C || tag.local !== 'Types') failTransfer('workbook')
        typeRoot = true
        return
      }
      const a = attrs(tag)
      if (tag.local === 'Default') {
        if (
          !['xml', 'rels'].includes(a.Extension) ||
          !['application/xml', 'application/vnd.openxmlformats-package.relationships+xml'].includes(
            a.ContentType,
          )
        )
          failTransfer('workbook')
      } else if (tag.local === 'Override') {
        if (!types.has(a.ContentType) || !parts.has(a.PartName?.slice(1).toLowerCase()))
          failTransfer('workbook')
      } else failTransfer('workbook')
    },
  })
  const rels = relationships(parts.get('xl/_rels/workbook.xml.rels'), 'xl/', parts),
    sheets = [],
    names = new Set()
  let workbookRoot = false
  parseXml(parts.get('xl/workbook.xml'), {
    open(tag) {
      if (tag.uri !== S) failTransfer('workbook')
      if (!workbookRoot) {
        if (tag.local !== 'workbook') failTransfer('workbook')
        workbookRoot = true
      }
      if (
        ![
          'workbook',
          'sheets',
          'sheet',
          'fileVersion',
          'workbookPr',
          'bookViews',
          'workbookView',
          'calcPr',
          'definedNames',
        ].includes(tag.local)
      )
        failTransfer('workbook')
      if (tag.local === 'sheet') {
        const a = attrs(tag),
          r = rels.get(a.id)
        if (
          !Object.hasOwn(TABLES, a.name) ||
          names.has(a.name) ||
          (a.state && a.state !== 'visible') ||
          !r ||
          r.type !== R + '/worksheet'
        )
          failTransfer('workbook')
        names.add(a.name)
        sheets.push({ name: a.name, path: r.path })
      }
    },
  })
  if (
    sheets.length !== Object.keys(TABLES).length ||
    new Set(sheets.map((s) => s.path)).size !== sheets.length ||
    [...parts.keys()].filter((p) => p.startsWith('xl/worksheets/')).length !== sheets.length
  )
    failTransfer('structure')
  const shared = []
  if (parts.has('xl/sharedstrings.xml')) {
    let item = null
    const stack = []
    const richTags = new Set([
      'rFont',
      'charset',
      'family',
      'b',
      'i',
      'strike',
      'outline',
      'shadow',
      'condense',
      'extend',
      'color',
      'sz',
      'u',
      'vertAlign',
      'scheme',
      'phoneticPr',
    ])
    parseXml(parts.get('xl/sharedstrings.xml'), {
      open(tag) {
        if (tag.uri !== S) failTransfer('workbook')
        const parent = stack.at(-1),
          name = tag.local
        if (
          !(
            (name === 'sst' && !parent) ||
            (name === 'si' && parent === 'sst') ||
            (name === 'r' && parent === 'si') ||
            (name === 'rPr' && parent === 'r') ||
            (name === 't' && ['si', 'r'].includes(parent)) ||
            (richTags.has(name) && parent === 'rPr')
          )
        )
          failTransfer('workbook')
        stack.push(name)
        if (name === 'si') item = ''
      },
      text(t) {
        if (stack.at(-1) === 't') item += t
        if (item?.length > L.excelCell) failTransfer('limit')
      },
      close(tag) {
        if (/(?:^|:)si$/.test(tag)) {
          shared.push(item)
          item = null
          if (shared.length > L.cells) failTransfer('limit')
        }
        stack.pop()
      },
    })
  }
  const tables = Object.fromEntries(Object.keys(TABLES).map((n) => [n, []]))
  let totalRows = 0,
    totalCells = 0
  const allowed = new Set([
    'worksheet',
    'sheetPr',
    'outlinePr',
    'pageSetUpPr',
    'dimension',
    'sheetViews',
    'sheetView',
    'pane',
    'selection',
    'sheetFormatPr',
    'cols',
    'col',
    'sheetData',
    'row',
    'c',
    'is',
    't',
    'r',
    'rPr',
    'rFont',
    'charset',
    'family',
    'b',
    'i',
    'strike',
    'outline',
    'shadow',
    'condense',
    'extend',
    'color',
    'sz',
    'u',
    'vertAlign',
    'scheme',
    'v',
    'autoFilter',
    'pageMargins',
    'pageSetup',
    'printOptions',
    'headerFooter',
    'oddHeader',
    'oddFooter',
    'evenHeader',
    'evenFooter',
    'firstHeader',
    'firstFooter',
    'phoneticPr',
  ])
  for (const sheet of sheets) {
    const rows = new Map()
    let row = 0,
      cell = null,
      top = '',
      sheetRoot = false,
      stack = []
    parseXml(parts.get(sheet.path), {
      open(tag) {
        if (tag.uri !== S || !allowed.has(tag.local)) failTransfer('workbook')
        const a = attrs(tag)
        top = tag.local
        const parent = stack.at(-1)
        stack.push(top)
        if (
          (top === 'row' && parent !== 'sheetData') ||
          (top === 'c' && parent !== 'row') ||
          (top === 'v' && parent !== 'c') ||
          (top === 'is' && parent !== 'c') ||
          (top === 't' && !['is', 'r'].includes(parent))
        )
          failTransfer('workbook')
        if (!sheetRoot) {
          if (top !== 'worksheet') failTransfer('workbook')
          sheetRoot = true
        }
        if (top === 'dimension' && a.ref) {
          for (const ref of a.ref.split(':')) {
            const m = /^([A-Z]+)([1-9]\d*)$/.exec(ref)
            if (
              !m ||
              Number(m[2]) > L.rows ||
              [...m[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) > L.columns
            )
              failTransfer('limit')
          }
        }
        if (top === 'row') {
          row = Number(a.r)
          if (
            !Number.isSafeInteger(row) ||
            row < 1 ||
            row > L.rows ||
            rows.has(row) ||
            ++totalRows > L.rows
          )
            failTransfer('limit')
          rows.set(row, new Map())
        }
        if (top === 'c') {
          const match = /^([A-Z]+)([1-9]\d*)$/.exec(a.r || '')
          const col = match ? [...match[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) : 0
          if (
            !rows.has(row) ||
            !col ||
            col > L.columns ||
            Number(match[2]) !== row ||
            rows.get(row).has(col) ||
            ++totalCells > L.cells ||
            !['inlineStr', 's', 'str', 'n', 'b', undefined].includes(a.t)
          )
            failTransfer('workbook')
          cell = { col, type: a.t || 'n', value: '', valueCount: 0, inlineCount: 0 }
        }
        if (top === 'v') {
          if (!cell || cell.type === 'inlineStr' || ++cell.valueCount > 1) failTransfer('workbook')
        }
        if (top === 'is') {
          if (!cell || cell.type !== 'inlineStr' || ++cell.inlineCount > 1) failTransfer('workbook')
        }
      },
      text(t) {
        if (cell && ['t', 'v'].includes(top)) {
          cell.value += t
          if (cell.value.length > L.excelCell) failTransfer('limit')
        }
      },
      close(tag) {
        const local = tag.split(':').pop()
        if (local === 'c') {
          if (!cell || (cell.type !== 'inlineStr' && cell.inlineCount)) failTransfer('workbook')
          let value = cell.value
          if (cell.type === 's') {
            if (!/^\d+$/.test(value) || !Object.hasOwn(shared, Number(value)))
              failTransfer('workbook')
            value = shared[Number(value)]
          }
          if (cell.type === 'b') {
            if (!['0', '1'].includes(value)) failTransfer('workbook')
            value = value === '1' ? 'true' : 'false'
          }
          rows.get(row).set(cell.col, {
            value,
            type: ['inlineStr', 's', 'str'].includes(cell.type) ? 'text' : cell.type,
          })
          cell = null
        }
        if (local === 'row') row = 0
        stack.pop()
        top = stack.at(-1) || ''
      },
    })
    const fields = TABLES[sheet.name],
      header = rows.get(1)
    if (
      !header ||
      header.size !== fields.length ||
      fields.some((name, i) => header.get(i + 1)?.value !== name)
    )
      failTransfer('headers')
    for (const [n, cells] of rows) {
      if (n === 1) continue
      if ([...cells.values()].every((c) => !c.value)) continue
      const item = { _row: n, _sheet: sheet.name, _types: {} }
      for (let i = 0; i < fields.length; i++) {
        item[fields[i]] = cells.get(i + 1)?.value || ''
        item._types[fields[i]] = cells.get(i + 1)?.type || 'text'
      }
      if ([...cells.keys()].some((col) => col > fields.length)) failTransfer('columns')
      tables[sheet.name].push(item)
    }
  }
  return assertTables(tables)
}
