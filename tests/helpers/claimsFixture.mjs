import { randomUUID } from 'node:crypto'
import { createOrderSmsFixture } from './orderSmsFixture.mjs'

export const createClaimsFixture = async (options = {}) => {
  const f = await createOrderSmsFixture(options)
  const rpc = async (name, args = {}) => {
    const result = await f.client.rpc(name, args)
    if (result.error) throw Object.assign(Error(result.error.message), { code: result.error.code })
    return result.data
  }
  const save = async (values, section) => rpc('after_sales_save_policy', {
    p_admin_id: f.owner, p_scope_key: 'global', p_section: section,
    p_revision: (await f.db.query("select revision from public.after_sales_policies where scope_key='global'")).rows[0].revision, p_values: values
  })
  const enable = async ({ warranty = {}, returns = {} } = {}) => {
    await f.db.query("update public.products set warranty_status='included',warranty_duration_value=12,warranty_duration_unit='months' where id=$1", [f.product])
    await save({ warranty_enabled: true, warranty_resolutions: ['repair', 'replacement', 'refund', 'service_center'], warranty_start_basis: 'order_date', warranty_evidence: 'optional', warranty_serial: 'optional', ...warranty }, 'warranty')
    await save({ return_enabled: true, return_window_days: 365, return_start_basis: 'order_date', return_opened: 'allowed', return_packaging: 'not_required', return_evidence: 'optional', ...returns }, 'returns')
  }
  const purchase = async (quantity = 1) => {
    const cart = randomUUID()
    const order = { order_number: 'CLAIM-FIXTURE-' + cart, first_name: 'Buyer', last_name: 'Fixture', phone: '01012345678', street_address: 'Street', city: 'Cairo', governorate: 'Cairo', payment_method: 'cash', locale: 'ar' }
    const data = (await f.db.query('select public.commerce_create_customer_order($1,$2::jsonb,$3::jsonb,false,$4) result', [f.customer, JSON.stringify(order), JSON.stringify([{ product_id: f.product, quantity }]), cart])).rows[0].result
    const orderId = (data.order || data).id
    return (await f.db.query('select * from public.customer_order_items where order_id=$1', [orderId])).rows[0]
  }
  const body = (item, type = 'return', overrides = {}) => ({ item_id: item.id, claim_type: type, quantity: 1, description: 'Fixture issue description', reason_key: type === 'return' ? 'changed_mind' : null,
    opened: false, packaging: true, serials: [], attachment_ids: [], idempotency_key: randomUUID(), locale: 'en', ...overrides })
  const create = input => rpc('after_sales_claim_create', { p_customer: f.customer, p_input: input })
  const detail = (id, staff = false, actor = staff ? f.owner : f.customer, before = null) => rpc('after_sales_claim_detail', { p_actor: actor, p_claim: id, p_staff: staff, p_before: before })
  const action = async (id, name, input = { text: 'Fixture staff decision' }, admin = f.owner) => rpc('after_sales_claim_staff_action', {
    p_admin: admin, p_claim: id, p_revision: (await detail(id, true)).claim.revision, p_action: name, p_input: input
  })
  const customerAction = async (id, name, input = { text: 'Fixture customer answer', attachment_ids: [] }) => rpc('after_sales_claim_customer_action', {
    p_customer: f.customer, p_claim: id, p_revision: (await detail(id)).claim.revision, p_action: name, p_input: input
  })
  const metadata = { original_name: 'fixture.png', mime_type: 'image/png', size_bytes: 8, content_sha256: 'a'.repeat(64) }
  const evidence = async (item, type = 'return', target = null, ready = true, id = randomUUID(), overrides = {}) => {
    await rpc('after_sales_claim_reserve_evidence', { p_customer: f.customer, p_item: item.id, p_type: type, p_id: id, p_reason: type === 'return' ? 'changed_mind' : null, p_target: target, p_metadata: { ...metadata, ...overrides } })
    if (ready) await rpc('after_sales_claim_finish_evidence', { p_customer: f.customer, p_id: id, p_remove: false })
    return id
  }
  return { ...f, rpc, save, enable, purchase, body, create, detail, action, customerAction, evidence, metadata }
}
