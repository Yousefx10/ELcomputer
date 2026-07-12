import { createError, getQuery } from 'h3'
import { mapAdminUserRecord } from '../../utils/adminUsers'
import { requireAdminRequest } from '../../utils/adminRequest'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'users.view'
  })

  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(20, Math.max(1, Number(query.pageSize) || 10))
  const searchQuery = String(query.search || '').trim()
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let countQuery = supabaseAdmin
    .from('admin_users')
    .select('*', { count: 'exact', head: true })

  let dataQuery = supabaseAdmin
    .from('admin_users')
    .select('id, email, full_name, role, permissions, is_active, created_at, updated_at, created_by')

  if (searchQuery) {
    const searchFilter = `email.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`
    countQuery = countQuery.or(searchFilter)
    dataQuery = dataQuery.or(searchFilter)
  }

  const [
    { count: activeOwnerCount, error: activeOwnerCountError },
    { count, error: countError },
    { data, error }
  ] = await Promise.all([
    supabaseAdmin
      .from('admin_users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'owner')
      .eq('is_active', true),
    countQuery,
    dataQuery
      .order('created_at', { ascending: false })
      .range(from, to)
  ])

  if (activeOwnerCountError) {
    throw createError({
      statusCode: 500,
      statusMessage: activeOwnerCountError.message
    })
  }

  if (countError) {
    throw createError({
      statusCode: 500,
      statusMessage: countError.message
    })
  }

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message
    })
  }

  return {
    items: (data || []).map(mapAdminUserRecord),
    total: count || 0,
    activeOwnerCount: activeOwnerCount || 0,
    page,
    pageSize
  }
})
