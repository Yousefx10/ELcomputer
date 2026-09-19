import { getQuery } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'
import { helpCategoryFields, publicHelpArticleSummaryFields, throwHelpError } from '../../utils/helpCenter'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const search = String(query.q || '').trim().slice(0, 120)
  const category = String(query.category || '').trim().toLowerCase()
  const supabase = getSupabaseAdminClient()
  const { data: categories, error: categoryError } = await supabase
    .from('help_categories').select(helpCategoryFields)
    .eq('is_active', true).order('sort_position').order('name')
  if (categoryError) throwHelpError(categoryError, 'Could not load Help Center.')

  const selectedCategory = category ? categories.find(item => item.slug === category) : null
  if (category && !selectedCategory) return { categories, articles: [] }
  if (!categories.length) return { categories, articles: [] }

  let articlesQuery = supabase.from('help_articles').select(publicHelpArticleSummaryFields)
    .eq('status', 'published')
    .in('category_id', categories.map(item => item.id))
    .order('is_featured', { ascending: false })
    .order('sort_position')
    .order('published_at', { ascending: false })
    .limit(search ? 50 : 40)
  if (selectedCategory) articlesQuery = articlesQuery.eq('category_id', selectedCategory.id)
  if (search) articlesQuery = articlesQuery.textSearch('search_vector', search, { type: 'plain', config: 'simple' })
  const { data: articles, error: articleError } = await articlesQuery
  if (articleError) throwHelpError(articleError, 'Could not load articles.')
  return { categories, articles: articles || [], query: search }
})
