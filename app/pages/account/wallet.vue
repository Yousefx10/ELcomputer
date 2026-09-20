<script setup>
import { formatAccountMoney } from '~/utils/accountOrders'
import { resolveAccountUser } from '~/utils/accountSession'

definePageMeta({ layout: 'account', middleware: 'customer-auth' })
useHead({ title: 'Your Wallet' })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const loading = ref(true)
const error = ref('')
const balance = ref(0)
let loadVersion = 0

const load = async () => {
  const version = ++loadVersion
  loading.value = true
  error.value = ''
  try {
    const currentUser = await resolveAccountUser(supabase, user.value)
    if (!currentUser) throw new Error('No customer session')
    const result = await supabase.from('customer_profiles')
      .select('wallet_balance').eq('id', currentUser.id).maybeSingle()
      .abortSignal(AbortSignal.timeout(20000))
    if (result.error) throw result.error
    if (version === loadVersion) balance.value = Number(result.data?.wallet_balance || 0)
  } catch {
    if (version === loadVersion) error.value = 'Could not load your wallet. Please try again.'
  } finally {
    if (version === loadVersion) loading.value = false
  }
}

onMounted(load)
watch(() => user.value?.sub || user.value?.id, load)
</script>

<template>
  <div class="space-y-5">
    <header><p class="text-sm font-semibold text-blue-700">Your account</p><h1 class="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Wallet</h1><p class="mt-1 text-sm text-slate-600">Your available store balance.</p></header>
    <p v-if="error" role="alert" class="rounded-xl bg-red-50 p-4 text-sm text-red-700">{{ error }}</p>
    <section class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="balance-title"><div class="flex items-center gap-3"><span class="flex size-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-800"><Icon name="lucide:wallet" size="23" aria-hidden="true" /></span><h2 id="balance-title" class="text-sm font-semibold text-slate-600">Available balance</h2></div><p class="mt-4 text-3xl font-bold text-slate-900" role="status">{{ loading || error ? '—' : formatAccountMoney(balance) }}</p></section>
    <p class="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">Your current balance is shown above. A detailed activity list is not available yet.</p>
    <NuxtLink to="/account/support" class="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">Contact support <Icon name="lucide:arrow-right" size="16" class="ml-1" aria-hidden="true" /></NuxtLink>
  </div>
</template>
