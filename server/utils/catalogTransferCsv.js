import {
  TABLES,
  CSV_HEADERS,
  RECORD_TYPES,
  TRANSFER_LIMITS as L,
  encodeCell,
  assertTables,
  badXmlText,
  failTransfer,
} from './catalogTransferContract.js'
const dangerous = (s) => /^[\s\u0000-\u0020]*[=+\-@]/.test(s) || /^[\t\r\n]/.test(s)
export function csvCell(value) {
  const s = encodeCell(value)
  if (badXmlText(s)) failTransfer('content')
  return s && (dangerous(s) || s.startsWith("'") || /^0\d/.test(s) || /^\d+(?:\.\d+)?$/.test(s))
    ? "'" + s
    : s
}
const quote = (s) => '"' + s.replaceAll('"', '""') + '"'
export function writeCsv(tables) {
  assertTables(tables)
  const lines = [CSV_HEADERS.map(quote).join(',')]
  for (const [name, rows] of Object.entries(tables))
    for (const row of rows)
      lines.push(
        CSV_HEADERS.map((field) =>
          quote(
            field === 'record_type'
              ? name.toLowerCase()
              : TABLES[name].includes(field)
                ? csvCell(row[field])
                : '',
          ),
        ).join(','),
      )
  const result = Buffer.from('\ufeff' + lines.join('\r\n') + '\r\n')
  if (result.length > L.output) failTransfer('limit')
  return result
}
export function utf8(b) {
  let text
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(b)
  } catch {
    failTransfer('encoding')
  }
  if (badXmlText(text)) failTransfer('content')
  return text.replace(/^\ufeff/, '')
}
export function readCsv(bytes) {
  if (bytes.length > L.upload) failTransfer('limit')
  const text = utf8(bytes)
  if (text.startsWith('PK') || text.startsWith('<?xml') || text.includes('\u0000'))
    failTransfer('content')
  const rows = []
  let row = [],
    value = '',
    quoted = false,
    closed = false,
    cells = 0
  const add = () => {
    if (value.length > L.cell || ++cells > L.cells) failTransfer('limit')
    row.push(value)
    if (row.length > L.columns) failTransfer('limit')
    value = ''
    closed = false
  }
  const line = () => {
    add()
    rows.push(row)
    if (rows.length > L.rows) failTransfer('limit')
    row = []
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          value += '"'
          i++
        } else {
          quoted = false
          closed = true
        }
      } else value += c
    } else if (c === '"') {
      if (value || closed) failTransfer('csv')
      quoted = true
    } else if (c === ',') add()
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++
      line()
    } else {
      if (closed) failTransfer('csv')
      value += c
    }
    if (value.length > L.cell) failTransfer('limit')
  }
  if (quoted) failTransfer('csv')
  if (row.length || value || closed) line()
  if (JSON.stringify(rows[0]) !== JSON.stringify(CSV_HEADERS)) failTransfer('headers')
  const tables = Object.fromEntries(Object.keys(TABLES).map((n) => [n, []]))
  for (let n = 1; n < rows.length; n++) {
    const cells = rows[n]
    if (cells.every((c) => !c)) continue
    if (cells.length !== CSV_HEADERS.length) failTransfer('columns')
    const name = RECORD_TYPES[cells[0]]
    if (!name) failTransfer('structure')
    const item = { _row: n + 1, _sheet: 'CSV', _types: {} }
    for (let i = 1; i < cells.length; i++) {
      const field = CSV_HEADERS[i],
        raw = cells[i]
      if (!TABLES[name].includes(field)) {
        if (raw) failTransfer('columns')
        continue
      }
      if (raw.startsWith("'")) item[field] = raw.slice(1)
      else {
        if (dangerous(raw)) failTransfer('formula')
        item[field] = raw
      }
      item._types[field] = 'text'
    }
    tables[name].push(item)
  }
  return assertTables(tables)
}
