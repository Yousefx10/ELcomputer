import { createError, getRouterParam, readBody } from 'h3'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import {
  assertPackingSessionOwner,
  findPackingScanMatch,
  getOrderPackingDetail,
  getOrderPackingSession,
  isOrderPackingUuid,
  ORDER_PACKING_SCANS_TABLE,
  throwOrderPackingDatabaseError
} from '../../../../utils/orderPacking'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'dashboard.orders'
  })
  const sessionId = String(
    getRouterParam(event, 'sessionId') || ''
  ).trim()

  if (!isOrderPackingUuid(sessionId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid packing session is required.'
    })
  }

  const body = await readBody(event)
  const itemId = String(body?.itemId || '').trim()

  // A hand check marks every remaining unit on the line, only where no stock unit exists to scan.
  if (itemId) {
    const session = await getOrderPackingSession(supabaseAdmin, sessionId)
    assertPackingSessionOwner(session, adminUser.id)
    const detail = await getOrderPackingDetail({ supabaseAdmin, sessionId, session })
    const item = (detail.items || []).find(row => String(row.id) === itemId)
    if (!item) throw createError({ statusCode: 404, statusMessage: 'This item is not in the order.' })
    if (!item.can_check) throw createError({ statusCode: 409, statusMessage: 'Scan the exact item ID or QR label for serialized inventory.' })
    if (Number(item.remaining || 0) <= 0) throw createError({ statusCode: 409, statusMessage: `${item.product_title || 'This item'} is already fully scanned.` })
    for (let unit = 0; unit < Number(item.remaining); unit++) {
      const { error: checkError } = await supabaseAdmin.from(ORDER_PACKING_SCANS_TABLE).insert({
        session_id: sessionId, order_item_id: item.id, serialized_unit_id: null, scanned_code: 'checked', scan_type: 'checked', scanned_by: adminUser.id
      })
      if (checkError) throwOrderPackingDatabaseError(checkError, 'Could not record this item check.')
    }
    return { detail: await getOrderPackingDetail({ supabaseAdmin, sessionId, session }), lastScan: { product_title: item.product_title, message: `${item.product_title || 'Item'} checked.` } }
  }

  const scannedCode = String(
    body?.code || body?.token || body?.scan || ''
  ).trim()

  if (!scannedCode) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Scan or enter an item code.'
    })
  }

  if (scannedCode.length > 1000) {
    throw createError({
      statusCode: 400,
      statusMessage: 'The scanned item code is too long.'
    })
  }

  const session = await getOrderPackingSession(supabaseAdmin, sessionId)
  assertPackingSessionOwner(session, adminUser.id)

  const detail = await getOrderPackingDetail({
    supabaseAdmin,
    sessionId,
    session
  })
  const match = await findPackingScanMatch({
    supabaseAdmin,
    detail,
    token: scannedCode
  })

  const { data: createdScan, error: scanError } = await supabaseAdmin
    .from(ORDER_PACKING_SCANS_TABLE)
    .insert({
      session_id: sessionId,
      order_item_id: match.item.id,
      serialized_unit_id: match.serializedUnit?.id || null,
      scanned_code: match.serializedUnit?.unit_code || match.token,
      scan_type: match.serializedUnit ? 'serialized' : 'sku',
      scanned_by: adminUser.id
    })
    .select('*')
    .single()

  if (scanError) {
    throwOrderPackingDatabaseError(
      scanError,
      'Could not record this item scan.'
    )
  }

  const refreshedDetail = await getOrderPackingDetail({
    supabaseAdmin,
    sessionId,
    session
  })
  const unitLabel = match.serializedUnit?.unit_code
    || match.item.variant_sku
    || match.item.product_sku
    || match.item.variant_code
    || match.token

  return {
    detail: refreshedDetail,
    lastScan: {
      ...createdScan,
      product_title: match.item.product_title,
      message: `${match.item.product_title || 'Item'} · ${unitLabel} scanned successfully.`
    }
  }
})
