<script setup>
import { resolveAccountUser } from '~/utils/accountSession'

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const profile = ref(null)
const { data: accountAppearance } = await useAccountAppearance()
const isModern = computed(() => accountAppearance.value?.account_dashboard_style === 'modern')
const route = useRoute()

const displayName = computed(() => profile.value?.full_name
  || user.value?.user_metadata?.full_name
  || user.value?.user_metadata?.name
  || user.value?.email?.split('@')[0]
  || 'Your account')
const initials = computed(() => displayName.value.trim().split(/\s+/).slice(0, 2)
  .map(part => part[0]?.toUpperCase()).join(''))
const memberYear = computed(() => {
  const date = new Date(profile.value?.created_at || user.value?.created_at || '')
  return Number.isNaN(date.getTime()) ? '' : String(date.getFullYear())
})
const accountSection = computed(() => {
  if (route.path.startsWith('/account/orders')) return 'Orders'
  if (route.path.startsWith('/account/messages')) return 'Messages'
  if (route.path.startsWith('/account/support')) return 'Support'
  if (route.path.startsWith('/account/wallet')) return 'Wallet'
  if (route.path.startsWith('/account/profile')) return 'Profile'
  return 'Home'
})

const loadProfile = async () => {
  try {
    const currentUser = await resolveAccountUser(supabase, user.value)
    if (!currentUser) return
    const { data } = await supabase.from('customer_profiles')
      .select('full_name, created_at').eq('id', currentUser.id).maybeSingle()
      .abortSignal(AbortSignal.timeout(20000))
    profile.value = data || null
  } catch {
    profile.value = null
  }
}

const logout = async () => {
  await supabase.auth.signOut()
  await navigateTo('/')
}

onMounted(() => {
  loadProfile()
  window.addEventListener('account:profile-updated', loadProfile)
})
onBeforeUnmount(() => window.removeEventListener('account:profile-updated', loadProfile))
watch(() => user.value?.sub || user.value?.id, loadProfile)
</script>

<template>
  <NuxtLayout name="default">
    <div v-if="isModern" class="min-h-screen bg-[#f7f9fc] py-6 sm:py-8">
      <div class="mx-auto max-w-7xl px-4 sm:px-6">
        <div class="mb-5 flex items-center gap-2 text-sm text-slate-500">
          <NuxtLink to="/account" class="hover:text-blue-700">My account</NuxtLink>
          <Icon name="lucide:chevron-right" size="15" aria-hidden="true" />
          <span class="font-medium text-slate-800">{{ accountSection }}</span>
        </div>
        <div class="grid items-start gap-6 lg:grid-cols-[265px_minmax(0,1fr)] lg:gap-8">
          <aside class="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 lg:sticky lg:top-5 lg:p-5" aria-label="Account sidebar">
            <div class="border-b border-slate-200 px-2 pb-5">
              <p class="text-xl font-bold text-slate-950">Hi, {{ displayName.split(' ')[0] }}</p>
              <p v-if="memberYear" class="mt-1 text-sm text-slate-500">Member since {{ memberYear }}</p>
              <p v-if="user?.email" class="mt-2 truncate text-xs text-slate-500">{{ user.email }}</p>
            </div>
            <AccountNavigation variant="modern" />
            <button type="button" class="mt-5 flex min-h-11 w-full items-center gap-3 border-t border-slate-200 px-3 pt-4 text-sm font-medium text-slate-700 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600" @click="logout">
              <Icon name="lucide:log-out" size="18" aria-hidden="true" /> Sign out
            </button>
          </aside>
          <div id="account-content" class="min-w-0"><slot /></div>
        </div>
      </div>
    </div>
    <div v-else class="min-h-screen bg-slate-50 py-6 sm:py-8">
      <div class="mx-auto max-w-7xl px-4 sm:px-6">
        <div class="grid items-start gap-5 lg:grid-cols-[238px_minmax(0,1fr)] lg:gap-7">
          <aside class="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 lg:sticky lg:top-5 lg:p-4" aria-label="Account sidebar">
            <NuxtLink to="/account/profile" class="flex items-center gap-3 rounded-xl bg-blue-50 p-3 text-slate-900 transition hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
              <span class="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white" aria-hidden="true">{{ initials || 'A' }}</span>
              <span class="min-w-0">
                <span class="block truncate text-sm font-bold">{{ displayName }}</span>
                <span class="block truncate text-xs text-slate-600">{{ user?.email }}</span>
              </span>
            </NuxtLink>
            <p v-if="memberYear" class="mt-2 px-3 text-xs text-slate-500">Member since {{ memberYear }}</p>
            <AccountNavigation />
            <button type="button" class="mt-3 inline-flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600" @click="logout">
              <Icon name="lucide:log-out" size="17" aria-hidden="true" /> Log out
            </button>
          </aside>
          <div class="min-w-0 space-y-5"><slot /></div>
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>
