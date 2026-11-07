// Downloads a private PDF with the signed-in session, without exposing a shareable link.
export const downloadPdf = async (url, headers, fileName) => {
  const response = await fetch(url, { headers, cache: 'no-store' })
  if (!response.ok) { let message = ''; try { message = (await response.json())?.statusMessage || '' } catch {} ; throw Object.assign(new Error(message || 'Download failed.'), { statusMessage: message }) }
  const blob = await response.blob(), link = document.createElement('a'), href = URL.createObjectURL(blob)
  link.href = href; link.download = fileName; document.body.appendChild(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(href), 10000)
}
