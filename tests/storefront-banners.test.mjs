import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { getConfiguredStoreImageUrl, getStoreImageUrl, getStoreLinkUrl, isExternalStoreLink } from '../app/utils/storefront.js'

const homepageSource = await readFile(new URL('../app/pages/index.vue', import.meta.url), 'utf8')
const heroSource = await readFile(new URL('../app/components/cards/HeroCard.vue', import.meta.url), 'utf8')
const bannerSource = await readFile(new URL('../app/components/cards/Banner.vue', import.meta.url), 'utf8')

test('enabled banner ads have fixed home-page positions', () => {
  const storePicks = homepageSource.indexOf('title="Store picks"')
  const firstBanner = homepageSource.indexOf('bannerAds.bannerAd1')
  const moreProducts = homepageSource.indexOf('title="More products"')
  const secondBanner = homepageSource.indexOf('bannerAds.bannerAd2')

  assert.ok(storePicks >= 0 && firstBanner > storePicks)
  assert.ok(moreProducts > firstBanner && secondBanner > moreProducts)
  assert.equal(homepageSource.includes('categoryBannerTargets'), false)
  assert.equal(homepageSource.includes('getBannerBeforeCategory'), false)
})

test('store links accept only local and HTTP destinations', () => {
  assert.equal(getStoreLinkUrl('/search?category=keyboards'), '/search?category=keyboards')
  assert.equal(getStoreLinkUrl('https://example.test/deal'), 'https://example.test/deal')
  assert.equal(getStoreLinkUrl('javascript:alert(1)'), '')
  assert.equal(getStoreLinkUrl('//example.test/deal'), '')
  assert.equal(isExternalStoreLink('/search'), false)
  assert.equal(isExternalStoreLink('https://example.test'), true)
})

test('admin-configured banner images are honored even when they use a placeholder host', () => {
  const configuredImage = 'https://placehold.co/1400x520'

  assert.equal(getStoreImageUrl(configuredImage), '')
  assert.equal(getConfiguredStoreImageUrl(configuredImage), configuredImage)
  assert.equal(getConfiguredStoreImageUrl('javascript:alert(1)'), '')
})

test('hero and banner links use internal navigation and protect external links', () => {
  for (const source of [heroSource, bannerSource]) {
    assert.match(source, /resolveComponent\('NuxtLink'\)/)
    assert.match(source, /noopener noreferrer/)
    assert.match(source, /getStoreLinkUrl/)
  }
})
