// Public bundle and actual Setup Vue SSR privacy review. No hosted connections.
import assert from 'node:assert/strict'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { build } from 'esbuild'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createSSRApp, ref, computed, onMounted, watch, nextTick, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createI18n } from 'vue-i18n'
import { SETUP_CANARY } from '../tests/helpers/setupFixture.mjs'
let files = 0, bytes = 0, requests = 0, cases = 0
const visit = async dir => { for (const e of await readdir(dir, { withFileTypes: true })) {
  const path = join(dir, e.name)
  if (e.isDirectory()) await visit(path)
  else { const text = await readFile(path); files++; bytes += text.length
    for (const secret of [SETUP_CANARY, 'shippingCredentialsEncryptionKey', 'supabaseServiceRoleKey', 'api_key_encrypted']) assert.ok(!text.includes(secret), path + ' contains private metadata') }
} }
await visit('.output/public')
const { descriptor } = parse(await readFile('app/pages/dashboard/setup.vue', 'utf8'))
const compiled = await build({ stdin: { contents: compileScript(descriptor, { id: 'setup-ssr', inlineTemplate: true }).content, loader: 'js', resolveDir: resolve('app/pages/dashboard') }, bundle: true, write: false, format: 'esm', platform: 'node', alias: { '~': resolve('app') }, plugins: [{ name: 'shared-vue', setup(b) { b.onResolve({ filter: /^vue$/ }, () => ({ path: import.meta.resolve('vue'), external: true })) } }] })
const Setup = (await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'))).default
const messages = Object.fromEntries(await Promise.all(['en', 'ar'].map(async lang => [lang, JSON.parse(await readFile('i18n/locales/' + lang + '.json', 'utf8'))])))
const i18n = createI18n({ legacy: false, locale: 'en', messages }), isOwner = ref(true), isActiveAdmin = ref(true)
Object.assign(globalThis, { ref, computed, onMounted, watch, nextTick, definePageMeta: () => {}, useHead: () => {}, useI18n: () => i18n.global,
  useAdminAccess: () => ({ isOwner, isActiveAdmin }), useSupportClient: () => ({ request: () => { requests++; throw Error('SSR must not request private Setup data') } }) })
for (const language of ['en', 'ar']) for (const role of ['owner', 'admin', 'customer', 'inactive']) {
  i18n.global.locale.value = language; isOwner.value = role === 'owner' || role === 'inactive'; isActiveAdmin.value = role !== 'inactive'
  const app = createSSRApp(Setup); app.use(i18n); app.component('Icon', { props: ['name'], setup: () => () => h('span') }); app.component('NuxtLinkLocale', { props: ['to'], setup: (p, { slots }) => () => h('a', { href: p.to }, slots.default?.()) })
  const html = await renderToString(app); assert.ok(!html.includes(SETUP_CANARY)); assert.ok(!html.includes('quickSetup.')); assert.ok(!html.includes('data-setup-item')); cases++
}
assert.equal(requests, 0)
const report = { publicFiles: files, publicBytes: bytes, ssrCases: cases, privateSSRRequests: requests, secretsExposed: 0, productionAccess: false }
await writeFile('/private/tmp/quick-setup-artifact-report.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report))
