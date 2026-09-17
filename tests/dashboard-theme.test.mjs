import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { normalizeDashboardLayout } from '../app/composables/useDashboardLayout.js'

const readProjectFile = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const dashboardLayout = readProjectFile('app/layouts/dashboard.vue')
const dashboardNavigation = readProjectFile('app/composables/useDashboardNavigation.js')
const dashboardStyles = readProjectFile('app/assets/css/dashboard.css')
const dashboardSidebar = readProjectFile('app/components/layout/dashboard/SideBar.vue')
const pageIntro = readProjectFile('app/components/dashboard/PageIntro.vue')
const settingsPage = readProjectFile('app/pages/dashboard/settings.vue')
const dashboardSettings = readProjectFile('app/utils/dashboardSettings.js')
const dashboardAppearanceEndpoint = readProjectFile('server/api/storefront/dashboard-appearance.get.js')

test('saved dashboard layout values remain backward compatible', () => {
  assert.equal(normalizeDashboardLayout('standard'), 'standard')
  assert.equal(normalizeDashboardLayout('detailed'), 'detailed')
  assert.equal(normalizeDashboardLayout('unknown'), 'standard')
  assert.match(settingsPage, /value: 'standard',[\s\S]*?label: 'Classic'/)
  assert.match(settingsPage, /value: 'detailed',[\s\S]*?label: 'Modern'/)
  assert.match(dashboardSettings, /label: 'Dashboard appearance'/)
  assert.match(dashboardAppearanceEndpoint, /select\('dashboard_layout'\)/)
  assert.doesNotMatch(dashboardAppearanceEndpoint, /defineCachedEventHandler/)
})

test('modern dashboard shell provides one compact route-aware page heading', () => {
  assert.match(dashboardLayout, /dashboard-modern-shell min-h-screen/)
  assert.equal((dashboardLayout.match(/<slot \/>/g) || []).length, 1)
  assert.match(dashboardLayout, /<h1 class="dashboard-modern-title">[\s\S]*?\{\{ pageTitle \}\}/)
  assert.match(dashboardLayout, /v-if="groupTitle"/)
  assert.match(dashboardNavigation, /dashboardSettingsSections\.find/)
  assert.match(dashboardLayout, /View store/)
  assert.match(dashboardStyles, /\.dashboard-modern-topbar/)
  assert.match(dashboardStyles, /prefers-reduced-motion/)
  assert.doesNotMatch(dashboardStyles, /\.bg-white\.shadow/)
  assert.match(dashboardLayout, /restoreFocus: true/)
  assert.match(dashboardLayout, /event\.key !== 'Tab'/)
})

test('modern sidebar stays permission-driven and clone friendly', () => {
  assert.match(dashboardSidebar, /navigationGroups/)
  assert.match(dashboardSidebar, /siteContent\.value\?\.settings\?\.site_name/)
  assert.match(dashboardSidebar, /getConfiguredStoreImageUrl/)
  assert.match(dashboardSidebar, /aria-current=/)
  assert.match(dashboardSidebar, /:global\(\[dir='rtl'\]\)/)
})

test('shared page intro preserves Classic headings and removes duplicate Modern headings', () => {
  assert.match(pageIntro, /dashboardLayout === 'standard'/)
  assert.match(pageIntro, /<h1 :class="titleClass">/)
  assert.match(pageIntro, /v-else-if="showActions && \$slots\.actions"/)

  for (const path of [
    'app/pages/dashboard/index.vue',
    'app/pages/dashboard/orders/index.vue',
    'app/pages/dashboard/products/index.vue',
    'app/pages/dashboard/settings.vue',
    'app/components/dashboard/catalog/CategoriesTab.vue',
    'app/components/dashboard/catalog/BrandsTab.vue',
    'app/components/dashboard/catalog/ReviewsTab.vue'
  ]) {
    assert.match(readProjectFile(path), /<DashboardPageIntro/, path)
  }

  for (const name of [
    'Procurement',
    'Sales',
    'Warehouses',
    'SerializedItems',
    'Returns',
    'Shipping',
    'ScanItem',
    'Crm'
  ]) {
    assert.match(
      readProjectFile(`app/components/dashboard/commerce/${name}Tab.vue`),
      /dashboard-page-summary-copy/,
      name
    )
  }

  assert.match(dashboardStyles, /\.dashboard-modern \.dashboard-page-summary-copy \{\s*display: none;/)
  assert.match(readProjectFile('app/pages/dashboard/documents.vue'), /documents-identity/)
  assert.match(dashboardStyles, /\.dashboard-modern \.documents-identity \{\s*display: none;/)
})
