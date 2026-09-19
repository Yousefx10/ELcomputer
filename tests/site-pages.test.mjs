import test from 'node:test'
import assert from 'node:assert/strict'
import { renderSafeMarkdown } from '../app/utils/markdown.js'
import { normalizeSitePagePath, normalizeSitePagePayload } from '../server/utils/sitePages.js'

test('custom page paths are normalized and reserved routes are rejected', () => {
  assert.equal(normalizeSitePagePath(' /Policies/Shipping-Policy/ '), 'policies/shipping-policy')
  assert.equal(normalizeSitePagePath('https://store.test/returns-policy?draft=1'), 'returns-policy')
  assert.throws(() => normalizeSitePagePath('/dashboard/pages'), /reserved/i)
  assert.throws(() => normalizeSitePagePath('/help'), /reserved/i)
  assert.throws(() => normalizeSitePagePath('/bad path'), /lowercase words/i)
})

test('custom page payload keeps publishing and navbar settings explicit', () => {
  assert.deepEqual(normalizeSitePagePayload({
    title: '  Shipping   policy ',
    path: '/shipping-policy',
    content_markdown: '# Delivery\r\n\r\nDetails ',
    text_direction: 'rtl',
    is_published: true,
    show_in_navbar: true
  }), {
    title: 'Shipping policy',
    path: 'shipping-policy',
    content_markdown: '# Delivery\n\nDetails',
    text_direction: 'rtl',
    is_published: true,
    show_in_navbar: true
  })
})

test('custom pages default to automatic text direction', () => {
  assert.equal(normalizeSitePagePayload({ title: 'Policy', path: 'policy' }).text_direction, 'auto')
})

test('markdown renders formatting and escapes unsafe markup', () => {
  const html = renderSafeMarkdown('# Policy\n\n**Safe** [bad](javascript:alert)\n\n<script>alert(1)</script>')
  assert.match(html, /<h1>Policy<\/h1>/)
  assert.match(html, /<strong>Safe<\/strong>/)
  assert.match(html, /href="#"/)
  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /&lt;script&gt;/)
})
