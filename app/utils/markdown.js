const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

const safeHref = (value = '') => {
  const href = String(value).trim()
  if (/^(https?:|mailto:|tel:)/i.test(href)) return href
  if (href.startsWith('/') && !href.startsWith('//')) return href
  if (href.startsWith('#')) return href
  return '#'
}

const renderInline = (value = '') => {
  const code = []
  let output = escapeHtml(value).replace(/`([^`]+)`/g, (_, text) => {
    const token = `%%INLINE_CODE_${code.length}%%`
    code.push(`<code>${text}</code>`)
    return token
  })

  output = output
    .replace(/\[([^\]]+)\]\(([^\s)]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_, label, href) => `<a href="${safeHref(href)}">${label}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>')

  code.forEach((html, index) => {
    output = output.replace(`%%INLINE_CODE_${index}%%`, html)
  })
  return output
}

export const renderSafeMarkdown = (markdown = '') => {
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n')
  const html = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) {
      index += 1
      continue
    }

    if (/^```/.test(line.trim())) {
      const language = line.trim().slice(3).replace(/[^a-z0-9_-]/gi, '').toLowerCase()
      const codeLines = []
      index += 1
      while (index < lines.length && !/^```/.test(lines[index].trim())) {
        codeLines.push(lines[index])
        index += 1
      }
      if (index < lines.length) index += 1
      html.push(`<pre><code${language ? ` class="language-${language}"` : ''}>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
      index += 1
      continue
    }

    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      html.push('<hr>')
      index += 1
      continue
    }

    if (/^\s*>\s?/.test(line)) {
      const quote = []
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ''))
        index += 1
      }
      html.push(`<blockquote>${quote.map(renderInline).join('<br>')}</blockquote>`)
      continue
    }

    if (/^\s*[-+*]\s+/.test(line)) {
      const items = []
      while (index < lines.length && /^\s*[-+*]\s+/.test(lines[index])) {
        items.push(`<li>${renderInline(lines[index].replace(/^\s*[-+*]\s+/, ''))}</li>`)
        index += 1
      }
      html.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = []
      while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) {
        items.push(`<li>${renderInline(lines[index].replace(/^\s*\d+[.)]\s+/, ''))}</li>`)
        index += 1
      }
      html.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    const paragraph = [line.trim()]
    index += 1
    while (index < lines.length && lines[index].trim()
      && !/^(#{1,6})\s+/.test(lines[index])
      && !/^```/.test(lines[index].trim())
      && !/^\s*(?:[-+*]\s+|\d+[.)]\s+|>\s?)/.test(lines[index])) {
      paragraph.push(lines[index].trim())
      index += 1
    }
    html.push(`<p>${renderInline(paragraph.join(' '))}</p>`)
  }

  return html.join('\n')
}
