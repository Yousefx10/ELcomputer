<script setup>
import { authErrorKey } from '~/utils/authPage'

const { uiLabel } = useUiLocale()
const { locale } = useI18n()
const config = useRuntimeConfig()
const colorMode = useColorMode()
const captchaProvider = computed(() => String(config.public.authCaptchaProvider || '').trim())
const captchaSiteKey = computed(() => String(config.public.turnstileSiteKey || '').trim())
const captchaRequired = computed(() => !!captchaProvider.value)
const captchaSupported = computed(() => captchaProvider.value === 'turnstile' && !!captchaSiteKey.value)
const captchaToken = ref(''), captchaResetKey = ref(0), errorKey = ref('')

const { uiNavigateTo } = useUiNavigation()

const supabase = useSupabaseClient()
const route = useUiRoute()
const {
  clearAdminAccess,
  loadAdminAccess
} = useAdminAccess()
const { recordAdminLog } = useAdminLogs()

useHead(() => ({ title: uiLabel('Dashboard - Login') }))

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

const login = async () => {
  if (loading.value) return
  if (captchaRequired.value && !captchaSupported.value) { errorKey.value = 'authPage.securityUnavailable'; return }
  if (captchaRequired.value && !captchaToken.value) { errorKey.value = 'authPage.securityRequired'; return }
  loading.value = true
  errorMessage.value = ''
  errorKey.value = ''
  clearAdminAccess()
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
      ...(captchaRequired.value ? { options: { captchaToken: captchaToken.value } } : {})
    })

    if (error) {
      errorKey.value = authErrorKey(error)
      return
    }

    const adminUser = await loadAdminAccess(true)

    if (!adminUser?.is_active) {
      clearAdminAccess()
      await supabase.auth.signOut()
      errorMessage.value = 'This account does not have dashboard access.'
      return
    }

    await recordAdminLog({
      actionKey: 'dashboard.login',
      description: 'Signed in to the dashboard.'
    })

    await uiNavigateTo('/dashboard')
  } catch (error) {
    errorKey.value = authErrorKey(error)
  } finally {
    if (captchaRequired.value) { captchaToken.value = ''; captchaResetKey.value++ }
    loading.value = false
  }
}

onMounted(() => {
  if (route.query.error === 'not-authorized') {
    errorMessage.value = 'This account does not have dashboard access.'
  }
})
</script>

<template>
  <div class="fixed end-4 top-4 z-10"><UiPreferences /></div>
  <div class="min-h-screen flex items-center justify-center bg-gray-100 px-4">
    <form
      @submit.prevent="login"
      class="w-full max-w-sm rounded-2xl bg-white p-6 shadow"
    >
      <h1 class="mb-2 text-2xl font-bold">{{ $t('common.adminLogin') }}</h1>

      <p class="mb-6 text-sm text-gray-500">
        {{ $t('dashboard.login.signInToManageYourStore') }}
      </p>

      <input
        v-model="email"
        type="email"
        :placeholder="$t('common.email')"
        class="mb-3 w-full rounded-lg border p-3"
      />

      <input
        v-model="password"
        type="password"
        :placeholder="$t('common.password')"
        class="mb-3 w-full rounded-lg border p-3"
      />

      <AuthTurnstile v-if="captchaRequired && captchaSupported" v-model="captchaToken" class="mb-3" :site-key="captchaSiteKey" :language="locale" :theme="colorMode.value" :reset-key="captchaResetKey" :disabled="loading" />
      <p v-else-if="captchaRequired" role="alert" class="mb-3 text-sm text-red-600">{{ $t('authPage.securityUnavailable') }}</p>
      <p v-if="errorKey" role="alert" class="mb-3 text-sm text-red-600">{{ $t(errorKey) }}</p>
      <p v-else-if="errorMessage" class="mb-3 text-sm text-red-600">
        {{ $uiMessage(errorMessage) }}
      </p>

      <button
        type="submit"
        :disabled="loading || (captchaRequired && !captchaToken)"
        class="w-full rounded-lg bg-blue-600 p-3 font-bold text-white"
      >
        {{ loading ? $t('common.loading') : $t('common.login') }}
      </button>

      <p class="mt-4 text-center text-sm text-gray-500">
        {{ $t('common.shopper') }}
        <NuxtLinkLocale to="/login" class="font-semibold text-blue-600 hover:text-blue-700">
          {{ $t('common.goToCustomerLogin') }}
        </NuxtLinkLocale>
      </p>
    </form>
  </div>
</template>
