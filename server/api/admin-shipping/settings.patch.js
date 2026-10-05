import { createError } from 'h3'
import { recordAdminActivity } from '../../utils/adminLogs'
import { requireAdminRequest } from '../../utils/adminRequest'
import { getPdcSettings } from '../../utils/pdcShipping'
import { validatePdcSettings } from '../../utils/pdcSettings'
import { readPaymentCallbackBody } from '../../utils/payments/body'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'settings.edit'
  })
  const currentSettings = await getPdcSettings(supabaseAdmin)
  let body
  try { body = JSON.parse(await readPaymentCallbackBody(event, 16384, 3000)) } catch (error) {
    if (error.statusCode) throw error
    throw createError({ statusCode: 400, statusMessage: 'Invalid settings.' })
  }
  const updatePayload = { ...validatePdcSettings(body, currentSettings), updated_by: adminUser.id, updated_at: new Date().toISOString() }
  const accessToken = Boolean(updatePayload.access_token_encrypted)
  const webhookSecret = Boolean(updatePayload.webhook_secret_encrypted)

  const { data, error } = await supabaseAdmin
    .from('shipping_provider_settings')
    .update(updatePayload)
    .eq('id', 'pdc')
    .select('*')
    .single()

  if (error) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Courier settings could not be saved.'
    })
  }

  if (useRuntimeConfig().shippingLiveRequestsEnabled === true && data.is_enabled && data.auto_create_labels) {
    const { error: queueError } = await supabaseAdmin
      .rpc('queue_eligible_paid_orders_for_shipping')

    if (queueError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Shipping queue could not be updated.'
      })
    }
  }

  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: 'shipping.pdc.settings.update',
    description: 'Updated PDC shipping settings.',
    metadata: {
      provider: 'pdc',
      token_changed: Boolean(accessToken),
      webhook_secret_changed: Boolean(webhookSecret),
      auto_create_labels: Boolean(data.auto_create_labels),
      live_enabled: Boolean(data.is_enabled)
    }
  })

  return {
    saved: true,
    live_enabled: Boolean(data.is_enabled),
    access_token_configured: Boolean(data.access_token_encrypted || currentSettings.access_token_encrypted),
    webhook_secret_configured: Boolean(data.webhook_secret_encrypted || currentSettings.webhook_secret_encrypted)
  }
})
