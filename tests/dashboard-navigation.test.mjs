import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDashboardNavigation, matchesDashboardNavigation } from '../app/utils/dashboardNavigation.js'
import { dashboardSettingsSections } from '../app/utils/dashboardSettings.js'
import { commerceTabs } from '../app/utils/commerce.js'
import { getDashboardRouteRequirement, hasAdminPermission } from '../app/utils/adminPermissions.js'

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

test('commerce still accepts every tab after inventory and shipping move', () => {
  assert.deepEqual(commerceTabs.map(tab => tab.key).sort(), ['procurement', 'returns', 'sales', 'scan', 'serialized', 'shipping', 'warehouses'])
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
  assert.equal(settings.children.length, dashboardSettingsSections.filter(section => section.role !== 'owner').length + 1)
  assert.equal(settings.children.some(item => item.key === 'reset'), false)
  assert.equal(access.hasPermission('settings.edit'), false)
})

test('direct links to the new views retain access checks', () => {
  assert.deepEqual(getDashboardRouteRequirement(routeFor('/dashboard?view=customers')), { permission: 'dashboard.analysis' })
  assert.deepEqual(getDashboardRouteRequirement(routeFor('/dashboard?view=orders')), { permission: 'dashboard.orders' })
  assert.deepEqual(getDashboardRouteRequirement(routeFor('/dashboard?view=stock')), { permissionsAny: ['products.view', 'categories.view'] })
  assert.deepEqual(getDashboardRouteRequirement(routeFor('/dashboard/hr?tab=users&people=customers')), { permission: 'users.view' })
  for (const section of dashboardSettingsSections) {
    assert.deepEqual(getDashboardRouteRequirement(routeFor(section.to)), section.role === 'owner' ? { role: 'owner' } : { permission: section.permission }, section.to)
  }
})

test('only owners see the system reset navigation entry', () => {
  assert.equal(buildDashboardNavigation({ isOwner: true }).find(group => group.key === 'settings').children.some(item => item.key === 'reset'), true)
  assert.equal(buildDashboardNavigation({ isOwner: false }).find(group => group.key === 'settings').children.some(item => item.key === 'reset'), false)
})
