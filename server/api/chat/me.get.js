import { requireChatVisitor } from '../../utils/liveChat'

export default defineEventHandler(async (event) => {
  const actor = await requireChatVisitor(event)
  if (actor.kind === 'guest') return { kind: 'guest', contact: null }
  return { kind: 'customer', contact: {
    name: actor.profile.full_name || actor.profile.email,
    email: actor.profile.email,
    mobile: actor.profile.phone || null
  } }
})
