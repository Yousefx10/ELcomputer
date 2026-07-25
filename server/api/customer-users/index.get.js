import { createError, getQuery } from 'h3'
import {
  calculateCustomerAcceptance,
  customerAcceptanceResolvedStatuses,
  mapCustomerProfileRecord
} from '../../utils/customerUsers'
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
    .eq('is_internal', false)

  let dataQuery = supabaseAdmin
    .from('customer_profiles')
    .select('id, email, full_name, phone, city, country, is_active, wallet_balance, created_at, updated_at')
    .eq('is_internal', false)

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
      .select('*', { count: 'exact', head: true })
      .eq('is_internal', false),
    supabaseAdmin
      .from('customer_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_internal', false)
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

  const profileRecords = data || []
  const profileIds = profileRecords.map((profile) => profile.id)
  const acceptanceOrdersByCustomer = new Map(
    profileIds.map((profileId) => [String(profileId), []])
  )

  if (profileIds.length) {
    const { data: acceptanceOrderRecords, error: acceptanceOrdersError } = await supabaseAdmin
      .from('customer_orders')
      .select('user_id, status')
      .in('user_id', profileIds)
      .in('status', customerAcceptanceResolvedStatuses)

    if (acceptanceOrdersError) {
      throw createError({
        statusCode: 500,
        statusMessage: acceptanceOrdersError.message
      })
    }

    const customerAcceptanceOrders = acceptanceOrderRecords || []

    customerAcceptanceOrders.forEach((order) => {
      const customerOrders = acceptanceOrdersByCustomer.get(String(order.user_id))

      if (customerOrders) {
        customerOrders.push(order)
      }
    })
  }

  return {
    items: profileRecords.map((profile) => ({
      ...mapCustomerProfileRecord(profile),
      acceptance: calculateCustomerAcceptance(
        acceptanceOrdersByCustomer.get(String(profile.id)) || []
      )
    })),
    total: totalCount || 0,
    activeTotal: activeCount || 0,
    filteredTotal: filteredCount || 0,
    page,
    pageSize
  }
})
