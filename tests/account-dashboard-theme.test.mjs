import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createResetDatabase } from './helpers/resetDatabase.mjs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('customer account style defaults to Modern and accepts only Classic or Modern', async () => {
  const db = await createResetDatabase()
  try {
    await db.exec('begin')
    const row = (await db.query("insert into public.site_settings(key) values('account-style-test') returning account_dashboard_style")).rows[0]
    assert.equal(row.account_dashboard_style, 'modern')
    await db.exec("update public.site_settings set account_dashboard_style='classic' where key='account-style-test'")
    assert.equal((await db.query("select account_dashboard_style from public.site_settings where key='account-style-test'")).rows[0].account_dashboard_style, 'classic')
    await db.exec('savepoint invalid_style')
    await assert.rejects(() => db.exec("update public.site_settings set account_dashboard_style='unknown' where key='account-style-test'"))
    await db.exec('rollback to savepoint invalid_style')
    await db.exec('rollback')
  } finally { await db.close() }
})

test('admin setting switches only the customer account body and preserves Classic', () => {
  const settings = read('app/pages/dashboard/settings.vue')
  const sections = read('app/utils/dashboardSettings.js')
  const layout = read('app/layouts/account.vue')
  const overview = read('app/pages/account/index.vue')
  const navigation = read('app/components/account/Navigation.vue')
  const endpoint = read('server/api/storefront/account-appearance.get.js')

  assert.match(sections, /key: 'account-dashboard'.*section: 'accountDashboard'/)
  assert.match(settings, /value: 'classic', label: 'Classic'/)
  assert.match(settings, /value: 'modern', label: 'Modern'/)
  assert.match(settings, /saveSiteSettings\('accountDashboard'\)/)
  assert.match(layout, /<div v-if="isModern"/)
  assert.match(layout, /<div v-else class="min-h-screen bg-slate-50/)
  assert.match(overview, /<div v-if="isModern"/)
  assert.match(overview, /<div v-else class="space-y-5"/)
  assert.match(navigation, /variant === 'modern'/)
  assert.match(overview, /Purchase history/)
  assert.match(overview, /Account info/)
  assert.doesNotMatch(overview, /Payment methods|Subscriptions|Savings/)
  assert.match(endpoint, /select\('account_dashboard_style'\)/)
  assert.doesNotMatch(endpoint, /defineCachedEventHandler/)
})
