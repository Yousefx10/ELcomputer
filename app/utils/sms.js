// Shared preview rules. No credentials or provider protocol belongs in this module.
const gsmBasic = new Set(Array.from('@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'))
const gsmExtension = new Set(Array.from('\f^{}\\[~]|€'))

export const estimateSmsSegments = (text = '') => {
  const characters = Array.from(text)
  const gsm = characters.every(character => gsmBasic.has(character) || gsmExtension.has(character))
  const units = gsm ? characters.reduce((count, character) => count + (gsmExtension.has(character) ? 2 : 1), 0) : text.length
  const single = gsm ? 160 : 70
  const multipart = gsm ? 153 : 67
  let segments = units ? 1 : 0
  if (units > single) {
    let used = 0
    for (const character of characters) {
      const width = gsm ? gsmExtension.has(character) ? 2 : 1 : character.length
      // Keep GSM escape sequences and UTF-16 surrogate pairs in one segment.
      if (used + width > multipart) { segments++; used = 0 }
      used += width
    }
  }
  return { characters: characters.length, units, encoding: gsm ? 'gsm7' : 'utf16', segments }
}

export const normalizeSmsPhone = (value, { defaultCountry = 'EG', allowInternational = false } = {}) => {
  if (typeof value !== 'string' || value.length > 40 || !/^[+\d\s().-]+$/.test(value)) throw new Error('Invalid phone number.')
  let digits = value.replace(/[\s().-]/g, '')
  const explicit = digits.startsWith('+') || digits.startsWith('00')
  if (digits.startsWith('00')) digits = '+' + digits.slice(2)
  if (digits.startsWith('+')) digits = digits.slice(1)
  else if (defaultCountry === 'EG' && /^0?1[0125]\d{8}$/.test(digits)) digits = '20' + digits.replace(/^0/, '')
  else if (!/^201[0125]\d{8}$/.test(digits)) throw new Error('Use an explicit country prefix.')
  if (!/^[1-9]\d{5,14}$/.test(digits)) throw new Error('Invalid phone number.')
  if (digits.startsWith('20') && !/^201[0125]\d{8}$/.test(digits)) throw new Error('Invalid Egyptian mobile number.')
  if (!digits.startsWith('20') && (!explicit || !allowInternational)) throw new Error('International sending is disabled.')
  return '+' + digits
}

export const smsTemplateVariables = text => {
  const variables = [...String(text).matchAll(/{{\s*([a-z][a-z0-9_]{0,39})\s*}}/g)].map(match => match[1])
  const rest = String(text).replace(/{{\s*([a-z][a-z0-9_]{0,39})\s*}}/g, '')
  if (rest.includes('{{') || rest.includes('}}')) throw new Error('Invalid template placeholder.')
  return [...new Set(variables)].sort()
}

export const renderSmsTemplate = (text, supplied = {}) => {
  if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied)) throw new Error('Invalid template variables.')
  const required = smsTemplateVariables(text)
  if (Object.keys(supplied).some(key => !required.includes(key))) throw new Error('Unknown template variable.')
  for (const key of required) if (typeof supplied[key] !== 'string' || supplied[key].length > 500 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(supplied[key])) throw new Error('Missing or invalid template variable.')
  return text.replace(/{{\s*([a-z][a-z0-9_]{0,39})\s*}}/g, (_, key) => supplied[key])
}
