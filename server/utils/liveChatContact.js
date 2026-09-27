export const chatCallbackMobile = (actor, conversation, supplied = '') => String(
  actor?.kind === 'customer'
    ? actor.profile?.phone || supplied
    : conversation?.contact_mobile || supplied
).trim()
