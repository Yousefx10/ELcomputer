import { createError } from 'h3'
import { requireAdminRequest } from '../../../../utils/adminRequest'
import {
  isInventoryUuid,
  throwInventoryDatabaseError
} from '../../../../utils/serializedInventory'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'products.edit'
  })
  const unitId = String(event.context.params?.id || '').trim()
  const body = await readBody(event)
  const warehouseId = String(body?.warehouse_id || '').trim()
  const reason = String(body?.reason || '').trim()
  const notes = String(body?.notes || '').trim() || null

  if (!isInventoryUuid(unitId) || !isInventoryUuid(warehouseId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid inventory item and warehouse are required.'
    })
  }

  if (!reason) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A return reason is required.'
    })
  }

  const { data, error } = await supabaseAdmin.rpc(
    'commerce_return_serialized_unit',
    {
      p_unit_id: unitId,
      p_warehouse_id: warehouseId,
      p_reason: reason,
      p_notes: notes,
      p_admin_id: adminUser.id
    }
  )

  if (error) {
    throwInventoryDatabaseError(error, 'Could not return this item to stock.')
  }

  const result = Array.isArray(data)
    ? data[0]
    : data

  return {
    itemId: result?.item_id || result?.itemId || unitId,
    status: result?.status || 'in_stock',
    returnId: result?.return_id || result?.returnId || (
      typeof result === 'string'
        ? result
        : null
    )
  }
})
