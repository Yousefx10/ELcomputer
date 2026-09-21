import { createClient } from '@supabase/supabase-js'

const guestStorageKey = 'elcomputer-live-chat-guest-auth-v1'
let guestClient

export const useLiveChatClient = () => {
  const mainClient = useSupabaseClient()
  const config = useRuntimeConfig()

  const getGuestClient = () => {
    if (guestClient) return guestClient
    const url = config.public.supabaseUrl || config.public.supabase?.url
    const key = config.public.supabase?.key
    if (!url || !key) throw new Error('Live chat is not configured.')
    guestClient = createClient(url, key, {
      auth: {
        storageKey: guestStorageKey,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    })
    return guestClient
  }

  const hasStoredGuestSession = () => typeof window !== 'undefined'
    && Boolean(window.localStorage.getItem(guestStorageKey))

  const resolveActor = async () => {
    const { data: main } = await mainClient.auth.getSession()
    if (main.session?.access_token && main.session.user?.is_anonymous !== true) {
      return { kind: 'customer', client: mainClient, session: main.session }
    }
    const client = getGuestClient()
    const { data: guest } = await client.auth.getSession()
    return { kind: 'guest', client, session: guest.session?.user?.is_anonymous === true
      ? guest.session : null }
  }

  const ensureGuestSession = async (actor) => {
    if (actor.kind !== 'guest' || actor.session) return actor
    const { data, error } = await actor.client.auth.signInAnonymously()
    if (error || !data.session) {
      throw new Error('Guest chat is unavailable. Please sign in or use the Help Center.')
    }
    return { ...actor, session: data.session }
  }

  const request = async (actor, path, options = {}) => {
    const { data, error } = await actor.client.auth.getSession()
    if (error || !data.session?.access_token) throw new Error('Your chat session expired. Please reopen chat.')
    return $fetch(`/api/chat${path}`, {
      ...options,
      headers: { ...(options.headers || {}), authorization: `Bearer ${data.session.access_token}` }
    })
  }

  const uploadAttachment = async (actor, conversationId, messageId, attachmentId, file) => {
    const form = new FormData()
    form.append('messageId', messageId)
    form.append('attachmentId', attachmentId)
    form.append('file', file)
    return request(actor, `/conversations/${conversationId}/attachments`, { method: 'POST', body: form })
  }

  const downloadAttachment = async (actor, id, name) => {
    const { data, error } = await actor.client.auth.getSession()
    if (error || !data.session?.access_token) throw new Error('Your chat session expired. Please reopen chat.')
    const response = await fetch(`/api/chat/attachments/${encodeURIComponent(id)}`, {
      headers: { authorization: `Bearer ${data.session.access_token}` }, cache: 'no-store'
    })
    if (!response.ok) throw new Error('Could not download this file.')
    const url = URL.createObjectURL(await response.blob())
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = name || 'attachment'; document.body.append(anchor)
    anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return { getGuestClient, hasStoredGuestSession, resolveActor, ensureGuestSession,
    request, uploadAttachment, downloadAttachment }
}
