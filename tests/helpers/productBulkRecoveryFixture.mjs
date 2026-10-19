import assert from 'node:assert/strict'
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import { parse, compile } from '@vue/compiler-dom'

// Run the real composable, Vue lifecycle/reactivity and actual bulk toolbar.
// Only router registration, Auth, storage and transport are synthetic. No DB.
const root = fileURLToPath(new URL('../../', import.meta.url))
const compiled = await build({
  stdin: { contents: `export * from 'vue'; export { useProductBulk } from './app/composables/useProductBulk.js'`, resolveDir: root },
  bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
  alias: { '~': root + 'app' }, define: { 'process.env.NODE_ENV': '"test"',
    __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' },
  plugins: [{ name: 'router-registration-fixture', setup(builder) {
    builder.onResolve({ filter: /^vue-router$/ }, () => ({ path: 'router', namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents:
      `export const onBeforeRouteLeave=fn=>globalThis.__bulkRouteHooks.push(fn); export const onBeforeRouteUpdate=onBeforeRouteLeave;` }))
  } }],
})
const directory = await mkdtemp(join(tmpdir(), 'product-bulk-vue-fixture-'))
let Vue
try {
  const file = join(directory, 'fixture.mjs'); await writeFile(file, compiled.outputFiles[0].text)
  Vue = await import(pathToFileURL(file))
} finally { await rm(directory, { recursive: true, force: true }) }
const page = await readFile(new URL('../../app/pages/dashboard/products/index.vue', import.meta.url), 'utf8')
const template = page.slice(page.indexOf('<template>') + 10, page.lastIndexOf('</template>'))
const findToolbar = node => node.props?.some(prop => prop.name === 'data-bulk-controls') ? node : node.children?.map(findToolbar).find(Boolean)
const toolbar = findToolbar(parse(template))
assert.ok(toolbar, 'Actual Products bulk toolbar must exist')
const render = new Function('Vue', compile(toolbar.loc.source, { mode: 'function', prefixIdentifiers: true }).code)(Vue)
const errorExpression = page.match(/const bulkError = computed\(\(\) => (.+)\)/)?.[1]
assert.ok(errorExpression, 'Actual Products error mapping must exist')
const errorText = new Function('bulk', 't', `return ${errorExpression}`)
const locales = Object.fromEntries(await Promise.all(['en', 'ar'].map(async locale => [locale,
  JSON.parse(await readFile(new URL(`../../i18n/locales/${locale}.json`, import.meta.url), 'utf8'))])))

export const actors = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002']
export const product = { id: '00000000-0000-4000-8000-000000000003', revision: 4, title: 'Synthetic product' }
export const storageKey = actor => 'elcomputer:product-bulk:' + actor
export const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
export const receipt = (command, overrides = {}) => ({ request_id: command.request_id, operation: command.operation,
  replayed: true, succeeded: 1, unchanged: 0, conflicted: 0, failed: 0,
  items: [{ id: command.items[0].id, status: 'succeeded', reason: null, revision: 5 }], ...overrides })

const node = (tag, text = '') => ({ tag, tagName: tag.toUpperCase(), text, props: {}, children: [], parent: null,
  addEventListener(key, fn) { this.props['on:' + key] = fn }, removeEventListener(key) { delete this.props['on:' + key] },
  get options() { return this.children.filter(child => child.tag === 'option') } })
const remove = child => { if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1); child.parent = null }
const renderer = Vue.createRenderer({
  createElement: node, createText: text => node('#text', text), createComment: text => node('#comment', text),
  setText: (el, text) => { el.text = text }, setComment: (el, text) => { el.text = text },
  setElementText: (el, text) => { el.text = text; el.children = [] },
  patchProp: (el, key, previous, next) => { el.props[key] = next; if (key === 'value') el.value = next },
  insert: (child, parent, anchor = null) => { remove(child); child.parent = parent; parent.children.splice(anchor ? parent.children.indexOf(anchor) : parent.children.length, 0, child) },
  remove, parentNode: el => el.parent, nextSibling: el => el.parent?.children[el.parent.children.indexOf(el) + 1] || null,
})
const descendants = el => [el, ...el.children.flatMap(descendants)]
const textContent = el => el.tag === '#comment' ? '' : el.text + el.children.map(textContent).join(' ')

export function createBulkRecoveryFixture({ storage = new Map(), locale = 'en', actor = actors[0], transport = async () => { throw { statusCode: 405 } } } = {}) {
  const state = { storage, requests: [], invalidations: [], loads: 0, hooks: [], transport,
    failSet: () => false, failGet: () => false, failRemove: () => false,
    auth: async () => ({ authorization: 'Synthetic actor ' + state.adminUser.value.id }),
    load: async () => { state.loads++ } }
  state.adminUser = Vue.ref({ id: actor, role: 'owner', is_active: true, permissions: {} })
  state.canEdit = Vue.ref(true); state.result = Vue.ref({ items: [product] })
  state.loading = Vue.ref(false); state.context = Vue.ref('synthetic-page')
  state.listeners = new Map()
  globalThis.__bulkRouteHooks = state.hooks
  globalThis.window = { addEventListener: (key, fn) => state.listeners.set(key, fn), removeEventListener: key => state.listeners.delete(key) }
  globalThis.sessionStorage = {
    getItem: key => { if (state.failGet(key)) throw Error('Synthetic storage read failure'); return storage.get(key) ?? null },
    setItem: (key, value) => { if (state.failSet(key, value)) throw Error('Synthetic storage write failure'); storage.set(key, value) },
    removeItem: key => { if (state.failRemove(key)) throw Error('Synthetic storage remove failure'); storage.delete(key) },
  }
  globalThis.useAdminAccess = () => ({ adminUser: state.adminUser })
  globalThis.useAdminLogs = () => ({ getAdminAuthHeaders: () => state.auth() })
  globalThis.useDashboardCache = () => ({ invalidate: key => state.invalidations.push(key) })
  globalThis.$fetch = (path, options) => {
    assert.equal(path, '/api/admin-products/bulk', 'Only the synthetic batch transport is permitted')
    state.requests.push(JSON.parse(JSON.stringify({ path, ...options })))
    return state.transport(path, options)
  }
  state.t = (key, values = {}) => {
    let value = key.split('.').reduce((part, field) => part?.[field], locales[locale])
    assert.equal(typeof value, 'string', `Missing ${locale} translation: ${key}`)
    for (const [name, replacement] of Object.entries(values)) value = value.replaceAll('{' + name + '}', String(replacement))
    return value
  }
  state.root = node('root')
  state.app = renderer.createApp({
    components: { ListFilter: { render: () => Vue.h('span') }, NuxtLinkLocale: { render() { return Vue.h('a', this.$slots.default?.()) } } },
    setup() {
      state.bulk = Vue.useProductBulk({ result: state.result, loading: state.loading, context: state.context, canEdit: state.canEdit, load: () => state.load() })
      const bulk = Vue.reactive(state.bulk)
      return { bulk, bulkLocked: Vue.computed(() => bulk.locked), loading: state.loading, canEdit: state.canEdit, canExport: true,
        bulkError: Vue.computed(() => errorText(bulk, state.t)), confirmation: 'Synthetic confirmation',
        result: state.result, editorLink: id => id, itemResult: item => item.status }
    }, render,
  })
  // $t normally comes from Nuxt i18n; register it on the actual component proxy.
  state.app.config.globalProperties.$t = state.t
  state.app.mount(state.root)
  state.flush = () => Vue.nextTick()
  state.text = () => textContent(state.root)
  state.buttons = () => descendants(state.root).filter(el => el.tag === 'button')
  state.hasButton = key => state.buttons().some(el => textContent(el) === state.t(key))
  state.submit = async (operation = 'draft', reference = null) => {
    state.bulk.toggle(product); state.bulk.operation.value = operation
    if (reference) { state.bulk.reference.value = reference; state.bulk.choice({ id: reference, name: 'Synthetic reference' }) }
    state.bulk.review(); await state.bulk.confirm(); await state.flush()
    return state.bulk.pending.value
  }
  state.unmount = () => state.app.unmount()
  return state
}
