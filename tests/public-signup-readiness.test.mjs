import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parse } from '@vue/compiler-sfc'
import { ref, computed, reactive, watch, nextTick, effectScope } from 'vue'
import { authErrorKey, normalizeAuthImagePosition, normalizeAuthLayout, safeCustomerReturnPath } from '../app/utils/authPage.js'
import { localizedPath } from '../app/utils/appearance.js'

const source = parse(await readFile('app/pages/login.vue', 'utf8')).descriptor.scriptSetup.content
  .replace(/^import .*\n/gm, '').replaceAll('import.meta.client', 'true')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const factory = new AsyncFunction('deps', `const {ref,computed,watch,onMounted,useI18n,useSupabaseClient,useRuntimeConfig,useUiRoute,useSupabaseUser,useSiteContent,useUiNavigation,$fetch,window,sessionStorage,authErrorKey,normalizeAuthImagePosition,normalizeAuthLayout,safeCustomerReturnPath,localizedPath,getConfiguredStoreImageUrl}=deps;
${source}
return {signupAvailable,showReturningNotice,authMode,email,password,fullName,errorKey,successKey,submitAuthForm,changeMode};`)
const open = { disable_signup: false, mailer_autoconfirm: false, external: { email: true } }
async function fixture(t, { settings = open, flag = true, mode = 'login', locale = 'en', signUp, signIn } = {}) {
  const calls = [], mounts = [], route = reactive({ query: { mode } }), scope = effectScope()
  const auth = {
    signUp: async body => { calls.push({ kind: 'signup', body }); return signUp ? signUp(body) : { data: { session: null }, error: null } },
    signInWithPassword: async body => { calls.push({ kind: 'login', body }); return signIn ? signIn(body) : { error: { code: 'invalid_credentials' } } },
    resetPasswordForEmail: async (...args) => { calls.push({ kind: 'recovery', args }); return { error: null } }
  }
  const state = await scope.run(() => factory({
    ref, computed, watch, onMounted: fn => mounts.push(fn), useI18n: () => ({ locale: ref(locale), t: key => key }),
    useSupabaseClient: () => ({ auth, from: () => { throw Error('Unexpected identity lookup') } }),
    useRuntimeConfig: () => ({ public: { returningCustomerNoticeEnabled: flag, supabase: { url: 'https://auth.example.invalid', key: 'synthetic' } } }),
    useUiRoute: () => route, useSupabaseUser: () => ref(null), useSiteContent: async () => ({ data: ref({ settings: {} }) }),
    useUiNavigation: () => ({ uiNavigateTo: async target => { route.query = target.query } }),
    $fetch: async () => { if (settings === null) throw Error('Offline'); return settings },
    window: { location: { origin: 'https://independent-store.example.invalid' } }, sessionStorage: { getItem: () => null },
    authErrorKey, normalizeAuthImagePosition, normalizeAuthLayout, safeCustomerReturnPath, localizedPath, getConfiguredStoreImageUrl: () => ''
  }))
  t.after(() => scope.stop())
  mounts.forEach(fn => fn()); await new Promise(resolve => setImmediate(resolve))
  state.email.value = ' original@example.test '; state.password.value = 'Synthetic-password'; state.fullName.value = 'Synthetic Customer'
  return { state, calls, route }
}

test('closed, unknown or unsafe confirmation settings never dispatch signup', async t => {
  for (const settings of [null, {}, { ...open, disable_signup: true }, { ...open, mailer_autoconfirm: true }, { ...open, external: { email: false } }]) {
    const f = await fixture(t, { settings, mode: 'signup' })
    await f.state.submitAuthForm()
    assert.equal(f.state.showReturningNotice.value, false)
    assert.equal(f.state.errorKey.value, 'authPage.signupUnavailable')
    assert.deepEqual(f.calls, [])
  }
})

test('notice is opt-in per store, follows Auth availability and clears across modes', async t => {
  for (const flag of [undefined, false, 'false', 'yes', 1]) {
    const f = await fixture(t, { flag: flag === undefined ? null : flag })
    assert.equal(f.state.showReturningNotice.value, false)
  }
  for (const flag of [true, 'true']) {
    const f = await fixture(t, { flag })
    assert.equal(f.state.showReturningNotice.value, true)
    await f.state.changeMode('signup'); await nextTick()
    assert.equal(f.state.showReturningNotice.value, true); assert.equal(f.state.password.value, '')
    await f.state.changeMode('forgot'); await nextTick()
    assert.equal(f.state.showReturningNotice.value, false)
    await f.state.changeMode('recovery'); await nextTick()
    assert.equal(f.state.showReturningNotice.value, false)
  }
})

test('ordinary signup preserves original email, new password and EN/AR origin-based confirmation', async t => {
  for (const locale of ['en', 'ar']) {
    const f = await fixture(t, { mode: 'signup', locale })
    await f.state.submitAuthForm()
    assert.deepEqual(f.calls, [{ kind: 'signup', body: { email: 'original@example.test', password: 'Synthetic-password', options: {
      emailRedirectTo: `https://independent-store.example.invalid/${locale === 'ar' ? 'ar/' : ''}login`, data: { full_name: 'Synthetic Customer' }
    } } }])
    assert.equal(f.state.successKey.value, 'authPage.checkEmail'); assert.equal(f.state.password.value, '')
  }
})

test('existing-account signup gives the same next-step message without profile edits', async t => {
  const f = await fixture(t, { mode: 'signup', signUp: async () => ({ error: { code: 'user_already_exists', message: 'PRIVATE' } }) })
  await f.state.submitAuthForm()
  assert.equal(f.state.errorKey.value, ''); assert.equal(f.state.successKey.value, 'authPage.checkEmail')
  assert.equal(f.calls.length, 1); assert.equal(f.state.password.value, '')
})

test('failed login has identical generic results for unknown, historical and current identities', async t => {
  for (const code of ['invalid_credentials', 'email_not_confirmed', 'user_not_found', 'user_already_exists']) {
    const f = await fixture(t, { signIn: async () => ({ error: { code, message: 'PRIVATE PROVIDER DETAIL' } }) })
    await f.state.submitAuthForm()
    assert.equal(f.state.errorKey.value, 'authPage.invalidCredentials'); assert.equal(f.calls.length, 1)
    assert.equal(f.calls[0].kind, 'login')
  }
  assert.equal(authErrorKey({ code: 'over_request_rate_limit' }), 'authPage.rateLimited')
  assert.equal(authErrorKey({ code: 'over_email_send_rate_limit' }, 'signup'), 'authPage.rateLimited')
})

test('in-flight signup suppresses double submission and preserves provider rate denial', async t => {
  let release
  const response = new Promise(resolve => { release = resolve })
  const f = await fixture(t, { mode: 'signup', signUp: () => response })
  const first = f.state.submitAuthForm(); await f.state.submitAuthForm()
  assert.equal(f.calls.length, 1)
  release({ error: { code: 'over_email_send_rate_limit' } }); await first
  assert.equal(f.state.errorKey.value, 'authPage.rateLimited')
})

test('existing recovery keeps localized same-origin password-reset destinations', async t => {
  for (const locale of ['en', 'ar']) {
    const f = await fixture(t, { mode: 'forgot', locale }); await f.state.submitAuthForm()
    assert.deepEqual(f.calls[0], { kind: 'recovery', args: ['original@example.test', { redirectTo: `https://independent-store.example.invalid/${locale === 'ar' ? 'ar/' : ''}login?mode=recovery` }] })
    assert.equal(f.state.successKey.value, 'authPage.resetSent')
  }
})
