<script setup>
const { uiLabel } = useUiLocale()

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
  loading.value = true
  errorMessage.value = ''
  clearAdminAccess()

  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value
  })

  loading.value = false

  if (error) {
    errorMessage.value = error.message
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

      <p v-if="errorMessage" class="mb-3 text-sm text-red-600">
        {{ $uiMessage(errorMessage) }}
      </p>

      <button
        type="submit"
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
