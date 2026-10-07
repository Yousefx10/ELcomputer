import { createError, getQuery } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { afterSalesHandler } from '../../utils/afterSalesPolicy.js'
export default defineEventHandler(afterSalesHandler(async event => {
  const { supabaseAdmin } = await requireAdminRequest(event, { permission: 'settings.view' })
  const { kind, q = '' } = getQuery(event)
  if (!['category', 'product'].includes(kind) || typeof q !== 'string' || q.length > 80) throw createError({ statusCode: 400, statusMessage: 'Choose a category or product.' })
  const column = kind === 'category' ? 'name' : 'title'
  let query = supabaseAdmin.from(kind === 'category' ? 'categories' : 'products').select(kind === 'category' ? 'id,name,name_ar' : 'id,title').order(column).limit(50)
  if (q.trim()) query = query.ilike(column, `%${q.trim().replace(/[%_]/g, '')}%`)
  const { data, error } = await query
  if (error) throw error
  return { items: data || [] }
}))
