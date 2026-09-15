export const getStoreImageUrl = (value = '') => {
  const url = String(value || '').trim()
  return /^https?:\/\/(?:placehold\.co|via\.placeholder\.com)(?:\/|$)/i.test(url) ? '' : url
}

export const getConfiguredStoreImageUrl = (value = '') => {
  const url = String(value || '').trim()
  return /^(?:https?:\/\/|\/(?!\/))/.test(url) ? url : ''
}

export const getStoreLinkUrl = (value = '') => {
  const url = String(value || '').trim()

  if (/^https?:\/\//i.test(url)) return url
  if (/^(?:\/(?!\/)|#|\?)/.test(url)) return url

  return ''
}

export const isExternalStoreLink = (value = '') => /^https?:\/\//i.test(getStoreLinkUrl(value))

export const getStoreCategoryIcon = (category = '') => {
  const name = String(category).toLowerCase()
  if (/keyboard/.test(name)) return 'lucide:keyboard'
  if (/mouse.?pad|desk.?mat/.test(name)) return 'lucide:rectangle-horizontal'
  if (/mouse|mice/.test(name)) return 'lucide:mouse'
  if (/headset|headphone|audio/.test(name)) return 'lucide:headphones'
  if (/microphone|\bmic\b/.test(name)) return 'lucide:mic'
  if (/controller|gamepad/.test(name)) return 'lucide:gamepad-2'
  if (/accessor|cable|charger/.test(name)) return 'lucide:cable'
  if (/laptop/.test(name)) return 'lucide:laptop'
  if (/monitor|display/.test(name)) return 'lucide:monitor'
  return 'lucide:package'
}
