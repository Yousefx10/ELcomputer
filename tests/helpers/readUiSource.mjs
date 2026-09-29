import { readFileSync } from 'node:fs'
const en = JSON.parse(readFileSync(new URL('../../i18n/locales/en.json', import.meta.url), 'utf8'))
const valueAt = key => key.split('.').reduce((value, part) => value?.[part], en)
// Existing UI regression assertions also verify their English locale entries.
export const expandUiSource = source => source.replace(/\$t\('([^']+)'(?:,\s*\{[^\n]*?\})?\)/g, (call, key) => {
  const value = valueAt(key)
  if (typeof value !== 'string') throw new Error(`Missing English UI key: ${key}`)
  return value
})
export const readUiSource = file => expandUiSource(readFileSync(file, 'utf8'))
