import { getQuery } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import {
  getCrmQueryValue,
  isCrmUuid,
  mapCrmContact,
  throwCrmDatabaseError
} from '../../utils/crmActivities'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event)
  const query = getQuery(event)
  const search = getCrmQueryValue(query.search).slice(0, 100)
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
      contactsQuery = contactsQuery.ilike('name', `%${search}%`)
    }

    return contactsQuery
  }

  const [
    companyContactsResult,
    personContactsResult,
    selectedContactsResult
  ] = await Promise.all([
    buildContactsQuery('company'),
    buildContactsQuery('person'),
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

  const contacts = [...contactsById.values()].sort((leftContact, rightContact) => {
    const entityComparison = String(leftContact.entity_type || '')
      .localeCompare(String(rightContact.entity_type || ''))

    if (entityComparison) {
      return entityComparison
    }

    return String(leftContact.name || '').localeCompare(String(rightContact.name || ''))
  })

  return {
    items: contacts.map(mapCrmContact),
    limited: (companyContactsResult.data || []).length >= 100
      || (personContactsResult.data || []).length >= 100
  }
})
