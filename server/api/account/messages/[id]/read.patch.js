import { createError, getRouterParam } from 'h3'
import { requireCustomerRequest } from '../../../../utils/customerRequest'

const MESSAGE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MESSAGE_SELECT = [
  'id',
  'user_id',
  'order_id',
  'packing_session_id',
  'sender_admin_user_id',
  'sender_name',
  'sender_type',
  'message_kind',
  'sender_customer_user_id',
  'subject',
  'body',
  'reply_to_message_id',
  'replied_at',
  'admin_read_at',
  'read_at',
  'created_at'
].join(', ')

const MISSING_MESSAGE_SCHEMA_CODES = new Set([
  '42P01',
  '42703',
  'PGRST202',
  'PGRST204',
  'PGRST205'
])

const throwMessageDatabaseError = (error) => {
  throw createError({
    statusCode: 500,
    statusMessage: MISSING_MESSAGE_SCHEMA_CODES.has(error?.code)
      ? 'Customer messages are not available yet.'
      : error?.message || 'Could not update this message.'
  })
}

const loadCustomerOrder = async ({
  supabaseAdmin,
  userId,
  orderId
}) => {
  if (!orderId) {
    return null
  }

  const { data, error } = await supabaseAdmin
    .from('customer_orders')
    .select('order_number, status, awaiting_customer_message_id')
    .eq('id', orderId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throwMessageDatabaseError(error)
  }

  return data || null
}

export default defineEventHandler(async (event) => {
  const { authUser, supabaseAdmin } = await requireCustomerRequest(event)
  const messageId = String(getRouterParam(event, 'id') || '').trim()

  if (!MESSAGE_ID_PATTERN.test(messageId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid message id is required.'
    })
  }

  const { data: existingMessage, error: existingMessageError } = await supabaseAdmin
    .from('customer_order_messages')
    .select(MESSAGE_SELECT)
    .eq('id', messageId)
    .eq('user_id', authUser.id)
    .maybeSingle()

  if (existingMessageError) {
    throwMessageDatabaseError(existingMessageError)
  }

  if (!existingMessage) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Message not found.'
    })
  }

  let message = existingMessage

  if (!existingMessage.read_at) {
    const { data: updatedMessage, error: updateError } = await supabaseAdmin
      .from('customer_order_messages')
      .update({
        read_at: new Date().toISOString()
      })
      .eq('id', messageId)
      .eq('user_id', authUser.id)
      .is('read_at', null)
      .select(MESSAGE_SELECT)
      .maybeSingle()

    if (updateError) {
      throwMessageDatabaseError(updateError)
    }

    if (updatedMessage) {
      message = updatedMessage
    } else {
      const { data: refreshedMessage, error: refreshError } = await supabaseAdmin
        .from('customer_order_messages')
        .select(MESSAGE_SELECT)
        .eq('id', messageId)
        .eq('user_id', authUser.id)
        .maybeSingle()

      if (refreshError) {
        throwMessageDatabaseError(refreshError)
      }

      if (!refreshedMessage) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Message not found.'
        })
      }

      message = refreshedMessage
    }
  }

  const order = await loadCustomerOrder({
    supabaseAdmin,
    userId: authUser.id,
    orderId: message.order_id
  })

  return {
    item: {
      ...message,
      reply_to_id: message.reply_to_message_id || null,
      response_requested: message.message_kind === 'packing_problem',
      responded_at: message.replied_at || null,
      order_number: order?.order_number || null,
      order_status: order?.status || null,
      is_awaiting_response: Boolean(
        order?.awaiting_customer_message_id
        && order.awaiting_customer_message_id === message.id
      )
    }
  }
})
