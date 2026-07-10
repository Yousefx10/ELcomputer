<script setup>
const supabase = useSupabaseClient()
const route = useRoute()
const user = useSupabaseUser()

const authMode = ref(route.query.mode === 'signup' ? 'signup' : 'login')
const fullName = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const oauthLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const getPostAuthPath = () => {
  const redirectPath = typeof route.query.redirect === 'string' ? route.query.redirect : ''
  return redirectPath.startsWith('/') ? redirectPath : '/account'
}

const resetMessages = () => {
  errorMessage.value = ''
  successMessage.value = ''
}

const switchMode = (mode) => {
  authMode.value = mode
  resetMessages()
}

const getCustomerProfilePayload = () => {
  const trimmedName = fullName.value.trim()

  return {
    full_name: trimmedName || undefined
  }
}

const createOrUpdateCustomerProfile = async () => {
  const currentUser = user.value

  if (!currentUser) {
    return
  }

  const fallbackName = currentUser.user_metadata?.full_name
    || currentUser.user_metadata?.name
    || currentUser.email?.split('@')[0]
    || 'Customer'

  const { error } = await supabase
    .from('customer_profiles')
    .upsert({
      id: currentUser.id,
      email: currentUser.email || '',
      full_name: fullName.value.trim() || fallbackName,
      avatar_url: currentUser.user_metadata?.avatar_url || null
    })

  if (error) {
    throw error
  }
}

const submitAuthForm = async () => {
  loading.value = true
  resetMessages()

  try {
    if (authMode.value === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email: email.value,
        password: password.value,
        options: {
          data: getCustomerProfilePayload()
        }
      })

      if (error) {
        throw error
      }

      if (data.session) {
        await createOrUpdateCustomerProfile()
        await navigateTo(getPostAuthPath())
        return
      }

      successMessage.value = 'Your account was created successfully. You can sign in now.'
      authMode.value = 'login'
      password.value = ''
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value
    })

    if (error) {
      throw error
    }

    const currentUser = user.value

    if (currentUser) {
      const { data: existingProfile, error: existingProfileError } = await supabase
        .from('customer_profiles')
        .select('is_active')
        .eq('id', currentUser.id)
        .maybeSingle()

      if (existingProfileError) {
        throw existingProfileError
      }

      if (existingProfile && existingProfile.is_active === false) {
        await supabase.auth.signOut()
        throw new Error('This customer account is disabled.')
      }
    }

    await createOrUpdateCustomerProfile()
    await navigateTo(getPostAuthPath())
  } catch (error) {
    errorMessage.value = error?.message || 'Could not complete the request.'
  } finally {
    loading.value = false
  }
}

const continueWithGoogle = async () => {
  oauthLoading.value = true
  resetMessages()

  try {
    const redirectTo = import.meta.client
      ? `${window.location.origin}/account`
      : undefined

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: redirectTo ? { redirectTo } : undefined
    })

    if (error) {
      throw error
    }
  } catch (error) {
    errorMessage.value = error?.message || 'Could not start Google sign in.'
    oauthLoading.value = false
  }
}

watch(
  user,
  async (currentUser) => {
    if (currentUser) {
      await navigateTo(getPostAuthPath())
    }
  },
  { immediate: true }
)

onMounted(() => {
  if (route.query.error === 'account-disabled') {
    errorMessage.value = 'This customer account is disabled.'
  }
})
</script>

<template>
  <div class="min-h-screen bg-gray-100 px-4 py-10">
    <div class="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.05fr_minmax(0,1fr)]">
      <div class="rounded-3xl bg-blue-600 p-8 text-white shadow">
        <p class="text-sm font-semibold uppercase tracking-[0.2em] text-blue-100">
          Customer Account
        </p>

        <h1 class="mt-4 text-4xl font-bold">
          Shop faster and keep your orders in one place.
        </h1>

        <p class="mt-4 text-sm text-blue-100">
          Create your account to review orders, track delivery progress, and keep your wallet balance ready for future purchases.
        </p>

        <div class="mt-8 space-y-4">
          <div class="rounded-2xl bg-white/10 p-4">
            <p class="text-sm font-semibold">Your account dashboard</p>
            <p class="mt-1 text-sm text-blue-100">
              View total orders, delivered orders, in-progress orders, and your wallet balance.
            </p>
          </div>

          <div class="rounded-2xl bg-white/10 p-4">
            <p class="text-sm font-semibold">One login for the store</p>
            <p class="mt-1 text-sm text-blue-100">
              Customer access is separated from the admin dashboard login.
            </p>
          </div>
        </div>
      </div>

      <div class="rounded-3xl bg-white p-6 shadow">
        <div class="grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1">
          <button
            type="button"
            class="rounded-2xl px-4 py-3 text-sm font-semibold transition"
            :class="authMode === 'login' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'"
            @click="switchMode('login')"
          >
            Login
          </button>

          <button
            type="button"
            class="rounded-2xl px-4 py-3 text-sm font-semibold transition"
            :class="authMode === 'signup' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'"
            @click="switchMode('signup')"
          >
            Create Account
          </button>
        </div>

        <div class="mt-6">
          <h2 class="text-2xl font-bold text-gray-900">
            {{ authMode === 'login' ? 'Customer Login' : 'Create Your Account' }}
          </h2>

          <p class="mt-2 text-sm text-gray-500">
            {{ authMode === 'login'
              ? 'Sign in to access your customer account.'
              : 'Create a customer account for faster checkout and order tracking.' }}
          </p>
        </div>

        <form class="mt-6 space-y-4" @submit.prevent="submitAuthForm">
          <div v-if="authMode === 'signup'">
            <label class="mb-2 block text-sm font-semibold text-gray-700">Full Name</label>
            <input
              v-model="fullName"
              type="text"
              placeholder="Your name"
              class="w-full rounded-xl border p-3 outline-none focus:border-blue-500"
            >
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700">Email</label>
            <input
              v-model="email"
              type="email"
              placeholder="you@example.com"
              class="w-full rounded-xl border p-3 outline-none focus:border-blue-500"
            >
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gray-700">Password</label>
            <input
              v-model="password"
              type="password"
              placeholder="At least 6 characters"
              class="w-full rounded-xl border p-3 outline-none focus:border-blue-500"
            >
          </div>

          <p v-if="errorMessage" class="text-sm text-red-600">
            {{ errorMessage }}
          </p>

          <p v-if="successMessage" class="text-sm text-green-600">
            {{ successMessage }}
          </p>

          <button
            type="submit"
            :disabled="loading || oauthLoading"
            class="w-full rounded-xl bg-blue-600 p-3 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {{ loading
              ? (authMode === 'login' ? 'Logging in...' : 'Creating account...')
              : (authMode === 'login' ? 'Login' : 'Create Account') }}
          </button>
        </form>

        <div class="my-6 flex items-center gap-3">
          <div class="h-px flex-1 bg-gray-200" />
          <span class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">or</span>
          <div class="h-px flex-1 bg-gray-200" />
        </div>

        <button
          type="button"
          :disabled="loading || oauthLoading"
          class="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 p-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
          @click="continueWithGoogle"
        >
          <Icon name="lucide:chrome" size="18" />
          {{ oauthLoading ? 'Redirecting...' : 'Continue with Google' }}
        </button>

        <p class="mt-4 text-center text-xs text-gray-500">
          Google sign in works after you enable the Google provider in Supabase Authentication settings.
        </p>

        <p class="mt-6 text-center text-sm text-gray-500">
          Admin?
          <NuxtLink to="/dashboard/login" class="font-semibold text-blue-600 hover:text-blue-700">
            Go to dashboard login
          </NuxtLink>
        </p>
      </div>
    </div>
  </div>
</template>
