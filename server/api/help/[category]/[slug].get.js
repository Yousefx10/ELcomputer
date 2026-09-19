import { createError, getRouterParam } from 'h3'
import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { publicHelpArticleFields, throwHelpError } from '../../../utils/helpCenter'

export default defineEventHandler(async (event) => {
  const categorySlug = String(getRouterParam(event, 'category') || '')
  const articleSlug = String(getRouterParam(event, 'slug') || '')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(categorySlug) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(articleSlug)) {
    throw createError({ statusCode: 404, statusMessage: 'Article not found.' })
  }
  const supabase = getSupabaseAdminClient()
  const { data: category, error: categoryError } = await supabase.from('help_categories')
    .select('id, name, slug').eq('slug', categorySlug).eq('is_active', true).maybeSingle()
  if (categoryError) throwHelpError(categoryError, 'Could not load article.')
  if (!category) throw createError({ statusCode: 404, statusMessage: 'Article not found.' })
  const { data: article, error: articleError } = await supabase.from('help_articles')
    .select(publicHelpArticleFields).eq('category_id', category.id)
    .eq('slug', articleSlug).eq('status', 'published').maybeSingle()
  if (articleError) throwHelpError(articleError, 'Could not load article.')
  if (!article) throw createError({ statusCode: 404, statusMessage: 'Article not found.' })
  return { category, article }
})
