import { createError, getRouterParam, readBody } from 'h3'
import { requireCustomerRequest } from '../../../../utils/customerRequest'
import {
  CUSTOMER_MESSAGES_TABLE,
  isOrderPackingUuid,
  throwOrderPackingDatabaseError
} from '../../../../utils/orderPacking'

const getRpcResult = (data) => {
  if (Array.isArray(data)) {
    return data[0] || {}
  }

  return data && typeof data === 'object' ? data : {}
}

const getCustomerDisplayName = ({ authUser, customerProfile }) => {
  return String(
    customerProfile?.full_name
    || authUser?.user_metadata?.full_name
    || authUser?.user_metadata?.name
    || authUser?.email?.split('@')[0]
    || 'Customer'
  ).trim().slice(0, 160)
}

export default defineEventHandler(async (event) => {
  const {
    authUser,
    customerProfile,
    supabaseAdmin
  } = await requireCustomerRequest(event)
  const messageId = String(getRouterParam(event, 'id') || '').trim()

  if (!isOrderPackingUuid(messageId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid message is required.'
    })
  }

  const body = await readBody(event)
  const messageBody = String(body?.message || body?.body || '').trim()

  if (!messageBody) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Write a reply before sending.'
    })
  }

  if (messageBody.length > 2000) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Your reply must be 2,000 characters or fewer.'
    })
  }

  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
    'reply_to_order_message',
    {
      p_message_id: messageId,
      p_user_id: authUser.id,
      p_body: messageBody,
      p_sender_name: getCustomerDisplayName({
        authUser,
        customerProfile
      })
    }
  )

  if (rpcError) {
    throwOrderPackingDatabaseError(
      rpcError,
      'Could not send your reply.'
    )
  }

  const result = getRpcResult(rpcData)
  const replyId = result.message_id || result.messageId

  if (!replyId) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Your reply was saved without returning its message record.'
    })
  }

  const { data: reply, error: replyError } = await supabaseAdmin
    .from(CUSTOMER_MESSAGES_TABLE)
    .select('*')
    .eq('id', replyId)
    .eq('user_id', authUser.id)
    .maybeSingle()

  if (replyError) {
    throwOrderPackingDatabaseError(
      replyError,
      'Your reply was sent, but it could not be reloaded.'
    )
  }

  if (!reply) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Your reply was sent, but it could not be found.'
    })
  }

  const orderStatus = result.order_status || result.orderStatus || null
  const orderResumed = Boolean(
    result.order_resumed ?? result.orderResumed
  )
  const normalizedReply = {
    ...reply,
    reply_to_id: reply.reply_to_message_id || null,
    response_requested: reply.message_kind === 'packing_problem',
    responded_at: reply.replied_at || null,
    order_status: orderStatus
  }

  return {
    reply: normalizedReply,
    item: normalizedReply,
    orderId: result.order_id || result.orderId || reply.order_id || null,
    orderStatus,
    orderResumed,
    result
  }
})
