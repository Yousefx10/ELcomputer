import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const readProjectFile = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const dashboardPage = readProjectFile('app/pages/dashboard/index.vue')
const summaryOverview = readProjectFile('app/components/dashboard/SummaryOverview.vue')
const summaryEndpoint = readProjectFile('server/api/admin-dashboard/summary.get.js')
const documentsPage = readProjectFile('app/pages/dashboard/documents.vue')
const documentStyles = readProjectFile('app/assets/css/dashboard-files.css')

test('business overview appears above the existing order and catalog summaries', () => {
  const overviewPosition = dashboardPage.indexOf('<DashboardSummaryOverview')
  const existingOrdersPosition = dashboardPage.indexOf('<section v-if="canSeeOrders && currentView !== \'stock\'">')

  assert.ok(overviewPosition > -1)
  assert.ok(existingOrdersPosition > overviewPosition)
  assert.match(summaryOverview, /Total Customers/)
  assert.match(summaryOverview, /Total Orders/)
  assert.match(summaryOverview, /Monthly Sales/)
  assert.match(summaryOverview, /Sales Growth/)
  assert.match(summaryOverview, /Sales performance/)
  assert.match(summaryOverview, /Order status/)
})

test('summary endpoint supplies permission-aware total order and customer counts', () => {
  assert.match(summaryEndpoint, /hasAdminPermission\(adminUser, 'users\.view'\)/)
  assert.match(summaryEndpoint, /\.from\('customer_profiles'\)/)
  assert.match(summaryEndpoint, /total: results\[11\]\.count \|\| 0/)
  assert.match(summaryEndpoint, /customers: results\[12\]\.count \|\| 0/)
})

test('document navigation and properties are collapsed by default', () => {
  assert.match(documentsPage, /const navigationOpen = ref\(false\)/)
  assert.match(documentsPage, /const detailsOpen = ref\(false\)/)
  assert.match(documentsPage, /<aside v-if="navigationOpen" id="documents-file-views"/)
  assert.match(documentsPage, /<aside v-if="detailsOpen && selectedItem" class="documents-details"/)
  assert.match(documentStyles, /\.documents-layout \{[^\n]*grid-template-columns: minmax\(0, 1fr\)/)
})

test('file and folder information opens only from item info controls', () => {
  const infoActions = documentsPage.match(/@click\.stop="openDetails\(item\)"/g) || []

  assert.ok(infoActions.length >= 2, 'quick cards and file rows should both expose info controls')
  assert.match(documentsPage, /const selectItem = \(item\) => \{[\s\S]*?detailsOpen\.value = false/)
  assert.match(documentsPage, /const openDetails = \(item\) => \{[\s\S]*?detailsOpen\.value = true/)
})
