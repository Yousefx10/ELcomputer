import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createResetDatabase } from './helpers/resetDatabase.mjs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('footer style defaults to Classic and accepts only Classic or Modern', async () => {
  const db = await createResetDatabase()

  try {
    await db.exec('begin')
    const row = (await db.query("insert into public.site_settings(key) values('footer-style-test') returning footer_style, footer_modern_card_title, footer_modern_community_text")).rows[0]

    assert.equal(row.footer_style, 'classic')
    assert.equal(row.footer_modern_card_title, 'Need help choosing?')
    assert.equal(row.footer_modern_community_text, 'Join our Slack')

    await db.exec("update public.site_settings set footer_style='modern' where key='footer-style-test'")
    assert.equal((await db.query("select footer_style from public.site_settings where key='footer-style-test'")).rows[0].footer_style, 'modern')

    await db.exec('savepoint invalid_footer_style')
    await assert.rejects(() => db.exec("update public.site_settings set footer_style='unknown' where key='footer-style-test'"))
    await db.exec('rollback to savepoint invalid_footer_style')
    await db.exec('rollback')
  } finally {
    await db.close()
  }
})

test('modern footer uses saved footer links and exposes editable content', () => {
  const footer = read('app/components/layout/Footer.vue')
  const settings = read('app/pages/dashboard/settings.vue')
  const content = read('app/composables/useSiteContent.js')
  const uploads = read('server/utils/uploads.js')

  assert.match(footer, /v-if="isModern" class="store-footer-modern"/)
  assert.match(footer, /v-else class="store-footer"/)
  assert.match(footer, /siteContent\.value\?\.footerLinks/)
  assert.match(footer, /v-for="group in footerGroups"/)
  assert.match(footer, /footer_modern_card_image_url/)
  assert.match(footer, /footer_modern_community_image_url/)
  assert.match(footer, /footer_modern_banner_image_url/)
  assert.match(footer, /getStoreLinkUrl/)
  assert.match(footer, /noopener noreferrer/)

  assert.match(settings, /const footerStyleOptions =/)
  assert.match(settings, /value: 'classic', label: 'Classic'/)
  assert.match(settings, /value: 'modern', label: 'Modern'/)
  assert.match(settings, /saveSiteSettings\('footerSettings'\)/)
  assert.match(settings, /section="footer"/)
  assert.match(content, /footer_style: 'classic'/)
  assert.match(uploads, /footer:\s*\{[\s\S]*?directory: 'settings\/footer'/)
})

test('modern footer has separate tablet and phone layouts', () => {
  const styles = read('app/assets/css/storefront.css')

  assert.match(styles, /@media \(max-width: 1199px\)[\s\S]*?store-footer-modern-main/)
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?store-footer-modern-main \{ grid-template-columns: 1fr;/)
  assert.match(styles, /@media \(max-width: 639px\)[\s\S]*?store-footer-modern-card/)
  assert.match(styles, /store-footer-modern-groups \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
})
