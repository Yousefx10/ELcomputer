import { createError } from 'h3'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PATH_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/
const RESERVED_ROOTS = new Set([
  'account', 'api', 'cart', 'checkout', 'dashboard', 'login', 'products',
  'reviews', 'search', 'signup', 'uploads', '_nuxt'
])

export const normalizeSitePageId = (value) => {
  const id = String(value || '').trim()
  if (!UUID_PATTERN.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Page id is invalid.' })
  }
  return id
}

export const normalizeSitePagePath = (value) => {
  const path = String(value || '')
    .trim()
    .replace(/^https?:\/\/[^/]+/i, '')
    .split(/[?#]/)[0]
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase()

  if (!path || path.length > 160 || !PATH_PATTERN.test(path)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Use lowercase words, numbers, and hyphens in the URL.'
    })
  }

  if (RESERVED_ROOTS.has(path.split('/')[0])) {
    throw createError({ statusCode: 409, statusMessage: 'That URL is reserved by the website.' })
  }

  return path
}

export const normalizeSitePagePayload = (body = {}) => {
  const title = String(body.title || '').trim().replace(/\s+/g, ' ')
  const content = String(body.content_markdown || '').replace(/\r\n?/g, '\n').trim()

  if (!title || title.length > 120) {
    throw createError({ statusCode: 400, statusMessage: 'Title must be 1–120 characters.' })
  }
  if (content.length > 100000) {
    throw createError({ statusCode: 400, statusMessage: 'Page content is too long.' })
  }

  return {
    title,
    path: normalizeSitePagePath(body.path),
    content_markdown: content,
    is_published: body.is_published === true,
    show_in_navbar: body.show_in_navbar === true
  }
}

export const throwSitePageError = (error, fallback = 'Could not save the page.') => {
  if (error?.code === '23505') {
    throw createError({ statusCode: 409, statusMessage: 'Another page uses that URL.' })
  }
  if (['42P01', 'PGRST205'].includes(error?.code)) {
    throw createError({ statusCode: 503, statusMessage: 'Pages is not set up yet.' })
  }
  throw createError({ statusCode: 500, statusMessage: error?.message || fallback })
}

export const sitePageSelect = 'id, title, path, content_markdown, is_published, show_in_navbar, created_by, updated_by, created_at, updated_at'
