export const useSupportClient = () => {
  const scope = useCustomerScope()
  const request = scope.request

  const upload = async (url, messageId, file) => {
    const form = new FormData()
    form.append('messageId', messageId)
    form.append('file', file)
    return request(url, { method: 'POST', body: form })
  }

  const downloadFrom = async (urlPath, name) => {
    const response = await fetch(urlPath, {
      headers: await scope.headers(), cache: 'no-store'
    })
    scope.assertCurrent()
    if (!response.ok) throw new Error('Could not download this file.')
    const blob = await response.blob()
    scope.assertCurrent()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name || 'attachment'
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const download = (id, name) => downloadFrom(`/api/support/attachments/${encodeURIComponent(id)}`, name)

  const errorText = (error, fallback) => error?.data?.statusMessage
    || error?.statusMessage || error?.message || fallback

  return { request, upload, download, downloadFrom, errorText, assertCurrent: scope.assertCurrent }
}
