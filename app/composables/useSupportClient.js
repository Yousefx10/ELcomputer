export const useSupportClient = () => {
  const supabase = useSupabaseClient()

  const authHeaders = async () => {
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session?.access_token) throw new Error('Please sign in again.')
    return { authorization: `Bearer ${data.session.access_token}` }
  }

  const request = async (url, options = {}) => $fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), ...await authHeaders() }
  })

  const upload = async (url, messageId, file) => {
    const form = new FormData()
    form.append('messageId', messageId)
    form.append('file', file)
    return request(url, { method: 'POST', body: form })
  }

  const download = async (id, name) => {
    const response = await fetch(`/api/support/attachments/${encodeURIComponent(id)}`, {
      headers: await authHeaders(), cache: 'no-store'
    })
    if (!response.ok) throw new Error('Could not download this file.')
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name || 'attachment'
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const errorText = (error, fallback) => error?.data?.statusMessage
    || error?.statusMessage || error?.message || fallback

  return { request, upload, download, errorText }
}
