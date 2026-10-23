import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { parse } from '@vue/compiler-sfc'
import { ref, reactive, computed, watch, nextTick } from 'vue'

// Execute the shipped SFC scripts with real Vue reactivity and deferred Data API
// responses. No hosted sessions, credentials, database writes or email requests.
const require = createRequire(import.meta.url)
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); await nextTick() }
const factories = new Map()
for (const [name, path, exposed] of [
  ['profile', 'app/pages/account/profile.vue', 'form, loading, saving, error, notice, save'],
  ['layout', 'app/layouts/account.vue', 'profile, displayName']
]) {
  const script = parse(await readFile(path, 'utf8')).descriptor.scriptSetup.content
  const imports = script.match(/^import .*$/gm).join('\n')
  const source = `${imports}\nexport default async function(deps) {
    const {ref, reactive, computed, watch, onMounted, onBeforeUnmount,
      useUiLocale, useUiNavigation, useUiRoute, useAccountAppearance,
      useSupabaseClient, useSupabaseUser, definePageMeta, useHead, window} = deps;
    ${script.replace(/^import .*$/gm, '')}
    return {${exposed}};
  }`
  const bundle = await build({ stdin: { contents: source, resolveDir: resolve('.'), loader: 'js' },
    bundle: true, write: false, platform: 'node', format: 'cjs', alias: { '~': resolve('app') } })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(require, module, module.exports)
  factories.set(name, module.exports.default)
}

const fixture = async (kind = 'profile') => {
  const user = ref({ sub: 'alice', email: 'alice@example.invalid' })
  const reads = [], writes = [], mounted = [], dispose = [], events = []
  const supabase = {
    auth: { getUser: async () => ({ data: { user: user.value && { ...user.value, id: user.value.sub } } }) },
    from: table => {
      assert.equal(table, 'customer_profiles')
      return {
        select: () => ({ eq: (column, id) => {
          assert.equal(column, 'id')
          return { maybeSingle: () => ({ abortSignal: () => {
            const response = deferred(); reads.push({ id, ...response }); return response.promise
          } }) }
        } }),
        upsert: values => ({ abortSignal: () => {
          const response = deferred(); writes.push({ values, ...response }); return response.promise
        } })
      }
    }
  }
  const state = await factories.get(kind)({ ref, reactive, computed,
    watch: (...args) => { const stop = watch(...args); dispose.push(stop); return stop },
    onMounted: callback => mounted.push(callback), onBeforeUnmount: callback => dispose.push(callback),
    useUiLocale: () => ({ uiLabel: value => value }), useUiNavigation: () => ({ uiNavigateTo: () => {} }),
    useUiRoute: () => ({ path: '/account/profile' }), useAccountAppearance: () => ({ data: ref({}) }),
    useSupabaseClient: () => supabase, useSupabaseUser: () => user,
    definePageMeta: () => {}, useHead: () => {},
    window: { dispatchEvent: event => events.push(event.type), addEventListener: () => {}, removeEventListener: () => {} }
  })
  for (const callback of mounted) callback()
  await settle()
  return { user, state, reads, writes, events, dispose: () => dispose.forEach(callback => callback()) }
}
const alice = { full_name: 'Alice', phone: '01000000001', address_line_1: 'Alice private street', city: 'Alice city' }
const bob = { full_name: 'Bob', phone: '01000000002', address_line_1: 'Bob private street', city: 'Bob city' }

test('switching accounts clears private drafts immediately and a failed load cannot save them', async t => {
  const f = await fixture(); t.after(f.dispose)
  f.reads[0].resolve({ data: alice }); await settle()
  assert.equal(f.state.form.address_line_1, alice.address_line_1)
  f.state.form.phone = 'Alice unsaved phone'
  f.user.value = { sub: 'bob', email: 'bob@example.invalid' }
  assert.ok(Object.values(f.state.form).every(value => value === ''))
  await settle(); assert.equal(f.reads[1].id, 'bob')
  f.reads[1].resolve({ error: new Error('Synthetic read failure') }); await settle()
  assert.ok(f.state.error.value)
  assert.equal(f.state.loading.value, false)
  await f.state.save()
  assert.equal(f.writes.length, 0)
})

test('late account loads cannot restore another customer address', async t => {
  const f = await fixture(); t.after(f.dispose)
  f.user.value = { sub: 'bob' }; await settle()
  f.reads[1].resolve({ data: bob }); await settle()
  f.reads[0].resolve({ data: alice }); await settle()
  assert.equal(f.state.form.address_line_1, bob.address_line_1)
  f.user.value = null
  assert.ok(Object.values(f.state.form).every(value => value === ''))
  await settle(); await f.state.save()
  assert.equal(f.writes.length, 0)
})

test('a queued save cannot copy the old draft into a newly authenticated account', async t => {
  const f = await fixture(); t.after(f.dispose)
  f.reads[0].resolve({ data: alice }); await settle()
  const pending = f.state.save()
  f.user.value = { sub: 'bob' }
  await pending; await settle()
  assert.equal(f.writes.length, 0)
})

test('late save acknowledgements cannot announce success or disturb the next customer save', async t => {
  const f = await fixture(); t.after(f.dispose)
  f.reads[0].resolve({ data: alice }); await settle()
  const first = f.state.save(); await settle()
  assert.equal(f.writes[0].values.id, 'alice')
  f.user.value = { sub: 'bob', email: 'bob@example.invalid' }; await settle()
  f.reads[1].resolve({ data: bob }); await settle()
  f.state.form.phone = ' 01000000003 '
  const second = f.state.save(); await settle()
  f.writes[0].resolve({}); await first
  assert.equal(f.state.notice.value, '')
  assert.equal(f.state.saving.value, true)
  assert.deepEqual(f.events, [])
  assert.equal(f.writes[1].values.id, 'bob')
  assert.equal(f.writes[1].values.phone, '01000000003')
  assert.equal(f.writes[1].values.address_line_1, bob.address_line_1)
  f.writes[1].resolve({}); await second
  assert.equal(f.state.notice.value, 'Profile saved.')
  assert.deepEqual(f.events, ['account:profile-updated'])
})

test('account header clears immediately and ignores late identity responses', async t => {
  const f = await fixture('layout'); t.after(f.dispose)
  f.reads[0].resolve({ data: alice }); await settle()
  assert.equal(f.state.displayName.value, 'Alice')
  f.user.value = { sub: 'bob', email: 'bob@example.invalid' }
  assert.equal(f.state.profile.value, null)
  await settle()
  f.user.value = { sub: 'carol', email: 'carol@example.invalid' }; await settle()
  f.reads[2].resolve({ data: { full_name: 'Carol' } }); await settle()
  f.reads[1].resolve({ data: bob }); await settle()
  assert.equal(f.state.displayName.value, 'Carol')
  f.user.value = null
  assert.equal(f.state.profile.value, null)
})
