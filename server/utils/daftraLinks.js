// Website option <-> Daftra product link suggestions (owner request 7 Nov 2026).
// Only an exact, unique code is treated as the same product. Name similarity is a
// suggestion the owner confirms; a colour or model difference is never suggested.

const COLORS = ['black', 'white', 'grey', 'gray', 'blue', 'red', 'green', 'yellow', 'pink', 'purple', 'brown', 'orange',
  'silver', 'gold', 'navy', 'beige', 'cream', 'transparent', 'jade', 'mint', 'sky', 'rose', 'greywood']
const SAME_COLOR = { gray: 'grey' }
const GENERIC = new Set(['default', 'standard', ''])

export const codeKey = value => String(value ?? '').trim().toLowerCase()
export const nameTokens = value => String(value ?? '').toLowerCase().replace(/[–—]/g, '-')
  .replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim().split(/\s+/).filter(Boolean)
const colorsOf = tokens => new Set(tokens.filter(t => COLORS.includes(t)).map(t => SAME_COLOR[t] || t))
const modelsOf = tokens => new Set(tokens.filter(t => /\d/.test(t) && t.length >= 2))

// A meaningful option code is a real SKU, not the generated DEFAULT/WP_ placeholders.
export const optionCode = variant => {
  const code = String(variant?.code ?? '').trim()
  return code && code.toUpperCase() !== 'DEFAULT' && !/^WP_\d+$/i.test(code) ? code : ''
}

export const optionLabel = (product, variant) => {
  const name = String(variant?.name ?? '').trim()
  return GENERIC.has(name.toLowerCase()) ? String(product?.title ?? '') : `${product?.title ?? ''} ${name}`
}

// 0..1. Shared words over all words; a different colour or model number scores 0.
export const nameScore = (label, daftraName) => {
  const a = nameTokens(label), b = nameTokens(daftraName)
  if (!a.length || !b.length) return 0
  const ca = colorsOf(a), cb = colorsOf(b)
  if (ca.size && cb.size && ![...cb].some(c => ca.has(c))) return 0
  const ma = modelsOf(a), mb = modelsOf(b)
  if (ma.size && mb.size && ![...mb].some(m => ma.has(m))) return 0
  const sa = new Set(a), sb = new Set(b)
  const shared = [...sa].filter(t => sb.has(t)).length
  return shared / new Set([...sa, ...sb]).size
}

// rows: [{ variant, product, optionCount }]; daftra: [{ id, name, code }].
// Several website options may share one Daftra product (e.g. switch types sold as one item).
export const suggestDaftraLinks = (rows, daftra) => {
  const byCode = new Map()
  for (const item of daftra) {
    const key = codeKey(item.code)
    if (key) byCode.set(key, [...(byCode.get(key) || []), item])
  }
  return rows.map(({ variant, product, optionCount }) => {
    const codes = [variant.sku, optionCode(variant), optionCount === 1 ? product.sku : null].map(codeKey).filter(Boolean)
    for (const code of codes) {
      const matches = byCode.get(code) || []
      if (matches.length === 1) return { daftraId: String(matches[0].id), reason: 'code', score: 1 }
    }
    const label = optionLabel(product, variant)
    const ranked = daftra.map(item => ({ item, score: nameScore(label, item.name) })).filter(x => x.score > 0)
      .sort((x, y) => y.score - x.score)
    const [top, next] = ranked
    if (top && top.score >= 0.45 && top.score - (next?.score || 0) >= 0.08) {
      return { daftraId: String(top.item.id), reason: 'name', score: Math.round(top.score * 100) / 100 }
    }
    return null
  })
}
