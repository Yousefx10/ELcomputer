import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDashboardNavigation, matchesDashboardNavigation, resolveDashboardActiveItem } from '../app/utils/dashboardNavigation.js'
import { dashboardSettingsSections } from '../app/utils/dashboardSettings.js'
import { commerceTabs } from '../app/utils/commerce.js'
import { getDashboardRouteRequirement, hasAdminPermission } from '../app/utils/adminPermissions.js'

const primarySettingsKeys = ['settings-overview', 'erp', 'gallery', 'coupons', 'logs', 'reset']

const routeFor = (to) => {
  const url = new URL(to, 'https://example.test')
  return { path: url.pathname, query: Object.fromEntries(url.searchParams) }
}

test('every submenu opens exactly one group and one active item', () => {
  const groups = buildDashboardNavigation()
  for (const group of groups) {
    for (const item of group.children) {
      const route = routeFor(item.to)
      assert.deepEqual(groups.filter(g => matchesDashboardNavigation(route, g.match)).map(g => g.key), [group.key], item.to)
      assert.deepEqual(group.children.filter(i => matchesDashboardNavigation(route, i.match)).map(i => i.key), [item.key], item.to)
    }
  }
})

test('existing links still select their correct section', () => {
  const groups = buildDashboardNavigation()
  for (const [to, key] of [
    ['/dashboard?view=analysis', 'dashboard'],
    ['/dashboard/orders/confirm', 'orders'],
    ['/dashboard/products/edit/example-id', 'products'],
    ['/dashboard/commerce?tab=serialized&product=example-id', 'inventory'],
    ['/dashboard/commerce?tab=shipping', 'shipping'],
    ['/dashboard/crm?tab=activities&panel=history&contact=example-id', 'crm'],
    ['/dashboard/settings?tab=gallery', 'settings'],
    ['/dashboard/settings?tab=coupons', 'settings']
  ]) assert.equal(groups.find(group => matchesDashboardNavigation(routeFor(to), group.match))?.key, key, to)
})

test('settings pages hidden from the sidebar do not mark another page as current', () => {
  const settingsGroup = buildDashboardNavigation().find(group => group.key === 'settings')
  const route = routeFor('/dashboard/settings?tab=hero')

  assert.equal(resolveDashboardActiveItem(route, settingsGroup).key, 'settings')
  assert.equal(resolveDashboardActiveItem(routeFor('/dashboard/settings'), settingsGroup).key, 'settings-overview')
})

test('commerce still accepts every tab after inventory and shipping move', () => {
  assert.deepEqual(commerceTabs.map(tab => tab.key).sort(), ['procurement', 'returns', 'sales', 'scan', 'serialized', 'shipping', 'warehouses'])
})

test('single-destination sections open directly instead of showing redundant menus', () => {
  const groups = buildDashboardNavigation()

  assert.equal(groups.find(group => group.key === 'purchasing').children.length, 0)
  assert.equal(groups.find(group => group.key === 'purchasing').to, '/dashboard/commerce')
  assert.equal(groups.find(group => group.key === 'shipping').children.length, 0)
  assert.equal(groups.find(group => group.key === 'shipping').to, '/dashboard/commerce?tab=shipping')
  assert.equal(groups.some(group => group.children.length === 1), false)
})

test('restricted admins only see permitted settings and destinations', () => {
  const user = { is_active: true, role: 'admin', permissions: { 'dashboard.view': true, 'settings.view': true, 'settings.coupons': true } }
  const access = { hasPermission: permission => hasAdminPermission(user, permission), hasAnyPermission: permissions => permissions.some(permission => hasAdminPermission(user, permission)) }
  const groups = buildDashboardNavigation(access)
  assert.equal(groups.some(g => ['orders', 'products', 'treasury', 'hr'].includes(g.key)), false)
  assert.deepEqual(groups.find(g => g.key === 'dashboard').children.map(i => i.key), ['summary'])
  for (const item of groups.flatMap(g => g.children)) {
    const requirement = getDashboardRouteRequirement(routeFor(item.to))
    if (requirement?.permission) assert.equal(access.hasPermission(requirement.permission), true, item.to)
    if (requirement?.permissionsAny) assert.equal(access.hasAnyPermission(requirement.permissionsAny), true, item.to)
  }
  const settings = groups.find(g => g.key === 'settings')
  assert.deepEqual(settings.children.map(item => item.key), primarySettingsKeys.filter(key => key !== 'reset'))
  assert.equal(settings.children.some(item => item.key === 'reset'), false)
  assert.equal(access.hasPermission('settings.edit'), false)
})

test('direct links to the new views retain access checks', () => {
  assert.deepEqual(getDashboardRouteRequirement(routeFor('/dashboard?view=customers')), { permission: 'dashboard.analysis' })
  assert.deepEqual(getDashboardRouteRequirement(routeFor('/dashboard?view=orders')), { permission: 'dashboard.orders' })
  assert.deepEqual(getDashboardRouteRequirement(routeFor('/dashboard?view=stock')), { permissionsAny: ['products.view', 'categories.view'] })
  assert.deepEqual(getDashboardRouteRequirement(routeFor('/dashboard/hr?tab=users&people=customers')), { permission: 'users.view' })
  assert.deepEqual(getDashboardRouteRequirement(routeFor('/dashboard/pages')), { permission: 'pages.view' })
  for (const section of dashboardSettingsSections) {
    assert.deepEqual(getDashboardRouteRequirement(routeFor(section.to)), section.role === 'owner' ? { role: 'owner' } : { permission: section.permission }, section.to)
  }
})

test('only owners see the system reset navigation entry', () => {
  assert.equal(buildDashboardNavigation({ isOwner: true }).find(group => group.key === 'settings').children.some(item => item.key === 'reset'), true)
  assert.equal(buildDashboardNavigation({ isOwner: false }).find(group => group.key === 'settings').children.some(item => item.key === 'reset'), false)
})

test('external ERP mode hides built-in ERP entry points', () => {
  const groups = buildDashboardNavigation({}, { externalErpActive: true })
  const groupKeys = groups.map(group => group.key)

  assert.equal(groupKeys.includes('daftra'), true)
  assert.equal(groupKeys.includes('treasury'), false)
  assert.equal(groupKeys.includes('purchasing'), false)
  assert.equal(groups.find(group => group.key === 'sales').label, 'Returns')
  assert.equal(groups.find(group => group.key === 'sales').to, '/dashboard/commerce?tab=returns')
  assert.deepEqual(groups.find(group => group.key === 'sales').children, [])
  assert.deepEqual(groups.find(group => group.key === 'inventory').children.map(item => item.key), ['serialized', 'scan'])
  assert.equal(groups.find(group => group.key === 'hr').children.some(item => item.key === 'employees'), false)
  assert.equal(groups.find(group => group.key === 'dashboard').children.some(item => item.key === 'stock-summary'), false)
})
