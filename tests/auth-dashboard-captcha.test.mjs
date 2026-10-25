import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parse } from '@vue/compiler-sfc'
import { ref, computed } from 'vue'
import { authErrorKey } from '../app/utils/authPage.js'
const source = parse(await readFile('app/pages/dashboard/login.vue', 'utf8')).descriptor.scriptSetup.content.replace(/^import .*\n/gm, '')
const factory = new Function('deps', `const {ref,computed,useUiLocale,useI18n,useRuntimeConfig,useColorMode,useUiNavigation,useSupabaseClient,useUiRoute,useAdminAccess,useAdminLogs,useHead,onMounted,authErrorKey}=deps;${source};return {login,captchaToken,captchaResetKey,errorKey,errorMessage};`)
function fixture({ provider = '', siteKey = '', admin = { is_active: true }, error = null } = {}) {
  const calls = [], events = [], state = factory({ ref, computed, authErrorKey,
    useUiLocale: () => ({ uiLabel: v => v }), useI18n: () => ({ locale: ref('en') }), useRuntimeConfig: () => ({ public: { authCaptchaProvider: provider, turnstileSiteKey: siteKey } }), useColorMode: () => ({ value: 'light' }),
    useUiNavigation: () => ({ uiNavigateTo: async path => events.push(path) }), useUiRoute: () => ({ query: {} }), useHead() {}, onMounted() {},
    useSupabaseClient: () => ({ auth: { signInWithPassword: async body => { calls.push(body); return { error } }, signOut: async () => events.push('signout') } }),
    useAdminAccess: () => ({ clearAdminAccess: () => events.push('clear'), loadAdminAccess: async force => { assert.equal(force, true); events.push('load-permissions'); return admin } }),
    useAdminLogs: () => ({ recordAdminLog: async () => events.push('audit') }) })
  return { state, calls, events }
}
test('Dashboard CAPTCHA cannot bypass the active-admin permission check', async () => {
  const f = fixture({ provider: 'turnstile', siteKey: 'synthetic', admin: null })
  await f.state.login(); assert.equal(f.calls.length, 0)
  f.state.captchaToken.value = 'synthetic-once'; await f.state.login()
  assert.equal(f.calls[0].options.captchaToken, 'synthetic-once'); assert.ok(f.events.includes('load-permissions')); assert.ok(f.events.includes('signout'))
  assert.equal(f.events.includes('/dashboard'), false); assert.equal(f.events.includes('audit'), false)
  assert.equal(f.state.captchaToken.value, ''); assert.equal(f.state.captchaResetKey.value, 1)
})
test('Dashboard default-off authentication preserves permission load, audit and navigation', async () => {
  const f = fixture(); await f.state.login(); assert.equal(f.calls.length, 1); assert.equal(f.calls[0].options, undefined)
  assert.deepEqual(f.events, ['clear', 'load-permissions', 'audit', '/dashboard'])
})
test('Dashboard bad CAPTCHA config or provider denial never loads permissions', async () => {
  const missing = fixture({ provider: 'turnstile' }); await missing.state.login(); assert.equal(missing.calls.length, 0); assert.equal(missing.state.errorKey.value, 'authPage.securityUnavailable')
  const denied = fixture({ provider: 'turnstile', siteKey: 'synthetic', error: { code: 'captcha_failed', message: 'PRIVATE' } })
  denied.state.captchaToken.value = 'denied'; await denied.state.login(); assert.equal(denied.state.errorKey.value, 'authPage.securityFailed')
  assert.equal(denied.events.includes('load-permissions'), false); assert.equal(denied.state.captchaToken.value, '')
})
