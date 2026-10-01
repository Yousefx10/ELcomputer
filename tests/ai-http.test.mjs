import test from 'node:test'
import assert from 'node:assert/strict'
import { aiDiscoveryLinks, aiHtmlResource, aiLinkHeader, aiRobotsText, prefersAiMarkdown } from '../app/utils/aiReadiness.js'
import { buildSeo, robotsText, seoHead } from '../app/utils/seo.js'

test('Accept negotiation honors explicit Markdown, qualities, exclusions and ordinary browser preferences', () => {
  for (const value of ['text/markdown', 'TEXT/MARKDOWN; charset=utf-8', 'text/markdown, */*', 'text/html;q=0.5,text/markdown;q=0.9', 'text/*;q=0.5,text/markdown;q=0.8']) assert.equal(prefersAiMarkdown(value), true, value)
  for (const value of ['', '*/*', 'text/*', 'text/html', 'text/html, application/xhtml+xml, */*;q=0.8', 'text/html,text/markdown', 'text/html;q=0.9,text/markdown;q=0.1', 'text/markdown;q=0', 'text/markdown;q=banana', 'text/markdown;q=2']) assert.equal(prefersAiMarkdown(value), false, value)
})

test('HTML negotiation maps to the existing explicit resource parser, with locale and exact query identity', () => {
  assert.equal(aiHtmlResource('/', {}).resource.kind, 'store')
  assert.equal(aiHtmlResource('/ar', {}).resource.locale, 'ar')
  assert.equal(aiHtmlResource('/ar/products/mouse', {}).resource.path, '/products/mouse')
  assert.equal(aiHtmlResource('/ar/products/mouse', {}).resource.locale, 'ar')
  assert.equal(aiHtmlResource('/policies/shipping', {}).resource.kind, 'page')
  assert.equal(aiHtmlResource('/help/orders/guide', {}).resource.kind, 'help')
  assert.deepEqual(aiHtmlResource('/search', { category: 'mouse' }).resource.query, { category: 'mouse' })
  assert.equal(aiHtmlResource('/search', { brand: 'jedel' }).resource.kind, 'brand')
  assert.equal(aiHtmlResource('/products/mouse', { private: 'PRIVATE_ORDER_1' }).invalidQuery, true)
  assert.equal(aiHtmlResource('/products/mouse', { constructor: 'PRIVATE_ORDER_1' }).invalidQuery, true)
  assert.equal(aiHtmlResource('/products/mouse', {}, ['constructor']).invalidQuery, true)
  assert.equal(aiHtmlResource('/search', { category: 'mouse', toString: 'PRIVATE_ORDER_1' }).invalidQuery, true)
  assert.equal(aiHtmlResource('/search', { category: 'mouse', page: '2' }).invalidQuery, true)
  for (const path of ['/account/orders/private', '/ar/dashboard', '/checkout', '/cart', '/support', '/api/chat', '/uploads/private.pdf', '/_nuxt/chunk.js', '/ai/products/mouse.md', '/llms.txt', '/robots.txt', '/sitemap.xml', '/reviews']) assert.equal(aiHtmlResource(path), null, path)
  assert.equal(aiHtmlResource('/search', { q: 'mouse' }), null)
  assert.equal(aiHtmlResource('/search', { category: 'mouse', brand: 'jedel' }), null)
  assert.equal(aiHtmlResource('/search', { category: ['mouse', 'other'] }), null)
})

test('HTTP discovery mirrors the authoritative HTML relationships without adding a conflicting canonical', () => {
  for (const [path, locale, expected] of [['/', 'en', '/ai/index.md'], ['/products/mouse', 'en', '/ai/products/mouse.md'], ['/ar/products/mouse', 'ar', '/ar/ai/products/mouse.md']]) {
    const seo = buildSeo({ settings: { seo_site_url: 'https://store.example' }, path, locale })
    const before = JSON.stringify(seoHead(seo))
    const header = aiLinkHeader(aiDiscoveryLinks(seo))
    assert.ok(header.includes('<https://store.example/llms.txt>; rel="describedby"; type="text/markdown"'))
    assert.ok(header.includes(`<https://store.example${expected}>; rel="alternate"; type="text/markdown"`))
    assert.doesNotMatch(header, /rel="canonical"/)
    assert.equal(JSON.stringify(seoHead(seo)), before)
  }
  for (const options of [{ path: '/account' }, { path: '/missing-product', index: false }, { path: '/noindex-page', index: false }]) assert.equal(aiLinkHeader(aiDiscoveryLinks(buildSeo(options))), '')
})

test('Content Signals track independent AI preferences while normal search, private exclusions and sitemap stay intact', () => {
  for (const search of [true, false]) for (const training of [true, false]) {
    const text = aiRobotsText('https://store.example', { aiSearchAllowed: search, aiTrainingAllowed: training })
    const global = text.split('User-agent: OAI-SearchBot')[0]
    const aiSearch = text.split('User-agent: OAI-SearchBot')[1].split('User-agent: GPTBot')[0]
    const aiTraining = text.split('User-agent: GPTBot')[1]
    assert.ok(global.includes(`Content-signal: search=yes, ai-input=${search ? 'yes' : 'no'}, ai-train=${training ? 'yes' : 'no'}`))
    assert.ok(aiSearch.includes(`Content-signal: search=${search ? 'yes' : 'no'}, ai-input=${search ? 'yes' : 'no'}, ai-train=${training ? 'yes' : 'no'}`))
    assert.equal(/^Disallow: \/$/m.test(global), false)
    assert.equal(/^Disallow: \/$/m.test(aiSearch), !search)
    assert.equal(/^Disallow: \/$/m.test(aiTraining), !training)
    assert.ok(aiTraining.includes('User-agent: Google-Extended'))
    assert.doesNotMatch(text, /User-agent: Googlebot/)
    assert.ok(text.replace(/^Content-signal:.*\n/gm, '').startsWith(robotsText('https://store.example')))
    assert.ok(global.includes('Disallow: /api/') && global.includes('Disallow: /account'))
    assert.ok(global.includes('Sitemap: https://store.example/sitemap.xml'))
    assert.doesNotMatch(text, /use=|content-use:/i)
  }
})
