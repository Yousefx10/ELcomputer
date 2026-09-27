export const normalizeSpecPhrase = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/colour/g, 'color')
  .replace(/[^a-z0-9]+/g, '')

export const specificationKey = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 100)

export const parseSpecificationAliases = (input) => {
  const seen = new Set()
  return String(input || '').split(',').map((item) => item.trim().slice(0, 100)).filter((item) => {
    const key = normalizeSpecPhrase(item)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 20)
}

const editDistance = (a, b) => {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + Number(a[i - 1] !== b[j - 1]))
      previous = current
    }
  }
  return row[b.length]
}

export const matchSpecificationDefinitions = (definitions = [], query = '', { limit = 8 } = {}) => {
  const needle = normalizeSpecPhrase(query)
  if (!needle) return definitions.filter((item) => item.is_active !== false)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || a.name.localeCompare(b.name))
    .slice(0, limit).map((definition) => ({ definition, score: 0, exact: false }))

  return definitions.filter((item) => item.is_active !== false).flatMap((definition) => {
    const phrases = [definition.name, definition.key, ...(definition.aliases || [])]
      .map(normalizeSpecPhrase).filter(Boolean)
    let score = 0
    for (const phrase of phrases) {
      if (phrase === needle) score = Math.max(score, 100)
      else if (needle.length >= 2 && phrase.startsWith(needle)) score = Math.max(score, 75)
      else if (needle.length >= 3 && phrase.includes(needle)) score = Math.max(score, 60)
      else if (needle.length >= 4 && Math.abs(phrase.length - needle.length) <= 2) {
        const distance = editDistance(phrase, needle)
        if (distance <= (needle.length >= 7 ? 2 : 1)) score = Math.max(score, 45 - distance)
      }
    }
    return score ? [{ definition, score, exact: score === 100 }] : []
  }).sort((a, b) => b.score - a.score || Number(a.definition.sort_order || 0) - Number(b.definition.sort_order || 0) || a.definition.name.localeCompare(b.definition.name)).slice(0, limit)
}

export const duplicateSpecificationCandidates = (definitions, label) =>
  matchSpecificationDefinitions(definitions.map((item) => ({ ...item, is_active: true })), label, { limit: 5 })
    .filter((match) => match.exact || match.score >= 43)

export const parsePastedSpecifications = (input, { limit = 30 } = {}) =>
  String(input || '').slice(0, 10000).split(/\r?\n/).slice(0, limit).flatMap((rawLine) => {
    const line = rawLine.trim()
    const match = line.match(/^(.{2,80}?)(?::\s+|\s+[–—-]\s+)(.+)$/)
    if (!match) return []
    const label = match[1].trim()
    const value = match[2].trim()
    return label && value ? [{ label, value }] : []
  })

export const groupProductSpecifications = (rows = []) => {
  const groups = []
  for (const row of rows) {
    const value = String(row.value || '').trim()
    const label = String(row.definition?.name || row.label || '').trim()
    if (!label || !value) continue
    const group = String(row.definition?.group_name || '').trim()
    if (groups[groups.length - 1]?.name !== group) groups.push({ name: group, items: [] })
    groups[groups.length - 1].items.push({ ...row, displayLabel: label, value })
  }
  return groups
}

export const productHighlights = (rows = [], { minimum = 2, maximum = 8 } = {}) => {
  const seen = new Set()
  const highlights = rows.filter((row) => {
    const key = row.definition_id || normalizeSpecPhrase(row.label)
    if (!row.is_highlight || !String(row.value || '').trim() || !key || seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, maximum).map((row) => ({
    label: String(row.definition?.name || row.label || '').trim(),
    value: String(row.value).trim()
  })).filter((item) => item.label)
  return highlights.length >= minimum ? highlights : []
}

export const descriptionBlocks = (description) => {
  const lines = String(description || '').replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let paragraph = []
  let list = []
  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join(' ').trim() })
    if (list.length) blocks.push({ type: 'list', items: [...list] })
    paragraph = []
    list = []
  }
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) { flush(); continue }
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/)
    const detail = line.match(/^([\p{L}\p{N}][\p{L}\p{N} /()+.-]{1,48}):\s+(.+)$/u)
    const heading = line.match(/^([\p{L}\p{N}][^:]{1,60}):$/u)
    if (bullet) {
      if (paragraph.length) flush()
      list.push(bullet[1])
    } else if (detail && !detail[2].startsWith('//')) {
      flush()
      blocks.push({ type: 'detail', label: detail[1].trim(), value: detail[2].trim() })
    } else if (heading) {
      flush()
      blocks.push({ type: 'heading', text: heading[1].trim() })
    } else {
      if (list.length) flush()
      paragraph.push(line)
    }
  }
  flush()
  return blocks.filter((block) => block.type !== 'paragraph' || block.text)
}
