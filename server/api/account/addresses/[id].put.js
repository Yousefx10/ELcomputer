import { readBody, setHeader, getRouterParam } from 'h3'
import { requireCustomerRequest } from '../../../utils/customerRequest'
import { addressCommand, normalizeSavedAddress, savedAddressId, savedAddressRevision, throwSavedAddressError } from '../../../utils/customerDeliveryAddresses.js'

export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const { authUser, supabaseAdmin } = await requireCustomerRequest(event)
  const body = addressCommand(await readBody(event), ['revision', 'address'])
  const { data, error } = await supabaseAdmin.rpc('customer_save_delivery_address', {
    p_customer_id: authUser.id, p_id: savedAddressId(getRouterParam(event, 'id')),
    p_expected_revision: savedAddressRevision(body.revision), p_address: normalizeSavedAddress(body.address)
  })
  if (error) throwSavedAddressError(error)
  return { address: data }
})
