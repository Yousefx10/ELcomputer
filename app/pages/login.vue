<script setup>
import { authErrorKey, normalizeAuthImagePosition, normalizeAuthLayout, safeCustomerReturnPath } from '~/utils/authPage'
import { localizedPath } from '~/utils/appearance'
import { getConfiguredStoreImageUrl } from '~/utils/storefront'

const { uiNavigateTo } = useUiNavigation()
const { locale, t } = useI18n()
const supabase = useSupabaseClient()
const route = useUiRoute()
const user = useSupabaseUser()
const { data: siteContent } = await useSiteContent()
const settings = computed(() => siteContent.value?.settings || {})
const layout = computed(() => normalizeAuthLayout(settings.value.auth_page_layout))
const position = computed(() => normalizeAuthImagePosition(settings.value.auth_image_position))
const lightImage = computed(() => getConfiguredStoreImageUrl(settings.value.auth_image_light_url))
const darkImage = computed(() => getConfiguredStoreImageUrl(settings.value.auth_image_dark_url) || lightImage.value)
const failedImages = ref(new Set())
const usableLightImage = computed(() => lightImage.value && !failedImages.value.has(lightImage.value) ? lightImage.value : '')
const usableDarkImage = computed(() => darkImage.value && !failedImages.value.has(darkImage.value) ? darkImage.value : usableLightImage.value)
const imagePosition = computed(() => ({ objectPosition: position.value }))
const markImageFailed = url => { failedImages.value = new Set([...failedImages.value, url]) }
const showFacebook = computed(() => settings.value.auth_facebook_enabled === true)
const authMode = ref(['signup', 'forgot', 'recovery'].includes(route.query.mode) ? route.query.mode : 'login')
const fullName = ref('')
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const oauthLoading = ref('')
const finishing = ref(false)
const errorKey = ref('')
const successKey = ref('')
const emailError = ref(false)
const passwordError = ref(false)
const postAuthPath = computed(() => safeCustomerReturnPath(
  route.query.redirect || (import.meta.client && route.query.oauth === 'callback' ? sessionStorage.getItem('elcomputer-auth-return') : '')
))
const busy = computed(() => loading.value || !!oauthLoading.value || finishing.value)
const heading = computed(() => authMode.value === 'signup'
  ? (settings.value.auth_signup_heading || t('authPage.defaultSignupHeading'))
  : (settings.value.auth_login_heading || t('authPage.defaultLoginHeading')))
const supporting = computed(() => authMode.value === 'signup'
  ? (settings.value.auth_signup_supporting_text || t('authPage.defaultSignupSupporting'))
  : (settings.value.auth_login_supporting_text || t('authPage.defaultLoginSupporting')))

watch(() => route.query.mode, value => {
  authMode.value = ['signup', 'forgot', 'recovery'].includes(value) ? value : 'login'
  errorKey.value = ''
  successKey.value = ''
  password.value = ''
  showPassword.value = false
})
const changeMode = mode => {
  errorKey.value = ''
  successKey.value = ''
  emailError.value = false
  passwordError.value = false
  uiNavigateTo({ path: '/login', query: { ...(mode === 'login' ? {} : { mode }), redirect: postAuthPath.value } })
}
const completeSignIn = async () => {
  if (finishing.value || authMode.value === 'recovery') return
  finishing.value = true
  try {
    const { data, error: userError } = await supabase.auth.getUser()
    if (userError || !data?.user || data.user.is_anonymous) return
    const currentUser = data.user
    const { data: profile, error: profileError } = await supabase.from('customer_profiles').select('id, is_active, email, full_name, avatar_url').eq('id', currentUser.id).maybeSingle()
    if (profileError) throw profileError
    if (profile?.is_active === false) {
      await supabase.auth.signOut()
      errorKey.value = 'authPage.accountDisabled'
      return
    }
    if (!profile) {
      if (!currentUser.email) {
        await supabase.auth.signOut()
        errorKey.value = 'authPage.emailRequired'
        return
      }
      const { error: insertError } = await supabase.from('customer_profiles').insert({
        id: currentUser.id,
        email: currentUser.email,
        full_name: fullName.value.trim() || currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'Customer',
        avatar_url: currentUser.user_metadata?.avatar_url || null
      })
      if (insertError) throw insertError
    } else {
      const updates = {}
      if (currentUser.email && profile.email !== currentUser.email) updates.email = currentUser.email
      if (!profile.full_name && currentUser.user_metadata?.full_name) updates.full_name = currentUser.user_metadata.full_name
      if (!profile.avatar_url && currentUser.user_metadata?.avatar_url) updates.avatar_url = currentUser.user_metadata.avatar_url
      if (Object.keys(updates).length) {
        const { error: updateError } = await supabase.from('customer_profiles').update(updates).eq('id', currentUser.id)
        if (updateError) throw updateError
      }
    }
    const destination = postAuthPath.value
    if (import.meta.client) sessionStorage.removeItem('elcomputer-auth-return')
    await uiNavigateTo(destination, { replace: true })
  } catch (error) {
    errorKey.value = authErrorKey(error)
  } finally {
    finishing.value = false
  }
}
const submitAuthForm = async () => {
  if (busy.value) return
  loading.value = true
  errorKey.value = ''
  successKey.value = ''
  emailError.value = false
  passwordError.value = false
  try {
    if (authMode.value === 'forgot') {
      const redirectTo = `${window.location.origin}${localizedPath('/login?mode=recovery', locale.value)}`
      const { error } = await supabase.auth.resetPasswordForEmail(email.value.trim(), { redirectTo })
      if (error) throw error
      successKey.value = 'authPage.resetSent'
      return
    }
    if (authMode.value === 'recovery') {
      const { data } = await supabase.auth.getSession()
      if (!data.session) { errorKey.value = 'authPage.recoveryExpired'; return }
      const { error } = await supabase.auth.updateUser({ password: password.value })
      if (error) throw error
      password.value = ''
      successKey.value = 'authPage.passwordUpdated'
      await supabase.auth.signOut()
      return
    }
    if (authMode.value === 'signup') {
      const emailRedirectTo = `${window.location.origin}${localizedPath('/login', locale.value)}`
      const { data, error } = await supabase.auth.signUp({
        email: email.value.trim(), password: password.value,
        options: { emailRedirectTo, data: { full_name: fullName.value.trim() || undefined } }
      })
      if (error) throw error
      if (data.session) { await completeSignIn(); return }
      successKey.value = 'authPage.checkEmail'
      password.value = ''
      return
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email.value.trim(), password: password.value })
    if (error) throw error
    await completeSignIn()
  } catch (error) {
    errorKey.value = authErrorKey(error, authMode.value)
    emailError.value = ['authPage.invalidEmail', 'authPage.emailExists'].includes(errorKey.value)
    passwordError.value = ['authPage.invalidCredentials', 'authPage.weakPassword'].includes(errorKey.value)
  } finally {
    loading.value = false
  }
}
const continueWithProvider = async provider => {
  if (busy.value) return
  oauthLoading.value = provider
  errorKey.value = ''
  try {
    const callback = new URL(localizedPath('/login', locale.value), window.location.origin)
    callback.searchParams.set('oauth', 'callback')
    sessionStorage.setItem('elcomputer-auth-return', postAuthPath.value)
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: callback.toString() } })
    if (error) throw error
  } catch (error) {
    errorKey.value = authErrorKey(error, 'oauth')
    oauthLoading.value = ''
  }
}
watch(user, current => {
  if (import.meta.client && current?.sub && current.is_anonymous !== true && authMode.value !== 'recovery') completeSignIn()
}, { immediate: true })
onMounted(() => {
  if (route.query.error === 'account-disabled') errorKey.value = 'authPage.accountDisabled'
  if (route.query.error_description || (route.query.error && route.query.error !== 'account-disabled')) errorKey.value = 'authPage.oauthFailed'
  if (route.query.oauth === 'callback') {
    supabase.auth.getUser()
      .then(({ data }) => {
        if (data?.user && !data.user.is_anonymous) completeSignIn()
        else errorKey.value = 'authPage.oauthFailed'
      })
      .catch(() => { errorKey.value = 'authPage.oauthFailed' })
  }
})
</script>

<template>
  <div class="auth-page">
    <div class="auth-shell" :class="[`auth-shell--${layout}`]">
      <aside v-if="layout !== 'centered'" class="auth-visual" :class="{ 'auth-visual--light-image': usableLightImage, 'auth-visual--dark-image': usableDarkImage }" aria-hidden="true">
        <img v-if="usableLightImage" class="auth-visual-image auth-visual-image--light" :src="usableLightImage" alt="" :style="imagePosition" @error="markImageFailed(usableLightImage)">
        <img v-if="usableDarkImage" class="auth-visual-image auth-visual-image--dark" :src="usableDarkImage" alt="" :style="imagePosition" @error="markImageFailed(usableDarkImage)">
        <div class="auth-visual-shade" />
        <div v-if="settings.auth_show_visual_text !== false" class="auth-visual-copy">
          <p>{{ settings.auth_visual_eyebrow || $t('authPage.defaultVisualEyebrow') }}</p>
          <h2>{{ settings.auth_visual_headline || $t('authPage.defaultVisualHeadline') }}</h2>
          <span>{{ settings.auth_visual_supporting_text || $t('authPage.defaultVisualSupporting') }}</span>
        </div>
        <span class="auth-visual-signature">ELCOMPUTER</span>
      </aside>

      <div class="auth-form-side">
        <div class="auth-form-inner">
          <div class="auth-logo"><BrandLogo :settings="settings" :alt="settings.site_name || 'ELcomputer'" /></div>
          <div class="auth-intro">
            <p class="auth-kicker">{{ $t('authPage.account') }}</p>
            <h1>{{ authMode === 'forgot' ? $t('authPage.forgotHeading') : authMode === 'recovery' ? $t('authPage.recoveryHeading') : heading }}</h1>
            <p>{{ authMode === 'forgot' ? $t('authPage.forgotSupporting') : authMode === 'recovery' ? $t('authPage.recoverySupporting') : supporting }}</p>
          </div>
          <form class="auth-form" @submit.prevent="submitAuthForm">
            <div v-if="authMode === 'signup'" class="auth-field">
              <label for="customer-full-name">{{ $t('common.fullName') }}</label>
              <input id="customer-full-name" v-model="fullName" type="text" autocomplete="name" :disabled="busy" maxlength="120">
            </div>
            <div v-if="authMode !== 'recovery'" class="auth-field">
              <label for="customer-email">{{ $t('common.email') }}</label>
              <input id="customer-email" v-model="email" type="email" autocomplete="email" inputmode="email" required :disabled="busy" :aria-invalid="emailError" :aria-describedby="emailError ? 'auth-message' : undefined" maxlength="254">
            </div>
            <div v-if="authMode !== 'forgot'" class="auth-field">
              <div class="auth-field-header"><label for="customer-password">{{ authMode === 'recovery' ? $t('authPage.newPassword') : $t('common.password') }}</label><button v-if="authMode === 'login'" type="button" class="auth-text-link" :disabled="busy" @click="changeMode('forgot')">{{ $t('authPage.forgotPassword') }}</button></div>
              <div class="auth-password-wrap"><input id="customer-password" v-model="password" :type="showPassword ? 'text' : 'password'" :autocomplete="authMode === 'login' ? 'current-password' : 'new-password'" required :minlength="authMode === 'login' ? undefined : 6" :disabled="busy" :aria-invalid="passwordError" :aria-describedby="passwordError ? 'auth-message' : undefined"><button type="button" class="auth-password-toggle" :aria-label="showPassword ? $t('authPage.hidePassword') : $t('authPage.showPassword')" :aria-pressed="showPassword" :disabled="busy" @click="showPassword = !showPassword"><Icon :name="showPassword ? 'lucide:eye-off' : 'lucide:eye'" size="19" aria-hidden="true" /></button></div>
            </div>
            <p v-if="errorKey" id="auth-message" role="alert" class="auth-feedback auth-feedback--error">{{ $t(errorKey) }}</p>
            <p v-if="successKey" role="status" class="auth-feedback auth-feedback--success">{{ $t(successKey) }}</p>
            <button type="submit" class="auth-submit" :disabled="busy">{{ loading || finishing ? $t('common.redirecting') : authMode === 'signup' ? $t('common.createAccount') : authMode === 'forgot' ? $t('authPage.sendResetLink') : authMode === 'recovery' ? $t('authPage.updatePassword') : $t('authPage.signIn') }}</button>
          </form>
          <template v-if="authMode === 'login' || authMode === 'signup'">
            <div class="auth-divider"><span>{{ $t('authPage.orContinueWith') }}</span></div>
            <div class="auth-socials">
              <button type="button" class="auth-social" :disabled="busy" @click="continueWithProvider('google')"><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.27 5.48-4.8 7.18l7.73 6C44.38 38.03 46.98 31.89 46.98 24.55z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.14.76-4.59l-7.98-6.2A23.9 23.9 0 0 0 0 24c0 3.87.93 7.51 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48z"/></svg><span>{{ oauthLoading === 'google' ? $t('common.redirecting') : $t('common.continueWithGoogle') }}</span></button>
              <button v-if="showFacebook" type="button" class="auth-social" :disabled="busy" @click="continueWithProvider('facebook')"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.875 11.855v-8.386H7.078V12h3.047V9.356c0-3.008 1.792-4.669 4.532-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.49 0-1.955.925-1.955 1.874V12h3.328l-.532 3.469h-2.796v8.386A12.003 12.003 0 0 0 24 12z"/></svg><span>{{ oauthLoading === 'facebook' ? $t('common.redirecting') : $t('authPage.continueWithFacebook') }}</span></button>
            </div>
          </template>
          <p class="auth-switch"><template v-if="authMode === 'signup'">{{ $t('authPage.alreadyHaveAccount') }} <button type="button" @click="changeMode('login')">{{ $t('authPage.signIn') }}</button></template><template v-else>{{ authMode === 'login' ? $t('authPage.newHere') : $t('authPage.rememberPassword') }} <button type="button" @click="changeMode(authMode === 'login' ? 'signup' : 'login')">{{ authMode === 'login' ? $t('common.createAccount') : $t('authPage.signIn') }}</button></template></p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page { padding: clamp(24px, 3vw, 44px) 20px; background: var(--background); color: var(--text-primary); }
.auth-shell { display: grid; grid-template-columns: minmax(0, 45fr) minmax(0, 55fr); max-width: 1120px; min-height: 600px; margin: auto; overflow: hidden; border: 1px solid var(--border); border-radius: 18px; background: var(--surface); box-shadow: 0 18px 48px rgb(20 42 77 / 7%); }
.auth-shell--reversed { grid-template-columns: minmax(0, 55fr) minmax(0, 45fr); }
.auth-shell--reversed .auth-visual { order: 2; }
.auth-shell--centered { grid-template-columns: 1fr; max-width: 600px; min-height: 0; }
.auth-visual { position: relative; min-height: 600px; overflow: hidden; isolation: isolate; color: #193250; background: #eaf0f6; }
html.dark .auth-visual { color: #f2f6fc; background: #1b2a3e; }
.auth-visual--light-image { color: #fff; }
html.dark .auth-visual--dark-image { color: #fff; }
.auth-visual::before { content: ''; position: absolute; z-index: -1; inset: 0; background: linear-gradient(140deg, #f3f6fa, #dce8f4); }
html.dark .auth-visual::before { background: linear-gradient(140deg, #253951, #162235); }
.auth-visual::after { content: ''; position: absolute; z-index: -1; width: 76%; height: 42%; inset-inline-end: -10%; inset-block-start: 13%; border: 1px solid rgb(50 80 120 / 12%); transform: skewY(-25deg); }
.auth-visual-image { position: absolute; z-index: -1; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.auth-visual-image--dark { display: none; }
html.dark .auth-visual-image--light { display: none; }
html.dark .auth-visual-image--dark { display: block; }
.auth-visual-shade { position: absolute; z-index: -1; inset: 0; }
.auth-visual--light-image .auth-visual-shade, html.dark .auth-visual--dark-image .auth-visual-shade { background: linear-gradient(to top, rgb(5 16 34 / 78%), rgb(5 16 34 / 12%) 72%); }
html.dark .auth-visual:not(.auth-visual--dark-image) .auth-visual-shade { background: none; }
.auth-visual-copy { position: absolute; inset-inline: clamp(30px, 4vw, 64px); inset-block-end: 85px; max-width: 370px; }
.auth-visual-copy p { margin-bottom: 17px; font-size: 11px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: #1357a0; }
html.dark .auth-visual-copy p, .auth-visual--light-image .auth-visual-copy p { color: #b9d2f8; }
.auth-visual-copy h2 { font-size: clamp(30px, 3vw, 42px); line-height: 1.14; font-weight: 650; letter-spacing: -.035em; }
.auth-visual-copy span { display: block; margin-top: 19px; max-width: 300px; color: #526174; line-height: 1.55; }
html.dark .auth-visual-copy span, .auth-visual--light-image .auth-visual-copy span { color: #dce8f7; }
.auth-visual-signature { position: absolute; inset-inline-start: clamp(30px, 4vw, 64px); inset-block-end: 30px; font-size: 10px; font-weight: 700; letter-spacing: .24em; opacity: .7; }
.auth-form-side { display: flex; align-items: center; justify-content: center; min-width: 0; padding: clamp(30px, 4vw, 52px); }
.auth-form-inner { width: 100%; max-width: 380px; }
.auth-logo { width: 148px; height: 53px; margin-bottom: 26px; }
.auth-kicker { margin-bottom: 9px; color: var(--brand-text); font-size: 11px; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; }
.auth-intro h1 { font-size: clamp(27px, 2.5vw, 34px); font-weight: 700; letter-spacing: -.035em; line-height: 1.2; }
.auth-intro > p:last-child { margin-top: 10px; color: var(--text-secondary); font-size: 14px; line-height: 1.5; }
.auth-form { display: grid; gap: 17px; margin-top: 26px; }
.auth-field label { display: block; margin-bottom: 8px; font-size: 13px; font-weight: 650; }
.auth-field input { width: 100%; min-height: 46px; padding: 11px 13px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-primary); outline: none; transition: border-color .15s, box-shadow .15s; }
.auth-field input:focus-visible { border-color: var(--brand); box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 18%, transparent); }
.auth-field input[aria-invalid="true"] { border-color: var(--danger); }
.auth-field input:disabled { opacity: .6; cursor: not-allowed; }
.auth-field-header { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.auth-text-link, .auth-switch button { padding: 0; color: var(--brand-text); font-size: 13px; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
.auth-password-wrap { position: relative; }
.auth-password-wrap input { padding-inline-end: 48px; }
.auth-password-toggle { position: absolute; inset-inline-end: 5px; inset-block-start: 4px; display: grid; width: 38px; height: 38px; place-items: center; border-radius: 6px; color: var(--text-secondary); }
.auth-password-toggle:hover { color: var(--text-primary); background: var(--surface-muted); }
.auth-submit { min-height: 48px; border-radius: 8px; background: #0755d9; color: #fff; font-size: 14px; font-weight: 750; transition: background .15s; }
.auth-submit:hover { background: #0344ba; }
.auth-submit:disabled, .auth-social:disabled { cursor: not-allowed; opacity: .55; }
.auth-divider { display: flex; align-items: center; gap: 15px; margin: 21px 0 15px; color: var(--text-secondary); font-size: 12px; white-space: nowrap; }
.auth-divider::before, .auth-divider::after { content: ''; height: 1px; flex: 1; background: var(--border); }
.auth-socials { display: grid; gap: 10px; }
.auth-social { display: flex; align-items: center; justify-content: center; gap: 11px; min-height: 46px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-primary); font-size: 13px; font-weight: 650; transition: background .15s, border-color .15s; }
.auth-social:hover { background: var(--surface-muted); border-color: var(--text-secondary); }
.auth-switch { margin-top: 22px; color: var(--text-secondary); font-size: 13px; text-align: center; }
.auth-switch button { margin-inline-start: 3px; }
.auth-feedback { padding: 11px 12px; border-radius: 8px; font-size: 13px; line-height: 1.45; }
.auth-feedback--error { background: color-mix(in srgb, var(--danger) 11%, var(--surface)); color: var(--danger); }
.auth-feedback--success { background: color-mix(in srgb, var(--success) 12%, var(--surface)); color: var(--success); }
.auth-page button:focus-visible { outline: 2px solid var(--brand-text); outline-offset: 3px; }
@media (max-width: 800px) { .auth-shell { grid-template-columns: minmax(0, 40fr) minmax(0, 60fr); } .auth-shell--reversed { grid-template-columns: minmax(0, 60fr) minmax(0, 40fr); } .auth-form-side { padding: 36px; } .auth-visual-copy { inset-inline: 30px; } }
@media (max-width: 700px) { .auth-page { padding: 0; } .auth-shell, .auth-shell--reversed, .auth-shell--centered { display: block; min-height: 0; border: 0; border-radius: 0; box-shadow: none; } .auth-visual { display: none; } .auth-form-side { min-height: 580px; padding: 36px 24px 56px; } .auth-logo { margin-bottom: 32px; } }
@media (prefers-reduced-motion: reduce) { .auth-page *, .auth-page *::before, .auth-page *::after { transition-duration: 0s !important; } }
</style>
