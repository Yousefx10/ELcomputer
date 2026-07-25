import { getQuery } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import {
  getCrmQueryValue,
  isCrmUuid,
  mapCrmContact,
  throwCrmDatabaseError
} from '../../utils/crmActivities'

const escapeLikePattern = (value) => {
  return String(value || '').replace(/[\\%_]/g, '\\$&')
}

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event)
  const query = getQuery(event)
  const search = getCrmQueryValue(query.search).slice(0, 100)
  const selectedOnly = getCrmQueryValue(query.selectedOnly).toLowerCase() === 'true'
  const selectedIds = getCrmQueryValue(query.selectedIds)
    .split(',')
    .map((value) => value.trim())
    .filter(isCrmUuid)
    .slice(0, 5)

  const buildContactsQuery = (entityType) => {
    let contactsQuery = supabaseAdmin
      .from('commerce_crm_accounts')
      .select('id, name, entity_type, account_type, is_active')
      .eq('entity_type', entityType)
      .order('name', { ascending: true })
      .order('id', { ascending: true })
      .limit(100)

    if (search) {
      contactsQuery = contactsQuery.ilike('name', `%${escapeLikePattern(search)}%`)
    }

    return contactsQuery
  }

  const [
    companyContactsResult,
    personContactsResult,
    selectedContactsResult
  ] = await Promise.all([
    selectedOnly
      ? Promise.resolve({ data: [], error: null })
      : buildContactsQuery('company'),
    selectedOnly
      ? Promise.resolve({ data: [], error: null })
      : buildContactsQuery('person'),
    selectedIds.length
      ? supabaseAdmin
          .from('commerce_crm_accounts')
          .select('id, name, entity_type, account_type, is_active')
          .in('id', selectedIds)
      : Promise.resolve({
          data: [],
          error: null
        })
  ])

  const encounteredError = companyContactsResult.error
    || personContactsResult.error
    || selectedContactsResult.error

  if (encounteredError) {
    throwCrmDatabaseError(encounteredError, 'Could not load CRM contacts.')
  }

  const contactsById = new Map()

  for (const contact of [
    ...(companyContactsResult.data || []),
    ...(personContactsResult.data || []),
    ...(selectedContactsResult.data || [])
  ]) {
    contactsById.set(contact.id, contact)
  }

  const normalizedSearch = search.toLocaleLowerCase()
  const getSearchRank = (contact) => {
    if (!normalizedSearch) return 0

    const name = String(contact.name || '').toLocaleLowerCase()
    if (name === normalizedSearch) return 0
    if (name.startsWith(normalizedSearch)) return 1
    if (name.split(/\s+/).some((word) => word.startsWith(normalizedSearch))) return 2
    return 3
  }
  const contacts = [...contactsById.values()].sort((leftContact, rightContact) => {
    const rankComparison = getSearchRank(leftContact) - getSearchRank(rightContact)
    if (rankComparison) {
      return rankComparison
    }

    const nameComparison = String(leftContact.name || '')
      .localeCompare(String(rightContact.name || ''))
    if (nameComparison) {
      return nameComparison
    }

    return String(leftContact.entity_type || '')
      .localeCompare(String(rightContact.entity_type || ''))
  })

  return {
    items: contacts.map(mapCrmContact),
    limited: !selectedOnly && (
      (companyContactsResult.data || []).length >= 100
      || (personContactsResult.data || []).length >= 100
    )
  }
})
