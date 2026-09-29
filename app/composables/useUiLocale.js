import messageKeys from '~/utils/uiMessageKeys.json'
import patterns from '~/utils/uiMessagePatterns.json'
import { formatLocale } from '~/utils/appearance'

const foldedKeys = Object.fromEntries(Object.entries(messageKeys).map(([text, key]) => [text.toLowerCase(), key]))
const messagePatterns = patterns.map(({ text, key }) => {
  const parameters = [...text.matchAll(/\{(value\d+)\}/g)].map(match => match[1])
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{value\d+\\\}/g, '(.*?)')
  return { key, parameters, regex: new RegExp('^' + escaped + '$', 'i') }
})

// Explicit adapter for existing application label/enum metadata and API errors.
// Call only at UI boundaries, never on catalog/CMS/customer content.
export const useUiLocale = () => {
  const { t, locale, te } = useNuxtApp().$i18n
  const uiLabel = value => {
    if (value === null || value === undefined) return ''
    const text = String(value)
    if (locale.value === 'en') return text
    const key = foldedKeys[text.replace(/\s+/g, ' ').trim().toLowerCase()]
    if (key) return t(key)
    for (const pattern of messagePatterns) {
      const match = text.match(pattern.regex)
      if (match) return t(pattern.key, Object.fromEntries(pattern.parameters.map((name, index) => [name, match[index + 1] === 's' ? '' : match[index + 1]])))
    }
    return text
  }
  const uiMessage = value => {
    const message = String(value || '')
    if (!message || locale.value === 'en') return message
    const translated = uiLabel(message)
    return translated !== message ? translated : t(messageKeys['Request failed. Please try again.'])
  }
  const uiText = (key, values = {}) => te(key, locale.value) || te(key, 'en') ? t(key, values) : ''
  const intlLocale = computed(() => formatLocale(locale.value))
  const uiPluralSuffix = value => locale.value === 'ar' ? '' : value
  return { uiText, uiLabel, uiMessage, intlLocale, uiPluralSuffix }
}
