import { randomUUID } from 'node:crypto'
import { createClaimsFixture } from './claimsFixture.mjs'
import { encryptShippingSecret } from '../../server/utils/shippingSecrets.js'
import { pdcEventKey } from '../../server/utils/pdcTracking.js'

export const reverseFixtureRuntime = { shippingCredentialsEncryptionKey: 'reverse-fixture-encryption-key-for-isolated-tests', shippingLiveRequestsEnabled: true }
export const attachReverseFixture = async f => {
  const configure = async () => {
    globalThis.useRuntimeConfig = () => reverseFixtureRuntime
    const token = encryptShippingSecret('REVERSE-FIXTURE-TOKEN'), secret = encryptShippingSecret('reverse-fixture-webhook-secret-minimum-32-characters')
    await f.db.query("update public.shipping_provider_settings set is_enabled=true,reverse_enabled=true,reverse_shipment_type_id=3,company_id='123456',product_id=64,origin_city_id=1,origin_address='Fixture store destination',origin_phone='01000000000',origin_contact_name='Fixture Store',default_weight_kg=2.5,access_token_encrypted=$1,webhook_secret_encrypted=$2 where id='pdc'", [token, secret])
  }
  const mapping = (await f.db.query("select * from public.shipping_city_mappings where provider='pdc' order by provider_city_id limit 1")).rows[0]
  const input = (extra = {}) => ({ pickup: { name: 'Alternate Buyer', phone: '01012345678', address: 'Alternate pickup street', city_mapping_id: mapping.id }, handling_resolution: 'refund', reason: 'Confirmed current pickup details and item return.', return_required: true, ...extra })
  const approve = async (type = 'return', quantity = 1, policy = {}) => {
    await f.enable(policy); const item = await f.purchase(quantity), claim = await f.create(f.body(item, type, { quantity })); await f.action(claim.id, 'review'); await f.action(claim.id, 'approve'); return { ...claim, item }
  }
  const schedule = async (claim, body = input(), key = randomUUID(), admin = f.owner, ready = true) => f.rpc('shipping_claim_schedule', { p_admin: admin, p_claim: claim, p_revision: (await f.detail(claim, true)).claim.revision, p_key: key, p_input: body, p_ready: ready })
  const take = async (ready = true) => f.rpc('shipping_claim_take', { p_ready: ready, p_limit: 25 })
  const finish = (job, state = 'created', awb = 'REV-' + job.id, code = null) => f.rpc('shipping_claim_finish', { p_job: job.id, p_token: job.token, p_state: state, p_ref: state === 'created' ? job.to_ref : null, p_awb: state === 'created' ? awb : null, p_code: code })
  const job = async id => (await f.db.query('select * from public.shipping_claim_jobs where id=$1', [id])).rows[0]
  const event = (job, id = 12, patch = {}) => ({ ref: job.to_ref, awb: job.awb, status_id: id, status_name: 'Fixture provider status', reason: 'PRIVATE-PROVIDER-DIAGNOSTIC', status_date: new Date(Date.now()+1000).toISOString(), observed_at: new Date(Date.now()+2000).toISOString(), source: 'webhook', ...patch })
  const record = update => f.rpc('shipping_record_pdc_event', { p_update: { ...update, event_key: pdcEventKey(update) } })
  const view = (claim, staff = false, actor = staff ? f.owner : f.customer) => f.rpc('shipping_claim_view', { p_actor: actor, p_claim: claim, p_staff: staff })
  return { ...f, mapping, configure, input, approve, schedule, take, finish, job, event, record, view }
}
export const createReverseFixture = async options => attachReverseFixture(await createClaimsFixture(options))
