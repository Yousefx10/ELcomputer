import { openOrderStatuses } from './adminOrders'
import { chatError } from './liveChat'

const orderFields = 'id,order_number,status,payment_status,total_amount,currency,created_at'

export const loadChatOrders = async (actor, customerId, number = '') => {
  let request = actor.supabase.from('customer_orders').select(orderFields).eq('user_id', customerId)
  if (number) request = request.eq('order_number', number)
  const { data, error } = await request.order('created_at', { ascending: false }).limit(number ? 1 : 20)
  if (error) chatError(error, 'Could not load customer orders.')
  return data || []
}

export const loadChatContext = async (actor, chat, number = '') => {
  const customerId = chat.customer_id
  const guestId = chat.guest_auth_user_id
  const identity = customerId ? 'customer_id' : 'guest_auth_user_id'
  const ownerId = customerId || guestId
  if (!ownerId) return { profile: null, recentOrders: [], openOrders: [], relatedOrder: null,
    relatedItems: [], orderMatches: [], tickets: [], previousChats: [] }
  const requests = [actor.supabase.from('chat_conversations')
    .select('id,reference_number,status,created_at,order_id')
    .eq(identity, ownerId).neq('id', chat.id)
    .order('created_at', { ascending: false }).limit(8)]
  if (!customerId) {
    const [chats] = await Promise.all(requests)
    if (chats.error) chatError(chats.error, 'Could not load customer context.')
    return { profile: null, recentOrders: [], openOrders: [], relatedOrder: null,
      relatedItems: [],
      orderMatches: [], tickets: [], previousChats: chats.data || [] }
  }
  const [profile, recent, open, related, tickets, chats, matches] = await Promise.all([
    actor.supabase.from('customer_profiles').select('id,full_name,email,phone,is_active').eq('id', customerId).maybeSingle(),
    actor.supabase.from('customer_orders').select(orderFields).eq('user_id', customerId)
      .order('created_at', { ascending: false }).limit(8),
    actor.supabase.from('customer_orders').select(orderFields).eq('user_id', customerId)
      .in('status', openOrderStatuses).order('created_at', { ascending: false }).limit(8),
    chat.order_id ? actor.supabase.from('customer_orders').select(orderFields)
      .eq('id', chat.order_id).eq('user_id', customerId).maybeSingle() : Promise.resolve({ data: null }),
    actor.supabase.from('support_tickets').select('id,reference_number,subject,status,order_id,created_at')
      .eq('customer_id', customerId).order('created_at', { ascending: false }).limit(8),
    requests[0],
    number ? loadChatOrders(actor, customerId, number) : Promise.resolve([])
  ])
  for (const result of [profile, recent, open, related, tickets, chats]) {
    if (result.error) chatError(result.error, 'Could not load customer context.')
  }
  let relatedItems = []
  if (related.data) {
    const result = await actor.supabase.from('customer_order_items')
      .select('id,product_title,quantity').eq('order_id', related.data.id).limit(20)
    if (result.error) chatError(result.error, 'Could not load related order items.')
    relatedItems = result.data || []
  }
  return { profile: profile.data, recentOrders: recent.data || [], openOrders: open.data || [],
    relatedOrder: related.data, relatedItems, orderMatches: matches, tickets: tickets.data || [],
    previousChats: chats.data || [] }
}
