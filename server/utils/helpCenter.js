import { createError } from 'h3'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const helpCategoryFields = 'id, name, slug, description, sort_position, is_active, created_at, updated_at'
export const helpArticleFields = 'id, category_id, title, slug, summary, content_markdown, status, is_featured, sort_position, created_by, updated_by, created_at, updated_at, published_at'
export const publicHelpArticleFields = 'id, category_id, title, slug, summary, content_markdown, is_featured, published_at'
export const publicHelpArticleSummaryFields = 'id, category_id, title, slug, summary, is_featured, published_at'

export const requireHelpId = (value) => {
  const id = String(value || '').trim()
  if (!UUID.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid item.' })
  return id
}

export const requireHelpSlug = (value) => {
  const slug = String(value || '').trim().toLowerCase()
  if (!slug || slug.length > 160 || !SLUG.test(slug)) {
    throw createError({ statusCode: 400, statusMessage: 'Use lowercase words and hyphens for the URL.' })
  }
  return slug
}

const boundedText = (value, label, max, required = false) => {
  const text = String(value || '').trim()
  if ((required && !text) || text.length > max) {
    throw createError({ statusCode: 400, statusMessage: `${label} must be ${required ? '1–' : 'at most '}${max} characters.` })
  }
  return text
}

const position = (value) => {
  const result = Number(value || 0)
  if (!Number.isInteger(result) || result < -100000 || result > 100000) {
    throw createError({ statusCode: 400, statusMessage: 'Order position is invalid.' })
  }
  return result
}

export const normalizeHelpCategory = (body = {}) => ({
  name: boundedText(body.name, 'Name', 80, true),
  slug: requireHelpSlug(body.slug),
  description: boundedText(body.description, 'Description', 300),
  sort_position: position(body.sort_position),
  is_active: body.is_active !== false
})

export const normalizeHelpArticle = (body = {}) => {
  const status = String(body.status || 'draft').trim()
  if (!['draft', 'published', 'archived'].includes(status)) {
    throw createError({ statusCode: 400, statusMessage: 'Article status is invalid.' })
  }
  return {
    category_id: requireHelpId(body.category_id),
    title: boundedText(body.title, 'Title', 160, true),
    slug: requireHelpSlug(body.slug),
    summary: boundedText(body.summary, 'Summary', 500),
    content_markdown: boundedText(body.content_markdown, 'Content', 100000),
    status,
    is_featured: body.is_featured === true,
    sort_position: position(body.sort_position)
  }
}

export const throwHelpError = (error, fallback = 'Could not save this item.') => {
  if (error?.code === '23505') throw createError({ statusCode: 409, statusMessage: 'That URL is already in use.' })
  if (error?.code === '23503') throw createError({ statusCode: 409, statusMessage: 'This category is still in use.' })
  if (['42P01', '42703', 'PGRST205'].includes(error?.code)) {
    throw createError({ statusCode: 503, statusMessage: 'Help Center is not installed yet.' })
  }
  throw createError({ statusCode: 500, statusMessage: fallback })
}
