<script setup>
const supabase = useSupabaseClient()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

const login = async () => {
  loading.value = true
  errorMessage.value = ''

  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value
  })

  loading.value = false

  if (error) {
    errorMessage.value = error.message
    return
  }

  await navigateTo('/dashboard')
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100 px-4">
    <form
      @submit.prevent="login"
      class="w-full max-w-sm rounded-2xl bg-white p-6 shadow"
    >
      <h1 class="mb-6 text-2xl font-bold">Admin Login</h1>

      <input
        v-model="email"
        type="email"
        placeholder="Email"
        class="mb-3 w-full rounded-lg border p-3"
      />

      <input
        v-model="password"
        type="password"
        placeholder="Password"
        class="mb-3 w-full rounded-lg border p-3"
      />

      <p v-if="errorMessage" class="mb-3 text-sm text-red-600">
        {{ errorMessage }}
      </p>

      <button
        type="submit"
        class="w-full rounded-lg bg-blue-600 p-3 font-bold text-white"
      >
        {{ loading ? 'Loading...' : 'Login' }}
      </button>
    </form>
  </div>
</template>