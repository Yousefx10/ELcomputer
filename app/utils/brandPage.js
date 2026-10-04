// One public content document. Unknown keys never reach rendering or Markdown.
export const BRAND_ROW_LIMIT = 30
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const text = (value, limit = 500) => typeof value === 'string' ? value.trim().slice(0, limit) : ''
const id = value => /^[a-zA-Z0-9_-]{1,80}$/.test(value || '') ? value : ''

export function brandUrl(value, { fragment = false } = {}) {
  const url = text(value, 2048)
  if (!url || /[\s<>"'\\\u0000-\u001f\u007f]/.test(url)) return ''
  if (fragment && /^#[a-zA-Z0-9_-]+$/.test(url)) return url
  if (/^\/(?!\/)/.test(url) && !/^\/%(?:2f|5c)/i.test(url)) return url
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? url : ''
  } catch { return '' }
}

export function brandVideo(value) {
  const url = brandUrl(value)
  if (!/^https:\/\//.test(url)) return null
  const parsed = new URL(url), host = parsed.hostname.toLowerCase()
  let videoId = ''
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'].includes(host)) {
    videoId = host === 'youtu.be' ? parsed.pathname.slice(1) : parsed.pathname === '/watch' ? parsed.searchParams.get('v') : parsed.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1]
    if (/^[a-zA-Z0-9_-]{11}$/.test(videoId || '')) return { type: 'embed', url: `https://www.youtube-nocookie.com/embed/${videoId}`, provider: 'YouTube' }
  }
  if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) {
    videoId = parsed.pathname.match(/^\/(?:video\/)?([0-9]+)$/)?.[1]
    if (videoId) return { type: 'embed', url: `https://player.vimeo.com/video/${videoId}`, provider: 'Vimeo' }
  }
  if (/\.(mp4|webm)$/i.test(parsed.pathname)) return { type: 'file', url, provider: '' }
  return null
}

export function normalizeBrandPage(value = {}) {
  const source = object(value), hero = object(source.hero), background = object(source.background), story = object(source.story)
  const rows = (Array.isArray(source.rows) ? source.rows : []).slice(0, BRAND_ROW_LIMIT).map((row, position) => {
    row = object(row)
    const layout = row.layout === 'two' ? 'two' : 'one'
    return { id: id(row.id) || `row-${position}`, layout, items: (Array.isArray(row.items) ? row.items : []).slice(0, layout === 'two' ? 2 : 1).map((item, slot) => {
      item = object(item)
      const type = item.type === 'video' ? 'video' : 'image'
      return { id: id(item.id) || `item-${position}-${slot}`, type,
        url: type === 'video' ? brandVideo(item.url) ? text(item.url, 2048) : '' : brandUrl(item.url),
        poster: brandUrl(item.poster), alt: text(item.alt, 300), caption: text(item.caption, 1000), link: brandUrl(item.link, { fragment: true }) }
    }) }
  })
  return { version: 1,
    hero: { image: brandUrl(hero.image), mobile_image: brandUrl(hero.mobile_image), title: text(hero.title, 200), text: text(hero.text, 600),
      cta_label: text(hero.cta_label, 80), cta_url: brandUrl(hero.cta_url, { fragment: true }),
      alignment: ['start', 'center', 'end'].includes(hero.alignment) ? hero.alignment : 'start',
      overlay: Number.isFinite(Number(hero.overlay)) && hero.overlay !== '' && hero.overlay != null ? Math.max(0.55, Math.min(0.85, Number(hero.overlay))) : 0.55 },
    background: { image: brandUrl(background.image), color: /^#[0-9a-f]{6}$/i.test(background.color || '') ? background.color : '' },
    story: { title: text(story.title, 200), content: text(story.content, 30000), supporting: text(story.supporting, 2000) }, rows }
}

export const visibleBrandRows = page => normalizeBrandPage(page).rows.map(row => ({ ...row, items: row.items.filter(item => item.url) })).filter(row => row.items.length)

export function brandSlug(name, existing = '') {
  return existing || String(name || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}
