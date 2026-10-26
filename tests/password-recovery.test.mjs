import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createBrowserClient } from '@supabase/ssr'
import { createPasswordRecovery } from '../app/utils/passwordRecovery.js'
import { authErrorKey } from '../app/utils/authPage.js'

const proof = 'pkce_' + 'a'.repeat(64)
const href = (prefix = '') => `https://independent-shop.example.invalid${prefix}/login?mode=recovery#token_hash=${proof}&type=recovery`
function fake(options = {}) {
  const id = randomUUID(), calls = [], user = { id, is_anonymous: false }
  let current = user
  const auth = {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    verifyOtp: async body => { calls.push(['verify', body.type]); return options.expired
      ? { error: { code: 'otp_expired' } } : { data: { user, session: { user } }, error: null } },
    getSession: async () => ({ data: { session: { user: current } } }),
    getClaims: async () => ({ data: { claims: { sub: current.id, amr: [{ method: options.legacy ? 'recovery' : 'password' }] } } }),
    updateUser: async () => { calls.push(['update', current.id]); return { error: null } }
  }
  return { auth, calls, user, setCurrent: u => { current = u } }
}
test('page load scrubs the hash and does not redeem a scanner-prefetched link', () => {
  const f = fake(), paths = []
  const recovery = createPasswordRecovery({ auth: f.auth, href: href(), replaceUrl: p => paths.push(p) })
  assert.deepEqual(f.calls, [])
  assert.deepEqual(paths, ['/login?mode=recovery'])
  assert.ok(!JSON.stringify(recovery).includes(proof))
  recovery.dispose()
})
test('ordinary login and signup URLs are untouched', () => {
  for (const url of ['https://other.example.invalid/login?code=oauth', 'https://other.example.invalid/login?mode=signup#other']) {
    const f = fake()
    assert.equal(createPasswordRecovery({ auth: f.auth, href: url, replaceUrl: () => assert.fail() }), null)
    assert.deepEqual(f.calls, [])
  }
})
test('legacy unresolved PKCE or redirect errors cannot update an unrelated existing session', async () => {
  for (const suffix of ['&code=unredeemed', '#error=access_denied&error_code=otp_expired', '#access_token=unprocessed&refresh_token=unprocessed']) {
    const f = fake(), recovery = createPasswordRecovery({ auth: f.auth, href: 'https://other.example.invalid/login?mode=recovery' + suffix, replaceUrl() {} })
    await assert.rejects(recovery.updatePassword('Synthetic-password-1'), { code: 'recovery_proof_required' })
    assert.deepEqual(f.calls, [])
    recovery.dispose()
  }
})
test('an ordinary password session alone is not recovery proof', async () => {
  const f = fake(), recovery = createPasswordRecovery({ auth: f.auth, href: 'https://other.example.invalid/login?mode=recovery', replaceUrl() {} })
  await assert.rejects(recovery.updatePassword('Synthetic-password-1'), { code: 'recovery_proof_required' })
  assert.deepEqual(f.calls, [])
  recovery.dispose()
})
test('legacy verified recovery claims retain the existing PKCE path', async () => {
  const f = fake({ legacy: true }), recovery = createPasswordRecovery({ auth: f.auth, href: 'https://other.example.invalid/ar/login?mode=recovery', replaceUrl() {} })
  await recovery.updatePassword('Synthetic-password-1')
  assert.deepEqual(f.calls, [['update', f.user.id]])
  recovery.dispose()
})
test('an expired hash cannot fall back to an existing session or retry verification', async () => {
  const f = fake({ expired: true }), recovery = createPasswordRecovery({ auth: f.auth, href: href(), replaceUrl() {} })
  await assert.rejects(recovery.updatePassword('Synthetic-password-1'), { code: 'otp_expired' })
  await assert.rejects(recovery.updatePassword('Synthetic-password-1'), { code: 'recovery_proof_required' })
  assert.deepEqual(f.calls, [['verify', 'recovery']])
  recovery.dispose()
})
test('account changes between verification and update fail closed', async () => {
  const f = fake(), recovery = createPasswordRecovery({ auth: f.auth, href: href(), replaceUrl() {} })
  f.setCurrent({ id: randomUUID(), is_anonymous: false })
  await assert.rejects(recovery.updatePassword('Synthetic-password-1'), { code: 'recovery_proof_required' })
  assert.deepEqual(f.calls, [['verify', 'recovery']])
  recovery.dispose()
})
test('weak-password correction retains the verified user without re-consuming the hash', async () => {
  const f = fake(), recovery = createPasswordRecovery({ auth: f.auth, href: href(), replaceUrl() {} })
  let updates = 0
  f.auth.updateUser = async () => (++updates === 1 ? { error: { code: 'weak_password' } } : { error: null })
  await assert.rejects(recovery.updatePassword('weak'), { code: 'weak_password' })
  await recovery.updatePassword('Synthetic-password-1')
  assert.deepEqual(f.calls, [['verify', 'recovery']]); assert.equal(updates, 2)
  recovery.dispose()
})
test('wrong or duplicate recovery proof types are rejected without transport', async () => {
  for (const fragment of [`token_hash=${proof}&type=signup`, `token_hash=${proof}&type=recovery&type=recovery`, `token_hash=${proof}&token_hash=${proof}&type=recovery`, 'token_hash=short&type=recovery']) {
    const f = fake(), recovery = createPasswordRecovery({ auth: f.auth, href: 'https://other.example.invalid/login?mode=recovery#' + fragment, replaceUrl() {} })
    await assert.rejects(recovery.updatePassword('Synthetic-password-1'))
    assert.deepEqual(f.calls, []); recovery.dispose()
  }
})
test('recovery errors use fixed translations, never provider payloads', () => {
  assert.equal(authErrorKey({ code: 'otp_expired', message: proof }, 'recovery'), 'authPage.recoveryExpired')
  assert.equal(authErrorKey({ code: 'weak_password' }, 'recovery'), 'authPage.weakPassword')
})

for (const prefix of ['', '/ar']) test(`installed SDK redeems an email hash in a fresh ${prefix || 'EN'} browser without a PKCE verifier`, async t => {
  const previous = Object.fromEntries(['window', 'document', 'history', 'BroadcastChannel'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
  const location = new URL(href(prefix)), history = { state: {}, replaceState: (_s, _t, p) => { location.href = new URL(p, location).href } }
  const document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} }
  const window = { location, history, document, addEventListener() {}, removeEventListener() {} }
  for (const [key, value] of Object.entries({ window, document, history, BroadcastChannel: undefined })) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true })
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key] } })
  const user = { id: randomUUID(), email: 'fixture@example.invalid', email_confirmed_at: '2026-01-01T00:00:00Z', aud: 'authenticated', role: 'authenticated', is_anonymous: false, user_metadata: {} }
  const token = [{ alg: 'HS256', typ: 'JWT' }, { sub: user.id, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }].map(v => Buffer.from(JSON.stringify(v)).toString('base64url')).concat('Zml4dHVyZQ').join('.')
  const calls = [], cookies = new Map()
  const sdk = createBrowserClient('https://auth-fixture.example.invalid', 'fixture-public-key', {
    isSingleton: false, cookieOptions: { name: 'fixture-' + randomUUID() }, auth: { autoRefreshToken: false },
    cookies: { getAll: () => [...cookies].map(([name, value]) => ({ name, value })), setAll: rows => { for (const r of rows) { if (r.value) cookies.set(r.name, r.value); else cookies.delete(r.name) } } },
    global: { fetch: async (input, options = {}) => {
      const url = new URL(String(input)); assert.equal(url.origin, 'https://auth-fixture.example.invalid')
      const method = options.method || 'GET'; calls.push([method, url.pathname])
      if (url.pathname === '/auth/v1/verify') {
        assert.deepEqual(JSON.parse(options.body), { type: 'recovery', token_hash: proof, gotrue_meta_security: {} })
        return Response.json({ access_token: token, refresh_token: 'synthetic-refresh', expires_in: 3600, token_type: 'bearer', user })
      }
      if (url.pathname === '/auth/v1/user') return Response.json(user)
      throw Error('Unexpected fixture request')
    } }
  })
  t.after(async () => { await sdk.auth.stopAutoRefresh(); sdk.auth.broadcastChannel?.close() })
  await sdk.auth.getSession()
  assert.deepEqual(calls, []); assert.ok(![...cookies.keys()].some(k => k.includes('code-verifier')))
  const recovery = createPasswordRecovery({ auth: sdk.auth, href: location.href, replaceUrl: p => history.replaceState({}, '', p) })
  assert.equal(location.hash, ''); assert.deepEqual(calls, [])
  await recovery.updatePassword('Synthetic-fixture-password-1')
  assert.equal(calls.filter(([m, p]) => m === 'POST' && p === '/auth/v1/verify').length, 1)
  assert.equal(calls.filter(([m, p]) => m === 'PUT' && p === '/auth/v1/user').length, 1)
  assert.equal(calls.filter(([, p]) => p === '/auth/v1/token').length, 0)
  assert.equal((await sdk.auth.getSession()).data.session.user.id, user.id)
  recovery.dispose()
})

// Wire the actual customer SFC to the recovery controller. This compares the
// deployed defect and fix entirely inside a synthetic transport.
async function formFactory(script) {
  const {build}=await import('esbuild'),{resolve}=await import('node:path'),{createRequire}=await import('node:module')
  const imports=(script.match(/^import .*$/gm)||[]).join('\n')
  const code=imports+`\nexport default async function(deps){
    const {ref,computed,watch,onMounted,onScopeDispose,useUiNavigation,useI18n,useSupabaseClient,useRuntimeConfig,useColorMode,useUiRoute,useSupabaseUser,useSiteContent,window,sessionStorage,$fetch}=deps;
    ${script.replace(/^import .*$/gm,'')}
    return {authMode,password,submitAuthForm,errorKey,successKey};
  }`
  const built=await build({stdin:{contents:code,resolveDir:resolve('.'),loader:'js'},bundle:true,write:false,platform:'node',format:'cjs',alias:{'~':resolve('app')},define:{'import.meta.client':'true','import.meta.server':'false'}})
  const mod={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);return mod.exports.default
}
async function recoveryForm(t,factory,locale,url,f) {
  const {ref,computed,watch}=await import('vue'),stops=[],location=new URL(url),history={state:{},replaceState:(_a,_b,p)=>{location.href=new URL(p,location).href}}
  f.auth.signOut=async()=>{f.calls.push(['logout']);return {error:null}}
  const page=await factory({ref,computed,watch:(...args)=>{const stop=watch(...args);stops.push(stop);return stop},onMounted(){},onScopeDispose:fn=>stops.push(fn),
    useUiNavigation:()=>({uiNavigateTo:async()=>assert.fail('Recovery must stay on its form')}),useI18n:()=>({locale:ref(locale),t:k=>k}),useSupabaseClient:()=>({auth:f.auth}),useRuntimeConfig:()=>({public:{authCaptchaProvider:'turnstile',turnstileSiteKey:'fixture-public-site-key'}}),useColorMode:()=>({value:'light'}),
    useUiRoute:()=>({query:{mode:'recovery',...(location.searchParams.has('code')?{code:'fixture-unredeemed'}:{})}}),useSupabaseUser:()=>ref(null),useSiteContent:async()=>({data:ref({settings:{}})}),window:{location,history},sessionStorage:{getItem:()=>null,removeItem(){}},$fetch:async()=>({})})
  t.after(()=>stops.forEach(stop=>stop()));return page
}
let currentForm
for(const locale of ['en','ar'])test(`actual ${locale} form verifies once on user submit, clears the password and signs out`,async t=>{
  const {readFile}=await import('node:fs/promises'),{parse}=await import('@vue/compiler-sfc')
  currentForm ||= await formFactory(parse(await readFile('app/pages/login.vue','utf8')).descriptor.scriptSetup.content)
  const f=fake(),page=await recoveryForm(t,currentForm,locale,href(locale==='ar'?'/ar':''),f)
  assert.deepEqual(f.calls,[]);page.password.value='Synthetic-fixture-password-1';await page.submitAuthForm()
  assert.deepEqual(f.calls,[['verify','recovery'],['update',f.user.id],['logout']]);assert.equal(page.password.value,'');assert.equal(page.successKey.value,'authPage.passwordUpdated')
})
test('actual deployed recovery form updates an unrelated session after unresolved PKCE; corrected form refuses',async t=>{
  const {execFileSync}=await import('node:child_process'),{parse}=await import('@vue/compiler-sfc')
  const original=execFileSync('git',['show','b37be43ac6a24a663a12a5a56aaaa7e801827963:app/pages/login.vue'],{encoding:'utf8'})
  const oldFactory=await formFactory(parse(original).descriptor.scriptSetup.content),url='https://independent-shop.example.invalid/login?mode=recovery&code=unredeemed'
  const old=fake(),before=await recoveryForm(t,oldFactory,'en',url,old);before.password.value='Synthetic-fixture-password-1';await before.submitAuthForm();assert.deepEqual(old.calls,[['update',old.user.id],['logout']])
  const fixed=fake(),after=await recoveryForm(t,currentForm,'en',url,fixed);after.password.value='Synthetic-fixture-password-1';await after.submitAuthForm();assert.deepEqual(fixed.calls,[]);assert.equal(after.errorKey.value,'authPage.recoveryExpired')
})
