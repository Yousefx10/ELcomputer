<template>
  <div class="min-h-screen bg-gray-100">
    <div v-if="authChecked" class="mx-auto max-w-6xl px-6 pt-6">
      <header class="mb-4 flex items-center justify-between rounded-2xl bg-white p-4 shadow">
        <NuxtLink to="/dashboard" class="text-lg font-bold text-gray-900">
          ELcomputer Admin
        </NuxtLink>

        <button
          @click="logout"
          class="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Logout
        </button>
      </header>

      <div class="mb-6 rounded-2xl bg-white shadow">
        <LayoutDashboardNavBar />
      </div>

      <main>
        <slot />
      </main>
    </div>

    <div v-else class="mx-auto max-w-6xl px-6 pt-6">
      <div class="rounded-2xl bg-white p-6 text-center text-gray-500 shadow">
        Loading dashboard...
      </div>
    </div>
  </div>
</template>

<script setup>
const supabase = useSupabaseClient()
const authChecked = ref(false)

const logout = async () => {
  await supabase.auth.signOut()
  await navigateTo('/dashboard/login')
}

onMounted(async () => {
  const { data } = await supabase.auth.getSession()

  if (!data.session) {
    await navigateTo('/dashboard/login')
    return
  }

  authChecked.value = true
})
</script>

<style>

</style>
