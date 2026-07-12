import { createError, getQuery } from 'h3'
import { mapCustomerProfileRecord } from '../../utils/customerUsers'
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

  let filteredCountQuery = supabaseAdmin
    .from('customer_profiles')
    .select('*', { count: 'exact', head: true })

  let dataQuery = supabaseAdmin
    .from('customer_profiles')
    .select('id, email, full_name, phone, city, country, is_active, wallet_balance, created_at, updated_at')

  if (searchQuery) {
    const searchFilter = `email.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`
    filteredCountQuery = filteredCountQuery.or(searchFilter)
    dataQuery = dataQuery.or(searchFilter)
  }

  const [
    { count: totalCount, error: totalCountError },
    { count: activeCount, error: activeCountError },
    { count: filteredCount, error: filteredCountError },
    { data, error: dataError }
  ] = await Promise.all([
    supabaseAdmin
      .from('customer_profiles')
      .select('*', { count: 'exact', head: true }),
    supabaseAdmin
      .from('customer_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true),
    filteredCountQuery,
    dataQuery
      .order('created_at', { ascending: false })
      .range(from, to)
  ])

  if (totalCountError) {
    throw createError({
      statusCode: 500,
      statusMessage: totalCountError.message
    })
  }

  if (activeCountError) {
    throw createError({
      statusCode: 500,
      statusMessage: activeCountError.message
    })
  }

  if (filteredCountError) {
    throw createError({
      statusCode: 500,
      statusMessage: filteredCountError.message
    })
  }

  if (dataError) {
    throw createError({
      statusCode: 500,
      statusMessage: dataError.message
    })
  }

  return {
    items: (data || []).map(mapCustomerProfileRecord),
    total: totalCount || 0,
    activeTotal: activeCount || 0,
    filteredTotal: filteredCount || 0,
    page,
    pageSize
  }
})
